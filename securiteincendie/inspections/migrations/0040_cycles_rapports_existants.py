"""Range les rapports existants dans des cycles d'inspection.

Même règle que `dossier.cycle_pour` : un cycle couvre 365 jours à partir de
sa première inspection. Les cycles dont la période est terminée et dont tous
les rapports sont fermés sont fermés (verrouillés) ; les autres restent
ouverts. Les brouillons générés automatiquement (prochaine visite pas encore
planifiée) restent sans cycle.
"""

from datetime import timedelta

from django.db import migrations
from django.utils import timezone

MODELES = ["Rapport", "RapportExtincteur", "RapportEclairageUrgence", "RapportCuisine", "RapportGicleur"]
DUREE = 365


def ranger(apps, schema_editor):
    Batiment = apps.get_model("inspections", "Batiment")
    Cycle = apps.get_model("inspections", "CycleInspection")
    Evenement = apps.get_model("inspections", "EvenementCycle")
    modeles = {nom: apps.get_model("inspections", nom) for nom in MODELES}
    aujourdhui = timezone.localdate()

    for bat in Batiment.objects.all().iterator():
        rapports = []
        for nom, modele in modeles.items():
            for r in modele.objects.filter(batiment_id=bat.id, cycle__isnull=True):
                brouillon = bool(getattr(r, "rapport_precedent_id", None)) and r.date_inspection is None and r.statut == "ouvert"
                if brouillon:
                    continue
                jour = r.date_inspection or timezone.localtime(r.date_creation).date()
                rapports.append((jour, nom, r))
        if not rapports:
            continue
        rapports.sort(key=lambda x: (x[0], x[1], x[2].pk))

        cycles = []  # [cycle, [rapports]]
        for jour, nom, r in rapports:
            cible = None
            for entree in cycles:
                c = entree[0]
                if c.date_debut <= jour <= c.date_debut + timedelta(days=DUREE - 1):
                    cible = entree
            if cible is None:
                c = Cycle.objects.create(batiment_id=bat.id, annee=jour.year, date_debut=jour)
                Evenement.objects.create(
                    cycle=c, type_evenement="ouverture",
                    description=f"Cycle {jour.year} créé à la mise en place du dossier (rapports existants)",
                )
                cible = [c, []]
                cycles.append(cible)
            modeles[nom].objects.filter(pk=r.pk).update(cycle=cible[0])
            cible[1].append(r)

        for c, contenus in cycles:
            periode_finie = c.date_debut + timedelta(days=DUREE) <= aujourdhui
            if periode_finie and all(r.statut == "ferme" for r in contenus):
                c.statut = "ferme"
                c.date_fermeture = timezone.now()
                c.note_fermeture = "Fermé automatiquement à la mise en place du dossier (période terminée, rapports fermés)."
                c.save()
                Evenement.objects.create(
                    cycle=c, type_evenement="fermeture",
                    description=f"Cycle {c.annee} fermé et verrouillé à la mise en place du dossier (période terminée)",
                )


def defaire(apps, schema_editor):
    for nom in MODELES:
        apps.get_model("inspections", nom).objects.update(cycle=None)
    apps.get_model("inspections", "CycleInspection").objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0039_dossier_batiment"),
    ]

    operations = [
        migrations.RunPython(ranger, defaire),
    ]
