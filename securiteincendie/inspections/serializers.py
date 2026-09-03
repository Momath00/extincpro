from rest_framework import serializers

from api.serializers import UtilisateurSerializer
from accounts.models import Utilisateur
from .models import (
    AppelService,
    Batiment,
    BoyauItem,
    Certificat,
    CertificatExtincteur,
    Client,
    Dispositif,
    EclairageUrgenceItem,
    EtageResume,
    ExtincteurItem,
    FicheE1,
    FicheE2,
    FicheLegende,
    HistoriqueAppelService,
    HistoriqueRapport,
    HistoriqueRapportEclairageUrgence,
    HistoriqueRapportExtincteur,
    Rapport,
    RapportEclairageUrgence,
    RapportExtincteur,
    ResumeSommaire,
    SectionDispositif,
)


class ClientSerializer(serializers.ModelSerializer):
    nb_batiments = serializers.SerializerMethodField()

    def get_nb_batiments(self, obj):
        return obj.batiments.count()

    class Meta:
        model = Client
        fields = [
            "id", "nom", "contact_nom", "contact_email", "contact_telephone",
            "adresse", "nb_batiments", "date_creation",
        ]


class BatimentSerializer(serializers.ModelSerializer):
    adresse_complete = serializers.CharField(read_only=True)
    client_nom = serializers.CharField(source="client.nom", read_only=True)
    proprietaire = UtilisateurSerializer(read_only=True)
    proprietaire_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Batiment
        fields = [
            "id", "client", "client_nom", "numero_civique", "rue", "ville", "code_postal",
            "adresse_complete", "fabricant_reseau", "modele_systeme", "direction",
            "type_application", "proprietaire", "proprietaire_id", "date_creation",
        ]


class EtageResumeSerializer(serializers.ModelSerializer):
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = EtageResume
        fields = ["id", "resume", "nom", "description", "etat", "etat_display", "ordre"]
        read_only_fields = ["resume"]


class ResumeSommaireSerializer(serializers.ModelSerializer):
    etages = EtageResumeSerializer(many=True, read_only=True)

    class Meta:
        model = ResumeSommaire
        fields = ["observations_generales", "resume_citoyen", "etages"]


class SectionDispositifSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionDispositif
        fields = ["id", "rapport", "nom", "ordre"]
        read_only_fields = ["rapport"]


class DispositifSerializer(serializers.ModelSerializer):
    type_dispositif_display = serializers.CharField(source="get_type_dispositif_display", read_only=True)
    annonce_statut_display = serializers.CharField(source="get_annonce_statut_display", read_only=True)
    est_defectueux = serializers.BooleanField(read_only=True)

    class Meta:
        model = Dispositif
        fields = [
            "id", "rapport", "section", "localisation", "type_dispositif", "type_dispositif_display",
            "modele", "installation_correcte", "necessite_entretien", "alarme_confirmee",
            "annonce_statut", "annonce_statut_display", "est_defectueux", "zone_circuit", "remarque",
        ]
        read_only_fields = ["rapport"]


class SectionAvecDispositifsSerializer(serializers.ModelSerializer):
    """Une section et ses dispositifs regroupés — pour l'affichage de la fiche E3."""

    dispositifs = DispositifSerializer(many=True, read_only=True)

    class Meta:
        model = SectionDispositif
        fields = ["id", "nom", "ordre", "dispositifs"]


class FicheE1Serializer(serializers.ModelSerializer):
    signataire = UtilisateurSerializer(read_only=True)

    class Meta:
        model = FicheE1
        fields = [
            "fonctionnement_une_etape", "fonctionnement_deux_etapes", "inspection_essai_conforme",
            "documentation_sur_place", "reseau_fonctionnel", "lacunes_constatees",
            "commentaires", "copie_remise_responsable", "signataire", "date_signature",
        ]
        read_only_fields = ["signataire", "date_signature"]


class FicheE2Serializer(serializers.ModelSerializer):
    class Meta:
        model = FicheE2
        fields = [
            "localisation", "description_panneau",
            "tension_sous_alimentation", "tension_pleine_charge", "courant_charge",
            "code_dateur_batterie", "signal_alarme_ok", "rearmement_ok", "commutation_alimentation_ok",
            "details",
        ]


class FicheLegendeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FicheLegende
        fields = ["dispositifs"]


class CertificatSerializer(serializers.ModelSerializer):
    conforme = serializers.BooleanField(read_only=True)

    class Meta:
        model = Certificat
        fields = ["id", "numero", "date_emission", "fichier_pdf", "emis_par", "certificat_envoye", "conforme"]


class HistoriqueRapportSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapport
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes (dashboard, recherche par client/adresse)."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nb_dispositifs = serializers.SerializerMethodField()
    nb_lacunes = serializers.SerializerMethodField()
    a_certificat = serializers.SerializerMethodField()
    certificat = serializers.SerializerMethodField()
    progression = serializers.SerializerMethodField()

    def get_nb_dispositifs(self, obj):
        return obj.dispositifs.count()

    def get_nb_lacunes(self, obj):
        return obj.dispositifs.filter(necessite_entretien=True).count()

    def get_a_certificat(self, obj):
        return hasattr(obj, "certificat")

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {"numero": c.numero, "certificat_envoye": c.certificat_envoye, "conforme": c.conforme}
        except Exception:
            return None

    def get_progression(self, obj):
        try:
            e1 = obj.fiche_e1
            e1_done = e1.fonctionnement_une_etape is not None or e1.reseau_fonctionnel is not None
        except Exception:
            e1_done = False
        try:
            e2 = obj.fiche_e2
            e2_done = bool(e2.details)
        except Exception:
            e2_done = False
        return {
            "e1": e1_done,
            "e2": e2_done,
            "e3": obj.dispositifs.exists(),
            "ferme": obj.statut == "ferme",
            "certificat": self.get_a_certificat(obj),
        }

    class Meta:
        model = Rapport
        fields = [
            "id", "batiment", "techniciens", "citoyen", "statut", "statut_display",
            "date_inspection", "date_prise_effet", "date_derniere_sauvegarde",
            "date_fermeture", "nb_dispositifs", "nb_lacunes", "a_certificat",
            "certificat", "progression",
        ]


