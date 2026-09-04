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
            return page.pdf(format="Letter", print_background=True, margin=_MARGE)
        finally:
            browser.close()


def generer_pdf_certificat(rapport) -> bytes:
    from .views import _html_certificat_incendie
    return _html_vers_pdf(_html_certificat_incendie(rapport))


def generer_pdf_rapport_complet(rapport) -> bytes:
    from .views import _html_rapport_incendie_complet
    return _html_vers_pdf(_html_rapport_incendie_complet(rapport))


def generer_pdf_certificat_extincteur(rapport) -> bytes:
    from .views import _html_certificat_extincteur
    return _html_vers_pdf(_html_certificat_extincteur(rapport))


def generer_pdf_rapport_extincteur_complet(rapport) -> bytes:
    from .views import _html_rapport_extincteur_complet
    return _html_vers_pdf(_html_rapport_extincteur_complet(rapport))


def conformite_extincteur(rapport) -> bool:
    """Conformité unifiée du certificat extincteurs : non conforme dès qu'un
    extincteur OU une unité d'éclairage d'urgence liée est défectueux —
    même règle que `_html_certificat_extincteur`."""
    items = list(rapport.extincteurs.all())
    rapport_eclairage = getattr(rapport, "rapport_eclairage_lie", None)
    eclairages = list(rapport_eclairage.eclairages_urgence.all()) if rapport_eclairage else []
    return not any(it.etat == "D" for it in items) and not any(it.etat == "D" for it in eclairages)
