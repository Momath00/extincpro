from django.db import migrations, models


def migrer_annonce_vers_statut(apps, schema_editor):
    Dispositif = apps.get_model("inspections", "Dispositif")
    Dispositif.objects.filter(annonce_confirmee=True).update(annonce_statut="I")
    Dispositif.objects.filter(annonce_confirmee=False).update(annonce_statut="D")


def migrer_statut_vers_annonce(apps, schema_editor):
    Dispositif = apps.get_model("inspections", "Dispositif")
    Dispositif.objects.filter(annonce_statut="D").update(annonce_confirmee=False)
    Dispositif.objects.exclude(annonce_statut="D").update(annonce_confirmee=True)


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0005_fiche_e2_details"),
    ]

    operations = [
        migrations.AddField(
            model_name="dispositif",
            name="annonce_statut",
            field=models.CharField(
                choices=[("D", "Défectueux"), ("I", "Inspecté"), ("NI", "Non inspecté")],
                default="NI",
                max_length=2,
            ),
        ),
        migrations.RunPython(migrer_annonce_vers_statut, migrer_statut_vers_annonce),
        migrations.RemoveField(
            model_name="dispositif",
            name="annonce_confirmee",
        ),
    ]