class RapportDetailSerializer(RapportListSerializer):
    """Version complète — E1 + E2 + dispositifs + historique + certificat."""

    cree_par = UtilisateurSerializer(read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    fiche_e1 = FicheE1Serializer(read_only=True)
    fiche_e2 = FicheE2Serializer(read_only=True)
    fiche_legende = FicheLegendeSerializer(read_only=True)
    resume_sommaire = ResumeSommaireSerializer(read_only=True)
    sections = SectionAvecDispositifsSerializer(many=True, read_only=True)
    historique = HistoriqueRapportSerializer(many=True, read_only=True)
    certificat = CertificatSerializer(read_only=True)

    class Meta(RapportListSerializer.Meta):
        fields = RapportListSerializer.Meta.fields + [
            "cree_par", "fiche_e1", "fiche_e2", "fiche_legende", "resume_sommaire",
            "sections", "historique", "certificat",
        ]


class RapportCitoyenSerializer(RapportListSerializer):
    """
    Vue simplifiée pour le citoyen : seulement le résumé en langage simple
    et le certificat — pas les fiches techniques E1/E2/E3.
    """

    resume_sommaire = serializers.SerializerMethodField()
    certificat = CertificatSerializer(read_only=True)

    def get_resume_sommaire(self, obj):
        if not hasattr(obj, "resume_sommaire"):
            return None
        r = obj.resume_sommaire
        return {
            "resume_citoyen": r.resume_citoyen,
            "etages": [
                {"nom": e.nom, "etat": e.get_etat_display()}
                for e in r.etages.all()
            ],
        }

    class Meta(RapportListSerializer.Meta):
        fields = RapportListSerializer.Meta.fields + ["resume_sommaire", "certificat"]


class RapportCreateSerializer(serializers.ModelSerializer):
    """Utilisé uniquement par le superviseur pour créer un rapport."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    citoyen = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.CITOYEN),
    )
    date_inspection = serializers.DateField(
        required=True,
        allow_null=False,
        error_messages={
            "required": "La date d'inspection est obligatoire.",
            "null": "La date d'inspection est obligatoire.",
            "invalid": "La date d'inspection est invalide.",
        },
    )

    class Meta:
        model = Rapport
        fields = ["id", "batiment", "techniciens", "citoyen", "date_inspection"]
        read_only_fields = ["id"]


# ── Rapport extincteurs portatifs ───────────────────────────────────────────

class ExtincteurItemSerializer(serializers.ModelSerializer):
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    type_extincteur_display = serializers.CharField(source="get_type_extincteur_display", read_only=True)
    marque_display = serializers.CharField(source="get_marque_display", read_only=True)
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = ExtincteurItem
        fields = [
            "id", "rapport", "ordre", "etage", "etat", "etat_display", "emplacement", "date_fabrication",
            "format", "format_display", "type_extincteur", "type_extincteur_display",
            "marque", "marque_display", "numero_serie", "prochaine_maintenance",
            "prochain_test_hydrostatique", "remarque",
        ]
        read_only_fields = ["rapport"]


class BoyauItemSerializer(serializers.ModelSerializer):
    longueur_display = serializers.CharField(source="get_longueur_display", read_only=True)
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = BoyauItem
        fields = [
            "id", "rapport", "ordre", "etage", "etat", "etat_display", "emplacement",
            "longueur", "longueur_display", "date_fabrication", "prochain_test_hydrostatique", "remarque",
        ]
        read_only_fields = ["rapport"]


class CertificatExtincteurSerializer(serializers.ModelSerializer):
    class Meta:
        model = CertificatExtincteur
        fields = ["id", "numero", "date_emission", "emis_par", "certificat_envoye"]


class HistoriqueRapportExtincteurSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportExtincteur
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportExtincteurListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nb_extincteurs = serializers.SerializerMethodField()
    certificat = serializers.SerializerMethodField()
    rapport_eclairage_lie = serializers.SerializerMethodField()

    def get_nb_extincteurs(self, obj):
        return obj.extincteurs.count()

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {"numero": c.numero, "certificat_envoye": c.certificat_envoye}
        except Exception:
            return None

    def get_rapport_eclairage_lie(self, obj):
        eclairage = getattr(obj, "rapport_eclairage_lie", None)
        if eclairage is None:
            return None
        return {"id": eclairage.id, "statut": eclairage.statut}

    class Meta:
        model = RapportExtincteur
        fields = [
            "id", "batiment", "rapport_alarme", "techniciens", "citoyen", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_extincteurs", "certificat", "rapport_eclairage_lie",
        ]


class RapportExtincteurDetailSerializer(RapportExtincteurListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    extincteurs = ExtincteurItemSerializer(many=True, read_only=True)
    boyaux = BoyauItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportExtincteurSerializer(many=True, read_only=True)
    certificat = CertificatExtincteurSerializer(read_only=True)

    class Meta(RapportExtincteurListSerializer.Meta):
        fields = RapportExtincteurListSerializer.Meta.fields + [
            "cree_par", "extincteurs", "boyaux", "historique", "certificat",
        ]


class RapportExtincteurCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création automatique (liée) ou manuelle."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    citoyen = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.CITOYEN),
    )

    class Meta:
        model = RapportExtincteur
        fields = ["id", "batiment", "techniciens", "citoyen", "numero_job", "date_inspection"]
        read_only_fields = ["id"]


# ── Rapport éclairage d'urgence ─────────────────────────────────────────────

class EclairageUrgenceItemSerializer(serializers.ModelSerializer):
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = EclairageUrgenceItem
        fields = [
            "id", "rapport", "ordre", "emplacement", "etage",
            "modele", "voltage", "etat", "etat_display", "remarque",
        ]
        read_only_fields = ["rapport"]


class HistoriqueRapportEclairageUrgenceSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportEclairageUrgence
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportEclairageUrgenceListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nb_eclairages_urgence = serializers.SerializerMethodField()
    rapport_extincteur_id = serializers.IntegerField(source="rapport_extincteur.id", read_only=True, default=None)

    def get_nb_eclairages_urgence(self, obj):
        return obj.eclairages_urgence.count()

    class Meta:
        model = RapportEclairageUrgence
        fields = [
            "id", "batiment", "techniciens", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_eclairages_urgence", "rapport_extincteur_id",
        ]


class RapportEclairageUrgenceDetailSerializer(RapportEclairageUrgenceListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    eclairages_urgence = EclairageUrgenceItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportEclairageUrgenceSerializer(many=True, read_only=True)

    class Meta(RapportEclairageUrgenceListSerializer.Meta):
        fields = RapportEclairageUrgenceListSerializer.Meta.fields + [
            "cree_par", "eclairages_urgence", "historique",
        ]


class RapportEclairageUrgenceCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création automatique (liée) ou manuelle."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )

    class Meta:
        model = RapportEclairageUrgence
        fields = ["id", "batiment", "techniciens", "numero_job", "date_inspection"]
        read_only_fields = ["id"]


# ── Appels de service ───────────────────────────────────────────────────────

class HistoriqueAppelServiceSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueAppelService
        fields = ["id", "utilisateur", "description", "date_heure"]


class AppelServiceListSerializer(serializers.ModelSerializer):
    """Version allégée — pour la liste/dashboard."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = AppelService
        fields = [
            "id", "numero", "batiment", "techniciens", "titre", "statut", "statut_display",
            "date_inspection", "date_assignation", "date_debut", "date_terminaison",
            "pubms_sync_status", "date_creation",
        ]


class AppelServiceDetailSerializer(AppelServiceListSerializer):
    """Version complète — historique + détails de synchronisation pubms."""

    cree_par = UtilisateurSerializer(read_only=True)
    historique = HistoriqueAppelServiceSerializer(many=True, read_only=True)

    class Meta(AppelServiceListSerializer.Meta):
        fields = AppelServiceListSerializer.Meta.fields + [
            "cree_par", "description", "historique",
            "pubms_tache_id", "pubms_sync_error", "pubms_sync_tentatives", "date_dernier_sync",
        ]


class AppelServiceCreateSerializer(serializers.ModelSerializer):
    """Utilisé uniquement par le superviseur pour créer un appel de service."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    date_inspection = serializers.DateField(
        required=True,
        allow_null=False,
        error_messages={
            "required": "La date d'inspection est obligatoire.",
            "null": "La date d'inspection est obligatoire.",
            "invalid": "La date d'inspection est invalide.",
        },
    )

    class Meta:
        model = AppelService
        fields = ["id", "batiment", "titre", "description", "techniciens", "date_inspection"]
        read_only_fields = ["id"]