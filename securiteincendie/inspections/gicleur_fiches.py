"""Fiches d'inspection des sous-rapports gicleur — reprises de l'Excel
« Rapport inspection vierge.xlsm » (onglets « Gicleur Eau » et
« Gicleur Air »).

Chaque fiche est une liste de sections, chaque section une liste de
champs. La même description sert à l'API (le formulaire écran est
construit à partir d'elle, voir `RapportGicleurViewSet.fiches`), à la
validation des réponses, au calcul des déficiences et au PDF.

Types de champ :
- « question »  : Oui / Non (/ S.O. si `na`) ; `complement` ajoute une valeur sur la ligne
                  (ex. « Signal à … lb/po² »).
- « oui_non »   : Oui / Non informatif (présence d'un équipement).
- « choix »     : une option parmi `options` (`multiple` : plusieurs).
- « texte »     : valeur libre, avec `unite` éventuelle.
- « duree »     : minutes + secondes, stockée {"min": "…", "sec": "…"}.
- « liste »     : lignes libres (ex. emplacements des points bas).
- « texte_long »: notes.

Une section `"disposition": "tableau"` est présentée comme dans l'Excel :
un tableau à deux colonnes, chaque case = intitulé + réponse sur la même
ligne. Sans disposition, les questions occupent toute la largeur.

Tous les champs sont toujours affichés, comme dans l'Excel. `visible_si` =
{"code": …, "valeur": …} reste possible pour masquer un champ tant que
l'autre champ n'a pas cette valeur (aucune fiche ne l'utilise).

Déficiences : une réponse « Non » n'en est PAS une. Le technicien les
écrit dans le champ « Déficiences » de chaque section (`remarques` du
sous-rapport, par code de section), avec les photos de la section.
"""

LB = "lb/po²"


def _q(code, fr, en, na=True, complement=None):
    champ = {"code": code, "type": "question", "fr": fr, "en": en, "na": na}
    if complement:
        champ["complement"] = complement
    return champ


def _t(code, fr, en, unite="", plein=False, **extra):
    return {"code": code, "type": "texte", "fr": fr, "en": en, "unite": unite, "plein": plein, **extra}


def _on(code, fr, en, **extra):
    return {"code": code, "type": "oui_non", "fr": fr, "en": en, **extra}


def _d(code, fr, en, **extra):
    return {"code": code, "type": "duree", "fr": fr, "en": en, **extra}


def _choix(code, fr, en, options, multiple=False):
    return {
        "code": code, "type": "choix", "fr": fr, "en": en, "multiple": multiple,
        "options": [{"v": v, "fr": f, "en": e} for v, f, e in options],
    }


# ── Sections communes aux systèmes sous eau et sous air ─────────────────

SECTION_TUYAUTERIE = {
    "code": "tuyauterie", "fr": "Gicleurs et tuyauterie", "en": "Sprinklers and piping",
    "champs": [
        _q("gicleurs_exempts", "Les gicleurs sont-ils exempts de peinture, corrosion, dommage physique ou obstruction du jet d'eau ?",
           "Are the sprinklers free of paint, corrosion, physical damage or spray obstruction?"),
        _q("degagement_18po", "Un minimum de 18 pouces (45,7 cm) d'espace sous le gicleur est-il maintenu ?",
           "Is a minimum clearance of 18 in. (45.7 cm) maintained below the sprinklers?"),
        _q("moins_50_ans", "Les gicleurs ont-ils moins de 50 ans, donc ne nécessitant pas un examen d'échantillonnage ?",
           "Are the sprinklers less than 50 years old, so that no sample testing is required?"),
        _q("temperature_adequate", "La température des gicleurs est-elle adéquate près des unités de chauffage, etc. ?",
           "Is the sprinkler temperature rating adequate near heating units, etc.?"),
        _q("tuyauterie_bonne_condition", "La tuyauterie semble-t-elle en bonne condition et sans corrosion ?",
           "Does the piping appear to be in good condition and free of corrosion?"),
        _q("supports_sismiques", "Les supports exposés et braquets sismiques sont-ils sans corrosion et sans dommage ?",
           "Are the exposed hangers and seismic braces free of corrosion and damage?"),
        _q("gicleurs_rechange", "Le nombre de gicleurs de rechange est-il suffisant, avec une clé de gicleur en place ?",
           "Is the number of spare sprinklers sufficient, with a sprinkler wrench in place?"),
    ],
}

SECTION_IDENTIFICATION = {
    "code": "identification", "fr": "Identification du système", "en": "System identification", "disposition": "tableau",
    "champs": [
        _t("marque", "Marque", "Brand"),
        _t("modele", "Modèle", "Model"),
        _t("diametre", "Diamètre", "Diameter", unite="po"),
        _t("no_serie", "N° de série", "Serial no."),
        _t("annee_fabrication", "Année de fabrication", "Year of manufacture"),
        _choix("vanne_principale", "Vanne principale", "Main valve", [
            ("papillon", "Papillon", "Butterfly"),
            ("osy", "OS & Y", "OS & Y"),
            ("piv", "PIV", "PIV"),
            ("autre", "Autre", "Other"),
        ]),
        _t("emplacement", "Emplacement", "Location"),
        _t("zone_protegee", "Zone protégée", "Protected area"),
        _t("pression_systeme", "Pression du système", "System pressure", unite=LB),
        _d("temps_alarme", "Temps pour l'alarme", "Time to alarm"),
        _q("pression_air_amorce", "Pression d'air et niveau d'amorce normaux ?", "Normal air pressure and priming water level?"),
        _q("plaque_calcul_hydraulique", "Plaque signalétique du calcul hydraulique présente ?",
           "Hydraulic calculation nameplate present?", na=False),
        _t("localisation_essai_inspecteur", "Localisation de l'essai d'inspecteur", "Inspector's test location", plein=True),
    ],
}

