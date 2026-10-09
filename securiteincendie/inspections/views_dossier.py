"""API du dossier du bâtiment : cycles, documents figés, envois, export.

- Superviseur : tout le dossier des bâtiments de son organisation, et les
  actions (ouvrir / fermer / rouvrir un cycle, exporter, envoyer).
- Citoyen : lecture seule, limitée à ses bâtiments — versions courantes des
  documents des rapports fermés et envois qui lui ont été adressés.
- Technicien : pas d'accès (le dossier sert au suivi administratif).
"""

from datetime import date

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from . import dossier as D
from .models import Batiment
from .models_dossier import ArchiveDocument, CycleInspection, Envoi, EnvoiPieceJointe

# ── Accès ────────────────────────────────────────────────────────────────────


def batiments_accessibles(user):
    qs = Batiment.objects.filter(client__organisation=user.organisation)
    if user.est_superviseur():
        return qs
    if user.est_citoyen():
        return qs.filter(
            Q(proprietaire=user)
            | Q(rapports__citoyen=user)
            | Q(rapports_extincteurs__citoyen=user)
            | Q(rapports_gicleurs__citoyen=user)
        ).distinct()
    return qs.none()


def _verifier_superviseur(request):
    if not request.user.est_superviseur():
        raise PermissionDenied("Réservé au superviseur.")


# ── Sérialisation ────────────────────────────────────────────────────────────

def _iso(valeur):
    return valeur.isoformat() if valeur else None


def _nom(u):
    return (u.get_full_name() or u.username) if u else None


def _batiment(bat):
    return {
        "id": bat.id,
        "adresse_complete": bat.adresse_complete,
        "code_postal": bat.code_postal,
        "client_id": bat.client_id,
        "client_nom": bat.client.nom,
        "client_contact_email": bat.client.contact_email,
        "mode_livraison": bat.client.mode_livraison,
    }


def _resume_cycle(cycle):
    rapports = D.rapports_du_cycle(cycle)
    ouverts = sum(1 for _m, r in rapports if r.statut != "ferme")
    return {
        "id": cycle.id,
        "libelle": cycle.libelle,
        "annee": cycle.annee,
        "statut": cycle.statut,
        "date_debut": _iso(cycle.date_debut),
        "date_fin_prevue": _iso(cycle.date_fin_prevue),
        "date_fermeture": _iso(cycle.date_fermeture),
        "ferme_par": _nom(cycle.ferme_par),
        "nb_rapports": len(rapports),
        "nb_rapports_ouverts": ouverts,
        "nb_archives": cycle.archives.count(),
        "nb_envois": cycle.envois.count(),
        "pret_a_cloturer": not cycle.est_ferme and len(rapports) > 0 and ouverts == 0,
    }


def _certificat_info(rapport):
    cert = getattr(rapport, "certificat", None)
    if cert is None:
        return None
    return {
        "numero": getattr(cert, "numero_affiche", None) or cert.numero,
        "envoye": bool(cert.certificat_envoye),
        "date_envoi": _iso(cert.date_envoi),
    }


def _rapport(module, r):
    return {
        "module": module,
        "module_libelle": D.LIBELLES_MODULE[module],
        "id": r.id,
        "statut": r.statut,
        "date_inspection": _iso(r.date_inspection),
        "date_fermeture": _iso(getattr(r, "date_fermeture", None)),
        "chemin": D.CHEMINS_FRONTEND[module],
        "techniciens": [_nom(t) for t in r.techniciens.all()],
        "certificat": _certificat_info(r),
    }


def _archive(a):
    return {
        "id": a.id,
        "module": a.module,
        "module_libelle": a.get_module_display(),
        "rapport_id": a.rapport_id,
        "type_document": a.type_document,
        "type_document_libelle": a.get_type_document_display(),
        "titre": a.titre,
        "numero": a.numero,
        "version": a.version,
        "courante": a.est_courante,
        "date_creation": _iso(a.date_creation),
        "remplacee_le": _iso(a.remplacee_le),
        "cree_par": _nom(a.cree_par),
        "empreinte": a.fichier.empreinte,
        "taille": a.fichier.taille,
    }


def _envoi(e, avec_corps=False):
    donnees = {
        "id": e.id,
        "type_envoi": e.type_envoi,
        "type_libelle": e.get_type_envoi_display(),
        "mode": e.mode,
        "destinataire": e.destinataire,
        "destinataire_nom": e.destinataire_nom,
        "sujet": e.sujet,
        "message": e.message,
        "statut": e.statut,
        "erreur": e.erreur,
        "date_envoi": _iso(e.date_envoi),
        "envoye_par": _nom(e.envoye_par) or "Système",
        "rapports": e.rapports,
        "pieces_jointes": [
            {
                "id": pj.id,
                "nom": pj.fichier.nom,
                "taille": pj.fichier.taille,
                "type_mime": pj.fichier.type_mime,
                "origine": pj.origine,
                "empreinte": pj.fichier.empreinte,
            }
            for pj in e.pieces_jointes.select_related("fichier")
        ],
    }
    return donnees


