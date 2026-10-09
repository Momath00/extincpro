"""Dossier du bâtiment — logique des cycles, archives, envois et export.

Règles (voir aussi models_dossier.py) :

- **Cycle** : environ 12 mois à partir de la première inspection d'une
  période. Il s'ouvre tout seul au premier rapport (`rattacher`), ou à la
  main depuis le dossier. Il se ferme à la main, une fois tous ses rapports
  fermés ; fermé, il est verrouillé (rouvrir un rapport, ou le supprimer,
  est refusé tant que le cycle n'a pas été rouvert avec un motif).
- **Archive** : à chaque fermeture d'un rapport (et à chaque émission d'un
  certificat), la copie exacte du document est figée avec son empreinte
  SHA-256. Une nouvelle fermeture crée une nouvelle version ; rien n'est
  jamais écrasé.
- **Envoi** : chaque courriel parti vers le client est enregistré avec son
  texte et la copie des fichiers joints (factures comprises).

Aucune de ces opérations ne doit faire échouer l'action principale (fermer
un rapport, envoyer un courriel) : les erreurs sont journalisées, pas levées.
"""

import csv
import hashlib
import io
import json
import logging
import zipfile
from datetime import date

from django.db import transaction
from django.utils import timezone
from django.utils.html import escape
from rest_framework import status as http_status
from rest_framework.exceptions import APIException, ValidationError

from .models_dossier import (
    ArchiveDocument,
    CycleInspection,
    Envoi,
    EnvoiPieceJointe,
    EvenementCycle,
    FichierArchive,
)

logger = logging.getLogger(__name__)


class CycleVerrouille(APIException):
    status_code = http_status.HTTP_409_CONFLICT
    default_detail = (
        "Ce rapport fait partie d'un cycle d'inspection fermé (verrouillé). "
        "Rouvrez d'abord le cycle depuis le dossier du bâtiment, en indiquant un motif."
    )
    default_code = "cycle_verrouille"

    def __init__(self, detail=None, code=None):
        # Même format que les autres erreurs de l'API ({"error": "…"}), affiché tel quel par l'interface.
        super().__init__({"error": str(detail or self.default_detail)}, code)


# ── Modules ──────────────────────────────────────────────────────────────────

def _modeles():
    from .models import Rapport, RapportCuisine, RapportEclairageUrgence, RapportExtincteur, RapportGicleur

    return {
        "incendie": Rapport,
        "extincteur": RapportExtincteur,
        "eclairage": RapportEclairageUrgence,
        "cuisine": RapportCuisine,
        "gicleur": RapportGicleur,
    }


RELATIONS_CYCLE = {
    "incendie": "rapports_incendie",
    "extincteur": "rapports_extincteurs",
    "eclairage": "rapports_eclairage",
    "cuisine": "rapports_cuisine",
    "gicleur": "rapports_gicleurs",
}

LIBELLES_MODULE = dict(ArchiveDocument.Module.choices)

# Chemin de la page du rapport dans l'application (superviseur / citoyen).
CHEMINS_FRONTEND = {
    "incendie": "rapports",
    "extincteur": "rapports-extincteurs",
    "eclairage": "rapports-eclairage-urgence",
    "cuisine": "rapports-cuisine",
    "gicleur": "rapports-gicleurs",
}


def module_de(rapport) -> str:
    for module, modele in _modeles().items():
        if type(rapport) is modele:
            return module
    raise ValueError(f"Type de rapport inconnu : {type(rapport).__name__}")


def libelle_rapport(rapport) -> str:
    return f"{LIBELLES_MODULE[module_de(rapport)]} — rapport #{rapport.pk}"


def rapports_du_cycle(cycle) -> list[tuple[str, object]]:
    sortie = []
    for module, relation in RELATIONS_CYCLE.items():
        for rapport in getattr(cycle, relation).all().order_by("date_creation"):
            sortie.append((module, rapport))
    return sortie


# ── Journal ──────────────────────────────────────────────────────────────────

def journaliser(cycle, type_evenement: str, description: str, utilisateur=None):
    if cycle is None:
        return
    EvenementCycle.objects.create(
        cycle=cycle,
        type_evenement=type_evenement,
        description=description[:400],
        utilisateur=utilisateur if getattr(utilisateur, "pk", None) else None,
    )


