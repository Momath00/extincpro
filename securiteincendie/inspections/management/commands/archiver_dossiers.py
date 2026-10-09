"""Fige les rapports fermés et les certificats émis qui n'ont pas encore de
copie archivée (rapports fermés avant la mise en place du dossier).

    python manage.py archiver_dossiers

Sans effet sur ce qui est déjà archivé : une copie identique n'est jamais
dupliquée (même empreinte).
"""

from django.core.management.base import BaseCommand

from inspections import dossier as D
from inspections.models import CertificatExtincteur
from inspections.models_dossier import ArchiveDocument


class Command(BaseCommand):
    help = "Archive les rapports fermés et certificats émis sans copie figée."

    def handle(self, *args, **options):
        nb_rapports = nb_certificats = 0
        for module, modele in D._modeles().items():
            deja = set(
                ArchiveDocument.objects.filter(module=module, type_document="rapport").values_list("rapport_id", flat=True)
            )
            for rapport_id in modele.objects.filter(statut="ferme").exclude(pk__in=deja).values_list("pk", flat=True):
                D.archiver_rapport(module, rapport_id, None)
                nb_rapports += 1
        for cert_id in CertificatExtincteur.objects.filter(statut="emis").exclude(html_fige="").values_list("pk", flat=True):
            D.archiver_certificat_visite(cert_id, None)
            nb_certificats += 1
        self.stdout.write(self.style.SUCCESS(
            f"{nb_rapports} rapport(s) archivé(s), {nb_certificats} certificat(s) vérifié(s)."
        ))
