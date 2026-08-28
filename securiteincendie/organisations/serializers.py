import base64
from io import BytesIO

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from PIL import Image
from rest_framework import serializers

from .models import DemandeEssai, Module, Organisation, OrganisationModule

Utilisateur = get_user_model()

LOGO_TAILLE_MAX = 700_000  # ~700 Ko encodé (~500 Ko réels) — assez pour un logo, trop petit pour un abus de stockage.
# Les gabarits PDF affichent toujours le logo à une hauteur fixe (46-52px CSS) —
# c'est donc la hauteur de la source qui détermine la netteté, pas la largeur
# (un logo large de type bannière, avec peu de hauteur, reste net). On exige un
# peu plus que la hauteur d'affichage max pour éviter l'agrandissement (flou)
# une fois imprimé/exporté en PDF à une résolution plus élevée que l'écran.
LOGO_HAUTEUR_MIN = 80


def valider_logo(value: str) -> str | None:
    """Valide un logo d'organisation (data URI base64). Retourne un message
    d'erreur si invalide, ou None si le logo est vide ou valide."""
    if not value:
        return None
    if not value.startswith("data:image/"):
        return "Le logo doit être une image encodée en data URI."
    if len(value) > LOGO_TAILLE_MAX:
        return "Le logo est trop volumineux (700 Ko max)."
    try:
        _, b64data = value.split(",", 1)
        with Image.open(BytesIO(base64.b64decode(b64data))) as img:
            _largeur, hauteur = img.size
    except Exception:
        return "Le logo est corrompu ou dans un format d'image non reconnu."
    if hauteur < LOGO_HAUTEUR_MIN:
        return (
            f"Le logo est trop petit ({LOGO_HAUTEUR_MIN}px de hauteur minimum) "
            "pour rester net sur les rapports et certificats PDF."
        )
    return None


class ModuleActifSerializer(serializers.Serializer):
    code = serializers.CharField(source="module.code")
    nom = serializers.CharField(source="module.nom")
    actif = serializers.BooleanField()


class OrganisationSerializer(serializers.ModelSerializer):
    modules = serializers.SerializerMethodField()
    nb_utilisateurs = serializers.SerializerMethodField()

    class Meta:
        model = Organisation
        fields = [
            "id",
            "nom",
            "slug",
            "adresse",
            "logo",
            "est_active",
            "date_creation",
            "modules",
            "nb_utilisateurs",
        ]
        read_only_fields = ["slug", "date_creation"]

    def get_modules(self, obj):
        liens = obj.organisationmodule_set.select_related("module").order_by("module__nom")
        return ModuleActifSerializer(liens, many=True).data

    def get_nb_utilisateurs(self, obj):
        return obj.utilisateurs.count()

    def validate_logo(self, value):
        erreur = valider_logo(value)
        if erreur:
            raise serializers.ValidationError(erreur)
        return value


class CreerSuperviseurSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    telephone = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if Utilisateur.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà utilisé.")
        return value

    def validate_email(self, value):
        if Utilisateur.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value


class OrganisationCreateSerializer(serializers.Serializer):
    nom = serializers.CharField(max_length=150)
    adresse = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def validate_nom(self, value):
        if Organisation.objects.filter(nom=value).exists():
            raise serializers.ValidationError("Une organisation avec ce nom existe déjà.")
        return value

    def create(self, validated_data):
        nom = validated_data["nom"]
        adresse = validated_data.get("adresse", "")
        slug_base = slugify(nom)
        slug = slug_base
        i = 2
        while Organisation.objects.filter(slug=slug).exists():
            slug = f"{slug_base}-{i}"
            i += 1

        organisation = Organisation.objects.create(nom=nom, slug=slug, adresse=adresse)

        # Tous les modules existants sont créés inactifs par défaut pour la
        # nouvelle organisation — le super admin les active explicitement.
        OrganisationModule.objects.bulk_create(
            [OrganisationModule(organisation=organisation, module=m) for m in Module.objects.all()]
        )
        return organisation


class DemandeEssaiSerializer(serializers.ModelSerializer):
    organisation_creee_nom = serializers.CharField(source="organisation_creee.nom", read_only=True)

    class Meta:
        model = DemandeEssai
        fields = [
            "id",
            "nom_complet",
            "entreprise",
            "email",
            "telephone",
            "message",
            "statut",
            "organisation_creee",
            "organisation_creee_nom",
            "note_interne",
            "date_creation",
            "date_maj",
        ]
        read_only_fields = ["date_creation", "date_maj", "organisation_creee_nom"]


class DemandeEssaiCreateSerializer(serializers.ModelSerializer):
    """Utilisé par le formulaire de contact public — aucun champ interne exposé."""

    class Meta:
        model = DemandeEssai
        fields = ["nom_complet", "entreprise", "email", "telephone", "message"]