def journal_cycle(cycle) -> list[dict]:
    """Journal complet : événements du cycle + historiques de ses rapports,
    du plus récent au plus ancien."""
    lignes = [
        {
            "date": ev.date_heure,
            "description": ev.description,
            "utilisateur": _nom(ev.utilisateur),
            "source": "cycle",
            "type": ev.type_evenement,
        }
        for ev in cycle.evenements.select_related("utilisateur")
    ]
    for module, rapport in rapports_du_cycle(cycle):
        for h in rapport.historique.select_related("utilisateur"):
            lignes.append({
                "date": h.date_heure,
                "description": h.description,
                "utilisateur": _nom(h.utilisateur),
                "source": module,
                "type": "historique",
                "rapport_id": rapport.pk,
            })
    lignes.sort(key=lambda x: x["date"], reverse=True)
    return lignes


def _nom(utilisateur) -> str:
    if utilisateur is None:
        return "Système"
    return utilisateur.get_full_name() or utilisateur.username


# ── Cycles ───────────────────────────────────────────────────────────────────

def date_reference(rapport) -> date:
    if getattr(rapport, "date_inspection", None):
        return rapport.date_inspection
    if getattr(rapport, "date_creation", None):
        return timezone.localtime(rapport.date_creation).date()
    return timezone.localdate()


def est_brouillon_automatique(rapport) -> bool:
    """Brouillon de la prochaine visite, préparé tout seul à la fermeture du
    rapport extincteurs précédent : il n'appartient à aucun cycle tant
    qu'il n'est pas planifié (sinon il atterrirait dans le cycle en cours)."""
    return (
        bool(getattr(rapport, "rapport_precedent_id", None))
        and rapport.date_inspection is None
        and rapport.statut == "ouvert"
    )


def cycle_pour(batiment, jour: date, utilisateur=None, creer=True):
    """Cycle ouvert dont la période couvre `jour` ; sinon un nouveau cycle
    qui commence ce jour-là."""
    for cycle in batiment.cycles.filter(statut=CycleInspection.Statut.OUVERT, date_debut__lte=jour).order_by("-date_debut"):
        if jour <= cycle.date_fin_prevue:
            return cycle
    if not creer:
        return None
    cycle = CycleInspection.objects.create(batiment=batiment, annee=jour.year, date_debut=jour)
    journaliser(cycle, "ouverture", f"{cycle.libelle} ouvert automatiquement", utilisateur)
    return cycle


def cycle_courant(batiment):
    """Cycle ouvert le plus récent, sinon le dernier cycle (pour rattacher
    un envoi qui ne concerne pas un rapport précis)."""
    return (
        batiment.cycles.filter(statut=CycleInspection.Statut.OUVERT).order_by("-date_debut").first()
        or batiment.cycles.order_by("-date_debut").first()
    )


def rattacher(rapport, utilisateur=None):
    """Range le rapport dans le bon cycle (appelé à chaque enregistrement)."""
    cycle = rapport.cycle if rapport.cycle_id else None
    if cycle is not None:
        if cycle.batiment_id == rapport.batiment_id or cycle.est_ferme:
            return cycle
        # Rapport déplacé vers un autre bâtiment : on le sort de l'ancien cycle.
        cycle = None
    if est_brouillon_automatique(rapport):
        return None
    cycle = cycle_pour(rapport.batiment, date_reference(rapport), utilisateur)
    type(rapport).objects.filter(pk=rapport.pk).update(cycle=cycle)
    rapport.cycle = cycle
    journaliser(cycle, "rapport", f"Rapport ajouté au cycle : {libelle_rapport(rapport)}", utilisateur)
    return cycle


def verifier_cycle_modifiable(rapport):
    if rapport.cycle_id and rapport.cycle.est_ferme:
        raise CycleVerrouille()


def ouvrir_cycle(batiment, utilisateur, jour: date | None = None):
    jour = jour or timezone.localdate()
    existant = cycle_pour(batiment, jour, creer=False)
    if existant is not None:
        raise ValidationError({"error": f"{existant.libelle} est déjà ouvert pour cette période."})
    cycle = CycleInspection.objects.create(batiment=batiment, annee=jour.year, date_debut=jour)
    journaliser(cycle, "ouverture", f"{cycle.libelle} ouvert manuellement", utilisateur)
    return cycle


