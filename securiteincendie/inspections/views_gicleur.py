"""Module « Rapport gicleur » — rapport de la visite du système de gicleurs.
Module autonome : sa propre page de création, son propre certificat
(CERT-GIC-…), son propre envoi au client.

L'ancien formulaire Préventex (checklist à sections fixes) a été retiré ;
les fiches d'inspection (sous eau, sous air, préaction…) viendront se
rattacher à ce rapport.

Séparé de `views.py` (déjà très long) ; réutilise ses helpers partagés
(permissions, recherche, compteurs, traductions des documents)."""

from types import SimpleNamespace

from django.db.models import F, Max
from .pdf import reponse_document
from django.utils.html import escape
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import Utilisateur
from securiteincendie.emailing import organisation_logo_content

from .dossier import lire_pieces_jointes
from .gicleur_fiches import DEBITS_VALVES, FICHE_IDENTIFICATION, FICHES, est_visible, identification_reprise, libelle_sous_rapport
from .models import Batiment, Client, RapportGicleur, SousRapportGicleur
from .pagination import RapportPagination
from .photos import PhotosRapportMixin, html_annexe_photos
from .serializers import (
    HistoriqueRapportGicleurSerializer,
    RapportGicleurCreateSerializer,
    RapportGicleurDetailSerializer,
    RapportGicleurListSerializer,
    SousRapportGicleurSerializer,
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
    la page « Nouveau rapport gicleur » — voir les fonctions communes
    `_creer_rapport_*_lie` dans views.py."""
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
        ).prefetch_related("techniciens", "sous_rapports").filter(batiment__client__organisation=user.organisation)

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)
        # ?fiche=eau : rapports qui contiennent au moins une fiche de ce type
        # (sous-menus « Système sous eau / sous air » du menu Gicleurs).
        fiche = self.request.query_params.get("fiche")
        if fiche:
            qs = qs.filter(sous_rapports__type_fiche=fiche).distinct()
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
        if self.action in ["create", "destroy", "reassigner", "rouvrir", "envoyer_certificat", "renvoyer_certificat"]:
            return [permissions.IsAuthenticated(), EstSuperviseur(), EstModuleRapportGicleurActif()]
        # Le technicien ferme son rapport une fois l'inspection finie (comme
        # pour la cuisine) ; seul le superviseur peut le rouvrir.
        if self.action in ["update", "partial_update", "fermer"]:
            # Le technicien remplit aussi l'en-tête (fréquence, bon de travail…).
            return [permissions.IsAuthenticated(), EstSuperviseurOuTechnicien(), EstModuleRapportGicleurActif()]
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def compteurs(self, request):
        return Response(_compteurs_statuts(self._queryset_de_base()))

    def perform_create(self, serializer):
        # Fiches choisies à la création : toutes les compagnies ne font pas
        # tous les systèmes à chaque inspection. [{"type_fiche": "eau",
        # "numero_systeme": "1"}, …] — d'autres peuvent s'ajouter ensuite.
        fiches = self.request.data.get("fiches") or []
        if not isinstance(fiches, list) or any(
            not isinstance(f, dict) or f.get("type_fiche") not in FICHES for f in fiches
        ):
            raise ValidationError({"fiches": "Liste de fiches invalide."})
        if len(fiches) > 50:
            raise ValidationError({"fiches": "50 fiches au maximum."})

        rapport = serializer.save(cree_par=self.request.user)
        # Infos du bâtiment (panneau, mots de passe, code de porte…) reprises
        # du rapport précédent de ce bâtiment.
        if not (rapport.identification or {}).get("reponses"):
            rapport.identification = identification_reprise(rapport.batiment, sauf=rapport)
            rapport.save(update_fields=["identification"])
        if self.request.data.get("avec_debits_valves") and rapport.debits_valves is None:
            rapport.debits_valves = {"lignes": [], "deficiences": ""}
            rapport.save(update_fields=["debits_valves"])
        SousRapportGicleur.objects.bulk_create([
            SousRapportGicleur(
                rapport=rapport, type_fiche=f["type_fiche"], ordre=i,
                numero_systeme=str(f.get("numero_systeme") or "")[:50],
            )
            for i, f in enumerate(fiches, start=1)
        ])
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
        if rapport.statut == RapportGicleur.Statut.FERME:
            # Correction de la date d'un rapport déjà fermé (ex. historique
            # importé) : ce n'est pas une visite replanifiée, donc aucun avis
            # au client. L'échéance calculée à la fermeture (date + 1 an) suit.
            if rapport.date_inspection != ancienne_date:
                from datetime import timedelta

                if ancienne_date and rapport.date_inspection and ancienne_prochaine == ancienne_date + timedelta(days=365):
                    rapport.prochaine_inspection = rapport.date_inspection + timedelta(days=365)
                    rapport.save(update_fields=["prochaine_inspection"])
                rapport.historiser(user, f"Date d'inspection corrigée : {ancienne_date or '—'} → {rapport.date_inspection or '—'}")
            else:
                rapport.historiser(user, "Rapport modifié")
            return
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
        pieces_jointes = lire_pieces_jointes(request)
        if rapport.statut != RapportGicleur.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        if rapport.batiment.client.mode_livraison == Client.ModeLivraison.DIRECT:
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

        cert = rapport.certificat
        cert.certificat_envoye = True
        cert.mode_envoi = cert.ModeEnvoi.CITOYEN
        cert.date_envoi = timezone.now()
        cert.envoye_a = rapport.citoyen.username if rapport.citoyen else ""
        cert.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_gicleur_disponible

            envoyer_email_certificat_gicleur_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes)
        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["post"], url_path="renvoyer-certificat")
    def renvoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        if rapport.batiment.client.mode_livraison == Client.ModeLivraison.DIRECT:
            from .emailing import renvoyer_document_direct

            ok, message = renvoyer_document_direct(rapport, "gicleur", request.user, pieces_jointes=pieces_jointes)
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

        envoyer_email_certificat_gicleur_disponible(rapport, utilisateur=request.user, pieces_jointes=pieces_jointes, type_envoi="renvoi")
        return Response({"message": "Certificat renvoyé au citoyen."})

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportGicleurSerializer(rapport.historique.all(), many=True).data)

    # ── Fiches d'inspection (sous-rapports) ──────────────────────────────

    @action(detail=False, methods=["get"])
    def fiches(self, request):
        """Description des fiches (sections, champs, libellés FR/EN) — le
        formulaire écran est construit à partir d'elle."""
        return Response(FICHES)

    @action(detail=False, methods=["get"], url_path="fiche-identification")
    def fiche_identification(self, request):
        """Description des « Infos et identification du bâtiment »."""
        return Response(FICHE_IDENTIFICATION)

    @action(detail=True, methods=["post"], url_path="sous-rapports")
    def sous_rapports(self, request, pk=None):
        rapport = self.get_object()
        user = request.user
        if not (user.est_superviseur() or user.est_technicien()):
            return Response({"error": "Vous ne pouvez pas modifier ce rapport."}, status=status.HTTP_403_FORBIDDEN)
        if rapport.statut == RapportGicleur.Statut.FERME and not user.est_superviseur():
            return Response({"error": "Ce rapport est fermé."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SousRapportGicleurSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = (rapport.sous_rapports.aggregate(m=Max("ordre"))["m"] or 0) + 1
        sous_rapport = serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(user, f"Fiche ajoutée : {libelle_sous_rapport(sous_rapport)}"[:300])
        return Response(SousRapportGicleurSerializer(sous_rapport).data, status=status.HTTP_201_CREATED)

    # ── Documents ────────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportGicleur.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)
        return reponse_document(request, html_certificat_gicleur(rapport), f"certificat-gicleurs-{rapport.id}")

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        # ?sous_rapport=<id> : le rapport d'un seul système (sous-rapport
        # indépendant). Pas ?fiche= : c'est le filtre par type de la liste.
        fiche = None
        if request.query_params.get("sous_rapport"):
            fiche = rapport.sous_rapports.filter(pk=request.query_params["sous_rapport"]).first()
            if fiche is None:
                return Response({"error": "Fiche introuvable pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)
        return reponse_document(request, html_rapport_gicleur_complet(rapport, fiche=fiche), f"rapport-gicleurs-{rapport.id}")


class SousRapportGicleurViewSet(viewsets.ModelViewSet):
    """Lecture / modification / suppression d'une fiche. La création passe
    par `POST rapports-gicleurs/<id>/sous-rapports/`."""

    http_method_names = ["get", "patch", "delete", "head", "options"]
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien, EstModuleRapportGicleurActif]
    serializer_class = SousRapportGicleurSerializer

    def get_queryset(self):
        user = self.request.user
        qs = SousRapportGicleur.objects.select_related("rapport").filter(
            rapport__batiment__client__organisation=user.organisation
        )
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def _verifier_ouvert(self, instance):
        if instance.rapport.statut == RapportGicleur.Statut.FERME and not self.request.user.est_superviseur():
            raise ValidationError("Le rapport associé est fermé.")

    def perform_update(self, serializer):
        self._verifier_ouvert(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._verifier_ouvert(instance)
        rapport = instance.rapport
        libelle = libelle_sous_rapport(instance)
        instance.delete()
        rapport.historiser(self.request.user, f"Fiche supprimée : {libelle}"[:300])


# ── Documents imprimables (certificat + rapport complet) ─────────────────

I18N_GICLEUR = {
    "systeme_gicleurs": {"fr": "Système de gicleurs", "en": "Sprinkler system"},
    "rapport_gicleur": {"fr": "Rapport d'inspection — système de gicleurs", "en": "Inspection report — sprinkler system"},
    "norme": {"fr": "Norme", "en": "Standard"},
    "au_soin_de": {"fr": "Au soin de", "en": "Attention"},
    "frequence": {"fr": "Fréquence des inspections", "en": "Inspection frequency"},
    "bon_de_travail": {"fr": "Bon de travail", "en": "Work order"},
    "photos_anomalies": {"fr": "Photos des anomalies", "en": "Deficiency photos"},
    "suite": {"fr": "suite", "en": "continued"},
    "inspection_gicleurs": {
        "fr": "Le système de gicleurs a été inspecté conformément à la norme NFPA 25.",
        "en": "The sprinkler system was inspected in accordance with NFPA 25.",
    },
    "footer_certificat_gicleur": {"fr": "Certificat de conformité — système de gicleurs", "en": "Certificate of compliance — sprinkler system"},
    "footer_rapport_gicleur": {"fr": "Rapport d'inspection — système de gicleurs", "en": "Inspection report — sprinkler system"},
    "prochaine_inspection": {"fr": "Prochaine inspection", "en": "Next inspection"},
    "oui": {"fr": "Oui", "en": "Yes"},
    "non": {"fr": "Non", "en": "No"},
    "so": {"fr": "S.O.", "en": "N/A"},
    "question": {"fr": "Question", "en": "Question"},
    "deficiences": {"fr": "Sommaire des déficiences", "en": "Deficiency summary"},
    "aucune_deficience": {"fr": "Aucune déficience — tous les points inspectés sont conformes.", "en": "No deficiencies — all inspected items are compliant."},
    "remarque_deficiences": {
        "fr": "Le rapport comprend des recommandations et signale des déficiences :",
        "en": "This report includes recommendations and reports deficiencies:",
    },
    "fiche": {"fr": "Fiche", "en": "Sheet"},
    "contact": {"fr": "Contact", "en": "Contact"},
    "infos_contact": {"fr": "Infos contact", "en": "Contact details"},
    "soumis_a": {"fr": "Rapport soumis à", "en": "Report submitted to"},
    "soumis_adresse": {"fr": "Adresse (rapport soumis à)", "en": "Address (submitted to)"},
    "type_inspection": {"fr": "Type d'inspection", "en": "Inspection type"},
    "inspecteur": {"fr": "Inspecteur", "en": "Inspector"},
    "fiches_inspectees": {"fr": "Systèmes inspectés", "en": "Inspected systems"},
    "rapport_inspection": {"fr": "Rapport d'inspection", "en": "Inspection report"},
    "numero_systeme": {"fr": "N° de système", "en": "System no."},
    "rapport_inspection_sous_titre": {"fr": "Système d'extincteurs automatiques — rapport d'inspection", "en": "Automatic sprinkler system — inspection report"},
    "section": {"fr": "Section", "en": "Section"},
    "deficiences_section": {"fr": "Déficiences", "en": "Deficiencies"},
    "deficience": {"fr": "Déficience", "en": "Deficiency"},
    "aucune_fiche": {"fr": "Aucune fiche d'inspection n'a été ajoutée à ce rapport.", "en": "No inspection sheet has been added to this report."},
    "min": {"fr": "min", "en": "min"},
    "sec": {"fr": "s", "en": "s"},
}

FREQUENCES_I18N = {
    "annuelle": {"fr": "Annuelle", "en": "Annual"},
    "semestrielle": {"fr": "Semestrielle", "en": "Semi-annual"},
    "trimestrielle": {"fr": "Trimestrielle", "en": "Quarterly"},
    "mensuelle": {"fr": "Mensuelle", "en": "Monthly"},
    "bimensuelle": {"fr": "Bi-mensuelle", "en": "Bi-monthly"},
}


def _tg(langue, cle):
    if cle in I18N_GICLEUR:
        return I18N_GICLEUR[cle].get(langue, I18N_GICLEUR[cle]["fr"])
    return _t_commun(langue, cle)


def _choix(dico, code, langue):
    if not code:
        return "—"
    entree = dico.get(code)
    return entree.get(langue, entree["fr"]) if entree else code


def html_certificat_gicleur(rapport) -> str:
    from .certificats import avec_qr, code_integrite_simple, url_verification_jeton
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
        f"{icone_badge(ICONE_GICLEUR)}<span>{t('systeme_gicleurs')}</span></span></td>"
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
{avec_qr(f'''<div class="sig-row">
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
</div>''', rapport.batiment.client.organisation, url_verification_jeton(cert.jeton), code_integrite_simple(cert))}
{pied_de_page(organisation_nom, t("footer_certificat_gicleur"))}
</div>
</body>
</html>"""


CSS_RAPPORT_GICLEUR = """
  .gic-infos{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; }
  .gic-infos div{ padding:6px 10px; border-top:1px solid #e5e7eb; font-size:8.8pt; }
  .gic-infos div:nth-child(-n+2){ border-top:none; }
  .gic-infos div:nth-child(odd){ border-right:1px solid #e5e7eb; }
  .gic-infos span{ display:block; font-size:7pt; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#6b7280; }
  .gic-infos b{ font-size:9pt; color:#0a0b0d; }
  .gic-saut{ break-before:page; page-break-before:always; padding-top:4px; }
  .gic-ident{ display:grid; grid-template-columns:1fr 2fr 0.8fr; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; margin:10px 0 10px; }
  .gic-ident div{ padding:6px 10px; font-size:8.8pt; }
  .gic-ident div + div{ border-left:1px solid #e5e7eb; }
  .gic-ident span{ display:block; font-size:6.8pt; font-weight:800; text-transform:uppercase; letter-spacing:0.7px; color:#6b7280; }
  .gic-ident b{ font-size:9.5pt; color:#0a0b0d; }
  .gic-sec{ display:flex; align-items:center; gap:8px; margin:14px 0 6px; padding-bottom:5px; border-bottom:2px solid #0a0b0d; break-after:avoid; page-break-after:avoid; }
  .gic-num{ display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:22px; padding:0 6px; border-radius:100px; background:#0a0b0d; color:#fff; font-size:8.5pt; font-weight:900; }
  .gic-titre{ font-size:9.5pt; font-weight:900; text-transform:uppercase; letter-spacing:0.8px; color:#0a0b0d; }
  .gic-table{ width:100%; border-collapse:collapse; border:1px solid #d1d5db; font-size:8.6pt; }
  .gic-table th{ background:#0a0b0d; color:#fff; font-size:7.2pt; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; padding:5px 8px; text-align:left; }
  .gic-table th.c, .gic-table td.c{ text-align:center; }
  .gic-table td{ padding:5px 8px; border-top:1px solid #e5e7eb; color:#0a0b0d; font-weight:700; vertical-align:middle; }
  .gic-table tbody tr:nth-child(even) td{ background:#f8fafc; }
  .gic-table tr{ break-inside:avoid; page-break-inside:avoid; }
  .gic-rep{ width:40px; text-align:center; }
  .gic-note{ font-size:7.8pt; font-weight:600; color:#374151; margin-top:2px; }
  .gic-note-section{ font-size:8.4pt; font-weight:700; font-style:italic; color:#0a0b0d; margin:4px 0 8px; }
  .gic-tab2{ width:100%; border-collapse:collapse; border:1.5px solid #0a0b0d; table-layout:fixed; font-size:8.6pt; margin-bottom:6px; }
  .gic-tab2 td{ border:1px solid #9ca3af; padding:5px 8px; vertical-align:middle; color:#0a0b0d; }
  .gic-tab2 tr{ break-inside:avoid; page-break-inside:avoid; }
  .gic-tab2 .gic-lib{ font-weight:800; margin-right:8px; }
  .gic-tab2 .gic-val{ font-weight:700; }
  .gic-def{ font-size:8.8pt; font-weight:700; color:#0a0b0d; line-height:1.45; white-space:pre-line; margin-top:6px; padding:7px 12px; border:1px solid #d1d5db; border-left:4px solid #e11324; border-radius:6px; break-inside:avoid; page-break-inside:avoid; }
  .gic-def span{ display:block; font-size:7pt; font-weight:900; text-transform:uppercase; letter-spacing:0.8px; color:#e11324; margin-bottom:2px; }
  .gic-vide{ color:#9ca3af; font-weight:400; }
  .gic-grille{ display:grid; grid-template-columns:1fr 1fr; border:1px solid #d1d5db; margin-bottom:6px; }
  .gic-grille div{ padding:5px 10px; border-top:1px solid #e5e7eb; font-size:8.6pt; }
  .gic-grille div:nth-child(-n+2){ border-top:none; }
  .gic-grille div:nth-child(odd){ border-right:1px solid #e5e7eb; }
  .gic-grille div.plein{ grid-column:1 / -1; border-right:none; }
  .gic-grille span{ display:block; font-size:6.8pt; font-weight:800; text-transform:uppercase; letter-spacing:0.7px; color:#6b7280; }
  .gic-grille b{ font-size:8.8pt; color:#0a0b0d; }
  .gic-bloc{ font-size:8.8pt; font-weight:700; color:#0a0b0d; line-height:1.5; white-space:pre-line; border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; }
  .gic-remarque{ display:flex; align-items:center; gap:10px; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; margin:12px 0; font-size:8.8pt; font-weight:800; color:#0a0b0d; }
  .gic-remarque span{ display:inline-flex; align-items:center; gap:5px; }
"""


def _coche(actif: bool) -> str:
    """Case noire cochée / case vide — aucune couleur dans le rapport."""
    if actif:
        return ("<span style='display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;"
                "border-radius:3px;background:#0a0b0d;color:#fff;font-size:9px;font-weight:900;line-height:1;'>&#10003;</span>")
    return "<span style='display:inline-block;width:14px;height:14px;border-radius:3px;border:1.5px solid #9ca3af;'></span>"


def _html_fiche(sous_rapport, langue, t, sections=None) -> str:
    """Une fiche (sous eau, sous air…) : chaque section avec ses questions
    (cases Oui / S.O. / Non) et ses valeurs, dans l'ordre de l'Excel."""
    reponses = sous_rapport.reponses or {}
    remarques = sous_rapport.remarques or {}
    lib = lambda d: d["en" if langue == "en" else "fr"]

    def vide():
        return "<span class='gic-vide'>—</span>"

    def valeur_texte(champ, valeur):
        if valeur in (None, "", [], {}):
            return vide()
        genre = champ["type"]
        if genre == "oui_non":
            return t(valeur)
        if genre == "choix":
            choisies = valeur if isinstance(valeur, list) else [valeur]
            return "&nbsp;&nbsp;".join(
                f"<span style='display:inline-flex;align-items:center;gap:4px;'>{_coche(o['v'] in choisies)} {escape(lib(o))}</span>"
                for o in champ["options"]
            )
        if genre == "duree":
            morceaux = [f"{escape(str(valeur[k]))} {t(k)}" for k in ("min", "sec") if valeur.get(k) not in (None, "")]
            return " ".join(morceaux) or vide()
        unite = f" {escape(champ['unite'])}" if champ.get("unite") else ""
        return f"{escape(str(valeur))}{unite}"

    def cases_oui_non(champ, rep):
        options = ["oui", "na", "non"] if champ["type"] == "question" and champ.get("na") else ["oui", "non"]
        return "&nbsp;&nbsp;".join(
            f"<span style='display:inline-flex;align-items:center;gap:4px;'>{_coche(rep == o)} {t('so' if o == 'na' else o)}</span>"
            for o in options
        )

    def tableau_excel(champs):
        """Section « tableau » : deux colonnes comme dans l'Excel, chaque
        case = intitulé + réponse sur la même ligne."""
        lignes, ligne = [], []
        for c in champs:
            if c["type"] in ("question", "oui_non"):
                valeur = cases_oui_non(c, reponses.get(c["code"], ""))
            else:
                valeur = valeur_texte(c, reponses.get(c["code"]))
            case = f"<span class='gic-lib'>{escape(lib(c))}</span><span class='gic-val'>{valeur}</span>"
            if c.get("plein") or (c["type"] == "choix" and c.get("multiple")):
                if ligne:
                    lignes.append(ligne)
                    ligne = []
                lignes.append([case, None])
                continue
            ligne.append(case)
            if len(ligne) == 2:
                lignes.append(ligne)
                ligne = []
        if ligne:
            lignes.append(ligne + [""])
        rangees = "".join(
            f"<tr><td colspan='2'>{l[0]}</td></tr>" if l[1] is None else f"<tr><td>{l[0]}</td><td>{l[1]}</td></tr>"
            for l in lignes
        )
        return f"<table class='gic-tab2'><tbody>{rangees}</tbody></table>"

    html = ""
    numero = 0
    for section in (sections or FICHES[sous_rapport.type_fiche]["sections"]):
        champs = [c for c in section["champs"] if est_visible(c, reponses)]
        if section["code"] in ("notes", "dar_observation", "id_notes") and not reponses.get(section["champs"][0]["code"]):
            continue
        numero += 1
        corps = ""

        if section.get("disposition") == "tableau":
            corps += tableau_excel(champs)

        questions = [c for c in champs if c["type"] == "question"]
        if questions and section.get("disposition") != "tableau":
            lignes = ""
            for q in questions:
                rep = reponses.get(q["code"], "")
                note = ""
                if q.get("complement"):
                    comp = q["complement"]
                    valeur = reponses.get(comp["code"])
                    if valeur:
                        note = f"<div class='gic-note'>{escape(lib(comp))} {escape(str(valeur))} {escape(comp.get('unite', ''))}</div>"
                so = f"<td class='gic-rep'>{_coche(rep == 'na')}</td>" if q.get("na") else "<td class='gic-rep gic-vide'>—</td>"
                lignes += (
                    f"<tr><td>{escape(lib(q))}{note}</td>"
                    f"<td class='gic-rep'>{_coche(rep == 'oui')}</td>{so}<td class='gic-rep'>{_coche(rep == 'non')}</td></tr>"
                )
            corps += (
                f"<table class='gic-table'><thead><tr><th>{t('question')}</th><th class='c'>{t('oui')}</th>"
                f"<th class='c'>{t('so')}</th><th class='c'>{t('non')}</th></tr></thead><tbody>{lignes}</tbody></table>"
            )

        valeurs = [c for c in champs if c["type"] in ("texte", "oui_non", "choix", "duree")]
        if valeurs and section.get("disposition") != "tableau":
            cases = "".join(
                f"<div class='{'plein' if c.get('plein') or c['type'] == 'choix' else ''}'><span>{escape(lib(c))}</span>"
                f"<b>{valeur_texte(c, reponses.get(c['code']))}</b></div>"
                for c in valeurs
            )
            corps = f"<div class='gic-grille'>{cases}</div>" + corps

        for c in champs:
            if c["type"] == "liste":
                items = [x for x in reponses.get(c["code"], []) if x]
                lignes = "".join(f"<tr><td class='c' style='width:32px;'>{i}</td><td>{escape(x)}</td></tr>" for i, x in enumerate(items, start=1))
                corps += (
                    f"<table class='gic-table'><thead><tr><th class='c'>#</th><th>{escape(lib(c))}</th></tr></thead>"
                    f"<tbody>{lignes or f'<tr><td colspan=2 class=gic-vide>—</td></tr>'}</tbody></table>"
                )
            elif c["type"] == "texte_long":
                corps += f"<div class='gic-bloc'>{escape(reponses.get(c['code'], ''))}</div>"

        note = section.get(f"note_{langue}") or section.get("note_fr")
        if note:
            corps += f"<div class='gic-note-section'>{escape(note)}</div>"
        deficiences = (remarques.get(section["code"]) or "").strip()
        if deficiences:
            corps += f"<div class='gic-def'><span>{t('deficiences_section')}</span>{escape(deficiences)}</div>"
        html += f"<div class='gic-sec'><span class='gic-num'>{numero}</span><span class='gic-titre'>{escape(lib(section))}</span></div>{corps}"

    return html


def _titre_pdf(sous_rapport, langue) -> str:
    """Nom de la fiche dans le PDF (ex. « Gicleur à eau »), comme le nom de
    l'onglet de l'Excel — le n° de système est dans le bloc d'identification."""
    fiche = FICHES[sous_rapport.type_fiche]
    return fiche.get(f"titre_pdf_{langue}") or fiche.get("titre_pdf_fr") or fiche["en" if langue == "en" else "fr"]


def _html_deficiences_fiche(sous_rapport, langue, t) -> str:
    """« Le rapport comprend … des déficiences : Oui / Non » (comme sur chaque
    onglet de l'Excel), puis la liste des déficiences de CETTE fiche."""
    lib = lambda d: d["section_en" if langue == "en" else "section_fr"]
    deficiences = sous_rapport.deficiences()
    oui_non = f"<span>{_coche(bool(deficiences))} {t('oui')}</span><span>{_coche(not deficiences)} {t('non')}</span>"
    entete = f"<div class='gic-remarque'>{t('remarque_deficiences')} {oui_non}</div>"
    if not deficiences:
        return entete
    lignes = "".join(
        f"<tr><td style='width:32%;'>{escape(lib(d))}</td><td style='white-space:pre-line;'>{escape(d['remarque'])}</td></tr>"
        for d in deficiences
    )
    return entete + (
        f"<table class='gic-table'><thead><tr><th>{t('section')}</th><th>{t('deficience')}</th></tr></thead>"
        f"<tbody>{lignes}</tbody></table>"
    )


def _html_rapport_fiche(rapport, sous_rapport, langue, t, contexte, saut_de_page=True) -> str:
    """Une fiche présentée comme un rapport INDÉPENDANT (un onglet de
    l'Excel) : son en-tête, son titre, son résultat, ses sections, ses
    déficiences et ses photos — sur ses propres pages."""
    from .pdf_design import entete

    titre = f"{t('rapport_inspection')} — {_titre_pdf(sous_rapport, langue)}"
    entete_html = entete(
        contexte["logo"], contexte["organisation"], escape(titre),
        t("certificat_no"), contexte["certificat"], t("date_inspection"), contexte["date"], t("technicien_s"), contexte["techniciens"],
    )
    photos = rapport.photos.filter(sous_rapport_gicleur=sous_rapport)
    return f"""<div class="gic-rapport-fiche{' gic-saut' if saut_de_page else ''}">
{entete_html}
<div class="title-banner">
  <h2>{escape(titre)}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
  <p>{t("rapport_inspection_sous_titre")}</p>
</div>
<div class="gic-ident">
  <div><span>{t("client")}</span><b>{escape(contexte["client"])}</b></div>
  <div><span>{t("adresse")}</span><b>{escape(contexte["adresse"])}</b></div>
  <div><span>{t("numero_systeme")}</span><b>{escape(sous_rapport.numero_systeme) or "—"}</b></div>
</div>
{_html_deficiences_fiche(sous_rapport, langue, t)}
{_html_fiche(sous_rapport, langue, t)}
{html_annexe_photos(rapport, f"{t('photos_anomalies')} — {escape(_titre_pdf(sous_rapport, langue))}", t("suite"), photos=photos)}
</div>"""


def _html_debits_valves(rapport, langue, t, contexte) -> str:
    """Section « Débits et valves » sur ses propres pages : le tableau de
    l'Excel (Zone, Endroit protégé, … Signal O/N, Temps), ses déficiences
    et ses photos."""
    from .pdf_design import entete

    lib = lambda d: d["en" if langue == "en" else "fr"]
    titre = lib(DEBITS_VALVES)
    colonnes = DEBITS_VALVES["colonnes"]
    section = rapport.debits_valves or {}
    lignes = [l for l in section.get("lignes", []) if any(l.get(c["code"]) for c in colonnes)]

    def cellule(ligne, colonne):
        valeur = ligne.get(colonne["code"], "")
        if colonne.get("type") == "oui_non":
            return f"<td class='c'>{_coche(valeur == 'oui')}</td><td class='c'>{_coche(valeur == 'non')}</td>"
        return f"<td>{escape(valeur) if valeur else '<span class=gic-vide>—</span>'}</td>"

    entetes = "".join(
        f"<th class='c' colspan='2'>{escape(lib(c))}<br>{t('oui')[0]} / {t('non')[0]}</th>" if c.get("type") == "oui_non"
        else f"<th>{escape(lib(c))}</th>"
        for c in colonnes
    )
    corps = "".join("<tr>" + "".join(cellule(l, c) for c in colonnes) + "</tr>" for l in lignes)
    nb_colonnes = len(colonnes) + 1
    tableau = (
        f"<table class='gic-table'><thead><tr>{entetes}</tr></thead>"
        f"<tbody>{corps or f'<tr><td colspan={nb_colonnes} class=gic-vide>—</td></tr>'}</tbody></table>"
    )
    deficiences = (section.get("deficiences") or "").strip()
    oui_non = f"<span>{_coche(bool(deficiences))} {t('oui')}</span><span>{_coche(not deficiences)} {t('non')}</span>"
    bloc_def = f"<div class='gic-def'><span>{t('deficiences_section')}</span>{escape(deficiences)}</div>" if deficiences else ""
    photos = rapport.photos.filter(sous_rapport_gicleur__isnull=True, section_fiche=DEBITS_VALVES["code"])
    entete_html = entete(
        contexte["logo"], contexte["organisation"], escape(titre), t("certificat_no"), contexte["certificat"],
        t("date_inspection"), contexte["date"], t("technicien_s"), contexte["techniciens"],
    )
    return f"""<div class="gic-rapport-fiche gic-saut">
{entete_html}
<div class="title-banner">
  <h2>{escape(titre)}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
</div>
<div class="gic-ident">
  <div><span>{t("client")}</span><b>{escape(contexte["client"])}</b></div>
  <div><span>{t("adresse")}</span><b>{escape(contexte["adresse"])}</b></div>
  <div><span>&nbsp;</span><b>&nbsp;</b></div>
</div>
<div class='gic-remarque'>{t('remarque_deficiences')} {oui_non}</div>
{tableau}
{bloc_def}
{html_annexe_photos(rapport, f"{t('photos_anomalies')} — {escape(titre)}", t("suite"), photos=photos)}
</div>"""


def html_rapport_gicleur_complet(rapport, fiche=None) -> str:
    """Rapport gicleur : une page de garde (visite + liste des systèmes),
    puis chaque fiche comme un rapport indépendant sur ses propres pages,
    puis les photos rattachées au rapport seulement. `fiche` : uniquement
    ce sous-rapport (PDF d'un seul système)."""
    from .pdf_design import CSS_DOCUMENT, entete, pied_de_page

    bat = rapport.batiment
    client = bat.client
    organisation = client.organisation
    langue = organisation.langue
    t = lambda cle: _tg(langue, cle)

    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    cert = getattr(rapport, "certificat", None)
    contexte = {
        "logo": organisation_logo_content(organisation, 46), "organisation": organisation.nom,
        "certificat": cert.numero if cert else "—", "date": _date_fr(rapport.date_inspection),
        "techniciens": ", ".join(t2.get_full_name() or t2.username for t2 in rapport.techniciens.all()) or "—",
        "client": client.nom, "adresse": adresse,
    }

    if fiche is not None:
        corps = _html_rapport_fiche(rapport, fiche, langue, t, contexte, saut_de_page=False)
        titre_document = f"{t('rapport_inspection')} — {_titre_pdf(fiche, langue)} — {adresse}"
    else:
        sous_rapports = list(rapport.sous_rapports.all())
        ident = rapport.identification or {}
        ident_rep = ident.get("reponses") or {}
        contact_infos = " · ".join(x for x in (client.contact_telephone if hasattr(client, "contact_telephone") else "", client.contact_email) if x)
        infos = [
            (t("contact"), client.contact_nom),
            (t("infos_contact"), contact_infos),
            (t("soumis_a"), " — ".join(x for x in (ident_rep.get("id_soumis_contact"), ident_rep.get("id_soumis_infos")) if x)),
            (t("soumis_adresse"), ident_rep.get("id_soumis_adresse", "")),
            (t("type_inspection"), _choix(FREQUENCES_I18N, rapport.frequence_inspection, langue) if rapport.frequence_inspection else ""),
            (t("inspecteur"), contexte["techniciens"]),
            (t("bon_de_travail"), rapport.numero_job),
            (t("norme"), "NFPA 25"),
        ]
        infos_html = "<div class='gic-infos'>" + "".join(
            f"<div><span>{label}</span><b>{escape(v) if v else '—'}</b></div>" for label, v in infos
        ) + "</div>"

        lignes = "".join(
            f"<tr><td class='c' style='width:32px;'>{i}</td><td>{escape(_titre_pdf(sr, langue))}</td>"
            f"<td class='c'>{escape(sr.numero_systeme) or '—'}</td>"
            f"<td class='c'>{len(sr.deficiences()) or '—'}</td></tr>"
            for i, sr in enumerate(sous_rapports, start=1)
        )
        if rapport.debits_valves is not None:
            nb_dv = len(rapport.deficiences()) - sum(len(sr.deficiences()) for sr in sous_rapports)
            lignes += (
                f"<tr><td class='c'>{len(sous_rapports) + 1}</td><td>{escape(DEBITS_VALVES['en' if langue == 'en' else 'fr'])}</td>"
                f"<td class='c'>—</td><td class='c'>{nb_dv or '—'}</td></tr>"
            )
        sommaire = (
            f"<table class='gic-table'><thead><tr><th class='c'>#</th><th>{t('fiche')}</th><th class='c'>{t('numero_systeme')}</th>"
            f"<th class='c'>{t('deficiences_section')}</th></tr></thead><tbody>{lignes}</tbody></table>"
            if lignes else f"<div class='gic-bloc gic-vide'>{t('aucune_fiche')}</div>"
        )
        hors_fiche = rapport.photos.filter(sous_rapport_gicleur__isnull=True).exclude(section_fiche="debits_valves")
        photos_hors_fiche = html_annexe_photos(rapport, t("photos_anomalies"), t("suite"), photos=hors_fiche)
        entete_html = entete(
            contexte["logo"], organisation.nom, t("rapport_gicleur"), t("certificat_no"), contexte["certificat"],
            t("date_inspection"), contexte["date"], t("technicien_s"), contexte["techniciens"],
        )
        fiches_html = "".join(_html_rapport_fiche(rapport, sr, langue, t, contexte) for sr in sous_rapports)
        if rapport.debits_valves is not None:
            fiches_html += _html_debits_valves(rapport, langue, t, contexte)

        corps = f"""{entete_html}
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
{infos_html}
{_html_fiche(SimpleNamespace(reponses=ident_rep, remarques=ident.get('remarques') or {}), langue, t, sections=FICHE_IDENTIFICATION['sections'][1:])}
<div class='gic-sec'><span class='gic-num'>#</span><span class='gic-titre'>{t("fiches_inspectees")}</span></div>
{sommaire}
{fiches_html}
{photos_hors_fiche}"""
        titre_document = f"{t('rapport_gicleur')} — {adresse}"

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{escape(titre_document)}</title>
<style>{CSS_DOCUMENT}</style>
<style>{CSS_RAPPORT_GICLEUR}</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:16px 20px;">
{corps}
{pied_de_page(organisation.nom, t("footer_rapport_gicleur"))}
</div>
</body>
</html>"""