SECTION_ECOULEMENT = {
    "code": "ecoulement", "fr": "Essai d'écoulement (avec drain principal)", "en": "Main drain flow test", "disposition": "tableau",
    "champs": [
        _choix("alimentation_eau", "Alimentation d'eau", "Water supply", [
            ("ville", "Ville", "City"),
            ("pompe", "Pompe incendie", "Fire pump"),
            ("reservoir", "Réservoir", "Tank"),
            ("autre_systeme", "Autre système", "Other system"),
        ], multiple=True),
        _t("diametre_drain", "Diamètre", "Diameter", unite="po"),
        _t("pression_statique", "Pression statique", "Static pressure", unite=LB),
        _t("pression_residuelle", "Pression résiduelle", "Residual pressure", unite=LB),
    ],
}

SECTION_ALARMES = {
    "code": "alarmes", "fr": "Essai d'alarmes", "en": "Alarm tests",
    "champs": [
        _q("cloche_hydraulique", "L'essai de la cloche hydraulique est-il satisfaisant ?", "Is the water motor gong test satisfactory?"),
        _q("cloche_electrique", "L'essai de la cloche électrique est-il satisfaisant ?", "Is the electric bell test satisfactory?"),
        _q("alarme_basse_pression", "L'essai de l'alarme de basse pression est-il satisfaisant ?",
           "Is the low pressure alarm test satisfactory?",
           complement={"code": "signal_basse_pression", "fr": "Signal à", "en": "Signal at", "unite": LB}),
        _q("supervision_vanne_principale", "La supervision de la vanne principale est-elle satisfaisante ?",
           "Is the main valve supervision satisfactory?"),
        _q("supervision_panneau", "Les essais des dispositifs de supervision sont-ils indiqués au panneau d'alarme ?",
           "Are the supervisory device tests indicated at the alarm panel?"),
        _q("tamis_nettoye", "Le tamis de la ligne d'alarme a-t-il été nettoyé ?", "Has the alarm line strainer been cleaned?"),
    ],
}

SECTION_INFO_SUPPLEMENTAIRE = {
    "code": "information", "fr": "Information supplémentaire", "en": "Additional information",
    "champs": [
        _q("soupape_alarme_fonctionne", "La soupape d'alarme a-t-elle bien fonctionné ?", "Did the alarm valve operate properly?"),
        _q("systeme_remis_operation", "Le système a-t-il été remis en opération ?", "Was the system returned to service?"),
    ],
}

SECTION_NOTES = {
    "code": "notes", "fr": "Notes", "en": "Notes",
    "champs": [{"code": "notes", "type": "texte_long", "fr": "Notes", "en": "Notes"}],
}


# ── Système sous eau ────────────────────────────────────────────────────

SECTION_POMPE_SURPRESSION = {
    "code": "pompe_surpression", "fr": "Pompe de surpression", "en": "Jockey pump", "disposition": "tableau",
    "champs": [
        _on("pompe_presente", "Pompe de surpression présente ?", "Jockey pump present?"),
        _choix("pompe_mode", "Mode", "Mode", [
            ("manuelle", "Manuelle", "Manual"),
            ("automatique", "Automatique", "Automatic"),
        ]),
        _t("pompe_pression_arrivee", "Pression du système (en arrivant)", "System pressure (on arrival)", unite=LB),
        _t("pompe_pression_demarrage", "Pression de démarrage", "Start pressure", unite=LB),
        _t("pompe_pression_arret", "Pression d'arrêt", "Stop pressure", unite=LB),
        _d("pompe_delai", "Délai pour rétablir la pression", "Time to restore pressure"),
        _q("pompe_bon_fonctionnement", "Bon fonctionnement ?", "Operating properly?"),
    ],
}


# ── Système sous air ────────────────────────────────────────────────────

SECTION_DECLENCHEMENT = {
    "code": "declenchement", "fr": "Essai de déclenchement", "en": "Trip test", "disposition": "tableau",
    "champs": [
        _on("essai_declenchement", "Essai de déclenchement effectué ?", "Trip test performed?"),
        _on("essai_inondation", "Essai avec inondation ?", "Full flow trip test?"),
        _t("decl_pression_eau", "Pression d'eau", "Water pressure", unite=LB),
        _t("decl_pression_air", "Pression d'air", "Air pressure", unite=LB),
        _t("decl_declenchement_a", "Déclenchement à", "Tripped at", unite=LB),
        _t("decl_pression_air_apres", "Pression d'air au déclenchement", "Air pressure at trip", unite=LB),
        _t("decl_pression_eau_apres", "Pression d'eau au déclenchement", "Water pressure at trip", unite=LB),
        _d("decl_temps", "Temps de déclenchement", "Trip time"),
        _d("decl_temps_inondation", "Temps d'écoulement à l'essai d'inspecteur", "Water delivery time at inspector's test"),
    ],
}

