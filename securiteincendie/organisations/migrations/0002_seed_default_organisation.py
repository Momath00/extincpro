from django.db import migrations
from django.utils.text import slugify

MODULES = [
    ("rapport_incendie", "Rapport d'inspection incendie", "Inspection annuelle du réseau avertisseur d'incendie (fiches E1/E2/E3, certificat)."),
    ("rapport_extincteur", "Rapport extincteur", "Vérification annuelle des extincteurs portatifs."),
]

ORG_PAR_DEFAUT = "Extincteurs Nationex"


def seed(apps, schema_editor):
    Organisation = apps.get_model("organisations", "Organisation")
    Module = apps.get_model("organisations", "Module")
    OrganisationModule = apps.get_model("organisations", "OrganisationModule")
    Utilisateur = apps.get_model("accounts", "Utilisateur")

    organisation, _ = Organisation.objects.get_or_create(
        nom=ORG_PAR_DEFAUT,
        defaults={"slug": slugify(ORG_PAR_DEFAUT), "est_active": True},
    )

    for code, nom, description in MODULES:
        module, _ = Module.objects.get_or_create(
            code=code, defaults={"nom": nom, "description": description}
        )
        OrganisationModule.objects.get_or_create(
            organisation=organisation, module=module, defaults={"actif": True}
        )

    Utilisateur.objects.filter(organisation__isnull=True).update(organisation=organisation)


def unseed(apps, schema_editor):
    Organisation = apps.get_model("organisations", "Organisation")
    Organisation.objects.filter(nom=ORG_PAR_DEFAUT).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("organisations", "0001_initial"),
        ("accounts", "0002_utilisateur_organisation_alter_utilisateur_role"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
