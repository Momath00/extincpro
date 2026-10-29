"""Import de l'historique Excel de Sécurité Incendie National : lecture des
gabarits (alarme S-536, extincteurs NFPA 10, éclairage NFPA 101) et
création des rapports fermés par la commande."""

import tempfile
from datetime import date
from io import StringIO
from pathlib import Path

from django.core import mail
from django.core.management import call_command
from openpyxl import Workbook

from inspections import import_excel_sin as X
from inspections.management.commands.importer_securite_nationale import _format, _type_extincteur
from inspections.models import (
    Batiment,
    CertificatExtincteur,
    Client,
    Rapport,
    RapportEclairageUrgence,
    RapportExtincteur,
    RapportGicleur,
)

from .fabrique import BaseTest


def _classeur(chemin, cellules):
    wb = Workbook()
    ws = wb.active
    for adresse, valeur in cellules.items():
        ws[adresse] = valeur
    wb.save(chemin)


def classeur_alarme(chemin, nom="HUTCHINSON", adresse="3600 BOULEVARD DU TRICENTENAIRE"):
    _classeur(chemin, {
        "A14": "SYSTÈME D'ALARME INCENDIE ULC S-536",
        "B20": "Nom du commerce ou propriétaire :", "H20": nom,
        "B21": "À l'attention de :", "H21": "M. PAULO COSTA",
        "B24": "Téléphone :", "H24": "514-830-7531",
        "B26": "Courriel :", "H26": "PAULO.COSTA@EXEMPLE.TEST",
        "A47": "E1.  RAPPORT ANNUEL DE MISE À L'ESSAI ET D'INSPECTION",
        "A49": "Nom du bâtiment :", "C49": nom, "J49": "DATE :", "M49": "17 SEPTEMBRE 2025",
        "A50": "Adresse : ", "C50": adresse, "C51": "MONTRÉAL, QUÉBEC", "C52": "H1B 5M8",
        "A53": "Fabricant du réseau :", "C53": "MIRCOM", "J53": " MODÈLE :", "M53": "FX-2000",
        "A55": "A", "B55": "Fonctionnement, une étape", "L55": "Oui", "M55": "X", "N55": "Non", "P55": "S.O.",
        "A56": "B", "B56": "Fonctionnement, deux étapes", "L56": "Oui", "N56": "Non", "O56": "X", "P56": "S.O.",
        "A64": "G", "B64": "Commentaires : ", "D64": "VOIR REMARQUE",
        "A74": "M. ZACK DIOTTE",
        "A75": "Nom en lettres moulées du technicien principal ou responsable",
        "A97": "E2.1   À L'ESSAI DU POSTE DE CONTRÔLE OU DU RÉPONDEUR",
        "A101": "Emplacement du poste de contrôle ou du répondeur :", "G101": "ENTRÉE PRINCIPALE",
        "A104": "A", "B104": "Indicateur de mise sous tension", "L104": "Oui", "M104": "X", "N104": "Non", "P104": "S.O.",
        "A110": "G", "B110": "Signal d'alerte", "L110": "Oui", "N110": "Non", "P110": "S.O.", "Q110": "X",
        "A276": "E2.5  MISE À L'ESSAI ET INSPECTION DE L'ALIMENTATION DE SECOURS",
        "A284": "C", "B284": "Tension de batterie", "M284": "27.75", "O284": "VCC",
        "A285": "D", "B285": "Tension et courant", "L285": "T : ", "M285": "26.55", "O285": "VCC",
        "L286": "C :", "M286": "xx", "O286": "MA",
        "A369": "E3.  FICHE DU DISPOSITIF",
        "A415": "TYPE", "B415": "NO DE MODÈLE", "L415": "QUANTITÉ",
        "A416": "M", "B416": "STATION MANUELLE", "L416": "2",
        "A417": "VH", "B417": "AVERTISSEUR SONORE ET VISUEL", "L417": "1",
        "A562": "EMPLACEMENT ", "F562": "DISPOSITIF", "G562": "INSTALLATION CORRECTE",
        "H562": "NÉCESSITE DE L'ENTRETIEN", "J562": "FONCTIONNEMENT DE L'ALARME CONFIRMÉ",
        "K562": "INDICATION DE L'ANNONCE CONFIRMÉ", "M562": "ZONE", "O562": "REMARQUES",
        "A569": "ENTRÉE PRINCIPALE", "F569": "M", "G569": "O", "H569": "N", "J569": "O", "K569": "O",
        "A570": "USINE", "F570": "VH", "G570": "O", "H570": "N", "J570": "O", "K570": "N",
        "A571": "USINE", "F571": "ZZ", "G571": "O", "H571": "N", "J571": "O", "K571": "O",
        "A929": "E2.12  REMARQUES",
    })


