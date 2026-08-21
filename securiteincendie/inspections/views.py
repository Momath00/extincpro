from collections import Counter

from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from securiteincendie.emailing import logo_data_uri

from accounts.models import Utilisateur
from .models import (
    Batiment,
    Client,
    ExtincteurItem,
    RapportExtincteur,
)
from .serializers import (
    BatimentSerializer,
    ClientSerializer,
    ExtincteurItemSerializer,
    HistoriqueRapportExtincteurSerializer,
    RapportExtincteurCreateSerializer,
    RapportExtincteurDetailSerializer,
    RapportExtincteurListSerializer,
)

# ── Légende du rapport extincteurs portatifs ─────────────────────────────
LEGENDE_EXTINCTEURS = [
    ("HT", "Test hydro, pour boyaux et/ou extincteurs, voir (Notes)"),
    ("T/O", "Les extincteurs ou les boyaux ont dépassé le temps recommandé, voir (Notes)"),
    ("MQ", "Extincteur ou boyaux manquant, doit être ajouté, voir (Notes)"),
    ("RM", "Recommandation, voir (Notes)"),
    ("D", "Déficience, voir (Notes)"),
    ("MT", "Maintenance requise, voir (Notes)"),
]


_MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
            'septembre', 'octobre', 'novembre', 'décembre']


def _date_fr(d):
    if d is None:
        return "—"
    return f"{d.day} {_MOIS_FR[d.month - 1]} {d.year}"


class EstSuperviseur(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.est_superviseur())


class EstSuperviseurOuTechnicien(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and (request.user.est_superviseur() or request.user.est_technicien())
        )


# ── Client ───────────────────────────────────────────────────────────────
class ClientViewSet(viewsets.ModelViewSet):
    """Gestion des entreprises clientes — réservée au superviseur."""

    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseur]
    queryset = Client.objects.all()


# ── Bâtiment ─────────────────────────────────────────────────────────────
class BatimentViewSet(viewsets.ModelViewSet):
    serializer_class = BatimentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Batiment.objects.select_related("client")
        if user.est_citoyen():
            qs = qs.filter(proprietaire=user)
        elif user.est_technicien():
            qs = qs.filter(rapports_extincteurs__techniciens=user).distinct()

        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()