SECTION_OUVERTURE_RAPIDE = {
    "code": "ouverture_rapide", "fr": "Dispositif d'ouverture rapide", "en": "Quick-opening device", "disposition": "tableau",
    "champs": [
        _on("dor_present", "Dispositif d'ouverture rapide présent ?", "Quick-opening device present?"),
        _t("dor_marque", "Marque", "Brand"),
        _t("dor_modele", "Modèle", "Model"),
        _t("dor_annee", "Année de fabrication", "Year of manufacture"),
        _t("dor_no_serie", "N° de série", "Serial no."),
        _t("dor_pression_air", "Pression d'air", "Air pressure", unite=LB),
        _t("dor_declenchement_a", "Déclenchement à", "Tripped at", unite=LB),
        _q("dor_fonctionnement", "Fonctionnement satisfaisant ?", "Satisfactory operation?"),
        _q("dor_remis_operation", "Dispositif remis en opération ?", "Device returned to service?"),
    ],
}

SECTION_COMPRESSEUR = {
    "code": "compresseur", "fr": "Compresseur d'air", "en": "Air compressor", "disposition": "tableau",
    "champs": [
        _on("compresseur_present", "Compresseur d'air présent ?", "Air compressor present?"),
        _on("regulateur_present", "Régulateur d'air présent ?", "Air maintenance device present?"),
        _t("compresseur_marque", "Marque", "Brand"),
        _t("compresseur_modele", "Modèle", "Model"),
        _t("compresseur_pression_demarrage", "Pression de démarrage", "Start pressure", unite=LB),
        _t("compresseur_pression_arret", "Pression d'arrêt", "Stop pressure", unite=LB),
        _d("compresseur_delai", "Délai pour rétablir la pression dans le système", "Time to restore system pressure"),
        _q("compresseur_reservoir", "Réservoir vérifié et satisfaisant ?", "Tank checked and satisfactory?"),
        _q("compresseur_huile", "Niveau d'huile vérifié et satisfaisant ?", "Oil level checked and satisfactory?"),
        _q("compresseur_etat", "En bon état de fonctionnement ?", "In good working order?"),
    ],
}

SECTION_POINTS_BAS = {
    "code": "points_bas", "fr": "Points bas", "en": "Low points",
    "champs": [{"code": "points_bas", "type": "liste", "fr": "Emplacement", "en": "Location"}],
}


# ── Dispositifs anti-refoulement (onglets D.A.R.P.R. et D.A.R.2.C.R.) ────
# Rapport d'essais et d'inspection selon CAN/CSA-B64.10 — un rapport par
# dispositif, comme dans l'Excel.

KPA = "kPa"
UNITE_PRESSION = _choix("unite_pression", "Unité de pression", "Pressure unit", [
    ("lb", "lb/po²", "psi"),
    ("kpa", "kPa", "kPa"),
])

SECTION_DAR_IDENTIFICATION = {
    "code": "dar_identification", "fr": "Dispositif anti-refoulement", "en": "Backflow prevention device",
    "disposition": "tableau",
    "champs": [
        _t("dar_emplacement", "Emplacement du dispositif (bâtiment / local)", "Device location (building / room)", plein=True),
        _t("dar_systeme", "Installé sur le système", "Installed on system"),
        _t("dar_date_essai", "Date de l'essai", "Test date"),
        _t("dar_marque", "Marque", "Brand"),
        _t("dar_modele", "Modèle", "Model"),
        _t("dar_no_serie", "N° de série", "Serial no."),
        _t("dar_diametre", "Diamètre", "Diameter", unite="po"),
        _choix("dar_orientation", "Installation", "Installation", [
            ("vertical", "Verticale", "Vertical"),
            ("horizontal", "Horizontale", "Horizontal"),
        ]),
        _choix("dar_type_essai", "Type d'essai", "Test type", [
            ("initial", "Initial", "Initial"),
            ("annuel", "Annuel", "Annual"),
            ("remplacement", "Remplacement", "Replacement"),
        ]),
    ],
}