def classeur_extincteurs(chemin, adresse="3600 BOULEVARD DU TRICENTENAIRE"):
    entetes = ["NUMÉRO", "DERNIÈRE INSPECTION", "NUMÉRO DE SÉRIE", "POIDS", "TYPE", "CLASSE", "ANNÉE DE FABRICATION",
               "DERNIÈRE RECHARGE", "DERNIER TEST HYDRO", "PROCHAINE RECHARGE", "PROCHAIN TEST HYDRO",
               "ÉTIQUETTE DE VISIBILITÉ", "SUPPORT MURALE ", "LIEU EXTINCTEUR"]
    lignes = [
        ["1", "2024", "179483", "5 LBS", "POUDRE", "ABC", "2001", "2019", "2019", "À FAIRE", "2031", "OUI", "OUI", "PARTIE ADMIN"],
        ["2", "2024", "102911", "10 LBS", "CO2 ", "BC", "2006", "2021", "2021", "2026", "2026", "OUI", "NON", "THERMO #4"],
        ["3", "2024", "824223", "9.5 L", "EAU", "A", "20043", "XX", "XX", "2026", "2026", "OUI", "OUI", "SOUDURE"],
        ["4"],  # ligne numérotée vide du gabarit
    ]
    cellules = {
        "H1": "RAPPORT EXTINCTEURS INCENDIE  NFPA 10",
        "A9": "NOM:", "D9": "HUTCHISON",
        "A10": "ADRESSE DE SERVICE:", "D10": adresse,
        "A13": "INSPECTION FAITE PAR:", "D13": "M. ZACK DIOTTE",
        "A14": "DATE:", "D14": "17 SEPTEMBRE 2025",
        "A96": "REMARQUES :", "A97": "Cabinet #3 bloqué par des boîtes.",
        "A108": "RECOMMANDATIONS :", "A120": "OBLIGATIONS :", "A121": "Dégager l'accès aux extincteurs.",
    }
    colonnes = "ABCDEFGHIJKLMN"
    cellules.update({f"{colonnes[i]}16": t for i, t in enumerate(entetes)})
    for r, ligne in enumerate(lignes, start=17):
        cellules.update({f"{colonnes[i]}{r}": v for i, v in enumerate(ligne)})
    _classeur(chemin, cellules)


def classeur_eclairage(chemin, adresse="3650 BOULEVARD DU TRICENTENAIRE"):
    _classeur(chemin, {
        "F3": "RAPPORT D'INSPECTION - ÉCLAIRAGES D'URGENCE - NFPA 101",
        "A8": "NOM DU BÂTIMENT :", "C8": "HUTCHISON", "G8": "NOM DU TECHNICIEN : M. ZACK DIOTTE",
        "A9": "ADRESSE DE SERVICE :", "C9": adresse, "G9": "DATE DE L’INSPECTION : 17 SEPTEMBRE 2025",
        "G10": "NOMBRE DE DISPOSITIF : 2",
        "A14": "NO", "B14": "EMPLACEMENT", "E14": "FABRICANT", "G14": "DISPOSITIF", "I14": "MODÈLE ",
        "J14": "FONCTIONNEL", "K14": "CAPACITÉ",
        "A15": "1", "B15": "RÉCEPTION", "E15": "EMERGI-LITE", "G15": "ES", "I15": "XX", "J15": "OUI", "K15": "XX",
        "A16": "2", "B16": "PORTE #12", "E16": "LUMACELL", "G16": "ES-TD", "I16": "PEAK", "J16": "NON", "K16": "1x 6V7AH",
        "A17": "3",
        "A106": "LÉGENDE DES DISPOSITIFS",
    })