def rapports_ouverts(cycle) -> list[str]:
    return [libelle_rapport(r) for _m, r in rapports_du_cycle(cycle) if r.statut != "ferme"]


def fermer_cycle(cycle, utilisateur, note: str = ""):
    if cycle.est_ferme:
        raise ValidationError({"error": "Ce cycle est déjà fermé."})
    ouverts = rapports_ouverts(cycle)
    if ouverts:
        raise ValidationError({"error": "Fermez d'abord tous les rapports du cycle : " + ", ".join(ouverts)})
    cycle.statut = CycleInspection.Statut.FERME
    cycle.date_fermeture = timezone.now()
    cycle.ferme_par = utilisateur
    cycle.note_fermeture = note[:300]
    cycle.save()
    journaliser(cycle, "fermeture", f"{cycle.libelle} fermé et verrouillé" + (f" — {note}" if note else ""), utilisateur)
    return cycle


def rouvrir_cycle(cycle, utilisateur, motif: str):
    motif = (motif or "").strip()
    if len(motif) < 5:
        raise ValidationError({"error": "Indiquez le motif de la réouverture (5 caractères minimum) — il est conservé au journal."})
    if not cycle.est_ferme:
        raise ValidationError({"error": "Ce cycle est déjà ouvert."})
    cycle.statut = CycleInspection.Statut.OUVERT
    cycle.date_fermeture = None
    cycle.save()
    journaliser(cycle, "reouverture", f"{cycle.libelle} rouvert — motif : {motif}", utilisateur)
    return cycle


# ── Archives ─────────────────────────────────────────────────────────────────

def _html_rapport(module, rapport) -> str:
    from . import views, views_gicleur

    return {
        "incendie": views._html_rapport_incendie_complet,
        "extincteur": views._html_rapport_extincteur_complet,
        "eclairage": views._html_rapport_eclairage_complet,
        "cuisine": views._html_rapport_cuisine_complet,
        "gicleur": views_gicleur.html_rapport_gicleur_complet,
    }[module](rapport)


def _archiver(batiment, cycle, module, rapport_id, type_document, titre, html, utilisateur, numero=""):
    """Crée une nouvelle version, sauf si le contenu est identique à la
    version courante (même empreinte)."""
    contenu = html.encode("utf-8")
    empreinte = hashlib.sha256(contenu).hexdigest()
    courante = ArchiveDocument.objects.filter(
        module=module, rapport_id=rapport_id, type_document=type_document, remplacee_le__isnull=True,
        batiment=batiment,
    ).select_related("fichier").first()
    if courante is not None and courante.fichier.empreinte == empreinte:
        return courante
    derniere = ArchiveDocument.objects.filter(
        module=module, rapport_id=rapport_id, type_document=type_document, batiment=batiment,
    ).order_by("-version").first()
    version = (derniere.version + 1) if derniere else 1
    maintenant = timezone.now()
    nom = f"{module}-{type_document}-{rapport_id}-v{version}.html"
    fichier = FichierArchive.depuis_octets(nom, contenu, "text/html")
    archive = ArchiveDocument.objects.create(
        batiment=batiment, cycle=cycle, module=module, rapport_id=rapport_id,
        type_document=type_document, titre=titre[:255], numero=numero[:40], version=version,
        fichier=fichier, cree_par=utilisateur if getattr(utilisateur, "pk", None) else None,
        date_creation=maintenant,
    )
    if courante is not None:
        courante.remplacee_le = maintenant
        courante.save(update_fields=["remplacee_le"])
    journaliser(cycle, "archive", f"Copie figée : {titre} (version {version})", utilisateur)
    return archive


