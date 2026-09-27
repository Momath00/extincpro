import uuid

from django.db import migrations, models


def remplir_jetons(apps, schema_editor):
    for nom in ("Certificat", "CertificatGicleur"):
        modele = apps.get_model("inspections", nom)
        for cert in modele.objects.all():
            cert.jeton = uuid.uuid4()
            cert.save(update_fields=["jeton"])


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0035_certificats_visite"),
    ]

    operations = [
        migrations.AddField(model_name="certificat", name="jeton", field=models.UUIDField(null=True, editable=False)),
        migrations.AddField(model_name="certificatgicleur", name="jeton", field=models.UUIDField(null=True, editable=False)),
        migrations.RunPython(remplir_jetons, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="certificat", name="jeton",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, help_text="Identifiant public du QR code de vérification (voir certificats.py)."),
        ),
        migrations.AlterField(
            model_name="certificatgicleur", name="jeton",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, help_text="Identifiant public du QR code de vérification (voir certificats.py)."),
        ),
    ]
