"""Composants HTML/CSS partagés pour les documents imprimables (certificats
et rapports complets) — un seul design pour toute la plateforme : en-tête
avec ligne rouge, bandeau de titre noir, icônes SVG inline, pied de page
noir/rouge avec bouclier. Utilisé par les 4 documents (certificat et rapport
complet, incendie et extincteurs) pour que tout soit visuellement cohérent."""

ICONE_BOUCLIER = "<path d='M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z'/><path d='M9 12l2 2 4-4'/>"
ICONE_CUISINE = "<path d='M12 2c-1 3-4 4-4 8a4 4 0 008 0c0-1.5-.5-2.5-1-3.5.5 2-.5 3-1.5 3-1.5 0-1.5-2-1.5-3.5 0-1.5.5-2.5 0-4z'/>"
ICONE_EXTINCTEUR = "<path d='M9 2h3v2h2a1 1 0 011 1v2h-1v13a2 2 0 01-2 2h-2a2 2 0 01-2-2V7H7V5a1 1 0 011-1h1V2z'/><path d='M17 9c2 1 3 3 3 5'/>"
ICONE_SORTIE = "<rect x='4' y='4' width='10' height='16' rx='1'/><path d='M14 12h6m0 0l-3-3m3 3l-3 3'/>"
ICONE_PERSONNE = "<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8'/>"
ICONE_CALENDRIER = "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v4M8 3v4M3 10h18'/>"
ICONE_PIN = "<path d='M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7z'/><circle cx='12' cy='9' r='2.5'/>"
ICONE_ALARME = "<path d='M12 3a5 5 0 00-5 5c0 4.5-2 5.5-2 7.5h14c0-2-2-3-2-7.5a5 5 0 00-5-5z'/><path d='M10 19.5a2 2 0 004 0'/>"
ICONE_DOCUMENT = "<path d='M6 2h9l5 5v15H6z'/><path d='M14 2v5h5'/><path d='M9 13h6M9 17h6'/>"


def icone(path_svg: str, taille: int = 15, couleur: str = "#e11324") -> str:
    return (
        f"<svg width='{taille}' height='{taille}' viewBox='0 0 24 24' fill='none' "
        f"stroke='{couleur}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' "
        f"style='vertical-align:middle;flex-shrink:0;'>{path_svg}</svg>"
    )


def icone_badge(path_svg: str, taille_badge: int = 22, taille_icone: int = 13, fond: str = "#0a0b0d", couleur_icone: str = "#fff") -> str:
    return (
        f"<span style='display:inline-flex;align-items:center;justify-content:center;"
        f"width:{taille_badge}px;height:{taille_badge}px;border-radius:5px;background:{fond};"
        f"flex-shrink:0;'>{icone(path_svg, taille_icone, couleur_icone)}</span>"
    )


def case(actif: bool, couleur: str | None = None) -> str:
    if actif:
        fond = couleur or "#0a0b0d"
        return (
            f"<span style='display:inline-flex;align-items:center;justify-content:center;"
            f"width:20px;height:20px;border-radius:4px;background:{fond};color:#fff;"
            f"font-size:13px;font-weight:900;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,0.15);'>&#10003;</span>"
        )
    return (
        "<span style='display:inline-block;width:20px;height:20px;border-radius:4px;"
        "border:1.5px solid #d1d5db;background:#fafafa;'></span>"
    )


