"""Génération de vrais PDF (octets, pour pièce jointe courriel) à partir des
certificats — utilisé par le mode de livraison « direct » (petits clients
sans espace client dédié).

Le rendu HTML utilisé ici est volontairement différent de celui de la vue
« certificat-pdf » (qui s'appuie sur flexbox/grid, très bien supportés par
un navigateur pour l'impression). xhtml2pdf (moteur reportlab) ne supporte
ni flexbox ni grid — ce gabarit utilise donc des tableaux, ce qui rend de
façon fiable un document sobre et professionnel."""

from collections import Counter
from io import BytesIO

from xhtml2pdf import pisa

from securiteincendie.emailing import organisation_logo_content

_BASE_CSS = """
  @page { size: letter; margin: 1.5cm 1.6cm 1.3cm 1.6cm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #111111; }
  table { width: 100%; border-collapse: collapse; }
  .header-table td { vertical-align: middle; }
  .brand-name { font-size: 15pt; font-weight: bold; color: #0a0b0d; }
  .brand-sub { font-size: 8pt; color: #555555; }
  .cert-num { font-size: 14pt; font-weight: bold; color: #ff6b1a; text-align: right; }
  .cert-label { font-size: 7.5pt; color: #777777; text-align: right; }
  .header-rule { border-bottom: 3px solid #0a0b0d; padding-bottom: 6px; margin-bottom: 3px; }
  .banner { background-color: #0a0b0d; color: #ffffff; text-align: center; padding: 8px 0; margin: 10px 0 12px 0; }
  .banner-title { font-size: 12pt; font-weight: bold; color: #ffffff; }
  .banner-sub { font-size: 7.5pt; color: #cccccc; }
  .badge-conforme { background-color: #e9f6f2; color: #0d6b4f; border: 1.5px solid #0d6b4f;
                     font-size: 12pt; font-weight: bold; padding: 6px 0; text-align: center; }
  .badge-nonconforme { background-color: #fef2f2; color: #e11324; border: 1.5px solid #e11324;
                        font-size: 12pt; font-weight: bold; padding: 6px 0; text-align: center; }
  .addr-box { border: 1px solid #dddddd; padding: 8px 14px; text-align: center; margin: 10px 0; }
  .addr-title { font-size: 7pt; font-weight: bold; color: #ff6b1a; letter-spacing: 1px; }
  .addr-main { font-size: 14pt; font-weight: bold; color: #0a0b0d; }
  .sec-title { font-size: 8.5pt; font-weight: bold; color: #0a0b0d; border-bottom: 1.5px solid #0a0b0d;
               padding-bottom: 3px; margin: 10px 0 5px 0; }
  .data-table th { background-color: #f1f5f9; color: #0a0b0d; font-weight: bold; padding: 4px 8px;
                    text-align: left; font-size: 8pt; border-bottom: 1px solid #dddddd; }
  .data-table td { padding: 3px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
  .data-table .center { text-align: center; }
  .data-table .total-row td { font-weight: bold; background-color: #f8fafc; border-top: 1.5px solid #dddddd; }
  .conf-box { border: 1px solid #0a0b0d; padding: 8px 14px; }
  .conf-ok { color: #0d6b4f; font-weight: bold; }
  .conf-bad { color: #e11324; font-weight: bold; }
  .sig-table td { padding-top: 5px; border-top: 1.5px solid #111111; font-size: 9pt; width: 50%; }
  .sig-label { font-size: 7.5pt; color: #777777; }
  .sig-name { font-size: 10pt; font-weight: bold; color: #0a0b0d; }
  .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 7.5pt; color: #9ca3af; }
  .sec-sub { font-size: 8.5pt; font-weight: bold; color: #0a0b0d; border-bottom: 1px solid #999999;
             padding-bottom: 2px; margin: 10px 0 4px 0; }
  .wide-table th { background-color: #f1f5f9; color: #0a0b0d; font-weight: bold; padding: 3px 6px;
                    text-align: left; font-size: 7pt; border: 1px solid #dddddd; }
  .wide-table td { padding: 3px 6px; font-size: 7.5pt; border: 1px solid #eeeeee; }
  .legende-box { border: 1px solid #999999; padding: 8px 10px; margin-bottom: 8px; background-color: #fafafa; }
  .legende-box table td { border: none; padding: 2px 6px; font-size: 8pt; }
"""


