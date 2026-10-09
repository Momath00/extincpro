"""Cycles d'inspection : rangement automatique, période, fermeture et verrou."""

from datetime import date

from django.db import transaction
from rest_framework.exceptions import ValidationError

from inspections import dossier as D
from inspections.models import RapportExtincteur
from inspections.models_dossier import CycleInspection

from .fabrique import BaseTest


class RangementAutomatique(BaseTest):
    def test_un_rapport_cree_ouvre_un_cycle_a_sa_date_d_inspection(self):
        r = self.rapport_extincteur(jour=date(2026, 3, 15))
        self.assertIsNotNone(r.cycle)
        self.assertEqual(r.cycle.date_debut, date(2026, 3, 15))
        self.assertEqual(r.cycle.annee, 2026)
        self.assertEqual(r.cycle.statut, CycleInspection.Statut.OUVERT)

    def test_deux_rapports_de_la_meme_periode_partagent_le_cycle(self):
        r1 = self.rapport_extincteur(jour=date(2026, 3, 15))
        r2 = self.rapport_extincteur(jour=date(2026, 9, 1))
        self.assertEqual(r1.cycle_id, r2.cycle_id)

    def test_un_rapport_apres_365_jours_ouvre_un_nouveau_cycle(self):
        r1 = self.rapport_extincteur(jour=date(2026, 3, 15))
        r2 = self.rapport_extincteur(jour=date(2027, 3, 15))
        self.assertNotEqual(r1.cycle_id, r2.cycle_id)
        self.assertEqual(self.batiment.cycles.count(), 2)

    def test_le_dernier_jour_de_la_periode_reste_dans_le_cycle(self):
        r1 = self.rapport_extincteur(jour=date(2026, 3, 15))
        r2 = self.rapport_extincteur(jour=date(2027, 3, 14))
        self.assertEqual(r1.cycle_id, r2.cycle_id)

    def test_chaque_batiment_a_ses_propres_cycles(self):
        autre = self.creer_batiment()
        r1 = self.rapport_extincteur()
        r2 = self.rapport_extincteur(batiment=autre)
        self.assertNotEqual(r1.cycle_id, r2.cycle_id)

    def test_le_brouillon_automatique_reste_hors_cycle_tant_qu_il_n_est_pas_planifie(self):
        precedent = self.fermer(self.rapport_extincteur(jour=date(2026, 3, 15)))
        brouillon = precedent.brouillon_suivant
        self.assertIsNone(brouillon.cycle_id)

        brouillon.date_inspection = date(2027, 3, 20)
        brouillon.save()
        brouillon.refresh_from_db()
        self.assertIsNotNone(brouillon.cycle_id)
        self.assertNotEqual(brouillon.cycle_id, precedent.cycle_id)

    def test_un_rapport_ajoute_est_inscrit_au_journal_du_cycle(self):
        r = self.rapport_extincteur()
        self.assertTrue(r.cycle.evenements.filter(type_evenement="rapport").exists())


class FermetureEtVerrou(BaseTest):
    def test_on_ne_peut_pas_clore_un_cycle_avec_un_rapport_ouvert(self):
        r = self.rapport_extincteur()
        with self.assertRaises(ValidationError):
            D.fermer_cycle(r.cycle, self.superviseur)

    def test_cycle_clos_quand_tous_les_rapports_sont_fermes(self):
        r = self.fermer(self.rapport_extincteur())
        cycle = D.fermer_cycle(r.cycle, self.superviseur, "Inspection terminée")
        self.assertTrue(cycle.est_ferme)
        self.assertEqual(cycle.ferme_par, self.superviseur)
        self.assertTrue(cycle.evenements.filter(type_evenement="fermeture").exists())

    def test_un_rapport_d_un_cycle_clos_ne_peut_pas_etre_rouvert(self):
        r = self.fermer(self.rapport_extincteur())
        D.fermer_cycle(r.cycle, self.superviseur)
        r.refresh_from_db()
        with self.assertRaises(D.CycleVerrouille):
            r.rouvrir(self.superviseur)

    def test_un_rapport_d_un_cycle_clos_ne_peut_pas_etre_supprime(self):
        r = self.fermer(self.rapport_extincteur())
        D.fermer_cycle(r.cycle, self.superviseur)
        r.refresh_from_db()
        # La suppression refusée annule sa transaction : on l'isole dans un bloc.
        with self.assertRaises(D.CycleVerrouille), transaction.atomic():
            r.delete()
        self.assertTrue(RapportExtincteur.objects.filter(pk=r.pk).exists())

    def test_rouvrir_un_cycle_exige_un_motif(self):
        r = self.fermer(self.rapport_extincteur())
        cycle = D.fermer_cycle(r.cycle, self.superviseur)
        with self.assertRaises(ValidationError):
            D.rouvrir_cycle(cycle, self.superviseur, "abc")
        D.rouvrir_cycle(cycle, self.superviseur, "Correction demandée par le client")
        cycle.refresh_from_db()
        self.assertFalse(cycle.est_ferme)
        evenement = cycle.evenements.get(type_evenement="reouverture")
        self.assertIn("Correction demandée par le client", evenement.description)

    def test_apres_reouverture_du_cycle_le_rapport_peut_etre_rouvert(self):
        r = self.fermer(self.rapport_extincteur())
        cycle = D.fermer_cycle(r.cycle, self.superviseur)
        D.rouvrir_cycle(cycle, self.superviseur, "Erreur de saisie")
        r.refresh_from_db()
        r.rouvrir(self.superviseur)
        r.refresh_from_db()
        self.assertEqual(r.statut, "ouvert")


class OuvertureManuelle(BaseTest):
    def test_ouvrir_un_cycle_a_une_date_precise(self):
        cycle = D.ouvrir_cycle(self.batiment, self.superviseur, date(2030, 1, 10))
        self.assertEqual(cycle.date_debut, date(2030, 1, 10))
        self.assertTrue(cycle.evenements.filter(type_evenement="ouverture").exists())

    def test_pas_deux_cycles_ouverts_sur_la_meme_periode(self):
        D.ouvrir_cycle(self.batiment, self.superviseur, date(2030, 1, 10))
        with self.assertRaises(ValidationError):
            D.ouvrir_cycle(self.batiment, self.superviseur, date(2030, 6, 1))

    def test_un_rapport_dans_la_periode_rejoint_le_cycle_ouvert_a_la_main(self):
        cycle = D.ouvrir_cycle(self.batiment, self.superviseur, date(2030, 1, 10))
        r = self.rapport_extincteur(jour=date(2030, 2, 1))
        self.assertEqual(r.cycle_id, cycle.id)
