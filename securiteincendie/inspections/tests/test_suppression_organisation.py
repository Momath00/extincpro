"""Suppression d'une organisation entière par le super admin."""

from datetime import date

from accounts.models import Utilisateur
from inspections.models import Batiment, Client, RapportExtincteur, Tournee
from inspections.models_dossier import ArchiveDocument, FichierArchive
from organisations.models import Organisation

from .fabrique import BaseTest


class SuppressionOrganisation(BaseTest):
    def setUp(self):
        super().setUp()
        self.super_admin = Utilisateur.objects.create_user(
            username="superadmin", password="motdepasse-test", role="super_admin",
        )
        # Rapport fermé (cycle verrouillé + archives) et une tournée : tout
        # ce qui protège les utilisateurs ou les bâtiments contre la cascade.
        self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        self.rapport_extincteur(jour=date(2026, 4, 1))
        tournee = Tournee.objects.create(
            organisation=self.organisation, date_tournee=date(2026, 5, 1), cree_par=self.superviseur,
        )
        tournee.ajouter_batiment(self.batiment, techniciens=[self.technicien])
        self.url = f"/api/organisations/{self.organisation.id}/"

    def test_supprime_l_organisation_et_toutes_ses_donnees(self):
        self.assertTrue(ArchiveDocument.objects.filter(batiment=self.batiment).exists())
        res = self.api(self.super_admin).delete(self.url, {"confirmation": self.organisation.nom}, format="json")
        self.assertEqual(res.status_code, 204, getattr(res, "data", None))

        self.assertFalse(Organisation.objects.filter(pk=self.organisation.pk).exists())
        self.assertFalse(Utilisateur.objects.filter(organisation_id=self.organisation.pk).exists())
        self.assertFalse(Client.objects.filter(pk=self.client_.pk).exists())
        self.assertFalse(Batiment.objects.filter(pk=self.batiment.pk).exists())
        self.assertFalse(RapportExtincteur.objects.exists())
        self.assertFalse(Tournee.objects.exists())
        self.assertFalse(FichierArchive.objects.exists())
        self.assertTrue(Utilisateur.objects.filter(pk=self.super_admin.pk).exists())

    def test_n_affecte_pas_les_autres_organisations(self):
        autre = Organisation.objects.create(nom="Autre org", slug="autre-org")
        sup = self.utilisateur("superviseur", organisation=autre)
        Client.objects.create(organisation=autre, nom="Client autre")
        self.api(self.super_admin).delete(self.url, {"confirmation": self.organisation.nom}, format="json")
        self.assertTrue(Organisation.objects.filter(pk=autre.pk).exists())
        self.assertTrue(Utilisateur.objects.filter(pk=sup.pk).exists())
        self.assertTrue(Client.objects.filter(organisation=autre).exists())

    def test_refuse_sans_le_nom_exact(self):
        res = self.api(self.super_admin).delete(self.url, {"confirmation": "mauvais nom"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Organisation.objects.filter(pk=self.organisation.pk).exists())

    def test_reserve_au_super_admin(self):
        res = self.api().delete(self.url, {"confirmation": self.organisation.nom}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Organisation.objects.filter(pk=self.organisation.pk).exists())
