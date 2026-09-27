import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


def remplir_jetons(apps, schema_editor):
    CertificatExtincteur = apps.get_model("inspections", "CertificatExtincteur")
    for cert in CertificatExtincteur.objects.all():
        cert.jeton = uuid.uuid4()
        cert.save(update_fields=["jeton"])


def rattacher_existants(apps, schema_editor):
    """Bâtiment des certificats existants + certificat pour les rapports
    cuisine/éclairage SEULS déjà fermés (avant, ils n'en avaient pas). Leur
    contenu est figé à la première consultation (certificats.figer_si_absent)."""
    CertificatExtincteur = apps.get_model("inspections", "CertificatExtincteur")
    RapportCuisine = apps.get_model("inspections", "RapportCuisine")
    RapportEclairageUrgence = apps.get_model("inspections", "RapportEclairageUrgence")

    for cert in CertificatExtincteur.objects.filter(batiment__isnull=True, rapport__isnull=False):
        cert.batiment_id = cert.rapport.batiment_id
        cert.save(update_fields=["batiment"])

    def prochain_numero(annee):
        prefixe = f"CERT-EXT-{annee}-"
        dernier = CertificatExtincteur.objects.filter(numero__startswith=prefixe).order_by("-numero").first()
        compte = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
        return f"{prefixe}{compte:04d}"

    for modele, champ in ((RapportCuisine, "rapport_cuisine"), (RapportEclairageUrgence, "rapport_eclairage")):
        for rapport in modele.objects.filter(statut="ferme", rapport_extincteur__isnull=True):
            if CertificatExtincteur.objects.filter(**{champ: rapport}).exists():
                continue
            emission = rapport.date_fermeture or django.utils.timezone.now()
            CertificatExtincteur.objects.create(
                **{champ: rapport},
                batiment_id=rapport.batiment_id,
                numero=prochain_numero(emission.year),
                date_emission=emission,
                statut="emis",
                regroupement="visite",
                jeton=uuid.uuid4(),
                certificat_envoye=rapport.rapport_envoye,
                mode_envoi="direct" if rapport.rapport_envoye else "",
                date_envoi=rapport.date_envoi,
                envoye_a=rapport.envoye_a,
                emis_par_id=rapport.cree_par_id,
            )


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0034_envoi_direct_rapports_non_lies"),
        ("organisations", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ParametresCertificat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mode_emission", models.CharField(choices=[("auto", "Automatique à la fermeture"), ("manuel", "Manuelle (le superviseur valide)")], default="auto", max_length=10)),
                ("regroupement", models.CharField(choices=[("visite", "Un certificat par visite"), ("systeme", "Un certificat par système")], default="visite", max_length=10)),
                ("systemes_absents", models.CharField(choices=[("afficher_so", "Afficher en S.O."), ("masquer", "Masquer la ligne")], default="masquer", max_length=12)),
                ("ajustement_manuel", models.BooleanField(default=True)),
                ("non_conformite", models.CharField(choices=[("certificat", "Certificat « non conforme »"), ("avis", "Avis de non-conformité")], default="certificat", max_length=12)),
                ("prefixe_numero", models.CharField(default="CERT-EXT", max_length=16)),
                ("afficher_qr", models.BooleanField(default=True)),
                ("signataire_nom", models.CharField(blank=True, max_length=150)),
                ("signataire_titre", models.CharField(blank=True, max_length=150)),
                ("signature", models.TextField(blank=True, help_text="Image de la signature (data URI PNG/JPEG).")),
                ("normes_citees", models.CharField(blank=True, default="NFPA 10 · ULC S508 · ULC ORD 1254.6 · ULC 300 · CSA C22.2 N° 141", max_length=300)),
                ("texte_legal", models.TextField(blank=True)),
                ("date_modification", models.DateTimeField(auto_now=True)),
                ("organisation", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="parametres_certificat", to="organisations.organisation")),
            ],
        ),
        migrations.AlterField(
            model_name="certificatextincteur",
            name="rapport",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="certificat", to="inspections.rapportextincteur"),
        ),
        migrations.AlterField(
            model_name="certificatextincteur",
            name="date_emission",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="rapport_cuisine",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="certificat", to="inspections.rapportcuisine"),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="rapport_eclairage",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="certificat", to="inspections.rapporteclairageurgence"),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="batiment",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="certificats_visite", to="inspections.batiment"),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="regroupement",
            field=models.CharField(default="visite", help_text="Réglage de l'organisation à la création — « visite » : couvre aussi les rapports liés.", max_length=10),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="statut",
            field=models.CharField(choices=[("brouillon", "Brouillon"), ("emis", "Émis")], default="emis", max_length=10),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="type_document",
            field=models.CharField(choices=[("certificat", "Certificat"), ("avis", "Avis de non-conformité")], default="certificat", max_length=12),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="revision",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="ajustements",
            field=models.JSONField(blank=True, default=dict, help_text="Statuts ajustés à la main par ligne — {systeme: {statut, raison, par, par_nom, date}}."),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="conforme",
            field=models.BooleanField(blank=True, help_text="Conformité à la dernière émission.", null=True),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="lignes",
            field=models.JSONField(blank=True, default=list, help_text="Lignes à la dernière émission."),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="html_fige",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="empreinte",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="certificatextincteur",
            name="jeton",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(remplir_jetons, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="certificatextincteur",
            name="jeton",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.CreateModel(
            name="RevisionCertificat",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("revision", models.PositiveIntegerField(default=0)),
                ("numero_affiche", models.CharField(max_length=40)),
                ("type_document", models.CharField(default="certificat", max_length=12)),
                ("conforme", models.BooleanField(default=True)),
                ("lignes", models.JSONField(blank=True, default=list)),
                ("html", models.TextField()),
                ("empreinte", models.CharField(blank=True, max_length=64)),
                ("date_emission", models.DateTimeField(default=django.utils.timezone.now)),
                ("remplacee_le", models.DateTimeField(blank=True, null=True)),
                ("certificat", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revisions", to="inspections.certificatextincteur")),
                ("emis_par", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-revision"],
                "unique_together": {("certificat", "revision")},
            },
        ),
        migrations.RunPython(rattacher_existants, migrations.RunPython.noop),
        migrations.RemoveField(model_name="rapportcuisine", name="rapport_envoye"),
        migrations.RemoveField(model_name="rapportcuisine", name="date_envoi"),
        migrations.RemoveField(model_name="rapportcuisine", name="envoye_a"),
        migrations.RemoveField(model_name="rapporteclairageurgence", name="rapport_envoye"),
        migrations.RemoveField(model_name="rapporteclairageurgence", name="date_envoi"),
        migrations.RemoveField(model_name="rapporteclairageurgence", name="envoye_a"),
    ]
