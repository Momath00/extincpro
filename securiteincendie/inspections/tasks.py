"""Tâches planifiées (Celery Beat — voir CELERY_BEAT_SCHEDULE dans settings.py)."""

from datetime import date, timedelta

from celery import shared_task

# Préavis de rappel selon la taille du bâtiment (nombre d'extincteurs) — un
# gros bâtiment demande plus de temps pour coordonner la visite qu'un petit.
# None (bâtiment sans encore de rapport extincteurs) retombe sur le défaut.
JOURS_AVANT_RAPPEL_PAR_TAILLE = {
    "petit": 30,
    "moyen": 45,
    "gros": 60,
}
JOURS_AVANT_RAPPEL_DEFAUT = 30


@shared_task
def envoyer_rappels_inspections() -> int:
    """Exécutée une fois par jour : trouve tous les rapports (des 4 types)
    dont la prochaine inspection tombe dans exactement N jours — N dépendant
    de la taille du bâtiment (`Batiment.taille`, déduite du nombre d'extincteurs)
    — et avise par courriel le citoyen assigné (s'il y en a un) ainsi que tous
    les superviseurs de l'organisation. Comme le champ `prochaine_inspection`
    ne change plus une fois fixé, chaque rapport ne déclenche ce rappel
    qu'une seule fois (le jour où la date cible correspond)."""
    from accounts.models import Utilisateur

    from .emailing import envoyer_rappel_inspection
    from .models import Rapport, RapportCuisine, RapportEclairageUrgence, RapportExtincteur
    from .views import destinataire_client_du_rapport

    aujourdhui = date.today()
    delai_max = max(JOURS_AVANT_RAPPEL_PAR_TAILLE.values())

    configs = [
        (Rapport, "Réseau d'alarme incendie"),
        (RapportExtincteur, "Extincteurs portatifs"),
        (RapportEclairageUrgence, "Éclairage d'urgence"),
        (RapportCuisine, "Système de cuisine"),
    ]

    total = 0
    for model, label in configs:
        rapports = model.objects.filter(
            prochaine_inspection__gt=aujourdhui,
            prochaine_inspection__lte=aujourdhui + timedelta(days=delai_max),
        ).select_related("batiment", "batiment__client", "batiment__client__organisation")

        for rapport in rapports:
            batiment = rapport.batiment
            jours_avant = JOURS_AVANT_RAPPEL_PAR_TAILLE.get(batiment.taille, JOURS_AVANT_RAPPEL_DEFAUT)
            if (rapport.prochaine_inspection - aujourdhui).days != jours_avant:
                continue

            organisation = batiment.client.organisation

            # Citoyen assigné (compte portail) en priorité, sinon le contact
            # du Client (compagnie) déjà saisi à sa création — aucun compte
            # séparé n'est nécessaire pour recevoir ce rappel.
            nom_client, email_client, langue_client = destinataire_client_du_rapport(rapport)

            if email_client:
                envoyer_rappel_inspection(
                    email_client, nom_client,
                    False, label, batiment, rapport.prochaine_inspection, langue_client, jours_avant,
                )
                total += 1

            superviseurs = Utilisateur.objects.filter(organisation=organisation, role="superviseur").exclude(email="")
            langue_org = getattr(organisation, "langue", "fr") or "fr"
            for superviseur in superviseurs:
                envoyer_rappel_inspection(
                    superviseur.email, superviseur.get_full_name() or superviseur.username,
                    True, label, batiment, rapport.prochaine_inspection, langue_org, jours_avant,
                )
                total += 1

    return total