def _envois_visibles(user, qs):
    if user.est_superviseur():
        return qs
    # Citoyen : uniquement les courriels qui lui ont été adressés.
    return qs.filter(destinataire__icontains=user.email) if user.email else qs.none()


MAX_DESTINATAIRES = 5


def _lire_destinataires(request) -> list[str]:
    """Un ou plusieurs courriels : champ `destinataires` répété, ou
    `destinataire` séparé par des virgules / points-virgules."""
    from django.core.exceptions import ValidationError as ErreurDjango
    from django.core.validators import validate_email

    brut = []
    if hasattr(request.data, "getlist"):
        brut += request.data.getlist("destinataires")
    elif isinstance(request.data.get("destinataires"), list):
        brut += request.data["destinataires"]
    brut.append(str(request.data.get("destinataire") or ""))
    adresses, vues = [], set()
    for morceau in brut:
        for adresse in str(morceau).replace(";", ",").split(","):
            adresse = adresse.strip()
            if not adresse or adresse.lower() in vues:
                continue
            try:
                validate_email(adresse)
            except ErreurDjango:
                raise ValidationError({"error": f"Adresse courriel invalide : « {adresse} »."})
            vues.add(adresse.lower())
            adresses.append(adresse)
    if not adresses:
        raise ValidationError({"error": "Ajoutez au moins un destinataire."})
    if len(adresses) > MAX_DESTINATAIRES:
        raise ValidationError({"error": f"{MAX_DESTINATAIRES} destinataires au maximum."})
    return adresses


def _destinataires_suggeres(bat):
    vus, sortie = set(), []

    def ajout(email, libelle):
        if email and email.lower() not in vus:
            vus.add(email.lower())
            sortie.append({"email": email, "libelle": libelle})

    ajout(bat.client.contact_email, f"Contact client — {bat.client.contact_nom or bat.client.nom}")
    if bat.proprietaire and bat.proprietaire.email:
        ajout(bat.proprietaire.email, f"Propriétaire — {_nom(bat.proprietaire)}")
    for relation in ("rapports", "rapports_extincteurs", "rapports_gicleurs"):
        for r in getattr(bat, relation).exclude(citoyen=None).select_related("citoyen")[:20]:
            ajout(r.citoyen.email, f"Citoyen — {_nom(r.citoyen)}")
    return sortie


# ── Cycles ───────────────────────────────────────────────────────────────────

class CycleViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CycleInspection.objects.filter(
            batiment__in=batiments_accessibles(self.request.user)
        ).select_related("batiment__client", "ferme_par")

    def list(self, request):
        """?batiment=<id> : en-tête du bâtiment + ses cycles (le plus récent en premier)."""
        batiment_id = request.query_params.get("batiment")
        if not batiment_id:
            raise ValidationError({"error": "Paramètre « batiment » requis."})
        bat = batiments_accessibles(request.user).select_related("client", "proprietaire").filter(pk=batiment_id).first()
        if bat is None:
            raise NotFound("Bâtiment introuvable.")
        cycles = self.get_queryset().filter(batiment=bat)
        return Response({
            "batiment": _batiment(bat),
            "peut_modifier": request.user.est_superviseur(),
            "cycles": [_resume_cycle(c) for c in cycles],
        })

    def retrieve(self, request, pk=None):
        cycle = self.get_object()
        user = request.user
        superviseur = user.est_superviseur()
        rapports = D.rapports_du_cycle(cycle)

        archives = cycle.archives.select_related("fichier", "cree_par")
        if not superviseur:
            # Citoyen : versions courantes des rapports fermés seulement.
            fermes = {(m, r.id) for m, r in rapports if r.statut == "ferme"}
            archives = [a for a in archives.filter(remplacee_le__isnull=True) if (a.module, a.rapport_id) in fermes]

        envois = _envois_visibles(user, cycle.envois.select_related("envoye_par"))
        precedent = cycle.batiment.cycles.filter(date_debut__lt=cycle.date_debut).order_by("-date_debut").first()
        suivant = cycle.batiment.cycles.filter(date_debut__gt=cycle.date_debut).order_by("date_debut").first()

        donnees = {
            **_resume_cycle(cycle),
            "batiment": _batiment(cycle.batiment),
            "note_fermeture": cycle.note_fermeture,
            "peut_modifier": superviseur,
            "precedent": {"id": precedent.id, "libelle": precedent.libelle} if precedent else None,
            "suivant": {"id": suivant.id, "libelle": suivant.libelle} if suivant else None,
            "rapports": [_rapport(m, r) for m, r in rapports if superviseur or r.statut == "ferme"],
            "archives": [_archive(a) for a in archives],
            "envois": [_envoi(e) for e in envois],
            "deficiences": D.suivi_deficiences(cycle),
        }
        if superviseur:
            donnees["journal"] = [
                {**j, "date": _iso(j["date"])} for j in D.journal_cycle(cycle)[:400]
            ]
            donnees["destinataires_suggeres"] = _destinataires_suggeres(cycle.batiment)
            donnees["rapports_ouverts"] = D.rapports_ouverts(cycle)
        return Response(donnees)

    @action(detail=False, methods=["post"])
    def ouvrir(self, request):
        """Ouvre un nouveau cycle à la main (bouton « Nouveau cycle »)."""
        _verifier_superviseur(request)
        bat = batiments_accessibles(request.user).filter(pk=request.data.get("batiment")).first()
        if bat is None:
            raise NotFound("Bâtiment introuvable.")
        jour = None
        if request.data.get("date_debut"):
            try:
                jour = date.fromisoformat(str(request.data["date_debut"]))
            except ValueError:
                raise ValidationError({"error": "Date de début invalide (format AAAA-MM-JJ)."})
        cycle = D.ouvrir_cycle(bat, request.user, jour)
        return Response(_resume_cycle(cycle), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        _verifier_superviseur(request)
        cycle = D.fermer_cycle(self.get_object(), request.user, str(request.data.get("note") or "").strip())
        return Response(_resume_cycle(cycle))

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        _verifier_superviseur(request)
        cycle = D.rouvrir_cycle(self.get_object(), request.user, str(request.data.get("motif") or ""))
        return Response(_resume_cycle(cycle))

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        _verifier_superviseur(request)
        contenu, nom = D.exporter_cycle(self.get_object(), request.user)
        reponse = HttpResponse(contenu, content_type="application/zip")
        reponse["Content-Disposition"] = f'attachment; filename="{nom}"'
        return reponse

    @action(detail=True, methods=["post"])
    def envoyer(self, request, pk=None):
        """Envoi libre depuis le dossier : message + documents figés choisis
        (en PDF) + fichiers ajoutés (facture…)."""
        _verifier_superviseur(request)
        cycle = self.get_object()
        destinataires = _lire_destinataires(request)
        destinataire = ", ".join(destinataires)
        message = str(request.data.get("message") or "").strip()[:4000]
        sujet = str(request.data.get("sujet") or "").strip()[:250]
        ids = request.data.getlist("archives") if hasattr(request.data, "getlist") else request.data.get("archives") or []
        archives = list(cycle.archives.filter(pk__in=[int(i) for i in ids if str(i).isdigit()]).select_related("fichier"))
        pieces_jointes = D.lire_pieces_jointes(request)
        if not archives and not pieces_jointes and not message:
            raise ValidationError({"error": "Ajoutez un message, un document ou un fichier à envoyer."})

        from .emailing import _bandeau_organisation, _envoyer_et_conserver
        from .pdf import _html_vers_pdf

        documents = [
            (f"{D._nom_sur(a.titre)}-v{a.version}.pdf", _html_vers_pdf(a.fichier.lire().decode("utf-8")), "application/pdf")
            for a in archives
        ]
        bat = cycle.batiment
        organisation = bat.client.organisation
        sujet = sujet or f"{organisation.nom} — Documents d'inspection ({bat.adresse_complete})"
        from django.utils.html import escape, linebreaks

        liste_docs = "".join(f"<li>{escape(a.titre)} (version {a.version})</li>" for a in archives)
        html_body = (
            f"{_bandeau_organisation(organisation)}"
            f'<h2 style="margin:0 0 10px;font-size:19px;color:#102a43;">{escape(bat.adresse_complete)}</h2>'
            + (f'<div style="color:#334155;font-size:14px;line-height:1.6;">{linebreaks(escape(message))}</div>' if message else "")
            + (f'<p style="margin:16px 0 4px;color:#102a43;font-size:13px;font-weight:700;">Documents joints</p>'
               f'<ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;">{liste_docs}</ul>' if archives else "")
        )
        rapports = []
        modeles = D._modeles()
        for a in archives:
            r = modeles[a.module].objects.filter(pk=a.rapport_id).first()
            if r is not None and r not in rapports:
                rapports.append(r)
        resultat = _envoyer_et_conserver(
            bat, destinataires, sujet, html_body, type_envoi=Envoi.Type.MANUEL, mode=Envoi.Mode.DIRECT,
            rapports=rapports, utilisateur=request.user, documents=documents, pieces_jointes=pieces_jointes,
            cycle=cycle, message=message,
        )
        if not resultat.get("ok"):
            return Response(
                {"error": "Le courriel n'a pas pu être envoyé (la tentative est conservée au dossier).", "detail": resultat.get("erreur")},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Les certificats joints à cet envoi sont désormais remis au client.
        noms_pj = ", ".join(nom for nom, _c, _m in pieces_jointes)
        certificats_envoyes = {(a.module, a.rapport_id) for a in archives if a.type_document != ArchiveDocument.TypeDocument.RAPPORT}
        nb_certificats = 0
        for r in rapports:
            module = D.module_de(r)
            cert = getattr(r, "certificat", None)
            if cert is not None and (module, r.pk) in certificats_envoyes:
                cert.certificat_envoye = True
                cert.mode_envoi = "direct"
                cert.date_envoi = timezone.now()
                cert.envoye_a = destinataire[:255]
                cert.save(update_fields=["certificat_envoye", "mode_envoi", "date_envoi", "envoye_a"])
                nb_certificats += 1
            r.historiser(
                request.user,
                (f"Rapports envoyés au client ({destinataire}) depuis le dossier du bâtiment"
                 + (f" — fichiers joints : {noms_pj}" if noms_pj else ""))[:300],
            )
        return Response({
            "message": f"Envoyé à {destinataire} : {len(documents)} document(s)"
                       + (f" et {len(pieces_jointes)} fichier(s) joint(s)" if pieces_jointes else "") + ".",
            "certificats_marques": nb_certificats,
        })

    @action(detail=False, methods=["get"], url_path="mes-batiments")
    def mes_batiments(self, request):
        """Citoyen (et superviseur) : bâtiments accessibles ayant au moins un cycle."""
        bats = batiments_accessibles(request.user).filter(cycles__isnull=False).distinct().select_related("client")
        sortie = []
        for b in bats:
            cycles = list(b.cycles.order_by("-date_debut"))
            sortie.append({**_batiment(b), "cycles": [{"id": c.id, "libelle": c.libelle, "statut": c.statut} for c in cycles]})
        return Response(sortie)


# ── Fichiers ─────────────────────────────────────────────────────────────────

class ArchiveDocumentView(APIView):
    """Document figé : HTML (par défaut, s'ouvre et s'imprime dans le
    navigateur) ou PDF (?format=pdf)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        archive = ArchiveDocument.objects.filter(
            pk=pk, batiment__in=batiments_accessibles(request.user)
        ).select_related("fichier").first()
        if archive is None:
            raise NotFound()
        if not request.user.est_superviseur():
            modele = D._modeles()[archive.module]
            rapport = modele.objects.filter(pk=archive.rapport_id).first()
            if not archive.est_courante or rapport is None or rapport.statut != "ferme":
                raise NotFound()
        contenu = archive.fichier.lire()
        nom = f"{D._nom_sur(archive.titre)}-v{archive.version}"
        if request.query_params.get("format") == "pdf":
            from .pdf import _html_vers_pdf

            reponse = HttpResponse(_html_vers_pdf(contenu.decode("utf-8")), content_type="application/pdf")
            reponse["Content-Disposition"] = f'attachment; filename="{nom}.pdf"'
            return reponse
        reponse = HttpResponse(contenu, content_type="text/html; charset=utf-8")
        reponse["X-Empreinte-SHA256"] = archive.fichier.empreinte
        return reponse


class PieceJointeView(APIView):
    """Copie exacte d'un fichier envoyé au client."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        pj = EnvoiPieceJointe.objects.filter(
            pk=pk, envoi__batiment__in=batiments_accessibles(request.user)
        ).select_related("fichier", "envoi").first()
        if pj is None or not _envois_visibles(request.user, Envoi.objects.filter(pk=pj.envoi_id)).exists():
            raise NotFound()
        reponse = HttpResponse(pj.fichier.lire(), content_type=pj.fichier.type_mime)
        reponse["Content-Disposition"] = f'attachment; filename="{D._nom_sur(pj.fichier.nom)}"'
        reponse["X-Empreinte-SHA256"] = pj.fichier.empreinte
        return reponse


class CourrielEnvoiView(APIView):
    """Texte exact d'un courriel envoyé (superviseur)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        _verifier_superviseur(request)
        envoi = Envoi.objects.filter(pk=pk, batiment__in=batiments_accessibles(request.user)).first()
        if envoi is None:
            raise NotFound()
        return HttpResponse(envoi.corps_html or "<p>(courriel non conservé)</p>", content_type="text/html; charset=utf-8")