class LectureUtilitaires(BaseTest):
    def test_dates_francaises(self):
        self.assertEqual(X.lire_date("17 SEPTEMBRE 2025"), date(2025, 9, 17))
        self.assertEqual(X.lire_date("DATE DE L’INSPECTION : 1ER AOÛT 2024"), date(2024, 8, 1))
        self.assertIsNone(X.lire_date("à venir"))

    def test_adresse_et_civilite(self):
        self.assertEqual(X.separer_adresse("3600 BOULEVARD DU TRICENTENAIRE"), ("3600", "BOULEVARD DU TRICENTENAIRE"))
        self.assertEqual(X.nom_personne("M. ZACK DIOTTE"), "ZACK DIOTTE")

    def test_format_et_type_extincteur(self):
        self.assertEqual(_format("10 LBS "), "10lb")
        self.assertEqual(_format("2.5 LBS"), "2.5lb")
        self.assertEqual(_format("9.5 L"), "autre")
        self.assertEqual(_type_extincteur("POUDRE", "ABC"), "ABC")
        self.assertEqual(_type_extincteur("CO", "BC"), "CO2")
        self.assertEqual(_type_extincteur("EAU", "A"), "EAU")


class ImportCommande(BaseTest):
    def setUp(self):
        super().setUp()
        self.technicien.first_name, self.technicien.last_name = "Zack", "Diotte"
        self.technicien.save()
        self.dossier = Path(tempfile.mkdtemp())
        visite = self.dossier / "hutchinson"
        visite.mkdir()
        classeur_alarme(visite / "ALARME S-536.xlsx")
        classeur_extincteurs(visite / "EXTINCTEURS NFPA 10.xlsx")
        classeur_eclairage(visite / "ÉCLAIRAGE NFPA 101.xlsx")

    def importer(self, *options):
        sortie = StringIO()
        call_command("importer_securite_nationale", str(self.dossier), "--organisation", self.organisation.slug, *options, stdout=sortie)
        return sortie.getvalue()

    def test_simulation_n_enregistre_rien(self):
        sortie = self.importer("--dry-run")
        self.assertIn("rien n'a été enregistré", sortie)
        self.assertFalse(Rapport.objects.exists())
        self.assertFalse(Client.objects.filter(nom="HUTCHINSON").exists())

    def test_import_cree_les_trois_rapports_fermes_et_lies(self):
        with self.captureOnCommitCallbacks(execute=True):
            sortie = self.importer()

        batiment = Batiment.objects.get(client__organisation=self.organisation, numero_civique="3600")
        self.assertEqual((batiment.client.nom, batiment.ville, batiment.code_postal), ("HUTCHINSON", "MONTRÉAL", "H1B 5M8"))
        self.assertEqual(batiment.client.contact_nom, "PAULO COSTA")
        # Les écarts entre classeurs sont signalés, pas corrigés en silence.
        self.assertIn("3650 BOULEVARD", sortie)
        self.assertIn("HUTCHISON", sortie)

        alarme = Rapport.objects.get(batiment=batiment)
        self.assertEqual((alarme.statut, alarme.date_inspection), ("ferme", date(2025, 9, 17)))
        self.assertEqual(alarme.prochaine_inspection, date(2026, 9, 17))
        self.assertEqual(list(alarme.techniciens.all()), [self.technicien])
        self.assertTrue(alarme.fiche_e1.fonctionnement_une_etape)
        self.assertFalse(alarme.fiche_e1.fonctionnement_deux_etapes)
        self.assertEqual(alarme.fiche_e1.commentaires, "VOIR REMARQUE")
        self.assertEqual(alarme.fiche_e1.signataire, self.technicien)
        e2 = alarme.fiche_e2.details
        self.assertEqual(e2["e2_1"], {"localisation": "ENTRÉE PRINCIPALE", "A": "oui", "G": "sans_objet"})
        self.assertEqual(e2["e2_5"], {"C": "27.75 VCC", "D": "T : 26.55 VCC"})
        self.assertEqual(alarme.fiche_legende.dispositifs["VH"]["type"], "AVERTISSEUR SONORE ET VISUEL (quantité : 1)")
        dispositifs = list(alarme.dispositifs.order_by("id"))
        self.assertEqual([d.type_dispositif for d in dispositifs], ["M", "VH", None])
        self.assertEqual([d.annonce_statut for d in dispositifs], ["I", "D", "I"])
        self.assertIn("code Excel : ZZ", dispositifs[2].remarque)
        self.assertTrue(all(d.section_id for d in dispositifs))

        ext = RapportExtincteur.objects.get(batiment=batiment)
        self.assertEqual((ext.statut, ext.rapport_alarme), ("ferme", alarme))
        items = list(ext.extincteurs.order_by("ordre"))
        self.assertEqual(len(items), 3)
        self.assertEqual((items[0].format, items[0].type_extincteur, items[0].etat), ("5lb", "ABC", "D"))
        self.assertEqual((items[0].non_conformites, items[0].prochaine_maintenance), (["RC"], ""))
        self.assertEqual((items[1].type_extincteur, items[1].non_conformites), ("CO2", ["SUPM"]))
        self.assertEqual((items[2].format, items[2].date_fabrication, items[2].etat), ("autre", "", "C"))
        self.assertIn("Année de fabrication : 20043", items[2].remarque)
        self.assertEqual(
            (items[0].derniere_inspection, items[0].derniere_recharge, items[0].dernier_test_hydrostatique),
            ("2024", "2019", "2019"),
        )
        self.assertEqual((items[2].derniere_recharge, items[2].dernier_test_hydrostatique), ("", ""))
        self.assertEqual(
            (ext.remarques, ext.recommandations, ext.obligations),
            ("Cabinet #3 bloqué par des boîtes.", "", "Dégager l'accès aux extincteurs."),
        )

        eclairage = RapportEclairageUrgence.objects.get(batiment=batiment)
        self.assertEqual(eclairage.rapport_extincteur, ext)
        unites = list(eclairage.eclairages_urgence.order_by("ordre"))
        self.assertEqual([(u.fabricant, u.dispositif, u.modele, u.voltage, u.etat) for u in unites], [
            ("EMERGI-LITE", "ES", "", "", "C"),
            ("LUMACELL", "ES-TD", "PEAK", "1x 6V7AH", "D"),
        ])

        # Historique : ni certificat, ni courriel, ni brouillon de visite suivante.
        self.assertFalse(CertificatExtincteur.objects.exists())
        self.assertFalse(hasattr(alarme, "certificat"))
        self.assertEqual(RapportExtincteur.objects.filter(batiment=batiment).count(), 1)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIsNotNone(Rapport.objects.get(pk=alarme.pk).cycle_id)

    def test_relancer_ne_cree_pas_de_doublon(self):
        self.importer()
        sortie = self.importer()
        self.assertIn("3 déjà présent(s)", sortie)
        self.assertEqual(Rapport.objects.count(), 1)
        self.assertEqual(RapportExtincteur.objects.count(), 1)
        self.assertEqual(RapportEclairageUrgence.objects.count(), 1)
        self.assertEqual(Client.objects.filter(organisation=self.organisation, nom="HUTCHINSON").count(), 1)

    def test_batiment_existant_reutilise_avec_son_client(self):
        client = Client.objects.create(organisation=self.organisation, nom="Hutchinson Canada")
        existant = Batiment.objects.create(client=client, numero_civique="3600", rue="Boulevard du Tricentenaire", ville="Montréal")
        self.importer()
        self.assertEqual(Rapport.objects.get().batiment, existant)
        self.assertFalse(Client.objects.filter(nom="HUTCHINSON").exists())