def _html_to_pdf_bytes(html: str) -> bytes:
    buffer = BytesIO()
    pisa.CreatePDF(html, dest=buffer, encoding="utf-8")
    return buffer.getvalue()


def _date_fr(d) -> str:
    if not d:
        return "—"
    mois = ["", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    return f"{d.day} {mois[d.month]} {d.year}"


def _header_html(organisation, sous_titre: str, numero: str, date_label: str, date_valeur: str) -> str:
    logo = organisation_logo_content(organisation, 40)
    return f"""
<table class="header-table header-rule">
  <tr>
    <td style="width:60%;">
      <table><tr>
        <td style="width:44px;padding:0;">{logo}</td>
        <td><div class="brand-name">{organisation.nom}</div><div class="brand-sub">{sous_titre}</div></td>
      </tr></table>
    </td>
    <td style="width:40%;">
      <div class="cert-num">N° {numero}</div>
      <div class="cert-label">{date_label} : {date_valeur}</div>
    </td>
  </tr>
</table>
"""


def generer_pdf_certificat(rapport) -> bytes:
    """PDF du certificat d'inspection annuelle (réseau d'alarme incendie)."""
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f" {bat.code_postal}"

    techniciens = list(rapport.techniciens.all())
    dispositifs = list(rapport.dispositifs.all())
    type_counts = Counter(d.get_type_dispositif_display() or "—" for d in dispositifs)
    total = sum(type_counts.values())

    inv_rows = "".join(
        f"<tr><td>{t}</td><td class='center'>{c}</td></tr>" for t, c in sorted(type_counts.items())
    ) or "<tr><td colspan='2' class='center' style='color:#9ca3af;'>Aucun dispositif enregistré</td></tr>"

    tech_rows = "".join(
        f"<tr><td>{t.get_full_name() or t.username}</td></tr>" for t in techniciens
    ) or "<tr><td style='color:#9ca3af;'>—</td></tr>"

    e1 = rapport.fiche_e1 if hasattr(rapport, "fiche_e1") else None
    conf_rows = []
    if e1:
        checks = [
            (e1.inspection_essai_conforme, "Inspection et mise à l'essai conforme à la norme CAN/ULC-S536"),
            (e1.reseau_fonctionnel, "Réseau surveillé complètement fonctionnel"),
            (not e1.lacunes_constatees if e1.lacunes_constatees is not None else None, "Aucune lacune constatée sur le réseau"),
            (e1.documentation_sur_place, "Documentation du réseau présente sur place"),
        ]
        for ok, label in checks:
            classe = "conf-ok" if ok else "conf-bad"
            icone = "OK" if ok else "X"
            conf_rows.append(f"<tr><td style='width:24px;padding:2px 4px 2px 0;' class='{classe}'>{icone}</td><td style='padding:2px 0;'>{label}</td></tr>")
        if e1.commentaires:
            conf_rows.append(f"<tr><td></td><td style='font-size:8pt;color:#555555;font-style:italic;'>Commentaires : {e1.commentaires}</td></tr>")
    conf_html = f"<table>{''.join(conf_rows)}</table>" if conf_rows else "<p style='color:#9ca3af;font-style:italic;'>Données E1 non disponibles.</p>"

    conforme = cert.conforme
    badge_classe = "badge-conforme" if conforme else "badge-nonconforme"
    badge_texte = "CONFORME" if conforme else "NON CONFORME — RÉPARATIONS REQUISES"
    emetteur = (cert.emis_par.get_full_name() or cert.emis_par.username) if cert.emis_par else "—"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{_BASE_CSS}</style></head>
<body>
{_header_html(bat.client.organisation, "Inspection &amp; certification — Norme CAN/ULC-S536", cert.numero, "Date d'inspection", _date_fr(rapport.date_inspection))}
<div class="banner">
  <div class="banner-title">CERTIFICAT D'INSPECTION ANNUELLE</div>
  <div class="banner-sub">Réseau d'alarme incendie — CAN/ULC-S536</div>
</div>
<div class="{badge_classe}">{badge_texte}</div>
<div class="addr-box">
  <div class="addr-title">ADRESSE INSPECTÉE</div>
  <div class="addr-main">{adresse}</div>
</div>
<div class="sec-title">Inventaire des dispositifs</div>
<table class="data-table">
  <tr><th>Type de dispositif</th><th class="center">Qté</th></tr>
  {inv_rows}
  <tr class="total-row"><td>Total</td><td class="center">{total}</td></tr>
</table>
<div class="sec-title">Conformité — mise à l'essai</div>
<div class="conf-box">{conf_html}</div>
<div class="sec-title">Technicien(s)</div>
<table class="data-table"><tr><th>Nom</th></tr>{tech_rows}</table>
<table class="sig-table" style="margin-top:12px;">
  <tr>
    <td>
      <div class="sig-label">SUPERVISEUR / RESPONSABLE</div>
      <div class="sig-name">{emetteur}</div>
    </td>
    <td>
      <div class="sig-label">DATE D'ÉMISSION</div>
      <div class="sig-name">{_date_fr(cert.date_emission)}</div>
    </td>
  </tr>
</table>
<div class="footer">{bat.client.organisation.nom} — Ce certificat atteste la conformité à la date d'inspection indiquée.</div>
</body></html>"""

    return _html_to_pdf_bytes(html)


def generer_pdf_certificat_extincteur(rapport) -> bytes:
    """PDF du certificat de vérification des extincteurs portatifs."""
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f" {bat.code_postal}"

    techniciens = list(rapport.techniciens.all())
    items = list(rapport.extincteurs.all())
    total = len(items)
    type_counts = Counter(it.get_type_extincteur_display() for it in items if it.type_extincteur)

    inv_rows = "".join(
        f"<tr><td>{t}</td><td class='center'>{c}</td></tr>" for t, c in sorted(type_counts.items())
    ) or "<tr><td colspan='2' class='center' style='color:#9ca3af;'>Aucun extincteur enregistré</td></tr>"

    tech_rows = "".join(
        f"<tr><td>{t.get_full_name() or t.username}</td></tr>" for t in techniciens
    ) or "<tr><td style='color:#9ca3af;'>—</td></tr>"

    emetteur = (cert.emis_par.get_full_name() or cert.emis_par.username) if cert.emis_par else "—"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{_BASE_CSS}</style></head>
<body>
{_header_html(bat.client.organisation, "Inspection &amp; certification — Extincteurs portatifs", cert.numero, "Date d'inspection", _date_fr(rapport.date_inspection))}
<div class="banner">
  <div class="banner-title">CERTIFICAT DE VÉRIFICATION</div>
  <div class="banner-sub">Extincteurs portatifs</div>
</div>
<div class="addr-box">
  <div class="addr-title">ADRESSE INSPECTÉE</div>
  <div class="addr-main">{adresse}</div>
</div>
<div class="sec-title">Inventaire des extincteurs</div>
<table class="data-table">
  <tr><th>Type d'extincteur</th><th class="center">Qté</th></tr>
  {inv_rows}
  <tr class="total-row"><td>Total</td><td class="center">{total}</td></tr>
</table>
<div class="sec-title">Technicien(s)</div>
<table class="data-table"><tr><th>Nom</th></tr>{tech_rows}</table>
<table class="sig-table" style="margin-top:12px;">
  <tr>
    <td>
      <div class="sig-label">SUPERVISEUR / RESPONSABLE</div>
      <div class="sig-name">{emetteur}</div>
    </td>
    <td>
      <div class="sig-label">DATE D'ÉMISSION</div>
      <div class="sig-name">{_date_fr(cert.date_emission)}</div>
    </td>
  </tr>
</table>
<div class="footer">{bat.client.organisation.nom} — Ce certificat atteste la vérification des extincteurs à la date d'inspection indiquée.</div>
</body></html>"""

    return _html_to_pdf_bytes(html)


def generer_pdf_rapport_complet(rapport) -> bytes:
    """PDF du rapport technique complet (E1 + E2 + légende + E3) — le document
    détaillé, distinct du certificat sommaire d'une page. Envoyé en plus du
    certificat aux clients en mode direct, pour qu'ils reçoivent exactement
    ce qu'un citoyen verrait sur son espace (rapport + certificat)."""
    from .views import E2_ITEMS, E2_TITRES, LEGENDE_DISPOSITIFS, _val_oui_non, _val_so

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f" {bat.code_postal}"
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t.get_full_name() or t.username for t in techniciens) or "—"
    cert = rapport.certificat if hasattr(rapport, "certificat") else None

    e1 = rapport.fiche_e1 if hasattr(rapport, "fiche_e1") else None
    e2 = rapport.fiche_e2 if hasattr(rapport, "fiche_e2") else None
    legende = rapport.fiche_legende.dispositifs if hasattr(rapport, "fiche_legende") else {}

    e1_html = ""
    if e1:
        champs_e1 = [
            ("A", "Fonctionnement en une étape", e1.fonctionnement_une_etape),
            ("B", "Fonctionnement en deux étapes", e1.fonctionnement_deux_etapes),
            ("C", "Inspection et mise à l'essai (CAN/ULC-S536)", e1.inspection_essai_conforme),
            ("D", "Documentation du réseau sur place", e1.documentation_sur_place),
            ("E", "Réseau fonctionnel", e1.reseau_fonctionnel),
            ("F", "Lacunes constatées", e1.lacunes_constatees),
            ("H", "Copie remise au responsable", e1.copie_remise_responsable),
        ]
        rows = "".join(
            f"<tr><td class='bold' style='width:24px;'>{l}</td><td>{label}</td>"
            f"<td class='center' style='width:56px;'>{_val_oui_non(v)}</td></tr>"
            for l, label, v in champs_e1
        )
        e1_html = (
            '<div class="sec-title">E1 — Rapport annuel de mise à l\'essai</div>'
            f"<table class='wide-table'><tr><th style='width:24px;'></th><th>Champ</th>"
            f"<th class='center' style='width:56px;'>Valeur</th></tr>{rows}</table>"
        )
        if e1.commentaires:
            e1_html += f"<p style='margin-top:6px;font-size:9pt;'><strong>Commentaires :</strong> {e1.commentaires}</p>"

    e2_parts = []
    for key, titre in E2_TITRES.items():
        sec_data = (e2.details or {}).get(key, {}) if (e2 and e2.details) else {}
        items_defs = E2_ITEMS.get(key, [])
        loc = sec_data.get("localisation", "")
        loc_str = f" ({loc})" if loc else ""
        if key in ("e2_11", "e2_12"):
            val = sec_data.get("remarques", "")
            content = f"<p style='font-size:9pt;padding:2px 0;'>{val or '—'}</p>"
        else:
            rows = "".join(
                f"<tr><td class='bold' style='width:30px;'>{iid}</td><td>{lbl}</td>"
                f"<td class='center' style='width:56px;'>{_val_so(sec_data.get(iid))}</td></tr>"
                for iid, lbl in items_defs
            )
            content = (
                f"<table class='wide-table'><tr><th style='width:30px;'></th><th>Élément vérifié</th>"
                f"<th class='center' style='width:56px;'>Résultat</th></tr>{rows}</table>"
            )
        e2_parts.append(f"<div class='sec-sub'>{titre}{loc_str}</div>{content}")
    e2_html = ('<div class="sec-title">E2 — Essai du poste de contrôle</div>' + "".join(e2_parts)) if e2_parts else ""

    legende_rows = "".join(
        f"<tr><td class='bold' style='width:40px;'>{code}</td><td>{desc}</td>"
        f"<td>{(legende.get(code) or {}).get('type') or '—'}</td>"
        f"<td>{(legende.get(code) or {}).get('modele') or '—'}</td></tr>"
        for code, desc in LEGENDE_DISPOSITIFS
    )
    legende_html = (
        '<div class="sec-title">Légende des dispositifs</div>'
        "<table class='wide-table'><tr><th style='width:40px;'>Code</th><th>Description</th>"
        f"<th>Type</th><th>N° de modèle</th></tr>{legende_rows}</table>"
    )

    sections_html = ""
    for section in rapport.sections.prefetch_related("dispositifs").all():
        devs = list(section.dispositifs.all())
        if not devs:
            continue
        rows = "".join(
            f"<tr><td>{d.localisation}</td><td class='center bold'>{d.type_dispositif or '—'}</td>"
            f"<td class='center'>{'1' if d.installation_correcte is True else 'S.O.' if d.installation_correcte is None else '0'}</td>"
            f"<td class='center'>{'1' if d.necessite_entretien is True else 'S.O.' if d.necessite_entretien is None else '0'}</td>"
            f"<td class='center'>{'1' if d.alarme_confirmee is True else 'S.O.' if d.alarme_confirmee is None else '0'}</td>"
            f"<td class='center'>{d.annonce_statut or '—'}</td><td class='center'>{d.zone_circuit or '—'}</td>"
            f"<td>{d.remarque or ''}</td></tr>"
            for d in devs
        )
        sections_html += (
            f"<div class='sec-sub'>{section.nom}</div>"
            "<table class='wide-table'><tr><th>Localisation</th><th class='center'>Type</th>"
            "<th class='center'>A</th><th class='center'>B</th><th class='center'>C</th>"
            f"<th class='center'>D</th><th class='center'>E</th><th>Remarque</th></tr>{rows}</table>"
        )
    if not sections_html:
        sections_html = "<p style='color:#9ca3af;font-style:italic;font-size:9pt;'>Aucun dispositif enregistré.</p>"

    cert_html = ""
    if cert:
        badge_classe = "badge-conforme" if cert.conforme else "badge-nonconforme"
        badge_texte = "CONFORME" if cert.conforme else "NON CONFORME"
        cert_html = f"<div class='{badge_classe}' style='margin:8px 0 4px 0;'>Certificat {cert.numero} — {badge_texte}</div>"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{_BASE_CSS}</style></head>
