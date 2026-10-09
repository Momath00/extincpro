"""Cas limites de l'intégration MS Solution : validations de l'API, journal,
blocage d'un compte et affichage côté super-admin."""

from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import Utilisateur
from organisations.models import JournalIntegration, Module, Organisation, OrganisationModule

from .fabrique import BaseTest

CLE = "cle-de-test-ms-solution-0123456789abcdef"
BASE = "/api/integration/ms-solution"


def client_jwt(utilisateur):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(utilisateur).access_token}")
    return c


@override_settings(MS_SOLUTION_API_KEY=CLE)
class ValidationsApi(BaseTest):
    def setUp(self):
        super().setUp()
        self.ms = APIClient()
        self.ms.credentials(HTTP_AUTHORIZATION=f"Bearer {CLE}")
        self.url = f"{BASE}/organisations/{self.organisation.id}/"

    def test_organisation_inexistante(self):
        self.assertEqual(self.ms.get(f"{BASE}/organisations/999999/").status_code, 404)
        self.assertEqual(self.ms.post(f"{BASE}/organisations/999999/acces/", {"est_active": False}, format="json").status_code, 404)

    def test_mauvais_schema_d_authentification(self):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Token {CLE}")
        self.assertEqual(c.get(f"{BASE}/organisations/").status_code, 403)

    def test_detail_d_une_organisation(self):
        res = self.ms.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["nom"], self.organisation.nom)
        self.assertEqual(res.data["nb_utilisateurs"], 2)

    def test_contact_vide_sans_superviseur(self):
        org = Organisation.objects.create(nom="Sans sup", slug="sans-sup")
        self.assertIsNone(self.ms.get(f"{BASE}/organisations/{org.id}/").data["contact"])

    def test_contact_est_le_premier_superviseur(self):
        self.utilisateur("superviseur")  # créé après celui de la fabrique
        self.assertEqual(self.ms.get(self.url).data["contact"]["courriel"], self.superviseur.email)

    def test_liste_des_modules(self):
        Module.objects.get_or_create(code="rapport_gicleur", defaults={"nom": "Gicleurs"})
        codes = [m["code"] for m in self.ms.get(f"{BASE}/modules/").data]
        self.assertIn("rapport_gicleur", codes)

    def test_lier_avec_un_identifiant_invalide(self):
        res = self.ms.post(f"{self.url}lier/", {"ms_client_id": "abc"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_delier_remet_l_organisation_a_lier(self):
        self.ms.post(f"{self.url}lier/", {"ms_client_id": 5}, format="json")
        res = self.ms.post(f"{self.url}lier/", {"ms_client_id": None}, format="json")
        self.assertIsNone(res.data["ms_client_id"])
        ids = [o["id"] for o in self.ms.get(f"{BASE}/organisations/?non_liees=1").data]
        self.assertIn(self.organisation.id, ids)
        self.assertEqual(
            list(JournalIntegration.objects.order_by("date").values_list("action", flat=True)), ["lier", "delier"],
        )

    def test_modules_sans_contenu(self):
        for corps in ({}, {"modules": {}}, {"modules": ["rapport_gicleur"]}):
            self.assertEqual(self.ms.post(f"{self.url}modules/", corps, format="json").status_code, 400, corps)

    def test_un_module_non_mentionne_ne_change_pas(self):
        a = Module.objects.get_or_create(code="mod_a", defaults={"nom": "A"})[0]
        b = Module.objects.get_or_create(code="mod_b", defaults={"nom": "B"})[0]
        OrganisationModule.objects.create(organisation=self.organisation, module=b, actif=True)
        self.ms.post(f"{self.url}modules/", {"modules": {"mod_a": True}}, format="json")
        self.assertTrue(OrganisationModule.objects.get(organisation=self.organisation, module=a).actif)
        self.assertTrue(OrganisationModule.objects.get(organisation=self.organisation, module=b).actif)

    def test_desactiver_un_module_efface_sa_date_d_activation(self):
        Module.objects.get_or_create(code="mod_a", defaults={"nom": "A"})
        self.ms.post(f"{self.url}modules/", {"modules": {"mod_a": True}}, format="json")
        lien = OrganisationModule.objects.get(organisation=self.organisation, module__code="mod_a")
        self.assertIsNotNone(lien.date_activation)
        self.ms.post(f"{self.url}modules/", {"modules": {"mod_a": False}}, format="json")
        lien.refresh_from_db()
        self.assertFalse(lien.actif)
        self.assertIsNone(lien.date_activation)

    def test_acces_sans_valeur(self):
        self.assertEqual(self.ms.post(f"{self.url}acces/", {}, format="json").status_code, 400)

    def test_motif_du_blocage_journalise(self):
        self.ms.post(f"{self.url}acces/", {"est_active": False, "motif": "Retard de 20 jours"}, format="json")
        entree = JournalIntegration.objects.get(action="bloquer")
        self.assertEqual(entree.donnees["motif"], "Retard de 20 jours")

    def test_essai_date_invalide_ou_absente(self):
        self.assertEqual(self.ms.post(f"{self.url}essai/", {}, format="json").status_code, 400)
        self.assertEqual(self.ms.post(f"{self.url}essai/", {"date_fin_essai": "31/12/2026"}, format="json").status_code, 400)

    def test_le_journal_survit_a_la_suppression_de_l_organisation(self):
        self.ms.post(f"{self.url}acces/", {"est_active": False}, format="json")
        nom = self.organisation.nom
        admin = Utilisateur.objects.create_user(username="sa-journal", password="x", role="super_admin")
        self.api(admin).delete(f"/api/organisations/{self.organisation.id}/", {"confirmation": nom}, format="json")
        entree = JournalIntegration.objects.get(action="bloquer")
        self.assertIsNone(entree.organisation_id)
        self.assertEqual(entree.organisation_nom, nom)


class BlocageDesComptes(BaseTest):
    def test_un_compte_desactive_perd_l_acces_immediatement(self):
        c = client_jwt(self.technicien)
        self.assertEqual(c.get("/api/me/").status_code, 200)
        Utilisateur.objects.filter(pk=self.technicien.pk).update(est_actif=False)
        res = c.get("/api/me/")
        self.assertEqual(res.status_code, 401)
        self.assertIn("désactivé", str(res.data["detail"]))

    def test_le_super_admin_n_est_jamais_bloque_par_une_organisation(self):
        admin = Utilisateur.objects.create_user(username="sa-bloc", password="x", role="super_admin")
        Organisation.objects.filter(pk=self.organisation.pk).update(est_active=False)
        self.assertEqual(client_jwt(admin).get("/api/me/").status_code, 200)

    def test_message_explique_la_suspension(self):
        c = client_jwt(self.superviseur)
        Organisation.objects.filter(pk=self.organisation.pk).update(est_active=False)
        self.assertIn("MS Solution", str(c.get("/api/me/").data["detail"]))


@override_settings(MS_SOLUTION_API_KEY=CLE)
class AffichageSuperAdmin(BaseTest):
    def setUp(self):
        super().setUp()
        self.admin = Utilisateur.objects.create_user(username="sa-aff", password="x", role="super_admin")

    def test_indique_si_l_organisation_est_geree_par_ms_solution(self):
        url = f"/api/organisations/{self.organisation.id}/"
        self.assertFalse(self.api(self.admin).get(url).data["geree_par_ms_solution"])
        Organisation.objects.filter(pk=self.organisation.pk).update(ms_client_id=12)
        data = self.api(self.admin).get(url).data
        self.assertTrue(data["geree_par_ms_solution"])
        self.assertEqual(data["ms_client_id"], 12)

    def test_le_super_admin_ne_peut_pas_lier_lui_meme(self):
        url = f"/api/organisations/{self.organisation.id}/"
        self.api(self.admin).patch(url, {"ms_client_id": 99}, format="json")
        self.organisation.refresh_from_db()
        self.assertIsNone(self.organisation.ms_client_id)

    def test_une_organisation_non_liee_reste_gerable(self):
        url = f"/api/organisations/{self.organisation.id}/"
        self.assertEqual(self.api(self.admin).patch(url, {"est_active": False}, format="json").status_code, 200)

    def test_une_organisation_liee_peut_quand_meme_etre_supprimee(self):
        Organisation.objects.filter(pk=self.organisation.pk).update(ms_client_id=12)
        res = self.api(self.admin).delete(
            f"/api/organisations/{self.organisation.id}/", {"confirmation": self.organisation.nom}, format="json",
        )
        self.assertEqual(res.status_code, 204)
