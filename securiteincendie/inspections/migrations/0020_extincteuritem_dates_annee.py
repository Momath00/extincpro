from django.db import migrations, models


def extraire_annees(apps, schema_editor):
    """Copie l'année (YYYY) des anciennes dates vers les nouveaux champs texte.

    Les étiquettes d'extincteurs n'indiquent que l'année de fabrication et
    l'année des prochaines échéances — pas le jour ni le mois. On ne perd donc
    aucune information utile en ne conservant que l'année ici."""
    ExtincteurItem = apps.get_model("inspections", "ExtincteurItem")
    for it in ExtincteurItem.objects.all():
        it.date_fabrication = str(it.date_fabrication_old.year) if it.date_fabrication_old else ""
        it.prochaine_maintenance = str(it.prochaine_maintenance_old.year) if it.prochaine_maintenance_old else ""
        it.prochain_test_hydrostatique = (
            str(it.prochain_test_hydrostatique_old.year) if it.prochain_test_hydrostatique_old else ""
        )
        it.save(update_fields=["date_fabrication", "prochaine_maintenance", "prochain_test_hydrostatique"])


def restaurer_dates(apps, schema_editor):
    """Reverse : reconstruit une date au 1er janvier de l'année conservée."""
    from datetime import date

    ExtincteurItem = apps.get_model("inspections", "ExtincteurItem")
    for it in ExtincteurItem.objects.all():
        it.date_fabrication_old = date(int(it.date_fabrication), 1, 1) if it.date_fabrication else None
        it.prochaine_maintenance_old = date(int(it.prochaine_maintenance), 1, 1) if it.prochaine_maintenance else None
        it.prochain_test_hydrostatique_old = (
            date(int(it.prochain_test_hydrostatique), 1, 1) if it.prochain_test_hydrostatique else None
        )
        it.save(update_fields=["date_fabrication_old", "prochaine_maintenance_old", "prochain_test_hydrostatique_old"])


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0019_boyauitem"),
    ]

    operations = [
        migrations.RenameField("extincteuritem", "date_fabrication", "date_fabrication_old"),
        migrations.RenameField("extincteuritem", "prochaine_maintenance", "prochaine_maintenance_old"),
        migrations.RenameField("extincteuritem", "prochain_test_hydrostatique", "prochain_test_hydrostatique_old"),
        migrations.AddField("extincteuritem", "date_fabrication", models.CharField(max_length=4, blank=True, default="")),
        migrations.AddField("extincteuritem", "prochaine_maintenance", models.CharField(max_length=4, blank=True, default="")),
        migrations.AddField(
            "extincteuritem", "prochain_test_hydrostatique", models.CharField(max_length=4, blank=True, default="")
        ),
        migrations.RunPython(extraire_annees, restaurer_dates),
        migrations.RemoveField("extincteuritem", "date_fabrication_old"),
        migrations.RemoveField("extincteuritem", "prochaine_maintenance_old"),
        migrations.RemoveField("extincteuritem", "prochain_test_hydrostatique_old"),
        migrations.AlterField("extincteuritem", "date_fabrication", models.CharField(max_length=4, blank=True)),
        migrations.AlterField("extincteuritem", "prochaine_maintenance", models.CharField(max_length=4, blank=True)),
        migrations.AlterField(
            "extincteuritem", "prochain_test_hydrostatique", models.CharField(max_length=4, blank=True)
        ),
    ]
