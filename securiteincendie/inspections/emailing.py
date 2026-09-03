from django.conf import settings

from securiteincendie.emailing import envoyer_email, html_template
from securiteincendie.email_i18n import et, langue_utilisateur


def envoyer_email_reparations_requises(rapport) -> None:
    """Avertit le citoyen que des réparations sont requises avant que son
    certificat ne soit conforme — envoyé à la fermeture du rapport."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports/{rapport.id}" if frontend_url else ""

    dispositifs_defectueux = [d for d in rapport.dispositifs.all() if d.est_defectueux]
    lignes = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#102a43;font-weight:600;'>{d.get_type_dispositif_display()}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;'>{d.localisation}</td></tr>"
        for d in dispositifs_defectueux
    )

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#102a43;">{et('reparations_titre', langue)}</h2>
<p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  {et('reparations_intro', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('reparations_intro_suite', langue)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <thead><tr>
    <th style="text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">{et('col_dispositif_email', langue)}</th>
    <th style="text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">{et('col_localisation_email', langue)}</th>
  </tr></thead>
  <tbody>{lignes}</tbody>
</table>
<div style="background:#fffbeb;border-left:3px solid #e11324;padding:12px 16px;border-radius:0 8px 8px 0;">
  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
    ⚠️ {et('reparations_note', langue)}
  </p>
</div>
{f'<p style="margin:24px 0 0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#e11324;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">{et("voir_rapport_btn", langue)}</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        et("reparations_sujet", langue),
        html_template(html_body),
    )


def envoyer_email_certificat_disponible(rapport) -> None:
    """Avertit le citoyen que son rapport/certificat est disponible sur la
    plateforme — envoyé automatiquement quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports/{rapport.id}" if frontend_url else ""

    conforme = cert.conforme
    badge_color = "#0d6b4f" if conforme else "#e11324"
    badge_bg = "#e9f6f2" if conforme else "#fef2f2"
    badge_texte = et("conforme_email", langue) if conforme else et("non_conforme_email", langue)

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#102a43;">{et('rapport_dispo_titre', langue)}</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  {et('rapport_dispo_intro', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('rapport_dispo_intro_suite', langue)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">{et('certificat_label_email', langue)}</span>
      <span style="font-size:14px;font-weight:700;color:#102a43;">{cert.numero}</span>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:inline-block;background:{badge_bg};color:{badge_color};font-size:11px;font-weight:700;padding:4px 12px;border-radius:100px;">{badge_texte}</span>
    </td>
  </tr>
</table>
{f'<p style="margin:0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#e11324;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">{et("voir_mon_rapport_btn", langue)}</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        et("certificat_dispo_sujet", langue),
        html_template(html_body),
    )


def envoyer_email_certificat_extincteur_disponible(rapport) -> None:
    """Avertit le citoyen que le certificat de vérification des extincteurs
    portatifs est disponible — envoyé quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports-extincteurs/{rapport.id}" if frontend_url else ""

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#102a43;">{et('certificat_dispo_titre', langue)}</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  {et('certificat_extincteur_intro', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('rapport_dispo_intro_suite', langue)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">{et('certificat_label_email', langue)}</span>
      <span style="font-size:14px;font-weight:700;color:#102a43;">{cert.numero}</span>
    </td>
  </tr>
</table>
{f'<p style="margin:0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#e11324;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">{et("voir_mon_rapport_btn", langue)}</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        et("certificat_extincteur_sujet", langue),
        html_template(html_body),
    )
