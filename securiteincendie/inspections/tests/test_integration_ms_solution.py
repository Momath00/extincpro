"""API d'intégration appelée par MS Solution (facturation) et blocage effectif
d'une organisation suspendue."""

from datetime import date

from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from organisations.models import JournalIntegration, Module, Organisation, OrganisationModule

from .fabrique import BaseTest

CLE = "cle-de-test-ms-solution-0123456789abcdef"
BASE = "/api/integration/ms-solution"


@override_settings(MS_SOLUTION_API_KEY=CLE)
class ApiIntegration(BaseTest):
    def setUp(self):
        super().setUp()
        self.module = Module.objects.get_or_create(code="gicleur", defaults={"nom": "Gicleurs"})[0]
        OrganisationModule.objects.get_or_create(organisation=self.organisation, module=self.module)

    def ms(self, cle=CLE):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {cle}")
        return c

    def jwt(self, utilisateur):
        """Client authentifié par un vrai jeton (force_authenticate court-
        circuiterait la vérification du blocage)."""
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(utilisateur).access_token}")
        return c

    def url(self, suffixe=""):
        return f"{BASE}/organisations/{self.organisation.id}/{suffixe}"

    def test_refuse_sans_la_bonne_cle(self):
        self.assertEqual(APIClient().get(f"{BASE}/organisations/").status_code, 403)
        self.assertEqual(self.ms("mauvaise").get(f"{BASE}/organisations/").status_code, 403)
        # Un super admin connecté ne passe pas non plus : seule la clé compte.
        self.assertEqual(self.api().get(f"{BASE}/organisations/").status_code, 403)

    @override_settings(MS_SOLUTION_API_KEY="")
    def test_desactivee_sans_cle_configuree(self):
        self.assertEqual(self.ms("").get(f"{BASE}/organisations/").status_code, 403)

    def test_liste_des_organisations_a_lier(self):
        res = self.ms().get(f"{BASE}/organisations/?non_liees=1")
        self.assertEqual(res.status_code, 200)
        org = next(o for o in res.data if o["id"] == self.organisation.id)
        self.assertEqual(org["contact"]["courriel"], self.superviseur.email)
        self.assertIsNone(org["ms_client_id"])

        self.ms().post(self.url("lier/"), {"ms_client_id": 42}, format="json")
        ids = [o["id"] for o in self.ms().get(f"{BASE}/organisations/?non_liees=1").data]
        self.assertNotIn(self.organisation.id, ids)

    def test_un_client_ne_se_lie_qu_a_une_organisation(self):
        autre = Organisation.objects.create(nom="Autre", slug="autre")
        self.ms().post(self.url("lier/"), {"ms_client_id": 7}, format="json")
        res = self.ms().post(f"{BASE}/organisations/{autre.id}/lier/", {"ms_client_id": 7}, format="json")
        self.assertEqual(res.status_code, 409)

    def test_fixer_un_module_est_rejouable(self):
        for _ in range(2):
            res = self.ms().post(self.url("modules/"), {"modules": {"gicleur": True}}, format="json")
            self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(OrganisationModule.objects.get(organisation=self.organisation, module=self.module).actif)
        self.assertEqual(JournalIntegration.objects.filter(action="modules").count(), 2)

    def test_module_inconnu_refuse(self):
        res = self.ms().post(self.url("modules/"), {"modules": {"inexistant": True}}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_fin_d_essai_fixee_puis_retiree(self):
        self.ms().post(self.url("essai/"), {"date_fin_essai": "2026-12-31"}, format="json")
        self.organisation.refresh_from_db()
        self.assertEqual(self.organisation.date_fin_essai, date(2026, 12, 31))
        self.ms().post(self.url("essai/"), {"date_fin_essai": None}, format="json")
        self.organisation.refresh_from_db()
        self.assertIsNone(self.organisation.date_fin_essai)

    def test_bloquer_puis_debloquer(self):
        res = self.ms().post(self.url("acces/"), {"est_active": False, "motif": "Retard 15 j"}, format="json")
        self.assertFalse(res.data["est_active"])
        self.assertEqual(self.jwt(self.superviseur).get("/api/me/").status_code, 401)

        self.ms().post(self.url("acces/"), {"est_active": True}, format="json")
        self.assertEqual(self.jwt(self.superviseur).get("/api/me/").status_code, 200)
        self.assertEqual(
            list(JournalIntegration.objects.order_by("date").values_list("action", flat=True)),
            ["bloquer", "debloquer"],
        )

    def test_super_admin_ne_modifie_plus_une_organisation_liee(self):
        from accounts.models import Utilisateur

        admin = Utilisateur.objects.create_user(username="sa-integ", password="x", role="super_admin")
        self.ms().post(self.url("lier/"), {"ms_client_id": 42}, format="json")
        c = self.api(admin)
        org_url = f"/api/organisations/{self.organisation.id}/"
        self.assertEqual(c.patch(org_url, {"est_active": False}, format="json").status_code, 409)
        self.assertEqual(c.post(f"{org_url}modules/gicleur/toggle/").status_code, 409)
        # Le reste (nom, logo, langue…) reste modifiable.
        self.assertEqual(c.patch(org_url, {"adresse": "1 rue Test"}, format="json").status_code, 200)


class BlocageOrganisation(BaseTest):
    """Le coupe-circuit est_active bloque vraiment : connexion, jeton existant
    et renouvellement du jeton."""

    def bloquer(self):
        Organisation.objects.filter(pk=self.organisation.pk).update(est_active=False)

    def test_connexion_refusee(self):
        self.bloquer()
        res = APIClient().post("/api/token/", {"username": self.superviseur.username, "password": "motdepasse-test"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("suspendu", res.data["error"])

    def test_jeton_existant_refuse(self):
        jeton = str(RefreshToken.for_user(self.superviseur).access_token)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")
        self.assertEqual(c.get("/api/me/").status_code, 200)
        self.bloquer()
        self.assertEqual(c.get("/api/me/").status_code, 401)

    def test_renouvellement_refuse(self):
        refresh = str(RefreshToken.for_user(self.superviseur))
        self.bloquer()
        res = APIClient().post("/api/token/refresh/", {"refresh": refresh})
        self.assertEqual(res.status_code, 401)

    def test_les_autres_organisations_ne_sont_pas_touchees(self):
        autre = Organisation.objects.create(nom="Libre", slug="libre")
        sup = self.utilisateur("superviseur", organisation=autre)
        self.bloquer()
        res = APIClient().post("/api/token/", {"username": sup.username, "password": "motdepasse-test"})
        self.assertEqual(res.status_code, 200)
