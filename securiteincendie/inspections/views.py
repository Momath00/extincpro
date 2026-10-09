from collections import Counter
from datetime import date

from django.utils.html import escape
from django.db.models import F, Q
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from securiteincendie.emailing import logo_data_uri, organisation_logo_content

from accounts.models import Utilisateur
from openpyxl.styles import Font

from .excel_utils import (
    NAVY,
    RED,
    excel_ajuster_largeurs,
    excel_entete_rapport,
    excel_ligne_entetes,
    excel_nom_fichier,
    excel_reponse,
    excel_workbook,
)
from .pagination import PaginationSiDemandee, RapportPagination
from .dossier import lire_pieces_jointes
from .photos import PhotosRapportMixin, html_annexe_photos
from .models import (
    AppelService,
    Batiment,
    BoyauItem,
    Certificat,
    CertificatExtincteur,
    CertificatGicleur,
    Client,
    Dispositif,
    EclairageUrgenceItem,
    ExtincteurItem,
    LEGENDE_NON_CONFORMITES,
    FicheE1,
    FicheE2,
    FicheLegende,
    HotteCuisine,
    Rapport,
    RapportCuisine,
    RapportEclairageUrgence,
    RapportExtincteur,
    RapportGicleur,
    SectionDispositif,
    Tournee,
    TourneeBatiment,
)
from .serializers import (
    AppelServiceCreateSerializer,
    AppelServiceDetailSerializer,
    AppelServiceListSerializer,
    BatimentSerializer,
    BoyauItemSerializer,
    ClientSerializer,
    DispositifSerializer,
    EclairageUrgenceItemSerializer,
    ExtincteurItemSerializer,
    FicheE1Serializer,
    FicheE2Serializer,
    FicheLegendeSerializer,
    HistoriqueRapportCuisineSerializer,
    HistoriqueRapportEclairageUrgenceSerializer,
    HistoriqueRapportExtincteurSerializer,
    HistoriqueRapportSerializer,
    HotteCuisineSerializer,
    RapportCreateSerializer,
    RapportCuisineCreateSerializer,
    RapportCuisineDetailSerializer,
    RapportCuisineListSerializer,
    RapportDetailSerializer,
    RapportEclairageUrgenceCreateSerializer,
    RapportEclairageUrgenceDetailSerializer,
    RapportEclairageUrgenceListSerializer,
    RapportExtincteurCreateSerializer,
    RapportExtincteurDetailSerializer,
    RapportExtincteurListSerializer,
    RapportListSerializer,
    SectionDispositifSerializer,
    TourneeCreateSerializer,
    TourneeSerializer,
)

# ── Titres des sections E2 ───────────────────────────────────────────────
E2_TITRES = {
    "e2_1":  "E2.1 — Essai du poste de contrôle principal",
    "e2_2":  "E2.2 — Système de recherche de personnes / téléphones d'urgence",
    "e2_3":  "E2.3 — Vérification du poste de contrôle",
    "e2_4":  "E2.4 — Alimentation principale (C.A.)",
    "e2_5":  "E2.5 — Alimentation de secours (batterie)",
    "e2_6":  "E2.6 — Répondeur / panneau d'annonce — type I",
    "e2_7":  "E2.7 — Répondeur / panneau d'annonce — type II",
    "e2_8":  "E2.8 — Indicateur d'alarme à distance",
    "e2_9":  "E2.9 — Imprimante",
    "e2_10": "E2.10 — Liaisons de données",
    "e2_11": "E2.11 — Dispositifs auxiliaires",
    "e2_12": "E2.12 — Remarques générales",
}

# ── Légende des dispositifs (référence des abréviations E3) ─────────────
LEGENDE_DISPOSITIFS = [
    ("PAI", "Panneau annonciateur d'alarme"),
    ("M", "Station manuelle"),
    ("S", "Détecteur de fumée"),
    ("C", "Cloche"),
    ("K", "Klaxon"),
    ("RHT", "Détecteur de chaleur"),
    ("FDL", "Résistance de fin de ligne"),
    ("PZ", "Piézo"),
    ("ISO", "Module isolateur"),
    ("ANN", "Panneau annonciateur d'alarme"),
    ("DFG", "Détecteur de fumée gaine ventilation"),
    ("TEL", "Téléphone d'urgence (pompier)"),
    ("IDG", "Gicleur débit"),
    ("IVG", "Interrupteur vanne gicleur"),
    ("IHP", "Interrupteur haute pression"),
    ("IBH", "Interrupteur de basse pression"),
    ("K/S", "Klaxon strobe"),
    ("MA", "Module adressable"),
]


# ── Légende des non-conformités du rapport extincteurs portatifs ─────────
_STYLE_CODE_NC = (
    "display:inline-block;font-weight:800;color:#e11324;background:#fee2e2;"
    "border:1px solid #fecaca;border-radius:100px;"
)
_PASTILLE_NC = f"<span style='{_STYLE_CODE_NC}font-size:6.5pt;padding:0 5px;margin:1px;'>{{}}</span>"


def _html_legende_non_conformites(langue):
    """Légende bilingue sur 3 colonnes, comme sur le formulaire papier des
    clients industriels (codes TH, 6Y, RL…)."""
    cellules = "".join(
        f"<div style='font-size:7.5pt;'><span style='{_STYLE_CODE_NC}min-width:38px;text-align:center;"
        f"font-size:7pt;padding:1px 6px;margin-right:5px;'>{code}</span>"
        f"<b>{fr if langue != 'en' else en}</b> <span style='color:#6b7280;'>/ {en if langue != 'en' else fr}</span></div>"
        for code, fr, en in LEGENDE_NON_CONFORMITES
    )
    titre = "Deficiencies legend / Légende des non-conformités" if langue == "en" else "Légende des non-conformités / Deficiencies legend"
    return (
        "<div class='legende-box'><div class='card-title' style='text-align:center;'>"
        f"{titre}</div>"
        "<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 14px;margin-top:6px;'>"
        f"{cellules}</div></div>"
    )


# ── Liste des vérifications du système d'extinction de cuisine (ULC ORD 1254.6) ──
CHECKLIST_CUISINE = [
    ("appareils_proteges", "Vérifier si les appareils sont protégés de façon adéquate"),
    ("liens_fusibles_remplaces", "Remplacer le(s) lien(s)-fusible(s)"),
    ("installation_conforme_fabricant", "Vérifier si le système est installé selon les normes du fabricant"),
    ("cable_tension_verifie", "Vérifier le câble de tension pour corrosion ou effilochure"),
    ("pression_manometre_verifiee", "Vérifier la pression du manomètre"),
    ("conduits_decharge_verifies", "Vérifier tous les conduits de déchargement et fixations"),
    ("cylindres_supports_inspectes", "Inspecter et nettoyer le(s) cylindre(s) et le(s) support(s)"),
    ("extincteur_portatif_type_k", "Vérifier la présence d'un extincteur portatif conforme (type K)"),
    ("station_manuelle_degagee", "Vérifier l'absence d'obstruction devant la station manuelle"),
    ("etiquettes_verification_apposees", "Apposer les étiquettes de vérification"),
    ("buses_protecteurs_nettoyes", "Nettoyer et vérifier les buses et leurs protecteurs"),
    ("systeme_condition_normale", "Laisser le système en condition d'opération normale"),
    ("liens_fusibles_nettoyes", "Nettoyer et vérifier le(s) lien(s)-fusible(s)"),
]


def _val_oui_non(v):
    if v is True:  return '<span style="color:#0d6b4f;font-weight:700;">Oui</span>'
    if v is False: return '<span style="color:#e11324;font-weight:700;">Non</span>'
    return '<span style="color:#9ca3af;">—</span>'


def _val_so(v):
    if v == "oui":        return '<span style="color:#0d6b4f;font-weight:700;">Oui</span>'
    if v == "non":        return '<span style="color:#e11324;font-weight:700;">Non</span>'
    if v == "sans_objet": return '<span style="color:#6b7280;">S.O.</span>'
    if v:                 return f'<span style="color:#0a0b0d;">{v}</span>'
    return '<span style="color:#9ca3af;">—</span>'


_MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août',
            'septembre','octobre','novembre','décembre']

def _date_fr(d):
    if d is None: return "—"
    return f"{d.day} {_MOIS_FR[d.month - 1]} {d.year}"


def _creer_rapport_eclairage_lie(rapport_extincteur, utilisateur, request_data):
    """Crée le rapport de vérification de l'éclairage d'urgence lié à ce
    rapport extincteur, uniquement si demandé explicitement — comme pour la
    cuisine (voir _creer_rapport_cuisine_lie), certaines compagnies clientes
    ne font que l'inspection des extincteurs pour un bâtiment donné, sans
    éclairage d'urgence. Le superviseur/technicien coche donc l'option au
    moment de créer le rapport extincteur (`avec_eclairage_urgence`) pour
    indiquer que CE bâtiment en a un."""
    organisation = getattr(utilisateur, "organisation", None)
    if not (organisation and organisation.a_le_module("rapport_eclairage_urgence")):
        return
    if not request_data.get("avec_eclairage_urgence"):
        return

    rapport_eclairage = RapportEclairageUrgence.objects.create(
        batiment=rapport_extincteur.batiment,
        cree_par=utilisateur,
        numero_job=rapport_extincteur.numero_job,
        date_inspection=rapport_extincteur.date_inspection,
        rapport_extincteur=rapport_extincteur,
    )
    rapport_eclairage.techniciens.set(rapport_extincteur.techniciens.all())
    rapport_eclairage.historiser(
        utilisateur, "Rapport créé automatiquement avec le rapport extincteur"
    )


def _creer_rapport_cuisine_lie(rapport_extincteur, utilisateur, request_data):
    """Crée le rapport du système d'extinction de cuisine lié à ce rapport
    extincteur, uniquement si demandé explicitement — le module (SaaS,
    activable par organisation) permet à une organisation d'utiliser ce
    module, mais toutes les adresses d'une même organisation n'ont pas une
    cuisine commerciale (ex. un seul immeuble sur dix est un restaurant) :
    le superviseur/technicien coche donc l'option au moment de créer le
    rapport extincteur (`avec_systeme_cuisine`) pour indiquer que CE
    bâtiment en a une."""
    organisation = getattr(utilisateur, "organisation", None)
    if not (organisation and organisation.a_le_module("rapport_cuisine")):
        return
    if not request_data.get("avec_systeme_cuisine"):
        return

    rapport_cuisine = RapportCuisine.objects.create(
        batiment=rapport_extincteur.batiment,
        cree_par=utilisateur,
        numero_job=rapport_extincteur.numero_job,
        date_inspection=rapport_extincteur.date_inspection,
        rapport_extincteur=rapport_extincteur,
    )
    rapport_cuisine.techniciens.set(rapport_extincteur.techniciens.all())
    rapport_cuisine.historiser(
        utilisateur, "Rapport créé automatiquement avec le rapport extincteur"
    )


# ── Rapports créés pour la même visite (cases « Avec … » à la création) ────
# Chaque case n'est prise en compte que si le module correspondant est actif
# pour l'organisation (le frontend ne l'affiche d'ailleurs pas sinon) : une
# compagnie qui n'a que le module extincteurs ne crée jamais autre chose.

def _copier_visite(source, rapport, utilisateur, libelle_source):
    rapport.techniciens.set(source.techniciens.all())
    rapport.historiser(utilisateur, f"Rapport créé automatiquement avec le rapport {libelle_source}")


def _module_demande(utilisateur, request_data, cle, code_module):
    organisation = getattr(utilisateur, "organisation", None)
    return bool(request_data.get(cle) and organisation and organisation.a_le_module(code_module))


def _creer_rapport_alarme_lie(source, utilisateur, request_data, libelle_source):
    """`avec_systeme_alarme` → rapport du réseau d'alarme incendie (propre certificat)."""
    if not _module_demande(utilisateur, request_data, "avec_systeme_alarme", "rapport_incendie"):
        return None
    rapport = Rapport.objects.create(
        batiment=source.batiment, cree_par=utilisateur,
        citoyen=getattr(source, "citoyen", None), date_inspection=source.date_inspection,
    )
    FicheE1.objects.create(rapport=rapport)
    FicheE2.objects.create(rapport=rapport)
    FicheLegende.objects.create(rapport=rapport)
    _copier_visite(source, rapport, utilisateur, libelle_source)
    return rapport


def _creer_rapport_extincteur_lie(source, utilisateur, request_data, libelle_source):
    """`avec_extincteur` → rapport extincteurs (propre certificat) ; l'éclairage
    d'urgence demandé en même temps lui est rattaché (même certificat)."""
    if not _module_demande(utilisateur, request_data, "avec_extincteur", "rapport_extincteur"):
        return None
    rapport = RapportExtincteur.objects.create(
        batiment=source.batiment, cree_par=utilisateur,
        citoyen=getattr(source, "citoyen", None), date_inspection=source.date_inspection,
    )
    _copier_visite(source, rapport, utilisateur, libelle_source)
    _creer_rapport_eclairage_lie(rapport, utilisateur, request_data)
    return rapport


def _creer_rapport_eclairage_seul(source, utilisateur, request_data, libelle_source):
    """`avec_eclairage_urgence` sans rapport extincteurs → rapport d'éclairage seul."""
    if not _module_demande(utilisateur, request_data, "avec_eclairage_urgence", "rapport_eclairage_urgence"):
        return None
    rapport = RapportEclairageUrgence.objects.create(
        batiment=source.batiment, cree_par=utilisateur, date_inspection=source.date_inspection,
    )
    _copier_visite(source, rapport, utilisateur, libelle_source)
    return rapport


def _creer_rapport_gicleur_lie(source, utilisateur, request_data, libelle_source):
    """`avec_gicleur` → rapport gicleur (checklist complète, propre certificat)."""
    if not _module_demande(utilisateur, request_data, "avec_gicleur", "rapport_gicleur"):
        return None
    rapport = RapportGicleur.objects.create(
        batiment=source.batiment, cree_par=utilisateur,
        citoyen=getattr(source, "citoyen", None), date_inspection=source.date_inspection,
    )
    rapport.creer_structure_par_defaut()
    _copier_visite(source, rapport, utilisateur, libelle_source)
    return rapport


def _citoyen_du_rapport(rapport):
    """Le citoyen à aviser pour ce rapport — direct sur Rapport/RapportExtincteur,
    ou via le rapport extincteur lié pour Éclairage/Cuisine (voir modèles)."""
    citoyen = getattr(rapport, "citoyen", None)
    if citoyen is None:
        rapport_extincteur = getattr(rapport, "rapport_extincteur", None)
        citoyen = getattr(rapport_extincteur, "citoyen", None) if rapport_extincteur else None
    return citoyen


def destinataire_client_du_rapport(rapport):
    """(nom, email, langue) du destinataire à aviser pour ce rapport — le
    citoyen assigné (compte avec accès au portail) en priorité s'il a un
    courriel ; sinon le contact du Client (compagnie), déjà saisi à sa
    création (`contact_nom`/`contact_email`), sans qu'un compte séparé soit
    nécessaire. Retourne (None, None, None) si aucun des deux n'est disponible."""
    from securiteincendie.email_i18n import langue_utilisateur

    citoyen = _citoyen_du_rapport(rapport)
    if citoyen and citoyen.email:
        return citoyen.get_full_name() or citoyen.username, citoyen.email, langue_utilisateur(citoyen)

    client = rapport.batiment.client
    if client.contact_email:
        langue = getattr(client.organisation, "langue", "fr") or "fr"
        return client.contact_nom or client.nom, client.contact_email, langue

    return None, None, None


def _envoyer_confirmation_planification_si_applicable(rapport, label: str) -> None:
    """À la création d'une inspection avec un destinataire client + date
    connus, avise par courriel que la visite est planifiée (une seule fois, à
    la création — voir perform_create de RapportViewSet/RapportExtincteurViewSet)."""
    from .emailing import envoyer_confirmation_planification

    nom, email, langue = destinataire_client_du_rapport(rapport)
    if not (email and rapport.date_inspection):
        return
    envoyer_confirmation_planification(email, nom, label, rapport.batiment, rapport.date_inspection, langue)


def _propager_date_aux_rapports_lies(rapport_extincteur) -> None:
    """Extincteur + éclairage (+ cuisine, si liée) couvrent la même visite —
    changer la date sur le rapport extincteur doit se refléter sur les
    rapports liés, sans déclencher un avis de changement séparé pour chacun
    (un seul avis, depuis le rapport extincteur, suffit pour cette visite)."""
    for lie in (
        getattr(rapport_extincteur, "rapport_eclairage_lie", None),
        getattr(rapport_extincteur, "rapport_cuisine_lie", None),
    ):
        if lie is None or lie.statut == lie.Statut.FERME:
            continue
        champs = []
        if lie.date_inspection != rapport_extincteur.date_inspection:
            lie.date_inspection = rapport_extincteur.date_inspection
            champs.append("date_inspection")
        if lie.prochaine_inspection != rapport_extincteur.prochaine_inspection:
            lie.prochaine_inspection = rapport_extincteur.prochaine_inspection
            champs.append("prochaine_inspection")
        if champs:
            lie.save(update_fields=champs)


def _envoyer_avis_changement_date_si_applicable(
    rapport, label: str, ancienne_date_inspection, ancienne_prochaine_inspection=None
) -> None:
    """Si `date_inspection` (visite planifiée) OU `prochaine_inspection`
    (échéance de conformité, y compris un rappel en retard qu'on vient de
    replanifier) vient de changer, avise par courriel de la nouvelle date
    (voir perform_update des ViewSets de rapport)."""
    from .emailing import envoyer_avis_changement_date

    ancienne, nouvelle = None, None
    if rapport.date_inspection and ancienne_date_inspection and rapport.date_inspection != ancienne_date_inspection:
        ancienne, nouvelle = ancienne_date_inspection, rapport.date_inspection
    elif rapport.prochaine_inspection and ancienne_prochaine_inspection and rapport.prochaine_inspection != ancienne_prochaine_inspection:
        ancienne, nouvelle = ancienne_prochaine_inspection, rapport.prochaine_inspection

    if not (ancienne and nouvelle):
        return
    nom, email, langue = destinataire_client_du_rapport(rapport)
    if not email:
        return
    envoyer_avis_changement_date(email, nom, label, rapport.batiment, ancienne, nouvelle, langue)


def _est_conforme_extincteur(rapport_extincteur):
    """Non conforme dès qu'un extincteur, une unité d'éclairage d'urgence
    liée OU le système de cuisine lié est défectueux/non conforme — même
    logique que le certificat unifié. Quand un certificat existe, c'est SA
    conformité qui fait foi (lignes ajustées à la main comprises)."""
    cert = getattr(rapport_extincteur, "certificat", None)
    if cert is not None:
        from .certificats import conformite_certificat

        return conformite_certificat(cert)
    rapport_eclairage = getattr(rapport_extincteur, "rapport_eclairage_lie", None)
    eclairages = list(rapport_eclairage.eclairages_urgence.all()) if rapport_eclairage else []
    rapport_cuisine = getattr(rapport_extincteur, "rapport_cuisine_lie", None)
    items = list(rapport_extincteur.extincteurs.all())
    return (
        not any(it.etat == "D" for it in items)
        and not any(it.etat == "D" for it in eclairages)
        and (rapport_cuisine is None or rapport_cuisine.est_conforme)
    )


