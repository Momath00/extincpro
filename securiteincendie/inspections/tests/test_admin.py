"""Admin Django : chaque rapport, ses lignes et ses certificats s'ouvrent,
et la fiche d'un bâtiment liste tous ses rapports."""

from django.test import Client as ClientHttp
from django.urls import reverse

from inspections.models import (
    EclairageUrgenceItem,
    Rapport,
    RapportCuisine,
    RapportEclairageUrgence,
    RapportGicleur,
)

from .fabrique import BaseTest


class AdminRapports(BaseTest):
    def setUp(self):
        super().setUp()
        admin = self.utilisateur("superviseur", is_staff=True, is_superuser=True)
        self.http = ClientHttp()
        self.http.force_login(admin)
        self.alarme = Rapport.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        self.extincteurs = self.rapport_extincteur(items=[{"etat": "C"}])
        self.eclairage = RapportEclairageUrgence.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        EclairageUrgenceItem.objects.create(rapport=self.eclairage, ordre=1, emplacement="Hall")
        self.cuisine = RapportCuisine.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        self.gicleurs = RapportGicleur.objects.create(batiment=self.batiment, cree_par=self.superviseur)

    def test_fiche_batiment_liste_tous_ses_rapports(self):
        reponse = self.http.get(reverse("admin:inspections_batiment_change", args=[self.batiment.pk]))

        self.assertEqual(reponse.status_code, 200)
        for objet in (self.alarme, self.extincteurs, self.eclairage, self.cuisine, self.gicleurs):
            nom = objet._meta.model_name
            self.assertContains(reponse, reverse(f"admin:inspections_{nom}_change", args=[objet.pk]))

    def test_pages_des_rapports_s_ouvrent(self):
        for objet in (self.alarme, self.extincteurs, self.eclairage, self.cuisine, self.gicleurs):
            nom = objet._meta.model_name
            with self.subTest(nom):
                self.assertEqual(self.http.get(reverse(f"admin:inspections_{nom}_changelist")).status_code, 200)
                self.assertEqual(self.http.get(reverse(f"admin:inspections_{nom}_change", args=[objet.pk])).status_code, 200)

    def test_listes_des_certificats_s_ouvrent(self):
        for nom in ("certificat", "certificatextincteur", "certificatgicleur", "parametrescertificat", "client"):
            with self.subTest(nom):
                self.assertEqual(self.http.get(reverse(f"admin:inspections_{nom}_changelist")).status_code, 200)