def classeur_gicleurs(chemin):
    from datetime import datetime, time

    _classeur(chemin, {
        "A10": "Le système a été inspecté selon la norme NFPA 25",
        "A12": "Nom du bâtiment ", "C12": "SDC 1399 VICTOR HUGO",
        "A13": "Adresse", "C13": "1399 VICTOR HUGO, MONTRÉAL",
        "A14": "Nom du contact ", "C14": "M. DOMINIQUE MONET",
        "A15": "Numéro de téléphone", "C15": "514-927-7425",
        "A16": "Nom du technicien", "C16": "M. ZACK DIOTTE",
        "A17": "Date de l’inspection ", "C17": datetime(2025, 10, 14),
        "A18": "Type d'inspection ", "C18": "Annuelle", "D18": "X", "E18": "Semi-annuelle", "G18": "Trimestrielle",
        "A20": "Suite à l'inspection, le système est fonctionnel : ", "C20": "OUI",
        "A21": "Le système présente des déficiences :", "C21": "OUI",
        "A40": "Sous eau :", "B40": 1,
        "A41": "Sous air :",
        "A48": "Papillon :", "C48": "OS&Y :", "D48": 1, "E48": "PIV :",
        "F52": "Oui", "G52": "Non", "H52": "N/A",
        "A54": "Les vannes sont toutes dans leur position normale (ouverte ou fermée).", "F54": "X",
        "A55": "Scellés :      X                Barrées :                        Supervisées : X",
        "A56": "Les vannes sont exemptes de dommages ou de fuites.", "G56": "X",
        "F64": "Oui", "G64": "Non", "H64": "N/A",
        "A65": "Les gicleurs semblent exempts de peinture, corrosion, dommage physique.", "F65": "X",
        "A78": "Les accouplements pivotants fonctionne correctement.", "F78": "X",
        "A79": "Les bouchons/capuchons sont en place.", "G79": "X",
        "A85": "Système de gicleurs sous eau :",
        "A87": "# du système :", "B87": 1,
        "A89": "Marque :", "B89": "ASTRA",
        "A93": "Diamètre :", "B93": "4 POUCES",
        "A99": "Essais ", "F99": "Oui", "G99": "Non", "H99": "N/A",
        "A100": "Pression du système avant les essais (lb/po²)", "E100": 77,
        "A101": "La cloche hydraulique est fonctionnelle.", "G101": "X",
        "A102": "Interrupteur d'alarme ", "E102": "Interrupteur de débit", "G102": "X",
        "A103": "La cloche électrique (120 volts) est fonctionnelle. ", "H103": "X",
        "A106": "Pompe de surpression",
        "A108": "Oui : X", "B108": "Non : ", "D108": "Manuelle : ", "F108": "Automatique : X",
        "A109": "Pression de départ (lb/po²)", "C109": 77, "E109": "Pression d'arrêt (lb/po²)", "G109": 166,
        "A110": "Délai afin de rétablir la pression normale du système (minutes/secondes)", "G110": time(0, 30),
        "A112": "Pompe incendie ",
        "A114": "Oui : ", "B114": "Non : X",
        "A115": "Pression de départ (lb/po²)", "E115": "Pression d'arrêt (lb/po²)",
        "A129": "Vérification de l'alimentation d'eau/Essai du drain :",
        "A131": "Ville :", "B131": "MONTRÉAL",
        "A133": "Pression statique (lb/po²) :", "B133": 77,
        "A134": "Pompe incendie :", "B134": "NON",
        "A154": "Liste des supervisions :",
        "A156": "Emplacement", "C156": "Type de valves", "E156": "Diamètre", "G156": "Bon fonctionnement",
        "A157": "GARAGE", "C157": "OS&Y", "E157": "4 PO", "G157": "OUI",
        "A172": "REMARQUES :",
        "A173": "BOUCHON MANQUANT AU RACCORD POMPIER.",
        "A185": "RECOMMANDATIONS :",
        "A198": "OBLIGATIONS :",
    })


