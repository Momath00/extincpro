from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0004_certificat_certificat_envoye"),
    ]

    operations = [
        migrations.AddField(
            model_name="fichee2",
            name="details",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    "JSON structuré de toutes les sous-sections E2.1 à E2.12. "
                    "Format : { 'e2_1': { 'localisation': '', 'description': '', "
                    "'items': { 'A': 'oui', 'B': 'sans_objet', ... } }, ... }"
                ),
            ),
        ),
    ]