SECTION_DAR_INSPECTION = {
    "code": "dar_inspection", "fr": "Inspection de l'installation", "en": "Installation inspection",
    "champs": [
        _q("dar_q1", "1. Le dispositif est-il accessible ? (article 6.1.1)", "1. Is the device accessible? (clause 6.1.1)"),
        _q("dar_q2", "2. Le dispositif est-il installé selon l'article 6.1.2 (de 750 mm à 1500 mm du centre du dispositif) ?",
           "2. Is the device installed per clause 6.1.2 (750 mm to 1500 mm to the centre of the device)?"),
        _q("dar_q3", "3. Le dégagement minimum au-dessus de 300 mm (12 pouces) est-il respecté ?",
           "3. Is the minimum clearance of 300 mm (12 in.) above respected?"),
        _q("dar_q4", "4. La distance de 750 mm est-elle respectée devant le dispositif ?", "4. Is the 750 mm clearance in front of the device respected?"),
        _q("dar_q5", "5. La distance de 20 mm est-elle respectée derrière le dispositif ?", "5. Is the 20 mm clearance behind the device respected?"),
        _q("dar_q6", "6. Le dispositif est-il supporté ou retenu correctement afin d'empêcher tout mouvement latéral ? (article 6.1.3)",
           "6. Is the device properly supported to prevent any lateral movement? (clause 6.1.3)"),
        _q("dar_q7", "7. Existe-t-il une dérivation sur ce dispositif ?", "7. Is there a bypass on this device?"),
        _q("dar_q8", "8. Dans l'affirmative, cette dérivation est-elle protégée par un dispositif équivalent ? (article 6.1.4)",
           "8. If so, is the bypass protected by an equivalent device? (clause 6.1.4)"),
        _q("dar_q9", "9. Le dimensionnement du dispositif est-il conforme aux recommandations du fabricant ? (article 6.2)",
           "9. Is the device sized according to the manufacturer's recommendations? (clause 6.2)"),
        _q("dar_q10", "10. Le raccordement au drainage est-il conforme ? (article 6.8)", "10. Is the drain connection compliant? (clause 6.8)"),
        _q("dar_q11", "11. Les robinets d'arrêt ont-ils été remis en fonction ?", "11. Were the shutoff valves returned to service?"),
    ],
}

SECTION_DAR_OBSERVATION = {
    "code": "dar_observation", "fr": "Observation", "en": "Observation",
    "champs": [{"code": "dar_observation", "type": "texte_long", "fr": "Observation", "en": "Observation"}],
}

SECTION_DAR_VERIFICATEUR = {
    "code": "dar_verificateur", "fr": "Vérificateur agréé", "en": "Certified tester",
    "disposition": "tableau",
    "note_fr": "Je certifie avoir mis à l'essai le dispositif décrit ci-dessus conformément à la norme CAN/CSA-B64.10.",
    "note_en": "I certify that I tested the device described above in accordance with CAN/CSA-B64.10.",
    "champs": [
        _t("dar_verif_nom", "Nom du vérificateur agréé", "Certified tester name"),
        _t("dar_verif_certificat", "Numéro de certificat", "Certificate number"),
        _t("dar_trousse_modele", "Trousse d'essai — modèle", "Test kit — model"),
        _t("dar_trousse_serie", "Trousse d'essai — série", "Test kit — serial"),
        _t("dar_raison_sociale", "Raison sociale", "Company name"),
        _t("dar_telephone", "Téléphone", "Phone"),
    ],
}

# D.A.R.P.R. — dispositif anti-refoulement à pression réduite.
SECTION_DARPR_CLAPETS = {
    "code": "darpr_clapets", "fr": "Essais des clapets de retenue", "en": "Check valve tests",
    "disposition": "tableau",
    "champs": [
        UNITE_PRESSION,
        _on("darpr_c1_libre", "Clapet #1 — libre écoulement", "Check #1 — free flow"),
        _on("darpr_c2_libre", "Clapet #2 — libre écoulement", "Check #2 — free flow"),
        _on("darpr_c1_etanche", "Clapet #1 — fermeture étanche en contre-sens", "Check #1 — tight closure (reverse)"),
        _on("darpr_c2_etanche", "Clapet #2 — fermeture étanche en contre-sens", "Check #2 — tight closure (reverse)"),
        _t("darpr_c1_pression", "Pression différentielle dans le 1er clapet", "Differential pressure, check #1"),
        _t("darpr_c2_pression", "Pression différentielle dans le 2e clapet", "Differential pressure, check #2"),
    ],
}

SECTION_DARPR_SOUPAPE = {
    "code": "darpr_soupape", "fr": "Soupape de décharge à pression différentielle", "en": "Differential pressure relief valve",
    "disposition": "tableau",
    "champs": [
        _t("darpr_soupape_diff", "Pression différentielle du clapet #1", "Check #1 differential pressure"),
        _t("darpr_soupape_ouverture", "Point d'ouverture de la soupape de décharge", "Relief valve opening point"),
        _t("darpr_tampon", "Tampon (3 psi et plus)", "Buffer (3 psi or more)"),
    ],
}

SECTION_DARPR_ROBINETS = {
    "code": "darpr_robinets", "fr": "Essai #3 — Robinets d'arrêt", "en": "Test #3 — Shutoff valves",
    "disposition": "tableau",
    "champs": [
        _q("darpr_robinet1", "Fermeture étanche du robinet d'arrêt #1", "Shutoff valve #1 tight closure"),
        _q("darpr_robinet2", "Fermeture étanche du robinet d'arrêt #2", "Shutoff valve #2 tight closure"),
    ],
}

SECTION_DARPR_STATIQUE = {
    "code": "darpr_statique", "fr": "Essai #4 — Pression statique", "en": "Test #4 — Static pressure",
    "disposition": "tableau",
    "champs": [
        _t("darpr_pression_reseau", "Pression du réseau au cours de l'essai", "Line pressure during test"),
        _choix("darpr_resultat", "Résultat de l'essai", "Test result", [
            ("reussite", "Réussite", "Pass"),
            ("echec", "Échec", "Fail"),
        ]),
    ],
}

