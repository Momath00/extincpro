from django.db import migrations, models


def _renommer(apps, ancien, nouveau):
    HotteCuisine = apps.get_model("inspections", "HotteCuisine")
    for hotte in HotteCuisine.objects.all():
        appareils = hotte.appareils or []
        if any(a.get("code") == ancien for a in appareils):
            hotte.appareils = [{**a, "code": nouveau} if a.get("code") == ancien else a for a in appareils]
            hotte.save(update_fields=["appareils"])


def grille_charbon_gc(apps, schema_editor):
    # Grille charbon : code « C » → « GC » (à côté de la nouvelle grille à
    # gaz « GZ »), dans les appareils déjà placés sur les schémas.
    _renommer(apps, "C", "GC")


def retour_c(apps, schema_editor):
    _renommer(apps, "GC", "C")


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0032_photoanomalie_tous_rapports"),
    ]

    operations = [
        migrations.AddField(
            model_name="rapportcuisine",
            name="conforme_recommandations",
            field=models.BooleanField(
                blank=True, default=None, null=True,
                help_text="Décision du technicien (« À cette date, le système... est conforme / nécessite des modifications ») — quand renseignée, remplace le calcul automatique basé sur la checklist pour déterminer la conformité affichée sur le certificat.",
            ),
        ),
        migrations.AddField(
            model_name="hottecuisine",
            name="elevations",
            field=models.JSONField(
                blank=True, default=list,
                help_text="Positions horizontales des conduits d'évacuation verticaux (raccords vers le toit), placés manuellement — [{'x': 250}, ...].",
            ),
        ),
        migrations.AddField(
            model_name="hottecuisine",
            name="tailles",
            field=models.JSONField(
                blank=True, default=list,
                help_text="Petits carrés « taille de hotte » (en pieds) placés à l'intérieur de la hotte — [{'x': 120, 'pieds': 6}, ...].",
            ),
        ),
        migrations.AlterField(
            model_name="hottecuisine",
            name="buses",
            field=models.JSONField(
                blank=True, default=list,
                help_text="Positions horizontales des buses, placées manuellement — [{'x': 120, 'direction': 'gauche'|'droite'}, ...], comme `appareils`. `direction` absente = buse verticale (droit devant).",
            ),
        ),
        migrations.RunPython(grille_charbon_gc, retour_c),
    ]
