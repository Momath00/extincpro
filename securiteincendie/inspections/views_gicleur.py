"""Module « Rapport gicleur » — inspection annuelle du système de gicleurs
(NFPA 13), porté du projet Préventex. Module autonome : sa propre page de
création, son propre certificat (CERT-GIC-…), son propre envoi au client.

Séparé de `views.py` (déjà très long) ; réutilise ses helpers partagés
(permissions, recherche, compteurs, traductions des documents)."""

from django.db.models import F
from django.http import HttpResponse
from django.utils.html import escape
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import Utilisateur
from securiteincendie.emailing import organisation_logo_content

from .gicleur_checklist import (
    CATEGORIES_SOUPAPE_COMMANDE,
    CATEGORIES_SOUPAPE_COMMANDE_EN,
    CHAMP_TEXTE_COMPLEMENTAIRE,
    CHAMP_TEXTE_COMPLEMENTAIRE_EN,
    SECTIONS,
    label_item,
    titre_section,
)
from .models import (
    Batiment,
    Client,
    GicleurAmelioration,
    GicleurCommentaireSection,
    GicleurEssaiEcoulement,
    GicleurIdentificationSysteme,
    GicleurInstallationSpeciale,
    GicleurPointBas,
    GicleurReponseChecklist,
    GicleurReponseNegative,
    GicleurSoupapeCommande,
    GicleurValveEtageSupervise,
    RapportGicleur,
)
from .pagination import RapportPagination
from .photos import PhotosRapportMixin, html_annexe_photos
from .serializers import (
    GicleurAmeliorationSerializer,
    GicleurCommentaireSectionSerializer,
    GicleurEssaiEcoulementSerializer,
    GicleurIdentificationSystemeSerializer,
    GicleurInstallationSpecialeSerializer,
    GicleurPointBasSerializer,
    GicleurReponseChecklistSerializer,
    GicleurReponseNegativeSerializer,
    GicleurSoupapeCommandeSerializer,
    GicleurValveEtageSuperviseSerializer,
    HistoriqueRapportGicleurSerializer,
    RapportGicleurCreateSerializer,
    RapportGicleurDetailSerializer,
    RapportGicleurListSerializer,
)
from .views import (
    EstSuperviseur,
    EstSuperviseurOuTechnicien,
    _compteurs_statuts,
    _creer_rapport_alarme_lie,
    _creer_rapport_eclairage_seul,
    _creer_rapport_extincteur_lie,
    _date_fr,
    _envoyer_avis_changement_date_si_applicable,
    _envoyer_confirmation_planification_si_applicable,
    _filtrer_recherche_rapport,
)
from .views import _t as _t_commun

LABEL_GICLEUR = "Système de gicleurs"


class EstModuleRapportGicleurActif(permissions.BasePermission):
    message = "Le module « Rapport gicleur » n'est pas activé pour votre organisation."

    def has_permission(self, request, view):
        organisation = getattr(request.user, "organisation", None)
        return bool(organisation and organisation.a_le_module("rapport_gicleur"))


def _creer_rapports_jumeaux(rapport_gicleur, utilisateur, request_data):
    """Cases « Avec système d'alarme / extincteurs / éclairage d'urgence » de
    la page « Nouveau rapport gicleur » (comme dans Préventex) — voir les
    fonctions communes `_creer_rapport_*_lie` dans views.py."""
    libelle = "gicleur"
    _creer_rapport_alarme_lie(rapport_gicleur, utilisateur, request_data, libelle)
    if _creer_rapport_extincteur_lie(rapport_gicleur, utilisateur, request_data, libelle) is None:
        _creer_rapport_eclairage_seul(rapport_gicleur, utilisateur, request_data, libelle)


# ── Rapport gicleur ──────────────────────────────────────────────────────