# D.A.R.2.C.R. — dispositif anti-refoulement à deux clapets de retenue et robinets.
SECTION_DAR2CR_CLAPETS = {
    "code": "dar2cr_clapets", "fr": "Essais des clapets de retenue", "en": "Check valve tests",
    "disposition": "tableau",
    "champs": [
        UNITE_PRESSION,
        _t("dar2cr_c1_pression", "Clapet #1 — pression diff. AB (5 min)", "Check #1 — AB differential (5 min)"),
        _t("dar2cr_c2_pression", "Clapet #2 — pression diff. AB (5 min)", "Check #2 — AB differential (5 min)"),
        _on("dar2cr_c1_libre", "Clapet #1 — libre écoulement", "Check #1 — free flow"),
        _on("dar2cr_c2_libre", "Clapet #2 — libre écoulement", "Check #2 — free flow"),
        _on("dar2cr_c1_etanche", "Clapet #1 — fermeture étanche en contre-sens", "Check #1 — tight closure (reverse)"),
        _on("dar2cr_c2_etanche", "Clapet #2 — fermeture étanche en contre-sens", "Check #2 — tight closure (reverse)"),
    ],
}

SECTION_DAR2CR_STATIQUE = {
    "code": "dar2cr_statique", "fr": "Essai #3 — Pression statique", "en": "Test #3 — Static pressure",
    "disposition": "tableau",
    "champs": [
        _t("dar2cr_pression_reseau", "Pression du réseau au cours de l'essai", "Line pressure during test"),
        _choix("dar2cr_resultat", "Résultat de l'essai", "Test result", [
            ("reussite", "Réussite", "Pass"),
            ("echec", "Échec", "Fail"),
        ]),
    ],
}

SECTION_DAR2CR_ROBINETS = {
    "code": "dar2cr_robinets", "fr": "Robinets d'isolement du dispositif", "en": "Device isolation valves",
    "disposition": "tableau",
    "champs": [
        _on("dar2cr_robinet1", "Fermeture étanche du robinet #1", "Valve #1 tight closure"),
        _on("dar2cr_robinet2", "Fermeture étanche du robinet #2", "Valve #2 tight closure"),
    ],
}

SECTION_DAR2CR_ADMISSION = {
    "code": "dar2cr_admission", "fr": "Soupape d'admission d'air et clapet de retenue", "en": "Air inlet valve and check valve",
    "disposition": "tableau",
    "champs": [
        _on("dar2cr_soupape_defaillance", "Soupape d'admission d'air — défaillance d'ouverture", "Air inlet valve — failed to open"),
        _t("dar2cr_soupape_ouverture", "Soupape d'admission d'air — ouverture à", "Air inlet valve — opened at", unite=LB),
        _on("dar2cr_clapet_defaillance", "Clapet de retenue — défaillance d'ouverture", "Check valve — failed to open"),
        _t("dar2cr_clapet_ouverture", "Clapet de retenue — ouverture à", "Check valve — opened at", unite=LB),
    ],
}


FICHES = {
    "eau": {
        "fr": "Système sous eau", "en": "Wet-pipe system",
        "titre_pdf_fr": "Gicleur à eau", "titre_pdf_en": "Wet-pipe sprinkler",
        "sections": [
            SECTION_TUYAUTERIE, SECTION_IDENTIFICATION, SECTION_ECOULEMENT, SECTION_ALARMES,
            SECTION_POMPE_SURPRESSION, SECTION_INFO_SUPPLEMENTAIRE, SECTION_NOTES,
        ],
    },
    "air": {
        "fr": "Système sous air", "en": "Dry-pipe system",
        "titre_pdf_fr": "Gicleur à air", "titre_pdf_en": "Dry-pipe sprinkler",
        "sections": [
            SECTION_TUYAUTERIE, SECTION_IDENTIFICATION, SECTION_ECOULEMENT, SECTION_DECLENCHEMENT,
            SECTION_OUVERTURE_RAPIDE, SECTION_ALARMES, SECTION_INFO_SUPPLEMENTAIRE, SECTION_COMPRESSEUR,
            SECTION_POINTS_BAS, SECTION_NOTES,
        ],
    },
    "darpr": {
        "fr": "Dispositif anti-refoulement à pression réduite", "en": "Reduced pressure backflow preventer",
        "titre_pdf_fr": "Dispositif anti-refoulement à pression réduite (D.A.R.P.R.)",
        "titre_pdf_en": "Reduced pressure backflow preventer (RP)",
        "sections": [
            SECTION_DAR_IDENTIFICATION, SECTION_DAR_INSPECTION, SECTION_DARPR_CLAPETS, SECTION_DARPR_SOUPAPE,
            SECTION_DARPR_ROBINETS, SECTION_DARPR_STATIQUE, SECTION_DAR_OBSERVATION, SECTION_DAR_VERIFICATEUR,
        ],
    },
    "dar2cr": {
        "fr": "Dispositif anti-refoulement à deux clapets", "en": "Double check valve assembly",
        "titre_pdf_fr": "Dispositif anti-refoulement à deux clapets de retenue (D.A.R.2.C.R.)",
        "titre_pdf_en": "Double check valve assembly (DCVA)",
        "sections": [
            SECTION_DAR_IDENTIFICATION, SECTION_DAR_INSPECTION, SECTION_DAR2CR_CLAPETS, SECTION_DAR2CR_STATIQUE,
            SECTION_DAR2CR_ROBINETS, SECTION_DAR2CR_ADMISSION, SECTION_DAR_OBSERVATION, SECTION_DAR_VERIFICATEUR,
        ],
    },
}


