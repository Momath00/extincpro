"""Formulaire « Réserver une démo » du site vitrine (l'essai gratuit est retiré)."""

from unittest import mock

from rest_framework.test import APIClient

from organisations.models import DemandeEssai

from .fabrique import BaseTest


@mock.patch("api.views._envoyer_email")
class DemandesDeDemo(BaseTest):
    def envoyer(self, **extra):
        return APIClient().post("/api/contact/", {
            "prenom": "Jean", "nom": "Tremblay", "email": "jean@inspections-abc.ca",
            "message": "Nous aimerions voir la plateforme.", **extra,
        }, format="json")

    def test_les_champs_de_verification_sont_enregistres(self, _courriel):
        res = self.envoyer(entreprise="Inspections ABC", neq="1171234567", site_web="inspections-abc.ca", nb_techniciens=4)
        self.assertEqual(res.status_code, 200, res.data)
        d = DemandeEssai.objects.get()
        self.assertEqual((d.neq, d.site_web, d.nb_techniciens), ("1171234567", "inspections-abc.ca", 4))
        self.assertFalse(d.courriel_gratuit)

    def test_les_champs_restent_facultatifs(self, _courriel):
        self.assertEqual(self.envoyer().status_code, 200)
        self.assertIsNone(DemandeEssai.objects.get().nb_techniciens)

    def test_un_courriel_personnel_est_signale(self, _courriel):
        self.envoyer(email="quelquun@Gmail.com")
        d = DemandeEssai.objects.get()
        self.assertTrue(d.courriel_gratuit)
        res = self.api(self.utilisateur("super_admin", organisation=None)).get("/api/demandes-essai/")
        self.assertTrue(res.data[0]["courriel_gratuit"])
