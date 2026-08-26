from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0003_resumesommaire_etageresume"),
    ]

    operations = [
        migrations.AddField(
            model_name="certificat",
            name="certificat_envoye",
            field=models.BooleanField(
                default=False,
                help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
            ),
        ),
    ]