# ── Outils ──────────────────────────────────────────────────────────────

def champs_de_la_fiche(type_fiche: str) -> dict:
    """{code: champ} — y compris les compléments de question."""
    out = {}
    for section in FICHES[type_fiche]["sections"]:
        for champ in section["champs"]:
            out[champ["code"]] = champ
            if champ.get("complement"):
                out[champ["complement"]["code"]] = {**champ["complement"], "type": "texte"}
    return out


def section_de(type_fiche: str, code_section: str):
    return next((s for s in FICHES[type_fiche]["sections"] if s["code"] == code_section), None)


def est_visible(champ: dict, reponses: dict) -> bool:
    condition = champ.get("visible_si")
    return not condition or reponses.get(condition["code"]) == condition["valeur"]


def valider_valeur(champ: dict, valeur):
    """Lève ValueError si la valeur ne convient pas au type du champ.
    `None` ou "" efface la réponse."""
    if valeur in (None, ""):
        return
    genre = champ["type"]
    if genre == "question":
        permises = {"oui", "non", "na"} if champ.get("na") else {"oui", "non"}
        if valeur not in permises:
            raise ValueError("Réponse invalide.")
    elif genre == "oui_non":
        if valeur not in ("oui", "non"):
            raise ValueError("Réponse invalide.")
    elif genre == "choix":
        permises = {o["v"] for o in champ["options"]}
        if champ.get("multiple"):
            if not isinstance(valeur, list) or not set(valeur) <= permises:
                raise ValueError("Choix invalide.")
        elif valeur not in permises:
            raise ValueError("Choix invalide.")
    elif genre == "duree":
        if not isinstance(valeur, dict) or set(valeur) - {"min", "sec"}:
            raise ValueError("Durée invalide.")
        if any(len(str(v)) > 10 for v in valeur.values()):
            raise ValueError("Durée invalide.")
    elif genre == "liste":
        if not isinstance(valeur, list) or not all(isinstance(x, str) and len(x) <= 300 for x in valeur) or len(valeur) > 200:
            raise ValueError("Liste invalide.")
    elif genre in ("texte", "texte_long"):
        if not isinstance(valeur, str) or len(valeur) > (5000 if genre == "texte_long" else 300):
            raise ValueError("Texte invalide.")


# Sections de texte libre : pas de champ « Déficiences » ni de photos.
SECTIONS_SANS_DEFICIENCES = {"notes", "dar_observation"}


def sections_avec_deficiences(type_fiche: str) -> set[str]:
    """Sections qui ont un champ « Déficiences » (toutes sauf les notes)."""
    return {s["code"] for s in FICHES[type_fiche]["sections"] if s["code"] not in SECTIONS_SANS_DEFICIENCES}


def deficiences_sous_rapport(sous_rapport) -> list[dict]:
    """Une déficience par section dont le champ « Déficiences » est rempli,
    dans l'ordre de la fiche."""
    remarques = sous_rapport.remarques or {}
    return [
        {"section": s["code"], "section_fr": s["fr"], "section_en": s["en"], "remarque": remarques[s["code"]]}
        for s in FICHES[sous_rapport.type_fiche]["sections"]
        if s["code"] not in SECTIONS_SANS_DEFICIENCES and (remarques.get(s["code"]) or "").strip()
    ]


def progression_sous_rapport(sous_rapport) -> tuple[int, int]:
    """(répondus, total) des questions et Oui/Non visibles — même calcul
    que la barre d'avancement à l'écran."""
    reponses = sous_rapport.reponses or {}
    champs = [
        c for s in FICHES[sous_rapport.type_fiche]["sections"] for c in s["champs"]
        if c["type"] in ("question", "oui_non") and est_visible(c, reponses)
    ]
    return sum(1 for c in champs if reponses.get(c["code"])), len(champs)


def libelle_sous_rapport(sous_rapport, langue: str = "fr") -> str:
    titre = FICHES[sous_rapport.type_fiche]["en" if langue == "en" else "fr"]
    if sous_rapport.numero_systeme:
        titre += f" — {'system' if langue == 'en' else 'système'} n° {sous_rapport.numero_systeme}"
    return titre


def libelle_section(type_fiche: str, code_section: str, langue: str = "fr") -> str:
    section = section_de(type_fiche, code_section)
    if section is None:
        return ""
    return section["en" if langue == "en" else "fr"]


# ── Section optionnelle « Débits et valves » (onglet de l'Excel) ─────────
# Ce n'est pas une fiche de système : c'est une section du rapport qu'on
# ajoute seulement si on en a besoin. Stockée dans
# `RapportGicleur.debits_valves` = {"lignes": [...], "deficiences": "…"}
# (null = section non ajoutée).

