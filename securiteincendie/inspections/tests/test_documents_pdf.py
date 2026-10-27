"""Boutons « Rapport »/« Certificat » : HTML par défaut, vrai PDF avec
?fichier=pdf (contournement de l'impression de Safari sur Mac/iPad)."""

from unittest import mock

from organisations.models import Module, OrganisationModule

from .fabrique import BaseTest

FAUX_PDF = b"%PDF-1.7 faux"


@mock.patch("inspections.pdf._html_vers_pdf", return_value=FAUX_PDF)
class DocumentsEnPdfTest(BaseTest):
    def setUp(self):
        super().setUp()
        module, _ = Module.objects.get_or_create(code="rapport_extincteur", defaults={"nom": "Rapport extincteur"})
        OrganisationModule.objects.update_or_create(organisation=self.organisation, module=module, defaults={"actif": True})
        self.rapport = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        self.url = f"/api/rapports-extincteurs/{self.rapport.id}"

    def test_sans_format_le_rapport_reste_en_html(self, html_vers_pdf):
        res = self.api().get(f"{self.url}/telecharger/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res["Content-Type"].startswith("text/html"))
        self.assertIn(b"<html", res.content.lower())
        html_vers_pdf.assert_not_called()

    def test_format_pdf_telecharge_un_fichier_pdf(self, html_vers_pdf):
        res = self.api().get(f"{self.url}/telecharger/?fichier=pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertEqual(res["Content-Disposition"], f'attachment; filename="rapport-extincteurs-{self.rapport.id}.pdf"')
        self.assertEqual(res.content, FAUX_PDF)

    def test_le_pdf_est_genere_depuis_le_meme_html_que_le_navigateur(self, html_vers_pdf):
        html = self.api().get(f"{self.url}/telecharger/").content.decode("utf-8")
        self.api().get(f"{self.url}/telecharger/?fichier=pdf")
        html_vers_pdf.assert_called_once_with(html)

    def test_certificat_en_pdf(self, html_vers_pdf):
        if not hasattr(self.rapport, "certificat"):
            self.skipTest("Pas de certificat généré à la fermeture.")
        res = self.api().get(f"{self.url}/certificat-pdf/?fichier=pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertEqual(res.content, FAUX_PDF)

    def test_les_refus_restent_les_memes_en_pdf(self, html_vers_pdf):
        ouvert = self.rapport_extincteur(items=[{"etat": "C"}])
        res = self.api().get(f"/api/rapports-extincteurs/{ouvert.id}/certificat-pdf/?fichier=pdf")
        self.assertEqual(res.status_code, 400)
        html_vers_pdf.assert_not_called()

    def test_un_autre_format_garde_le_html(self, html_vers_pdf):
        res = self.api().get(f"{self.url}/telecharger/?fichier=xlsx")
        self.assertTrue(res["Content-Type"].startswith("text/html"))
        html_vers_pdf.assert_not_called()

    def test_une_archive_se_telecharge_en_pdf(self, html_vers_pdf):
        from inspections.models_dossier import ArchiveDocument

        archive = ArchiveDocument.objects.filter(module="extincteur", rapport_id=self.rapport.pk).first()
        res = self.api().get(f"/api/archives/{archive.id}/?fichier=pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertEqual(res.content, FAUX_PDF)
