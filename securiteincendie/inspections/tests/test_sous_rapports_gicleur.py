"""Rapport gicleur : fiches (sous-rapports) sous eau / sous air, réponses,
déficiences, photos par section et PDF."""

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from inspections.models import RapportGicleur, SousRapportGicleur
from organisations.models import Module, OrganisationModule

from .fabrique import BaseTest


def _image():
    sortie = BytesIO()
    Image.new("RGB", (20, 20), (200, 30, 30)).save(sortie, format="JPEG")
    return SimpleUploadedFile("photo.jpg", sortie.getvalue(), content_type="image/jpeg")


class BaseGicleur(BaseTest):
    """Module gicleur actif + création d'un rapport par l'API."""

    def setUp(self):
        super().setUp()
        module = Module.objects.get_or_create(code="rapport_gicleur", defaults={"nom": "Gicleurs"})[0]
        OrganisationModule.objects.create(organisation=self.organisation, module=module, actif=True)

    def creer(self, fiches=()):
        res = self.api().post("/api/rapports-gicleurs/", {
            "batiment": self.batiment.id, "techniciens": [self.technicien.id], "fiches": list(fiches),
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return RapportGicleur.objects.get(pk=res.data["id"])


class SousRapportsGicleur(BaseGicleur):
    def test_seules_les_fiches_choisies_sont_creees(self):
        rapport = self.creer([{"type_fiche": "eau", "numero_systeme": "1"}, {"type_fiche": "eau", "numero_systeme": "2"}])
        self.assertEqual(
            list(rapport.sous_rapports.values_list("type_fiche", "numero_systeme", "ordre")),
            [("eau", "1", 1), ("eau", "2", 2)],
        )
        self.assertEqual(self.creer().sous_rapports.count(), 0)

    def test_type_de_fiche_inconnu_refuse(self):
        res = self.api().post("/api/rapports-gicleurs/", {
            "batiment": self.batiment.id, "fiches": [{"type_fiche": "extincteurs"}],
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(RapportGicleur.objects.exists())

    def test_ajouter_une_fiche_ensuite(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        res = self.api(self.technicien).post(f"/api/rapports-gicleurs/{rapport.id}/sous-rapports/",
                                             {"type_fiche": "air", "numero_systeme": "3"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["ordre"], 2)

    def test_les_reponses_sont_fusionnees_et_les_deficiences_calculees(self):
        sr = self.creer([{"type_fiche": "eau"}]).sous_rapports.get()
        c = self.api(self.technicien)
        url = f"/api/sous-rapports-gicleur/{sr.id}/"
        self.assertEqual(c.patch(url, {"reponses": {"gicleurs_exempts": "non"}}, format="json").status_code, 200)
        self.assertEqual(c.patch(url, {"reponses": {"degagement_18po": "oui"},
                                       "remarques": {"tuyauterie": "Peinture au 2e"}}, format="json").status_code, 200)
        sr.refresh_from_db()
        self.assertEqual(sr.reponses, {"gicleurs_exempts": "non", "degagement_18po": "oui"})
        self.assertEqual([(d["section"], d["remarque"]) for d in sr.deficiences()], [("tuyauterie", "Peinture au 2e")])
        self.assertFalse(sr.rapport.est_conforme)

        # Une valeur vide efface la déficience (et la réponse).
        c.patch(url, {"reponses": {"gicleurs_exempts": ""}, "remarques": {"tuyauterie": ""}}, format="json")
        sr.refresh_from_db()
        self.assertNotIn("gicleurs_exempts", sr.reponses)
        self.assertEqual(sr.remarques, {})
        self.assertTrue(sr.rapport.est_conforme)

    def test_un_non_n_est_pas_une_deficience(self):
        sr = self.creer([{"type_fiche": "eau"}]).sous_rapports.get()
        sr.reponses = {"gicleurs_exempts": "non", "cloche_electrique": "non"}
        sr.save()
        self.assertEqual(sr.deficiences(), [])
        self.assertTrue(sr.rapport.est_conforme)

    def test_valeurs_invalides_refusees(self):
        sr = self.creer([{"type_fiche": "eau"}]).sous_rapports.get()
        url = f"/api/sous-rapports-gicleur/{sr.id}/"
        for corps in (
            {"reponses": {"champ_inconnu": "oui"}},
            {"reponses": {"gicleurs_exempts": "peut-etre"}},
            {"reponses": {"plaque_calcul_hydraulique": "na"}},
            {"remarques": {"marque": "x"}},
            {"remarques": {"notes": "x"}},
            {"type_fiche": "air"},
        ):
            self.assertEqual(self.api().patch(url, corps, format="json").status_code, 400, corps)

    def test_le_technicien_ne_modifie_plus_un_rapport_ferme(self):
        rapport = self.creer([{"type_fiche": "air"}])
        sr = rapport.sous_rapports.get()
        self.fermer(rapport)
        res = self.api(self.technicien).patch(f"/api/sous-rapports-gicleur/{sr.id}/",
                                              {"reponses": {"gicleurs_exempts": "oui"}}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_une_autre_organisation_ne_voit_pas_la_fiche(self):
        from organisations.models import Organisation

        sr = self.creer([{"type_fiche": "eau"}]).sous_rapports.get()
        autre = Organisation.objects.create(nom="Autre", slug="autre-gic")
        module = Module.objects.get(code="rapport_gicleur")
        OrganisationModule.objects.create(organisation=autre, module=module, actif=True)
        etranger = self.utilisateur("superviseur", organisation=autre)
        self.assertEqual(self.api(etranger).get(f"/api/sous-rapports-gicleur/{sr.id}/").status_code, 404)

    def test_photo_rattachee_a_une_section_de_fiche(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        sr = rapport.sous_rapports.get()
        url = f"/api/rapports-gicleurs/{rapport.id}/photos/"
        res = self.api().post(url, {"image": _image(), "emplacement": "Salle des valves",
                                    "sous_rapport": sr.id, "section_fiche": "tuyauterie"}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data["sous_rapport_gicleur"], res.data["section_fiche"]), (sr.id, "tuyauterie"))

        filtre = self.api().get(f"{url}?sous_rapport={sr.id}&section_fiche=tuyauterie")
        self.assertEqual(len(filtre.data), 1)
        self.assertEqual(len(self.api().get(f"{url}?sous_rapport=aucune").data), 0)

        mauvaise = self.api().post(url, {"image": _image(), "emplacement": "x", "sous_rapport": sr.id,
                                         "section_fiche": "inexistante"}, format="multipart")
        self.assertEqual(mauvaise.status_code, 400)

    def test_supprimer_une_fiche_supprime_ses_photos(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        sr = rapport.sous_rapports.get()
        self.api().post(f"/api/rapports-gicleurs/{rapport.id}/photos/",
                        {"image": _image(), "emplacement": "x", "sous_rapport": sr.id}, format="multipart")
        self.assertEqual(self.api().delete(f"/api/sous-rapports-gicleur/{sr.id}/").status_code, 204)
        self.assertFalse(SousRapportGicleur.objects.exists())
        self.assertEqual(rapport.photos.count(), 0)

    def test_le_pdf_contient_les_fiches_et_les_deficiences(self):
        rapport = self.creer([{"type_fiche": "eau", "numero_systeme": "7"}, {"type_fiche": "air"}])
        sr = rapport.sous_rapports.first()
        sr.reponses = {"cloche_electrique": "non"}
        sr.remarques = {"alarmes": "Cloche hors service"}
        sr.save()
        html = self.api().get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/").content.decode()
        # Chaque fiche est un rapport indépendant, avec son titre propre.
        self.assertIn("Rapport d&#x27;inspection — Gicleur à eau", html)
        self.assertIn("Gicleur à air", html)
        self.assertIn("Cloche hors service", html)
        self.assertEqual(html.count('class="gic-rapport-fiche gic-saut"'), 2)

    def test_pdf_d_une_seule_fiche(self):
        rapport = self.creer([{"type_fiche": "eau", "numero_systeme": "1"}, {"type_fiche": "air", "numero_systeme": "2"}])
        air = rapport.sous_rapports.get(type_fiche="air")
        html = self.api(self.technicien).get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/?sous_rapport={air.id}").content.decode()
        self.assertIn("Rapport d&#x27;inspection — Gicleur à air", html)
        self.assertNotIn("Gicleur à eau", html)
        autre = self.creer([{"type_fiche": "eau"}]).sous_rapports.get()
        res = self.api().get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/?sous_rapport={autre.id}")
        self.assertEqual(res.status_code, 404)

    def test_la_liste_des_fiches_est_servie(self):
        res = self.api(self.technicien).get("/api/rapports-gicleurs/fiches/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(set(res.data), {"eau", "air", "darpr", "dar2cr"})

    def test_fiches_anti_refoulement(self):
        rapport = self.creer([{"type_fiche": "darpr"}, {"type_fiche": "dar2cr"}])
        darpr = rapport.sous_rapports.get(type_fiche="darpr")
        url = f"/api/sous-rapports-gicleur/{darpr.id}/"
        corps = {"reponses": {"dar_q1": "oui", "darpr_resultat": "echec", "dar_verif_nom": "J. Leclerc"},
                 "remarques": {"darpr_statique": "Échec de l'essai de pression statique."}}
        self.assertEqual(self.api(self.technicien).patch(url, corps, format="json").status_code, 200)
        # Pas de déficiences sur la section « Observation » (texte libre).
        self.assertEqual(self.api().patch(url, {"remarques": {"dar_observation": "x"}}, format="json").status_code, 400)
        html = self.api().get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/").content.decode()
        self.assertIn("Dispositif anti-refoulement à pression réduite (D.A.R.P.R.)", html)
        self.assertIn("Dispositif anti-refoulement à deux clapets de retenue (D.A.R.2.C.R.)", html)
        self.assertIn("CAN/CSA-B64.10", html)
        self.assertIn("Échec de l&#x27;essai de pression statique.", html)

    def test_le_technicien_ferme_mais_ne_rouvre_pas(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        c = self.api(self.technicien)
        with self.captureOnCommitCallbacks(execute=True):
            res = c.post(f"/api/rapports-gicleurs/{rapport.id}/fermer/")
        self.assertEqual(res.status_code, 200, res.data)
        rapport.refresh_from_db()
        self.assertEqual(rapport.statut, "ferme")
        self.assertTrue(hasattr(rapport, "certificat"))
        self.assertEqual(c.post(f"/api/rapports-gicleurs/{rapport.id}/rouvrir/").status_code, 403)


class DebitsEtValves(BaseGicleur):
    """Section optionnelle « Débits et valves » du rapport gicleur."""

    def test_ajoutee_seulement_si_demandee(self):
        self.assertIsNone(self.creer().debits_valves)
        res = self.api().post("/api/rapports-gicleurs/", {
            "batiment": self.batiment.id, "avec_debits_valves": True,
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(RapportGicleur.objects.get(pk=res.data["id"]).debits_valves, {"lignes": [], "deficiences": ""})

    def test_lignes_deficiences_et_conformite(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        url = f"/api/rapports-gicleurs/{rapport.id}/"
        section = {"lignes": [{"zone": "1", "endroit": "Entrepôt", "signal": "oui", "temps": "45 s"}],
                   "deficiences": "Commutateur zone 1 sans identification."}
        self.assertEqual(self.api(self.technicien).patch(url, {"debits_valves": section}, format="json").status_code, 200)
        rapport.refresh_from_db()
        self.assertEqual(rapport.debits_valves["lignes"][0]["endroit"], "Entrepôt")
        self.assertEqual([d["section"] for d in rapport.deficiences()], ["debits_valves"])
        self.assertFalse(rapport.est_conforme)

        detail = self.api().get(url).data
        self.assertEqual(detail["debits_valves"]["deficiences"], "Commutateur zone 1 sans identification.")
        liste = self.api().get("/api/rapports-gicleurs/").data["results"]
        self.assertEqual(liste[0]["resume_debits_valves"], {"nb_lignes": 1, "nb_deficiences": 1})

        # Retirer la section.
        self.api().patch(url, {"debits_valves": None}, format="json")
        rapport.refresh_from_db()
        self.assertIsNone(rapport.debits_valves)
        self.assertTrue(rapport.est_conforme)

    def test_valeurs_invalides(self):
        url = f"/api/rapports-gicleurs/{self.creer().id}/"
        for section in (
            {"lignes": [{"colonne_inconnue": "x"}]},
            {"lignes": [{"signal": "peut-etre"}]},
            {"lignes": "pas une liste"},
            {"autre": []},
        ):
            self.assertEqual(self.api().patch(url, {"debits_valves": section}, format="json").status_code, 400, section)

    def test_photo_de_la_section(self):
        rapport = self.creer()
        url = f"/api/rapports-gicleurs/{rapport.id}/photos/"
        res = self.api().post(url, {"image": _image(), "emplacement": "Commutateur zone 2",
                                    "section_fiche": "debits_valves"}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data["sous_rapport_gicleur"], res.data["section_fiche"]), (None, "debits_valves"))
        mauvaise = self.api().post(url, {"image": _image(), "emplacement": "x", "section_fiche": "tuyauterie"}, format="multipart")
        self.assertEqual(mauvaise.status_code, 400)

    def test_le_pdf_contient_la_section(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        rapport.debits_valves = {"lignes": [{"zone": "3", "endroit": "Quai de chargement"}], "deficiences": "Signal absent zone 3"}
        rapport.save()
        html = self.api().get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/").content.decode()
        self.assertIn("Débits et valves", html)
        self.assertIn("Quai de chargement", html)
        self.assertIn("Signal absent zone 3", html)


class IdentificationBatiment(BaseGicleur):
    """Infos et identification du bâtiment (onglets « Client » et « Identification »)."""

    def test_les_reponses_sont_fusionnees(self):
        rapport = self.creer()
        url = f"/api/rapports-gicleurs/{rapport.id}/"
        c = self.api(self.technicien)
        self.assertEqual(c.patch(url, {"identification": {"reponses": {"id_panneau_modele": "Simplex 4100"}}}, format="json").status_code, 200)
        self.assertEqual(c.patch(url, {"identification": {"reponses": {"id_code_porte": "1234#"},
                                                         "remarques": {"id_raccord": "Capuchon manquant."}}}, format="json").status_code, 200)
        rapport.refresh_from_db()
        self.assertEqual(rapport.identification["reponses"], {"id_panneau_modele": "Simplex 4100", "id_code_porte": "1234#"})
        self.assertEqual([d["section"] for d in rapport.deficiences()], ["id_raccord"])
        self.assertFalse(rapport.est_conforme)

    def test_valeurs_invalides(self):
        url = f"/api/rapports-gicleurs/{self.creer().id}/"
        for ident in (
            {"reponses": {"champ_inconnu": "x"}},
            {"reponses": {"id_occupe": "peut-etre"}},
            {"remarques": {"id_notes": "x"}},
            {"autre": {}},
        ):
            self.assertEqual(self.api().patch(url, {"identification": ident}, format="json").status_code, 400, ident)

    def test_infos_du_batiment_reprises_du_rapport_precedent(self):
        precedent = self.creer()
        precedent.identification = {
            "reponses": {"id_panneau_modele": "Simplex 4100", "id_code_porte": "1234#", "id_soumis_contact": "M. Roy",
                         "id_occupe": "non"},
            "remarques": {"id_raccord": "Capuchon manquant."},
        }
        precedent.save()
        nouveau = self.creer()
        # Infos du bâtiment reprises ; questions et déficiences de l'inspection non.
        self.assertEqual(nouveau.identification["reponses"],
                         {"id_panneau_modele": "Simplex 4100", "id_code_porte": "1234#", "id_soumis_contact": "M. Roy"})
        self.assertEqual(nouveau.identification["remarques"], {})

    def test_photo_d_une_section_de_l_identification(self):
        rapport = self.creer()
        res = self.api().post(f"/api/rapports-gicleurs/{rapport.id}/photos/",
                              {"image": _image(), "emplacement": "Raccord pompier", "section_fiche": "id_raccord"}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)

    def test_le_pdf_contient_l_identification(self):
        rapport = self.creer([{"type_fiche": "eau"}])
        rapport.identification = {"reponses": {"id_panneau_modele": "Simplex 4100", "id_soumis_contact": "M. Roy"},
                                  "remarques": {"id_generalites": "Salle des gicleurs encombrée."}}
        rapport.save()
        html = self.api().get(f"/api/rapports-gicleurs/{rapport.id}/telecharger/").content.decode()
        self.assertIn("Simplex 4100", html)
        self.assertIn("M. Roy", html)
        self.assertIn("Salle des gicleurs encombrée.", html)