def archiver_rapport(module: str, rapport_id: int, utilisateur=None):
    """Fige le rapport fermé (et le certificat des modules qui ont le leur)."""
    try:
        rapport = _modeles()[module].objects.select_related("batiment").get(pk=rapport_id)
        cycle = rattacher(rapport, utilisateur)
        libelle = LIBELLES_MODULE[module]
        _archiver(rapport.batiment, cycle, module, rapport.pk, ArchiveDocument.TypeDocument.RAPPORT,
                  f"Rapport — {libelle}", _html_rapport(module, rapport), utilisateur)

        # Certificats propres au rapport (alarme, gicleurs). Ceux des
        # extincteurs, de l'éclairage et de la cuisine sont figés à leur
        # émission (voir `archiver_certificat_visite`).
        cert = getattr(rapport, "certificat", None)
        if module == "incendie" and cert is not None:
            from .views import _html_certificat_incendie

            _archiver(rapport.batiment, cycle, module, rapport.pk, ArchiveDocument.TypeDocument.CERTIFICAT,
                      f"Certificat {cert.numero} — {libelle}", _html_certificat_incendie(rapport), utilisateur, cert.numero)
        elif module == "gicleur" and cert is not None:
            from .views_gicleur import html_certificat_gicleur

            _archiver(rapport.batiment, cycle, module, rapport.pk, ArchiveDocument.TypeDocument.CERTIFICAT,
                      f"Certificat {cert.numero} — {libelle}", html_certificat_gicleur(rapport), utilisateur, cert.numero)
    except Exception:  # noqa: BLE001 — l'archivage ne doit jamais bloquer la fermeture
        logger.exception("Archivage du rapport %s #%s impossible", module, rapport_id)


def archiver_certificat_visite(cert_id: int, utilisateur=None):
    """Fige un certificat (ou avis) extincteurs / éclairage / cuisine au
    moment de son émission — copie du HTML de la révision émise."""
    from .models import CertificatExtincteur

    try:
        cert = CertificatExtincteur.objects.get(pk=cert_id)
        rapport = cert.rapport_ancre
        if rapport is None or not cert.html_fige:
            return
        module = module_de(rapport)
        cycle = rattacher(rapport, utilisateur)
        avis = cert.type_document == CertificatExtincteur.TypeDocument.AVIS
        type_document = ArchiveDocument.TypeDocument.AVIS if avis else ArchiveDocument.TypeDocument.CERTIFICAT
        nature = "Avis de non-conformité" if avis else "Certificat"
        _archiver(rapport.batiment, cycle, module, rapport.pk, type_document,
                  f"{nature} {cert.numero_affiche}", cert.html_fige, utilisateur, cert.numero_affiche)
    except Exception:  # noqa: BLE001
        logger.exception("Archivage du certificat %s impossible", cert_id)


def apres_fermeture(rapport, utilisateur):
    """Appelé à la fin de chaque `fermer()` : range le rapport dans son cycle
    et fige sa copie une fois la transaction validée."""
    try:
        rattacher(rapport, utilisateur)
    except Exception:  # noqa: BLE001
        logger.exception("Rattachement au cycle impossible")
    module = module_de(rapport)
    rapport_id = rapport.pk
    transaction.on_commit(lambda: archiver_rapport(module, rapport_id, utilisateur))


def apres_emission_certificat(cert, utilisateur):
    cert_id = cert.pk
    transaction.on_commit(lambda: archiver_certificat_visite(cert_id, utilisateur))


# ── Envois ───────────────────────────────────────────────────────────────────

TYPES_PJ_ACCEPTES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".csv": "text/csv",
    ".txt": "text/plain",
}
PJ_MAX_FICHIERS = 5
PJ_MAX_OCTETS = 10 * 1024 * 1024
PJ_MAX_TOTAL = 20 * 1024 * 1024


def lire_pieces_jointes(request) -> list[tuple[str, bytes, str]]:
    """Fichiers ajoutés à un envoi (champ multipart `pieces_jointes`) :
    facture, bon de travail… Valide le nombre, la taille et le type."""
    fichiers = request.FILES.getlist("pieces_jointes") if hasattr(request, "FILES") else []
    if len(fichiers) > PJ_MAX_FICHIERS:
        raise ValidationError({"error": f"{PJ_MAX_FICHIERS} fichiers joints au maximum."})
    sortie, total = [], 0
    for f in fichiers:
        nom = (f.name or "fichier").rsplit("/", 1)[-1].rsplit("\\", 1)[-1][:150]
        ext = ("." + nom.rsplit(".", 1)[-1].lower()) if "." in nom else ""
        if ext not in TYPES_PJ_ACCEPTES:
            raise ValidationError({"error": f"« {nom} » : type de fichier non accepté (PDF, image, Excel, Word, CSV ou texte)."})
        if f.size > PJ_MAX_OCTETS:
            raise ValidationError({"error": f"« {nom} » dépasse 10 Mo."})
        total += f.size
        if total > PJ_MAX_TOTAL:
            raise ValidationError({"error": "Les fichiers joints dépassent 20 Mo au total."})
        sortie.append((nom, f.read(), TYPES_PJ_ACCEPTES[ext]))
    return sortie


