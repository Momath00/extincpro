import random
import string

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from securiteincendie.emailing import envoyer_email, html_template

from .models import DemandeEssai, Module, Organisation, OrganisationModule
from .serializers import (
    CreerSuperviseurSerializer,
    DemandeEssaiSerializer,
    OrganisationCreateSerializer,
    OrganisationSerializer,
)

Utilisateur = get_user_model()


class EstSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.est_super_admin())


class OrganisationViewSet(viewsets.ModelViewSet):
    """Gestion des organisations clientes de la plateforme — réservée au super admin."""

    permission_classes = [permissions.IsAuthenticated, EstSuperAdmin]
    queryset = Organisation.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return OrganisationCreateSerializer
        return OrganisationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organisation = serializer.save()
        return Response(OrganisationSerializer(organisation).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        organisation = self.get_object()
        champs = []
        if "est_active" in request.data:
            organisation.est_active = bool(request.data["est_active"])
            champs.append("est_active")
        if "nom" in request.data:
            organisation.nom = request.data["nom"]
            champs.append("nom")
        if "adresse" in request.data:
            organisation.adresse = request.data["adresse"]
            champs.append("adresse")
        if "logo" in request.data:
            logo = request.data["logo"] or ""
            if logo and not logo.startswith("data:image/"):
                return Response({"error": "Le logo doit être une image encodée en data URI."}, status=status.HTTP_400_BAD_REQUEST)
            if len(logo) > 700_000:
                return Response({"error": "Le logo est trop volumineux (700 Ko max)."}, status=status.HTTP_400_BAD_REQUEST)
            organisation.logo = logo
            champs.append("logo")
        if champs:
            organisation.save(update_fields=champs)
        return Response(OrganisationSerializer(organisation).data)

    @action(detail=True, methods=["get"], url_path="utilisateurs")
    def utilisateurs(self, request, pk=None):
        organisation = self.get_object()
        from api.serializers import UtilisateurSerializer

        qs = organisation.utilisateurs.order_by("-date_creation")
        return Response(UtilisateurSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="superviseurs")
    def creer_superviseur(self, request, pk=None):
        """Crée le premier compte (superviseur) d'une organisation — réservé
        au super admin, car un superviseur ne peut inviter que dans sa propre
        organisation (voir UtilisateurViewSet.inviter)."""
        organisation = self.get_object()
        serializer = CreerSuperviseurSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        mdp_temp = "".join(random.choices(string.ascii_letters + string.digits, k=10))

        utilisateur = Utilisateur.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=mdp_temp,
            role=Utilisateur.Role.SUPERVISEUR,
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            telephone=data.get("telephone", ""),
            est_actif=True,
            mdp_temporaire=True,
            organisation=organisation,
        )

        prenom = data.get("first_name") or data["username"]
        html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0a0b0d;">Bienvenue sur ExtincPro !</h2>
<p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0a0b0d;">{prenom}</strong>,<br>
  votre organisation <strong style="color:#0a0b0d;">{organisation.nom}</strong> a été créée sur la
  plateforme. Vous êtes désormais <strong style="color:#e11324;">Superviseur</strong> — vous pouvez
  inviter votre équipe (techniciens, citoyens) une fois connecté(e).
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Nom d'utilisateur</span>
      <span style="font-size:14px;font-weight:700;color:#0a0b0d;">{data['username']}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Mot de passe temporaire</span>
      <code style="display:inline-block;background:#fff2e8;color:#e11324;font-size:18px;font-weight:800;letter-spacing:3px;padding:8px 16px;border-radius:8px;border:2px solid #fed7aa;">{mdp_temp}</code>
    </td>
  </tr>
</table>
<div style="background:#fffbeb;border-left:3px solid #e11324;padding:12px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
    ⚠️ Ce mot de passe est <strong>temporaire</strong>. Vous serez invité(e) à le modifier dès votre première connexion.
  </p>
</div>"""
        envoyer_email(
            data["email"],
            f"Bienvenue sur ExtincPro — {organisation.nom}",
            html_template(html_body),
        )

        from api.serializers import UtilisateurSerializer

        return Response(
            {
                "message": f"Superviseur {data['username']} créé avec succès.",
                "utilisateur": UtilisateurSerializer(utilisateur).data,
                "mdp_temporaire": mdp_temp,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="utilisateurs/statut")
    def changer_statut_utilisateurs(self, request, pk=None):
        """Active ou désactive un ou plusieurs comptes utilisateur de cette
        organisation — réservé au super admin."""
        organisation = self.get_object()
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response(
                {"error": "Fournir une liste d'identifiants 'ids'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        est_actif = bool(request.data.get("est_actif", False))

        qs = organisation.utilisateurs.filter(pk__in=ids)
        nb = qs.update(est_actif=est_actif)

        from api.serializers import UtilisateurSerializer

        return Response(
            {
                "message": f"{nb} compte(s) {'activé(s)' if est_actif else 'désactivé(s)'}.",
                "utilisateurs": UtilisateurSerializer(
                    organisation.utilisateurs.order_by("-date_creation"), many=True
                ).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="modules/(?P<code>[^/.]+)/toggle")
    def toggle_module(self, request, pk=None, code=None):
        organisation = self.get_object()
        module = Module.objects.filter(code=code).first()
        if module is None:
            return Response({"error": "Module inconnu."}, status=status.HTTP_404_NOT_FOUND)

        lien, _ = OrganisationModule.objects.get_or_create(organisation=organisation, module=module)
        lien.actif = not lien.actif
        lien.date_activation = timezone.now() if lien.actif else None
        lien.save()

        return Response(OrganisationSerializer(organisation).data)


class DemandeEssaiViewSet(viewsets.ModelViewSet):
    """Demandes d'essai reçues via le formulaire de contact du site vitrine
    — consultées et traitées par le super admin depuis la plateforme."""

    permission_classes = [permissions.IsAuthenticated, EstSuperAdmin]
    queryset = DemandeEssai.objects.select_related("organisation_creee").all()
    serializer_class = DemandeEssaiSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def partial_update(self, request, *args, **kwargs):
        demande = self.get_object()
        champs = []
        if "statut" in request.data:
            valeurs_valides = {c for c, _ in DemandeEssai.Statut.choices}
            if request.data["statut"] not in valeurs_valides:
                return Response({"error": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
            demande.statut = request.data["statut"]
            champs.append("statut")
        if "note_interne" in request.data:
            demande.note_interne = request.data["note_interne"]
            champs.append("note_interne")
        if champs:
            demande.save(update_fields=champs)
        return Response(DemandeEssaiSerializer(demande).data)
