"""API appelée uniquement par MS Solution Informatique, la société mère qui
gère la facturation d'ExtincPro.

Sens des échanges :
- MS Solution LIT les organisations (les nouvelles, pas encore liées à un
  client, apparaissent dans sa liste « À lier ») ;
- MS Solution ORDONNE : lier un client, fixer les modules, fixer la fin
  d'essai, bloquer ou débloquer l'accès.

Chaque ordre donne un état final (« gicleur = actif »), jamais une bascule :
le rejouer après une panne réseau ne change rien. Chaque ordre est tracé dans
JournalIntegration.

Authentification : en-tête `Authorization: Bearer <MS_SOLUTION_API_KEY>`.
"""

import hmac

from django.conf import settings
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import JournalIntegration, Module, Organisation, OrganisationModule


class CleMsSolution(permissions.BasePermission):
    message = "Clé d'intégration MS Solution manquante ou invalide."

    def has_permission(self, request, view):
        attendue = settings.MS_SOLUTION_API_KEY
        if not attendue:
            return False
        entete = request.META.get("HTTP_AUTHORIZATION", "")
        if not entete.startswith("Bearer "):
            return False
        return hmac.compare_digest(entete[len("Bearer "):].encode(), attendue.encode())


class OrganisationIntegrationSerializer(serializers.ModelSerializer):
    modules = serializers.SerializerMethodField()
    nb_utilisateurs = serializers.SerializerMethodField()
    contact = serializers.SerializerMethodField()

    class Meta:
        model = Organisation
        fields = [
            "id", "nom", "adresse", "langue", "est_active", "date_fin_essai",
            "date_creation", "ms_client_id", "modules", "nb_utilisateurs", "contact",
        ]

    def get_modules(self, obj):
        return [
            {"code": lien.module.code, "nom": lien.module.nom, "actif": lien.actif}
            for lien in obj.organisationmodule_set.select_related("module").order_by("module__nom")
        ]

    def get_nb_utilisateurs(self, obj):
        return obj.utilisateurs.count()

    def get_contact(self, obj):
        """Premier superviseur — sert à MS Solution pour proposer un client
        existant (même courriel) ou pré-remplir la fiche du nouveau client."""
        sup = obj.utilisateurs.filter(role="superviseur").order_by("date_creation").first()
        if sup is None:
            return None
        return {
            "nom": sup.get_full_name() or sup.username,
            "courriel": sup.email,
            "telephone": sup.telephone,
        }


def _journaliser(organisation, action, donnees):
    JournalIntegration.objects.create(
        organisation=organisation, organisation_nom=organisation.nom, action=action, donnees=donnees,
    )


def _reponse(organisation):
    organisation.refresh_from_db()
    return Response(OrganisationIntegrationSerializer(organisation).data)


class VueIntegration(APIView):
    authentication_classes = []
    permission_classes = [CleMsSolution]

    def organisation(self, pk):
        return get_object_or_404(Organisation, pk=pk)


class OrganisationsIntegrationView(VueIntegration):
    def get(self, request):
        qs = Organisation.objects.all()
        if request.query_params.get("non_liees") in ("1", "true"):
            qs = qs.filter(ms_client_id__isnull=True)
        return Response(OrganisationIntegrationSerializer(qs, many=True).data)


class OrganisationIntegrationView(VueIntegration):
    def get(self, request, pk):
        return Response(OrganisationIntegrationSerializer(self.organisation(pk)).data)


class LierClientView(VueIntegration):
    """{"ms_client_id": 42} lie l'organisation au client ; null la délie."""

    def post(self, request, pk):
        organisation = self.organisation(pk)
        ms_client_id = request.data.get("ms_client_id")
        if ms_client_id is not None:
            try:
                ms_client_id = int(ms_client_id)
            except (TypeError, ValueError):
                return Response({"error": "ms_client_id invalide."}, status=status.HTTP_400_BAD_REQUEST)
        organisation.ms_client_id = ms_client_id
        try:
            with transaction.atomic():
                organisation.save(update_fields=["ms_client_id"])
        except IntegrityError:
            return Response(
                {"error": "Ce client MS Solution est déjà lié à une autre organisation."},
                status=status.HTTP_409_CONFLICT,
            )
        _journaliser(organisation, "lier" if ms_client_id else "delier", {"ms_client_id": ms_client_id})
        return _reponse(organisation)


class ModulesIntegrationView(VueIntegration):
    """{"modules": {"gicleur": true, "rapport_cuisine": false}} — les modules
    non mentionnés ne changent pas."""

    def post(self, request, pk):
        organisation = self.organisation(pk)
        demandes = request.data.get("modules")
        if not isinstance(demandes, dict) or not demandes:
            return Response(
                {"error": "Fournir « modules » : {code: true|false}."}, status=status.HTTP_400_BAD_REQUEST,
            )
        modules = {m.code: m for m in Module.objects.filter(code__in=demandes.keys())}
        inconnus = sorted(set(demandes) - set(modules))
        if inconnus:
            return Response(
                {"error": f"Module(s) inconnu(s) : {', '.join(inconnus)}."}, status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for code, actif in demandes.items():
                lien, _ = OrganisationModule.objects.get_or_create(organisation=organisation, module=modules[code])
                actif = bool(actif)
                if lien.actif != actif:
                    lien.actif = actif
                    lien.date_activation = timezone.now() if actif else None
                    lien.save(update_fields=["actif", "date_activation"])
            _journaliser(organisation, "modules", {"modules": {c: bool(a) for c, a in demandes.items()}})
        return _reponse(organisation)


class AccesIntegrationView(VueIntegration):
    """{"est_active": false} bloque toute l'organisation ; true la débloque."""

    def post(self, request, pk):
        organisation = self.organisation(pk)
        if "est_active" not in request.data:
            return Response({"error": "Fournir « est_active »."}, status=status.HTTP_400_BAD_REQUEST)
        est_active = bool(request.data["est_active"])
        organisation.est_active = est_active
        organisation.save(update_fields=["est_active"])
        _journaliser(
            organisation, "debloquer" if est_active else "bloquer",
            {"motif": str(request.data.get("motif", ""))[:300]},
        )
        return _reponse(organisation)


class EssaiIntegrationView(VueIntegration):
    """{"date_fin_essai": "2026-12-31"} fixe la fin d'essai ; null la retire
    (client payant)."""

    def post(self, request, pk):
        organisation = self.organisation(pk)
        if "date_fin_essai" not in request.data:
            return Response({"error": "Fournir « date_fin_essai »."}, status=status.HTTP_400_BAD_REQUEST)
        valeur = request.data["date_fin_essai"]
        if valeur:
            try:
                valeur = serializers.DateField().to_internal_value(valeur)
            except serializers.ValidationError:
                return Response({"error": "Date invalide (AAAA-MM-JJ)."}, status=status.HTTP_400_BAD_REQUEST)
        organisation.date_fin_essai = valeur or None
        organisation.save(update_fields=["date_fin_essai"])
        _journaliser(organisation, "essai", {"date_fin_essai": str(valeur) if valeur else None})
        return _reponse(organisation)


class ModulesDisponiblesView(VueIntegration):
    """Codes des modules — MS Solution les associe aux articles de son catalogue."""

    def get(self, request):
        return Response([{"code": m.code, "nom": m.nom} for m in Module.objects.all()])