# ── Traduction des rapports/certificats (langue de l'organisation) ─────────
# Chaque organisation choisit sa langue (super-admin) — les documents générés
# (rapports imprimables, certificats) suivent cette langue, indépendamment de
# la langue de l'utilisateur qui les télécharge.
I18N = {
    "imprimer_pdf": {"fr": "Imprimer / Enregistrer PDF", "en": "Print / Save as PDF"},
    "certificat_verification": {"fr": "Certificat de vérification", "en": "Verification Certificate"},
    "extincteurs_portatifs": {"fr": "Extincteurs portatifs", "en": "Portable fire extinguishers"},
    "inspection_certification": {"fr": "Inspection &amp; Certification", "en": "Inspection &amp; Certification"},
    "date_inspection": {"fr": "Date d'inspection", "en": "Inspection date"},
    "technicien_s": {"fr": "Technicien(s)", "en": "Technician(s)"},
    "client": {"fr": "Client", "en": "Client"},
    "adresse_inspectee": {"fr": "Adresse inspectée", "en": "Inspected address"},
    "conformite_bandeau": {
        "fr": "La vérification de l'équipement sous mentionné est conforme aux normes en vigueur",
        "en": "The verification of the equipment listed below complies with applicable standards",
    },
    "equipement": {"fr": "Équipement", "en": "Equipment"},
    "conforme_col": {"fr": "Conforme", "en": "Compliant"},
    "non_conforme_col": {"fr": "Non conforme", "en": "Non-compliant"},
    "so": {"fr": "S.O.", "en": "N/A"},
    "statut_col": {"fr": "Statut", "en": "Status"},
    "systeme_cuisine": {"fr": "Système automatique de cuisine", "en": "Automatic kitchen system"},
    "extincteur_label": {"fr": "Extincteur", "en": "Fire extinguisher"},
    "eclairage_urgence_label": {"fr": "Éclairage d'urgence", "en": "Emergency lighting"},
    "conforme_badge": {"fr": "CONFORME", "en": "COMPLIANT"},
    "non_conforme_badge": {"fr": "NON CONFORME", "en": "NON-COMPLIANT"},
    "inspection_entretien": {
        "fr": "L'inspection régulière et l'entretien de l'équipement tels que recommandés<br>par le manufacturier ont été effectués.",
        "en": "Regular inspection and maintenance of the equipment as recommended<br>by the manufacturer have been carried out.",
    },
    "superviseur_responsable": {"fr": "Superviseur / Responsable", "en": "Supervisor / Responsible"},
    "date_emission": {"fr": "Date d'émission", "en": "Issue date"},
    "certificat_no": {"fr": "Certificat N°", "en": "Certificate No."},
    "footer_certificat_extincteur": {
        "fr": "Ce certificat atteste la vérification des extincteurs portatifs et de l'éclairage d'urgence à la date d'inspection indiquée.",
        "en": "This certificate attests to the verification of portable fire extinguishers and emergency lighting on the inspection date indicated.",
    },
    "footer_certificat_incendie": {
        "fr": "Ce certificat atteste la conformité du réseau d'alarme incendie à la date d'inspection indiquée.",
        "en": "This certificate attests to the compliance of the fire alarm system on the inspection date indicated.",
    },
    "footer_rapport_incendie": {
        "fr": "Ce rapport présente le détail de l'inspection annuelle du réseau d'alarme incendie à la date indiquée.",
        "en": "This report presents the details of the fire alarm system's annual inspection on the date indicated.",
    },
    "footer_rapport_extincteur": {
        "fr": "Ce rapport présente le détail de la vérification des extincteurs portatifs et de l'éclairage d'urgence à la date indiquée.",
        "en": "This report presents the details of the portable fire extinguisher and emergency lighting verification on the date indicated.",
    },
    "rapport_verification": {"fr": "Rapport de vérification", "en": "Verification Report"},
    "detail_extincteurs": {"fr": "Détail des extincteurs", "en": "Fire extinguisher details"},
    "detail_boyaux": {"fr": "Détail des boyaux d'incendie", "en": "Fire hose details"},
    "detail_unites_eclairage": {"fr": "Détail des unités d'éclairage d'urgence", "en": "Emergency lighting unit details"},
    "col_no": {"fr": "No", "en": "No."},
    "col_etage": {"fr": "Étage", "en": "Floor"},
    "col_emplacement": {"fr": "Emplacement", "en": "Location"},
    "col_type": {"fr": "Type", "en": "Type"},
    "col_format": {"fr": "Format", "en": "Size"},
    "col_marque": {"fr": "Marque", "en": "Brand"},
    "col_modele": {"fr": "Modèle", "en": "Model"},
    "col_voltage": {"fr": "Voltage", "en": "Voltage"},
    "col_numero_serie": {"fr": "N° série", "en": "Serial No."},
    "col_date_fabrication": {"fr": "Date fabrication", "en": "Manufacture date"},
    "col_prochaine_maintenance": {"fr": "Prochaine maintenance", "en": "Next maintenance"},
    "col_prochain_test_hydro": {"fr": "Prochain test hydro.", "en": "Next hydro test"},
    "col_longueur": {"fr": "Longueur", "en": "Length"},
    "col_annee_fabrication": {"fr": "Année fabrication", "en": "Manufacture year"},
    "col_etat": {"fr": "État", "en": "Status"},
    "col_remarque": {"fr": "Remarque", "en": "Remark"},
    "etat_titre_abbr": {
        "fr": "D=Défectueux, C=Conforme, NI=Non inspecté",
        "en": "D=Defective, C=Compliant, NI=Not inspected",
    },
    "adresse": {"fr": "Adresse", "en": "Address"},
    "statut_ferme": {"fr": "Fermé", "en": "Closed"},
    "statut_ouvert": {"fr": "Ouvert", "en": "Open"},
    "aucun_extincteur": {"fr": "Aucun extincteur enregistré", "en": "No fire extinguisher recorded"},
    "aucun_boyau": {"fr": "Aucun boyau enregistré", "en": "No fire hose recorded"},
    "aucune_unite": {"fr": "Aucune unité enregistrée", "en": "No unit recorded"},
    "aucun_appareil": {"fr": "Aucun appareil enregistré", "en": "No device recorded"},
    "aucune_hotte": {"fr": "Aucune hotte enregistrée", "en": "No hood recorded"},
    "footer_rapport_eclairage": {
        "fr": "Rapport de vérification — Éclairage d'urgence",
        "en": "Verification Report — Emergency Lighting",
    },
    "certificat_unifie_genere": {
        "fr": "généré depuis le rapport extincteur lié",
        "en": "generated from the linked fire extinguisher report",
    },
    "certificat_unifie_label": {"fr": "Certificat unifié", "en": "Unified certificate"},
    "total": {"fr": "Total", "en": "Total"},
    "defectueuse_s": {"fr": "défectueuse(s)", "en": "defective"},
    "boyaux_incendie_sheet": {"fr": "Boyaux", "en": "Hoses"},
    "numero_job": {"fr": "N° job", "en": "Job No."},
    "schema_installation": {"fr": "Schéma d'installation", "en": "Installation diagram"},
    "liste_verifications": {"fr": "Liste des vérifications", "en": "Verification checklist"},
    "conformes_sur": {"fr": "conformes", "en": "compliant"},
    "informations_systeme": {"fr": "Informations du système", "en": "System information"},
    "commentaires_label": {"fr": "Commentaires", "en": "Comments"},
    "photos_anomalies": {"fr": "Photos des anomalies", "en": "Deficiency photos"},
    "suite": {"fr": "suite", "en": "continued"},
    "footer_rapport_cuisine": {
        "fr": "Ce rapport présente le détail de la vérification du système d'extinction de cuisine à la date indiquée.",
        "en": "This report presents the details of the kitchen fire suppression system verification on the date indicated.",
    },
}


def _t(langue, cle):
    return I18N[cle].get(langue, I18N[cle]["fr"])


# ── Traduction des valeurs de menus déroulants (format, type, marque,
# longueur) — distinctes des libellés d'interface : ce sont les valeurs de
# données choisies par le technicien, affichées dans les documents générés.
CHOIX_I18N = {
    "format": {
        "2.5lb": {"fr": "2.5 lb", "en": "2.5 lb"}, "5lb": {"fr": "5 lb", "en": "5 lb"},
        "10lb": {"fr": "10 lb", "en": "10 lb"}, "13.25lb": {"fr": "13.25 lb", "en": "13.25 lb"},
        "20lb": {"fr": "20 lb", "en": "20 lb"}, "2.5kg": {"fr": "2.5 kg", "en": "2.5 kg"},
        "5kg": {"fr": "5 kg", "en": "5 kg"}, "10kg": {"fr": "10 kg", "en": "10 kg"},
        "6L": {"fr": "6 L", "en": "6 L"}, "autre": {"fr": "Autre", "en": "Other"},
    },
    "type_extincteur": {
        "ABC": {"fr": "Poudre ABC", "en": "ABC Powder"}, "BC": {"fr": "Poudre BC", "en": "BC Powder"},
        "CO2": {"fr": "CO2", "en": "CO2"}, "EAU": {"fr": "Eau", "en": "Water"},
        "AFFF": {"fr": "Mousse (AFFF)", "en": "Foam (AFFF)"},
        "K": {"fr": "Produits chimiques humides (K)", "en": "Wet chemical (K)"},
        "halotron": {"fr": "Halotron", "en": "Halotron"}, "fe36": {"fr": "FE36", "en": "FE36"},
        "autre": {"fr": "Autre", "en": "Other"},
    },
    "marque": {
        "amerex": {"fr": "Amerex", "en": "Amerex"}, "kidde": {"fr": "Kidde", "en": "Kidde"},
        "buckeye": {"fr": "Buckeye", "en": "Buckeye"}, "ansul": {"fr": "Ansul", "en": "Ansul"},
        "general": {"fr": "General", "en": "General"}, "flag": {"fr": "Flag", "en": "Flag"},
        "strikefirst": {"fr": "Strike First", "en": "Strike First"}, "autre": {"fr": "Autre", "en": "Other"},
    },
    "longueur": {
        "50pi": {"fr": "50 pi", "en": "50 ft"}, "75pi": {"fr": "75 pi", "en": "75 ft"},
        "100pi": {"fr": "100 pi", "en": "100 ft"}, "autre": {"fr": "Autre", "en": "Other"},
    },
}


def _td(langue, categorie, code):
    """Traduit une valeur de choix de données (ex. marque, format) — retourne
    le code tel quel si non trouvé, pour ne jamais planter sur une valeur
    inattendue."""
    if not code:
        return code
    entree = CHOIX_I18N.get(categorie, {}).get(code)
    if not entree:
        return code
    return entree.get(langue, entree["fr"])


# ── Labels complets E2 ────────────────────────────────────────────────────
E2_ITEMS = {
    "e2_1": [
        ("A",  "Fonctionnement de l'indicateur visuel de mise sous tension"),
        ("B",  "Fonctionnement du signal de défectuosité visuel commun"),
        ("C",  "Fonctionnement du signal de défectuosité sonore commun"),
        ("D",  "Fonctionnement de l'interrupteur de signalisation sonore de défectuosité"),
        ("E",  "Fonctionnement du signal de défectuosité de l'alimentation principale"),
        ("F",  "Fuite à la terre sur signal de défectuosité positif et négatif"),
        ("G",  "Fonctionnement du signal d'alerte"),
        ("H",  "Fonctionnement du signal d'alarme"),
        ("I",  "Fonctionnement du passage automatique de signal d'alerte à signal d'alarme"),
        ("J",  "Fonctionnement du passage manuel de signal d'alerte à signal d'alarme"),
        ("K",  "Caractéristique d'annulation du passage automatique de signal d'alerte à signal d'alarme fonctionnant sur un réseau à deux étapes"),
        ("L",  "Fonctionnement de la désactivation de l'interruption du signal d'alarme sonore"),
        ("M",  "Fonctionnement de l'interruption manuelle du signal d'alarme sonore"),
        ("N",  "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore"),
        ("O",  "Déclenchement automatique du signal d'alarme sonore, après interruption, en cas de réception d'alarme subséquente"),
        ("P",  "Temporisation automatique d'annulation du signal d'alarme sonore"),
        ("Q",  "Signaux d'alerte et d'alarme sonores et visuels programmés et fonctionnant conformément à la conception et aux spécifications"),
        ("R",  "Fonctionnement d'alarme et de surveillance du circuit d'entrée, y compris les indications sonores et visuelles"),
        ("S",  "La surveillance des défauts sur un circuit d'entrée entraîne une indication de défectuosité"),
        ("T",  "Fonctionnement des indicateurs d'alarme du circuit de sortie"),
        ("U",  "La surveillance des défauts sur un circuit de sortie entraîne une indication de défectuosité"),
        ("V",  "Essai d'indicateur visuel (essai de lampe)"),
        ("W",  "Séquences de signal codé fonctionnant au moins le nombre de fois nécessaire et suivies d'un déclenchement de signal d'alarme approprié"),
        ("X",  "Séquences de signal codé non interrompues par une alarme subséquente"),
        ("Y",  "Une dérivation du dispositif auxiliaire provoque un signal de défectuosité"),
        ("Z",  "Fonctionnement du circuit d'entrée vers le circuit de sortie, y compris les circuits des dispositifs auxiliaires, pour assurer le bon fonctionnement du programme"),
        ("AA", "Fonctionnement du réarmement du réseau avertisseur d'incendie"),
        ("BB", "Fonctionnement de la commutation de l'alimentation principale à l'alimentation de secours"),
        ("CC", "Vérification de la confirmation du changement d'état (détecteurs de fumée seulement ; se reporter au paragraphe 5.4.7.3)"),
        ("DD", "Réception de la transmission d'un signal d'alarme à la centrale de réception d'alarme incendie"),
        ("EE", "Réception de la transmission d'un signal de surveillance à la centrale de réception d'alarme incendie"),
        ("FF", "Réception de la transmission d'un signal de défectuosité à la centrale de réception d'alarme incendie"),
        ("GG", "Nom et numéro de téléphone de la centrale de réception d'alarme incendie"),
        ("HH", "Le déclenchement du sectionneur de la centrale de réception d'alarme incendie produit une indication de défectuosité précise au poste de contrôle et achemine un signal de défectuosité à la centrale"),
    ],
    "e2_2": [
        ("A",  "Fonctionnement de l'indicateur de mise sous tension"),
        ("B",  "Fonctionnement du signal de défectuosité visuel commun"),
        ("C",  "Fonctionnement du signal de défectuosité sonore commun"),
        ("D",  "Fonctionnement de l'interrupteur de signalisation sonore de défectuosité"),
        ("E",  "Fonctionnement de la recherche phonique générale de personnes, y compris l'indication visuelle"),
        ("F",  "Fonctionnement des circuits de sortie en cas de recherche phonique sélective de personnes, y compris l'indication visuelle"),
        ("G",  "Fonctionnement des circuits de sortie pour défectuosité de recherche phonique sélective de personnes, y compris l'indication visuelle"),
        ("H",  "Fonctionnement du microphone, y compris bouton de communication"),
        ("I",  "Fonctionnement de la recherche de personnes ne nuisant pas à la temporisation initiale de désactivation de la signalisation sonore d'alerte et d'alarme"),
        ("J",  "Fonctionnement de la recherche générale de personnes"),
        ("K",  "Passage automatique à un amplificateur de relève en cas de panne d'un amplificateur normal"),
        ("L",  "Circuits de réception d'appel d'un téléphone d'urgence, y compris les indications sonores et visuelles"),
        ("M",  "Fonctionnement des circuits des téléphones d'urgence, y compris les communications phoniques bidirectionnelles"),
        ("N",  "Fonctionnement des circuits de signalisation de défectuosité des téléphones d'urgence, y compris l'indication visuelle"),
        ("O",  "Fonctionnement des communications verbales par téléphone d'urgence"),
        ("P",  "Fonctionnement de la tonalité d'utilisation ou de disponibilité des téléphones d'urgence, au combiné"),
    ],
    "e2_3": [
        ("A",  "Désignations du circuit d'entrée correctement indiquées et correspondant aux dispositifs raccordés"),
        ("B",  "Désignations du circuit de sortie correctement repérées et correspondant à celles des dispositifs raccordés"),
        ("C",  "Désignations des fonctions de contrôle communes et des indicateurs communs correctes"),
        ("D",  "Composants enfichables et modules solidement en place"),
        ("E",  "Câbles enfichables solidement en place"),
        ("F",  "Date, version et révision des microprogrammes et des programmes logiciels consignés"),
        ("G",  "Propre et exempt de poussière et de saleté"),
        ("H",  "Fusibles conformes aux spécifications des fabricants"),
        ("I",  "Verrouillage du poste de contrôle ou du répondeur"),
        ("J",  "Solidité des connexions du câblage aux dispositifs"),
    ],
    "e2_4": [
        ("A",  "Protection fusible correspondant aux caractéristiques nominales affichées par le fabricant"),
        ("B",  "Alimentation suffisante pour les besoins du réseau"),
    ],
    "e2_5": [
        ("A",  "Type de batterie recommandée par le fabricant"),
        ("B",  "Caractéristiques nominales suffisantes après des calculs fondés sur la pleine charge du réseau"),
        ("C",  "Tension de batterie lorsque la source d'alimentation principale est sous tension"),
        ("D",  "Tension et courant de batterie, alimentation principale coupée, mode surveillance"),
        ("E",  "Tension et courant de batterie, alimentation principale coupée, pleine charge"),
        ("F",  "Courant de charge"),
        ("G",  "Absence de dommages matériels"),
        ("H",  "Bornes nettoyées et lubrifiées"),
        ("I",  "Bornes serrées"),
        ("J",  "Niveau d'électrolyte correct"),
        ("K",  "Densité de l'électrolyte conforme aux spécifications du fabricant"),
        ("L",  "Aucune fuite d'électrolyte"),
        ("M",  "Ventilation adéquate"),
        ("N",  "Code dateur du fabricant ou date de mise en service"),
        ("O",  "Débranchement provoque signal de défectuosité"),
        ("Q",  "Capacité de la batterie calculée"),
        ("R",  "Après la fin des essais, tension aux bornes de la batterie"),
        ("S",  "Après les essais, la tension de la batterie n'est pas inférieure à 85 % de la tension nominale"),
        ("T",  "Le générateur fournit l'alimentation au circuit C.A. qui dessert le réseau avertisseur d'incendie"),
        ("U",  "Une situation de défectuosité au générateur d'urgence provoque un signal de défectuosité sonore commun ainsi qu'une indication visuelle"),
    ],
    "e2_6": [
        ("A",  "Fonctionnement de l'indicateur de mise sous tension"),
        ("B",  "Zones d'entrée individuelles d'alarme et de surveillance indiquées clairement, de manière distincte"),
        ("C",  "Étiquettes de désignation des zones individuelles d'alarme et de surveillance correctement marquées"),
        ("D",  "Fonctionnement du signal de défectuosité commun"),
        ("E",  "Fonctionnement de l'essai d'indicateur visuel (essai de lampe)"),
        ("F",  "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur"),
        ("G",  "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore"),
        ("H",  "Contacts des fonctions auxiliaires fonctionnant conformément à la conception et aux spécifications"),
        ("I",  "Fonctionnement des autres indicateurs visuels des fonctions auxiliaires"),
        ("J",  "Actionnement manuel du signal d'alarme et indication"),
        ("K",  "Affichages visibles dans le lieu de l'installation"),
        ("L",  "Fonctionnement sur l'alimentation de secours"),
    ],
    "e2_7": [
        ("A",  "Fonctionnement de l'indicateur de mise sous tension"),
        ("B",  "Fonctionnement de l'indication de zone individuelle d'alarme et de surveillance"),
        ("C",  "Étiquettes de désignation des zones individuelles d'alarme et de surveillance correctement marquées"),
        ("D",  "Fonctionnement du signal de défectuosité commun"),
        ("E",  "Fonctionnement de l'essai d'indicateur visuel (essai de lampe)"),
        ("F",  "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur"),
        ("G",  "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore"),
        ("H",  "Contacts des fonctions auxiliaires fonctionnant conformément à la conception et aux spécifications"),
        ("I",  "Fonctionnement des autres indicateurs visuels des fonctions auxiliaires"),
        ("J",  "Actionnement manuel du signal d'alarme et indication"),
        ("K",  "Affichages visibles dans le lieu de l'installation"),
    ],
    "e2_8": [
        ("A",  "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur"),
        ("B",  "Fonctionnement du signal visuel de défectuosité"),
        ("C",  "Fonctionnement du signal sonore de défectuosité"),
        ("D",  "Fonctionnement de l'interruption du signal sonore de défectuosité"),
    ],
    "e2_9": [
        ("A",  "Fonctionnement de l'imprimante selon la conception et les spécifications"),
        ("B",  "Impression correcte de la zone de chaque dispositif de déclenchement d'alarme"),
        ("C",  "Alimentation à la tension nominale"),
    ],
    "e2_10": [
        ("A",     "Confirmer la réception d'un signal de défectuosité par le poste de contrôle en cas de boucle ouverte pour chaque liaison de données"),
        ("B",     "Si des modules d'isolation en cas de défaut font partie de liaisons de données, court-circuiter le câblage et confirmer l'annonce de la défectuosité"),
        ("C_i",   "Poste de contrôle et poste de contrôle"),
        ("C_ii",  "Poste de contrôle et répondeur"),
        ("C_iii", "Répondeur et répondeur"),
    ],
}


# ── Permissions ──────────────────────────────────────────────────────────
class EstSuperviseur(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.est_superviseur())


class EstSuperviseurOuTechnicien(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and (request.user.est_superviseur() or request.user.est_technicien())
        )


