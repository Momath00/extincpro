"""Importe l'historique Excel de Sécurité Incendie National (migration
ponctuelle — voir inspections/import_excel_sin.py pour la lecture).

    python manage.py importer_securite_nationale CHEMIN [CHEMIN…] --dry-run
    python manage.py importer_securite_nationale CHEMIN [CHEMIN…]

Une visite = les classeurs d'un même dossier (alarme, extincteurs,
éclairage du même bâtiment le même jour). Un dossier qui contient des
sous-dossiers donne une visite par sous-dossier ; des fichiers passés
directement forment ensemble une seule visite.

Les rapports sont créés FERMÉS comme historique : pas de `fermer()`, donc
ni certificat, ni courriel, ni brouillon de la visite suivante. Relancer
la commande ne recrée pas un rapport déjà présent (même bâtiment, même
type, même date d'inspection). `--dry-run` fait tout puis annule.
"""

import re
from datetime import datetime, time, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Utilisateur
from inspections import dossier as D
from inspections import import_excel_sin as X
from inspections.models import (
    Batiment,
    Client,
    Dispositif,
    EclairageUrgenceItem,
    ExtincteurItem,
    FicheE1,
    FicheE2,
    FicheLegende,
    Rapport,
    RapportEclairageUrgence,
    RapportExtincteur,
    SectionDispositif,
)
from organisations.models import Organisation

# Codes du gabarit S-536 → codes d'ExtincPro (fiche E3 et légende).
ALIAS_DISPOSITIF = {"VH": "K/S", "C": "B", "EOL": "FDL", "DS": "DFG", "FS": "IDG", "ET": "TEL", "EM": "ISO"}
ALIAS_LEGENDE = {"VH": "K/S", "B": "C", "HT": "RHT", "EOL": "FDL", "DS": "DFG", "FS": "IDG", "ET": "TEL", "EM": "ISO"}
CODES_DISPOSITIF = {code for code, _libelle in Dispositif.TypeDispositif.choices}
REPONSE_BOOL = {"oui": True, "non": False}
FORMATS = {code for code, _libelle in ExtincteurItem.Format.choices}


class AnnulerSimulation(Exception):
    pass


