"""Envois au client depuis le dossier : fichiers joints, destinataires,
preuve conservée. Aucun courriel réel : l'envoi est simulé."""

from types import SimpleNamespace
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from inspections import dossier as D
from inspections import emailing
from inspections.models_dossier import Envoi

from .fabrique import BaseTest

ENVOI_OK = {"ok": True, "reference": "simulation", "erreur": ""}
ENVOI_ECHEC = {"ok": False, "reference": "", "erreur": "Serveur de courriel indisponible"}


def pdf(nom="facture.pdf", taille=20):
    return SimpleUploadedFile(nom, b"%PDF-1.4" + b"0" * taille, content_type="application/pdf")


def requete(fichiers):
    """Requête minimale pour lire_pieces_jointes."""
    return SimpleNamespace(FILES=SimpleNamespace(getlist=lambda _champ: fichiers))


class PiecesJointes(BaseTest):
    def test_un_pdf_est_accepte(self):
        pj = D.lire_pieces_jointes(requete([pdf("facture-001.pdf")]))
        self.assertEqual(pj[0][0], "facture-001.pdf")
        self.assertEqual(pj[0][2], "application/pdf")

    def test_un_executable_est_refuse(self):
        with self.assertRaises(ValidationError):
            D.lire_pieces_jointes(requete([SimpleUploadedFile("virus.exe", b"MZ")]))

    def test_un_fichier_de_plus_de_10_mo_est_refuse(self):
        with self.assertRaises(ValidationError):
            D.lire_pieces_jointes(requete([pdf(taille=10 * 1024 * 1024 + 1)]))

    def test_plus_de_5_fichiers_est_refuse(self):
        with self.assertRaises(ValidationError):
            D.lire_pieces_jointes(requete([pdf(f"f{i}.pdf") for i in range(6)]))


@mock.patch("inspections.pdf._html_vers_pdf", return_value=b"%PDF-1.4 simulation")
class EnvoiDepuisLeDossier(BaseTest):
    def setUp(self):
        super().setUp()
        self.rapport = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        self.cycle = self.rapport.cycle
        self.url = f"/api/cycles/{self.cycle.id}/envoyer/"

    def envoyer(self, donnees, resultat=ENVOI_OK):
        with mock.patch.object(emailing, "envoyer_email", return_value=resultat) as envoi:
            res = self.api().post(self.url, donnees, format="multipart")
        return res, envoi

    def test_tous_les_rapports_et_la_facture_partent_en_un_seul_courriel(self, _pdf):
        archives = [a.id for a in self.cycle.archives.filter(remplacee_le__isnull=True)]
        res, envoi = self.envoyer({
            "destinataires": ["client@exemple.test"], "message": "Voici la facture.",
            "archives": archives, "pieces_jointes": [pdf("facture-2026.pdf")],
        })
        self.assertEqual(res.status_code, 200, res.data)
        envoi.assert_called_once()
        pieces = envoi.call_args.kwargs["attachments"]
        self.assertEqual(len(pieces), len(archives) + 1)
        self.assertIn("facture-2026.pdf", [nom for nom, _c, _m in pieces])

    def test_la_preuve_d_envoi_conserve_la_facture_et_le_message(self, _pdf):
        self.envoyer({"destinataires": ["client@exemple.test"], "message": "Merci",
                      "pieces_jointes": [pdf("facture-2026.pdf")]})
        e = Envoi.objects.get(batiment=self.batiment, type_envoi=Envoi.Type.MANUEL)
        self.assertEqual(e.cycle_id, self.cycle.id)
        self.assertEqual(e.statut, Envoi.Statut.ENVOYE)
        self.assertEqual(e.message, "Merci")
        ajout = e.pieces_jointes.get(origine="ajout")
        self.assertEqual(ajout.fichier.nom, "facture-2026.pdf")
        self.assertTrue(ajout.fichier.lire().startswith(b"%PDF"))

    def test_plusieurs_destinataires_dans_un_meme_courriel(self, _pdf):
        res, envoi = self.envoyer({
            "destinataires": ["a@exemple.test", "b@exemple.test", "A@exemple.test"], "message": "x",
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(envoi.call_args.args[0], ["a@exemple.test", "b@exemple.test"])  # doublon retiré
        self.assertEqual(Envoi.objects.get(type_envoi="manuel").destinataire, "a@exemple.test, b@exemple.test")

    def test_adresse_invalide_refusee(self, _pdf):
        res, envoi = self.envoyer({"destinataires": ["pas-une-adresse"], "message": "x"})
        self.assertEqual(res.status_code, 400)
        envoi.assert_not_called()

    def test_plus_de_5_destinataires_refuse(self, _pdf):
        res, envoi = self.envoyer({"destinataires": [f"x{i}@exemple.test" for i in range(6)], "message": "x"})
        self.assertEqual(res.status_code, 400)
        envoi.assert_not_called()

    def test_un_envoi_rate_est_quand_meme_conserve(self, _pdf):
        res, _ = self.envoyer({"destinataires": ["client@exemple.test"], "message": "x"}, ENVOI_ECHEC)
        self.assertEqual(res.status_code, 502)
        e = Envoi.objects.get(type_envoi="manuel")
        self.assertEqual(e.statut, Envoi.Statut.ECHEC)
        self.assertIn("indisponible", e.erreur)

    def test_l_envoi_est_inscrit_au_journal_du_cycle_et_du_rapport(self, _pdf):
        self.envoyer({"destinataires": ["client@exemple.test"], "message": "x",
                      "archives": [a.id for a in self.cycle.archives.all()]})
        self.assertTrue(self.cycle.evenements.filter(type_evenement="envoi").exists())
        self.assertTrue(self.rapport.historique.filter(description__startswith="Rapports envoyés au client").exists())


class FonctionEnvoyerEmail(BaseTest):
    """La vraie fonction d'envoi, sans simulation : en test, elle passe par la
    boîte aux lettres en mémoire de Django (rien ne quitte la machine)."""

    def test_envoi_a_plusieurs_destinataires_avec_piece_jointe(self):
        from django.core import mail

        from securiteincendie.emailing import envoyer_email

        resultat = envoyer_email(
            ["a@exemple.test", "b@exemple.test"], "Sujet", "<p>Bonjour</p>",
            attachments=[("facture.pdf", b"%PDF-1.4", "application/pdf")],
        )
        self.assertTrue(resultat["ok"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["a@exemple.test", "b@exemple.test"])
        self.assertEqual(mail.outbox[0].attachments[0][0], "facture.pdf")

    def test_un_seul_destinataire_reste_accepte(self):
        from django.core import mail

        from securiteincendie.emailing import envoyer_email

        self.assertTrue(envoyer_email("a@exemple.test", "Sujet", "<p>x</p>")["ok"])
        self.assertEqual(mail.outbox[0].to, ["a@exemple.test"])
