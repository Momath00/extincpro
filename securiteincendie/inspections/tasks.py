"""Tâches planifiées (Celery Beat — voir CELERY_BEAT_SCHEDULE dans settings.py)."""

from datetime import date, timedelta

from celery import shared_task

JOURS_AVANT_RAPPEL = 30


@shared_task
def envoyer_rappels_inspections() -> int:
    """Exécutée une fois par jour : trouve tous les rapports (des 4 types)
    dont la prochaine inspection tombe dans exactement 30 jours, et avise
    par courriel le citoyen assigné (s'il y en a un) ainsi que tous les
    superviseurs de l'organisation. Comme le champ `prochaine_inspection`
    ne change plus une fois fixé, chaque rapport ne déclenche ce rappel
    qu'une seule fois (le jour où la date cible correspond)."""
    from accounts.models import Utilisateur

    from .emailing import envoyer_rappel_inspection, langue_utilisateur
    from .models import Rapport, RapportCuisine, RapportEclairageUrgence, RapportExtincteur

    cible = date.today() + timedelta(days=JOURS_AVANT_RAPPEL)

    configs = [
        (Rapport, "Réseau d'alarme incendie"),
        (RapportExtincteur, "Extincteurs portatifs"),
        (RapportEclairageUrgence, "Éclairage d'urgence"),
        (RapportCuisine, "Système de cuisine"),
    ]

    total = 0
    for model, label in configs:
        rapports = model.objects.filter(prochaine_inspection=cible).select_related(
            "batiment", "batiment__client", "batiment__client__organisation"
        )
        for rapport in rapports:
            batiment = rapport.batiment
            organisation = batiment.client.organisation

            # Citoyen assigné directement sur le rapport, ou (éclairage/cuisine,
            # qui n'ont pas leur propre citoyen) celui du rapport extincteur lié.
            citoyen = getattr(rapport, "citoyen", None)
            if citoyen is None:
                rapport_extincteur = getattr(rapport, "rapport_extincteur", None)
                citoyen = getattr(rapport_extincteur, "citoyen", None) if rapport_extincteur else None

            if citoyen and citoyen.email:
                envoyer_rappel_inspection(
                    citoyen.email, citoyen.get_full_name() or citoyen.username,
                    False, label, batiment, rapport.prochaine_inspection, langue_utilisateur(citoyen),
                )
                total += 1

            superviseurs = Utilisateur.objects.filter(organisation=organisation, role="superviseur").exclude(email="")
            langue_org = getattr(organisation, "langue", "fr") or "fr"
            for superviseur in superviseurs:
                envoyer_rappel_inspection(
                    superviseur.email, superviseur.get_full_name() or superviseur.username,
                    True, label, batiment, rapport.prochaine_inspection, langue_org,
                )
                total += 1

    return total