class Command(BaseCommand):
    help = "Importe les rapports Excel (alarme S-536, extincteurs NFPA 10, éclairage NFPA 101) de Sécurité Incendie National."

    def add_arguments(self, parser):
        parser.add_argument("chemins", nargs="+", help="Dossiers de visites ou classeurs .xlsx.")
        parser.add_argument("--organisation", default="Sécurité Incendie National", help="Nom, slug ou id de l'organisation.")
        parser.add_argument("--superviseur", help="Nom d'utilisateur inscrit comme créateur (défaut : premier superviseur).")
        parser.add_argument("--dry-run", action="store_true", help="Simule l'import puis annule tout.")

    def handle(self, *args, **options):
        self.organisation = self._organisation(options["organisation"])
        self.superviseur = self._superviseur(options["superviseur"])
        visites = self._visites(options["chemins"])
        if not visites:
            raise CommandError("Aucun classeur .xlsx trouvé.")

        self.compteurs = {"visites": 0, "alarme": 0, "extincteurs": 0, "eclairage": 0, "ignores": 0, "erreurs": 0}
        self.techniciens = {}
        try:
            with transaction.atomic():
                for nom, fichiers in visites:
                    self._importer_visite(nom, fichiers)
                if options["dry_run"]:
                    raise AnnulerSimulation
        except AnnulerSimulation:
            self.stdout.write(self.style.WARNING("\nSimulation (--dry-run) : rien n'a été enregistré."))

        c = self.compteurs
        self.stdout.write(self.style.SUCCESS(
            f"\n{c['visites']} visite(s) : {c['alarme']} rapport(s) alarme, {c['extincteurs']} extincteurs, "
            f"{c['eclairage']} éclairage ; {c['ignores']} déjà présent(s), {c['erreurs']} fichier(s) en erreur."
        ))

    # ── Préparation ─────────────────────────────────────────────────────────

    def _organisation(self, valeur):
        organisations = Organisation.objects.all()
        trouvee = (
            (organisations.filter(pk=valeur).first() if str(valeur).isdigit() else None)
            or organisations.filter(slug=valeur).first()
            or next((o for o in organisations if X.norm(o.nom) == X.norm(valeur)), None)
        )
        if trouvee is None:
            raise CommandError(f"Organisation introuvable : {valeur}")
        return trouvee

    def _superviseur(self, username):
        utilisateurs = Utilisateur.objects.filter(organisation=self.organisation, role=Utilisateur.Role.SUPERVISEUR)
        superviseur = utilisateurs.filter(username=username).first() if username else utilisateurs.order_by("id").first()
        if superviseur is None:
            raise CommandError(f"Aucun superviseur {username or ''} dans {self.organisation.nom}.")
        return superviseur

    def _visites(self, chemins) -> list[tuple[str, list[Path]]]:
        visites, isoles = [], []
        for chemin in map(Path, chemins):
            if chemin.is_file():
                isoles.append(chemin)
                continue
            if not chemin.is_dir():
                raise CommandError(f"Chemin introuvable : {chemin}")
            for dossier in sorted({chemin, *(p for p in chemin.rglob("*") if p.is_dir())}):
                fichiers = sorted(p for p in dossier.glob("*.xlsx") if not p.name.startswith("~$"))
                if fichiers:
                    visites.append((str(dossier), fichiers))
        if isoles:
            visites.append(("fichiers passés en argument", isoles))
        return visites

    # ── Une visite ──────────────────────────────────────────────────────────

    def _importer_visite(self, nom, fichiers):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n▸ {nom}"))
        lus = {}
        for fichier in fichiers:
            try:
                donnees = X.lire_fichier(fichier)
            except Exception as exc:  # noqa: BLE001 — un classeur illisible ne bloque pas les autres
                self.compteurs["erreurs"] += 1
                self._avertir(f"{fichier.name} : {exc}")
                continue
            if donnees["type"] in lus:
                self._avertir(f"{fichier.name} : deuxième classeur {donnees['type']} dans la visite, ignoré.")
                continue
            lus[donnees["type"]] = donnees
            for message in donnees["avertissements"]:
                self._avertir(f"{fichier.name} : {message}")
        if not lus:
            return

        # Le classeur alarme est le plus complet (ville, code postal) : il fait foi.
        ordre = [lus[t] for t in (X.ALARME, X.EXTINCTEURS, X.ECLAIRAGE) if t in lus]
        principal = ordre[0]
        self._comparer(ordre, "adresse", lambda d: d["batiment"]["adresse"])
        self._comparer(ordre, "nom du client", lambda d: d["client"]["nom"])
        self._comparer(ordre, "date", lambda d: d["date"])
        jour = principal["date"] or next((d["date"] for d in ordre if d["date"]), None)
        if jour is None:
            self._avertir("Aucune date d'inspection lisible : visite ignorée.")
            self.compteurs["erreurs"] += 1
            return

        with transaction.atomic():
            batiment = self._batiment(principal, ordre)
            self.compteurs["visites"] += 1
            alarme = extincteurs = None
            if X.ALARME in lus:
                alarme = self._rapport_alarme(batiment, jour, lus[X.ALARME])
            if X.EXTINCTEURS in lus:
                extincteurs = self._rapport_extincteurs(batiment, jour, lus[X.EXTINCTEURS], alarme)
            if X.ECLAIRAGE in lus:
                self._rapport_eclairage(batiment, jour, lus[X.ECLAIRAGE], extincteurs)

    def _comparer(self, ordre, libelle, valeur):
        valeurs = {}
        for d in ordre:
            if valeur(d):
                valeurs.setdefault(X.norm(valeur(d)), (Path(d["fichier"]).name, valeur(d)))
        if len(valeurs) > 1:
            detail = " / ".join(f"{v} ({f})" for f, v in valeurs.values())
            self._avertir(f"{libelle.capitalize()} différent(e) d'un classeur à l'autre : {detail} — on garde {next(iter(valeurs.values()))[1]}.")

    def _avertir(self, message):
        self.stdout.write(self.style.WARNING(f"  ⚠ {message}"))

    def _batiment(self, principal, ordre) -> Batiment:
        info = principal["batiment"]
        numero, rue = X.separer_adresse(info["adresse"])
        if not numero:
            raise CommandError(f"Adresse sans numéro civique : « {info['adresse']} » ({principal['fichier']})")

        batiment = next(
            (
                b for b in Batiment.objects.filter(client__organisation=self.organisation, numero_civique__iexact=numero)
                if X.norm(b.rue) == X.norm(rue)
            ),
            None,
        )
        if batiment is not None:
            self.stdout.write(f"  Bâtiment existant : {batiment}")
            self._completer(batiment, {
                "ville": info.get("ville", ""), "code_postal": info.get("code_postal", ""),
                "fabricant_reseau": info.get("fabricant_reseau", ""), "modele_systeme": info.get("modele_systeme", ""),
            })
            return batiment

        client = self._client(principal, ordre)
        batiment = Batiment.objects.create(
            client=client, numero_civique=numero, rue=rue, ville=info.get("ville", ""),
            code_postal=info.get("code_postal", ""), fabricant_reseau=info.get("fabricant_reseau", ""),
            modele_systeme=info.get("modele_systeme", ""),
        )
        self.stdout.write(f"  Bâtiment créé : {batiment}")
        return batiment

    def _client(self, principal, ordre) -> Client:
        noms = {X.norm(d["client"]["nom"]) for d in ordre if d["client"]["nom"]}
        client = next((c for c in Client.objects.filter(organisation=self.organisation) if X.norm(c.nom) in noms), None)
        # Coordonnées : celles du classeur principal, complétées par les autres.
        coordonnees = {
            champ: next((d["client"][champ] for d in ordre if d["client"].get(champ)), "")
            for champ in ("contact_nom", "contact_telephone", "contact_email", "adresse")
        }
        coordonnees["contact_nom"] = X.nom_personne(coordonnees["contact_nom"])
        if client is not None:
            self.stdout.write(f"  Client existant : {client.nom}")
            self._completer(client, coordonnees)
            return client
        client = Client.objects.create(organisation=self.organisation, nom=principal["client"]["nom"] or principal["batiment"]["nom"], **coordonnees)
        self.stdout.write(f"  Client créé : {client.nom}")
        return client

    @staticmethod
    def _completer(objet, valeurs):
        """Remplit les champs vides seulement — on n'écrase rien de saisi dans ExtincPro."""
        modifies = [champ for champ, valeur in valeurs.items() if valeur and not getattr(objet, champ)]
        for champ in modifies:
            setattr(objet, champ, valeurs[champ][: objet._meta.get_field(champ).max_length])
        if modifies:
            objet.save(update_fields=modifies)

    # ── Rapports ────────────────────────────────────────────────────────────

    def _technicien(self, nom):
        cible = X.norm(X.nom_personne(nom))
        if not cible:
            return None
        if cible not in self.techniciens:
            self.techniciens[cible] = next(
                (
                    u for u in Utilisateur.objects.filter(organisation=self.organisation)
                    if cible in (X.norm(f"{u.first_name} {u.last_name}"), X.norm(f"{u.last_name} {u.first_name}"), X.norm(u.username))
                ),
                None,
            )
            if self.techniciens[cible] is None:
                self._avertir(f"Technicien « {nom} » sans compte dans {self.organisation.nom} : non assigné.")
        return self.techniciens[cible]

    def _champs_fermeture(self, jour):
        return {
            "statut": "ferme",
            "date_inspection": jour,
            "date_fermeture": timezone.make_aware(datetime.combine(jour, time(12))),
            "prochaine_inspection": jour + timedelta(days=365),
            "cree_par": self.superviseur,
        }

    def _deja_present(self, modele, batiment, jour, libelle):
        existant = modele.objects.filter(batiment=batiment, date_inspection=jour).first()
        if existant is not None:
            self.compteurs["ignores"] += 1
            self.stdout.write(f"  = Rapport {libelle} du {jour} déjà présent (#{existant.pk}), non recréé.")
        return existant

    def _finaliser(self, rapport, donnees, compteur, libelle, nb):
        technicien = self._technicien(donnees["technicien"])
        if technicien is not None:
            rapport.techniciens.add(technicien)
        rapport.historiser(self.superviseur, f"Importé depuis Excel ({Path(donnees['fichier']).name})"[:300])
        # Copie figée dans le dossier du bâtiment, comme à une fermeture normale.
        module, rapport_id = D.module_de(rapport), rapport.pk
        transaction.on_commit(lambda: D.archiver_rapport(module, rapport_id, self.superviseur))
        self.compteurs[compteur] += 1
        self.stdout.write(self.style.SUCCESS(f"  + Rapport {libelle} #{rapport.pk} ({nb})"))

    def _rapport_alarme(self, batiment, jour, donnees) -> Rapport:
        existant = self._deja_present(Rapport, batiment, jour, "alarme")
        if existant is not None:
            return existant
        rapport = Rapport.objects.create(batiment=batiment, **self._champs_fermeture(jour))

        e1 = donnees["e1"]
        technicien = self._technicien(donnees["technicien"])
        FicheE1.objects.create(
            rapport=rapport,
            fonctionnement_une_etape=REPONSE_BOOL.get(e1.get("A")),
            fonctionnement_deux_etapes=REPONSE_BOOL.get(e1.get("B")),
            inspection_essai_conforme=REPONSE_BOOL.get(e1.get("C")),
            documentation_sur_place=REPONSE_BOOL.get(e1.get("D")),
            reseau_fonctionnel=REPONSE_BOOL.get(e1.get("E")),
            lacunes_constatees=REPONSE_BOOL.get(e1.get("F")),
            commentaires=e1.get("G", ""),
            copie_remise_responsable=REPONSE_BOOL.get(e1.get("H")),
            signataire=technicien,
            date_signature=rapport.date_fermeture if technicien else None,
        )

        e2 = donnees["e2"]
        e2_1, e2_5 = e2.get("e2_1", {}), e2.get("e2_5", {})
        FicheE2.objects.create(
            rapport=rapport,
            details=e2,
            localisation=e2_1.get("localisation", "")[:200],
            description_panneau=e2_1.get("description", "")[:200],
            tension_sous_alimentation=e2_5.get("C", "")[:20],
            tension_pleine_charge=e2_5.get("E", "")[:20],
            courant_charge=e2_5.get("F", "")[:20],
            signal_alarme_ok=REPONSE_BOOL.get(e2_1.get("H")),
            rearmement_ok=REPONSE_BOOL.get(e2_1.get("AA")),
            commutation_alimentation_ok=REPONSE_BOOL.get(e2_1.get("BB")),
        )

        legende = {}
        for code, ligne in donnees["legende"].items():
            description = ligne["description"]
            if ligne["quantite"]:
                description = f"{description} (quantité : {ligne['quantite']})"
            legende[ALIAS_LEGENDE.get(code, code)] = {"type": description, "modele": ""}
        FicheLegende.objects.create(rapport=rapport, dispositifs=legende)

        section = SectionDispositif.objects.create(rapport=rapport, nom="Fiche des dispositifs", ordre=0)
        inconnus = set()
        for ligne in donnees["dispositifs"]:
            code = ALIAS_DISPOSITIF.get(ligne["code"], ligne["code"])
            remarque = ligne["remarque"]
            if code not in CODES_DISPOSITIF:
                inconnus.add(ligne["code"])
                remarque = f"{remarque} (code Excel : {ligne['code']})".strip()
                code = None
            Dispositif.objects.create(
                rapport=rapport,
                section=section,
                localisation=ligne["emplacement"][:200],
                type_dispositif=code,
                installation_correcte=REPONSE_BOOL.get({"o": "oui", "n": "non"}.get(ligne["installation"])),
                necessite_entretien=REPONSE_BOOL.get({"o": "oui", "n": "non"}.get(ligne["entretien"])),
                alarme_confirmee=REPONSE_BOOL.get({"o": "oui", "n": "non"}.get(ligne["alarme"])),
                annonce_statut={"o": "I", "n": "D"}.get(ligne["annonce"]),
                zone_circuit=ligne["zone"][:20],
                remarque=remarque[:300],
            )
        if inconnus:
            self._avertir(f"Code(s) de dispositif inconnu(s) : {', '.join(sorted(inconnus))} — type laissé vide, code noté en remarque.")

        self._finaliser(rapport, donnees, "alarme", "alarme", f"{len(donnees['dispositifs'])} dispositifs")
        return rapport

    def _rapport_extincteurs(self, batiment, jour, donnees, alarme) -> RapportExtincteur:
        existant = self._deja_present(RapportExtincteur, batiment, jour, "extincteurs")
        if existant is not None:
            return existant
        rapport = RapportExtincteur.objects.create(batiment=batiment, rapport_alarme=alarme, **self._champs_fermeture(jour))
        if donnees["remarques"]:
            rapport.historiser(self.superviseur, f"Remarques du rapport Excel : {donnees['remarques']}"[:300])

        series = {}
        for ordre, ligne in enumerate(donnees["extincteurs"], start=1):
            notes, codes = [], []
            format_ = _format(ligne["poids"])
            if format_ == "autre" and ligne["poids"]:
                notes.append(f"Poids : {ligne['poids']}")
            type_ = _type_extincteur(ligne["type"], ligne["classe"])
            if type_ == "autre" and (ligne["type"] or ligne["classe"]):
                notes.append(f"Type : {ligne['type']} {ligne['classe']}".strip())
            annee = ligne["annee_fabrication"]
            if annee and not re.fullmatch(r"\d{4}", annee):
                self._avertir(f"Extincteur n° {ligne['numero']} : année de fabrication « {annee} » invalide, notée en remarque.")
                notes.append(f"Année de fabrication : {annee}")
                annee = ""
            prochaine_recharge, prochain_hydro = ligne["prochaine_recharge"], ligne["prochain_test_hydro"]
            if X.norm(prochaine_recharge) == "a faire":
                codes.append("RC")
            if X.norm(prochain_hydro) == "a faire":
                codes.append("TH")
            if X.norm(ligne["etiquette"]) == "non":
                codes.append("PIC")
            if X.norm(ligne["support"]) == "non":
                codes.append("SUPM")
            for cle, libelle in (
                ("derniere_inspection", "Dernière inspection"),
                ("derniere_recharge", "Dernière recharge"),
                ("dernier_test_hydro", "Dernier test hydro"),
            ):
                if ligne[cle]:
                    notes.append(f"{libelle} : {ligne[cle]}")
            if ligne["numero_serie"]:
                series.setdefault(ligne["numero_serie"], []).append(ligne["numero"])

            ExtincteurItem.objects.create(
                rapport=rapport,
                ordre=int(ligne["numero"]) if ligne["numero"].isdigit() else ordre,
                emplacement=ligne["lieu"][:200],
                numero_serie=ligne["numero_serie"][:100],
                format=format_,
                type_extincteur=type_,
                date_fabrication=annee,
                prochaine_maintenance=prochaine_recharge if re.fullmatch(r"\d{4}", prochaine_recharge) else "",
                prochain_test_hydrostatique=prochain_hydro if re.fullmatch(r"\d{4}", prochain_hydro) else "",
                non_conformites=codes,
                etat="D" if codes else "C",
                remarque=" · ".join(notes)[:300],
            )
        for serie, numeros in series.items():
            if len(numeros) > 1:
                self._avertir(f"Numéro de série {serie} en double (extincteurs n° {', '.join(numeros)}).")

        self._finaliser(rapport, donnees, "extincteurs", "extincteurs", f"{len(donnees['extincteurs'])} extincteurs")
        return rapport

    def _rapport_eclairage(self, batiment, jour, donnees, extincteurs) -> RapportEclairageUrgence:
        existant = self._deja_present(RapportEclairageUrgence, batiment, jour, "éclairage")
        if existant is not None:
            return existant
        # Un seul rapport éclairage par rapport extincteurs (OneToOne).
        if extincteurs is not None and hasattr(extincteurs, "rapport_eclairage_lie"):
            extincteurs = None
        rapport = RapportEclairageUrgence.objects.create(
            batiment=batiment, rapport_extincteur=extincteurs, **self._champs_fermeture(jour)
        )
        for ordre, ligne in enumerate(donnees["unites"], start=1):
            modele = " ".join(t for t in (ligne["fabricant"], ligne["dispositif"]) if t)
            if ligne["modele_batterie"]:
                modele = f"{modele} — batterie {ligne['modele_batterie']}"
            EclairageUrgenceItem.objects.create(
                rapport=rapport,
                ordre=ordre,
                emplacement=ligne["emplacement"][:200],
                modele=modele[:100],
                voltage=ligne["capacite"][:50],
                etat={"oui": "C", "non": "D"}.get(X.norm(ligne["fonctionnel"]), "NI"),
            )
        self._finaliser(rapport, donnees, "eclairage", "éclairage", f"{len(donnees['unites'])} unités")
        return rapport


