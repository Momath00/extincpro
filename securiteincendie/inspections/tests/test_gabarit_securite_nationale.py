"""Gabarit Sécurité Incendie National : rapports extincteurs / éclairage /
alarme à la mise en page de leurs classeurs Excel, notes de bas de rapport,
et correction de la date d'un rapport gicleurs fermé."""

from datetime import date
from unittest import mock

from django.core import mail

from inspections.gabarit_sin import html_rapport_eclairage, html_rapport_extincteurs
from inspections.models import (
    Dispositif,
    EclairageUrgenceItem,
    FicheE2,
    Rapport,
    RapportEclairageUrgence,
    RapportGicleur,
    SectionDispositif,
)
from inspections.views import _html_rapport_eclairage_complet, _html_rapport_extincteur_complet, _html_rapport_incendie_complet
from organisations.models import Module, OrganisationModule

from .fabrique import BaseTest


class GabaritSIN(BaseTest):
    def setUp(self):
        super().setUp()
        self.organisation.gabarit_rapports = "sin"
        self.organisation.save()
        for code in ("rapport_extincteur", "rapport_eclairage_urgence", "rapport_gicleur"):
            module, _ = Module.objects.get_or_create(code=code, defaults={"nom": code})
            OrganisationModule.objects.update_or_create(organisation=self.organisation, module=module, defaults={"actif": True})

    def test_rapport_extincteurs_aux_colonnes_du_gabarit(self):
        rapport = self.rapport_extincteur(items=[
            {"format": "5lb", "type_extincteur": "CO2", "etat": "D", "derniere_inspection": "2024",
             "derniere_recharge": "2019", "non_conformites": ["RC", "PIC", "RL"], "remarque": "Caché"},
        ])
        rapport.remarques, rapport.obligations = "Accès encombré.", "Dégager l'accès."
        rapport.save()

        html = _html_rapport_extincteur_complet(rapport)

        self.assertIn("RAPPORT EXTINCTEURS INCENDIE NFPA 10", html)
        self.assertIn("ÉTIQUETTE DE VISIBILITÉ", html)
        # CO2 → TYPE CO2 / CLASSE BC ; RC → « À FAIRE » ; PIC → étiquette « NON ».
        self.assertIn("<td>CO2</td><td>BC</td>", html)
        self.assertIn("<td>À FAIRE</td>", html)
        self.assertIn("<td>NON</td><td>OUI</td>", html)
        # Les codes sans colonne et la remarque de la ligne vont dans REMARQUES.
        self.assertIn("Extincteur n° 1 : RL · Caché", html)
        self.assertIn("Accès encombré.", html)
        self.assertIn("Dégager l&#x27;accès.", html)

    def test_rapport_eclairage_aux_colonnes_du_gabarit(self):
        rapport = RapportEclairageUrgence.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        EclairageUrgenceItem.objects.create(
            rapport=rapport, ordre=1, emplacement="Garage", fabricant="Lumacell", dispositif="TD",
            modele="RS Power", voltage="6VX7A", etat="D",
        )

        html = _html_rapport_eclairage_complet(rapport)

        self.assertIn("LES DISPOSITIFS SONT INSPECTÉS SELON LES NORMES NFPA 101.", html)
        self.assertIn("<td>LUMACELL</td><td>TD</td><td>RS POWER</td><td>NON</td><td>6VX7A</td>", html)
        self.assertIn("LÉGENDE DES DISPOSITIFS", html)

    def test_rapport_alarme_legende_s536_et_colonnes_o_n(self):
        rapport = Rapport.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        section = SectionDispositif.objects.create(rapport=rapport, nom="Garage", ordre=0)
        Dispositif.objects.create(
            rapport=rapport, section=section, localisation="Porte", type_dispositif="EOL",
            installation_correcte=True, necessite_entretien=False, alarme_confirmee=True, annonce_statut="D",
        )

        FicheE2.objects.create(rapport=rapport, details={"e2_12": {"remarques": "Batterie à remplacer.\nPanneau OK."}})

        html = _html_rapport_incendie_complet(rapport)

        self.assertIn("E2.12 — REMARQUES", html)
        self.assertNotIn("A = Installation correcte", html)
        self.assertIn("Batterie à remplacer.<br>Panneau OK.", html)
        self.assertIn("Résistance d&#x27;extrémité de ligne", html.replace("'", "&#x27;"))
        self.assertIn("INDICATION DE L'ANNONCE CONFIRMÉE", html)
        self.assertIn("<td class='center'>O</td><td class='center'>N</td><td class='center'>O</td><td class='center'>N</td>", html)

    def test_organisation_standard_garde_le_rendu_habituel(self):
        self.organisation.gabarit_rapports = "standard"
        self.organisation.save()
        rapport = self.rapport_extincteur(items=[{"etat": "C"}])
        with mock.patch("inspections.gabarit_sin.html_rapport_extincteurs") as gabarit:
            _html_rapport_extincteur_complet(rapport)
        gabarit.assert_not_called()

    def test_notes_par_le_technicien_assigne(self):
        rapport = self.rapport_extincteur()
        rapport.techniciens.add(self.technicien)
        url = f"/api/rapports-extincteurs/{rapport.id}/notes/"

        reponse = self.api(self.technicien).patch(url, {"recommandations": "Ajouter un extincteur K."}, format="json")

        self.assertEqual(reponse.status_code, 200)
        rapport.refresh_from_db()
        self.assertEqual(rapport.recommandations, "Ajouter un extincteur K.")
        self.assertTrue(rapport.historique.filter(description__contains="recommandations").exists())

    def test_notes_refusees_au_technicien_sur_rapport_ferme(self):
        rapport = RapportEclairageUrgence.objects.create(batiment=self.batiment, cree_par=self.superviseur, statut="ferme")
        rapport.techniciens.add(self.technicien)

        reponse = self.api(self.technicien).patch(
            f"/api/rapports-eclairage-urgence/{rapport.id}/notes/", {"remarques": "x"}, format="json",
        )

        self.assertEqual(reponse.status_code, 400)

    def test_detail_expose_le_gabarit(self):
        rapport = self.rapport_extincteur()
        self.assertEqual(self.api().get(f"/api/rapports-extincteurs/{rapport.id}/").json()["gabarit"], "sin")

    def test_html_direct_echappe_le_texte_saisi(self):
        rapport = self.rapport_extincteur(items=[{"emplacement": "<script>"}])
        self.assertNotIn("<script>", html_rapport_extincteurs(rapport))
        self.assertIn("NFPA 101", html_rapport_eclairage(
            RapportEclairageUrgence.objects.create(batiment=self.batiment, cree_par=self.superviseur)
        ))