class RapportGicleurViewSet(PhotosRapportMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, EstModuleRapportGicleurActif]
    pagination_class = RapportPagination
    champ_rapport_photo = "rapport_gicleur"

    def get_serializer_class(self):
        if self.action == "list":
            return RapportGicleurListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return RapportGicleurCreateSerializer
        return RapportGicleurDetailSerializer

    def _queryset_de_base(self):
        user = self.request.user
        qs = RapportGicleur.objects.select_related(
            "batiment", "batiment__client", "cree_par", "citoyen"
        ).prefetch_related("techniciens").filter(batiment__client__organisation=user.organisation)

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)

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

    def get_permissions(self):
        if self.action in ["create", "destroy", "reassigner", "rouvrir", "fermer", "envoyer_certificat", "renvoyer_certificat"]:
            return [permissions.IsAuthenticated(), EstSuperviseur(), EstModuleRapportGicleurActif()]
        if self.action in ["update", "partial_update"]:
            # Le technicien remplit aussi l'en-tête (type de système, local,
            # recommandations…) — pas seulement les lignes de checklist.
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien(), EstModuleRapportGicleurActif()]
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        rapport.creer_structure_par_defaut()
        rapport.historiser(self.request.user, "Rapport créé")
        _creer_rapports_jumeaux(rapport, self.request.user, self.request.data)
        _envoyer_confirmation_planification_si_applicable(rapport, LABEL_GICLEUR)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if instance.statut == RapportGicleur.Statut.FERME and not user.est_superviseur():
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        if not user.est_superviseur():
            # Le technicien ne réassigne rien — bâtiment, techniciens, client
            # et dates restent au superviseur.
            for champ in ("batiment", "techniciens", "citoyen", "date_inspection", "prochaine_inspection"):
                serializer.validated_data.pop(champ, None)
        ancienne_date = instance.date_inspection
        ancienne_prochaine = instance.prochaine_inspection
        rapport = serializer.save()
        rapport.historiser(user, "Rapport modifié")
        _envoyer_avis_changement_date_si_applicable(rapport, LABEL_GICLEUR, ancienne_date, ancienne_prochaine)

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(
                    pk=request.data["batiment"], client__organisation=request.user.organisation
                )
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
        return Response(RapportGicleurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut == RapportGicleur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)
        rapport.fermer(request.user)
        return Response(RapportGicleurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportGicleur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)
        rapport.rouvrir(request.user)
        return Response(RapportGicleurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportGicleur.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        if rapport.batiment.client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import envoyer_certificats_directs_batiment

            ok, message = envoyer_certificats_directs_batiment(rapport.batiment, request.user)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        from django.utils import timezone

        cert = rapport.certificat
        cert.certificat_envoye = True
        cert.mode_envoi = cert.ModeEnvoi.CITOYEN
        cert.date_envoi = timezone.now()
        cert.envoye_a = rapport.citoyen.username if rapport.citoyen else ""
        cert.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_gicleur_disponible

            envoyer_email_certificat_gicleur_disponible(rapport)
        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["post"], url_path="renvoyer-certificat")
    def renvoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        if rapport.batiment.client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import renvoyer_document_direct

            ok, message = renvoyer_document_direct(rapport, "gicleur", request.user)
            if not ok:
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": message})

        if not (rapport.citoyen and rapport.citoyen.email):
            return Response({"error": "Aucun citoyen avec courriel assigné à ce rapport."}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone

        cert = rapport.certificat
        cert.mode_envoi = cert.ModeEnvoi.CITOYEN
        cert.date_envoi = timezone.now()
        cert.envoye_a = rapport.citoyen.username
        cert.save()
        rapport.historiser(request.user, f"Certificat renvoyé au citoyen {rapport.citoyen.username}")

        from .emailing import envoyer_email_certificat_gicleur_disponible

        envoyer_email_certificat_gicleur_disponible(rapport)
        return Response({"message": "Certificat renvoyé au citoyen."})

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportGicleurSerializer(rapport.historique.all(), many=True).data)

    # ── Lignes ajoutables (tableaux extensibles et listes libres) ─────────

    def _ajouter_ligne(self, request, serializer_class, related_name, champ_ordre, libelle):
        rapport = self.get_object()
        lignes = getattr(rapport, related_name)
        if request.method == "GET":
            return Response(serializer_class(lignes.all(), many=True).data)

        user = request.user
        if not (user.est_superviseur() or user.est_technicien()):
            return Response({"error": "Vous ne pouvez pas modifier ce rapport."}, status=status.HTTP_403_FORBIDDEN)
        if rapport.statut == RapportGicleur.Statut.FERME and not user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        valeur = lignes.count() + 1
        serializer.save(rapport=rapport, **{champ_ordre: str(valeur) if champ_ordre == "position" else valeur})
        rapport.historiser(user, f"{libelle} ajouté(e)")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="identifications-systemes")
    def identifications_systemes(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurIdentificationSystemeSerializer, "identifications_systemes", "numero", "Système")

    @action(detail=True, methods=["get", "post"], url_path="essais-ecoulement")
    def essais_ecoulement(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurEssaiEcoulementSerializer, "essais_ecoulement", "ordre", "Essai d'écoulement")

    @action(detail=True, methods=["get", "post"], url_path="installations-speciales")
    def installations_speciales(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurInstallationSpecialeSerializer, "installations_speciales", "ordre", "Installation spéciale")

    @action(detail=True, methods=["get", "post"], url_path="points-bas")
    def points_bas(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurPointBasSerializer, "points_bas", "position", "Point bas")

    @action(detail=True, methods=["get", "post"], url_path="reponses-negatives")
    def reponses_negatives(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurReponseNegativeSerializer, "reponses_negatives", "ordre", "Réponse négative")

    @action(detail=True, methods=["get", "post"])
    def ameliorations(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurAmeliorationSerializer, "ameliorations", "ordre", "Amélioration")

    @action(detail=True, methods=["get", "post"], url_path="valves-etage-supervise")
    def valves_etage_supervise(self, request, pk=None):
        return self._ajouter_ligne(request, GicleurValveEtageSuperviseSerializer, "valves_etage_supervise", "ordre", "Valve d'étage supervisé")

    @action(detail=True, methods=["put"], url_path="commentaires-sections")
    def commentaires_sections(self, request, pk=None):
        """Enregistre le commentaire d'une section : {"section": "5", "texte": "…"}.
        Un texte vide supprime le commentaire."""
        rapport = self.get_object()
        user = request.user
        if not (user.est_superviseur() or user.est_technicien()):
            return Response({"error": "Vous ne pouvez pas modifier ce rapport."}, status=status.HTTP_403_FORBIDDEN)
        if rapport.statut == RapportGicleur.Statut.FERME and not user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)

        section = str(request.data.get("section", "")).strip()
        if section not in GicleurCommentaireSection.SECTIONS_AVEC_COMMENTAIRE:
            return Response({"error": "Section invalide."}, status=status.HTTP_400_BAD_REQUEST)
        texte = (request.data.get("texte") or "").strip()
        if texte:
            GicleurCommentaireSection.objects.update_or_create(rapport=rapport, section=section, defaults={"texte": texte})
        else:
            GicleurCommentaireSection.objects.filter(rapport=rapport, section=section).delete()
        return Response(GicleurCommentaireSectionSerializer(rapport.commentaires_sections.all(), many=True).data)

    # ── Documents ────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportGicleur.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(html_certificat_gicleur(rapport), content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        return HttpResponse(html_rapport_gicleur_complet(rapport), content_type="text/html; charset=utf-8")