DEBITS_VALVES = {
    "code": "debits_valves", "fr": "Débits et valves", "en": "Flow switches and valves",
    "colonnes": [
        {"code": "zone", "fr": "Zone #", "en": "Zone #"},
        {"code": "endroit", "fr": "Endroit protégé", "en": "Protected area"},
        {"code": "emplacement", "fr": "Emplacement du commutateur", "en": "Switch location"},
        {"code": "type", "fr": "Type de commutateur", "en": "Switch type"},
        {"code": "marque", "fr": "Marque", "en": "Brand"},
        {"code": "modele", "fr": "Modèle / dimension (po)", "en": "Model / size (in.)"},
        {"code": "signal", "fr": "Signal", "en": "Signal", "type": "oui_non"},
        {"code": "temps", "fr": "Temps", "en": "Time"},
    ],
}
CODES_DEBITS_VALVES = {c["code"] for c in DEBITS_VALVES["colonnes"]}
MAX_LIGNES_DEBITS_VALVES = 300


def valider_debits_valves(valeur):
    """None = section retirée ; sinon {"lignes": [{…}], "deficiences": "…"}.
    Lève ValueError si la forme ne convient pas."""
    if valeur is None:
        return
    if not isinstance(valeur, dict) or set(valeur) - {"lignes", "deficiences"}:
        raise ValueError("Objet {lignes, deficiences} attendu.")
    lignes = valeur.get("lignes", [])
    if not isinstance(lignes, list) or len(lignes) > MAX_LIGNES_DEBITS_VALVES:
        raise ValueError("Lignes invalides.")
    for ligne in lignes:
        if not isinstance(ligne, dict) or set(ligne) - CODES_DEBITS_VALVES:
            raise ValueError("Colonne inconnue.")
        for code, texte in ligne.items():
            if code == "signal":
                if texte not in ("", "oui", "non"):
                    raise ValueError("Signal invalide.")
            elif not isinstance(texte, str) or len(texte) > 150:
                raise ValueError(f"Valeur invalide : {code}.")
    deficiences = valeur.get("deficiences", "")
    if not isinstance(deficiences, str) or len(deficiences) > 3000:
        raise ValueError("Déficiences invalides.")


def deficiences_debits_valves(rapport) -> list[dict]:
    """Même forme que `deficiences_sous_rapport` (sous_rapport = None)."""
    section = rapport.debits_valves
    texte = ((section or {}).get("deficiences") or "").strip()
    if not texte:
        return []
    return [{
        "section": DEBITS_VALVES["code"], "section_fr": DEBITS_VALVES["fr"], "section_en": DEBITS_VALVES["en"],
        "remarque": texte, "sous_rapport": None,
    }]


# ── Infos et identification du bâtiment (onglets « Client » et
#    « Identification » de l'Excel) ──────────────────────────────────────
# Partie du rapport lui-même (pas une fiche de système), stockée dans
# `RapportGicleur.identification` = {"reponses": {…}, "remarques": {…}}.
# Les infos propres au bâtiment (panneau, mots de passe, code de porte,
# « rapport soumis à ») sont reprises du rapport précédent du bâtiment.

SECTION_ID_INFOS = {
    "code": "id_infos", "fr": "Infos inspection", "en": "Inspection information", "disposition": "tableau",
    "champs": [
        _t("id_soumis_contact", "Rapport soumis à — contact", "Report submitted to — contact"),
        _t("id_soumis_infos", "Rapport soumis à — infos contact", "Report submitted to — contact details"),
        _t("id_soumis_adresse", "Rapport soumis à — adresse", "Report submitted to — address", plein=True),
    ],
}

SECTION_ID_PANNEAU = {
    "code": "id_panneau", "fr": "Fiche d'identification", "en": "Identification sheet", "disposition": "tableau",
    "champs": [
        _t("id_panneau_modele", "Modèle de panneau incendie", "Fire alarm panel model"),
        _choix("id_panneau_type", "Panneau", "Panel", [
            ("adressable", "Adressable", "Addressable"),
            ("conventionnel", "Conventionnel", "Conventional"),
        ]),
        _t("id_panneau_mdp", "Mot de passe du panneau", "Panel password"),
        _t("id_panneau_emplacement", "Emplacement du panneau principal", "Main panel location"),
        _t("id_contournement", "Liste de contournement du panneau", "Panel bypass list", plein=True),
        _t("id_central", "Centrale d'alarme et mot de passe", "Monitoring station and password", plein=True),
        _on("id_reseau", "Système en réseau (connecté à un autre bâtiment) ?", "Networked system (connected to another building)?"),
        _t("id_reseau_combien", "Combien de bâtiments ?", "How many buildings?"),
        _t("id_code_porte", "Code de porte ou lock box", "Door code or lock box", plein=True),
    ],
}

SECTION_ID_GENERALITES = {
    "code": "id_generalites", "fr": "Généralités", "en": "General",
    "champs": [
        _q("id_occupe", "L'immeuble est-il occupé ?", "Is the building occupied?"),
        _q("id_en_fonction", "Le système est-il en fonction ?", "Is the system in service?"),
        _q("id_chauffes", "Les endroits protégés par le système sous eau sont-ils chauffés ?",
           "Are the areas protected by the wet-pipe system heated?"),
        _q("id_salle_degagee", "L'entrée de la salle des gicleurs ou les environs des valves sont-ils adéquatement dégagés, entretenus et chauffés ?",
           "Is the sprinkler room entrance or valve area adequately clear, maintained and heated?"),
    ],
}

