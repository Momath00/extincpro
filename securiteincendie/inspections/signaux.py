"""Range chaque rapport dans le cycle d'inspection de son bâtiment dès qu'il
est créé ou planifié (voir dossier.rattacher), et refuse la suppression
d'un rapport qui appartient à un cycle fermé."""

import logging

from django.db.models import QuerySet
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from .models import Rapport, RapportCuisine, RapportEclairageUrgence, RapportExtincteur, RapportGicleur

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Rapport)
@receiver(post_save, sender=RapportExtincteur)
@receiver(post_save, sender=RapportEclairageUrgence)
@receiver(post_save, sender=RapportCuisine)
@receiver(post_save, sender=RapportGicleur)
def ranger_dans_le_cycle(sender, instance, created, raw=False, **kwargs):
    if raw:  # chargement de fixtures
        return
    from .dossier import rattacher

    try:
        rattacher(instance, getattr(instance, "cree_par", None) if created else None)
    except Exception:  # noqa: BLE001 — ne jamais bloquer l'enregistrement d'un rapport
        logger.exception("Rangement du rapport %s #%s dans un cycle impossible", sender.__name__, instance.pk)


MODELES_RAPPORT = (Rapport, RapportExtincteur, RapportEclairageUrgence, RapportCuisine, RapportGicleur)


@receiver(pre_delete, sender=Rapport)
@receiver(pre_delete, sender=RapportExtincteur)
@receiver(pre_delete, sender=RapportEclairageUrgence)
@receiver(pre_delete, sender=RapportCuisine)
@receiver(pre_delete, sender=RapportGicleur)
def proteger_cycle_ferme(sender, instance, origin=None, **kwargs):
    """Un rapport d'un cycle fermé ne se supprime pas directement (preuve en
    cas de litige). La suppression en cascade d'une organisation entière
    (super-admin) reste possible : on ne bloque que la suppression du
    rapport lui-même."""
    supprime_directement = isinstance(origin, MODELES_RAPPORT) or (
        isinstance(origin, QuerySet) and origin.model in MODELES_RAPPORT
    )
    if not supprime_directement or not instance.cycle_id:
        return
    from .dossier import CycleVerrouille

    if instance.cycle.est_ferme:
        raise CycleVerrouille(
            "Ce rapport fait partie d'un cycle d'inspection fermé : il ne peut pas être supprimé. "
            "Rouvrez d'abord le cycle depuis le dossier du bâtiment, en indiquant un motif."
        )
