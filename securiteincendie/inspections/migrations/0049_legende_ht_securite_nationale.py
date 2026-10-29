"""L'ancien import de Sécurité Incendie National rangeait le code HT
(détecteur de chaleur non réarmable) de leur légende sous RHT. Quand le
rapport n'a que des dispositifs HT (aucun RHT), la ligne RHT de la légende
est en fait la leur pour HT : on la remet sous HT."""

from django.db import migrations


def remettre_ht(apps, schema_editor):
    FicheLegende = apps.get_model("inspections", "FicheLegende")
    Dispositif = apps.get_model("inspections", "Dispositif")

    for fiche in FicheLegende.objects.filter(rapport__batiment__client__organisation__gabarit_rapports="sin"):
        legende = fiche.dispositifs or {}
        if "RHT" not in legende or "HT" in legende:
            continue
        codes = set(Dispositif.objects.filter(rapport_id=fiche.rapport_id).values_list("type_dispositif", flat=True))
        if "HT" in codes and "RHT" not in codes:
            fiche.dispositifs = {("HT" if code == "RHT" else code): valeur for code, valeur in legende.items()}
            fiche.save(update_fields=["dispositifs"])


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0048_codes_dispositifs_s536"),
    ]

    operations = [
        migrations.RunPython(remettre_ht, migrations.RunPython.noop),
    ]
