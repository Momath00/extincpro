from rest_framework import serializers

from api.serializers import UtilisateurSerializer
from accounts.models import Utilisateur
from .models import (
    AppelService,
    Batiment,
    BoyauItem,
    CODES_NON_CONFORMITES,
    Certificat,
    CertificatExtincteur,
    CertificatGicleur,
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
    HistoriqueRapportCuisine,
    HistoriqueRapportEclairageUrgence,
    HistoriqueRapportExtincteur,
    HistoriqueRapportGicleur,
    HotteCuisine,
    PhotoAnomalie,
    Rapport,
    RapportCuisine,
    RapportEclairageUrgence,
    RapportExtincteur,
    RapportGicleur,
    ResumeSommaire,
    SectionDispositif,
    SousRapportGicleur,
    Tournee,
    TourneeBatiment,
)


class ClientSerializer(serializers.ModelSerializer):
    nb_batiments = serializers.SerializerMethodField()
    mode_livraison_display = serializers.CharField(source="get_mode_livraison_display", read_only=True)

    def get_nb_batiments(self, obj):
        return obj.batiments.count()

    class Meta:
        model = Client
        fields = [
            "id", "type_client", "nom", "prenom", "nom_famille", "contact_nom", "contact_email", "contact_telephone",
            "adresse", "mode_livraison", "mode_livraison_display", "nb_batiments", "date_creation",
        ]
        extra_kwargs = {"nom": {"required": False}}

    def validate(self, attrs):
        type_client = attrs.get("type_client", getattr(self.instance, "type_client", Client.TypeClient.ENTREPRISE))
        if type_client == Client.TypeClient.PARTICULIER:
            prenom = (attrs.get("prenom", getattr(self.instance, "prenom", "")) or "").strip()
            nom_famille = (attrs.get("nom_famille", getattr(self.instance, "nom_famille", "")) or "").strip()
            if not prenom or not nom_famille:
                raise serializers.ValidationError({"error": "Indiquez le prénom et le nom du client."})
            attrs["nom"] = f"{prenom} {nom_famille}"
            return attrs

        nom = (attrs.get("nom", getattr(self.instance, "nom", "")) or "").strip()
        if not nom:
            raise serializers.ValidationError({"error": "Indiquez le nom de l'entreprise."})
        attrs["nom"] = nom
        attrs["prenom"] = attrs["nom_famille"] = ""
        # Deux entreprises de la même organisation ne peuvent pas porter le même nom.
        request = self.context.get("request")
        if request is not None:
            doublons = Client.objects.filter(
                organisation=request.user.organisation, type_client=Client.TypeClient.ENTREPRISE, nom__iexact=nom,
            )
            if self.instance is not None:
                doublons = doublons.exclude(pk=self.instance.pk)
            if doublons.exists():
                raise serializers.ValidationError({"error": f"Une entreprise nommée « {nom} » existe déjà."})
        return attrs


