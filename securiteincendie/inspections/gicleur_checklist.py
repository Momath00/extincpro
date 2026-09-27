"""
Structure de la checklist du rapport Gicleur (inspection annuelle NFPA 13) —
reprise telle quelle du module gicleur du projet Préventex, qui l'a transcrite
du formulaire papier d'origine.

Chaque item : (code, section, titre_section, label, type_reponse)
  type_reponse : "choix" (Oui / S.O. / Non) ou "texte" (réponse libre).

Sections numérotées comme sur le formulaire papier (1, "Identification", et
"Valve d'étage supervisé" n'apparaissent pas ici — ce sont des tableaux à part,
pas des questions Oui/S.O/Non, voir les modèles dédiés dans models.py).
"""

SECTIONS = [
    ("2", "Soupapes de commande"),
    ("3", "Alimentation en eau (essais hydrauliques)"),
    ("4", "Général"),
    ("5", "Raccords-pompiers"),
    ("6", "Gicleurs"),
    ("7", "Chute à déchets"),
    ("8", "Avertisseurs"),
    ("9", "Tuyauterie, manomètres, pompes de surpression"),
    ("10", "Installation spéciale"),
    ("11", "Installation sous air"),
]

CHECKLIST_GICLEUR = [
    # 2 — Soupapes de commande (3 items)
    ("2a", "2", "Soupapes de commande", "Toutes les soupapes sont en position appropriée ?", "choix"),
    ("2b", "2", "Soupapes de commande", "Toutes les soupapes de commande sont en bonne condition ?", "choix"),
    ("2c", "2", "Soupapes de commande", "Toutes les soupapes de commande ont été lubrifiés et vérifiés ?", "choix"),

    # 3 — Alimentation en eau (essais hydrauliques)
    ("3a", "3", "Alimentation en eau (essais hydrauliques)", "Test au robinet d'essai de l'inspecteur ?", "choix"),
    ("3b", "3", "Alimentation en eau (essais hydrauliques)", "Alimentation de la ville ?", "choix"),
    ("3c", "3", "Alimentation en eau (essais hydrauliques)", "Alimentation de la pompe incendie ?", "choix"),
    ("3d", "3", "Alimentation en eau (essais hydrauliques)", "Alimentation autre ?", "choix"),

    # 4 — Général (11 items)
    ("4a", "4", "Général", "Immeuble occupé ?", "choix"),
    ("4b", "4", "Général", "Même affectation qu'à la dernière vérification ?", "choix"),
    ("4c", "4", "Général", "Toutes les installations sont en service ?", "choix"),
    ("4d", "4", "Général", "Tous les réseaux d'incendie sont les mêmes qu'à la dernière vérification ?", "choix"),
    ("4e", "4", "Général", "Risque entièrement protégé par des extincteurs automatiques à eau ?", "choix"),
    ("4f", "4", "Général", "Toutes les nouvelles annexes et modifications de l'immeuble sont dûment protégées ?", "choix"),
    ("4g", "4", "Général", "Tous les logements sont accessibles et ont été vérifiés ?", "choix"),
    ("4h", "4", "Général", "Les enseignes pour la signalisation et l'identification du système de gicleurs sont apposées ?", "choix"),
    ("4i", "4", "Général", "Stock placé convenablement sous le réseau de distribution des extincteurs ?", "choix"),
    ("4j", "4", "Général", "Avis du client d'aucun incendie depuis la dernière vérification ?", "choix"),
    ("4k", "4", "Général", "Dans les secteurs protégés par des extincteurs sous eau, le chauffage est approprié, tant pour les greniers dissimulés que pour les secteurs environnants, et toutes les ouvertures sont protégées du froid ?", "choix"),

    # 5 — Raccords-pompiers (3 items)
    ("5a", "5", "Raccords-pompiers", "Les raccords-pompiers (gicleurs) sont en condition satisfaisante, les raccords malléables, les bouchons en place ?", "choix"),
    ("5b", "5", "Raccords-pompiers", "Le clapet de retenue et la soupape bille sont en condition satisfaisante ?", "choix"),
    ("5c", "5", "Raccords-pompiers", "Localisation du raccord-pompiers (gicleurs) ?", "choix"),

    # 6 — Gicleurs (13 items)
    ("6a", "6", "Gicleurs", "Nombre approximatif de gicleurs ?", "choix"),
    ("6b", "6", "Gicleurs", "Des gicleurs supplémentaires sont immédiatement disponibles ?", "choix"),
    ("6c", "6", "Gicleurs", "Y a-t-il une clef de gicleur disponible ?", "choix"),
    ("6d", "6", "Gicleurs", "La température de déclenchement est-elle adéquate ?", "choix"),
    ("6e", "6", "Gicleurs", "Tous les gicleurs de type standard ont moins de 50 ans ?", "choix"),
    ("6f", "6", "Gicleurs", "Tous les gicleurs de type réponse rapide ont moins de 20 ans ?", "choix"),
    ("6g", "6", "Gicleurs", "Tous les gicleurs de type à sec ont moins de 10 ans ?", "choix"),
    ("6h", "6", "Gicleurs", "Tous les gicleurs de type haute température ont moins de 5 ans ?", "choix"),
    ("6i", "6", "Gicleurs", "L'orientation des gicleurs est adéquate selon les normes NFPA25", "choix"),
    ("6j", "6", "Gicleurs", "Tous les gicleurs ont été inspectés visuellement ?", "choix"),
    ("6k", "6", "Gicleurs", "Dégagement minimal respecté pour les déflecteurs des gicleurs ?", "choix"),
    ("6l", "6", "Gicleurs", "Y a-t-il un gicleur dans le compacteur ?", "choix"),
    ("6m", "6", "Gicleurs", "Les gicleurs sont en bonne condition, libres de corrosion, de peinture et ou d'obstruction selon les normes NFPA25", "choix"),

    # 7 — Chute à déchets (4 items)
    ("7a", "7", "Chute à déchets", "La valve de fermeture a été vérifiée ?", "choix"),
    ("7b", "7", "Chute à déchets", "La valve de test a été vérifiée ?", "choix"),
    ("7c", "7", "Chute à déchets", "Le détecteur de débit est fonctionnel ?", "choix"),
    ("7d", "7", "Chute à déchets", "Les maillons fusibles sont en place ?", "choix"),

    # 8 — Avertisseurs (7 items)
    ("8a", "8", "Avertisseurs", "Essai satisfaisant de la cloche hydraulique et du timbre ?", "choix"),
    ("8b", "8", "Avertisseurs", "Essai satisfaisant de l'avertisseur électrique ?", "choix"),
    ("8c", "8", "Avertisseurs", "Essai satisfaisant de l'avertisseur de garde ?", "choix"),
    ("8c1", "8", "Avertisseurs", "Alarme audible ?", "choix"),
    ("8c2", "8", "Avertisseurs", "Alarme au silence ?", "choix"),
    ("8d", "8", "Avertisseurs", "Localisation de l'avertisseur de garde (entré principale)", "choix"),
    ("8d2", "8", "Avertisseurs", "Marque", "texte"),
    ("8e", "8", "Avertisseurs", "Centrale d'alarme ?", "choix"),
    ("8e1", "8", "Avertisseurs", "Nom de la centrale d'alarme", "texte"),
    ("8f", "8", "Avertisseurs", "Téléphone de la centrale d'alarme", "texte"),
    ("8f2", "8", "Avertisseurs", "Numéro du système", "texte"),
    ("8g", "8", "Avertisseurs", "Les contacts d'alarme sont en condition satisfaisante ?", "choix"),

    # 9 — Tuyauterie, manomètres, pompes de surpression (3 items)
    ("9a", "9", "Tuyauterie, manomètres, pompes de surpression", "La tuyauterie, les robinets de vidange, les clapets de retenue, les étriers de suspensions, les extincteurs à tête ouverte et les crépines sont en condition satisfaisante ?", "choix"),
    ("9b", "9", "Tuyauterie, manomètres, pompes de surpression", "Les manomètres sont en condition satisfaisante ?", "choix"),
    ("9c", "9", "Tuyauterie, manomètres, pompes de surpression", "Les pompes de surpression et leurs soupapes sont en condition satisfaisante ?", "choix"),

    # 10 — Installation spéciale (1 item — tableau fixe à part pour le détail)
    ("10a", "10", "Installation spéciale", "Les installations antigel ont été mises à l'épreuve, laissées en condition satisfaisante et leurs soupapes ouvertes ?", "choix"),

    # 11 — Installation sous air (14 items — le point "i" localisation des points bas est couvert par le tableau GicleurPointBas)
    ("11a", "11", "Installation sous air", "Les soupapes à air sont en service et en bonne condition ?", "choix"),
    ("11b", "11", "Installation sous air", "Les soupapes à air sont bien protégées du gel ?", "choix"),
    ("11c", "11", "Installation sous air", "La pression d'air et le niveau d'eau d'amorçage sont normaux ?", "choix"),
    ("11d", "11", "Installation sous air", "Le compresseur d'air est en bonne condition ?", "choix"),
    ("11d1", "11", "Installation sous air", "Heure de départ du compresseur", "texte"),
    ("11d2", "11", "Installation sous air", "Heure d'arrêt du compresseur", "texte"),
    ("11e", "11", "Installation sous air", "Les dispositifs à commande rapide sont en service ?", "choix"),
    ("11f", "11", "Installation sous air", "Le poste de contrôle et son unité de chauffage sont en condition satisfaisante ?", "choix"),
    ("11g", "11", "Installation sous air", "Les points bas ont été vidangés lors des vérifications d'automne et d'hiver ?", "choix"),
    ("11h", "11", "Installation sous air", "Nombre de points bas ?", "texte"),
    ("11j", "11", "Installation sous air", "L'écoulement continu dans la tuyauterie a été vérifié durant les 10 dernières années ?", "texte"),
    ("11k", "11", "Installation sous air", "La pente des tuyaux a été vérifiée durant les 5 dernières années ?", "texte"),
    ("11l", "11", "Installation sous air", "Essai mécanique avec ou sans inondation ?", "texte"),
    ("11m", "11", "Installation sous air", "Le réservoir du compresseur a été vidangé ?", "choix"),
    ("11n", "11", "Installation sous air", "Le niveau d'huile est-il satisfaisant ?", "choix"),
    ("11o", "11", "Installation sous air", "État de la courroie du compresseur ?", "choix"),
]