<body>
{_header_html(bat.client.organisation, "Rapport d'inspection annuelle — Norme CAN/ULC-S536", cert.numero if cert else "—", "Date d'inspection", _date_fr(rapport.date_inspection))}
<div class="banner">
  <div class="banner-title">RAPPORT D'INSPECTION ANNUELLE</div>
  <div class="banner-sub">Réseau d'alarme incendie — CAN/ULC-S536</div>
</div>
<div class="addr-box">
  <div class="addr-title">ADRESSE INSPECTÉE</div>
  <div class="addr-main">{adresse}</div>
</div>
<p style="font-size:9pt;color:#555555;">Technicien(s) : {tech_noms}</p>
{cert_html}
{e1_html}
{e2_html}
{legende_html}
<div class="sec-title">E3 — Vérification des dispositifs</div>
{sections_html}
<div class="footer">{bat.client.organisation.nom} — Rapport technique détaillé de l'inspection annuelle.</div>
</body></html>"""

    return _html_to_pdf_bytes(html)


def generer_pdf_rapport_extincteur_complet(rapport) -> bytes:
    """PDF du rapport technique complet de vérification des extincteurs
    portatifs (inventaire extincteurs + boyaux) — document détaillé, distinct
    du certificat sommaire."""
    from .views import LEGENDE_EXTINCTEURS

    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f" {bat.code_postal}"
    techniciens = list(rapport.techniciens.all())
    tech_noms = ", ".join(t.get_full_name() or t.username for t in techniciens) or "—"
    cert = rapport.certificat if hasattr(rapport, "certificat") else None

    legende_rows = "".join(
        f"<tr><td class='bold' style='width:44px;'>{code}</td><td>{desc}</td></tr>"
        for code, desc in LEGENDE_EXTINCTEURS
    )

    items = list(rapport.extincteurs.all())
    item_rows = "".join(
        f"<tr><td class='center'>{it.ordre}</td><td>{it.etage or '—'}</td><td>{it.emplacement or '—'}</td>"
        f"<td class='center'>{it.get_type_extincteur_display() if it.type_extincteur else '—'}</td>"
        f"<td class='center'>{it.get_format_display() if it.format else '—'}</td>"
        f"<td>{it.get_marque_display() if it.marque else '—'}</td><td>{it.numero_serie or '—'}</td>"
        f"<td class='center'>{it.date_fabrication or '—'}</td><td class='center'>{it.prochaine_maintenance or '—'}</td>"
        f"<td class='center'>{it.prochain_test_hydrostatique or '—'}</td><td class='center bold'>{it.etat or '—'}</td>"
        f"<td>{it.remarque or ''}</td></tr>"
        for it in items
    ) or "<tr><td colspan='12' class='center' style='color:#9ca3af;'>Aucun extincteur enregistré</td></tr>"

    boyaux = list(rapport.boyaux.all())
    boyau_rows = "".join(
        f"<tr><td class='center'>{b.ordre}</td><td>{b.etage or '—'}</td><td class='center bold'>{b.etat or '—'}</td>"
        f"<td>{b.emplacement or '—'}</td><td class='center'>{b.get_longueur_display() if b.longueur else '—'}</td>"
        f"<td class='center'>{b.date_fabrication or '—'}</td><td class='center'>{b.prochain_test_hydrostatique or '—'}</td>"
        f"<td>{b.remarque or ''}</td></tr>"
        for b in boyaux
    ) or "<tr><td colspan='8' class='center' style='color:#9ca3af;'>Aucun boyau enregistré</td></tr>"

    cert_html = f"<div class='badge-conforme' style='margin:8px 0 4px 0;'>Certificat {cert.numero}</div>" if cert else ""

    html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{_BASE_CSS}</style></head>
<body>
{_header_html(bat.client.organisation, "Rapport de vérification — Extincteurs portatifs", cert.numero if cert else "—", "Date d'inspection", _date_fr(rapport.date_inspection))}
<div class="banner">
  <div class="banner-title">RAPPORT DE VÉRIFICATION</div>
  <div class="banner-sub">Extincteurs portatifs</div>
</div>
<div class="addr-box">
  <div class="addr-title">ADRESSE INSPECTÉE</div>
  <div class="addr-main">{adresse}</div>
</div>
<p style="font-size:9pt;color:#555555;">Technicien(s) : {tech_noms}</p>
{cert_html}
<div class="sec-title">Légende</div>
<div class="legende-box"><table>{legende_rows}</table></div>
<div class="sec-title">Extincteurs portatifs</div>
<table class="wide-table">
  <tr><th>#</th><th>Étage</th><th>Emplacement</th><th>Type</th><th>Format</th><th>Marque</th>
  <th>N° série</th><th>Fab.</th><th>Maint.</th><th>Test hydro</th><th>État</th><th>Remarque</th></tr>
  {item_rows}
</table>
<div class="sec-title">Boyaux d'incendie</div>
<table class="wide-table">
  <tr><th>#</th><th>Étage</th><th>État</th><th>Emplacement</th><th>Longueur</th><th>Fab.</th><th>Test hydro</th><th>Remarque</th></tr>
  {boyau_rows}
</table>
<div class="footer">{bat.client.organisation.nom} — Rapport technique détaillé de la vérification des extincteurs portatifs.</div>
</body></html>"""

    return _html_to_pdf_bytes(html)