def _info_rapport(rapport) -> dict:
    module = module_de(rapport)
    return {"module": module, "id": rapport.pk, "libelle": libelle_rapport(rapport)}


def enregistrer_envoi(
    batiment, type_envoi, destinataire, sujet, corps_html, *,
    mode=Envoi.Mode.DIRECT, utilisateur=None, rapports=(), documents=(), ajouts=(),
    message="", resultat=None, destinataire_nom="", cycle=None,
):
    """Conserve la preuve d'un envoi. `documents` : fichiers générés (rapports,
    certificats) ; `ajouts` : fichiers ajoutés par l'expéditeur (facture…).
    Chaque élément : (nom, octets, type MIME)."""
    try:
        rapports = [r for r in rapports if r is not None]
        for r in rapports if cycle is None else ():
            cycle = rattacher(r, utilisateur) or cycle
            if cycle:
                break
        cycle = cycle or cycle_courant(batiment)
        ok = True if resultat is None else bool(resultat.get("ok"))
        envoi = Envoi.objects.create(
            batiment=batiment, cycle=cycle, type_envoi=type_envoi, mode=mode,
            destinataire=(destinataire or "")[:255], destinataire_nom=(destinataire_nom or "")[:150],
            sujet=(sujet or "")[:300], corps_html=corps_html or "", message=message or "",
            rapports=[_info_rapport(r) for r in rapports],
            statut=Envoi.Statut.ENVOYE if ok else Envoi.Statut.ECHEC,
            reference=((resultat or {}).get("reference") or "")[:120],
            erreur=((resultat or {}).get("erreur") or "")[:300],
            envoye_par=utilisateur if getattr(utilisateur, "pk", None) else None,
        )
        for origine, liste in ((EnvoiPieceJointe.Origine.DOCUMENT, documents), (EnvoiPieceJointe.Origine.AJOUT, ajouts)):
            for nom, contenu, mime in liste:
                EnvoiPieceJointe.objects.create(
                    envoi=envoi, origine=origine, fichier=FichierArchive.depuis_octets(nom, contenu, mime),
                )
        nb = len(documents) + len(ajouts)
        journaliser(
            cycle, "envoi",
            f"{envoi.get_type_envoi_display()} envoyé à {destinataire}"
            + (f" ({nb} fichier{'s' if nb > 1 else ''} joint{'s' if nb > 1 else ''})" if nb else "")
            + ("" if ok else " — ÉCHEC"),
            utilisateur,
        )
        return envoi
    except Exception:  # noqa: BLE001 — la preuve d'envoi ne doit jamais bloquer l'envoi
        logger.exception("Enregistrement de l'envoi impossible")
        return None


# ── Déficiences d'un cycle à l'autre ─────────────────────────────────────────

LIBELLES_VERIF_CUISINE = {
    "appareils_proteges": "Appareils protégés",
    "liens_fusibles_remplaces": "Liens fusibles remplacés",
    "installation_conforme_fabricant": "Installation conforme au fabricant",
    "cable_tension_verifie": "Câble et tension vérifiés",
    "pression_manometre_verifiee": "Pression du manomètre vérifiée",
    "conduits_decharge_verifies": "Conduits de décharge vérifiés",
    "cylindres_supports_inspectes": "Cylindres et supports inspectés",
    "extincteur_portatif_type_k": "Extincteur portatif de type K",
    "station_manuelle_degagee": "Station manuelle dégagée",
    "etiquettes_verification_apposees": "Étiquettes de vérification apposées",
    "buses_protecteurs_nettoyes": "Buses et protecteurs nettoyés",
    "systeme_condition_normale": "Système en condition normale",
    "liens_fusibles_nettoyes": "Liens fusibles nettoyés",
}


def _norm(*morceaux) -> str:
    return "|".join(" ".join(str(m or "").lower().split()) for m in morceaux)