CSS_DOCUMENT = """
  @page { margin: 18mm 15mm; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#111; background:#fff; }
  .header{ display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #e11324; padding-bottom:12px; margin-bottom:18px; }
  .brand{ display:flex; align-items:center; gap:12px; }
  .logo-box{ height:52px; max-width:170px; display:flex; align-items:center; flex-shrink:0; }
  .logo-box img{ max-height:100%; max-width:100%; }
  .brand-text h1{ font-size:13pt; font-weight:900; color:#0a0b0d; text-transform:uppercase; letter-spacing:1px; }
  .brand-text p{ font-size:8pt; color:#555; margin-top:1px; }
  .cert-badge{ text-align:right; }
  .title-banner{ background:#0a0b0d; color:#fff; text-align:center; padding:10px 0; border-radius:4px; margin-bottom:18px; }
  .title-banner h2{ font-size:12pt; font-weight:700; letter-spacing:2px; text-transform:uppercase; }
  .title-banner p{ font-size:8pt; color:rgba(255,255,255,0.7); margin-top:3px; letter-spacing:1px; }
  .info-card{ border:1px solid #e5e7eb; border-radius:6px; padding:10px 14px; }
  .card-title{ font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#e11324; margin-bottom:6px; }
  .card-main{ font-size:11pt; font-weight:700; color:#0a0b0d; line-height:1.3; }
  .sec-title{ font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#0a0b0d; border-bottom:1.5px solid #0a0b0d; padding-bottom:4px; margin-bottom:8px; margin-top:16px; }
  table{ width:100%; border-collapse:collapse; font-size:9pt; }
  th{ background:#f1f5f9; color:#0a0b0d; font-weight:700; padding:6px 10px; text-align:left; font-size:8pt; text-transform:uppercase; }
  td{ padding:5px 10px; border-bottom:1px solid #f1f5f9; color:#111; }
  .center{ text-align:center; } .bold{ font-weight:700; } .muted{ color:#9ca3af; font-style:italic; }
  .conf-box{ border:1.5px solid #0a0b0d; border-radius:6px; padding:12px 16px; background:#f8fafc; }
  .conf-item{ display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; font-size:9pt; }
  .conf-item:last-child{ margin-bottom:0; }
  .sig-row{ display:flex; gap:24px; margin-top:18px; }
  .sig-block{ flex:1; border-top:1.5px solid #111; padding-top:6px; }
  .sig-icon{ display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; border:1.5px solid #e11324; flex-shrink:0; }
  .sig-label{ font-size:7.5pt; color:#e11324; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
  .sig-name{ font-size:10pt; font-weight:700; color:#0a0b0d; margin-top:2px; }
  .footer{ margin-top:24px; background:#0a0b0d; color:rgba(255,255,255,0.55); padding:10px 16px; border-radius:4px 4px 0 0; border-top:2px solid #e11324; border-bottom:4px solid #e11324; display:flex; justify-content:space-between; align-items:center; font-size:7.5pt; }
  .footer strong{ color:#fff; }
  .equip-table{ border:1.5px solid #0a0b0d; border-radius:6px; overflow:hidden; }
  .equip-table th{ background:#0a0b0d; color:#fff; padding:6px 12px; font-size:7.5pt; border:none; border-right:1px solid rgba(255,255,255,0.15); }
  .equip-table th:last-child{ border-right:none; }
  .equip-table td{ padding:6px 12px; border-bottom:1px solid #e5e7eb; border-right:1px solid #e5e7eb; vertical-align:middle; }
  .equip-table td:last-child{ border-right:none; }
  .equip-table tr:last-child td{ border-bottom:none; }
  .sec-sub{ font-size:8.5pt; font-weight:700; color:#0a0b0d; border-bottom:1px solid #d1d5db; padding-bottom:2px; margin-top:12px; margin-bottom:5px; }
  .legende-box{ border:1px solid #999999; border-radius:4px; padding:8px 10px; margin-bottom:10px; background:#fafafa; }
  .legende-box table td{ border:none; padding:2px 8px; font-size:8pt; }
  .data-grid{ border:1px solid #d1d5db; border-collapse:collapse; }
  .data-grid th{ border:1px solid #d1d5db; }
  .data-grid td{ border:1px solid #e5e7eb; }
  @media print{ body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print{ display:none!important; } }
"""


def entete(logo_content: str, organisation_nom: str, sous_titre: str, numero_label: str, numero: str, date_label: str, date_valeur: str, tech_label: str, tech_noms: str) -> str:
    return f"""<div class="header">
  <div class="brand">
    <div class="logo-box">{logo_content}</div>
    <div class="brand-text">
      <h1>{organisation_nom}</h1>
      <p>{sous_titre}</p>
    </div>
  </div>
  <div class="cert-badge">
    <div style="font-size:11pt; font-weight:700; color:#0a0b0d;">{date_valeur}</div>
    <div style="font-size:7.5pt;color:#777;text-transform:uppercase;letter-spacing:1px;">{date_label}</div>
    <div style="font-size:8pt;color:#555;margin-top:3px;">{numero_label} {numero}</div>
    <div style="font-size:7.5pt;color:#777;margin-top:3px;">{tech_label} : {tech_noms}</div>
  </div>
</div>"""


def pied_de_page(organisation_nom: str, message: str) -> str:
    return f"""<div class="footer">
  <div><strong>{organisation_nom}</strong></div>
  <div style="display:flex;align-items:center;gap:8px;">
    <span>{message}</span>
    {icone(ICONE_BOUCLIER, 16, '#e11324')}
  </div>
</div>"""
