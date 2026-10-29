"""Active le gabarit Sécurité Incendie National pour leur organisation et
range dans les nouvelles colonnes ce que l'import Excel avait mis dans les
champs existants :

- extincteurs : « Dernière inspection : 2024 · Dernière recharge : XX … »
  dans `remarque` → derniere_inspection / derniere_recharge / dernier_test_hydrostatique ;
- éclairage : « LUMACELL ES — batterie RS POWER » dans `modele` → fabricant /
  dispositif / modele (batterie) ;
- « Remarques du rapport Excel : … » de l'historique → champ `remarques`."""

import re

from django.db import migrations

SLUG = "securite-national"
PREFIXE_HISTORIQUE = "Remarques du rapport Excel : "
CHAMPS_ANNEES = {
    "Dernière inspection": "derniere_inspection",
    "Dernière recharge": "derniere_recharge",
    "Dernier test hydro": "dernier_test_hydrostatique",
}
DISPOSITIFS = ("TS", "TD", "UE", "UE-TS", "UE-TD", "ES", "ES-TS", "ES-TD")


def convertir(apps, schema_editor):
    Organisation = apps.get_model("organisations", "Organisation")
    ExtincteurItem = apps.get_model("inspections", "ExtincteurItem")
    EclairageUrgenceItem = apps.get_model("inspections", "EclairageUrgenceItem")
    RapportExtincteur = apps.get_model("inspections", "RapportExtincteur")

    organisation = Organisation.objects.filter(slug=SLUG).first()
    if organisation is None:
        return
    organisation.gabarit_rapports = "sin"
    organisation.save(update_fields=["gabarit_rapports"])

    for item in ExtincteurItem.objects.filter(rapport__batiment__client__organisation=organisation):
        gardees, modifie = [], False
        for partie in [p for p in item.remarque.split(" · ") if p]:
            libelle, _, valeur = partie.partition(" : ")
            champ = CHAMPS_ANNEES.get(libelle)
            if champ is None:
                gardees.append(partie)
                continue
            modifie = True
            if re.fullmatch(r"\d{4}", valeur.strip()):
                setattr(item, champ, valeur.strip())
            elif valeur.strip().upper() != "XX":
                gardees.append(partie)
        if modifie:
            item.remarque = " · ".join(gardees)
            item.save(update_fields=["remarque", *CHAMPS_ANNEES.values()])

    for item in EclairageUrgenceItem.objects.filter(
        rapport__batiment__client__organisation=organisation, fabricant="", dispositif=""
    ).exclude(modele=""):
        appareil, _, batterie = item.modele.partition(" — batterie ")
        mots = appareil.split()
        if mots and mots[-1].upper() in DISPOSITIFS:
            item.dispositif = mots.pop().upper()
        item.fabricant = " ".join(mots)[:100]
        item.modele = batterie.strip()
        item.save(update_fields=["fabricant", "dispositif", "modele"])

    for rapport in RapportExtincteur.objects.filter(batiment__client__organisation=organisation, remarques=""):
        note = rapport.historique.filter(description__startswith=PREFIXE_HISTORIQUE).first()
        if note is not None:
            rapport.remarques = note.description[len(PREFIXE_HISTORIQUE):]
            rapport.save(update_fields=["remarques"])


class Migration(migrations.Migration):

    dependencies = [
        ("inspections", "0046_gabarit_securite_nationale"),
        ("organisations", "0013_gabarit_securite_nationale"),
    ]

    operations = [
        migrations.RunPython(convertir, migrations.RunPython.noop),
    ]
