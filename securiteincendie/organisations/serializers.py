from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import DemandeEssai, Module, Organisation, OrganisationModule

Utilisateur = get_user_model()


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