class ImportGicleurs(BaseTest):
    def setUp(self):
        super().setUp()
        self.dossier = Path(tempfile.mkdtemp())
        classeur_gicleurs(self.dossier / "GICLEURS NFPA 25.xlsx")

    def test_lecture_du_gabarit(self):
        d = X.lire_fichier(self.dossier / "GICLEURS NFPA 25.xlsx")
        self.assertEqual((d["type"], d["date"], d["frequence"]), (X.GICLEURS, date(2025, 10, 14), "Annuelle"))
        self.assertEqual(d["vannes"], {"os&y": "1"})
        self.assertEqual(d["valeurs"]["etat_vannes"], ["scelles", "supervisees"])
        self.assertEqual(d["valeurs"]["interrupteur"], "Interrupteur de débit")
        # La ligne « Interrupteur d'alarme … X » est un choix, pas une question.
        self.assertNotIn("Interrupteur d'alarme", [q["libelle"] for q in d["questions"]])
        self.assertEqual(d["pompe_surpression"]["delai"], {"min": "0", "sec": "30"})
        self.assertEqual((d["pompe_surpression"]["presente"], d["pompe_surpression"]["mode"]), ("oui", "automatique"))
        self.assertEqual(d["pompe_incendie"]["presente"], "non")
        self.assertEqual(d["textes"]["remarques"], "BOUCHON MANQUANT AU RACCORD POMPIER.")

    def test_import_cree_le_rapport_gicleur(self):
        sortie = StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command("importer_securite_nationale", str(self.dossier), "--organisation", self.organisation.slug, stdout=sortie)
        rapport = RapportGicleur.objects.get()
        self.assertEqual((rapport.statut, rapport.date_inspection, rapport.frequence_inspection), ("ferme", date(2025, 10, 14), "annuelle"))
        self.assertFalse(hasattr(rapport, "certificat"))
        ident = rapport.identification
        self.assertEqual(ident["reponses"]["id_raccord_capuchons"], "non")  # « Non » l'emporte sur « Oui »
        self.assertEqual(ident["reponses"]["id_vannes_position"], "oui")
        self.assertEqual(ident["remarques"]["id_verification"], "BOUCHON MANQUANT AU RACCORD POMPIER.")
        self.assertFalse(rapport.est_conforme)
        self.assertEqual(rapport.debits_valves["lignes"], [{"emplacement": "GARAGE", "type": "OS&Y", "modele": "4 PO", "signal": "oui"}])
        sr = rapport.sous_rapports.get()
        self.assertEqual((sr.type_fiche, sr.numero_systeme), ("eau", "1"))
        r = sr.reponses
        self.assertEqual((r["marque"], r["diametre"], r["vanne_principale"], r["pression_systeme"]), ("ASTRA", "4", "osy", "77"))
        self.assertEqual((r["cloche_hydraulique"], r["cloche_electrique"], r["gicleurs_exempts"]), ("non", "na", "oui"))
        self.assertEqual((r["pompe_presente"], r["pompe_mode"], r["pompe_pression_arret"]), ("oui", "automatique", "166"))
        self.assertEqual(r["alimentation_eau"], ["ville"])
        self.assertIn("Les vannes sont exemptes de dommages ou de fuites : Non", r["notes"])
        self.assertIn("Interrupteur d'alarme : Interrupteur de débit", r["notes"])
        self.assertIn("délai saisi « 00:30 »", sortie.getvalue())
