"""API des certificats extincteurs / éclairage d'urgence / cuisine — réglages
de l'organisation, panneau « Certificat » des pages de rapport (lignes,
ajustements, émission, révisions) et vérification publique par QR code.
La logique métier est dans certificats.py."""

import re

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .dossier import lire_pieces_jointes
from . import certificats as C
from .models import (
    CertificatExtincteur,
    ParametresCertificat,
    RapportCuisine,
    RapportEclairageUrgence,
    RapportExtincteur,
)
from .views import EstSuperviseur, EstSuperviseurOuTechnicien

MODELES_RAPPORT = {
    "extincteurs": RapportExtincteur,
    "cuisine": RapportCuisine,
    "eclairage": RapportEclairageUrgence,
}


# ── Paramètres de l'organisation ─────────────────────────────────────────────

class ParametresCertificatSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametresCertificat
        exclude = ["id", "organisation"]
        read_only_fields = ["date_modification"]

    def validate_prefixe_numero(self, valeur):
        valeur = (valeur or "").strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{0,15}", valeur):
            raise serializers.ValidationError("Lettres majuscules, chiffres et tirets seulement (16 caractères max).")
        return valeur

    def validate_signature(self, valeur):
        if valeur and not re.match(r"^data:image/(png|jpeg|webp);base64,", valeur):
            raise serializers.ValidationError("Format d'image non pris en charge (PNG, JPEG ou WebP).")
        if len(valeur) > 500_000:
            raise serializers.ValidationError("Image trop lourde (max. ~350 Ko).")
        return valeur