def _deficiences_rapport(module, rapport) -> list[dict]:
    out = []

    def ajout(cle, libelle, localisation, detail):
        out.append({
            "cle": f"{module}|{cle}", "module": module, "libelle": libelle,
            "localisation": localisation or "—", "detail": detail, "rapport_id": rapport.pk,
        })

    if module == "extincteur":
        for it in rapport.extincteurs.all():
            if it.etat == "D" or it.non_conformites or (it.remarque or "").strip():
                details = [c for c in it.non_conformites] + ([it.remarque] if it.remarque else [])
                if it.etat == "D":
                    details.insert(0, "Défectueux")
                ajout(_norm("ext", it.etage, it.emplacement), "Extincteur",
                      " — ".join(x for x in (it.etage, it.emplacement) if x), ", ".join(details))
        for b in rapport.boyaux.all():
            if b.etat == "D" or (b.remarque or "").strip():
                ajout(_norm("boy", b.etage, b.emplacement), "Boyau d'incendie",
                      " — ".join(x for x in (b.etage, b.emplacement) if x),
                      ", ".join(x for x in ("Défectueux" if b.etat == "D" else "", b.remarque) if x))
    elif module == "eclairage":
        for it in rapport.eclairages_urgence.all():
            if it.etat == "D" or (it.remarque or "").strip():
                ajout(_norm(it.etage, it.emplacement), "Éclairage d'urgence",
                      " — ".join(x for x in (it.etage, it.emplacement) if x),
                      ", ".join(x for x in ("Défectueux" if it.etat == "D" else "", it.remarque) if x))
    elif module == "incendie":
        for d in rapport.dispositifs.select_related("section"):
            problemes = []
            if d.annonce_statut == "D":
                problemes.append("Défectueux")
            if d.necessite_entretien:
                problemes.append("Entretien requis")
            if d.installation_correcte is False:
                problemes.append("Installation non conforme")
            if d.alarme_confirmee is False:
                problemes.append("Alarme non confirmée")
            if (d.remarque or "").strip():
                problemes.append(d.remarque)
            if problemes:
                section = d.section.nom if d.section_id else ""
                ajout(_norm(section, d.localisation, d.type_dispositif), d.get_type_dispositif_display() or "Dispositif",
                      " — ".join(x for x in (section, d.localisation) if x), ", ".join(problemes))
    elif module == "cuisine":
        for champ, libelle in LIBELLES_VERIF_CUISINE.items():
            if getattr(rapport, champ, None) is False:
                ajout(_norm(champ), libelle, "Système de cuisine", "Non conforme")
    elif module == "gicleur":
        from .gicleur_checklist import CODES_HORS_CONFORMITE

        for r in rapport.reponses_checklist.filter(reponse="non").exclude(code_item__in=CODES_HORS_CONFORMITE):
            ajout(_norm(r.code_item), r.label, f"Point {r.code_item}", "Réponse « Non »")
        for neg in rapport.reponses_negatives.all():
            if (neg.texte or "").strip():
                ajout(_norm("neg", neg.texte[:80]), "Réponse négative", "Gicleurs", neg.texte)
    return out


def deficiences_cycle(cycle) -> tuple[list[dict], set[str]]:
    """Déficiences du cycle (le plus récent rapport l'emporte pour une même
    clé) + l'ensemble des modules inspectés pendant ce cycle."""
    par_cle, modules = {}, set()
    for module, rapport in rapports_du_cycle(cycle):
        modules.add(module)
        for d in _deficiences_rapport(module, rapport):
            par_cle[d["cle"]] = d
    return list(par_cle.values()), modules


def suivi_deficiences(cycle) -> dict:
    """Compare avec les cycles précédents : nouvelle / récurrente (depuis
    quel cycle) ; et liste ce qui a été corrigé depuis le cycle précédent."""
    actuelles, modules = deficiences_cycle(cycle)
    precedents = list(
        cycle.batiment.cycles.filter(date_debut__lt=cycle.date_debut).order_by("-date_debut")[:5]
    )
    historiques = [(c, {d["cle"]: d for d in deficiences_cycle(c)[0]}) for c in precedents]

    for d in actuelles:
        depuis = None
        for c, cles in historiques:
            if d["cle"] in cles:
                depuis = c
            else:
                break
        d["statut"] = "recurrente" if depuis else "nouvelle"
        d["depuis"] = depuis.libelle if depuis else None

    corrigees = []
    if historiques:
        prec_cycle, prec = historiques[0]
        cles_actuelles = {d["cle"] for d in actuelles}
        for cle, d in prec.items():
            if cle in cles_actuelles:
                continue
            d = dict(d)
            d["statut"] = "corrigee" if d["module"] in modules else "non_reverifiee"
            d["cycle"] = prec_cycle.libelle
            corrigees.append(d)
    return {
        "cycle_precedent": precedents[0].libelle if precedents else None,
        "actuelles": actuelles,
        "corrigees": corrigees,
    }


