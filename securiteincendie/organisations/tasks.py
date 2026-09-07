"""Tâches planifiées (Celery Beat — voir CELERY_BEAT_SCHEDULE dans settings.py)."""

from datetime import date, timedelta

from celery import shared_task

JOURS_AVANT_FIN_ESSAI = 7


@shared_task
def envoyer_avis_fin_essai_organisations() -> int:
    """Exécutée une fois par jour : trouve les organisations actives dont
    l'essai gratuit se termine dans exactement 7 jours, et avise par
    courriel chaque superviseur de l'organisation."""
    from accounts.models import Utilisateur
    from .emailing import envoyer_avis_fin_essai
    from .models import Organisation

    cible = date.today() + timedelta(days=JOURS_AVANT_FIN_ESSAI)
    organisations = Organisation.objects.filter(date_fin_essai=cible, est_active=True)

    total = 0
    for organisation in organisations:
        langue = organisation.langue or "fr"
        superviseurs = Utilisateur.objects.filter(
            organisation=organisation, role="superviseur", est_actif=True
        ).exclude(email="")
        for superviseur in superviseurs:
            envoyer_avis_fin_essai(
                superviseur.email,
                superviseur.get_full_name() or superviseur.username,
                organisation.nom,
                organisation.date_fin_essai,
                langue,
            )
            total += 1
    return total