class BatimentSerializer(serializers.ModelSerializer):
    adresse_complete = serializers.CharField(read_only=True)
    client_nom = serializers.CharField(source="client.nom", read_only=True)
    client_mode_livraison = serializers.CharField(source="client.mode_livraison", read_only=True)
    client_contact_email = serializers.CharField(source="client.contact_email", read_only=True)
    client_contact_nom = serializers.CharField(source="client.contact_nom", read_only=True)
    client_contact_telephone = serializers.CharField(source="client.contact_telephone", read_only=True)
    proprietaire = UtilisateurSerializer(read_only=True)
    proprietaire_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    taille = serializers.CharField(read_only=True)

    class Meta:
        model = Batiment
        fields = [
            "id", "client", "client_nom", "client_mode_livraison", "client_contact_email",
            "client_contact_nom", "client_contact_telephone",
            "numero_civique", "rue", "ville", "code_postal",
            "adresse_complete", "fabricant_reseau", "modele_systeme", "direction",
            "type_application", "proprietaire", "proprietaire_id", "taille", "date_creation",
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
    cycle = serializers.PrimaryKeyRelatedField(read_only=True)  # cycle d'inspection (dossier du bâtiment)
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
            "id", "batiment", "techniciens", "citoyen", "statut", "statut_display", "cycle",
            "date_inspection", "prochaine_inspection", "date_prise_effet", "date_derniere_sauvegarde",
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
    gabarit = serializers.CharField(source="batiment.client.organisation.gabarit_rapports", read_only=True)

    class Meta(RapportListSerializer.Meta):
        fields = RapportListSerializer.Meta.fields + [
            "cree_par", "fiche_e1", "fiche_e2", "fiche_legende", "resume_sommaire",
            "sections", "historique", "certificat", "gabarit",
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
        fields = ["id", "batiment", "techniciens", "citoyen", "date_inspection", "prochaine_inspection"]
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
            "prochain_test_hydrostatique", "derniere_inspection", "derniere_recharge",
            "dernier_test_hydrostatique", "remarque", "non_conformites",
        ]
        read_only_fields = ["rapport"]

    def validate_non_conformites(self, valeur):
        if not isinstance(valeur, list):
            raise serializers.ValidationError("Liste de codes attendue.")
        inconnus = [c for c in valeur if c not in CODES_NON_CONFORMITES]
        if inconnus:
            raise serializers.ValidationError(f"Code(s) inconnu(s) : {', '.join(map(str, inconnus))}")
        # Ordre de la légende, sans doublon.
        return [c for c in CODES_NON_CONFORMITES if c in valeur]


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
    numero_affiche = serializers.CharField(read_only=True)

    class Meta:
        model = CertificatExtincteur
        fields = [
            "id", "numero", "numero_affiche", "revision", "statut", "type_document",
            "date_emission", "emis_par", "certificat_envoye",
        ]


class HistoriqueRapportExtincteurSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportExtincteur
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportExtincteurListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    cycle = serializers.PrimaryKeyRelatedField(read_only=True)  # cycle d'inspection (dossier du bâtiment)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nb_extincteurs = serializers.SerializerMethodField()
    certificat = serializers.SerializerMethodField()
    rapport_eclairage_lie = serializers.SerializerMethodField()
    rapport_cuisine_lie = serializers.SerializerMethodField()

    def get_nb_extincteurs(self, obj):
        return obj.extincteurs.count()

    def get_certificat(self, obj):
        try:
            c = obj.certificat
            return {
                "numero": c.numero_affiche, "certificat_envoye": c.certificat_envoye,
                "statut": c.statut, "type_document": c.type_document,
            }
        except Exception:
            return None

    def get_rapport_eclairage_lie(self, obj):
        eclairage = getattr(obj, "rapport_eclairage_lie", None)
        if eclairage is None:
            return None
        return {"id": eclairage.id, "statut": eclairage.statut}

    def get_rapport_cuisine_lie(self, obj):
        cuisine = getattr(obj, "rapport_cuisine_lie", None)
        if cuisine is None:
            return None
        return {"id": cuisine.id, "statut": cuisine.statut}

    class Meta:
        model = RapportExtincteur
        fields = [
            "id", "batiment", "rapport_alarme", "techniciens", "citoyen", "numero_job",
            "statut", "statut_display", "cycle", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "nb_extincteurs", "certificat", "rapport_eclairage_lie",
            "rapport_cuisine_lie",
        ]


class RapportExtincteurDetailSerializer(RapportExtincteurListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    extincteurs = ExtincteurItemSerializer(many=True, read_only=True)
    boyaux = BoyauItemSerializer(many=True, read_only=True)
    historique = HistoriqueRapportExtincteurSerializer(many=True, read_only=True)
    certificat = CertificatExtincteurSerializer(read_only=True)

    gabarit = serializers.CharField(source="batiment.client.organisation.gabarit_rapports", read_only=True)

    class Meta(RapportExtincteurListSerializer.Meta):
        fields = RapportExtincteurListSerializer.Meta.fields + [
            "cree_par", "extincteurs", "boyaux", "historique", "certificat",
            "gabarit", "remarques", "recommandations", "obligations",
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
        fields = ["id", "batiment", "techniciens", "citoyen", "numero_job", "date_inspection", "prochaine_inspection"]
        read_only_fields = ["id"]


# ── Rapport éclairage d'urgence ─────────────────────────────────────────────

class EclairageUrgenceItemSerializer(serializers.ModelSerializer):
    etat_display = serializers.CharField(source="get_etat_display", read_only=True)

    class Meta:
        model = EclairageUrgenceItem
        fields = [
            "id", "rapport", "ordre", "emplacement", "etage", "fabricant", "dispositif",
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

    gabarit = serializers.CharField(source="batiment.client.organisation.gabarit_rapports", read_only=True)

    class Meta(RapportEclairageUrgenceListSerializer.Meta):
        fields = RapportEclairageUrgenceListSerializer.Meta.fields + [
            "cree_par", "eclairages_urgence", "historique",
            "gabarit", "remarques", "recommandations", "obligations",
        ]


class RapportEclairageUrgenceCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création automatique (liée) ou manuelle."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )

    class Meta:
        model = RapportEclairageUrgence
        fields = ["id", "batiment", "techniciens", "numero_job", "date_inspection", "prochaine_inspection"]
        read_only_fields = ["id"]


# ── Rapport cuisine (système fixe d'extinction, ULC ORD 1254.6) ─────────────

class HotteCuisineSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotteCuisine
        fields = ["id", "rapport", "ordre", "label", "nombre_buses", "buses", "elevations", "appareils", "dividers", "tailles"]
        read_only_fields = ["rapport"]


class HistoriqueRapportCuisineSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportCuisine
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportCuisineListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    rapport_extincteur_id = serializers.IntegerField(source="rapport_extincteur.id", read_only=True, default=None)
    est_conforme = serializers.BooleanField(read_only=True)
    nb_verifications_conformes = serializers.IntegerField(read_only=True)

    class Meta:
        model = RapportCuisine
        fields = [
            "id", "batiment", "techniciens", "numero_job",
            "statut", "statut_display", "date_inspection", "date_derniere_sauvegarde",
            "date_fermeture", "rapport_extincteur_id", "est_conforme",
            "nb_verifications_conformes", "conforme_recommandations",
        ]


class RapportCuisineDetailSerializer(RapportCuisineListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    hottes = HotteCuisineSerializer(many=True, read_only=True)
    historique = HistoriqueRapportCuisineSerializer(many=True, read_only=True)

    class Meta(RapportCuisineListSerializer.Meta):
        fields = RapportCuisineListSerializer.Meta.fields + [
            "cree_par", "hottes", "historique",
            "courtier", "fabricant", "modele", "numero_serie", "type_agent",
            "date_installation", "alimentation", "dispositif_coupure", "nombre_buses",
            "liens_fusibles_360f", "liens_fusibles_450f", "liens_fusibles_500f",
            "buses_liens_fusibles", "date_dernier_essai_hydrostatique",
            "date_derniere_recharge", "prochaine_inspection", "raccordement",
            "appareils_proteges", "liens_fusibles_remplaces", "installation_conforme_fabricant",
            "cable_tension_verifie", "pression_manometre_verifiee", "conduits_decharge_verifies",
            "cylindres_supports_inspectes", "extincteur_portatif_type_k", "station_manuelle_degagee",
            "etiquettes_verification_apposees", "buses_protecteurs_nettoyes",
            "systeme_condition_normale", "liens_fusibles_nettoyes", "commentaires",
        ]


class RapportCuisineCreateSerializer(serializers.ModelSerializer):
    """Utilisé pour créer un rapport cuisine indépendant, et pour le modifier
    (superviseur ou technicien assigné) — le lien à un rapport extincteur, lui,
    n'est jamais posé par ce serializer (voir _creer_rapport_cuisine_lie)."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )

    class Meta:
        model = RapportCuisine
        fields = [
            "id", "batiment", "techniciens", "numero_job", "date_inspection",
            "courtier", "fabricant", "modele", "numero_serie", "type_agent",
            "date_installation", "alimentation", "dispositif_coupure", "nombre_buses",
            "liens_fusibles_360f", "liens_fusibles_450f", "liens_fusibles_500f",
            "buses_liens_fusibles", "date_dernier_essai_hydrostatique",
            "date_derniere_recharge", "prochaine_inspection", "raccordement",
            "appareils_proteges", "liens_fusibles_remplaces", "installation_conforme_fabricant",
            "cable_tension_verifie", "pression_manometre_verifiee", "conduits_decharge_verifies",
            "cylindres_supports_inspectes", "extincteur_portatif_type_k", "station_manuelle_degagee",
            "etiquettes_verification_apposees", "buses_protecteurs_nettoyes",
            "systeme_condition_normale", "liens_fusibles_nettoyes", "commentaires",
            "conforme_recommandations",
        ]
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


# ── Tournées ─────────────────────────────────────────────────────────────
class TourneeEtapeSerializer(serializers.ModelSerializer):
    batiment = BatimentSerializer(read_only=True)
    techniciens = UtilisateurSerializer(many=True, read_only=True)

    class Meta:
        model = TourneeBatiment
        fields = ["id", "batiment", "ordre", "visite", "techniciens"]


class TourneeSerializer(serializers.ModelSerializer):
    """Lecture — détail et liste."""

    techniciens = UtilisateurSerializer(many=True, read_only=True)
    etapes = TourneeEtapeSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    cree_par = UtilisateurSerializer(read_only=True)

    class Meta:
        model = Tournee
        fields = [
            "id", "secteur", "date_tournee", "statut", "statut_display", "notes",
            "techniciens", "etapes", "cree_par", "date_creation",
        ]


class TourneeCreateSerializer(serializers.ModelSerializer):
    """Création — à partir d'une sélection de bâtiments à planifier (ex.
    depuis le tableau de bord « à planifier par secteur »)."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    batiment_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )

    class Meta:
        model = Tournee
        fields = ["id", "secteur", "date_tournee", "techniciens", "notes", "batiment_ids"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        batiment_ids = validated_data.pop("batiment_ids", [])
        techniciens = validated_data.pop("techniciens", [])
        request = self.context["request"]
        organisation = request.user.organisation

        tournee = Tournee.objects.create(
            organisation=organisation, cree_par=request.user, **validated_data
        )
        if techniciens:
            tournee.techniciens.set(techniciens)

        batiments_par_id = {
            b.id: b for b in Batiment.objects.filter(id__in=batiment_ids, client__organisation=organisation)
        }
        for batiment_id in batiment_ids:
            batiment = batiments_par_id.get(batiment_id)
            if batiment is not None:
                tournee.ajouter_batiment(batiment)
        return tournee

# ── Rapport gicleur ──────────────────────────────────────────────────────────

class PhotoAnomalieSerializer(serializers.ModelSerializer):
    ajoutee_par_nom = serializers.SerializerMethodField()

    def get_ajoutee_par_nom(self, obj):
        u = obj.ajoutee_par
        return (u.get_full_name() or u.username) if u else ""

    class Meta:
        model = PhotoAnomalie
        fields = [
            "id", "emplacement", "description", "ordre", "date_ajout", "ajoutee_par_nom", "section",
            "sous_rapport_gicleur", "section_fiche",
        ]
        read_only_fields = ["ordre", "date_ajout", "section", "sous_rapport_gicleur", "section_fiche"]


class SousRapportGicleurSerializer(serializers.ModelSerializer):
    """Fiche d'un système. En modification, `reponses` et `remarques` sont
    FUSIONNÉES avec l'existant (seules les clés envoyées changent ; une
    valeur nulle ou vide efface la clé) — chaque champ du formulaire
    s'enregistre seul, y compris depuis la file hors ligne."""

    deficiences = serializers.SerializerMethodField()

    def get_deficiences(self, obj):
        return obj.deficiences()

    class Meta:
        model = SousRapportGicleur
        fields = ["id", "rapport", "type_fiche", "numero_systeme", "ordre", "reponses", "remarques", "deficiences"]
        read_only_fields = ["rapport", "ordre"]

    def validate(self, attrs):
        from .gicleur_fiches import champs_de_la_fiche, sections_avec_deficiences, valider_valeur

        type_fiche = attrs.get("type_fiche") or getattr(self.instance, "type_fiche", None)
        if self.instance is not None and "type_fiche" in attrs and attrs["type_fiche"] != self.instance.type_fiche:
            raise serializers.ValidationError({"type_fiche": "Le type d'une fiche ne peut pas être changé."})
        champs = champs_de_la_fiche(type_fiche) if type_fiche else {}
        sections = sections_avec_deficiences(type_fiche) if type_fiche else set()

        for cle in ("reponses", "remarques"):
            valeurs = attrs.get(cle)
            if valeurs is None:
                continue
            if not isinstance(valeurs, dict):
                raise serializers.ValidationError({cle: "Objet attendu."})
            for code, valeur in valeurs.items():
                if cle == "remarques":
                    # Déficiences d'une section : {code de section: texte}.
                    if code not in sections or (valeur not in (None, "") and (not isinstance(valeur, str) or len(valeur) > 3000)):
                        raise serializers.ValidationError({cle: f"Déficiences invalides : {code}."})
                    continue
                champ = champs.get(code)
                if champ is None:
                    raise serializers.ValidationError({cle: f"Champ inconnu : {code}."})
                try:
                    valider_valeur(champ, valeur)
                except ValueError as e:
                    raise serializers.ValidationError({cle: f"{code} : {e}"})
        return attrs

    def update(self, instance, validated_data):
        for cle in ("reponses", "remarques"):
            nouvelles = validated_data.pop(cle, None)
            if nouvelles is None:
                continue
            fusion = dict(getattr(instance, cle) or {})
            for code, valeur in nouvelles.items():
                if valeur in (None, "", []):
                    fusion.pop(code, None)
                else:
                    fusion[code] = valeur
            setattr(instance, cle, fusion)
        return super().update(instance, validated_data)


class CertificatGicleurSerializer(serializers.ModelSerializer):
    conforme = serializers.BooleanField(read_only=True)

    class Meta:
        model = CertificatGicleur
        fields = [
            "id", "numero", "date_emission", "emis_par", "certificat_envoye",
            "mode_envoi", "date_envoi", "envoye_a", "conforme",
        ]


class HistoriqueRapportGicleurSerializer(serializers.ModelSerializer):
    utilisateur = UtilisateurSerializer(read_only=True)

    class Meta:
        model = HistoriqueRapportGicleur
        fields = ["id", "utilisateur", "description", "date_heure"]


class RapportGicleurListSerializer(serializers.ModelSerializer):
    """Version allégée — pour les listes."""

    batiment = BatimentSerializer(read_only=True)
    cycle = serializers.PrimaryKeyRelatedField(read_only=True)  # cycle d'inspection (dossier du bâtiment)
    techniciens = UtilisateurSerializer(many=True, read_only=True)
    citoyen = UtilisateurSerializer(read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    certificat = serializers.SerializerMethodField()

    def get_certificat(self, obj):
        cert = getattr(obj, "certificat", None)
        if cert is None:
            return None
        return {"numero": cert.numero, "certificat_envoye": cert.certificat_envoye}

    fiches = serializers.SerializerMethodField()

    def get_fiches(self, obj):
        """Résumé des sous-rapports pour le tableau des rapports (lignes
        imbriquées sous chaque rapport) — sans les réponses."""
        from .gicleur_fiches import progression_sous_rapport

        resume = []
        for sr in obj.sous_rapports.all():
            repondus, total = progression_sous_rapport(sr)
            resume.append({
                "id": sr.id, "type_fiche": sr.type_fiche, "numero_systeme": sr.numero_systeme,
                "nb_deficiences": len(sr.deficiences()), "repondus": repondus, "total": total,
            })
        return resume

    resume_debits_valves = serializers.SerializerMethodField()

    def get_resume_debits_valves(self, obj):
        """null si la section n'est pas ajoutée."""
        from .gicleur_fiches import deficiences_debits_valves

        if obj.debits_valves is None:
            return None
        return {"nb_lignes": len(obj.debits_valves.get("lignes", [])), "nb_deficiences": len(deficiences_debits_valves(obj))}

    class Meta:
        model = RapportGicleur
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job", "statut", "statut_display", "cycle",
            "date_inspection", "date_derniere_sauvegarde", "date_fermeture", "prochaine_inspection",
            "date_creation", "frequence_inspection", "certificat", "fiches", "resume_debits_valves",
        ]


class RapportGicleurDetailSerializer(RapportGicleurListSerializer):
    cree_par = UtilisateurSerializer(read_only=True)
    sous_rapports = SousRapportGicleurSerializer(many=True, read_only=True)
    photos = PhotoAnomalieSerializer(many=True, read_only=True)
    historique = HistoriqueRapportGicleurSerializer(many=True, read_only=True)
    certificat = CertificatGicleurSerializer(read_only=True)
    est_conforme = serializers.BooleanField(read_only=True)

    class Meta(RapportGicleurListSerializer.Meta):
        fields = RapportGicleurListSerializer.Meta.fields + [
            "cree_par", "est_conforme", "identification", "sous_rapports", "debits_valves", "photos", "historique",
        ]


class RapportGicleurCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le superviseur — création et modification de l'en-tête."""

    techniciens = serializers.PrimaryKeyRelatedField(
        many=True, required=False,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.TECHNICIEN),
    )
    citoyen = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=Utilisateur.objects.filter(role=Utilisateur.Role.CITOYEN),
    )

    class Meta:
        model = RapportGicleur
        fields = [
            "id", "batiment", "techniciens", "citoyen", "numero_job", "date_inspection",
            "prochaine_inspection", "frequence_inspection", "debits_valves", "identification",
        ]
        read_only_fields = ["id"]

    def validate_identification(self, valeur):
        from .gicleur_fiches import valider_identification

        try:
            valider_identification(valeur)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        return valeur

    def update(self, instance, validated_data):
        # Identification : fusion clé par clé — chaque champ s'enregistre seul.
        if "identification" in validated_data:
            from .gicleur_fiches import fusionner_identification

            validated_data["identification"] = fusionner_identification(instance.identification, validated_data["identification"])
        return super().update(instance, validated_data)

    def validate_debits_valves(self, valeur):
        from .gicleur_fiches import valider_debits_valves

        try:
            valider_debits_valves(valeur)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        return valeur
