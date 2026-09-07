from securiteincendie.emailing import envoyer_email, html_template
from securiteincendie.email_i18n import et

CONTACT_EMAIL = "contact@mssolutioninformatique.com"
CONTACT_TELEPHONE = "(514) 546-6767"


def envoyer_avis_fin_essai(destinataire_email: str, destinataire_nom: str, organisation_nom: str, date_fin, langue: str = "fr") -> None:
    """Avise un superviseur que l'essai gratuit de son organisation se
    termine bientôt — envoyé 7 jours avant `date_fin_essai` (voir
    organisations/tasks.py:envoyer_avis_fin_essai_organisations)."""
    mois_courts = {
        "fr": ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"],
        "en": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    }
    mois_abbr = mois_courts.get(langue, mois_courts["fr"])[date_fin.month - 1]

    html_body = f"""
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
  <tr>
    <td style="width:34px;height:34px;background:#fff7ed;border-radius:9px;text-align:center;vertical-align:middle;">
      <span style="font-size:16px;">⏳</span>
    </td>
    <td style="padding-left:10px;">
      <p style="margin:0;color:#9a4a13;font-size:11px;font-weight:800;letter-spacing:1.5px;">{et('essai_eyebrow', langue)}</p>
      <h2 style="margin:1px 0 0;font-size:19px;font-weight:800;color:#102a43;">{et('essai_titre', langue)}</h2>
    </td>
  </tr>
</table>

<p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{destinataire_nom}</strong>,<br>
  {et('essai_intro', langue)} <strong style="color:#102a43;">{organisation_nom}</strong> {et('essai_se_termine_le', langue)}
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#fff7ed;border:1px solid #fde3cc;border-radius:12px;margin-bottom:18px;">
  <tr>
    <td style="padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:58px;height:58px;background:#fff;border:1px solid #fde3cc;border-radius:10px;text-align:center;vertical-align:middle;">
            <p style="margin:0;color:#e11324;font-size:9px;font-weight:800;letter-spacing:1px;line-height:1;">{mois_abbr}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:20px;font-weight:800;line-height:1;">{date_fin.day}</p>
          </td>
          <td style="padding-left:14px;">
            <p style="margin:0;color:#9a4a13;font-size:11px;font-weight:800;letter-spacing:0.5px;">{et('essai_fin_label', langue)}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:15px;font-weight:700;">{date_fin.strftime('%d/%m/%Y')}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.6;">
  {et('essai_conseil', langue)}
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
  <tr>
    <td style="padding:14px 20px;">
      <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">{et('essai_contact_label', langue)}</p>
      <p style="margin:0;color:#102a43;font-size:14px;font-weight:700;">
        <a href="mailto:{CONTACT_EMAIL}" style="color:#e11324;text-decoration:none;">{CONTACT_EMAIL}</a>
      </p>
      <p style="margin:2px 0 0;color:#102a43;font-size:14px;font-weight:700;">{CONTACT_TELEPHONE}</p>
    </td>
  </tr>
</table>"""

    envoyer_email(destinataire_email, et('essai_sujet', langue), html_template(html_body))
