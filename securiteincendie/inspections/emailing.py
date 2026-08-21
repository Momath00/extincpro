from django.conf import settings

from securiteincendie.emailing import envoyer_email, html_template


def envoyer_email_certificat_extincteur_disponible(rapport) -> None:
    """Avertit le citoyen que le certificat de vérification des extincteurs
    portatifs est disponible — envoyé quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    cert = rapport.certificat
    bat = rapport.batiment
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports-extincteurs/{rapport.id}" if frontend_url else ""

    html_body = f"""
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Votre certificat est disponible</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  Bonjour <strong style="color:#0f172a;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  le rapport de vérification des extincteurs portatifs au
  <strong style="color:#0f172a;">{adresse}</strong> ainsi que son certificat sont maintenant
  disponibles sur la plateforme.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
  <tr>
    <td style="padding:14px 20px;">
      <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Certificat</span>
      <span style="font-size:14px;font-weight:700;color:#0f172a;">{cert.numero}</span>
    </td>
  </tr>
</table>
{f'<p style="margin:0;text-align:center;"><a href="{lien}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">Voir mon rapport</a></p>' if lien else ''}"""

    envoyer_email(
        citoyen.email,
        "Votre certificat d'extincteurs est disponible — Extincteurs Nationex",
        html_template(html_body),
    )
