"""Helpers d'envoi de courriel partagés (Resend) — gabarit HTML aux couleurs
de la plateforme, avec le logo réel intégré en base64."""
import base64
import io
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import strip_tags

_LOGO_CACHE: dict = {}
# Le fichier source (logo.png) est une image marketing haute résolution (~2 Mo) —
# beaucoup trop lourde pour un courriel (Gmail tronque au-delà de ~100 Ko).
# On la redimensionne une seule fois à une taille d'icône avant de l'encoder.
_LOGO_MAX_SIDE = 160


def logo_data_uri(size_px: int = 52) -> str:
    """Logo encodé en base64 (img data URI, redimensionné), ou repli texte « EP » si absent."""
    if size_px not in _LOGO_CACHE:
        path = Path(settings.BASE_DIR).parent / "frontend" / "public" / "logo.png"
        if path.exists():
            try:
                from PIL import Image

                with Image.open(path) as img:
                    img = img.convert("RGBA")
                    img.thumbnail((_LOGO_MAX_SIDE, _LOGO_MAX_SIDE), Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, format="PNG", optimize=True)
                    raw = buf.getvalue()
            except Exception:
                raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            _LOGO_CACHE[size_px] = (
                f'<img src="data:image/png;base64,{b64}" '
                f'style="width:{size_px}px;height:{size_px}px;object-fit:cover;" alt="ExtincPro" />'
            )
        else:
            _LOGO_CACHE[size_px] = (
                f'<span style="font-size:{size_px // 3}pt;font-weight:900;color:#e11324;letter-spacing:1px;">EP</span>'
            )
    return _LOGO_CACHE[size_px]


def logo_img_tag(size_px: int = 44) -> str:
    """
    <img> pointant vers une URL publique stable (EMAIL_LOGO_URL). Les clients
    courriel (Gmail en tête) bloquent ou cassent souvent les images encodées
    en base64 (data:) — une vraie URL externe est nécessaire pour un
    affichage fiable dans les courriels (contrairement aux PDF, où le base64
    reste préférable pour un rendu autonome hors-ligne).
    """
    logo_url = getattr(settings, "EMAIL_LOGO_URL", "") or (
        (getattr(settings, "FRONTEND_URL", "").rstrip("/") + "/icon-192.png")
        if getattr(settings, "FRONTEND_URL", "")
        else ""
    )
    if logo_url:
        return (
            f'<img src="{logo_url}" width="{size_px}" height="{size_px}" '
            f'style="width:{size_px}px;height:{size_px}px;object-fit:cover;display:block;" '
            f'alt="ExtincPro" />'
        )
    return f'<span style="font-size:{size_px // 3}pt;font-weight:900;color:#e11324;letter-spacing:1px;">EP</span>'


def html_template(body: str) -> str:
    """Enveloppe un corps de courriel dans le gabarit aux couleurs de la plateforme."""
    year = timezone.now().year
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" style="width:100%;max-width:480px;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#0a0b0d;padding:28px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 10px;">
              <tr><td style="width:44px;height:44px;background:#fff;border-radius:50%;text-align:center;vertical-align:middle;overflow:hidden;">
                {logo_img_tag(44)}
              </td></tr>
            </table>
            <p style="margin:0;color:#fff;font-size:12px;font-weight:700;letter-spacing:2px;">EXTINC<span style="color:#ff2438;">PRO</span></p>
          </td>
        </tr>
        <tr><td style="background:#fff;padding:32px;">{body}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">© {year} ExtincPro · Courriel confidentiel</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def envoyer_email(to_email: str, subject: str, html: str, reply_to: str | None = None) -> None:
    """Envoie via Resend si RESEND_API_KEY est défini, sinon repli SMTP Django."""
    api_key = getattr(settings, "RESEND_API_KEY", "")
    from_email = getattr(settings, "RESEND_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL)
    if api_key:
        try:
            import resend as _resend

            _resend.api_key = api_key
            payload = {"from": from_email, "to": [to_email], "subject": subject, "html": html}
            if reply_to:
                payload["reply_to"] = [reply_to]
            _resend.Emails.send(payload)
            return
        except Exception:
            pass
    email = EmailMultiAlternatives(
        subject=subject,
        body=strip_tags(html),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_email],
        reply_to=[reply_to] if reply_to else None,
    )
    email.attach_alternative(html, "text/html")
    email.send(fail_silently=True)