# ── Lignes individuelles (PATCH direct depuis le formulaire) ─────────────

def _lignes_de_l_organisation(model, user):
    qs = model.objects.select_related("rapport").filter(rapport__batiment__client__organisation=user.organisation)
    if user.est_technicien():
        qs = qs.filter(rapport__techniciens=user)
    return qs.distinct()


class _LigneGicleurViewSet(viewsets.ModelViewSet):
    """Base commune : lecture/modification/suppression d'une ligne, bloquée
    pour le technicien une fois le rapport fermé. La création passe par les
    actions du rapport (voir `RapportGicleurViewSet._ajouter_ligne`)."""

    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportGicleurActif]
    model = None

    def get_queryset(self):
        return _lignes_de_l_organisation(self.model, self.request.user)

    def _verifier_ouvert(self, instance):
        if instance.rapport.statut == RapportGicleur.Statut.FERME and not self.request.user.est_superviseur():
            raise ValidationError("Le rapport associé est fermé.")

    def perform_update(self, serializer):
        self._verifier_ouvert(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_ouvert(instance)
        instance.delete()


class GicleurReponseChecklistViewSet(_LigneGicleurViewSet):
    # Les questions sont fixes : on ne supprime jamais une ligne de checklist.
    http_method_names = ["get", "patch", "head", "options"]
    serializer_class = GicleurReponseChecklistSerializer
    model = GicleurReponseChecklist


class GicleurSoupapeCommandeViewSet(_LigneGicleurViewSet):
    http_method_names = ["get", "patch", "head", "options"]
    serializer_class = GicleurSoupapeCommandeSerializer
    model = GicleurSoupapeCommande


class GicleurIdentificationSystemeViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurIdentificationSystemeSerializer
    model = GicleurIdentificationSysteme


class GicleurEssaiEcoulementViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurEssaiEcoulementSerializer
    model = GicleurEssaiEcoulement


class GicleurInstallationSpecialeViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurInstallationSpecialeSerializer
    model = GicleurInstallationSpeciale


class GicleurPointBasViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurPointBasSerializer
    model = GicleurPointBas


class GicleurReponseNegativeViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurReponseNegativeSerializer
    model = GicleurReponseNegative


class GicleurAmeliorationViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurAmeliorationSerializer
    model = GicleurAmelioration


class GicleurValveEtageSuperviseViewSet(_LigneGicleurViewSet):
    serializer_class = GicleurValveEtageSuperviseSerializer
    model = GicleurValveEtageSupervise


# ── Documents imprimables (certificat + rapport complet) ─────────────────

I18N_GICLEUR = {
    "systeme_gicleurs": {"fr": "Système de gicleurs", "en": "Sprinkler system"},
    "rapport_gicleur": {"fr": "Rapport d'inspection — système de gicleurs", "en": "Inspection report — sprinkler system"},
    "norme": {"fr": "Norme", "en": "Standard"},
    "verification_no": {"fr": "Vérification n°", "en": "Inspection no."},
    "au_soin_de": {"fr": "Au soin de", "en": "Attention"},
    "localisation": {"fr": "Localisation", "en": "Location"},
    "compagnie": {"fr": "Compagnie", "en": "Company"},
    "representant": {"fr": "Représentant", "en": "Representative"},
    "verificateur": {"fr": "Vérificateur", "en": "Inspector"},
    "type_systeme": {"fr": "Type de système", "en": "System type"},
    "frequence": {"fr": "Fréquence des inspections", "en": "Inspection frequency"},
    "compagnie_installatrice": {"fr": "Compagnie installatrice", "en": "Installing company"},
    "identification_systeme": {"fr": "Identification du système", "en": "System identification"},
    "systeme_n": {"fr": "Système", "en": "System"},
    "question": {"fr": "Question", "en": "Question"},
    "oui": {"fr": "Oui", "en": "Yes"},
    "non": {"fr": "Non", "en": "No"},
    "so": {"fr": "S.O.", "en": "N/A"},
    "commentaire": {"fr": "Commentaire", "en": "Comment"},
    "categorie": {"fr": "Catégorie", "en": "Category"},
    "nombre": {"fr": "Nombre", "en": "Number"},
    "type": {"fr": "Type", "en": "Type"},
    "ouvertes": {"fr": "Ouvertes", "en": "Open"},
    "protegees": {"fr": "Protégées", "en": "Secured"},
    "identifiees": {"fr": "Identifiées", "en": "Identified"},
    "condition": {"fr": "Condition", "en": "Condition"},
    "essais_hydrauliques": {"fr": "Essais d'écoulement", "en": "Flow tests"},
    "pression_systeme": {"fr": "Pression système (lbs)", "en": "System pressure (lbs)"},
    "localisation_drain": {"fr": "Localisation drain", "en": "Drain location"},
    "dimension_tuyau": {"fr": "Dim. tuyau", "en": "Pipe size"},
    "pression_statique": {"fr": "Pression statique", "en": "Static pressure"},
    "pression_residuelle": {"fr": "Pression résiduelle", "en": "Residual pressure"},
    "pression_apres": {"fr": "Pression après", "en": "Pressure after"},
    "pompe_surpression": {"fr": "Pompe de surpression", "en": "Jockey pump"},
    "marche": {"fr": "Marche", "en": "On"},
    "arret": {"fr": "Arrêt", "en": "Off"},
    "installation_speciale_detail": {"fr": "Installation spéciale — détail", "en": "Special installation — details"},
    "degre_temperature": {"fr": "Degré de température", "en": "Temperature rating"},
    "points_bas": {"fr": "Localisation des points bas", "en": "Low point locations"},
    "description": {"fr": "Description", "en": "Description"},
    "vidange": {"fr": "Vidange", "en": "Drained"},
    "valves_etage": {"fr": "Valve d'étage supervisé", "en": "Supervised floor valve"},
    "modifications_recentes": {
        "fr": "Modifications récentes de l'affectation des locaux ou du matériel d'incendie",
        "en": "Recent changes in occupancy or fire protection equipment",
    },
    "ajustements": {"fr": "Ajustements ou corrections effectués lors de notre visite", "en": "Adjustments or corrections made during our visit"},
    "reponses_negatives": {"fr": "Réponses négatives", "en": "Negative answers"},
    "ameliorations": {"fr": "Améliorations souhaitées", "en": "Recommended improvements"},
    "aucune": {"fr": "Aucune", "en": "None"},
    "photos_anomalies": {"fr": "Photos des anomalies", "en": "Deficiency photos"},
    "suite": {"fr": "suite", "en": "continued"},
    "inspection_gicleurs": {
        "fr": "Le système de gicleurs a été inspecté conformément à la norme NFPA 13.",
        "en": "The sprinkler system was inspected in accordance with NFPA 13.",
    },
    "footer_certificat_gicleur": {"fr": "Certificat de conformité — système de gicleurs", "en": "Certificate of compliance — sprinkler system"},
    "footer_rapport_gicleur": {"fr": "Rapport d'inspection — système de gicleurs", "en": "Inspection report — sprinkler system"},
    "prochaine_inspection": {"fr": "Prochaine inspection", "en": "Next inspection"},
    "depart": {"fr": "Départ", "en": "Start"},
    "heure_depart": {"fr": "Heure départ", "en": "Start time"},
    "heure_arret": {"fr": "Heure arrêt", "en": "Stop time"},
    "compresseur": {"fr": "Compresseur", "en": "Compressor"},
    "entree_principale": {"fr": "Localisation de l'avertisseur de garde : entrée principale", "en": "Supervisory alarm location: main entrance"},
    "a": {"fr": "Système", "en": "System"},
    "b": {"fr": "Zone protégée", "en": "Protected area"},
    "c": {"fr": "Marque", "en": "Brand"},
    "d": {"fr": "Modèle", "en": "Model"},
    "e": {"fr": "Année", "en": "Year"},
    "f": {"fr": "Diamètre", "en": "Diameter"},
    "g": {"fr": "Lieu du robinet d'essai", "en": "Test valve location"},
    "h": {"fr": "Pompe de surpression", "en": "Jockey pump"},
    "i": {"fr": "Compresseur à air", "en": "Air compressor"},
    "j": {"fr": "Plaque signalétique", "en": "Nameplate"},
    "k": {"fr": "Identification complète", "en": "Complete identification"},
}

TYPES_SYSTEME_I18N = {
    "eau": {"fr": "Sous eau", "en": "Wet-pipe"},
    "air": {"fr": "Sous air", "en": "Dry-pipe"},
    "deluge": {"fr": "Déluge", "en": "Deluge"},
    "preaction": {"fr": "Préaction", "en": "Pre-action"},
    "combine": {"fr": "Combiné", "en": "Combined"},
}

FREQUENCES_I18N = {
    "annuelle": {"fr": "Annuelle", "en": "Annual"},
    "semestrielle": {"fr": "Semestrielle", "en": "Semi-annual"},
    "trimestrielle": {"fr": "Trimestrielle", "en": "Quarterly"},
    "mensuelle": {"fr": "Mensuelle", "en": "Monthly"},
}

CHAMPS_IDENTIFICATION = [
    ("a", "systeme"), ("b", "zone_protegee"), ("c", "marque"), ("d", "modele"), ("e", "annee"),
    ("f", "diametre"), ("g", "lieu_robinet_essai"), ("h", "pompe_surpression"), ("i", "compresseur_air"),
    ("j", "plaque_signaletique"), ("k", "identification_complete"),
]


def _tg(langue, cle):
    if cle in I18N_GICLEUR:
        return I18N_GICLEUR[cle].get(langue, I18N_GICLEUR[cle]["fr"])
    return _t_commun(langue, cle)


def _choix(dico, code, langue):
    if not code:
        return "—"
    entree = dico.get(code)
    return entree.get(langue, entree["fr"]) if entree else code


def _categorie_soupape(code, langue):
    if langue == "en":
        return CATEGORIES_SOUPAPE_COMMANDE_EN.get(code, code)
    return dict(CATEGORIES_SOUPAPE_COMMANDE).get(code, code)


def _v(valeur):
    return escape(valeur) if valeur else "—"


def html_certificat_gicleur(rapport) -> str:
    from .pdf_design import CSS_DOCUMENT, ICONE_BOUCLIER, ICONE_CALENDRIER, ICONE_GICLEUR, ICONE_PERSONNE, ICONE_PIN, case, entete, icone, icone_badge, pied_de_page

    cert = rapport.certificat
    bat = rapport.batiment
    organisation = bat.client.organisation
    langue = organisation.langue
    t = lambda cle: _tg(langue, cle)

    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f"  {bat.code_postal}"

    date_insp = _date_fr(rapport.date_inspection)
    date_cert = _date_fr(cert.date_emission)
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in rapport.techniciens.all()) or "—"

    est_conforme = rapport.est_conforme
    conformite_bg = "#dcfce7" if est_conforme else "#fee2e2"
    conformite_color = "#16a34a" if est_conforme else "#e11324"
    badge_texte = t("conforme_badge") if est_conforme else t("non_conforme_badge")
    badge_style = (
        "color:#16a34a;background:#dcfce7;border:1px solid #bbf7d0;" if est_conforme
        else "color:#e11324;background:#fee2e2;border:1px solid #fecaca;"
    )
    ligne_systeme = (
        f"<tr><td class='bold'><span style='display:inline-flex;align-items:center;gap:8px;'>"
        f"{icone_badge(ICONE_GICLEUR)}<span>{t('systeme_gicleurs')}"
        f"{' — ' + _choix(TYPES_SYSTEME_I18N, rapport.type_systeme, langue) if rapport.type_systeme else ''}</span></span></td>"
        f"<td class='center'>{case(est_conforme, '#16a34a')}</td>"
        f"<td class='center'>{case(not est_conforme, '#e11324')}</td>"
        f"<td class='center'>{case(False)}</td>"
        f"<td class='center'><span style='display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:0.5px;{badge_style}border-radius:100px;padding:3px 10px;'>{badge_texte}</span></td></tr>"
    )

    organisation_nom = organisation.nom
    emetteur = (cert.emis_par.get_full_name() or cert.emis_par.username) if cert.emis_par else "—"
    entete_html = entete(
        organisation_logo_content(organisation, 46), organisation_nom,
        f"{t('inspection_certification')} — {t('systeme_gicleurs')}",
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
  <h2>{t("certificat_verification")}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
  <p>{t("systeme_gicleurs")}</p>
</div>
<div style="text-align:center;margin-bottom:14px;">
  <span style="display:inline-block;background:{conformite_bg};border:1.5px solid {conformite_color};color:{conformite_color};font-size:11pt;font-weight:900;letter-spacing:2px;padding:5px 22px;border-radius:100px;">{badge_texte}</span>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:11pt;">{escape(bat.client.nom)}</div>
</div>
<div style="text-align:center;margin-bottom:6px;">
  <div class="card-title">{t("adresse_inspectee")}</div>
</div>
<div class="info-card" style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:18px;">
  <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f1f5f9;flex-shrink:0;">{icone(ICONE_PIN, 16, '#6b7280')}</span>
  <div class="card-main" style="font-size:20pt; font-weight:900;">{escape(adresse)}</div>
</div>
<div style="background:#0a0b0d;color:#fff;text-align:center;padding:7px 10px;border-radius:4px;margin-bottom:8px;">
  <span style="display:inline-flex;align-items:center;gap:6px;font-size:8pt;font-weight:800;letter-spacing:0.3px;">{icone(ICONE_BOUCLIER, 13, '#fff')}{t("conformite_bandeau")}</span>
</div>
<table class="equip-table">
  <thead><tr><th>{t("equipement")}</th><th class="center">{t("conforme_col")}</th><th class="center">{t("non_conforme_col")}</th><th class="center">{t("so")}</th><th class="center">{t("statut_col")}</th></tr></thead>
  <tbody>{ligne_systeme}</tbody>
</table>
<p style="text-align:center;font-weight:700;font-size:8.5pt;color:#0a0b0d;margin-top:14px;line-height:1.4;">
  {t("inspection_gicleurs")}
</p>
<div class="sig-row">
  <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
    <span class="sig-icon">{icone(ICONE_PERSONNE, 14, '#e11324')}</span>
    <div>
      <div class="sig-label">{t("superviseur_responsable")}</div>
      <div class="sig-name">{escape(emetteur)}</div>
      <div style="font-size:8pt;color:#555;">{escape(organisation_nom)}</div>
    </div>
  </div>
  <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
    <span class="sig-icon">{icone(ICONE_CALENDRIER, 14, '#e11324')}</span>
    <div>
      <div class="sig-label">{t("date_emission")}</div>
      <div class="sig-name">{date_cert}</div>
      <div style="font-size:8pt;color:#555;">{t("prochaine_inspection")} : {_date_fr(rapport.prochaine_inspection)}</div>
    </div>
  </div>
</div>
{pied_de_page(organisation_nom, t("footer_certificat_gicleur"))}
</div>
</body>
</html>"""


CSS_RAPPORT_GICLEUR = """
  .gic-sec{ display:flex; align-items:center; gap:10px; margin:20px 0 8px; padding-bottom:6px; border-bottom:2px solid #0a0b0d; break-after:avoid; page-break-after:avoid; }
  .gic-num{ display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:24px; padding:0 6px; border-radius:100px; background:#0a0b0d; color:#fff; font-size:9pt; font-weight:900; }
  .gic-titre{ font-size:10pt; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#0a0b0d; }
  .gic-sous{ font-size:8.5pt; font-weight:800; color:#0a0b0d; margin:10px 0 4px; }
  .gic-table{ width:100%; border-collapse:collapse; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; font-size:8.8pt; }
  .gic-table th{ background:linear-gradient(135deg,#0a0b0d,#232733); color:#fff; font-size:7.5pt; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; padding:6px 8px; text-align:left; }
  .gic-table th.c, .gic-table td.c{ text-align:center; }
  .gic-table td{ padding:6px 8px; border-top:1px solid #e5e7eb; color:#0a0b0d; font-weight:700; vertical-align:middle; }
  .gic-table tbody tr:nth-child(even) td{ background:#f8fafc; }
  .gic-table tr{ break-inside:avoid; page-break-inside:avoid; }
  .gic-table td.gic-lettre{ color:#e11324; font-weight:900; width:26px; }
  .gic-rep{ width:46px; text-align:center; }
  .gic-texte{ font-weight:800; }
  .gic-vide{ color:#9ca3af; font-weight:400; }
  .gic-note{ font-size:7.8pt; font-weight:600; color:#374151; margin-top:2px; }
  .gic-cases{ display:flex; flex-wrap:wrap; gap:6px 22px; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; margin:6px 0; font-size:8.8pt; font-weight:700; color:#0a0b0d; }
  .gic-cases span{ display:inline-flex; align-items:center; gap:6px; }
  .gic-commentaire{ border-left:3px solid #0a0b0d; background:#f8fafc; padding:6px 10px; margin:6px 0 4px; font-size:8.8pt; font-weight:600; color:#0a0b0d; }
  .gic-commentaire strong{ font-weight:900; text-transform:uppercase; font-size:7.5pt; letter-spacing:0.8px; margin-right:4px; }
  .gic-bloc{ font-size:9pt; font-weight:700; color:#0a0b0d; line-height:1.5; white-space:pre-line; border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; }
  .gic-liste{ list-style:none; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden; }
  .gic-liste li{ padding:6px 12px; font-size:9pt; font-weight:700; color:#0a0b0d; border-top:1px solid #f1f5f9; }
  .gic-liste li:first-child{ border-top:none; }
  .gic-liste li:before{ content:"•"; color:#e11324; font-weight:900; margin-right:8px; }
  .gic-infos{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; }
  .gic-infos div{ padding:6px 10px; border-top:1px solid #e5e7eb; font-size:8.8pt; }
  .gic-infos div:nth-child(-n+2){ border-top:none; }
  .gic-infos div:nth-child(odd){ border-right:1px solid #e5e7eb; }
  .gic-infos span{ display:block; font-size:7pt; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#6b7280; }
  .gic-infos b{ font-size:9pt; color:#0a0b0d; }
"""


def _coche(actif: bool) -> str:
    """Case noire cochée / case vide — aucune couleur dans le rapport."""
    if actif:
        return ("<span style='display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;"
                "border-radius:3px;background:#0a0b0d;color:#fff;font-size:10px;font-weight:900;line-height:1;'>&#10003;</span>")
    return "<span style='display:inline-block;width:15px;height:15px;border-radius:3px;border:1.5px solid #9ca3af;'></span>"


def html_rapport_gicleur_complet(rapport) -> str:
    """Rapport technique complet — même structure que le formulaire à
    l'écran (repris de Préventex), présentation sobre en noir : réponses
    cochées dans les colonnes Oui / S.O. / Non, sans code couleur."""
    from .gicleur_checklist import CODES_CASES_A_COCHER
    from .pdf_design import CSS_DOCUMENT, entete, pied_de_page

    bat = rapport.batiment
    client = bat.client
    organisation = client.organisation
    langue = organisation.langue
    t = lambda cle: _tg(langue, cle)

    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    date_insp = _date_fr(rapport.date_inspection)
    tech_noms = ", ".join(t2.get_full_name() or t2.username for t2 in rapport.techniciens.all()) or "—"
    cert = getattr(rapport, "certificat", None)

    def val(valeur):
        return f"<span class='gic-texte'>{escape(valeur)}</span>" if valeur else "<span class='gic-vide'>—</span>"

    def oui_non(valeur):
        return {"oui": t("oui"), "non": t("non"), "na": t("so")}.get(valeur) or "<span class='gic-vide'>—</span>"

    def section(numero, titre):
        return f"<div class='gic-sec'><span class='gic-num'>{numero}</span><span class='gic-titre'>{titre}</span></div>"

    commentaires = {c.section: c.texte for c in rapport.commentaires_sections.all()}

    def commentaire(code):
        texte = commentaires.get(code)
        if not texte:
            return ""
        return f"<div class='gic-commentaire'><strong>{t('commentaire')} :</strong>{escape(texte)}</div>"

    reponses = {r.code_item: r for r in rapport.reponses_checklist.all()}
    par_section = {}
    for r in rapport.reponses_checklist.all():
        par_section.setdefault(r.section, []).append(r)

    entete_questions = (
        f"<thead><tr><th></th><th>{t('question')}</th><th class='c'>{t('oui')}</th>"
        f"<th class='c'>{t('so')}</th><th class='c'>{t('non')}</th></tr></thead>"
    )

    def ligne_question(r, code_section):
        lettre = r.code_item[len(code_section):] or r.code_item
        label = escape(label_item(r.code_item, r.label, langue))
        libelle_extra = (CHAMP_TEXTE_COMPLEMENTAIRE_EN if langue == "en" else CHAMP_TEXTE_COMPLEMENTAIRE).get(r.code_item)
        note = ""
        if libelle_extra and r.valeur_texte:
            note = f"<div class='gic-note'>{libelle_extra} {escape(r.valeur_texte)}</div>"
        if r.code_item == "11d":
            etat = {"marche": t("depart"), "arret": t("arret")}.get(r.valeur_texte, "")
            heures = [reponses.get(c).valeur_texte for c in ("11d1", "11d2") if reponses.get(c) and reponses.get(c).valeur_texte]
            morceaux = [m for m in [etat, f"{t('heure_depart')} {heures[0]}" if len(heures) > 0 else "",
                                    f"{t('heure_arret')} {heures[1]}" if len(heures) > 1 else ""] if m]
            if morceaux:
                note = f"<div class='gic-note'>{t('compresseur')} : {' · '.join(escape(m) for m in morceaux)}</div>"
        if r.type_reponse == "choix":
            cases = "".join(f"<td class='gic-rep'>{_coche(r.reponse == v)}</td>" for v in ("oui", "na", "non"))
            return f"<tr><td class='gic-lettre'>{lettre})</td><td>{label}{note}</td>{cases}</tr>"
        return f"<tr><td class='gic-lettre'>{lettre})</td><td>{label}</td><td colspan='3'>{val(r.valeur_texte)}</td></tr>"

    def table_questions(code, filtre=lambda r: True):
        lignes = [
            r for r in par_section.get(code, [])
            if r.code_item not in CODES_CASES_A_COCHER and r.code_item not in ("11d1", "11d2") and filtre(r)
        ]
        if not lignes:
            return ""
        return f"<table class='gic-table'>{entete_questions}<tbody>{''.join(ligne_question(r, code) for r in lignes)}</tbody></table>"

    def cases_a_cocher(codes, libelles=None):
        morceaux = []
        for code in codes:
            r = reponses.get(code)
            if r is None:
                continue
            libelle = (libelles or {}).get(code) or escape(label_item(r.code_item, r.label, langue))
            morceaux.append(f"<span>{_coche(r.reponse == 'oui')} {libelle}</span>")
        return f"<div class='gic-cases'>{''.join(morceaux)}</div>" if morceaux else ""

    # ── Informations générales ──────────────────────────────────────────
    infos = [
        (t("au_soin_de"), client.contact_nom),
        (t("localisation"), rapport.local_gicleur),
        (t("identification_systeme"), rapport.identification_systeme),
        (t("type_systeme"), _choix(TYPES_SYSTEME_I18N, rapport.type_systeme, langue) if rapport.type_systeme else ""),
        (t("frequence"), _choix(FREQUENCES_I18N, rapport.frequence_inspection, langue) if rapport.frequence_inspection else ""),
        (t("compagnie_installatrice"), rapport.compagnie_installatrice),
        (t("norme"), "NFPA 13"),
    ]
    infos_html = "<div class='gic-infos'>" + "".join(
        f"<div><span>{label}</span><b>{escape(v) if v else '—'}</b></div>" for label, v in infos
    ) + "</div>"

    # ── 1. Identification ───────────────────────────────────────────────
    identification_html = ""
    for ident in rapport.identifications_systemes.all():
        lignes = "".join(
            f"<tr><td class='gic-lettre'>{lettre})</td><td style='width:42%;'>{t(lettre)}</td><td>{val(getattr(ident, champ))}</td></tr>"
            for lettre, champ in CHAMPS_IDENTIFICATION
        )
        identification_html += (
            f"<div class='gic-sous'>{t('systeme_n')} {ident.numero}</div>"
            f"<table class='gic-table'><tbody>{lignes}</tbody></table>"
        )

    # ── 2. Soupapes de commande ─────────────────────────────────────────
    soupapes_html = (
        f"<table class='gic-table'><thead><tr><th>{t('categorie')}</th><th>{t('nombre')}</th><th>{t('type')}</th>"
        f"<th class='c'>{t('ouvertes')}</th><th class='c'>{t('protegees')}</th><th class='c'>{t('identifiees')}</th>"
        f"<th>{t('condition')}</th><th>{t('localisation')}</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td>{escape(_categorie_soupape(s.categorie, langue))}</td><td>{val(s.nombre)}</td><td>{val(s.type_texte)}</td>"
            f"<td class='c'>{oui_non(s.ouvertes)}</td><td class='c'>{oui_non(s.protegees)}</td><td class='c'>{oui_non(s.identifiees)}</td>"
            f"<td>{val(s.condition)}</td><td>{val(s.localisation)}</td></tr>"
            for s in rapport.soupapes_commande.all()
        )
        + "</tbody></table>"
    )

    # ── 3. Alimentation en eau ──────────────────────────────────────────
    essais = list(rapport.essais_ecoulement.all())
    pompe = {"marche": t("depart"), "arret": t("arret")}
    essais_html = (
        f"<div class='gic-sous'>{t('essais_hydrauliques')}</div>"
        f"<table class='gic-table'><thead><tr><th class='c'>#</th><th>{t('pression_systeme')}</th><th>{t('localisation_drain')}</th>"
        f"<th>{t('dimension_tuyau')}</th><th>{t('pression_statique')}</th><th>{t('pression_residuelle')}</th>"
        f"<th>{t('pression_apres')}</th><th>{t('pompe_surpression')}</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td class='c'>{e.ordre}</td><td>{val(e.pression_systeme)}</td><td>{val(e.localisation_drain)}</td>"
            f"<td>{val(e.dimension_tuyau)}</td><td>{val(e.pression_statique)}</td><td>{val(e.pression_residuelle)}</td>"
            f"<td>{val(e.pression_apres)}</td>"
            f"<td>{val(' '.join(x for x in [pompe.get(e.etat_marche_arret, ''), e.heure_marche_arret] if x))}</td></tr>"
            for e in essais
        )
        + "</tbody></table>"
    )

    # ── 10. Installations antigel ───────────────────────────────────────
    installations_html = (
        f"<div class='gic-sous'>{t('installation_speciale_detail')}</div>"
        f"<table class='gic-table'><thead><tr><th class='c'>#</th><th>{t('degre_temperature')}</th><th>{t('localisation')}</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td class='c' style='width:30px;'>{i.ordre}</td><td>{val(i.degre_temperature)}</td><td>{val(i.localisation)}</td></tr>"
            for i in rapport.installations_speciales.all()
        )
        + "</tbody></table>"
    )

    # ── 11. Points bas (point i) ────────────────────────────────────────
    points_bas_html = (
        f"<div class='gic-sous'><span style='color:#e11324;'>i)</span> {t('points_bas')}</div>"
        f"<table class='gic-table'><tbody>"
        + ("".join(
            f"<tr><td class='c' style='width:30px;'>{escape(p.position)}</td><td>{val(p.description)}</td></tr>"
            for p in rapport.points_bas.all()
        ) or f"<tr><td class='gic-vide'>—</td></tr>")
        + "</tbody></table>"
    )

    contenu = {
        "2": soupapes_html + table_questions("2"),
        "3": table_questions("3") + cases_a_cocher(["3b", "3c", "3d"]) + essais_html,
        "8": table_questions("8") + cases_a_cocher(["8c1", "8c2", "8d"], {"8d": escape(t("entree_principale"))}),
        "10": table_questions("10") + installations_html,
        "11": table_questions("11", lambda r: r.code_item <= "11h") + points_bas_html
              + table_questions("11", lambda r: r.code_item > "11h"),
    }

    sections_html = ""
    for code, _titre in SECTIONS:
        corps = contenu.get(code, table_questions(code))
        sections_html += section(code, titre_section(code, langue)) + corps + commentaire(code)

    def liste(qs):
        items = "".join(f"<li>{escape(x.texte)}</li>" for x in qs if x.texte)
        return f"<ul class='gic-liste'>{items}</ul>" if items else f"<div class='gic-bloc gic-vide'>{t('aucune')}</div>"

    def bloc_texte(texte):
        return f"<div class='gic-bloc'>{escape(texte)}</div>" if texte else "<div class='gic-bloc gic-vide'>—</div>"

    entete_html = entete(
        organisation_logo_content(organisation, 46), organisation.nom, t("rapport_gicleur"),
        t("certificat_no"), (cert.numero if cert else "—"),
        t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{t("rapport_gicleur")} — {escape(adresse)}</title>
<style>{CSS_DOCUMENT}</style>
<style>{CSS_RAPPORT_GICLEUR}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:16px 20px;">
{entete_html}
<div class="title-banner">
  <h2>{t("rapport_verification")} — {t("systeme_gicleurs")}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
</div>
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:10.5pt;">{escape(client.nom)}</div>
</div>
<div class="info-card" style="text-align:center;margin-bottom:14px;">
  <div class="card-title">{t("adresse")}</div>
  <div class="card-main" style="font-size:14pt;">{escape(adresse)}</div>
</div>
{section('<i style="font-style:normal;">i</i>', t("informations_systeme"))}
{infos_html}
{section("1", titre_section("1", langue))}
{identification_html}{commentaire("1")}
{sections_html}
{section("12", t("modifications_recentes"))}
{bloc_texte(rapport.recommandations)}
{section("13", t("ajustements"))}
{bloc_texte(rapport.ajustements_effectues)}
{section("14", t("reponses_negatives"))}
{liste(rapport.reponses_negatives.all())}
{section("15", t("ameliorations"))}
{liste(rapport.ameliorations.all())}
{section("16", t("valves_etage"))}
{liste(rapport.valves_etage_supervise.all())}
{html_annexe_photos(rapport, t("photos_anomalies"), t("suite"))}
{pied_de_page(organisation.nom, t("footer_rapport_gicleur"))}
</div>
</body>
</html>"""