# Champ texte complémentaire affiché à côté de certains items (en plus du
# radio Oui/S.O/Non) — clé = code, valeur = libellé du champ. Purement pour
# l'affichage frontend ; la valeur est stockée dans `valeur_texte` comme pour
# tout item, aucun champ supplémentaire côté modèle.
# Items dont la réponse « Non » n'est pas une déficience (ex. 8e « Centrale
# d'alarme ? » : l'immeuble n'est simplement pas relié à une centrale) —
# exclus du calcul de conformité (certificat, pastilles, liste des non-conformités).
CODES_HORS_CONFORMITE = ["8e"]

# Items affichés comme simples cases à cocher (reponse = « oui » ou vide) —
# même liste que CODES_CASES_A_COCHER dans FormulaireGicleur.tsx.
CODES_CASES_A_COCHER = ["3b", "3c", "3d", "8c1", "8c2", "8d"]

CHAMP_TEXTE_COMPLEMENTAIRE = {
    "6m": "Si non, combien y en a-t-il ?",
}

# Tableau fixe page 1 — soupapes de commande (5 lignes)
CATEGORIES_SOUPAPE_COMMANDE = [
    ("ville", "Soupapes de commande de la ville"),
    ("alimentation", "Soupapes de commande d'alimentation"),
    ("pompe", "Soupapes de commande de pompe"),
    ("secteur", "Soupapes de commande de secteur"),
    ("principale", "Soupapes de commande principales"),
]