class ParametresCertificatView(APIView):
    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]

    def get(self, request):
        parametres = ParametresCertificat.pour(request.user.organisation)
        return Response(ParametresCertificatSerializer(parametres).data)

    def patch(self, request):
        parametres = ParametresCertificat.pour(request.user.organisation)
        serializer = ParametresCertificatSerializer(parametres, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── Panneau « Certificat » ───────────────────────────────────────────────────

def _nom(utilisateur):
    if utilisateur is None:
        return ""
    return utilisateur.get_full_name() or utilisateur.username


def detail_certificat(cert, utilisateur):
    C.figer_si_absent(cert)
    parametres = C.parametres_pour(cert.batiment.client.organisation)
    lignes = C.calculer_lignes(cert)
    ancre = cert.rapport_ancre
    ancre_fermee = ancre.statut == "ferme"
    client = cert.batiment.client
    revisions = list(cert.revisions.select_related("emis_par"))
    return {
        "id": cert.id,
        "numero": cert.numero,
        "numero_affiche": cert.numero_affiche,
        "revision": cert.revision,
        "statut": cert.statut,
        "type_document": cert.type_document,
        "conforme": C.conformite(lignes),
        "type_document_prevu": C.type_document(lignes, parametres),
        "lignes": lignes,
        # Brouillon avec une émission précédente : le document remis n'est
        # plus à jour, une nouvelle révision sera créée si le contenu a changé.
        "a_changements": bool(revisions) and C.empreinte(cert, lignes) != cert.empreinte,
        "ancre_fermee": ancre_fermee,
        "peut_emettre": ancre_fermee and cert.statut != "emis" and utilisateur.est_superviseur(),
        "peut_ajuster": parametres.ajustement_manuel and utilisateur.est_superviseur(),
        "mode_emission": parametres.mode_emission,
        "regroupement": cert.regroupement,
        "systeme_ancre": cert.systeme_ancre,
        "ancre_id": ancre.id,
        "date_emission": cert.date_emission,
        "emis_par": _nom(cert.emis_par),
        "certificat_envoye": cert.certificat_envoye,
        "mode_envoi": cert.mode_envoi,
        "date_envoi": cert.date_envoi,
        "envoye_a": cert.envoye_a,
        "client_mode_livraison": client.mode_livraison,
        "client_contact_email": client.contact_email,
        "url_verification": C.url_verification(cert) if revisions else None,
        "revisions": [
            {
                "revision": r.revision,
                "numero_affiche": r.numero_affiche,
                "type_document": r.type_document,
                "conforme": r.conforme,
                "date_emission": r.date_emission,
                "emis_par": _nom(r.emis_par),
                "remplacee_le": r.remplacee_le,
            }
            for r in revisions
        ],
    }


class CertificatVisiteViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = CertificatExtincteur.objects.select_related(
            "rapport", "rapport_cuisine", "rapport_eclairage", "batiment", "batiment__client", "emis_par"
        ).filter(batiment__client__organisation=user.organisation)
        if user.est_technicien():
            qs = qs.filter(
                Q(rapport__techniciens=user)
                | Q(rapport_cuisine__techniciens=user)
                | Q(rapport_eclairage__techniciens=user)
            ).distinct()
        return qs

    def _superviseur_requis(self, request):
        if not request.user.est_superviseur():
            return Response({"error": "Réservé au superviseur."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def retrieve(self, request, pk=None):
        return Response(detail_certificat(self.get_object(), request.user))

    @action(detail=False, methods=["get"], url_path="pour-rapport")
    def pour_rapport(self, request):
        """Certificat couvrant un rapport (?type=extincteurs|cuisine|eclairage&id=…)."""
        modele = MODELES_RAPPORT.get(request.query_params.get("type"))
        if modele is None:
            return Response({"error": "Type de rapport inconnu."}, status=status.HTTP_400_BAD_REQUEST)
        rapport = modele.objects.filter(
            id=request.query_params.get("id"), batiment__client__organisation=request.user.organisation
        ).first()
        if rapport is None:
            return Response({"error": "Rapport introuvable."}, status=status.HTTP_404_NOT_FOUND)

        cert = C.certificat_couvrant(rapport)
        rapport_extincteur_id = getattr(rapport, "rapport_extincteur_id", None)
        if cert is None:
            parametres = C.parametres_pour(request.user.organisation)
            return Response({
                "certificat": None,
                "rapport_ferme": rapport.statut == "ferme",
                # Lié à un rapport extincteur en regroupement par visite : son
                # certificat viendra à la fermeture de ce dernier.
                "attend_rapport_extincteur": bool(rapport_extincteur_id)
                and parametres.regroupement == ParametresCertificat.Regroupement.VISITE,
                "rapport_extincteur_id": rapport_extincteur_id,
            })
        couvert_ailleurs = cert.rapport_ancre != rapport
        return Response({
            "certificat": detail_certificat(cert, request.user),
            "couvert_par_extincteur": couvert_ailleurs,
            "rapport_extincteur_id": cert.rapport_id if couvert_ailleurs else None,
        })

    @action(detail=True, methods=["post"])
    def ajuster(self, request, pk=None):
        refus = self._superviseur_requis(request)
        if refus:
            return refus
        cert = self.get_object()
        parametres = C.parametres_pour(request.user.organisation)
        if not parametres.ajustement_manuel:
            return Response({"error": "L'ajustement manuel est désactivé dans les paramètres."}, status=status.HTTP_400_BAD_REQUEST)

        systeme = request.data.get("systeme")
        statut = request.data.get("statut") or None
        raison = (request.data.get("raison") or "").strip()
        if systeme not in {l["systeme"] for l in C.calculer_lignes(cert)}:
            return Response({"error": "Ligne inconnue sur ce certificat."}, status=status.HTTP_400_BAD_REQUEST)
        if statut is not None and statut not in C.STATUTS:
            return Response({"error": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)
        if statut is not None and len(raison) < 3:
            return Response({"error": "Indiquez la raison de l'ajustement."}, status=status.HTTP_400_BAD_REQUEST)

        C.ajuster_ligne(cert, systeme, statut, raison[:300], request.user)
        return Response(detail_certificat(cert, request.user))

    @action(detail=True, methods=["post"])
    def emettre(self, request, pk=None):
        refus = self._superviseur_requis(request)
        if refus:
            return refus
        cert = self.get_object()
        if cert.rapport_ancre.statut != "ferme":
            return Response({"error": "Le rapport doit être fermé avant d'émettre le certificat."}, status=status.HTTP_400_BAD_REQUEST)
        _, nouvelle = C.emettre(cert, request.user)
        donnees = detail_certificat(cert, request.user)
        donnees["nouvelle_revision"] = nouvelle
        return Response(donnees)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        cert = self.get_object()
        apercu = request.query_params.get("apercu") == "1"
        return HttpResponse(C.html_certificat(cert, apercu=apercu), content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="revision-pdf")
    def revision_pdf(self, request, pk=None):
        cert = self.get_object()
        revision = cert.revisions.filter(revision=request.query_params.get("revision")).first()
        if revision is None:
            return Response({"error": "Révision introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(revision.html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["post"])
    def renvoyer(self, request, pk=None):
        refus = self._superviseur_requis(request)
        if refus:
            return refus
        cert = self.get_object()
        pieces_jointes = lire_pieces_jointes(request)
        if cert.statut != "emis":
            return Response({"error": "Le certificat doit d'abord être émis."}, status=status.HTTP_400_BAD_REQUEST)
        from .emailing import renvoyer_document_direct

        ok, message = renvoyer_document_direct(cert, "visite", request.user, pieces_jointes=pieces_jointes)
        if not ok:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": message})


# ── Vérification publique (QR code) ──────────────────────────────────────────

class VerificationThrottle(AnonRateThrottle):
    """Limite les essais en rafale sur la page publique (énumération)."""

    scope = "verification_certificat"
    rate = "30/min"


class VerificationCertificatView(APIView):
    """Page publique ouverte par le QR code du certificat : dit si le
    document présenté est authentique, toujours en vigueur ou remplacé.
    N'expose que ce qui est déjà imprimé sur le certificat."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [VerificationThrottle]

    def get(self, request, jeton):
        cert = CertificatExtincteur.objects.select_related("batiment", "batiment__client__organisation").filter(jeton=jeton).first()
        if cert is None:
            return self._certificat_simple(jeton)
        demandee = request.query_params.get("r")
        revisions = cert.revisions.all()
        revision = revisions.filter(revision=demandee).first() if demandee and demandee.isdigit() else revisions.filter(revision=cert.revision).first()
        if revision is None:
            return Response({"error": "Certificat introuvable."}, status=status.HTTP_404_NOT_FOUND)

        bat = cert.batiment
        organisation = bat.client.organisation
        derniere = revisions.first()
        return Response({
            "etat": C.etat_verification(cert, revision),
            "numero": revision.numero_affiche,
            "numero_actuel": derniere.numero_affiche if derniere else revision.numero_affiche,
            "code_integrite": C.code_integrite(cert.jeton, revision.numero_affiche, revision.empreinte),
            "type_document": revision.type_document,
            "conforme": revision.conforme,
            "date_emission": revision.date_emission,
            "organisation": organisation.nom,
            "langue": organisation.langue,
            "adresse": f"{bat.numero_civique} {bat.rue}, {bat.ville}",
            "lignes": [
                {"label": l["label"], "statut": l["statut"], "echeance": l.get("echeance")}
                for l in revision.lignes
            ],
        })

    LIBELLES_SIMPLES = {
        "incendie": {"fr": "Réseau d'alarme incendie", "en": "Fire alarm system"},
        "gicleur": {"fr": "Système de gicleurs", "en": "Sprinkler system"},
    }

    def _certificat_simple(self, jeton):
        """Certificats incendie et gicleurs : un seul système, pas de
        révisions — en vigueur tant que le rapport est fermé et l'échéance
        pas dépassée."""
        from datetime import date

        from .models import Certificat, CertificatGicleur

        for type_cert, modele in (("incendie", Certificat), ("gicleur", CertificatGicleur)):
            cert = modele.objects.select_related("rapport", "rapport__batiment__client__organisation").filter(jeton=jeton).first()
            if cert is not None:
                break
        else:
            return Response({"error": "Certificat introuvable."}, status=status.HTTP_404_NOT_FOUND)

        rapport = cert.rapport
        bat = rapport.batiment
        organisation = bat.client.organisation
        echeance = rapport.prochaine_inspection
        if rapport.statut != "ferme":
            etat = "en_revision"
        elif echeance and echeance < date.today():
            etat = "expire"
        else:
            etat = "valide"
        conforme = cert.conforme
        libelle = self.LIBELLES_SIMPLES[type_cert]
        return Response({
            "etat": etat,
            "numero": cert.numero,
            "numero_actuel": cert.numero,
            "code_integrite": C.code_integrite_simple(cert),
            "type_document": "certificat",
            "conforme": conforme,
            "date_emission": cert.date_emission,
            "organisation": organisation.nom,
            "langue": organisation.langue,
            "adresse": f"{bat.numero_civique} {bat.rue}, {bat.ville}",
            "lignes": [{
                "label": libelle.get(organisation.langue, libelle["fr"]),
                "statut": "conforme" if conforme else "non_conforme",
                "echeance": echeance.isoformat() if echeance else None,
            }],
        })
