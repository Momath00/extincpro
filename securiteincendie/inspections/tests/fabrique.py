"""Données de test communes : organisation, utilisateurs, client, bâtiment,
rapports.

`BaseTest` neutralise tout envoi réel de courriel : la clé Resend est vidée
et Django utilise sa boîte aux lettres en mémoire (aucun courriel ne quitte
la machine pendant les tests).
"""

from datetime import date
from itertools import count

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import Utilisateur
from inspections.models import Batiment, Client, ExtincteurItem, RapportExtincteur
from organisations.models import Organisation

_compteur = count(1)


def _n():
    return next(_compteur)


@override_settings(
    RESEND_API_KEY="",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class BaseTest(TestCase):
    """Organisation avec un superviseur, un technicien, un client et un bâtiment."""

    def setUp(self):
        n = _n()
        self.organisation = Organisation.objects.create(nom=f"Org test {n}", slug=f"org-test-{n}")
        self.superviseur = self.utilisateur("superviseur")
        self.technicien = self.utilisateur("technicien")
        self.client_ = Client.objects.create(
            organisation=self.organisation, nom=f"Client test {n}", contact_email="client@exemple.test",
        )
        self.batiment = self.creer_batiment()

    # ── Fabriques ───────────────────────────────────────────────────────────

    def utilisateur(self, role, organisation=None, **extra):
        n = _n()
        return Utilisateur.objects.create_user(
            username=f"{role}{n}", password="motdepasse-test", email=f"{role}{n}@exemple.test",
            role=role, organisation=organisation or self.organisation, **extra,
        )

    def creer_batiment(self, client=None, **extra):
        return Batiment.objects.create(
            client=client or self.client_, numero_civique=str(_n()), rue="rue des Tests", ville="Montréal", **extra,
        )

    def rapport_extincteur(self, jour=date(2026, 3, 15), batiment=None, items=()):
        """Rapport extincteurs ; `items` : liste de dict (champs d'ExtincteurItem)."""
        r = RapportExtincteur.objects.create(
            batiment=batiment or self.batiment, cree_par=self.superviseur, date_inspection=jour,
        )
        for i, champs in enumerate(items, start=1):
            ExtincteurItem.objects.create(rapport=r, ordre=i, **{"etage": "RC", "emplacement": f"Empl {i}", **champs})
        r.refresh_from_db()
        return r

    def fermer(self, rapport):
        """Ferme le rapport et exécute l'archivage prévu après la transaction."""
        with self.captureOnCommitCallbacks(execute=True):
            rapport.fermer(self.superviseur)
        rapport.refresh_from_db()
        return rapport

    def api(self, utilisateur=None):
        c = APIClient()
        c.force_authenticate(utilisateur or self.superviseur)
        return c