SECTION_ID_RACCORD = {
    "code": "id_raccord", "fr": "Raccord pompier", "en": "Fire department connection",
    "champs": [
        _q("id_raccord_accessible", "Sont-ils accessibles, visibles et libres de toute obstruction ?",
           "Are they accessible, visible and free of any obstruction?"),
        _q("id_raccord_capuchons", "Les capuchons sont-ils en place et les raccords tournent-ils librement ?",
           "Are the caps in place and do the swivels turn freely?"),
        _q("id_raccord_clapet", "Le clapet de retenue est-il étanche et la soupape à bille fonctionne-t-elle ?",
           "Is the check valve tight and does the ball drip work?"),
    ],
}

SECTION_ID_VERIFICATION = {
    "code": "id_verification", "fr": "Vérification finale", "en": "Final check",
    "champs": [
        _q("id_vannes_position", "Les vannes de contrôle sont-elles laissées en position appropriée (ouvertes et fermées) ?",
           "Are the control valves left in the proper position (open and closed)?"),
        _q("id_panneau_fonction", "Le panneau d'alarme incendie est-il en fonction ?", "Is the fire alarm panel in service?"),
    ],
}

SECTION_ID_NOTES = {
    "code": "id_notes", "fr": "Notes", "en": "Notes",
    "champs": [{"code": "id_notes", "type": "texte_long", "fr": "Notes", "en": "Notes"}],
}

FICHE_IDENTIFICATION = {
    "fr": "Infos et identification du bâtiment", "en": "Building information and identification",
    "sections": [SECTION_ID_INFOS, SECTION_ID_PANNEAU, SECTION_ID_GENERALITES, SECTION_ID_RACCORD,
                 SECTION_ID_VERIFICATION, SECTION_ID_NOTES],
}

# Infos propres au BÂTIMENT : reprises du rapport précédent du même bâtiment.
IDENTIFICATION_A_REPRENDRE = {
    c["code"] for s in (SECTION_ID_INFOS, SECTION_ID_PANNEAU) for c in s["champs"]
}
SECTIONS_IDENTIFICATION_SANS_DEFICIENCES = {"id_infos", "id_notes"}
SECTIONS_IDENTIFICATION_AVEC_DEFICIENCES = {
    s["code"] for s in FICHE_IDENTIFICATION["sections"] if s["code"] not in SECTIONS_IDENTIFICATION_SANS_DEFICIENCES
}


def _champs_identification() -> dict:
    return {c["code"]: c for s in FICHE_IDENTIFICATION["sections"] for c in s["champs"]}


def valider_identification(valeur):
    """{"reponses": {code: valeur}, "remarques": {code de section: texte}} —
    lève ValueError si un code ou une valeur ne convient pas."""
    if not isinstance(valeur, dict) or set(valeur) - {"reponses", "remarques"}:
        raise ValueError("Objet {reponses, remarques} attendu.")
    champs = _champs_identification()
    for code, v in (valeur.get("reponses") or {}).items():
        if code not in champs:
            raise ValueError(f"Champ inconnu : {code}.")
        valider_valeur(champs[code], v)
    for code, v in (valeur.get("remarques") or {}).items():
        if code not in SECTIONS_IDENTIFICATION_AVEC_DEFICIENCES or (v not in (None, "") and (not isinstance(v, str) or len(v) > 3000)):
            raise ValueError(f"Déficiences invalides : {code}.")


def fusionner_identification(actuelle, nouvelle) -> dict:
    """Fusion clé par clé (une valeur vide efface), comme pour les fiches."""
    resultat = {"reponses": dict((actuelle or {}).get("reponses") or {}), "remarques": dict((actuelle or {}).get("remarques") or {})}
    for cle in ("reponses", "remarques"):
        for code, v in ((nouvelle or {}).get(cle) or {}).items():
            if v in (None, "", []):
                resultat[cle].pop(code, None)
            else:
                resultat[cle][code] = v
    return resultat


def deficiences_identification(rapport) -> list[dict]:
    remarques = (rapport.identification or {}).get("remarques") or {}
    return [
        {"section": s["code"], "section_fr": s["fr"], "section_en": s["en"], "remarque": remarques[s["code"]], "sous_rapport": None}
        for s in FICHE_IDENTIFICATION["sections"]
        if s["code"] in SECTIONS_IDENTIFICATION_AVEC_DEFICIENCES and (remarques.get(s["code"]) or "").strip()
    ]


def identification_reprise(batiment, sauf=None) -> dict:
    """Infos du bâtiment reprises du rapport gicleur le plus récent de ce
    bâtiment qui en a (panneau, mots de passe, code de porte…)."""
    from .models import RapportGicleur

    precedents = RapportGicleur.objects.filter(batiment=batiment).exclude(pk=getattr(sauf, "pk", None)).order_by("-date_creation")
    for precedent in precedents:
        reponses = (precedent.identification or {}).get("reponses") or {}
        reprises = {k: v for k, v in reponses.items() if k in IDENTIFICATION_A_REPRENDRE}
        if reprises:
            return {"reponses": reprises, "remarques": {}}
    return {"reponses": {}, "remarques": {}}
