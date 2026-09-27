"""Génère de vrais PDF (octets, pour pièce jointe courriel) en rendant le
HTML RÉEL des documents — les mêmes fonctions que les vues navigateur
(`_html_certificat_incendie`, `_html_rapport_incendie_complet`,
`_html_certificat_extincteur`, `_html_rapport_extincteur_complet` dans
`views.py`) — via un navigateur headless (Playwright/Chromium). Ça garantit
une correspondance exacte avec ce que le superviseur voit à l'écran, plutôt
qu'une réimplémentation manuelle qui finit par diverger du vrai design."""

from playwright.sync_api import sync_playwright

# Doit correspondre à `@page { margin: ... }` dans pdf_design.CSS_DOCUMENT —
# Chromium n'applique pas les marges CSS @page en impression PDF, seule la
# taille de page (avec preferCSSPageSize) en tient compte, donc les marges
# doivent être répétées ici explicitement.
_MARGE = {"top": "18mm", "bottom": "18mm", "left": "15mm", "right": "15mm"}


def _html_vers_pdf(html: str) -> bytes:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            return _proteger_pdf(page.pdf(format="Letter", print_background=True, margin=_MARGE))
        finally:
            browser.close()


def _proteger_pdf(contenu: bytes) -> bytes:
    """Verrouille le PDF remis au client (AES-256) : il s'ouvre et s'imprime
    librement, mais ne peut pas être modifié ni ses pages extraites — le mot
    de passe propriétaire est aléatoire et jamais conservé. La vraie preuve
    d'authenticité reste le QR code / code d'intégrité (voir certificats.py)."""
    import io
    import secrets

    from pypdf import PdfReader, PdfWriter
    from pypdf.constants import UserAccessPermissions

    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(contenu)))
    writer.encrypt(
        user_password="",
        owner_password=secrets.token_urlsafe(24),
        permissions_flag=UserAccessPermissions.PRINT | UserAccessPermissions.PRINT_TO_REPRESENTATION,
        algorithm="AES-256",
    )
    sortie = io.BytesIO()
    writer.write(sortie)
    return sortie.getvalue()


def generer_pdf_certificat(rapport) -> bytes:
    from .views import _html_certificat_incendie
    return _html_vers_pdf(_html_certificat_incendie(rapport))


def generer_pdf_rapport_complet(rapport) -> bytes:
    from .views import _html_rapport_incendie_complet
    return _html_vers_pdf(_html_rapport_incendie_complet(rapport))


def generer_pdf_certificat_extincteur(rapport) -> bytes:
    from .views import _html_certificat_extincteur
    return _html_vers_pdf(_html_certificat_extincteur(rapport))


def generer_pdf_certificat_visite(cert) -> bytes:
    from .certificats import html_certificat
    return _html_vers_pdf(html_certificat(cert))


def generer_pdf_rapport_extincteur_complet(rapport) -> bytes:
    from .views import _html_rapport_extincteur_complet
    return _html_vers_pdf(_html_rapport_extincteur_complet(rapport))


def generer_pdf_rapport_cuisine_complet(rapport) -> bytes:
    from .views import _html_rapport_cuisine_complet
    return _html_vers_pdf(_html_rapport_cuisine_complet(rapport))


def generer_pdf_rapport_eclairage_complet(rapport) -> bytes:
    from .views import _html_rapport_eclairage_complet
    return _html_vers_pdf(_html_rapport_eclairage_complet(rapport))


def generer_pdf_certificat_gicleur(rapport) -> bytes:
    from .views_gicleur import html_certificat_gicleur
    return _html_vers_pdf(html_certificat_gicleur(rapport))


def generer_pdf_rapport_gicleur_complet(rapport) -> bytes:
    from .views_gicleur import html_rapport_gicleur_complet
    return _html_vers_pdf(html_rapport_gicleur_complet(rapport))