def _format(poids: str) -> str:
    """« 10 LBS » → « 10lb », « 6 L » → « 6L » ; « autre » si hors de la liste."""
    m = re.match(r"\s*(\d+(?:[.,]\d+)?)\s*(lbs?|livres?|kg|l)\b", X.norm(poids))
    if not m:
        return "autre" if poids else ""
    nombre = m.group(1).replace(",", ".").rstrip("0").rstrip(".") if "." in m.group(1) or "," in m.group(1) else m.group(1)
    unite = {"kg": "kg", "l": "L"}.get(m.group(2), "lb")
    code = f"{nombre}{unite}"
    return code if code in FORMATS else "autre"


def _type_extincteur(type_: str, classe: str) -> str:
    t, c = X.norm(type_), X.norm(classe).replace(" ", "")
    if not t and not c:
        return ""
    if t.startswith("poudre") or t in ("abc", "bc"):
        return {"abc": "ABC", "bc": "BC"}.get(c or t, "autre")
    if t in ("co2", "co", "gaz carbonique"):
        return "CO2"
    if t.startswith("eau"):
        return "EAU"
    if t.startswith("mousse") or t == "afff":
        return "AFFF"
    if t in ("k", "chimique humide", "produits chimiques humides"):
        return "K"
    if t.startswith("halotron"):
        return "halotron"
    if t.replace(" ", "") == "fe36":
        return "fe36"
    return "autre"
