"""Documents figés (versions, empreinte), suivi des déficiences et export."""

import hashlib
import io
import json
import zipfile
from datetime import date

from inspections import dossier as D
from inspections.models_dossier import ArchiveDocument, FichierArchive

from .fabrique import BaseTest


class FichierArchiveTest(BaseTest):
    def test_l_empreinte_est_celle_du_contenu_d_origine(self):
        contenu = "<html>Rapport</html>".encode("utf-8")
        f = FichierArchive.depuis_octets("rapport.html", contenu, "text/html")
        self.assertEqual(f.empreinte, hashlib.sha256(contenu).hexdigest())
        self.assertEqual(f.taille, len(contenu))

    def test_le_texte_est_compresse_et_relu_a_l_identique(self):
        contenu = ("<p>ligne</p>" * 500).encode("utf-8")
        f = FichierArchive.depuis_octets("r.html", contenu, "text/html")
        self.assertTrue(f.compresse)
        self.assertLess(len(bytes(f.contenu)), len(contenu))
        self.assertEqual(f.lire(), contenu)

    def test_un_pdf_n_est_pas_compresse(self):
        f = FichierArchive.depuis_octets("f.pdf", b"%PDF-1.4 x", "application/pdf")
        self.assertFalse(f.compresse)
        self.assertEqual(f.lire(), b"%PDF-1.4 x")


class ArchivageALaFermeture(BaseTest):
    def archives_rapport(self, rapport):
        return ArchiveDocument.objects.filter(
            module="extincteur", rapport_id=rapport.pk, type_document="rapport",
        ).order_by("version")

    def test_fermer_un_rapport_fige_une_copie_v1(self):
        r = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        archives = list(self.archives_rapport(r))
        self.assertEqual(len(archives), 1)
        self.assertEqual(archives[0].version, 1)
        self.assertTrue(archives[0].est_courante)
        self.assertEqual(archives[0].cycle_id, r.cycle_id)
        self.assertIn(b"<html", archives[0].fichier.lire().lower())

    def test_rouvrir_modifier_et_refermer_cree_une_v2_sans_effacer_la_v1(self):
        r = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        r.rouvrir(self.superviseur)
        item = r.extincteurs.first()
        item.remarque = "Goupille manquante"
        item.save()
        r.refresh_from_db()
        self.fermer(r)

        v1, v2 = list(self.archives_rapport(r))
        self.assertEqual((v1.version, v2.version), (1, 2))
        self.assertIsNotNone(v1.remplacee_le)
        self.assertTrue(v2.est_courante)
        self.assertNotEqual(v1.fichier.empreinte, v2.fichier.empreinte)
        self.assertIn("Goupille manquante", v2.fichier.lire().decode("utf-8"))

    def test_refermer_sans_changement_ne_cree_pas_de_nouvelle_version(self):
        r = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        r.rouvrir(self.superviseur)
        r.refresh_from_db()
        self.fermer(r)
        self.assertEqual(self.archives_rapport(r).count(), 1)

    def test_l_archive_survit_a_la_suppression_du_rapport(self):
        r = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        pk = r.pk
        r.delete()  # cycle encore ouvert : suppression permise
        self.assertTrue(ArchiveDocument.objects.filter(module="extincteur", rapport_id=pk).exists())

    def test_un_batiment_avec_un_dossier_ne_peut_pas_etre_supprime(self):
        self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        res = self.api().delete(f"/api/batiments/{self.batiment.id}/")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(type(self.batiment).objects.filter(pk=self.batiment.pk).exists())


class SuiviDesDeficiences(BaseTest):
    """Chaufferie : défectueuse 3 ans de suite (récurrente). Corridor : corrigé la 2e année."""

    def setUp(self):
        super().setUp()
        defaut = {"etat": "D", "non_conformites": ["TH"], "remarque": "Test hydro échu"}
        self.annees = {}
        for annee, chaufferie, corridor in (
            (2024, defaut, {"etat": "D", "remarque": "Support arraché"}),
            (2025, defaut, {"etat": "C"}),
            (2026, defaut, {"etat": "C"}),
        ):
            r = self.rapport_extincteur(jour=date(annee, 3, 15), items=[
                {"etage": "Sous-sol", "emplacement": "Chaufferie", **chaufferie},
                {"etage": "2", "emplacement": "Corridor est", **corridor},
            ])
            self.annees[annee] = r.cycle

    def test_premier_cycle_tout_est_nouveau(self):
        suivi = D.suivi_deficiences(self.annees[2024])
        self.assertIsNone(suivi["cycle_precedent"])
        self.assertEqual({d["statut"] for d in suivi["actuelles"]}, {"nouvelle"})
        self.assertEqual(len(suivi["actuelles"]), 2)

    def test_deficience_toujours_presente_est_recurrente_depuis_le_premier_cycle(self):
        suivi = D.suivi_deficiences(self.annees[2026])
        chaufferie = next(d for d in suivi["actuelles"] if "Chaufferie" in d["localisation"])
        self.assertEqual(chaufferie["statut"], "recurrente")
        self.assertEqual(chaufferie["depuis"], self.annees[2024].libelle)

    def test_deficience_disparue_est_marquee_corrigee(self):
        suivi = D.suivi_deficiences(self.annees[2025])
        corrigees = [d for d in suivi["corrigees"] if "Corridor" in d["localisation"]]
        self.assertEqual(len(corrigees), 1)
        self.assertEqual(corrigees[0]["statut"], "corrigee")

    def test_module_non_reinspecte_n_est_pas_declare_corrige(self):
        # Un cycle sans rapport extincteurs ne peut pas prouver la correction.
        cycle_vide = D.ouvrir_cycle(self.batiment, self.superviseur, date(2028, 1, 1))
        suivi = D.suivi_deficiences(cycle_vide)
        self.assertTrue(suivi["corrigees"])
        self.assertEqual({d["statut"] for d in suivi["corrigees"]}, {"non_reverifiee"})


class ExportDuDossier(BaseTest):
    def test_le_zip_contient_les_documents_et_un_manifeste_d_empreintes_exactes(self):
        r = self.fermer(self.rapport_extincteur(items=[{"etat": "D", "remarque": "Défaut"}]))
        contenu, nom = D.exporter_cycle(r.cycle, self.superviseur)
        self.assertTrue(nom.endswith(".zip"))

        zf = zipfile.ZipFile(io.BytesIO(contenu))
        noms = zf.namelist()
        for attendu in ("index.html", "journal.csv", "deficiences.csv", "manifeste.json"):
            self.assertIn(attendu, noms)
        self.assertTrue(any(n.startswith("documents/") for n in noms))

        manifeste = json.loads(zf.read("manifeste.json"))
        for entree in manifeste["fichiers"]:
            self.assertEqual(hashlib.sha256(zf.read(entree["fichier"])).hexdigest(), entree["sha256"])

    def test_l_export_est_inscrit_au_journal(self):
        r = self.fermer(self.rapport_extincteur())
        D.exporter_cycle(r.cycle, self.superviseur)
        self.assertTrue(r.cycle.evenements.filter(type_evenement="export").exists())