NB_IDENTIFICATIONS_SYSTEMES = 1
NB_ESSAIS_ECOULEMENT = 4
NB_INSTALLATIONS_SPECIALES = 3
NB_POINTS_BAS = 1


# ── Traductions anglaises ─────────────────────────────────────────────────
# Les libellés français ci-dessus sont copiés dans chaque rapport à sa
# création (`GicleurReponseChecklist.label`) ; la version anglaise est
# résolue à l'affichage (écran et PDF) selon `Organisation.langue`, à partir
# du code de l'item — aucun champ supplémentaire côté modèle.

SECTIONS_EN = {
    "1": "Equipment identification",
    "2": "Control valves",
    "3": "Water supply (hydraulic tests)",
    "4": "General",
    "5": "Fire department connections",
    "6": "Sprinklers",
    "7": "Waste chute",
    "8": "Alarms",
    "9": "Piping, gauges, jockey pumps",
    "10": "Special installation",
    "11": "Dry-pipe installation",
}

LABELS_EN = {
    "2a": "Are all valves in the proper position?",
    "2b": "Are all control valves in good condition?",
    "2c": "Have all control valves been lubricated and checked?",
    "3a": "Inspector's test valve test?",
    "3b": "City water supply?",
    "3c": "Fire pump supply?",
    "3d": "Other supply?",
    "4a": "Building occupied?",
    "4b": "Same occupancy as at the last inspection?",
    "4c": "Are all systems in service?",
    "4d": "Are all fire systems the same as at the last inspection?",
    "4e": "Hazard fully protected by automatic water sprinklers?",
    "4f": "Are all new additions and building modifications properly protected?",
    "4g": "Are all units accessible and have they been inspected?",
    "4h": "Are signs for the sprinkler system signage and identification posted?",
    "4i": "Is stock properly placed under the sprinkler distribution piping?",
    "4j": "Client reports no fire since the last inspection?",
    "4k": "In areas protected by wet-pipe sprinklers, is heating adequate for both concealed attics and surrounding areas, and are all openings protected from cold?",
    "5a": "Are the fire department connections (sprinklers) in satisfactory condition, couplings free, caps in place?",
    "5b": "Are the check valve and ball drip valve in satisfactory condition?",
    "5c": "Location of the fire department connection (sprinklers)?",
    "6a": "Approximate number of sprinklers?",
    "6b": "Are spare sprinklers readily available?",
    "6c": "Is a sprinkler wrench available?",
    "6d": "Is the operating temperature adequate?",
    "6e": "Are all standard sprinklers less than 50 years old?",
    "6f": "Are all quick-response sprinklers less than 20 years old?",
    "6g": "Are all dry-type sprinklers less than 10 years old?",
    "6h": "Are all high-temperature sprinklers less than 5 years old?",
    "6i": "Sprinkler orientation is adequate per NFPA 25",
    "6j": "Have all sprinklers been visually inspected?",
    "6k": "Is the minimum clearance below sprinkler deflectors maintained?",
    "6l": "Is there a sprinkler in the compactor?",
    "6m": "Sprinklers are in good condition, free of corrosion, paint and/or obstruction per NFPA 25",
    "7a": "Has the shut-off valve been checked?",
    "7b": "Has the test valve been checked?",
    "7c": "Is the flow detector working?",
    "7d": "Are the fusible links in place?",
    "8a": "Satisfactory test of the water motor gong and bell?",
    "8b": "Satisfactory test of the electric alarm?",
    "8c": "Satisfactory test of the supervisory alarm?",
    "8c1": "Audible alarm?",
    "8c2": "Alarm silenced?",
    "8d": "Location of the supervisory alarm (main entrance)",
    "8d2": "Brand",
    "8e": "Alarm monitoring center?",
    "8e1": "Name of the alarm monitoring center",
    "8f": "Alarm monitoring center phone number",
    "8f2": "System number",
    "8g": "Are the alarm contacts in satisfactory condition?",
    "9a": "Are the piping, drain valves, check valves, hangers, open-head sprinklers and strainers in satisfactory condition?",
    "9b": "Are the gauges in satisfactory condition?",
    "9c": "Are the jockey pumps and their valves in satisfactory condition?",
    "10a": "Have antifreeze systems been tested, left in satisfactory condition with their valves open?",
    "11a": "Are the dry-pipe valves in service and in good condition?",
    "11b": "Are the dry-pipe valves well protected from freezing?",
    "11c": "Are the air pressure and priming water level normal?",
    "11d": "Is the air compressor in good condition?",
    "11d1": "Compressor start time",
    "11d2": "Compressor stop time",
    "11e": "Are the quick-opening devices in service?",
    "11f": "Are the valve room and its heating unit in satisfactory condition?",
    "11g": "Were the low points drained during the fall and winter inspections?",
    "11h": "Number of low points?",
    "11j": "Has continuous flow in the piping been verified within the last 10 years?",
    "11k": "Has the pipe slope been verified within the last 5 years?",
    "11l": "Mechanical test with or without flooding?",
    "11m": "Has the compressor tank been drained?",
    "11n": "Is the oil level satisfactory?",
    "11o": "Condition of the compressor belt?",
}

CHAMP_TEXTE_COMPLEMENTAIRE_EN = {
    "6m": "If not, how many are there?",
}

CATEGORIES_SOUPAPE_COMMANDE_EN = {
    "ville": "City control valves",
    "alimentation": "Supply control valves",
    "pompe": "Pump control valves",
    "secteur": "Sectional control valves",
    "principale": "Main control valves",
}


def label_item(code: str, label_fr: str, langue: str) -> str:
    if langue == "en":
        return LABELS_EN.get(code, label_fr)
    return label_fr


def titre_section(code: str, langue: str) -> str:
    if langue == "en" and code in SECTIONS_EN:
        return SECTIONS_EN[code]
    if code == "1":
        return "Identification de l'équipement"
    return dict(SECTIONS).get(code, code)
