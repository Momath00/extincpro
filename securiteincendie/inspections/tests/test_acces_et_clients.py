"""Qui voit quoi dans le dossier, et clients entreprise / particulier."""

from inspections.models import Batiment, Client

from .fabrique import BaseTest


class AccesAuDossier(BaseTest):
    def setUp(self):
        super().setUp()
        self.rapport = self.fermer(self.rapport_extincteur(items=[{"etat": "C"}]))
        self.cycle = self.rapport.cycle

    def test_le_superviseur_voit_tout_le_dossier(self):
        res = self.api().get(f"/api/cycles/{self.cycle.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("journal", res.data)
        self.assertTrue(res.data["peut_modifier"])

    def test_le_citoyen_voit_son_batiment_sans_journal_ni_actions(self):
        citoyen = self.utilisateur("citoyen")
        Batiment.objects.filter(pk=self.batiment.pk).update(proprietaire=citoyen)
        c = self.api(citoyen)
        res = c.get(f"/api/cycles/{self.cycle.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("journal", res.data)
        self.assertFalse(res.data["peut_modifier"])
        self.assertEqual(c.post(f"/api/cycles/{self.cycle.id}/fermer/").status_code, 403)
        self.assertEqual(c.get(f"/api/cycles/{self.cycle.id}/export/").status_code, 403)

    def test_un_citoyen_ne_voit_pas_le_batiment_d_un_autre(self):
        etranger = self.utilisateur("citoyen")
        self.assertEqual(self.api(etranger).get(f"/api/cycles/{self.cycle.id}/").status_code, 404)

    def test_le_technicien_n_a_pas_acces_au_dossier(self):
        res = self.api(self.technicien).get(f"/api/cycles/?batiment={self.batiment.id}")
        self.assertEqual(res.status_code, 404)

    def test_une_autre_organisation_ne_voit_rien(self):
        from organisations.models import Organisation

        autre_org = Organisation.objects.create(nom="Autre org", slug="autre-org")
        intrus = self.utilisateur("superviseur", organisation=autre_org)
        self.assertEqual(self.api(intrus).get(f"/api/cycles/{self.cycle.id}/").status_code, 404)


class ClientsEntrepriseOuParticulier(BaseTest):
    def test_le_nom_d_un_particulier_est_prenom_et_nom(self):
        res = self.api().post("/api/clients/", {
            "type_client": "particulier", "prenom": "Jean", "nom_famille": "Tremblay",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["nom"], "Jean Tremblay")
        self.assertEqual(res.data["contact_nom"], "Jean Tremblay")

    def test_deux_particuliers_peuvent_porter_le_meme_nom(self):
        for _ in range(2):
            res = self.api().post("/api/clients/", {
                "type_client": "particulier", "prenom": "Jean", "nom_famille": "Tremblay",
            }, format="json")
            self.assertEqual(res.status_code, 201)
        self.assertEqual(Client.objects.filter(nom="Jean Tremblay").count(), 2)

    def test_deux_entreprises_ne_peuvent_pas_porter_le_meme_nom(self):
        res = self.api().post("/api/clients/", {"nom": self.client_.nom.upper()}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_un_particulier_sans_prenom_est_refuse(self):
        res = self.api().post("/api/clients/", {"type_client": "particulier", "nom_famille": "Tremblay"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_filtrer_les_clients_par_type(self):
        self.api().post("/api/clients/", {"type_client": "particulier", "prenom": "Ana", "nom_famille": "Roy"}, format="json")
        res = self.api().get("/api/clients/?type=particulier")
        noms = [c["nom"] for c in (res.data["results"] if isinstance(res.data, dict) else res.data)]
        self.assertEqual(noms, ["Ana Roy"])

    def test_passer_d_entreprise_a_particulier_recalcule_le_nom(self):
        res = self.api().patch(f"/api/clients/{self.client_.id}/", {
            "type_client": "particulier", "prenom": "Léa", "nom_famille": "Gagnon",
        }, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.client_.refresh_from_db()
        self.assertEqual(self.client_.nom, "Léa Gagnon")