class CorrectionDateGicleurFerme(BaseTest):
    def setUp(self):
        super().setUp()
        module, _ = Module.objects.get_or_create(code="rapport_gicleur", defaults={"nom": "Rapport gicleur"})
        OrganisationModule.objects.update_or_create(organisation=self.organisation, module=module, defaults={"actif": True})

    def test_superviseur_corrige_la_date_sans_aviser_le_client(self):
        rapport = RapportGicleur.objects.create(
            batiment=self.batiment, cree_par=self.superviseur, statut="ferme",
            date_inspection=date(2025, 10, 13), prochaine_inspection=date(2026, 10, 13),
        )

        reponse = self.api().patch(f"/api/rapports-gicleurs/{rapport.id}/", {"date_inspection": "2025-10-14"}, format="json")

        self.assertEqual(reponse.status_code, 200)
        rapport.refresh_from_db()
        self.assertEqual(rapport.date_inspection, date(2025, 10, 14))
        self.assertEqual(rapport.prochaine_inspection, date(2026, 10, 14))
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(rapport.historique.filter(description__startswith="Date d'inspection corrigée").exists())

    def test_technicien_ne_peut_pas_modifier_un_rapport_ferme(self):
        rapport = RapportGicleur.objects.create(
            batiment=self.batiment, cree_par=self.superviseur, statut="ferme", date_inspection=date(2025, 10, 13),
        )
        rapport.techniciens.add(self.technicien)

        reponse = self.api(self.technicien).patch(
            f"/api/rapports-gicleurs/{rapport.id}/", {"date_inspection": "2025-10-14"}, format="json",
        )

        self.assertNotEqual(reponse.status_code, 200)
        rapport.refresh_from_db()
        self.assertEqual(rapport.date_inspection, date(2025, 10, 13))
