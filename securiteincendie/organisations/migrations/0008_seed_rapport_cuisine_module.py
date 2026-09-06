from django.db import migrations

CODE = "rapport_cuisine"
NOM = "Rapport cuisine"
DESCRIPTION = "Vérification du système fixe d'extinction de cuisine (hotte, ULC ORD 1254.6 / ULC 300) — appareils protégés, liens fusibles, buses, cylindres."

ORG_PAR_DEFAUT = "Extincteurs Nationex"


def seed(apps, schema_editor):
    Organisation = apps.get_model("organisations", "Organisation")
    Module = apps.get_model("organisations", "Module")
    OrganisationModule = apps.get_model("organisations", "OrganisationModule")

    module, _ = Module.objects.get_or_create(
        code=CODE, defaults={"nom": NOM, "description": DESCRIPTION}
    )

    # Toutes les organisations existantes reçoivent la ligne (désactivée par
    # défaut) — chacune l'active elle-même depuis le panneau super-admin.
    for organisation in Organisation.objects.all():
        OrganisationModule.objects.get_or_create(
            organisation=organisation, module=module, defaults={"actif": False}
        )

    OrganisationModule.objects.filter(
        organisation__nom=ORG_PAR_DEFAUT, module=module
    ).update(actif=True)


def unseed(apps, schema_editor):
    Module = apps.get_model("organisations", "Module")
    Module.objects.filter(code=CODE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("organisations", "0007_organisation_langue"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