# ── Rapport extincteurs ─────────────────────────────────────────────────
class RapportExtincteurViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return RapportExtincteurListSerializer
        if self.action in ["create", "update", "partial_update"]:
            # Le superviseur peut réassigner les techniciens (ex. absence) —
            # RapportExtincteurDetailSerializer déclare `techniciens` en lecture
            # seule (affichage imbriqué), il faut le serializer d'écriture ici.
            return RapportExtincteurCreateSerializer
        return RapportExtincteurDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = RapportExtincteur.objects.select_related(
            "batiment", "batiment__client", "cree_par", "citoyen"
        ).prefetch_related("techniciens")

        if user.est_citoyen():
            qs = qs.filter(citoyen=user)
        elif user.est_technicien():
            qs = qs.filter(techniciens=user)
        # le superviseur voit tout

        client_id = self.request.query_params.get("client")
        statut = self.request.query_params.get("statut")
        if client_id:
            qs = qs.filter(batiment__client_id=client_id)
        if statut:
            qs = qs.filter(statut=statut)

        return qs.distinct()

    def get_permissions(self):
        if self.action in ["create", "destroy", "update", "partial_update", "reassigner", "rouvrir"]:
            # Contrairement au rapport principal, le technicien n'a jamais besoin
            # d'écrire directement sur l'objet RapportExtincteur (il modifie les
            # lignes via l'action `extincteurs` / ExtincteurItemViewSet) — donc
            # batiment/techniciens/citoyen restent réservés au superviseur.
            return [permissions.IsAuthenticated(), EstSuperviseur()]
        return super().get_permissions()

    @action(detail=True, methods=["patch"])
    def reassigner(self, request, pk=None):
        """Superviseur seulement — change le bâtiment et/ou les techniciens assignés après création."""
        rapport = self.get_object()
        changements = []

        if "batiment" in request.data:
            try:
                nouveau_batiment = Batiment.objects.get(pk=request.data["batiment"])
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

        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut rouvrir un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà ouvert."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.rouvrir(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    def perform_create(self, serializer):
        rapport = serializer.save(cree_par=self.request.user)
        rapport.historiser(self.request.user, "Rapport créé")

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Ce rapport est fermé et ne peut plus être modifié.")
        rapport = serializer.save()
        rapport.historiser(self.request.user, "Rapport modifié")

    @action(detail=True, methods=["post"])
    def fermer(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut fermer un rapport."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut == RapportExtincteur.Statut.FERME:
            return Response({"error": "Ce rapport est déjà fermé."}, status=status.HTTP_400_BAD_REQUEST)

        rapport.fermer(request.user)
        return Response(RapportExtincteurDetailSerializer(rapport).data)

    @action(detail=True, methods=["post"], url_path="envoyer-certificat")
    def envoyer_certificat(self, request, pk=None):
        rapport = self.get_object()
        if not request.user.est_superviseur():
            return Response(
                {"error": "Seul le superviseur peut envoyer le certificat."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response(
                {"error": "Le rapport doit être fermé avant d'envoyer le certificat."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat trouvé pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        rapport.certificat.certificat_envoye = True
        rapport.certificat.save()
        rapport.historiser(request.user, f"Certificat envoyé au citoyen {rapport.citoyen.username if rapport.citoyen else '—'}")

        if rapport.citoyen and rapport.citoyen.email:
            from .emailing import envoyer_email_certificat_extincteur_disponible

            envoyer_email_certificat_extincteur_disponible(rapport)

        return Response({"message": "Certificat envoyé au citoyen."})

    @action(detail=True, methods=["get", "post"])
    def extincteurs(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            return Response(ExtincteurItemSerializer(rapport.extincteurs.all(), many=True).data)

        if rapport.statut == RapportExtincteur.Statut.FERME and not request.user.est_superviseur():
            return Response(
                {"error": "Ce rapport est fermé, impossible d'ajouter un extincteur."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ExtincteurItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordre = serializer.validated_data.get("ordre") or (rapport.extincteurs.count() + 1)
        serializer.save(rapport=rapport, ordre=ordre)
        rapport.historiser(request.user, "Extincteur ajouté")
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def historique(self, request, pk=None):
        rapport = self.get_object()
        return Response(HistoriqueRapportExtincteurSerializer(rapport.historique.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="certificat-pdf")
    def certificat_pdf(self, request, pk=None):
        rapport = self.get_object()
        if rapport.statut != RapportExtincteur.Statut.FERME:
            return Response({"error": "Le rapport doit être fermé."}, status=status.HTTP_400_BAD_REQUEST)
        if not hasattr(rapport, "certificat"):
            return Response({"error": "Aucun certificat pour ce rapport."}, status=status.HTTP_404_NOT_FOUND)

        cert = rapport.certificat
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        if bat.code_postal:
            adresse += f"  {bat.code_postal}"
        date_insp = _date_fr(rapport.date_inspection)
        date_cert = _date_fr(cert.date_emission)
        techniciens = list(rapport.techniciens.all())
        items = list(rapport.extincteurs.all())
        total = len(items)

        type_counts = Counter(it.get_type_extincteur_display() for it in items if it.type_extincteur)
        inv_rows = "".join(
            f"<tr><td>{t}</td><td class='center bold'>{c}</td></tr>"
            for t, c in sorted(type_counts.items())
        ) or "<tr><td colspan='2' class='muted center'>Aucun extincteur enregistré</td></tr>"

        tech_rows = "".join(
            f"<tr><td>{t.get_full_name() or t.username}</td></tr>"
            for t in techniciens
        ) or "<tr><td class='muted'>—</td></tr>"

        logo_content = logo_data_uri(46)
        emetteur = cert.emis_par.get_full_name() or cert.emis_par.username if cert.emis_par else "—"

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Certificat {cert.numero}</title>
<style>
  @page {{ margin: 18mm 15mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#111; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #0f172a; padding-bottom:12px; margin-bottom:18px; }}
  .brand{{ display:flex; align-items:center; gap:12px; }}
  .logo-circle{{ width:52px; height:52px; border-radius:50%; background:#0f172a; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }}
  .brand-text h1{{ font-size:13pt; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:1px; }}
  .brand-text p{{ font-size:8pt; color:#555; margin-top:1px; }}
  .cert-badge{{ text-align:right; }}
  .title-banner{{ background:#0f172a; color:#fff; text-align:center; padding:10px 0; border-radius:4px; margin-bottom:18px; }}
  .title-banner h2{{ font-size:12pt; font-weight:700; letter-spacing:2px; text-transform:uppercase; }}
  .title-banner p{{ font-size:8pt; color:rgba(255,255,255,0.7); margin-top:3px; letter-spacing:1px; }}
  .info-card{{ border:1px solid #e5e7eb; border-radius:6px; padding:10px 14px; }}
  .card-title{{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#dc2626; margin-bottom:6px; }}
  .card-main{{ font-size:11pt; font-weight:700; color:#0f172a; line-height:1.3; }}
  .sec-title{{ font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#0f172a; border-bottom:1.5px solid #0f172a; padding-bottom:4px; margin-bottom:8px; margin-top:16px; }}
  table{{ width:100%; border-collapse:collapse; font-size:9pt; }}
  th{{ background:#fef2f2; color:#0f172a; font-weight:700; padding:6px 10px; text-align:left; font-size:8pt; text-transform:uppercase; }}
  td{{ padding:5px 10px; border-bottom:1px solid #fef2f2; color:#111; }}
  .center{{ text-align:center; }} .bold{{ font-weight:700; }} .muted{{ color:#9ca3af; font-style:italic; }}
  .sig-row{{ display:flex; gap:24px; margin-top:18px; }}
  .sig-block{{ flex:1; border-top:1.5px solid #111; padding-top:6px; }}
  .sig-label{{ font-size:7.5pt; color:#777; text-transform:uppercase; letter-spacing:1px; }}
  .sig-name{{ font-size:10pt; font-weight:700; color:#0f172a; margin-top:2px; }}
  .footer{{ margin-top:24px; padding-top:10px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:7.5pt; color:#9ca3af; }}
  @media print{{ body{{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }} .no-print{{ display:none!important; }} }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0f172a;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">Imprimer / Enregistrer PDF</button>
</div>
<div style="padding:20px 24px;">
<div class="header">
  <div class="brand">
    <div class="logo-circle">{logo_content}</div>
    <div class="brand-text">
      <h1>Extincteurs Nationex</h1>
      <p>Inspection &amp; Certification — Extincteurs portatifs</p>
    </div>
  </div>
  <div class="cert-badge">
    <div style="font-size:11pt; font-weight:700; color:#0f172a;">{date_insp}</div>
    <div style="font-size:7.5pt;color:#777;text-transform:uppercase;letter-spacing:1px;">Date d'inspection</div>
    <div style="font-size:8pt;color:#555;margin-top:3px;">Certificat N° {cert.numero}</div>
  </div>
</div>
<div class="title-banner">
  <h2>Certificat de vérification</h2>
  <p>Extincteurs portatifs</p>
</div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">Adresse inspectée</div>
  <div class="card-main" style="font-size:20pt; font-weight:900;">{adresse}</div>
</div>
<div class="sec-title">Inventaire des extincteurs</div>
<table>
  <thead><tr><th>Type d'extincteur</th><th class="center">Qté</th></tr></thead>
  <tbody>{inv_rows}<tr style="font-weight:700;background:#f8fafc;border-top:1.5px solid #e5e7eb;"><td>Total</td><td class="center bold">{total}</td></tr></tbody>
</table>
<div class="sec-title">Technicien(s)</div>
<table><thead><tr><th>Nom</th></tr></thead><tbody>{tech_rows}</tbody></table>
<div class="sig-row">
  <div class="sig-block">
    <div class="sig-label">Superviseur / Responsable</div>
    <div class="sig-name">{emetteur}</div>
    <div style="font-size:8pt;color:#555;">Extincteurs Nationex</div>
  </div>
  <div class="sig-block">
    <div class="sig-label">Date d'émission</div>
    <div class="sig-name">{date_cert}</div>
    <div style="font-size:8pt;color:#555;">Certificat N° {cert.numero}</div>
  </div>
</div>
<div class="footer">
  <div><strong>Extincteurs Nationex</strong> — info@extincteursnationex.com</div>
  <div>Ce certificat atteste la vérification des extincteurs portatifs à la date d'inspection indiquée.</div>
</div>
</div>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="telecharger")
    def telecharger(self, request, pk=None):
        rapport = self.get_object()
        bat = rapport.batiment
        adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
        date_insp = _date_fr(rapport.date_inspection)
        techniciens = list(rapport.techniciens.all())
        tech_noms = ", ".join(t.get_full_name() or t.username for t in techniciens) or "—"

        legende_rows = "".join(
            f"<tr><td class='bold' style='width:50px;'>{code}</td><td>{desc}</td></tr>"
            for code, desc in LEGENDE_EXTINCTEURS
        )

        items = list(rapport.extincteurs.all())
        item_rows = ""
        for it in items:
            is_defect = it.etat == ExtincteurItem.Etat.DEFECTUEUX
            is_ni = not is_defect and it.etat == "NI"
            bg = ' style="background:#fef2f2;"' if is_defect else ' style="background:#fef3c7;"' if is_ni else ""
            etat_style = ' style="color:#cc0000;"' if is_defect else ' style="color:#b45309;"' if is_ni else ""
            item_rows += (
                f"<tr{bg}>"
                f"<td class='center'>{it.ordre}</td>"
                f"<td>{it.etage or '—'}</td>"
                f"<td class='center bold'{etat_style}>{it.etat or '—'}</td>"
                f"<td>{it.emplacement or '—'}</td>"
                f"<td class='center'>{_date_fr(it.date_fabrication)}</td>"
                f"<td class='center'>{it.get_format_display() if it.format else '—'}</td>"
                f"<td class='center'>{it.get_type_extincteur_display() if it.type_extincteur else '—'}</td>"
                f"<td>{it.get_marque_display() if it.marque else '—'}</td>"
                f"<td class='center'>{_date_fr(it.prochaine_maintenance)}</td>"
                f"<td class='center'>{_date_fr(it.prochain_test_hydrostatique)}</td>"
                f"<td>{it.remarque or ''}</td>"
                f"</tr>"
            )
        if not item_rows:
            item_rows = "<tr><td colspan='11' class='muted center'>Aucun extincteur enregistré</td></tr>"

        cert_html = ""
        if hasattr(rapport, "certificat"):
            c = rapport.certificat
            cert_html = (
                f'<div style="display:flex;align-items:center;gap:8px;background:#fef2f2;border:1.5px solid #dc2626;'
                f'border-radius:6px;padding:8px 14px;margin-top:12px;">'
                f'<span style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#0f172a;">Certificat</span>'
                f'<span style="font-size:11pt;font-weight:900;color:#dc2626;">{c.numero}</span>'
                f'<span style="font-size:8pt;color:#555;">· Émis le {_date_fr(c.date_emission)}</span>'
                f'{"<span style=\"background:#0d6b4f;color:#fff;font-size:7pt;font-weight:700;padding:2px 7px;border-radius:100px;\">Envoyé</span>" if c.certificat_envoye else ""}'
                f'</div>'
            )

        logo_content = logo_data_uri(46)

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport de vérification extincteurs portatifs — {adresse}</title>
<style>
  @page {{ margin: 14mm 12mm; }}
  *{{ box-sizing:border-box; margin:0; padding:0; }}
  body{{ font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#000; background:#fff; }}
  .header{{ display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #0f172a; padding-bottom:10px; margin-bottom:14px; }}
  .brand{{ display:flex; align-items:center; gap:12px; }}
  .logo-circle{{ width:46px; height:46px; border-radius:50%; background:#0f172a; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }}
  .brand-text h1{{ font-size:12pt; font-weight:900; color:#0f172a; text-transform:uppercase; }}
  .brand-text p{{ font-size:7.5pt; color:#444; margin-top:1px; }}
  .info-grid{{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:18px; }}
  .info-card{{ border:1px solid #ccc; border-radius:4px; padding:8px 12px; }}
  .card-title{{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#555; margin-bottom:4px; }}
  .card-main{{ font-size:10pt; font-weight:700; color:#000; }}
  .title-banner{{ background:#0f172a; color:#fff; text-align:center; padding:8px 0; border-radius:4px; margin-bottom:12px; }}
  .title-banner h2{{ font-size:11pt; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }}
  .sec-title{{ font-size:8.5pt; font-weight:700; text-transform:uppercase; color:#000; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:6px; margin-top:14px; }}
  table{{ width:100%; border-collapse:collapse; font-size:8pt; }}
  th{{ background:#fef2f2; color:#000; font-weight:700; padding:4px 6px; text-align:left; font-size:7.5pt; border:1px solid #ccc; }}
  td{{ padding:4px 6px; border:1px solid #ddd; color:#000; }}
  .center{{ text-align:center; }} .bold{{ font-weight:700; }} .muted{{ color:#777; font-style:italic; }}
  .legende-box{{ border:1px solid #999; border-radius:4px; padding:8px 10px; margin-bottom:10px; background:#fafafa; }}
  .legende-box table td{{ border:none; padding:2px 8px; font-size:8pt; }}
  .footer{{ margin-top:20px; padding-top:8px; border-top:1px solid #ccc; display:flex; justify-content:space-between; font-size:7pt; color:#555; }}
  @media print{{ body{{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }} .no-print{{ display:none!important; }} }}
</style>
</head>
<body>
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0f172a;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">Imprimer / Enregistrer PDF</button>
</div>
<div style="padding:16px 20px;">
<div class="header">
  <div class="brand">
    <div class="logo-circle">{logo_content}</div>
    <div class="brand-text">
      <h1>Extincteurs Nationex</h1>
      <p>Rapport de vérification — Extincteurs portatifs</p>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;color:{'#0d6b4f' if rapport.statut == 'ferme' else '#dc2626'};">{rapport.get_statut_display()}</div>
    <div style="font-size:7.5pt;color:#555;margin-top:4px;">Date d'inspection : <strong style="color:#000;">{date_insp}</strong></div>
    <div style="font-size:7.5pt;color:#555;margin-top:1px;">Technicien(s) : <strong style="color:#000;">{tech_noms}</strong></div>
  </div>
</div>
<div class="title-banner"><h2>Rapport de vérification — Extincteurs portatifs</h2></div>
<div class="info-card" style="text-align:center;margin-bottom:18px;">
  <div class="card-title">Adresse</div>
  <div class="card-main" style="font-size:14pt;">{adresse}</div>
</div>
<div class="legende-box">
<table><tbody>{legende_rows}</tbody></table>
</div>
<div class="sec-title">Détail des extincteurs</div>
<table>
  <thead><tr>
    <th>No</th><th>Étage</th><th title="D=Défectueux, C=Conforme, NI=Non inspecté">État</th><th>Emplacement</th><th>Date fabrication</th><th>Format</th>
    <th>Type</th><th>Marque</th><th>Prochaine maintenance</th>
    <th>Prochain test hydro.</th><th>Remarque</th>
  </tr></thead>
  <tbody>{item_rows}</tbody>
</table>
{cert_html}
<div class="footer">
  <div><strong>Extincteurs Nationex</strong> — info@extincteursnationex.com</div>
  <div>{adresse}</div>
</div>
</div>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class ExtincteurItemViewSet(viewsets.ModelViewSet):
    """Accès direct à une ligne d'extincteur — pour la corriger ou la supprimer."""

    serializer_class = ExtincteurItemSerializer
    permission_classes = [permissions.IsAuthenticated, EstSuperviseurOuTechnicien]

    def get_queryset(self):
        user = self.request.user
        qs = ExtincteurItem.objects.select_related("rapport")
        if user.est_technicien():
            qs = qs.filter(rapport__techniciens=user)
        return qs.distinct()

    def perform_update(self, serializer):
        item = self.get_object()
        if item.rapport.statut == RapportExtincteur.Statut.FERME and not self.request.user.est_superviseur():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Le rapport associé est fermé.")
        serializer.save()