# ── Client ───────────────────────────────────────────────────────────────
class ClientViewSet(viewsets.ModelViewSet):
    """Gestion des entreprises clientes — réservée au superviseur."""

    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]
    pagination_class = PaginationSiDemandee

    def get_queryset(self):
        qs = Client.objects.filter(organisation=self.request.user.organisation)
        type_client = self.request.query_params.get("type")
        if type_client in ("entreprise", "particulier"):
            qs = qs.filter(type_client=type_client)
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(nom__icontains=q) | Q(contact_nom__icontains=q) | Q(contact_email__icontains=q)
            )
        return qs.order_by("nom")

    def perform_create(self, serializer):
        serializer.save(organisation=self.request.user.organisation)

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response({"total": Client.objects.filter(organisation=request.user.organisation).count()})


# ── Bâtiment ─────────────────────────────────────────────────────────────
class BatimentViewSet(viewsets.ModelViewSet):
    serializer_class = BatimentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PaginationSiDemandee

    def get_queryset(self):
        user = self.request.user
        qs = Batiment.objects.select_related("client").filter(client__organisation=user.organisation)
        if user.est_citoyen():
            qs = qs.filter(proprietaire=user)
        elif user.est_technicien():
            qs = qs.filter(rapports__techniciens=user).distinct()

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(numero_civique__icontains=q) | Q(rue__icontains=q) | Q(ville__icontains=q) | Q(client__nom__icontains=q)
            )

        qs = qs.distinct().order_by("client__nom", "rue")

        # `taille` est une propriété Python (déduite du nombre d'extincteurs),
        # pas une colonne — impossible à filtrer directement en base. Évalué
        # ici en Python puis réappliqué en `id__in` pour garder la pagination
        # et le count() cohérents en aval.
        taille = self.request.query_params.get("taille")
        if taille:
            ids = [b.id for b in qs if b.taille == taille]
            qs = qs.filter(id__in=ids)

        return qs

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        """Total indépendant de la recherche `q` (mais respecte le filtre
        `client`, comme le reste de la liste) — pour l'en-tête de la page."""
        user = request.user
        qs = Batiment.objects.filter(client__organisation=user.organisation)
        if user.est_citoyen():
            qs = qs.filter(proprietaire=user)
        elif user.est_technicien():
            qs = qs.filter(rapports__techniciens=user).distinct()
        client_id = request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return Response({"total": qs.distinct().count()})

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        if self.action in ["documents_a_envoyer", "envoyer_documents"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        # Le dossier du bâtiment (documents figés, preuves d'envoi) est conservé
        # en cas de litige : un bâtiment qui en a un ne se supprime pas.
        if instance.archives.exists() or instance.envois.exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError({
                "error": "Ce bâtiment a un dossier d'inspection (documents archivés ou envois au client) : "
                         "il ne peut pas être supprimé, pour conserver les preuves en cas de litige."
            })
        instance.delete()

    @action(detail=True, methods=["get"], url_path="documents-a-envoyer")
    def documents_a_envoyer(self, request, pk=None):
        from .emailing import _documents_prets_directs
        from .models import Client

        batiment = self.get_object()
        client = batiment.client
        mode_direct = client.mode_livraison == Client.ModeLivraison.DIRECT
        elements = _documents_prets_directs(batiment) if mode_direct else []
        return Response({
            "mode_direct": mode_direct,
            "contact_email": client.contact_email if mode_direct else None,
            "count": len(elements),
            "nb_rapports": sum(el["nb_rapports"] for el in elements),
            "nb_certificats": sum(el.get("nb_certificats", 1) for el in elements),
            "labels": [el["label"] for el in elements],
        })

    @action(detail=True, methods=["post"], url_path="envoyer-documents")
    def envoyer_documents(self, request, pk=None):
        from .emailing import envoyer_certificats_directs_batiment

        batiment = self.get_object()

        pieces_jointes = lire_pieces_jointes(request)
        ok, message = envoyer_certificats_directs_batiment(batiment, request.user, pieces_jointes=pieces_jointes)
        if not ok:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": message})


def _html_certificat_incendie(rapport) -> str:
    """HTML du certificat d'inspection annuelle (réseau d'alarme incendie) —
    même chrome (ligne rouge, bandeau noir, pied de page bouclier) que le
    certificat extincteurs, avec son propre contenu (inventaire des
    dispositifs + conformité E1)."""
    from .certificats import avec_qr, code_integrite_simple, url_verification_jeton
    from .pdf_design import CSS_DOCUMENT, ICONE_CALENDRIER, ICONE_PERSONNE, ICONE_PIN, entete, icone, pied_de_page

    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f"  {bat.code_postal}"
    langue = bat.client.organisation.langue
    t = lambda cle: _t(langue, cle)

    date_insp = _date_fr(rapport.date_inspection)
    date_cert = _date_fr(cert.date_emission)
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in techniciens) or "—"
    e1 = rapport.fiche_e1 if hasattr(rapport, "fiche_e1") else None

    dispositifs = list(rapport.dispositifs.all())
    type_counts = Counter(d.get_type_dispositif_display() or "—" for d in dispositifs)
    total = sum(type_counts.values())

    inv_rows = "".join(
        f"<tr><td>{ty}</td><td class='center bold'>{c}</td></tr>"
        for ty, c in sorted(type_counts.items())
    ) or "<tr><td colspan='2' class='muted center'>Aucun dispositif enregistré</td></tr>"

    def conf_item(condition, label):
        ok = condition and bool(condition)
        ic = "✔" if ok else "✖"
        color = "#0d6b4f" if ok else "#e11324"
        return f"<div class='conf-item'><span style='color:{color};font-weight:900;font-size:11pt;flex-shrink:0;'>{ic}</span><span>{label}</span></div>"

    conf_html = ""
    if e1:
        conf_html += conf_item(e1.inspection_essai_conforme, "Inspection et mise à l'essai conforme à la norme CAN/ULC-S536")
        conf_html += conf_item(e1.reseau_fonctionnel, "Réseau surveillé complètement fonctionnel")
        conf_html += conf_item(not e1.lacunes_constatees if e1.lacunes_constatees is not None else None, "Aucune lacune constatée sur le réseau")
        conf_html += conf_item(e1.documentation_sur_place, "Documentation du réseau présente sur place")
        if e1.commentaires:
            conf_html += f"<div style='margin-top:6px;font-size:8.5pt;color:#555;font-style:italic;'>Commentaires : {e1.commentaires}</div>"

    logo_content = organisation_logo_content(bat.client.organisation, 46)
    organisation_nom = bat.client.organisation.nom
    emetteur = cert.emis_par.get_full_name() or cert.emis_par.username if cert.emis_par else "—"
    conforme = cert.conforme
    conf_badge_bg = "#dcfce7" if conforme else "#fee2e2"
    conf_badge_color = "#16a34a" if conforme else "#e11324"
    conf_badge_texte = t("conforme_badge") if conforme else t("non_conforme_badge")

    entete_html = entete(
        logo_content, organisation_nom, f"{t('inspection_certification')} — Norme CAN/ULC-S536",
        t("certificat_no"), cert.numero, t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{t("certificat_no")} {cert.numero}</title>
<style>{CSS_DOCUMENT}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:20px 24px;">
{entete_html}
<div class="title-banner">
  <h2>Certificat d'inspection annuelle</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
  <p>Réseau d'alarme incendie — CAN/ULC-S536</p>
</div>
<div style="text-align:center;margin-bottom:14px;">
  <span style="display:inline-block;background:{conf_badge_bg};border:1.5px solid {conf_badge_color};color:{conf_badge_color};font-size:11pt;font-weight:900;letter-spacing:2px;padding:5px 22px;border-radius:100px;">{conf_badge_texte}</span>
  {'<p style="margin-top:6px;font-size:8pt;color:#e11324;">Des réparations sont requises avant que ce certificat ne soit conforme.</p>' if not conforme else ''}
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:11pt;">{bat.client.nom}</div>
</div>
<div style="text-align:center;margin-bottom:6px;">
  <div class="card-title">{t("adresse_inspectee")}</div>
</div>
<div class="info-card" style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:18px;">
  <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f1f5f9;flex-shrink:0;">{icone(ICONE_PIN, 16, '#6b7280')}</span>
  <div class="card-main" style="font-size:20pt; font-weight:900;">{adresse}</div>
</div>
<div class="sec-title">Inventaire des dispositifs</div>
<table>
  <thead><tr><th>Type de dispositif</th><th class="center">Qté</th></tr></thead>
  <tbody>{inv_rows}<tr style="font-weight:700;background:#f8fafc;border-top:1.5px solid #e5e7eb;"><td>Total</td><td class="center bold">{total}</td></tr></tbody>
</table>
<div class="sec-title">Conformité — Mise à l'essai</div>
<div class="conf-box">{conf_html or '<p style="color:#9ca3af;font-style:italic;font-size:9pt;">Données E1 non disponibles.</p>'}</div>
{avec_qr(f'''<div class="sig-row">
  <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
    <span class="sig-icon">{icone(ICONE_PERSONNE, 14, '#e11324')}</span>
    <div>
      <div class="sig-label">Superviseur / Responsable</div>
      <div class="sig-name">{emetteur}</div>
      <div style="font-size:8pt;color:#555;">{organisation_nom}</div>
    </div>
  </div>
  <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
    <span class="sig-icon">{icone(ICONE_CALENDRIER, 14, '#e11324')}</span>
    <div>
      <div class="sig-label">Date d'émission</div>
      <div class="sig-name">{date_cert}</div>
      <div style="font-size:8pt;color:#555;">{t("certificat_no")} {cert.numero}</div>
    </div>
  </div>
</div>''', bat.client.organisation, url_verification_jeton(cert.jeton), code_integrite_simple(cert))}
{pied_de_page(organisation_nom, t("footer_certificat_incendie"))}
</div>
</body>
</html>"""


def _html_rapport_incendie_complet(rapport) -> str:
    """HTML du rapport technique complet (E1 + E2 + légende + E3) — même
    chrome (ligne rouge, bandeau noir, pied de page bouclier) que le
    certificat, avec le contenu technique détaillé."""
    from .pdf_design import CSS_DOCUMENT, ICONE_PIN, entete, icone, pied_de_page

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    fabricant_panneau = bat.fabricant_reseau or "—"
    modele_panneau = bat.modele_systeme or "—"
    langue = bat.client.organisation.langue
    t = lambda cle: _t(langue, cle)
    date_insp = _date_fr(rapport.date_inspection)
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in techniciens) or "—"

    e1 = rapport.fiche_e1 if hasattr(rapport, "fiche_e1") else None
    e2 = rapport.fiche_e2 if hasattr(rapport, "fiche_e2") else None
    legende = rapport.fiche_legende.dispositifs if hasattr(rapport, "fiche_legende") else {}
    dispositifs = list(rapport.dispositifs.select_related("section").all())

    type_counts = Counter(d.get_type_dispositif_display() or "—" for d in dispositifs)
    total_disp = sum(type_counts.values())
    inv_rows = "".join(
        f"<tr><td>{ty}</td><td class='center bold'>{c}</td></tr>"
        for ty, c in sorted(type_counts.items())
    ) or "<tr><td colspan='2' class='muted center'>Aucun dispositif</td></tr>"

    e1_html = ""
    if e1:
        CHAMPS_E1 = [
            ("A", "Fonctionnement en une étape",                        e1.fonctionnement_une_etape),
            ("B", "Fonctionnement en deux étapes",                      e1.fonctionnement_deux_etapes),
            ("C", "Inspection et mise à l'essai (CAN/ULC-S536)",       e1.inspection_essai_conforme),
            ("D", "Documentation du réseau sur place",                  e1.documentation_sur_place),
            ("E", "Réseau fonctionnel",                                 e1.reseau_fonctionnel),
            ("F", "Lacunes constatées",                                 e1.lacunes_constatees),
            ("H", "Copie remise au responsable",                        e1.copie_remise_responsable),
        ]
        rows = "".join(
            f"<tr><td class='bold' style='width:30px;'>{l}</td><td>{label}</td><td class='center'>{_val_oui_non(v)}</td></tr>"
            for l, label, v in CHAMPS_E1
        )
        e1_html = f"""<div class="sec-title">E1 — Rapport annuel de mise à l'essai</div>
<table class="data-grid"><thead><tr><th></th><th>Champ</th><th class='center'>Valeur</th></tr></thead><tbody>{rows}</tbody></table>
{'<div class="comment-box"><strong>Commentaires :</strong> ' + (e1.commentaires or '—') + '</div>' if e1 else ''}"""

    e2_html = ""
    e2_parts = []
    for key, titre in E2_TITRES.items():
        sec_data = (e2.details or {}).get(key, {}) if (e2 and e2.details) else {}
        items_defs = E2_ITEMS.get(key, [])
        loc = sec_data.get("localisation", "")
        loc_str = f" <span style='font-size:8pt;color:#444;'>({loc})</span>" if loc else ""
        if key in ("e2_11", "e2_12"):
            val = sec_data.get("remarques", "")
            content = f"<p style='font-size:9pt;color:#111;padding:4px 0;'>{val or '—'}</p>"
        else:
            rows = "".join(
                f"<tr>"
                f"<td class='bold' style='width:36px;vertical-align:top;'>{iid}</td>"
                f"<td style='line-height:1.4;'>{lbl}</td>"
                f"<td class='center' style='width:64px;vertical-align:top;'>{_val_so(sec_data.get(iid))}</td>"
                f"</tr>"
                for iid, lbl in items_defs
            )
            content = (
                f"<table class='data-grid'><thead><tr>"
                f"<th style='width:36px;'></th>"
                f"<th>Élément vérifié</th>"
                f"<th class='center' style='width:64px;'>Résultat</th>"
                f"</tr></thead><tbody>{rows}</tbody></table>"
            )
        e2_parts.append(
            f"<div style='margin-bottom:14px;page-break-inside:avoid;'>"
            f"<div class='sec-sub'>{titre}{loc_str}</div>"
            f"{content}"
            f"</div>"
        )
    if e2_parts:
        e2_html = '<div class="sec-title">E2 — Essai du poste de contrôle</div>' + "".join(e2_parts)

    legende_rows = "".join(
        f"<tr><td class='bold'>{code}</td><td>{desc}</td>"
        f"<td>{(legende.get(code) or {}).get('type') or '—'}</td>"
        f"<td>{(legende.get(code) or {}).get('modele') or '—'}</td></tr>"
        for code, desc in LEGENDE_DISPOSITIFS
    )
    legende_html = (
        '<div class="sec-title">Légende des dispositifs</div>'
        "<table class='data-grid'><thead><tr><th>Dispositif</th><th>Description</th><th>Type</th><th>No de modèle</th></tr></thead>"
        f"<tbody>{legende_rows}</tbody></table>"
    )

    sections_html = ""
    for section in rapport.sections.prefetch_related("dispositifs").all():
        devs = list(section.dispositifs.all())
        if not devs:
            continue
        rows = ""
        for d in devs:
            is_defect = d.est_defectueux
            is_ni = not is_defect and d.annonce_statut == "NI"
            bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
            a = "1" if d.installation_correcte is True else "S.O." if d.installation_correcte is None else "0"
            b = "1" if d.necessite_entretien is True else "S.O." if d.necessite_entretien is None else "0"
            c_val = "1" if d.alarme_confirmee is True else "S.O." if d.alarme_confirmee is None else "0"
            d_val = d.annonce_statut or "—"
            e_val = d.zone_circuit or "—"
            loc_style = ' style="color:#cc0000;font-weight:700;"' if is_defect else ' style="color:#b45309;font-weight:700;"' if is_ni else ""
            rows += (
                f"<tr{bg}>"
                f"<td{loc_style}>{d.localisation}</td>"
                f"<td class='center bold'>{d.type_dispositif or '—'}</td>"
                f"<td class='center'>{a}</td>"
                f"<td class='center'>{b}</td>"
                f"<td class='center'>{c_val}</td>"
                f"<td class='center'>{d_val}</td>"
                f"<td class='center'>{e_val}</td>"
                f"<td>{d.remarque or ''}</td>"
                f"</tr>"
            )
        sections_html += (
            f"<div class='sec-sub'>{section.nom}</div>"
            f"<table class='data-grid'>"
            f"<thead><tr>"
            f"<th>Localisation</th>"
            f"<th class='center'>Type</th>"
            f"<th class='center' title='Installation correcte'>A</th>"
            f"<th class='center' title='Nécessite entretien'>B</th>"
            f"<th class='center' title='Alarme confirmée'>C</th>"
            f"<th class='center' title='D=Défectueux, I=Inspecté, NI=Non inspecté'>D</th>"
            f"<th class='center' title='Zone / Circuit'>E</th>"
            f"<th>Remarque</th>"
            f"</tr></thead>"
            f"<tbody>{rows}</tbody></table>"
        )
    if not sections_html:
        sections_html = "<p class='muted' style='font-size:9pt;'>Aucun dispositif enregistré.</p>"

    logo_content = organisation_logo_content(bat.client.organisation, 46)
    organisation_nom = bat.client.organisation.nom

    entete_html = entete(
        logo_content, organisation_nom, "Rapport d'inspection annuelle — CAN/ULC-S536",
        t("certificat_no"), (rapport.certificat.numero if hasattr(rapport, "certificat") else "—"),
        t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>Rapport d'inspection — {adresse}</title>
<style>{CSS_DOCUMENT}
  .info-grid{{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:20px 24px;">
{entete_html}
<div class="title-banner">
  <h2>Rapport d'inspection annuelle</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
  <p>Réseau d'alarme incendie — CAN/ULC-S536</p>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">Client</div>
  <div class="card-main" style="font-size:11pt;">{bat.client.nom}</div>
</div>
<div style="text-align:center;margin-bottom:6px;">
  <div class="card-title">Adresse inspectée</div>
</div>
<div class="info-card" style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px;">
  <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f1f5f9;flex-shrink:0;">{icone(ICONE_PIN, 16, '#6b7280')}</span>
  <div class="card-main" style="font-size:20pt; font-weight:900;">{adresse}</div>
</div>
<div class="info-grid">
  <div class="info-card">
    <div class="card-title">Fabricant du panneau</div>
    <div class="card-main">{fabricant_panneau}</div>
  </div>
  <div class="info-card">
    <div class="card-title">Modèle du panneau</div>
    <div class="card-main">{modele_panneau}</div>
  </div>
</div>
{e1_html}
{e2_html}
{legende_html}
<div class="sec-title">E3 — Inventaire global</div>
<table class="data-grid">
  <thead><tr><th>Type de dispositif</th><th class="center">Qté</th></tr></thead>
  <tbody>{inv_rows}<tr style="font-weight:700;background:#f8fafc;border-top:1.5px solid #e5e7eb;"><td>Total</td><td class="center bold">{total_disp}</td></tr></tbody>
</table>
<div class="sec-title">E3 — Détail par section</div>
<div style="font-size:7.5pt;color:#000;margin-bottom:8px;font-style:italic;">A = Installation correcte &nbsp;|&nbsp; B = Nécessite entretien &nbsp;|&nbsp; C = Alarme confirmée &nbsp;|&nbsp; D = Statut (D=Défectueux, I=Inspecté, NI=Non inspecté) &nbsp;|&nbsp; E = Zone/Circuit &nbsp;&nbsp;(A/B/C : 1 = Oui, 0 = Non)</div>
{sections_html}
{html_annexe_photos(rapport, t("photos_anomalies"), t("suite"))}
{pied_de_page(organisation_nom, t("footer_rapport_incendie"))}
</div>
</body>
</html>"""


def _filtrer_recherche_rapport(qs, q: str):
    """Recherche texte partagée par les 4 listes de rapports (incendie,
    extincteur, éclairage d'urgence, cuisine) — adresse, client, technicien —
    faite côté serveur pour rester correcte même paginée (le frontend ne voit
    jamais la liste complète pour filtrer en mémoire)."""
    q = q.strip()
    if not q:
        return qs
    return qs.filter(
        Q(batiment__numero_civique__icontains=q)
        | Q(batiment__rue__icontains=q)
        | Q(batiment__ville__icontains=q)
        | Q(batiment__client__nom__icontains=q)
        | Q(techniciens__username__icontains=q)
    ).distinct()


def _compteurs_statuts(qs) -> dict:
    """Compte ouverts/fermés sur le queryset de base (avant filtre de statut
    ou de recherche) — pour que les puces de filtre affichent toujours le
    total réel, indépendamment de la page ou de la recherche en cours."""
    return {
        "tous": qs.count(),
        "ouvert": qs.filter(statut="ouvert").count(),
        "ferme": qs.filter(statut="ferme").count(),
    }


# ── Rapport ──────────────────────────────────────────────────────────────
class EstModuleRapportIncendieActif(permissions.BasePermission):
    message = "Le module « Rapport d'inspection incendie » n'est pas activé pour votre organisation."

    def has_permission(self, request, view):
        organisation = getattr(request.user, "organisation", None)
        return bool(organisation and organisation.a_le_module("rapport_incendie"))


class RapportViewSet(PhotosRapportMixin, viewsets.ModelViewSet):
    champ_rapport_photo = "rapport_incendie"
    permission_classes = [permissions.IsAuthenticated, EstModuleRapportIncendieActif]
    pagination_class = RapportPagination

    def get_serializer_class(self):
        if self.action == "list":
            return RapportListSerializer
        if self.action == "create":
            return RapportCreateSerializer
        return RapportDetailSerializer

    def _queryset_de_base(self):
        user = self.request.user
        qs = Rapport.objects.select_related("batiment", "batiment__client", "cree_par", "citoyen").prefetch_related("techniciens").filter(batiment__client__organisation=user.organisation)

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        direction = self.request.query_params.get("direction")
        application = self.request.query_params.get("application")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)
        if direction:
            qs = qs.filter(batiment__direction__icontains=direction)
        if application:
            qs = qs.filter(batiment__type_application=application)

        return qs

    def get_queryset(self):
        qs = self._queryset_de_base()

        statut = self.request.query_params.get("statut")
        q = self.request.query_params.get("q")
        if statut:
            qs = qs.filter(statut=statut)
        if q:
            qs = _filtrer_recherche_rapport(qs, q)

        return qs.distinct().order_by(F("date_inspection").desc(nulls_last=True), "-id")

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def get_permissions(self):
        if self.action in ["create", "destroy", "reassigner", "rouvrir"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        if self.action in ["update", "partial_update"]:
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
            except (Batiment.DoesNotExist, TypeError, ValueError):
                return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_400_BAD_REQUEST)
            if nouveau_batiment.id != rapport.batiment_id:
                rapport.batiment = nouveau_batiment
                changements.append(f"Bâtiment changé pour {nouveau_batiment.adresse_complete}")

        if "techniciens" in request.data:
            rapport.techniciens.set(request.data.get("techniciens") or [])
            changements.append("Techniciens réassignés")

        if "citoyen" in request.data:
            citoyen_id = request.data.get("citoyen")
            if citoyen_id:
                try:
                    nouveau_citoyen = Utilisateur.objects.get(pk=citoyen_id, role=Utilisateur.Role.CITOYEN)
                except (Utilisateur.DoesNotExist, TypeError, ValueError):
                    return Response({"error": "Citoyen introuvable."}, status=status.HTTP_400_BAD_REQUEST)
                rapport.citoyen = nouveau_citoyen
                changements.append(f"Citoyen réassigné à {nouveau_citoyen.username}")
            else:
                rapport.citoyen = None
                changements.append("Citoyen retiré du rapport")

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != Rapport.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        # Crée automatiquement les fiches E1/E2/légende vides, prêtes à être remplies
        FicheE1.objects.create(rapport=rapport)
        FicheE2.objects.create(rapport=rapport)
        FicheLegende.objects.create(rapport=rapport)
        rapport.historiser(self.request.user, "Rapport créé")

        # Aucun rapport lié automatique : seules les cases cochées à la
        # création (et dont le module est actif) créent d'autres rapports
        # pour la même visite.
        libelle = "de système d'alarme"
        if _creer_rapport_extincteur_lie(rapport, self.request.user, self.request.data, libelle) is None:
            _creer_rapport_eclairage_seul(rapport, self.request.user, self.request.data, libelle)
        _creer_rapport_gicleur_lie(rapport, self.request.user, self.request.data, libelle)

        _envoyer_confirmation_planification_si_applicable(rapport, "Réseau d'alarme incendie")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == Rapport.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        ancienne_date = instance.date_inspection
        ancienne_prochaine = instance.prochaine_inspection
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")
        _envoyer_avis_changement_date_si_applicable(rapport, "Réseau d'alarme incendie", ancienne_date, ancienne_prochaine)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == Rapport.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut envoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != Rapport.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        client = rapport.batiment.client
        if client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import envoyer_certificats_directs_batiment

            ok, message = envoyer_certificats_directs_batiment(rapport.batiment, request.user, pieces_jointes=pieces_jointes)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        if pieces_jointes and not (rapport.citoyen and rapport.citoyen.email):
            return Response(
                {"error": "Impossible de joindre des fichiers : aucun citoyen avec courriel n'est assigné à ce rapport."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone

        rapport.certificat.certificat_envoye = True
        rapport.certificat.mode_envoi = rapport.certificat.ModeEnvoi.CITOYEN
        rapport.certificat.date_envoi = timezone.now()
        rapport.certificat.envoye_a = rapport.citoyen.username if rapport.citoyen else ""
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_disponible

            envoyer_email_certificat_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes)

        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["post"], url_path="renvoyer-certificat")
    def renvoyer_certificat(self, request, pk=None):
        """Renvoie un certificat déjà envoyé (client qui l'a perdu, etc.) —
        sans condition sur `certificat_envoye`, contrairement à
        `envoyer_certificat`. Si le rapport a été modifié depuis le dernier
        envoi, il faut d'abord le rouvrir puis le refermer (ce qui remet
        `certificat_envoye` à False automatiquement) plutôt que d'utiliser
        cette action."""
        rapport = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut renvoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        client = rapport.batiment.client
        if client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import renvoyer_document_direct

            ok, message = renvoyer_document_direct(rapport, "incendie", request.user, pieces_jointes=pieces_jointes)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        if not (rapport.citoyen and rapport.citoyen.email):
            return Response({"error": "Aucun citoyen avec courriel assigné à ce rapport."}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone

        rapport.certificat.mode_envoi = rapport.certificat.ModeEnvoi.CITOYEN
        rapport.certificat.date_envoi = timezone.now()
        rapport.certificat.envoye_a = rapport.citoyen.username
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat renvoyé au citoyen {rapport.citoyen.username}")

        from .emailing import envoyer_email_certificat_disponible

        envoyer_email_certificat_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes, type_envoi="renvoi")

        return Response({"message": "Certificat renvoyé au citoyen."})

    @action(detail=True, methods=["get", "patch"], url_path="fiche-e1")
    def fiche_e1(self, request, pk=None):
        rapport = self.get_object()
        if request.method == "GET":
            return Response(FicheE1Serializer(rapport.fiche_e1).data)

        if rapport.statut == Rapport.Statut.FERME and not request.user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = FicheE1Serializer(rapport.fiche_e1, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        rapport.historiser(request.user, "Fiche E1 modifiée")
        return Response(serializer.data)

    @action(detail=True, methods=["get", "patch"], url_path="fiche-e2")
    def fiche_e2(self, request, pk=None):
        rapport = self.get_object()
        if request.method == "GET":
            return Response(FicheE2Serializer(rapport.fiche_e2).data)

        if rapport.statut == Rapport.Statut.FERME and not request.user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = FicheE2Serializer(rapport.fiche_e2, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        rapport.historiser(request.user, "Fiche E2 modifiée")
        return Response(serializer.data)

    @action(detail=True, methods=["get", "patch"], url_path="fiche-legende")
    def fiche_legende(self, request, pk=None):
        rapport = self.get_object()
        fiche, _ = FicheLegende.objects.get_or_create(rapport=rapport)

        if request.method == "GET":
            return Response(FicheLegendeSerializer(fiche).data)

        if rapport.statut == Rapport.Statut.FERME and not request.user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = FicheLegendeSerializer(fiche, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"])
    def sections(self, request, pk=None):
        """Le technicien crée les sections dont il a besoin (ex. un étage à la fois)."""
        rapport = self.get_object()

        if request.method == "GET":
            return Response(SectionDispositifSerializer(rapport.sections.all(), many=True).data)

        if rapport.statut == Rapport.Statut.FERME and not request.user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SectionDispositifSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(rapport=rapport)
        rapport.historiser(request.user, f"Section ajoutée : {serializer.validated_data.get('nom')}")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def dispositifs(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(DispositifSerializer(rapport.dispositifs.all(), many=True).data)

        if rapport.statut == Rapport.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un dispositif."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = DispositifSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # La section (si fournie) doit appartenir à ce même rapport
        section = serializer.validated_data.get("section")
        if section and section.rapport_id != rapport.id:
            return Response({"error": "Cette section n'appartient pas à ce rapport."}, status=status.HTTP_400_BAD_REQUEST)

        serializer.save(rapport=rapport)
        rapport.historiser(request.user, f"Dispositif ajouté : {serializer.validated_data.get('localisation')}")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportSerializer(rapport.historique.all(), many=True).data)

    @action(detail=False, methods=["get"])
    def aujourdhui(self, request):
        """Rapports assignés au technicien connecté, pour la date du jour."""
        qs = self.get_queryset().filter(date_inspection=date.today())
        return Response(RapportListSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.get_queryset()
        return Response({
            "total": qs.count(),
            "ouverts": qs.filter(statut=Rapport.Statut.OUVERT).count(),
            "fermes": qs.filter(statut=Rapport.Statut.FERME).count(),
            "lacunes_ouvertes": Dispositif.objects.filter(
                rapport__in=qs, necessite_entretien=True
            ).count(),
        })

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != Rapport.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        html = _html_certificat_incendie(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        html = _html_rapport_incendie_complet(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"])
    def excel(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        techniciens = ", ".join(
            t.get_full_name() or t.username for t in rapport.techniciens.all()
        ) or "—"
        e1 = rapport.fiche_e1 if hasattr(rapport, "fiche_e1") else None
        e2 = rapport.fiche_e2 if hasattr(rapport, "fiche_e2") else None
        legende = rapport.fiche_legende.dispositifs if hasattr(rapport, "fiche_legende") else {}
        dispositifs = list(rapport.dispositifs.select_related("section").all())
        type_counts = Counter(d.get_type_dispositif_display() or "—" for d in dispositifs)

        def oui_non(v):
            return "Oui" if v is True else "Non" if v is False else "—"

        def so_valeur(v):
            if v == "oui": return "Oui"
            if v == "non": return "Non"
            if v == "sans_objet": return "S.O."
            return v or "—"

        wb = excel_workbook()
        ws = wb.active
        ws.title = "Rapport incendie"
        # Largeurs fixées d'avance : le document empile plusieurs tableaux à
        # nombre de colonnes différent (E1, E2, légende, E3...), donc on ne
        # peut pas ajuster automatiquement à la fin sur un seul tableau.
        for col, largeur in zip("ABCDEFGHI", [40, 60, 20, 20, 20, 20, 16, 16, 30]):
            ws.column_dimensions[col].width = largeur
        excel_entete_rapport(
            ws, organisation_nom=bat.client.organisation.nom, adresse=adresse,
            date_insp=_date_fr(rapport.date_inspection),
            statut=rapport.get_statut_display(), techniciens=techniciens,
        )

        ligne = 7

        # ── E1 — Rapport annuel de mise à l'essai ──────────────────────────
        if e1:
            champs_e1 = [
                ("Fonctionnement en une étape", e1.fonctionnement_une_etape),
                ("Fonctionnement en deux étapes", e1.fonctionnement_deux_etapes),
                ("Inspection et mise à l'essai (CAN/ULC-S536)", e1.inspection_essai_conforme),
                ("Documentation du réseau sur place", e1.documentation_sur_place),
                ("Réseau fonctionnel", e1.reseau_fonctionnel),
                ("Lacunes constatées", e1.lacunes_constatees),
                ("Copie remise au responsable", e1.copie_remise_responsable),
            ]
            ws.cell(row=ligne, column=1, value="E1 — Rapport annuel de mise à l'essai").font = Font(bold=True, color=NAVY, size=12)
            ligne += 1
            excel_ligne_entetes(ws, ["Champ", "Valeur"], ligne=ligne)
            for label, val in champs_e1:
                ligne += 1
                ws.cell(row=ligne, column=1, value=label)
                ws.cell(row=ligne, column=2, value=oui_non(val))
            ligne += 1
            ws.cell(row=ligne, column=1, value="Commentaires")
            ws.cell(row=ligne, column=2, value=e1.commentaires or "—")
            ligne += 2

        # ── E2 — Essai du poste de contrôle ─────────────────────────────────
        ws.cell(row=ligne, column=1, value="E2 — Essai du poste de contrôle").font = Font(bold=True, color=NAVY, size=12)
        ligne += 1
        for key, titre in E2_TITRES.items():
            sec_data = (e2.details or {}).get(key, {}) if (e2 and e2.details) else {}
            loc = sec_data.get("localisation", "")
            sous_titre = f"{titre} ({loc})" if loc else titre
            ws.cell(row=ligne, column=1, value=sous_titre).font = Font(bold=True, color=RED, size=10.5)
            ligne += 1
            if key in ("e2_11", "e2_12"):
                ws.cell(row=ligne, column=1, value="Remarques")
                ws.cell(row=ligne, column=2, value=sec_data.get("remarques") or "—")
                ligne += 2
                continue
            items_defs = E2_ITEMS.get(key, [])
            excel_ligne_entetes(ws, ["", "Élément vérifié", "Résultat"], ligne=ligne)
            for iid, lbl in items_defs:
                ligne += 1
                ws.cell(row=ligne, column=1, value=iid)
                ws.cell(row=ligne, column=2, value=lbl)
                ws.cell(row=ligne, column=3, value=so_valeur(sec_data.get(iid)))
            ligne += 2

        # ── Légende des dispositifs ──────────────────────────────────────────
        ws.cell(row=ligne, column=1, value="Légende des dispositifs").font = Font(bold=True, color=NAVY, size=12)
        ligne += 1
        excel_ligne_entetes(ws, ["Dispositif", "Description", "Type", "N° de modèle"], ligne=ligne)
        for code, desc in LEGENDE_DISPOSITIFS:
            ligne += 1
            infos = legende.get(code) or {}
            ws.cell(row=ligne, column=1, value=code)
            ws.cell(row=ligne, column=2, value=desc)
            ws.cell(row=ligne, column=3, value=infos.get("type") or "—")
            ws.cell(row=ligne, column=4, value=infos.get("modele") or "—")
        ligne += 2

        # ── E3 — Inventaire global ───────────────────────────────────────────
        ws.cell(row=ligne, column=1, value="E3 — Inventaire global").font = Font(bold=True, color=NAVY, size=12)
        ligne += 1
        excel_ligne_entetes(ws, ["Type de dispositif", "Quantité"], ligne=ligne)
        for t, c in sorted(type_counts.items()):
            ligne += 1
            ws.cell(row=ligne, column=1, value=t)
            ws.cell(row=ligne, column=2, value=c)
        ligne += 1
        ws.cell(row=ligne, column=1, value="Total").font = Font(bold=True)
        ws.cell(row=ligne, column=2, value=sum(type_counts.values())).font = Font(bold=True)
        ligne += 2

        # ── E3 — Détail par section ──────────────────────────────────────────
        ws.cell(row=ligne, column=1, value="E3 — Détail par section").font = Font(bold=True, color=NAVY, size=12)
        ligne += 1
        colonnes_disp = [
            "Section", "Localisation", "Type", "Installation correcte",
            "Nécessite entretien", "Alarme confirmée", "Statut", "Zone/Circuit", "Remarque",
        ]
        excel_ligne_entetes(ws, colonnes_disp, ligne=ligne)
        for section in rapport.sections.prefetch_related("dispositifs").all():
            for d in section.dispositifs.all():
                ligne += 1
                valeurs = [
                    section.nom, d.localisation, d.type_dispositif,
                    oui_non(d.installation_correcte), oui_non(d.necessite_entretien), oui_non(d.alarme_confirmee),
                    d.annonce_statut, d.zone_circuit, d.remarque,
                ]
                for col, valeur in enumerate(valeurs, start=1):
                    ws.cell(row=ligne, column=col, value=valeur)

        ws.freeze_panes = "A7"
        return excel_reponse(wb, excel_nom_fichier("Incendie", adresse))


# ── Section (regroupement de dispositifs) ───────────────────────────────
class SectionDispositifViewSet(viewsets.ModelViewSet):
    """Accès direct à une section — pour la renommer ou la supprimer."""

    serializer_class = SectionDispositifSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportIncendieActif]

    def get_queryset(self):
        user = self.request.user
        qs = SectionDispositif.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        section = self.get_object()
        if section.rapport.statut == Rapport.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


# ── Dispositif ───────────────────────────────────────────────────────────
class DispositifViewSet(viewsets.ModelViewSet):
    """Accès direct à un dispositif — surtout pour corriger une ligne."""

    serializer_class = DispositifSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportIncendieActif]

    def get_queryset(self):
        user = self.request.user
        qs = Dispositif.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        dispositif = self.get_object()
        if dispositif.rapport.statut == Rapport.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


def _html_certificat_extincteur(rapport) -> str:
    """HTML du certificat couvrant ce rapport extincteur — figé s'il est émis,
    sinon aperçu brouillon (voir certificats.py)."""
    from .certificats import html_certificat

    return html_certificat(rapport.certificat)


def _html_rapport_extincteur_complet(rapport) -> str:
    """HTML du rapport technique complet de vérification des extincteurs
    portatifs — même chrome que le certificat. Seul le certificat est
    partagé avec l'éclairage d'urgence et le système de cuisine liés (voir
    `_html_certificat_extincteur`) : chaque rapport technique reste
    spécifique à son propre système, dans son propre document
    (`_html_rapport_eclairage_complet`, `_html_rapport_cuisine_complet`)."""
    from .pdf_design import CSS_DOCUMENT, entete, pied_de_page

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    langue = bat.client.organisation.langue
    t = lambda cle: _t(langue, cle)

    date_insp = _date_fr(rapport.date_inspection)
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in techniciens) or "—"

    legende_html = _html_legende_non_conformites(langue)

    items = list(rapport.extincteurs.all())
    item_rows = ""
    for it in items:
        is_defect = it.etat == ExtincteurItem.Etat.DEFECTUEUX
        is_ni = not is_defect and it.etat == "NI"
        bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
        etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
        item_rows += (
            f"<tr{bg}>"
            f"<td class='center'>{it.ordre}</td>"
            f"<td>{it.etage or '—'}</td>"
            f"<td>{it.emplacement or '—'}</td>"
            f"<td class='center'>{_td(langue, 'type_extincteur', it.type_extincteur) or '—'}</td>"
            f"<td class='center'>{_td(langue, 'format', it.format) or '—'}</td>"
            f"<td>{_td(langue, 'marque', it.marque) or '—'}</td>"
            f"<td class='center'>{it.date_fabrication or '—'}</td>"
            f"<td class='center'>{it.prochaine_maintenance or '—'}</td>"
            f"<td class='center'>{it.prochain_test_hydrostatique or '—'}</td>"
            f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
            f"<td>{''.join(_PASTILLE_NC.format(c) for c in it.non_conformites)}"
            f"{' ' if it.non_conformites and it.remarque else ''}{escape(it.remarque or '')}</td>"
            f"</tr>"
        )
    if not item_rows:
        item_rows = f"<tr><td colspan='11' class='muted center'>{t('aucun_extincteur')}</td></tr>"

    boyaux = list(rapport.boyaux.all())
    boyau_rows = ""
    for b in boyaux:
        is_defect = b.etat == BoyauItem.Etat.DEFECTUEUX
        is_ni = not is_defect and b.etat == "NI"
        bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
        etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
        boyau_rows += (
            f"<tr{bg}>"
            f"<td class='center'>{b.ordre}</td>"
            f"<td>{b.etage or '—'}</td>"
            f"<td class='center bold'{etat_style}>{b.etat or '—'}</td>"
            f"<td>{b.emplacement or '—'}</td>"
            f"<td class='center'>{_td(langue, 'longueur', b.longueur) or '—'}</td>"
            f"<td class='center'>{b.date_fabrication or '—'}</td>"
            f"<td class='center'>{b.prochain_test_hydrostatique or '—'}</td>"
            f"<td>{b.remarque or ''}</td>"
            f"</tr>"
        )
    if not boyau_rows:
        boyau_rows = f"<tr><td colspan='8' class='muted center'>{t('aucun_boyau')}</td></tr>"

    logo_content = organisation_logo_content(bat.client.organisation, 46)
    organisation_nom = bat.client.organisation.nom

    entete_html = entete(
        logo_content, organisation_nom, f"{t('rapport_verification')} — {t('extincteurs_portatifs')}",
        t("certificat_no"), (rapport.certificat.numero if hasattr(rapport, "certificat") else "—"),
        t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{t("rapport_verification")} — {t("extincteurs_portatifs")} — {adresse}</title>
<style>{CSS_DOCUMENT}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:16px 20px;">
{entete_html}
<div class="title-banner">
  <h2>{t("rapport_verification")} — {t("extincteurs_portatifs")}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:10.5pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">{t("adresse")}</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
{legende_html}
<div class="sec-title">{t("detail_extincteurs")}</div>
<table class="data-grid">
  <thead><tr>
    <th>{t("col_no")}</th><th>{t("col_etage")}</th><th>{t("col_emplacement")}</th><th>{t("col_type")}</th><th>{t("col_format")}</th><th>{t("col_marque")}</th>
    <th>{t("col_date_fabrication")}</th><th>{t("col_prochaine_maintenance")}</th><th>{t("col_prochain_test_hydro")}</th>
    <th title="{t('etat_titre_abbr')}">{t("col_etat")}</th><th>{t("col_remarque")}</th>
  </tr></thead>
  <tbody>{item_rows}</tbody>
</table>
<div class="sec-title">{t("detail_boyaux")}</div>
<table class="data-grid">
  <thead><tr>
    <th>{t("col_no")}</th><th>{t("col_etage")}</th><th title="{t('etat_titre_abbr')}">{t("col_etat")}</th><th>{t("col_emplacement")}</th>
    <th>{t("col_longueur")}</th><th>{t("col_annee_fabrication")}</th><th>{t("col_prochain_test_hydro")}</th><th>{t("col_remarque")}</th>
  </tr></thead>
  <tbody>{boyau_rows}</tbody>
</table>
{html_annexe_photos(rapport, t("photos_anomalies"), t("suite"))}
{pied_de_page(organisation_nom, t("footer_rapport_extincteur"))}
</div>
</body>
</html>"""


# ── Rapport extincteurs portatifs ────────────────────────────────────────
class EstModuleRapportExtincteurActif(permissions.BasePermission):
    message = "Le module « Rapport extincteur » n'est pas activé pour votre organisation."

    def has_permission(self, request, view):
        organisation = getattr(request.user, "organisation", None)
        return bool(organisation and organisation.a_le_module("rapport_extincteur"))


class RapportExtincteurViewSet(PhotosRapportMixin, viewsets.ModelViewSet):
    champ_rapport_photo = "rapport_extincteur"
    permission_classes = [permissions.IsAuthenticated, EstModuleRapportExtincteurActif]
    pagination_class = RapportPagination

    def get_serializer_class(self):
        if self.action == "list":
            return RapportExtincteurListSerializer
        if self.action in ["create", "update", "partial_update"]:
            # Le superviseur peut réassigner les techniciens (ex. absence) —
            # RapportExtincteurDetailSerializer déclare `techniciens` en lecture
            # seule (affichage imbriqué), il faut le serializer d'écriture ici.
            return RapportExtincteurCreateSerializer
        return RapportExtincteurDetailSerializer

    def _queryset_de_base(self):
        user = self.request.user
        qs = RapportExtincteur.objects.select_related(
            "batiment", "batiment__client", "cree_par", "citoyen"
        ).prefetch_related("techniciens").filter(batiment__client__organisation=user.organisation)

        # Un brouillon auto-généré à la fermeture du précédent (voir
        # RapportExtincteur.fermer()) n'a ni date ni technicien tant qu'il
        # n'est pas planifié — il ne représente rien à faire pour personne
        # et doublerait la liste pour toujours (une visite fermée = un
        # brouillon en plus, indéfiniment). Sa place est dans « à planifier »
        # (/superviseur/tournees), pas ici — une fois planifié, il a une
        # date et redevient un rapport normal, visible comme les autres.
        qs = qs.exclude(rapport_precedent__isnull=False, date_inspection__isnull=True)

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)

        return qs

    def get_queryset(self):
        qs = self._queryset_de_base()

        statut = self.request.query_params.get("statut")
        q = self.request.query_params.get("q")
        if statut:
            qs = qs.filter(statut=statut)
        if q:
            qs = _filtrer_recherche_rapport(qs, q)

        return qs.distinct().order_by(F("date_inspection").desc(nulls_last=True), "-id")

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def get_permissions(self):
        if self.action in ["create", "destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            # Contrairement au rapport principal, le technicien n'a jamais besoin
            # d'écrire directement sur l'objet RapportExtincteur (il modifie les
            # lignes via l'action `extincteurs` / ExtincteurItemViewSet) — donc
            # batiment/techniciens/citoyen restent réservés au superviseur.
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
            except (Batiment.DoesNotExist, TypeError, ValueError):
                return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_400_BAD_REQUEST)
            if nouveau_batiment.id != rapport.batiment_id:
                rapport.batiment = nouveau_batiment
                changements.append(f"Bâtiment changé pour {nouveau_batiment.adresse_complete}")

        if "techniciens" in request.data:
            rapport.techniciens.set(request.data.get("techniciens") or [])
            changements.append("Techniciens réassignés")

        if "citoyen" in request.data:
            citoyen_id = request.data.get("citoyen")
            if citoyen_id:
                try:
                    nouveau_citoyen = Utilisateur.objects.get(pk=citoyen_id, role=Utilisateur.Role.CITOYEN)
                except (Utilisateur.DoesNotExist, TypeError, ValueError):
                    return Response({"error": "Citoyen introuvable."}, status=status.HTTP_400_BAD_REQUEST)
                rapport.citoyen = nouveau_citoyen
                changements.append(f"Citoyen réassigné à {nouveau_citoyen.username}")
            else:
                rapport.citoyen = None
                changements.append("Citoyen retiré du rapport")

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

        # Éclairage d'urgence et système de cuisine sont tous deux optionnels
        # — certaines compagnies ne font que l'extincteur pour un bâtiment
        # donné (voir _creer_rapport_eclairage_lie / _creer_rapport_cuisine_lie).
        _creer_rapport_eclairage_lie(rapport, self.request.user, self.request.data)
        _creer_rapport_cuisine_lie(rapport, self.request.user, self.request.data)
        _creer_rapport_alarme_lie(rapport, self.request.user, self.request.data, "extincteurs")
        _creer_rapport_gicleur_lie(rapport, self.request.user, self.request.data, "extincteurs")

        _envoyer_confirmation_planification_si_applicable(rapport, "Extincteurs portatifs")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        ancienne_date = instance.date_inspection
        ancienne_prochaine = instance.prochaine_inspection
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")
        _propager_date_aux_rapports_lies(rapport)
        _envoyer_avis_changement_date_si_applicable(rapport, "Extincteurs portatifs", ancienne_date, ancienne_prochaine)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut envoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)
        if rapport.certificat.statut != "emis":
            return Response({"error": "Le certificat doit d'abord être émis."}, status=status.HTTP_400_BAD_REQUEST)

        client = rapport.batiment.client
        if client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import envoyer_certificats_directs_batiment

            ok, message = envoyer_certificats_directs_batiment(rapport.batiment, request.user, pieces_jointes=pieces_jointes)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        if pieces_jointes and not (rapport.citoyen and rapport.citoyen.email):
            return Response(
                {"error": "Impossible de joindre des fichiers : aucun citoyen avec courriel n'est assigné à ce rapport."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils import timezone

        rapport.certificat.certificat_envoye = True
        rapport.certificat.mode_envoi = rapport.certificat.ModeEnvoi.CITOYEN
        rapport.certificat.date_envoi = timezone.now()
        rapport.certificat.envoye_a = rapport.citoyen.username if rapport.citoyen else ""
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_extincteur_disponible

            envoyer_email_certificat_extincteur_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes)

        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["post"], url_path="renvoyer-certificat")
    def renvoyer_certificat(self, request, pk=None):
        """Renvoie un certificat déjà envoyé — voir la note équivalente sur
        `RapportViewSet.renvoyer_certificat`."""
        rapport = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut renvoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        client = rapport.batiment.client
        if client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import renvoyer_document_direct

            ok, message = renvoyer_document_direct(rapport, "extincteur", request.user, pieces_jointes=pieces_jointes)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        if not (rapport.citoyen and rapport.citoyen.email):
            return Response({"error": "Aucun citoyen avec courriel assigné à ce rapport."}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone

        rapport.certificat.mode_envoi = rapport.certificat.ModeEnvoi.CITOYEN
        rapport.certificat.date_envoi = timezone.now()
        rapport.certificat.envoye_a = rapport.citoyen.username
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat renvoyé au citoyen {rapport.citoyen.username}")

        from .emailing import envoyer_email_certificat_extincteur_disponible

        envoyer_email_certificat_extincteur_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes, type_envoi="renvoi")

        return Response({"message": "Certificat renvoyé au citoyen."})

    @action(detail=True, methods=["get", "post"])
    def extincteurs(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(ExtincteurItemSerializer(rapport.extincteurs.all(), many=True).data)

        if rapport.statut == RapportExtincteur.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un extincteur."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ExtincteurItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.extincteurs.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Extincteur ajouté")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def boyaux(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(BoyauItemSerializer(rapport.boyaux.all(), many=True).data)

        if rapport.statut == RapportExtincteur.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un boyau."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BoyauItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.boyaux.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Boyau ajouté")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportExtincteurSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)
        if rapport.certificat.statut != "emis" and not (request.user.est_superviseur() or request.user.est_technicien()):
            return Response({"error": "Le certificat n'a pas encore été émis."}, status=status.HTTP_404_NOT_FOUND)

        html = _html_certificat_extincteur(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        html = _html_rapport_extincteur_complet(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"])
    def excel(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        langue = bat.client.organisation.langue
        t = lambda cle: _t(langue, cle)
        techniciens = ", ".join(
            t2.get_full_name() or t2.username for t2 in rapport.techniciens.all()
        ) or "—"

        wb = excel_workbook()
        ws = wb.active
        ws.title = t("extincteur_label")
        excel_entete_rapport(
            ws, organisation_nom=bat.client.organisation.nom, adresse=adresse,
            date_insp=_date_fr(rapport.date_inspection),
            statut=t('statut_ferme') if rapport.statut == 'ferme' else t('statut_ouvert'), techniciens=techniciens,
        )

        colonnes = [
            t("col_no"), t("col_etage"), t("col_emplacement"), t("col_type"), t("col_format"), t("col_marque"), t("col_numero_serie"),
            t("col_date_fabrication"), t("col_prochaine_maintenance"), t("col_prochain_test_hydro"),
            t("col_etat"), t("col_remarque"),
        ]
        ligne = excel_ligne_entetes(ws, colonnes, ligne=6)
        for it in rapport.extincteurs.all():
            ligne += 1
            valeurs = [
                it.ordre, it.etage, it.emplacement,
                _td(langue, 'type_extincteur', it.type_extincteur),
                _td(langue, 'format', it.format),
                _td(langue, 'marque', it.marque), it.numero_serie,
                it.date_fabrication, it.prochaine_maintenance, it.prochain_test_hydrostatique,
                it.etat, " ".join([*it.non_conformites, it.remarque]).strip(),
            ]
            for col, valeur in enumerate(valeurs, start=1):
                ws.cell(row=ligne, column=col, value=valeur)
        excel_ajuster_largeurs(ws, colonnes)
        ws.freeze_panes = "A7"

        ws2 = wb.create_sheet(t("boyaux_incendie_sheet"))
        excel_entete_rapport(
            ws2, organisation_nom=bat.client.organisation.nom, adresse=adresse,
            date_insp=_date_fr(rapport.date_inspection),
            statut=t('statut_ferme') if rapport.statut == 'ferme' else t('statut_ouvert'), techniciens=techniciens,
        )
        colonnes_boyaux = [
            t("col_no"), t("col_etage"), t("col_etat"), t("col_emplacement"), t("col_longueur"),
            t("col_annee_fabrication"), t("col_prochain_test_hydro"), t("col_remarque"),
        ]
        ligne2 = excel_ligne_entetes(ws2, colonnes_boyaux, ligne=6)
        for b in rapport.boyaux.all():
            ligne2 += 1
            valeurs2 = [
                b.ordre, b.etage, b.etat, b.emplacement,
                _td(langue, 'longueur', b.longueur),
                b.date_fabrication, b.prochain_test_hydrostatique, b.remarque,
            ]
            for col, valeur in enumerate(valeurs2, start=1):
                ws2.cell(row=ligne2, column=col, value=valeur)
        excel_ajuster_largeurs(ws2, colonnes_boyaux)
        ws2.freeze_panes = "A7"

        return excel_reponse(wb, excel_nom_fichier(t("extincteur_label"), adresse))


class ExtincteurItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne d'extincteur — pour la corriger ou la supprimer."""

    serializer_class = ExtincteurItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportExtincteurActif]

    def get_queryset(self):
        user = self.request.user
        qs = ExtincteurItem.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


class BoyauItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne de boyau — pour la corriger ou la supprimer."""

    serializer_class = BoyauItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportExtincteurActif]

    def get_queryset(self):
        user = self.request.user
        qs = BoyauItem.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


def _html_rapport_eclairage_complet(rapport) -> str:
    """HTML du rapport de vérification des unités d'éclairage d'urgence —
    même chrome (ligne rouge, bandeau noir, pied de page bouclier) que les
    autres documents de la plateforme."""
    from .pdf_design import CSS_DOCUMENT, entete, pied_de_page

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    langue = bat.client.organisation.langue
    t = lambda cle: _t(langue, cle)

    date_insp = _date_fr(rapport.date_inspection)
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in techniciens) or "—"

    items = list(rapport.eclairages_urgence.all())
    item_rows = ""
    for it in items:
        is_defect = it.etat == EclairageUrgenceItem.Etat.DEFECTUEUX
        is_ni = not is_defect and it.etat == "NI"
        bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
        etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
        item_rows += (
            f"<tr{bg}>"
            f"<td class='center'>{it.ordre}</td>"
            f"<td>{it.etage or '—'}</td>"
            f"<td>{it.emplacement or '—'}</td>"
            f"<td>{it.modele or '—'}</td>"
            f"<td>{it.voltage or '—'}</td>"
            f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
            f"<td>{it.remarque or ''}</td>"
            f"</tr>"
        )
    if not item_rows:
        item_rows = f"<tr><td colspan='7' class='muted center'>{t('aucune_unite')}</td></tr>"

    logo_content = organisation_logo_content(bat.client.organisation, 46)
    organisation_nom = bat.client.organisation.nom
    from .certificats import certificat_couvrant

    cert = certificat_couvrant(rapport)

    entete_html = entete(
        logo_content, organisation_nom, t("footer_rapport_eclairage"),
        t("certificat_no"), (cert.numero_affiche if cert else "—"),
        t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{t("footer_rapport_eclairage")} — {adresse}</title>
<style>{CSS_DOCUMENT}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:16px 20px;">
{entete_html}
<div class="title-banner">
  <h2>{t("footer_rapport_eclairage")}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:11pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">{t("adresse")}</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
<div class="sec-title">{t("detail_unites_eclairage")}</div>
<table class="data-grid">
  <thead><tr>
    <th>{t("col_no")}</th><th>{t("col_etage")}</th><th>{t("col_emplacement")}</th><th>{t("col_modele")}</th><th>{t("col_voltage")}</th>
    <th title="{t('etat_titre_abbr')}">{t("col_etat")}</th><th>{t("col_remarque")}</th>
  </tr></thead>
  <tbody>{item_rows}</tbody>
</table>
{html_annexe_photos(rapport, t("photos_anomalies"), t("suite"))}
{pied_de_page(organisation_nom, t("footer_rapport_eclairage"))}
</div>
</body>
</html>"""


class EstModuleRapportEclairageUrgenceActif(permissions.BasePermission):
    message = "Le module « Rapport éclairage d'urgence » n'est pas activé pour votre organisation."

    def has_permission(self, request, view):
        organisation = getattr(request.user, "organisation", None)
        return bool(organisation and organisation.a_le_module("rapport_eclairage_urgence"))


class RapportEclairageUrgenceViewSet(PhotosRapportMixin, viewsets.ModelViewSet):
    champ_rapport_photo = "rapport_eclairage"
    permission_classes = [permissions.IsAuthenticated, EstModuleRapportEclairageUrgenceActif]
    pagination_class = RapportPagination

    def get_serializer_class(self):
        if self.action == "list":
            return RapportEclairageUrgenceListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return RapportEclairageUrgenceCreateSerializer
        return RapportEclairageUrgenceDetailSerializer

    def _queryset_de_base(self):
        user = self.request.user
        qs = RapportEclairageUrgence.objects.select_related(
            "batiment", "batiment__client", "cree_par"
        ).prefetch_related("techniciens").filter(batiment__client__organisation=user.organisation)

        if user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)

        return qs

    def get_queryset(self):
        qs = self._queryset_de_base()

        statut = self.request.query_params.get("statut")
        q = self.request.query_params.get("q")
        if statut:
            qs = qs.filter(statut=statut)
        if q:
            qs = _filtrer_recherche_rapport(qs, q)

        return qs.distinct().order_by(F("date_inspection").desc(nulls_last=True), "-id")

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def get_permissions(self):
        if self.action in ["create", "destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
            except (Batiment.DoesNotExist, TypeError, ValueError):
                return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_400_BAD_REQUEST)
            if nouveau_batiment.id != rapport.batiment_id:
                rapport.batiment = nouveau_batiment
                changements.append(f"Bâtiment changé pour {nouveau_batiment.adresse_complete}")

        if "techniciens" in request.data:
            rapport.techniciens.set(request.data.get("techniciens") or [])
            changements.append("Techniciens réassignés")

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportEclairageUrgenceDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportEclairageUrgence.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportEclairageUrgenceDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportEclairageUrgence.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        ancienne_date = instance.date_inspection
        ancienne_prochaine = instance.prochaine_inspection
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")
        _envoyer_avis_changement_date_si_applicable(rapport, "Éclairage d'urgence", ancienne_date, ancienne_prochaine)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportEclairageUrgence.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportEclairageUrgenceDetailSerializer(rapport).data)

    @action(detail=True, methods=["get", "post"], url_path="eclairages-urgence")
    def eclairages_urgence(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(EclairageUrgenceItemSerializer(rapport.eclairages_urgence.all(), many=True).data)

        if rapport.statut == RapportEclairageUrgence.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter une unité."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EclairageUrgenceItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.eclairages_urgence.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Unité d'éclairage ajoutée")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportEclairageUrgenceSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        html = _html_rapport_eclairage_complet(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"])
    def excel(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        langue = bat.client.organisation.langue
        t = lambda cle: _t(langue, cle)
        techniciens = ", ".join(
            t2.get_full_name() or t2.username for t2 in rapport.techniciens.all()
        ) or "—"

        wb = excel_workbook()
        ws = wb.active
        ws.title = t("eclairage_urgence_label")
        excel_entete_rapport(
            ws, organisation_nom=bat.client.organisation.nom, adresse=adresse,
            date_insp=_date_fr(rapport.date_inspection),
            statut=t('statut_ferme') if rapport.statut == 'ferme' else t('statut_ouvert'), techniciens=techniciens,
        )

        colonnes = [t("col_no"), t("col_etage"), t("col_emplacement"), t("col_modele"), t("col_voltage"), t("col_etat"), t("col_remarque")]
        ligne = excel_ligne_entetes(ws, colonnes, ligne=6)
        for it in rapport.eclairages_urgence.all():
            ligne += 1
            valeurs = [it.ordre, it.etage, it.emplacement, it.modele, it.voltage, it.etat, it.remarque]
            for col, valeur in enumerate(valeurs, start=1):
                ws.cell(row=ligne, column=col, value=valeur)
        excel_ajuster_largeurs(ws, colonnes)
        ws.freeze_panes = "A7"

        return excel_reponse(wb, excel_nom_fichier(t("eclairage_urgence_label"), adresse))


class EclairageUrgenceItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne d'appareil d'éclairage d'urgence — pour la corriger ou la supprimer."""

    serializer_class = EclairageUrgenceItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportEclairageUrgenceActif]

    def get_queryset(self):
        user = self.request.user
        qs = EclairageUrgenceItem.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportEclairageUrgence.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


# ── Système d'extinction de cuisine (hotte, norme ULC ORD 1254.6 / ULC 300) ──

_HOTTE_BOX = {"x0": 34, "x1": 456, "topY": 92, "botY": 167}


def _icone_appareil_svg(code, color="#334155", size=15):
    """Icône monoligne d'un appareil — mêmes tracés que AppareilIcon côté
    frontend (frontend/components/rapports-cuisine/SchemaHottes.tsx), pour
    que le rapport imprimé corresponde exactement à l'éditeur."""
    attrs = f'width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
    formes = {
        "F": '<rect x="5" y="4" width="14" height="16"/><rect x="9" y="6.5" width="6" height="7"/><path d="M12 20v-6.5"/><path d="M9.7 15.7L12 13.5l2.3 2.2"/>',
        "B": '<path d="M5 10h11l-1.2 8a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 10Z"/><path d="M9 13h5"/><circle cx="18.5" cy="7.5" r="2.5"/><path d="M18.5 6v1.5l1 1"/>',
        "P": '<rect x="2" y="8" width="20" height="8"/>',
        "R2": '<rect x="7" y="3" width="10" height="18" rx="1.5"/><circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/>',
        "R4": '<rect x="4" y="4" width="16" height="16" rx="1.5"/><circle cx="9" cy="9" r="1.8"/><circle cx="15" cy="9" r="1.8"/><circle cx="9" cy="15" r="1.8"/><circle cx="15" cy="15" r="1.8"/>',
        "R6": '<rect x="2" y="6" width="20" height="12" rx="1.5"/><circle cx="7" cy="10" r="1.4"/><circle cx="12" cy="10" r="1.4"/><circle cx="17" cy="10" r="1.4"/><circle cx="7" cy="14" r="1.4"/><circle cx="12" cy="14" r="1.4"/><circle cx="17" cy="14" r="1.4"/>',
        "GC": '<rect x="4" y="5" width="16" height="14"/><path d="M6 19l1.5-14M9.5 19l1.5-14M13 19l1.5-14M16.5 19l1.5-14"/>',
        "GZ": '<rect x="4" y="5" width="16" height="14"/><path d="M6 9h12M6 12h12M6 15h12"/>',
        "S": '<rect x="4" y="9" width="16" height="9"/><path d="M6.5 9v-3M10 9v-3M13.5 9v-3M17 9v-3"/>',
        "SP": f'<rect x="4" y="4" width="16" height="16" rx="1.5"/><circle cx="12" cy="12" r="1.4" fill="{color}"/><path d="M12 6.5v2.2M12 15.3v2.2M5.5 12h2.2M16.3 12h2.2M8 8l1.5 1.5M14.5 14.5L16 16M8 16l1.5-1.5M14.5 9.5L16 8"/>',
        "BP": '<path d="M4 10c1.5 1 3 1.5 8 1.5s6.5-.5 8-1.5"/><path d="M4 10v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3"/>',
        "W": '<path d="M3 12a9 9 0 0 0 18 0"/><path d="M3 12h18M5 9l-2-1.5M19 9l2-1.5"/>',
        "SH": '<path d="M12 1.5V21"/><path d="M7 4h10l-3.5 12.5h-3Z"/><path d="M8 7.5h8M9 11h6"/><path d="M6.5 21h11"/>',
    }
    contenu = formes.get(code, '<rect x="5" y="5" width="14" height="14" rx="2.5"/><path d="M9 9l6 6M15 9l-6 6"/>')
    return f"<svg {attrs}>{contenu}</svg>"


_CUISINIERE_DIMS = {
    "R2": {"w": 16, "h": 30, "cols": 1, "rows": 2},
    "R4": {"w": 26, "h": 26, "cols": 2, "rows": 2},
    "R6": {"w": 40, "h": 26, "cols": 3, "rows": 2},
}

_clip_seq_appareil = 0


def _unite_appareil_svg(code, qty, x, y, taille=None):
    """Rendu réaliste d'un appareil avec sa quantité (batterie de friteuses,
    cuisinière à feux fixes, plaque/grille sur N sections) — même logique que
    AppareilUnit côté frontend."""
    global _clip_seq_appareil
    # Anciens codes 'G'/'R'/'C' (hottes enregistrées avant P/R4/GC).
    code = {"G": "P", "R": "R4", "C": "GC"}.get(code, code)
    n = max(1, qty or 1)
    step = 15
    w = 22 + (n - 1) * step
    h = 26
    stroke = "#334155"

    if code in _CUISINIERE_DIMS:
        dims = _CUISINIERE_DIMS[code]
        gap = 6
        total_w = dims["w"] * n + gap * (n - 1)
        cell_w = dims["w"] / (dims["cols"] + 1)
        cell_h = dims["h"] / (dims["rows"] + 1)
        r = min(cell_w, cell_h) * 0.32
        units = []
        for i in range(n):
            bx = x - total_w / 2 + dims["w"] / 2 + i * (dims["w"] + gap)
            burners = "".join(
                f'<circle cx="{bx - dims["w"] / 2 + cell_w * (c + 1)}" cy="{y - dims["h"] / 2 + cell_h * (row + 1)}" r="{r}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                for row in range(dims["rows"]) for c in range(dims["cols"])
            )
            units.append(
                f'<rect x="{bx - dims["w"] / 2}" y="{y - dims["h"] / 2}" width="{dims["w"]}" height="{dims["h"]}" rx="3" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{burners}'
            )
        return "".join(units)

    if code == "F":
        # Rectangle net avec panier intérieur et tige relevée (poignée) —
        # comme la friteuse dessinée à la main.
        paniers = "".join(
            (lambda cx: (
                f'<rect x="{cx - 5}" y="{y - 7}" width="10" height="12" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx} {y + h / 2 - 2} V {y - 4}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx - 2} {y - 1.5} L {cx} {y - 4.5} L {cx + 2} {y - 1.5}" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
            ))(x - w / 2 + 11 + i * step)
            for i in range(n)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{paniers}'

    if code == "B":
        paniers = "".join(
            (lambda cx: (
                f'<path d="M {cx - 5} {y - 6} h 10 l -1.4 9 a 1.6 1.6 0 0 1 -1.6 1.4 h -3.6 a 1.6 1.6 0 0 1 -1.6 -1.4 Z" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
                f'<path d="M {cx - 3.2} {y - 6} v -1.6 h 6.4 v 1.6" fill="none" stroke="{stroke}" stroke-width="1.1"/>'
            ))(x - w / 2 + 11 + i * step)
            for i in range(n)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" rx="5" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{paniers}'

    if code == "P":
        # Plaque — largeur réelle en pouces (12/24/36/48/60), pas liée à la
        # quantité. Une division tous les 12 po (segments de la plaque) —
        # même logique que AppareilUnit côté frontend.
        inch = taille or 24
        w_plaque = inch * 2
        segments = max(1, round(inch / 12))
        dividers = "".join(
            f'<line x1="{x - w_plaque / 2 + (i + 1) * (w_plaque / segments)}" y1="{y - h / 2 + 4}" x2="{x - w_plaque / 2 + (i + 1) * (w_plaque / segments)}" y2="{y + h / 2 - 4}" stroke="{stroke}" stroke-width="1"/>'
            for i in range(segments - 1)
        )
        taille_label = f'<text x="{x}" y="{y + 3}" text-anchor="middle" fill="{stroke}" font-size="9" font-weight="700">{inch}″</text>'
        return f'<rect x="{x - w_plaque / 2}" y="{y - h / 2}" width="{w_plaque}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{dividers}{taille_label}'

    if code == "GC":
        # Rectangle net (coins non arrondis) rempli de traits quasi verticaux
        # (léger biais), serrés, comme une grille de charbon vue de face.
        _clip_seq_appareil += 1
        clip_id = f"grillClip{_clip_seq_appareil}"
        slant = 6
        diag_lines = []
        dx = -slant
        while dx <= w + slant:
            lx1 = x - w / 2 + dx
            ly1 = y + h / 2
            lx2 = lx1 + slant
            ly2 = y - h / 2
            diag_lines.append(f'<line x1="{lx1}" y1="{ly1}" x2="{lx2}" y2="{ly2}" stroke="{stroke}" stroke-width="1"/>')
            dx += 6
        return (
            f'<defs><clipPath id="{clip_id}"><rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}"/></clipPath></defs>'
            f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>'
            f'<g clip-path="url(#{clip_id})">{"".join(diag_lines)}</g>'
        )

    if code == "GZ":
        # Grille à gaz — même rectangle que la grille charbon, barreaux
        # horizontaux (même rendu que AppareilUnit côté frontend).
        barreaux = "".join(
            f'<line x1="{x - w / 2 + 3}" y1="{y - h / 2 + dy}" x2="{x + w / 2 - 3}" y2="{y - h / 2 + dy}" stroke="{stroke}" stroke-width="1"/>'
            for dy in range(4, h - 2, 5)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{barreaux}'

    if code == "S":
        tick_count = max(3, round(w / 8))
        ticks = "".join(
            f'<line x1="{x - w / 2 + 4 + (i * (w - 8)) / (tick_count - 1)}" y1="{y - h / 2}" x2="{x - w / 2 + 4 + (i * (w - 8)) / (tick_count - 1)}" y2="{y - h / 2 + 6}" stroke="{stroke}" stroke-width="1"/>'
            for i in range(tick_count)
        )
        return f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>{ticks}'

    # Même boîte arrondie que friteuse/cuisinière/grille — la quantité est une
    # pastille ×N plutôt qu'une icône répétée, pour rester lisible.
    w_badge = 34
    badge = (
        f'<circle cx="{x + w_badge / 2 - 3}" cy="{y + h / 2 - 3}" r="7" fill="#dc2626"/>'
        f'<text x="{x + w_badge / 2 - 3}" y="{y + h / 2 - 2.5}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="9" font-weight="800">×{n}</text>'
        if n > 1 else ""
    )
    icone = _icone_appareil_svg(code, stroke, 17)
    return (
        f'<rect x="{x - w_badge / 2}" y="{y - h / 2}" width="{w_badge}" height="{h}" rx="6" fill="#fff" stroke="{stroke}" stroke-width="1.4"/>'
        f'<g transform="translate({x - 8.5},{y - 8.5})">{icone}</g>{badge}'
    )


def _buse_salamandre_svg(a, y):
    """Buse coudée à 90° à l'intérieur d'une salamandre — « |_> » (droite)
    ou « <_| » (gauche). Même tracé que traceBuseSalamandre dans
    SchemaHottes.tsx."""
    sens = a.get("buse")
    if a.get("code") != "S" or sens not in ("gauche", "droite"):
        return ""
    x = a.get("x", 0)
    s = 1 if sens == "droite" else -1
    shaft = f"M {x - 6 * s} {y - 5} L {x - 6 * s} {y + 5} L {x + 4 * s} {y + 5}"
    tip = f"{x + 4 * s},{y + 2} {x + 4 * s},{y + 8} {x + 8 * s},{y + 5}"
    couleur = "#dc2626" if a.get("buse_conforme") is False else "#16a34a"
    return (
        f'<path d="{shaft}" fill="none" stroke="{couleur}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<polygon points="{tip}" fill="{couleur}"/>'
    )


def _rendu_hotte_html(hotte):
    """Rendu SVG d'une hotte pour l'impression (rapport et certificat) —
    même schéma que l'éditeur interactif (frontend/components/rapports-cuisine/
    SchemaHottes.tsx) : les buses sont les flèches rouges placées manuellement
    (indépendantes des appareils — leur nombre ne correspond pas forcément au
    nombre d'appareils), appareils en rangée séparée avec leur quantité réelle."""
    b = _HOTTE_BOX
    appareils = hotte.appareils or []
    # Placement manuel des buses uniquement — aucune génération automatique à
    # partir de l'ancien compteur, le technicien les place lui-même. Chaque
    # buse peut être droite (par défaut, verticale) ou oblique (gauche/droite,
    # dessinée plus courte pour rester lisible) — même logique que
    # frontend/components/rapports-cuisine/SchemaHottes.tsx.
    y1_sous = b["botY"] + 6
    y1_interieur = (b["topY"] + b["botY"]) / 2
    y1_exterieur = 61

    def _buse_svg(pos):
        x = pos.get("x", 0)
        direction = pos.get("direction")
        if pos.get("exterieur"):
            y1 = y1_exterieur
        elif pos.get("interieur"):
            y1 = y1_interieur
        else:
            y1 = y1_sous
        if direction == "gauche":
            shaft = f'M {x} {y1} L {x - 7} {y1 + 10}'
            tip = f'{x - 5},{y1 + 11} {x - 10},{y1 + 8} {x - 10},{y1 + 13}'
        elif direction == "droite":
            shaft = f'M {x} {y1} L {x + 7} {y1 + 10}'
            tip = f'{x + 5},{y1 + 11} {x + 10},{y1 + 8} {x + 10},{y1 + 13}'
        elif direction == "horizontale":
            shaft = f'M {x} {y1} L {x + 12} {y1}'
            tip = f'{x + 12},{y1 - 2} {x + 12},{y1 + 2} {x + 16},{y1}'
        elif direction == "haut":
            shaft = f'M {x} {y1} L {x} {y1 - 12}'
            tip = f'{x - 2},{y1 - 12} {x + 2},{y1 - 12} {x},{y1 - 16}'
        elif direction == "fusible":
            # Lien-fusible — représenté « |--| » : deux repères verticaux
            # reliés par un trait horizontal, sans flèche.
            shaft = f'M {x - 8} {y1 - 4} L {x - 8} {y1 + 4} M {x - 8} {y1} L {x + 8} {y1} M {x + 8} {y1 - 4} L {x + 8} {y1 + 4}'
            tip = ''
        else:
            shaft = f'M {x} {y1} L {x} {y1 + 12}'
            tip = f'{x - 2},{y1 + 12} {x + 2},{y1 + 12} {x},{y1 + 16}'
        # Verte par défaut (conforme) ; rouge si marquée non conforme par le
        # technicien (mal placée, ne protège pas l'appareil visé, ou absence
        # d'une buse attendue) — même règle que SchemaHottes.tsx.
        if pos.get("conforme") is False:
            couleur = "#dc2626"
        elif direction == "fusible":
            couleur = "#2563eb"
        else:
            couleur = "#16a34a"
        tip_svg = f'<polygon points="{tip}" fill="{couleur}"/>' if tip else ''
        return f'<path d="{shaft}" fill="none" stroke="{couleur}" stroke-width="4" stroke-linecap="round"/>{tip_svg}'

    buses_svg = "".join(_buse_svg(pos) for pos in (hotte.buses or []))

    elevations_svg = "".join(
        f'<rect x="{pos.get("x", 0) - 16}" y="{(b["topY"] + b["botY"]) / 2 - 17 if pos.get("interieur") else 44}" width="32" height="34" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.75"/>'
        for pos in (hotte.elevations or [])
    )

    icon_y = 245
    # La salamandre (S) est montée en hauteur, toujours plus haute que les
    # autres appareils — même règle que SchemaHottes.tsx.
    appareils_svg = "".join(
        _unite_appareil_svg(a.get("code", ""), a.get("qty", 1), a.get("x", 0), icon_y - 40 if a.get("code") == "S" else icon_y, a.get("taille"))
        + _buse_salamandre_svg(a, icon_y - 40)
        + f'<text x="{a.get("x", 0)}" y="{(icon_y - 40 if a.get("code") == "S" else icon_y) + 24}" text-anchor="middle" fill="#334155" font-size="9" font-weight="800">{escape(_libelle_appareil(a))}</text>'
        for a in appareils
    )
    # Petits carrés « taille de hotte » (3′ à 18′), en haut à l'intérieur de
    # la hotte — même rendu que SchemaHottes.tsx (Y_TAILLE, 20×20).
    y_taille = b["topY"] + 12
    tailles_svg = "".join(
        f'<rect x="{t.get("x", 0) - 10}" y="{y_taille - 10}" width="20" height="20" fill="#fff" stroke="#334155" stroke-width="1.2"/>'
        f'<text x="{t.get("x", 0)}" y="{y_taille + 3.5}" text-anchor="middle" fill="#0f172a" font-size="9.5" font-weight="800" style="font-family:Arial,Helvetica,sans-serif;">{int(t.get("pieds", 0))}′</text>'
        for t in (hotte.tailles or [])
    )
    dividers_svg = "".join(
        f'<line x1="{d}" y1="{b["topY"]}" x2="{d}" y2="{b["botY"]}" stroke="#334155" stroke-width="2.4"/>'
        for d in (hotte.dividers or [])
    )
    svg = f"""<svg viewBox="0 0 512 270" style="width:100%;height:249px;overflow:visible;display:block;">
  <polygon points="{b['x0']},{b['topY']} {b['x1']},{b['topY']} {b['x1'] + 20},{b['topY'] - 14} {b['x0'] + 20},{b['topY'] - 14}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5"/>
  <polygon points="{b['x1']},{b['topY']} {b['x1'] + 20},{b['topY'] - 14} {b['x1'] + 20},{b['botY'] - 14} {b['x1']},{b['botY']}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.5"/>
  <rect x="{b['x0']}" y="{b['topY']}" width="{b['x1'] - b['x0']}" height="{b['botY'] - b['topY']}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.75"/>
  {dividers_svg}
  {elevations_svg}
  {tailles_svg}
  {buses_svg}
  {appareils_svg}
</svg>"""
    return f"<div style='background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:8px 8px 24px;'>{svg}</div>"


_STYLE_INFO_GRILLE = (
    "<style>"
    ".info-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-bottom:4px;}"
    ".info-tile{background:#f8fafc;border:1px solid #e5e7eb;border-left:3px solid #dc2626;border-radius:5px;padding:5px 8px;break-inside:avoid;}"
    ".info-tile .l{font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.6px;color:#0a0b0d;}"
    ".info-tile .v{font-size:9pt;font-weight:700;color:#0a0b0d;margin-top:2px;}"
    "</style>"
)


def _grille_infos_cuisine(rapport, client_nom):
    """Section « Informations du système » du rapport cuisine — grille de
    tuiles (étiquette discrète + valeur en gras), 4 par ligne."""
    def _d(date):
        return date.strftime("%d/%m/%Y") if date else "—"

    liens = " / ".join(
        f"{n}×{t}" for n, t in (
            (rapport.liens_fusibles_360f, "360°F"),
            (rapport.liens_fusibles_450f, "450°F"),
            (rapport.liens_fusibles_500f, "500°F"),
        ) if n
    ) or "—"
    tuiles = [
        ("Client", client_nom, False),
        ("Courtier", rapport.courtier, False),
        ("Fabricant", rapport.fabricant, False),
        ("Modèle", rapport.modele, False),
        ("Type d'agent", rapport.get_type_agent_display() if rapport.type_agent else "", False),
        ("Alimentation des appareils", rapport.alimentation, False),
        ("Dispositif de coupure", rapport.get_dispositif_coupure_display() if rapport.dispositif_coupure else "", False),
        ("Raccordements auxiliaires", rapport.raccordement, False),
        ("Nombre de buses", "" if rapport.nombre_buses is None else str(rapport.nombre_buses), False),
        ("Liens fusibles (qté × °F)", liens, False),
        ("Buses / liens fusibles", rapport.buses_liens_fusibles, True),
        ("Date d'installation", _d(rapport.date_installation), False),
        ("Dernier essai hydrostatique", str(rapport.date_dernier_essai_hydrostatique.year) if rapport.date_dernier_essai_hydrostatique else "", False),
        ("Dernière recharge", _d(rapport.date_derniere_recharge), False),
        ("Prochaine inspection", _d(rapport.prochaine_inspection), False),
    ]
    tuiles_html = "".join(
        f"<div class='info-tile'{' style=\"grid-column:span 2;\"' if large else ''}>"
        f"<div class='l'>{escape(label)}</div><div class='v'>{escape(valeur or '—')}</div></div>"
        for label, valeur, large in tuiles
    )
    return f"{_STYLE_INFO_GRILLE}<div class='info-grid'>{tuiles_html}</div>"


def _libelle_appareil(a):
    """Texte sous l'appareil : la désignation saisie pour un « Autre » (O),
    sinon le code."""
    if a.get("code") == "O" and (a.get("nom") or "").strip():
        return a["nom"].strip()
    return a.get("code", "")


def _legende_appareils_html(hottes):
    appareils = [a for h in hottes for a in (h.appareils or [])]
    codes_utilises = {a.get("code") for a in appareils} - {"O"}
    labels = dict(HotteCuisine.CodeAppareil.choices)
    entrees = [
        f"<span style='margin-right:9px;font-weight:700;color:#000;'><strong style='color:#000;'>{code}</strong> {labels.get(code, code)}</span>"
        for code in sorted(codes_utilises) if code
    ]
    # « Autre » : une entrée par désignation saisie (ou « Autre » sans nom).
    noms_autres = sorted({(a.get("nom") or "").strip() for a in appareils if a.get("code") == "O"})
    entrees += [
        f"<span style='margin-right:9px;font-weight:700;color:#000;'><strong style='color:#000;'>{escape(nom) if nom else 'O'}</strong> Autre</span>"
        for nom in noms_autres
    ]
    return "".join(entrees)


def _html_rapport_cuisine_complet(rapport) -> str:
    """HTML du rapport technique complet de vérification du système de
    cuisine — mêmes composants graphiques que les autres rapports."""
    from .pdf_design import CSS_DOCUMENT, case, entete, pied_de_page

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    langue = bat.client.organisation.langue
    t = lambda cle: _t(langue, cle)

    date_insp = _date_fr(rapport.date_inspection)
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in techniciens) or "—"
    hottes = list(rapport.hottes.all())

    hottes_html = "".join(_rendu_hotte_html(h) for h in hottes) or f"<p class='muted'>{t('aucune_hotte')}</p>"
    legende_appareils = _legende_appareils_html(hottes)
    verif_rows = "".join(
        f"<div style='display:flex;align-items:center;gap:6px;padding:3px 8px;'>"
        f"{case(getattr(rapport, champ) is not False, '#16a34a')}<span>{label}</span></div>"
        for champ, label in CHECKLIST_CUISINE
    )

    logo_content = organisation_logo_content(bat.client.organisation, 46)
    organisation_nom = bat.client.organisation.nom
    from .certificats import certificat_couvrant

    cert = certificat_couvrant(rapport)

    entete_html = entete(
        logo_content, organisation_nom, t("systeme_cuisine"),
        t("certificat_no"), (cert.numero_affiche if cert else "—"),
        t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{t("rapport_verification")} — {t("systeme_cuisine")} — {adresse}</title>
<style>{CSS_DOCUMENT}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:16px 20px;">
{entete_html}
<div class="title-banner">
  <h2>{t("rapport_verification")} — {t("systeme_cuisine")}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:10.5pt;">{bat.client.nom}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">{t("adresse")}</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
<div class="sec-title">{t("informations_systeme")}</div>
{_grille_infos_cuisine(rapport, bat.client.nom)}
<div class="sec-title">{t("schema_installation")}</div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:6px;">{hottes_html}</div>
<div style="font-size:7.5pt;color:#000;margin:-2px 0 9px;">{legende_appareils}</div>
<div class="sec-title" style="display:flex;align-items:center;justify-content:space-between;">
  <span>{t("liste_verifications")}</span>
  <span style="color:#16a34a;">{rapport.nb_verifications_conformes} / {len(CHECKLIST_CUISINE)} {t("conformes_sur")}</span>
</div>
<div style="background:#f8fafc;border-radius:8px;padding:6px 4px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px;font-size:8pt;">{verif_rows}</div>
<div class="sec-title">{t("commentaires_label")}</div>
<p style="font-size:9pt;color:#334155;line-height:1.5;margin-bottom:9px;">{rapport.commentaires or '—'}</p>
{html_annexe_photos(rapport, t("photos_anomalies"), t("suite"))}
{pied_de_page(organisation_nom, t("footer_rapport_cuisine"))}
</div>
</body>
</html>"""


class EstModuleRapportCuisineActif(permissions.BasePermission):
    message = "Le module « Rapport cuisine » n'est pas activé pour votre organisation."

    def has_permission(self, request, view):
        organisation = getattr(request.user, "organisation", None)
        return bool(organisation and organisation.a_le_module("rapport_cuisine"))


class RapportCuisineViewSet(PhotosRapportMixin, viewsets.ModelViewSet):
    champ_rapport_photo = "rapport_cuisine"
    permission_classes = [permissions.IsAuthenticated, EstModuleRapportCuisineActif]
    pagination_class = RapportPagination

    def get_serializer_class(self):
        if self.action == "list":
            return RapportCuisineListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return RapportCuisineCreateSerializer
        return RapportCuisineDetailSerializer

    def _queryset_de_base(self):
        user = self.request.user
        qs = RapportCuisine.objects.select_related(
            "batiment", "batiment__client", "cree_par"
        ).prefetch_related("techniciens", "hottes").filter(batiment__client__organisation=user.organisation)

        if user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)

        return qs

    def get_queryset(self):
        qs = self._queryset_de_base()

        statut = self.request.query_params.get("statut")
        q = self.request.query_params.get("q")
        if statut:
            qs = qs.filter(statut=statut)
        if q:
            qs = _filtrer_recherche_rapport(qs, q)

        return qs.distinct().order_by(F("date_inspection").desc(nulls_last=True), "-id")

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), EstModuleRapportCuisineActif(), EstSuperviseurOuTechnicien()]
        if self.action in ["destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            return [permissions.IsAuthenticated(), EstModuleRapportCuisineActif(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
            except (Batiment.DoesNotExist, TypeError, ValueError):
                return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_400_BAD_REQUEST)
            if nouveau_batiment.id != rapport.batiment_id:
                rapport.batiment = nouveau_batiment
                changements.append(f"Bâtiment changé pour {nouveau_batiment.adresse_complete}")

        if "techniciens" in request.data:
            rapport.techniciens.set(request.data.get("techniciens") or [])
            changements.append("Techniciens réassignés")

        if changements:
            rapport.save()
            for c in changements:
                rapport.historiser(request.user, c)

        return Response(RapportCuisineDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportCuisine.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportCuisineDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        if self.request.user.est_technicien() and not rapport.techniciens.filter(pk=self.request.user.pk).exists():
            rapport.techniciens.add(self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportCuisine.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        ancienne_date = instance.date_inspection
        ancienne_prochaine = instance.prochaine_inspection
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")
        _envoyer_avis_changement_date_si_applicable(rapport, "Système de cuisine", ancienne_date, ancienne_prochaine)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not (request.user.est_superviseur() or request.user.est_technicien()):
            return Response(
                {"error": "Seuls le superviseur et le technicien peuvent fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportCuisine.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportCuisineDetailSerializer(rapport).data)

    @action(detail=True, methods=["get", "post"])
    def hottes(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(HotteCuisineSerializer(rapport.hottes.all(), many=True).data)

        if rapport.statut == RapportCuisine.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter une hotte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = HotteCuisineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.hottes.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Hotte ajoutée")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportCuisineSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        html = _html_rapport_cuisine_complet(rapport)
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class HotteCuisineViewSet(viewsets.ModelViewSet):
    """Accès direct à une hotte — pour la renommer, ajuster le nombre de
    buses, mettre à jour le schéma (appareils/dividers) ou la supprimer."""

    serializer_class = HotteCuisineSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = HotteCuisine.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportCuisine.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()


# ── Certificats (vue unifiée, tous modules) ─────────────────────────────────

def _certificats_incendie(organisation):
    certs = Certificat.objects.select_related(
        "rapport", "rapport__batiment", "rapport__batiment__client", "emis_par"
    ).filter(rapport__batiment__client__organisation=organisation)
    resultats = []
    for c in certs:
        r = c.rapport
        bat = r.batiment
        resultats.append({
            "cle": f"incendie-{c.id}",
            "type": "incendie",
            "type_display": "Système d'alarme",
            "numero": c.numero,
            "date_emission": c.date_emission,
            "certificat_envoye": c.certificat_envoye,
            "mode_envoi": c.mode_envoi,
            "date_envoi": c.date_envoi,
            "envoye_a": c.envoye_a,
            "conforme": c.conforme,
            "adresse": bat.adresse_complete,
            "client_nom": bat.client.nom,
            "client_id": bat.client_id,
            "batiment_id": bat.id,
            "rapport_id": r.id,
            "statut_rapport": r.statut,
            "url_rapport": f"/superviseur/rapports/{r.id}",
            "url_certificat_pdf": f"/api/rapports/{r.id}/certificat-pdf/",
        })
    return resultats


def _certificats_extincteur(organisation):
    """Certificats extincteurs / éclairage d'urgence / cuisine — un par
    visite ou par système selon les paramètres de l'organisation (voir
    certificats.py). `type` reste « extincteur » pour les filtres existants."""
    from .certificats import conformite_certificat, rapports_couverts

    certs = CertificatExtincteur.objects.select_related(
        "rapport", "rapport_cuisine", "rapport_eclairage", "batiment", "batiment__client", "emis_par"
    ).filter(batiment__client__organisation=organisation)
    libelles = {"extincteurs": "Extincteur", "eclairage": "éclairage", "cuisine": "cuisine"}
    urls = {
        "extincteurs": "/superviseur/rapports-extincteurs/",
        "cuisine": "/superviseur/rapports-cuisine/",
        "eclairage": "/superviseur/rapports-eclairage-urgence/",
    }
    resultats = []
    for c in certs:
        ancre = c.rapport_ancre
        bat = c.batiment
        systemes = [s for s in ("extincteurs", "eclairage", "cuisine") if s in rapports_couverts(c)]
        type_display = " & ".join(libelles[s] for s in systemes)
        resultats.append({
            "cle": f"extincteur-{c.id}",
            "type": "extincteur",
            "type_display": type_display[:1].upper() + type_display[1:],
            "certificat_id": c.id,
            "numero": c.numero_affiche,
            "statut_certificat": c.statut,
            "type_document": c.type_document,
            "date_emission": c.date_emission,
            "certificat_envoye": c.certificat_envoye,
            "mode_envoi": c.mode_envoi,
            "date_envoi": c.date_envoi,
            "envoye_a": c.envoye_a,
            "conforme": conformite_certificat(c),
            "adresse": bat.adresse_complete,
            "client_nom": bat.client.nom,
            "client_id": bat.client_id,
            "batiment_id": bat.id,
            "rapport_id": ancre.id,
            "statut_rapport": ancre.statut,
            "url_rapport": f"{urls[c.systeme_ancre]}{ancre.id}",
            "url_certificat_pdf": f"/api/certificats-visite/{c.id}/pdf/",
        })
    return resultats


def _certificats_gicleur(organisation):
    certs = CertificatGicleur.objects.select_related(
        "rapport", "rapport__batiment", "rapport__batiment__client", "emis_par"
    ).filter(rapport__batiment__client__organisation=organisation)
    resultats = []
    for c in certs:
        r = c.rapport
        bat = r.batiment
        resultats.append({
            "cle": f"gicleur-{c.id}",
            "type": "gicleur",
            "type_display": "Gicleurs",
            "numero": c.numero,
            "date_emission": c.date_emission,
            "certificat_envoye": c.certificat_envoye,
            "mode_envoi": c.mode_envoi,
            "date_envoi": c.date_envoi,
            "envoye_a": c.envoye_a,
            "conforme": r.est_conforme,
            "adresse": bat.adresse_complete,
            "client_nom": bat.client.nom,
            "client_id": bat.client_id,
            "batiment_id": bat.id,
            "rapport_id": r.id,
            "statut_rapport": r.statut,
            "url_rapport": f"/superviseur/rapports-gicleurs/{r.id}",
            "url_certificat_pdf": f"/api/rapports-gicleurs/{r.id}/certificat-pdf/",
        })
    return resultats


def _lister_certificats(request):
    """Agrège les certificats de tous les modules (incendie, extincteur —
    qui couvre aussi l'éclairage d'urgence via le certificat unifié) en une
    seule liste triée, filtrée par organisation et par les paramètres de
    requête communs (recherche, type, statut, client)."""
    organisation = request.user.organisation

    resultats = []
    type_filtre = request.query_params.get("type")
    if type_filtre in (None, "", "incendie"):
        resultats += _certificats_incendie(organisation)
    if type_filtre in (None, "", "extincteur"):
        resultats += _certificats_extincteur(organisation)
    if type_filtre in (None, "", "gicleur"):
        resultats += _certificats_gicleur(organisation)

    recherche = (request.query_params.get("recherche") or "").strip().lower()
    if recherche:
        resultats = [
            r for r in resultats
            if recherche in r["adresse"].lower()
            or recherche in r["client_nom"].lower()
            or recherche in r["numero"].lower()
        ]

    statut_filtre = request.query_params.get("statut")
    if statut_filtre == "envoye":
        resultats = [r for r in resultats if r["certificat_envoye"]]
    elif statut_filtre == "non_envoye":
        resultats = [r for r in resultats if not r["certificat_envoye"]]

    conformite_filtre = request.query_params.get("conforme")
    if conformite_filtre == "oui":
        resultats = [r for r in resultats if r["conforme"]]
    elif conformite_filtre == "non":
        resultats = [r for r in resultats if not r["conforme"]]

    client_id = request.query_params.get("client")
    if client_id:
        resultats = [r for r in resultats if str(r["client_id"]) == str(client_id)]

    CHAMPS_TRI = {"numero", "adresse", "client_nom", "date_emission"}
    tri = request.query_params.get("tri")
    tri = tri if tri in CHAMPS_TRI else "date_emission"
    descendant = request.query_params.get("direction") != "asc"
    resultats.sort(key=lambda r: r[tri], reverse=descendant)
    return resultats


class CertificatsUnifiesView(APIView):
    """Vue agrégée de tous les certificats émis (tous modules confondus) —
    pour le superviseur qui veut retrouver/exporter un certificat sans
    naviguer dans chaque rapport individuellement."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]
    pagination_class = RapportPagination

    def get(self, request):
        resultats = _lister_certificats(request)
        resultats = [
            {**r, "date_emission": r["date_emission"].isoformat()}
            for r in resultats
        ]
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(resultats, request, view=self)
        return paginator.get_paginated_response(page)


def _evenements_calendrier(organisation, annee: int, mois: int) -> list[dict]:
    """Trois catégories d'événements pour un mois donné, tous types de
    rapport confondus, avec les coordonnées complètes du client (téléphone,
    adresse) pour planifier/contacter directement depuis le calendrier :

    - « rappel » : échéance calculée (`prochaine_inspection`, sur un rapport
      déjà fermé), pas encore dépassée — le rappel automatique par courriel
      s'appuie dessus.
    - « en_retard » : même chose, mais la date est déjà passée sans qu'une
      nouvelle inspection soit faite — reste affiché jusqu'à ce que le
      superviseur planifie la visite de suivi.
    - « planifie » : visite à venir déjà programmée à l'avance par le
      superviseur (`date_inspection` d'un rapport encore ouvert, dans le
      futur) — permet de voir tout ce qui est à faire, pas seulement les
      échéances de conformité."""
    configs = [
        ("incendie", Rapport.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens"), "/superviseur/rapports", "rapports"),
        ("extincteur", RapportExtincteur.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens"), "/superviseur/rapports-extincteurs", "rapports-extincteurs"),
        ("eclairage", RapportEclairageUrgence.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens"), "/superviseur/rapports-eclairage-urgence", "rapports-eclairage-urgence"),
        ("cuisine", RapportCuisine.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens"), "/superviseur/rapports-cuisine", "rapports-cuisine"),
        ("gicleur", RapportGicleur.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens"), "/superviseur/rapports-gicleurs", "rapports-gicleurs"),
    ]

    def _element(type_cle, r, url_base, api_base, champ_date, categorie):
        bat = r.batiment
        client = bat.client
        return {
            "cle": f"{type_cle}-{categorie}-{r.id}",
            "type": type_cle,
            "categorie": categorie,
            "date": champ_date.isoformat(),
            "adresse": bat.adresse_complete,
            "client_nom": client.nom,
            "client_contact_nom": client.contact_nom,
            "client_telephone": client.contact_telephone,
            "rapport_id": r.id,
            "url_rapport": f"{url_base}/{r.id}",
            "api_base": api_base,
            "techniciens": [{"id": tech.id, "username": tech.username} for tech in r.techniciens.all()],
        }

    resultats = []
    for type_cle, queryset, url_base, api_base in configs:
        base = queryset.filter(batiment__client__organisation=organisation)

        for r in base.filter(prochaine_inspection__year=annee, prochaine_inspection__month=mois):
            categorie = "en_retard" if r.prochaine_inspection < date.today() else "rappel"
            resultats.append(_element(type_cle, r, url_base, api_base, r.prochaine_inspection, categorie))

        for r in base.filter(statut="ouvert", date_inspection__year=annee, date_inspection__month=mois):
            resultats.append(_element(type_cle, r, url_base, api_base, r.date_inspection, "planifie"))

    resultats.sort(key=lambda e: e["date"])
    return resultats


def _rapports_en_retard(organisation) -> list[dict]:
    """Tous les rappels de conformité en retard (`prochaine_inspection`
    dépassée sans nouvelle inspection planifiée), tous mois confondus —
    alimente le widget « Rappels en retard » du tableau de bord. Trié du
    plus ancien au plus récent : le plus urgent en premier."""
    configs = [
        ("incendie", Rapport.objects.select_related("batiment", "batiment__client"), "/superviseur/rapports", "titre_rapport_incendie"),
        ("extincteur", RapportExtincteur.objects.select_related("batiment", "batiment__client"), "/superviseur/rapports-extincteurs", "titre_rapport_extincteur"),
        ("eclairage", RapportEclairageUrgence.objects.select_related("batiment", "batiment__client"), "/superviseur/rapports-eclairage-urgence", "titre_rapport_eclairage"),
        ("cuisine", RapportCuisine.objects.select_related("batiment", "batiment__client"), "/superviseur/rapports-cuisine", "systeme_cuisine"),
        ("gicleur", RapportGicleur.objects.select_related("batiment", "batiment__client"), "/superviseur/rapports-gicleurs", "systeme_gicleurs"),
    ]
    aujourdhui = date.today()
    resultats = []
    for type_cle, queryset, url_base, label_cle in configs:
        base = queryset.filter(batiment__client__organisation=organisation, prochaine_inspection__lt=aujourdhui)
        for r in base:
            bat = r.batiment
            resultats.append({
                "cle": f"{type_cle}-retard-{r.id}",
                "type": type_cle,
                "label_cle": label_cle,
                "date": r.prochaine_inspection.isoformat(),
                "jours_de_retard": (aujourdhui - r.prochaine_inspection).days,
                "adresse": bat.adresse_complete,
                "client_nom": bat.client.nom,
                "rapport_id": r.id,
                "url_rapport": f"{url_base}/{r.id}",
            })
    resultats.sort(key=lambda e: e["date"])
    return resultats


class RappelsEnRetardView(APIView):
    """Liste des rappels de conformité en retard pour l'organisation —
    widget du tableau de bord superviseur."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        return Response({"rappels": _rapports_en_retard(request.user.organisation)})


class CalendrierView(APIView):
    """Calendrier mensuel des prochaines inspections dues, tous types de
    rapport confondus — `?annee=2026&mois=9` (mois courant par défaut)."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        from datetime import date

        aujourdhui = date.today()
        try:
            annee = int(request.query_params.get("annee", aujourdhui.year))
            mois = int(request.query_params.get("mois", aujourdhui.month))
        except ValueError:
            return Response({"error": "Paramètres 'annee'/'mois' invalides."}, status=status.HTTP_400_BAD_REQUEST)

        evenements = _evenements_calendrier(request.user.organisation, annee, mois)
        return Response({"annee": annee, "mois": mois, "evenements": evenements})


class CompteurRappelsView(APIView):
    """Nombre de rappels de conformité (à venir ou déjà en retard) dans le
    mois courant, tous types de rapport confondus — alimente la pastille de
    notification sur le lien Calendrier de la sidebar. Les retards des mois
    précédents sont couverts séparément par le widget du tableau de bord
    (voir RappelsEnRetardView)."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        aujourdhui = date.today()
        evenements = _evenements_calendrier(request.user.organisation, aujourdhui.year, aujourdhui.month)
        total = sum(1 for e in evenements if e["categorie"] in ("rappel", "en_retard"))
        return Response({"total": total})


class ReassignerCalendrierView(APIView):
    """Réassignation des techniciens depuis le calendrier, sans devoir ouvrir
    le rapport — `type` + `id` identifient le rapport (voir `api_base` dans
    `_evenements_calendrier`), `techniciens` la nouvelle liste d'ids."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    MODELES = {
        "incendie": Rapport,
        "extincteur": RapportExtincteur,
        "eclairage": RapportEclairageUrgence,
        "cuisine": RapportCuisine,
        "gicleur": RapportGicleur,
    }

    def patch(self, request, type_rapport, pk):
        modele = self.MODELES.get(type_rapport)
        if modele is None:
            return Response({"error": "Type de rapport invalide."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rapport = modele.objects.get(pk=pk, batiment__client__organisation=request.user.organisation)
        except modele.DoesNotExist:
            return Response({"error": "Rapport introuvable."}, status=status.HTTP_404_NOT_FOUND)

        rapport.techniciens.set(request.data.get("techniciens") or [])
        rapport.historiser(request.user, "Techniciens réassignés depuis le calendrier")
        return Response({
            "techniciens": [{"id": t.id, "username": t.username} for t in rapport.techniciens.all()],
        })


def _rapports_technicien(user, date_min, date_max) -> list[dict]:
    """Rapports (tous types) assignés au technicien connecté, dont la visite
    est prévue (`date_inspection`) dans l'intervalle donné — utilisé pour les
    sections « Aujourd'hui » et « Prochaines visites » du tableau de bord."""
    configs = [
        ("incendie", Rapport, "/technicien/rapports"),
        ("extincteur", RapportExtincteur, "/technicien/rapports-extincteurs"),
        ("eclairage", RapportEclairageUrgence, "/technicien/rapports-eclairage-urgence"),
        ("cuisine", RapportCuisine, "/technicien/rapports-cuisine"),
        ("gicleur", RapportGicleur, "/technicien/rapports-gicleurs"),
    ]
    resultats = []
    for type_cle, modele, url_base in configs:
        qs = modele.objects.filter(
            techniciens=user,
            date_inspection__gte=date_min,
            date_inspection__lte=date_max,
        ).select_related("batiment", "batiment__client").distinct()
        for r in qs:
            resultats.append({
                "cle": f"{type_cle}-{r.id}",
                "type": type_cle,
                "id": r.id,
                "statut": r.statut,
                "date_inspection": r.date_inspection.isoformat(),
                "adresse": r.batiment.adresse_complete,
                "client_nom": r.batiment.client.nom,
                "url": f"{url_base}/{r.id}",
            })
    resultats.sort(key=lambda e: e["date_inspection"])
    return resultats


class TechnicienAujourdhuiView(APIView):
    """Rapports (4 types) assignés au technicien connecté pour la date du
    jour — équivalent multi-modules de `RapportViewSet.aujourdhui` (qui ne
    couvrait que l'incendie)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import date

        aujourdhui = date.today()
        return Response(_rapports_technicien(request.user, aujourdhui, aujourdhui))


class TechnicienProchainesVisitesView(APIView):
    """Rapports (4 types) assignés au technicien connecté, prévus dans les
    7 prochains jours (demain à J+7) — pour se préparer sans encombrer la
    section « Aujourd'hui »."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import date, timedelta

        demain = date.today() + timedelta(days=1)
        fin = date.today() + timedelta(days=7)
        return Response(_rapports_technicien(request.user, demain, fin))


class CertificatsCompteursView(APIView):
    """Totaux globaux (indépendants de la recherche/du filtre/de la page en
    cours) pour les 4 cartes de statistiques en haut de la page Certificats —
    même principe que `compteurs` sur les ViewSets de rapports."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        organisation = request.user.organisation
        resultats = (
            _certificats_incendie(organisation)
            + _certificats_extincteur(organisation)
            + _certificats_gicleur(organisation)
        )
        return Response({
            "total": len(resultats),
            "envoyes": sum(1 for r in resultats if r["certificat_envoye"]),
            "conformes": sum(1 for r in resultats if r["conforme"]),
            "non_conformes": sum(1 for r in resultats if not r["conforme"]),
        })


class CertificatsExcelView(APIView):
    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        resultats = _lister_certificats(request)

        wb = excel_workbook()
        ws = wb.active
        ws.title = "Certificats"
        colonnes = ["Numéro", "Type", "Adresse", "Client", "Date d'émission", "Conforme", "Envoyé au citoyen"]
        excel_ligne_entetes(ws, colonnes, ligne=1)
        for i, r in enumerate(resultats, start=2):
            valeurs = [
                r["numero"], r["type_display"], r["adresse"], r["client_nom"],
                _date_fr(r["date_emission"]),
                "Oui" if r["conforme"] else "Non",
                "Oui" if r["certificat_envoye"] else "Non",
            ]
            for col, valeur in enumerate(valeurs, start=1):
                ws.cell(row=i, column=col, value=valeur)
        excel_ajuster_largeurs(ws, colonnes)
        ws.freeze_panes = "A2"

        return excel_reponse(wb, "Certificats")


# ── Appels de service ───────────────────────────────────────────────────────

class AppelServiceViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return AppelServiceListSerializer
        if self.action == "create":
            return AppelServiceCreateSerializer
        return AppelServiceDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = AppelService.objects.select_related(
            "batiment", "batiment__client", "cree_par"
        ).prefetch_related("techniciens", "historique").filter(batiment__client__organisation=user.organisation)

        if user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        statut = self.request.query_params.get("statut")
        client_id = self.request.query_params.get("client")
        if statut:
            qs = qs.filter(statut=statut)
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)

        return qs.distinct()

    def get_permissions(self):
        if self.action in ["create", "destroy", "assigner", "resynchroniser", "terminer_manuellement"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        if self.action in ["demarrer"]:
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien()]
        return super().get_permissions()

    def perform_create(self, serializer):
        appel = serializer.save(cree_par=self.request.user)
        if appel.techniciens.exists():
            from django.utils import timezone

            appel.statut = AppelService.Statut.ASSIGNE
            appel.date_assignation = timezone.now()
            appel.save()
        appel.historiser(self.request.user, "Appel de service créé")
        appel.synchroniser_vers_pubms()

    @action(detail=True, methods=["patch"])
    def assigner(self, request, pk=None):
        """Superviseur seulement — réassigne les techniciens après création.
        Ne re-synchronise PAS pubms (hors scope v1)."""
        appel = self.get_object()
        if "techniciens" not in request.data:
            return Response({"error": "techniciens requis."}, status=status.HTTP_400_BAD_REQUEST)

        appel.techniciens.set(request.data.get("techniciens") or [])
        if appel.techniciens.exists() and appel.statut == AppelService.Statut.OUVERT:
            from django.utils import timezone

            appel.statut = AppelService.Statut.ASSIGNE
            appel.date_assignation = timezone.now()
            appel.save()
        appel.historiser(request.user, "Techniciens réassignés (non répercuté dans pubms)")
        return Response(AppelServiceDetailSerializer(appel).data)

    @action(detail=True, methods=["post"])
    def demarrer(self, request, pk=None):
        from django.utils import timezone

        appel = self.get_object()
        if appel.statut != AppelService.Statut.ASSIGNE:
            return Response({"error": "Doit être assigné avant de démarrer."}, status=status.HTTP_400_BAD_REQUEST)
        appel.statut = AppelService.Statut.EN_COURS
        appel.date_debut = timezone.now()
        appel.save()
        appel.historiser(request.user, "Travail démarré (local, non synchronisé avec pubms)")
        return Response(AppelServiceDetailSerializer(appel).data)

    @action(detail=True, methods=["post"], url_path="terminer-manuellement")
    def terminer_manuellement(self, request, pk=None):
        appel = self.get_object()
        if appel.statut == AppelService.Statut.TERMINE:
            return Response({"error": "Déjà terminé."}, status=status.HTTP_400_BAD_REQUEST)
        appel.terminer_manuellement(request.user)
        return Response(AppelServiceDetailSerializer(appel).data)

    @action(detail=True, methods=["post"])
    def resynchroniser(self, request, pk=None):
        appel = self.get_object()
        appel.synchroniser_vers_pubms()
        return Response(AppelServiceDetailSerializer(appel).data)


# ── Tournées ─────────────────────────────────────────────────────────────
RAPPORTS_A_PLANIFIER_CONFIGS = [
    ("incendie", Rapport, "titre_rapport_incendie"),
    ("extincteur", RapportExtincteur, "titre_rapport_extincteur"),
    ("eclairage", RapportEclairageUrgence, "titre_rapport_eclairage"),
    ("cuisine", RapportCuisine, "systeme_cuisine"),
]


def _batiments_a_planifier(organisation, batiment_ids=None) -> list[dict]:
    """Bâtiments ayant au moins une échéance de conformité (à venir ou en
    retard) pas encore planifiée — groupés par secteur (`Batiment.direction`)
    pour le tableau de bord de planification. Un même bâtiment peut avoir
    plusieurs échéances (extincteurs, éclairage, etc.) : elles sont
    regroupées sous une seule entrée par bâtiment.

    Le rapport qui porte `prochaine_inspection` est déjà FERMÉ — c'est
    l'enregistrement de la visite passée, son `date_inspection` ne doit
    jamais être réécrit (ça détruirait l'historique). Une échéance est
    considérée « déjà planifiée » quand un nouveau rapport OUVERT du même
    type existe pour ce bâtiment avec une `date_inspection` fixée — que ce
    nouveau rapport ait été créé manuellement ou via l'assignation groupée.

    `batiment_ids`, si fourni, restreint la recherche à ces bâtiments
    (utilisé par l'assignation groupée pour retrouver les rapports dus)."""
    aujourdhui = date.today()

    par_batiment: dict[int, dict] = {}
    for type_cle, model, label_cle in RAPPORTS_A_PLANIFIER_CONFIGS:
        deja_planifies = set(
            model.objects.filter(
                batiment__client__organisation=organisation,
                statut="ouvert",
                date_inspection__isnull=False,
            ).values_list("batiment_id", flat=True)
        )

        qs = model.objects.select_related("batiment", "batiment__client").filter(
            batiment__client__organisation=organisation,
            prochaine_inspection__isnull=False,
        ).exclude(batiment_id__in=deja_planifies)
        if batiment_ids is not None:
            qs = qs.filter(batiment_id__in=batiment_ids)

        for r in qs:
            bat = r.batiment
            entree = par_batiment.setdefault(bat.id, {
                "batiment_id": bat.id,
                "adresse": bat.adresse_complete,
                "secteur": bat.direction,
                "taille": bat.taille,
                "client_nom": bat.client.nom,
                "echeances": [],
            })
            entree["echeances"].append({
                "type": type_cle,
                "rapport_id": r.id,
                "label_cle": label_cle,
                "date": r.prochaine_inspection.isoformat(),
                "en_retard": r.prochaine_inspection < aujourdhui,
            })

    resultats = list(par_batiment.values())
    for entree in resultats:
        entree["echeances"].sort(key=lambda e: e["date"])
        entree["prochaine_echeance"] = entree["echeances"][0]["date"]
        entree["en_retard"] = entree["echeances"][0]["en_retard"]
    resultats.sort(key=lambda e: e["prochaine_echeance"])
    return resultats


class BatimentsAPlanifierView(APIView):
    """Bâtiments à planifier, groupés par secteur — alimente le tableau de
    bord de planification (page « Tournées »)."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        return Response({"batiments": _batiments_a_planifier(request.user.organisation)})


def _visites_planifiees(organisation) -> list[dict]:
    """Visites déjà planifiées (rapports ouverts avec `date_inspection`
    fixée, aujourd'hui ou plus tard) — une seule entrée par date, avec les
    équipes de techniciens différentes regroupées à l'intérieur (`equipes`).
    Deux dates identiques ne doivent jamais apparaître comme deux cartes
    séparées, même si des adresses de ce jour-là sont réparties entre
    plusieurs équipes — sinon ça prête à confusion.

    Calculée à la volée à partir des vrais rapports plutôt que stockée à
    part : aucune resynchronisation possible, la vue reflète toujours
    l'état réel (si un rapport est replanifié ailleurs, il change de groupe
    tout seul au prochain chargement)."""
    aujourdhui = date.today()
    par_date: dict[str, dict[tuple, dict]] = {}

    for type_cle, model, label_cle in RAPPORTS_A_PLANIFIER_CONFIGS:
        qs = model.objects.select_related("batiment", "batiment__client").prefetch_related("techniciens").filter(
            batiment__client__organisation=organisation,
            statut="ouvert",
            date_inspection__isnull=False,
            date_inspection__gte=aujourdhui,
        )
        for r in qs:
            jour = r.date_inspection.isoformat()
            techs = tuple(sorted(r.techniciens.values_list("id", flat=True)))
            equipes_du_jour = par_date.setdefault(jour, {})
            equipe = equipes_du_jour.setdefault(techs, {
                "techniciens": [{"id": t.id, "username": t.username} for t in r.techniciens.all()],
                "batiments": [],
            })
            equipe["batiments"].append({
                "batiment_id": r.batiment_id,
                "rapport_id": r.id,
                "adresse": r.batiment.adresse_complete,
                "secteur": r.batiment.direction,
                "client_nom": r.batiment.client.nom,
                "type": type_cle,
                "label_cle": label_cle,
                "techniciens": [{"id": t.id, "username": t.username} for t in r.techniciens.all()],
            })

    resultats = [
        {
            "date": jour,
            "total": sum(len(equipe["batiments"]) for equipe in equipes_du_jour.values()),
            "equipes": list(equipes_du_jour.values()),
        }
        for jour, equipes_du_jour in par_date.items()
    ]
    resultats.sort(key=lambda g: g["date"])
    return resultats


class VisitesPlanifieesView(APIView):
    """Visites déjà planifiées, groupées par date + équipe de techniciens —
    calculée à la volée à partir des vrais rapports (voir
    `_visites_planifiees`), pas stockée séparément."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        return Response({"visites": _visites_planifiees(request.user.organisation)})


class AssignerPlanificationView(APIView):
    """Planifie la prochaine visite (date + techniciens) pour tous les
    rapports dus d'une sélection de bâtiments, en un seul geste depuis le
    tableau de bord « à planifier » plutôt que bâtiment par bâtiment.

    Le rapport qui porte l'échéance (`prochaine_inspection`) est déjà FERMÉ —
    c'est l'enregistrement de la visite passée, donc on ne touche jamais à
    son `date_inspection`. On planifie plutôt le rapport OUVERT qui
    représente la prochaine visite : pour les extincteurs, c'est le brouillon
    déjà généré automatiquement à la fermeture (`brouillon_suivant`, avec
    l'inventaire copié — voir `RapportExtincteur.fermer()`) ; pour les autres
    types, un nouveau rapport est créé (comme le ferait manuellement le
    superviseur via « Planifier une inspection »).

    Écrit directement sur ce vrai rapport (`date_inspection`, `techniciens`)
    : le technicien voit donc cette visite dans son propre tableau de bord,
    ça n'est pas juste une liste que le superviseur garde pour lui.

    Le client est avisé par courriel que sa visite est planifiée — même
    mécanisme que la création manuelle d'un rapport (voir
    `_envoyer_confirmation_planification_si_applicable`). Un seul courriel
    par bâtiment (pas un par type de rapport touché) : plusieurs échéances
    du même bâtiment planifiées ensemble représentent une seule visite."""

    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    MODELES = {cle: modele for cle, modele, _ in RAPPORTS_A_PLANIFIER_CONFIGS}

    LABELS = {
        "incendie": "Réseau d'alarme incendie",
        "extincteur": "Extincteurs portatifs",
        "eclairage": "Éclairage d'urgence",
        "cuisine": "Système de cuisine",
    }

    def post(self, request):
        organisation = request.user.organisation
        batiment_ids = request.data.get("batiment_ids") or []
        technicien_ids = request.data.get("techniciens") or []
        date_inspection = request.data.get("date_inspection")

        if not batiment_ids:
            return Response({"error": "batiment_ids requis."}, status=status.HTTP_400_BAD_REQUEST)
        if not date_inspection:
            return Response({"error": "date_inspection requise."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Assignée directement à `rapport.date_inspection` plus bas sans
            # passer par un serializer — doit donc déjà être un vrai `date`
            # (sinon `envoyer_confirmation_planification` plante en essayant
            # de lire `.month` sur une chaîne).
            date_inspection = date.fromisoformat(date_inspection)
        except (TypeError, ValueError):
            return Response({"error": "date_inspection invalide."}, status=status.HTTP_400_BAD_REQUEST)

        techniciens = list(Utilisateur.objects.filter(id__in=technicien_ids, role="technicien"))

        a_planifier = _batiments_a_planifier(organisation, batiment_ids=batiment_ids)
        total = 0
        for entree in a_planifier:
            premier_rapport, premier_label = None, None
            for echeance in entree["echeances"]:
                modele = self.MODELES[echeance["type"]]
                rapport_precedent = modele.objects.get(id=echeance["rapport_id"])

                brouillon = getattr(rapport_precedent, "brouillon_suivant", None)
                rapport = brouillon if brouillon is not None else modele.objects.create(
                    batiment_id=entree["batiment_id"], cree_par=request.user,
                )

                rapport.date_inspection = date_inspection
                rapport.save()
                if techniciens:
                    rapport.techniciens.set(techniciens)
                rapport.historiser(
                    request.user,
                    f"Visite planifiée le {date_inspection} depuis la planification par secteur",
                )
                total += 1
                if premier_rapport is None:
                    premier_rapport, premier_label = rapport, self.LABELS[echeance["type"]]

            if premier_rapport is not None:
                _envoyer_confirmation_planification_si_applicable(premier_rapport, premier_label)

        return Response({"rapports_planifies": total})


class TourneeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return TourneeCreateSerializer
        return TourneeSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tournee = serializer.save()
        return Response(TourneeSerializer(tournee).data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        user = self.request.user
        qs = Tournee.objects.select_related("cree_par").prefetch_related(
            "techniciens", "etapes__batiment", "etapes__batiment__client", "etapes__techniciens",
        ).filter(organisation=user.organisation)

        if user.est_technicien():
            qs = qs.filter(Q(techniciens=user) | Q(etapes__techniciens=user))

        secteur = self.request.query_params.get("secteur")
        statut = self.request.query_params.get("statut")
        if secteur:
            qs = qs.filter(secteur=secteur)
        if statut:
            qs = qs.filter(statut=statut)

        return qs.distinct().order_by("-date_tournee")

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "ajouter_batiment", "retirer_batiment", "assigner_etape"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="ajouter-batiment")
    def ajouter_batiment(self, request, pk=None):
        tournee = self.get_object()
        try:
            batiment = Batiment.objects.get(id=request.data.get("batiment_id"), client__organisation=request.user.organisation)
        except Batiment.DoesNotExist:
            return Response({"error": "Bâtiment introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if tournee.etapes.filter(batiment=batiment).exists():
            return Response({"error": "Ce bâtiment est déjà dans la tournée."}, status=status.HTTP_400_BAD_REQUEST)
        tournee.ajouter_batiment(batiment)
        return Response(TourneeSerializer(tournee).data)

    @action(detail=True, methods=["post"], url_path="retirer-batiment")
    def retirer_batiment(self, request, pk=None):
        tournee = self.get_object()
        tournee.etapes.filter(batiment_id=request.data.get("batiment_id")).delete()
        return Response(TourneeSerializer(tournee).data)

    @action(detail=True, methods=["post"], url_path="assigner-etape")
    def assigner_etape(self, request, pk=None):
        """Divise la route : assigne une étape précise à un ou des
        techniciens spécifiques (sous-ensemble des techniciens de la
        tournée, ou non), au lieu de laisser toute la tournée à tous."""
        tournee = self.get_object()
        try:
            etape = tournee.etapes.get(id=request.data.get("etape_id"))
        except TourneeBatiment.DoesNotExist:
            return Response({"error": "Étape introuvable."}, status=status.HTTP_404_NOT_FOUND)
        etape.techniciens.set(request.data.get("techniciens") or [])
        return Response(TourneeSerializer(tournee).data)


class ServiceKeyPermission(permissions.BasePermission):
    """Auth service-à-service par secret partagé — pour les appels serveur-à-serveur (ex: pubms)."""

    def has_permission(self, request, view):
        import secrets
        from django.conf import settings

        key = request.headers.get("X-Service-Key", "")
        expected = settings.INCENDIE_TO_PUBMS_KEY
        return bool(key) and bool(expected) and secrets.compare_digest(key, expected)


class PubmsCallbackAppelServiceView(APIView):
    """Reçoit la notification de pubms qu'une Tache liée à un appel de service est terminée."""

    authentication_classes = []
    permission_classes = [ServiceKeyPermission]

    def post(self, request):
        numero = request.data.get("appel_numero")
        appel_id = request.data.get("appel_id")
        nouveau_statut = request.data.get("statut")

        try:
            if numero:
                appel = AppelService.objects.get(numero=numero)
            else:
                appel = AppelService.objects.get(id=appel_id)
        except AppelService.DoesNotExist:
            return Response({"error": "Appel de service introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if nouveau_statut != "termine":
            return Response({"message": "Ignoré — seul le statut 'termine' déclenche une fermeture."}, status=status.HTTP_200_OK)

        if appel.statut == AppelService.Statut.TERMINE:
            return Response({"message": "Déjà fermé.", "statut": appel.statut}, status=status.HTTP_200_OK)

        appel.terminer_depuis_pubms()
        return Response({"message": f"{appel.numero} marqué terminé.", "statut": appel.statut}, status=status.HTTP_200_OK)