# ── Export du dossier ────────────────────────────────────────────────────────

def _nom_sur(texte: str) -> str:
    garde = "".join(c if c.isalnum() or c in "-_." else "-" for c in texte)
    return "-".join(p for p in garde.split("-") if p)[:80] or "fichier"


def exporter_cycle(cycle, utilisateur) -> tuple[bytes, str]:
    """ZIP du dossier complet : documents figés, envois (courriel + fichiers
    exacts), journal, déficiences, et un manifeste des empreintes SHA-256."""
    bat = cycle.batiment
    tampon = io.BytesIO()
    manifeste = []

    def ajouter(chemin: str, contenu: bytes, description: str):
        zf.writestr(chemin, contenu)
        manifeste.append({"fichier": chemin, "sha256": hashlib.sha256(contenu).hexdigest(), "octets": len(contenu), "description": description})

    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as zf:
        archives = list(cycle.archives.select_related("fichier").order_by("module", "type_document", "version"))
        for a in archives:
            chemin = f"documents/{a.module}/{_nom_sur(a.titre)}-v{a.version}.html"
            ajouter(chemin, a.fichier.lire(), f"{a.titre} — version {a.version}" + ("" if a.est_courante else " (remplacée)"))

        envois = list(cycle.envois.prefetch_related("pieces_jointes__fichier").order_by("date_envoi"))
        for e in envois:
            dossier = f"envois/{timezone.localtime(e.date_envoi):%Y-%m-%d_%H%M}_{e.pk}"
            if e.corps_html:
                ajouter(f"{dossier}/courriel.html", e.corps_html.encode("utf-8"), f"Courriel à {e.destinataire} — {e.sujet}")
            for pj in e.pieces_jointes.all():
                ajouter(f"{dossier}/{_nom_sur(pj.fichier.nom)}", pj.fichier.lire(), f"Fichier joint ({pj.get_origine_display()})")

        journal = journal_cycle(cycle)
        sortie_csv = io.StringIO()
        w = csv.writer(sortie_csv)
        w.writerow(["date", "utilisateur", "source", "description"])
        for ligne in reversed(journal):
            w.writerow([timezone.localtime(ligne["date"]).strftime("%Y-%m-%d %H:%M"), ligne["utilisateur"], ligne["source"], ligne["description"]])
        ajouter("journal.csv", ("﻿" + sortie_csv.getvalue()).encode("utf-8"), "Journal du cycle")

        suivi = suivi_deficiences(cycle)
        sortie_def = io.StringIO()
        w = csv.writer(sortie_def)
        w.writerow(["statut", "depuis", "module", "equipement", "localisation", "detail"])
        for d in suivi["actuelles"]:
            w.writerow([d["statut"], d.get("depuis") or "", LIBELLES_MODULE.get(d["module"], d["module"]), d["libelle"], d["localisation"], d["detail"]])
        for d in suivi["corrigees"]:
            w.writerow([d["statut"], d.get("cycle") or "", LIBELLES_MODULE.get(d["module"], d["module"]), d["libelle"], d["localisation"], d["detail"]])
        ajouter("deficiences.csv", ("﻿" + sortie_def.getvalue()).encode("utf-8"), "Suivi des déficiences")

        index = _index_html(cycle, archives, envois, journal, suivi)
        ajouter("index.html", index.encode("utf-8"), "Sommaire du dossier")

        entete = {
            "batiment": bat.adresse_complete,
            "client": bat.client.nom,
            "cycle": cycle.libelle,
            "statut": cycle.get_statut_display(),
            "exporte_le": timezone.localtime().isoformat(),
            "exporte_par": _nom(utilisateur),
            "fichiers": manifeste,
        }
        zf.writestr("manifeste.json", json.dumps(entete, ensure_ascii=False, indent=2))

    journaliser(cycle, "export", "Dossier complet exporté (ZIP)", utilisateur)
    nom = f"dossier-{_nom_sur(bat.adresse_complete)}-{_nom_sur(cycle.libelle)}.zip"
    return tampon.getvalue(), nom


def _index_html(cycle, archives, envois, journal, suivi) -> str:
    bat = cycle.batiment
    fmt = lambda d: timezone.localtime(d).strftime("%Y-%m-%d %H:%M") if d else "—"  # noqa: E731
    lignes_docs = "".join(
        f"<tr><td>{escape(a.titre)}</td><td>v{a.version}{'' if a.est_courante else ' (remplacée)'}</td>"
        f"<td>{fmt(a.date_creation)}</td><td><code>{a.fichier.empreinte}</code></td></tr>"
        for a in archives
    ) or "<tr><td colspan=4>Aucun document archivé.</td></tr>"
    lignes_envois = "".join(
        f"<tr><td>{fmt(e.date_envoi)}</td><td>{escape(e.get_type_envoi_display())}</td><td>{escape(e.destinataire)}</td>"
        f"<td>{escape(e.sujet)}</td><td>{e.pieces_jointes.count()}</td><td>{escape(e.get_statut_display())}</td></tr>"
        for e in envois
    ) or "<tr><td colspan=6>Aucun envoi.</td></tr>"
    lignes_def = "".join(
        f"<tr><td>{'Récurrente depuis ' + escape(d['depuis']) if d['statut'] == 'recurrente' else 'Nouvelle'}</td>"
        f"<td>{escape(LIBELLES_MODULE.get(d['module'], d['module']))}</td><td>{escape(d['libelle'])}</td>"
        f"<td>{escape(d['localisation'])}</td><td>{escape(d['detail'])}</td></tr>"
        for d in suivi["actuelles"]
    ) or "<tr><td colspan=5>Aucune déficience.</td></tr>"
    lignes_journal = "".join(
        f"<tr><td>{fmt(j['date'])}</td><td>{escape(j['utilisateur'])}</td><td>{escape(j['description'])}</td></tr>"
        for j in journal
    )
    return f"""<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Dossier — {escape(bat.adresse_complete)} — {escape(cycle.libelle)}</title>
<style>body{{font-family:Arial,sans-serif;color:#0a0b0d;margin:24px;font-size:13px}}h1{{font-size:20px;margin:0}}h2{{font-size:14px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e11324;padding-bottom:4px;margin-top:28px}}
table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #d1d5db;padding:5px 7px;text-align:left;vertical-align:top}}th{{background:#0a0b0d;color:#fff;font-size:11px;text-transform:uppercase}}code{{font-size:10px;word-break:break-all}}.meta{{color:#4b5563}}</style></head><body>
<h1>Dossier du bâtiment — {escape(cycle.libelle)}</h1>
<p class="meta"><strong>{escape(bat.client.nom)}</strong> · {escape(bat.adresse_complete)}<br>
Période : à partir du {cycle.date_debut:%Y-%m-%d} · Statut : {escape(cycle.get_statut_display())}{(' le ' + fmt(cycle.date_fermeture)) if cycle.date_fermeture else ''}<br>
Exporté le {fmt(timezone.now())}. Chaque fichier de ce dossier est listé avec son empreinte SHA-256 dans <code>manifeste.json</code> :
toute modification d'un fichier change son empreinte.</p>
<h2>Documents figés (rapports et certificats)</h2><table><tr><th>Document</th><th>Version</th><th>Figé le</th><th>Empreinte SHA-256</th></tr>{lignes_docs}</table>
<h2>Envois au client</h2><table><tr><th>Date</th><th>Type</th><th>Destinataire</th><th>Objet</th><th>Fichiers</th><th>Statut</th></tr>{lignes_envois}</table>
<h2>Déficiences</h2><table><tr><th>Suivi</th><th>Module</th><th>Équipement</th><th>Localisation</th><th>Détail</th></tr>{lignes_def}</table>
<h2>Journal</h2><table><tr><th>Date</th><th>Par</th><th>Événement</th></tr>{lignes_journal}</table>
</body></html>"""

