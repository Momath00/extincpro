"""Rapports extincteurs (NFPA 10) et éclairage d'urgence (NFPA 101) au
gabarit de Sécurité Incendie National — même disposition que leurs classeurs
Excel : en-tête avec coordonnées et slogan, bloc d'identification, tableau
aux colonnes du gabarit, puis Remarques / Recommandations / Obligations.

Utilisé à la place du rendu standard quand l'organisation a
`gabarit_rapports = "sin"` (voir `_html_rapport_extincteur_complet` et
`_html_rapport_eclairage_complet` dans views.py)."""

from django.utils.html import escape

from securiteincendie.emailing import organisation_logo_content

from .models import EclairageUrgenceItem, ExtincteurItem
from .photos import html_annexe_photos

COORDONNEES = (
    "Sécurité Incendie National",
    "31, rue Leblanc, Épiphanie",
    "Québec, J5X 3Y3",
    "438-404-1518",
    "www.securite-incendie-national.ca",
)
SLOGAN = "SENSIBILISER LES GENS C’EST IMPORTANT"

# Colonnes TYPE et CLASSE du gabarit, déduites du type d'extincteur saisi.
TYPE_CLASSE = {
    "ABC": ("POUDRE", "ABC"),
    "BC": ("POUDRE", "BC"),
    "CO2": ("CO2", "BC"),
    "EAU": ("EAU", "A"),
    "AFFF": ("MOUSSE", "AB"),
    "K": ("CHIMIQUE HUMIDE", "K"),
    "halotron": ("HALOTRON", ""),
    "fe36": ("FE-36", ""),
    "autre": ("AUTRE", ""),
}

# Légende E3.1 de leur fiche d'alarme S-536 (+ VH, PAI et K, présents dans
# leurs fiches de dispositifs).
LEGENDE_DISPOSITIFS_S536 = [
    ("M", "Avertisseur manuel d'incendie"),
    ("RHT", "Détecteur de chaleur réarmable"),
    ("HT", "Détecteur de chaleur non réarmable"),
    ("S", "Détecteur de fumée"),
    ("RI", "Indicateur à distance"),
    ("DS", "Détecteur de fumée de conduit"),
    ("SFD", "Dispositif d'appui (surveillance)"),
    ("FS", "Interrupteur de débit des gicleurs"),
    ("SS", "Dispositifs de surveillance des gicleurs"),
    ("EM", "Module d'isolation en cas de défaut"),
    ("B", "Cloche"),
    ("H", "Avertisseur sonore"),
    ("V", "Dispositif de signalisation visuelle"),
    ("SP", "Haut-parleur à cône"),
    ("HSP", "Haut-parleur à pavillon"),
    ("AD", "Dispositif auxiliaire"),
    ("ET", "Téléphone d'urgence"),
    ("EOL", "Résistance d'extrémité de ligne"),
    ("VH", "Avertisseur sonore et visuel"),
    ("PAI", "Panneau d'alarme incendie"),
    ("K", "Klaxon"),
]

# Colonnes de la fiche E3.2.1 telles qu'imprimées sur leur gabarit.
COLONNES_E3 = (
    "EMPLACEMENT", "DISPOSITIF", "INSTALLATION CORRECTE",
    "NÉCESSITE DE L'ENTRETIEN, DES RÉPARATIONS, UN NETTOYAGE",
    "FONCTIONNEMENT DE L'ALARME CONFIRMÉ", "INDICATION DE L'ANNONCE CONFIRMÉE",
    "ZONE, NUMÉRO DE CIRCUIT OU ADRESSE", "REMARQUES",
)

# Colonne « Indication de l'annonce confirmée » : I → O, D → N.
ANNONCE_O_N = {"I": "O", "D": "N", "NI": "NI"}


def o_n(valeur) -> str:
    """Case O / N de la fiche E3.2.1 (vide = S.O.)."""
    return "O" if valeur is True else "N" if valeur is False else "S.O."


# Codes déjà rendus par une colonne du gabarit (prochaine recharge, prochain
# test hydro, étiquette, support) — les autres vont dans les remarques.
CODES_EN_COLONNE = {"RC", "TH", "PIC", "SUPM"}

CSS = """
  @page { size: Letter; margin: 18mm 15mm; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:Calibri,Arial,Helvetica,sans-serif; font-size:9.5pt; color:#000; background:#fff; }
  .page{ padding:16px 20px; }
  .entete{ width:100%; border-collapse:collapse; margin-bottom:14px; }
  .entete td{ vertical-align:top; }
  .logo img{ height:96px; width:auto; }
  .coord{ font-weight:700; font-size:10.5pt; line-height:1.35; padding-left:10px; }
  .coord .web{ font-weight:400; }
  .titre{ text-align:center; vertical-align:middle!important; }
  .titre .boite{ border:1.5px solid #000; padding:8px 10px; font-weight:700; font-size:12pt; }
  .titre .slogan{ margin-top:10px; font-weight:700; font-size:11pt; }
  .infos{ width:100%; border-collapse:collapse; margin-bottom:14px; font-size:9.5pt; }
  .infos td{ padding:2px 4px; font-weight:700; vertical-align:top; }
  .infos .lib{ white-space:nowrap; width:1%; }
  .infos-bordees td{ border:1px solid #000; font-weight:400; }
  .infos-bordees .lib{ font-weight:700; }
  .grille{ width:100%; border-collapse:collapse; margin-bottom:14px; }
  .grille th, .grille td{ border:1px solid #000; padding:3px 3px; text-align:center; vertical-align:middle; }
  .grille th{ background:#d0cece; font-weight:700; font-size:8.5pt; }
  .grille td{ font-size:9pt; }
  .grille .sur-titre th{ background:#fff; }
  .grille tr.def td{ background:#fde2e2; }
  .grille tr.ni td{ background:#fef3c7; }
  .grille .gauche{ text-align:left; }
  .grille.serree{ table-layout:fixed; }
  .grille.serree th{ font-size:6.5pt; padding:2px 1px; overflow-wrap:anywhere; hyphens:auto; }
  .grille.serree td{ font-size:7.5pt; padding:2px 1px; overflow-wrap:anywhere; }
  .bloc{ margin-top:12px; page-break-inside:avoid; }
  .bloc .lib{ font-weight:700; font-size:10pt; margin-bottom:3px; }
  .bloc .texte{ border-bottom:1px solid #000; min-height:46px; padding:2px 0 6px; white-space:normal; line-height:1.45; }
  .no-print{ text-align:right; padding:8px 12px; background:#f8fafc; border-bottom:1px solid #e5e7eb; }
  .no-print button{ background:#0a0b0d; color:#fff; border:none; padding:8px 20px; border-radius:4px; font-weight:700; cursor:pointer; font-size:10pt; }
  @media print{ body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print{ display:none!important; } }
"""


def _maj(texte) -> str:
    return escape(str(texte or "").upper())


def _date(d) -> str:
    from .views import _date_fr

    return _date_fr(d).upper() if d else "—"


def _techniciens(rapport) -> str:
    return ", ".join(t.get_full_name() or t.username for t in rapport.techniciens.all()) or "—"


def _texte(valeur: str) -> str:
    return escape(valeur or "").replace("\n", "<br>")


def _bloc(libelle: str, contenu: str) -> str:
    return f"<div class='bloc'><div class='lib'>{libelle}</div><div class='texte'>{contenu or '&nbsp;'}</div></div>"


def _blocs_notes(rapport, remarques_lignes: list[str]) -> str:
    """Remarques saisies + remarques des lignes du tableau (codes et texte
    qui n'ont pas de colonne dans le gabarit), puis recommandations et
    obligations."""
    remarques = _texte(rapport.remarques)
    if remarques_lignes:
        remarques += ("<br>" if remarques else "") + "<br>".join(remarques_lignes)
    return (
        _bloc("REMARQUES :", remarques)
        + _bloc("RECOMMANDATIONS :", _texte(rapport.recommandations))
        + _bloc("OBLIGATIONS :", _texte(rapport.obligations))
    )


def _entete(organisation, titre: str) -> str:
    nom, rue, ville, telephone, site = COORDONNEES
    return f"""
<table class="entete"><tr>
  <td class="logo" style="width:1%;">{organisation_logo_content(organisation, 96)}</td>
  <td class="coord" style="width:38%;">{escape(nom)}<br>{escape(rue)}<br>{escape(ville)}<br>{escape(telephone)}<br><span class="web">{escape(site)}</span></td>
  <td class="titre"><div class="boite">{escape(titre)}</div><div class="slogan">{escape(SLOGAN)}</div></td>
</tr></table>"""


def _document(titre_page: str, corps: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{escape(titre_page)}</title>
<style>{CSS}</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">Imprimer / PDF</button></div>
<div class="page">
{corps}
</div>
</body>
</html>"""


def _emplacement(item) -> str:
    return " — ".join(escape(v) for v in (item.etage, item.emplacement) if v) or "—"


def _classe_etat(etat) -> str:
    return " class='def'" if etat == "D" else " class='ni'" if etat == "NI" else ""


# ── Extincteurs NFPA 10 ──────────────────────────────────────────────────────

def html_rapport_extincteurs(rapport) -> str:
    bat = rapport.batiment
    client = bat.client
    organisation = client.organisation
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"

    lignes, remarques_lignes = "", []
    for it in rapport.extincteurs.all():
        codes = it.non_conformites or []
        inspecte = it.etat in (ExtincteurItem.Etat.CONFORME, ExtincteurItem.Etat.DEFECTUEUX)
        type_, classe = TYPE_CLASSE.get(it.type_extincteur, ("", ""))
        oui_non = lambda code: ("NON" if code in codes else "OUI") if inspecte else "—"
        lignes += (
            f"<tr{_classe_etat(it.etat)}>"
            f"<td>{it.ordre}</td>"
            f"<td>{escape(it.derniere_inspection) or '—'}</td>"
            f"<td>{escape(it.numero_serie) or '—'}</td>"
            f"<td>{_maj(it.get_format_display()) or '—'}</td>"
            f"<td>{type_ or '—'}</td>"
            f"<td>{classe or '—'}</td>"
            f"<td>{escape(it.date_fabrication) or '—'}</td>"
            f"<td>{escape(it.derniere_recharge) or '—'}</td>"
            f"<td>{escape(it.dernier_test_hydrostatique) or '—'}</td>"
            f"<td>{'À FAIRE' if 'RC' in codes else escape(it.prochaine_maintenance) or '—'}</td>"
            f"<td>{'À FAIRE' if 'TH' in codes else escape(it.prochain_test_hydrostatique) or '—'}</td>"
            f"<td>{oui_non('PIC')}</td>"
            f"<td>{oui_non('SUPM')}</td>"
            f"<td class='gauche'>{_emplacement(it)}</td>"
            f"</tr>"
        )
        autres = [c for c in codes if c not in CODES_EN_COLONNE]
        if it.etat == ExtincteurItem.Etat.NON_INSPECTE:
            autres.insert(0, "non inspecté")
        detail = " · ".join(filter(None, [", ".join(autres), it.remarque]))
        if detail:
            remarques_lignes.append(f"Extincteur n° {it.ordre} : {escape(detail)}")
    if not lignes:
        lignes = "<tr><td colspan='14'>Aucun extincteur.</td></tr>"

    boyaux = ""
    lignes_boyaux = "".join(
        f"<tr{_classe_etat(b.etat)}><td>{b.ordre}</td><td class='gauche'>{_emplacement(b)}</td>"
        f"<td>{_maj(b.get_longueur_display()) or '—'}</td><td>{escape(b.date_fabrication) or '—'}</td>"
        f"<td>{escape(b.prochain_test_hydrostatique) or '—'}</td>"
        f"<td>{ {'C': 'OUI', 'D': 'NON', 'NI': 'N.I.'}.get(b.etat, '—') }</td>"
        f"<td class='gauche'>{escape(b.remarque)}</td></tr>"
        for b in rapport.boyaux.all()
    )
    if lignes_boyaux:
        boyaux = f"""
<table class="grille">
  <thead><tr><th>NUMÉRO</th><th>LIEU BOYAU</th><th>LONGUEUR</th><th>ANNÉE DE FABRICATION</th>
  <th>PROCHAIN TEST HYDRO</th><th>CONFORME</th><th>REMARQUE</th></tr></thead>
  <tbody>{lignes_boyaux}</tbody>
</table>"""

    titre = "RAPPORT EXTINCTEURS INCENDIE NFPA 10"
    corps = f"""
{_entete(organisation, titre)}
<table class="infos infos-bordees">
  <tr><td class="lib"># CLIENT :</td><td>{client.id}</td></tr>
  <tr><td class="lib">NOM :</td><td>{_maj(client.nom)}</td></tr>
  <tr><td class="lib">ADRESSE DE SERVICE :</td><td>{_maj(adresse)}</td></tr>
  <tr><td class="lib"># TÉLÉPHONE :</td><td>{escape(client.contact_telephone) or '—'}</td></tr>
  <tr><td class="lib">RESPONSABLE :</td><td>{_maj(client.contact_nom) or '—'}</td></tr>
  <tr><td class="lib">INSPECTION FAITE PAR :</td><td>{_maj(_techniciens(rapport))}</td></tr>
  <tr><td class="lib">DATE :</td><td>{_date(rapport.date_inspection)}</td></tr>
</table>
<table class="grille serree">
  <colgroup><col style="width:5%"><col span="12" style="width:6.5%"><col style="width:17%"></colgroup>
  <thead><tr>
    <th>NUMÉRO</th><th>DERNIÈRE INSPECTION</th><th>NUMÉRO DE SÉRIE</th><th>POIDS</th><th>TYPE</th><th>CLASSE</th>
    <th>ANNÉE DE FABRICATION</th><th>DERNIÈRE RECHARGE</th><th>DERNIER TEST HYDRO</th><th>PROCHAINE RECHARGE</th>
    <th>PROCHAIN TEST HYDRO</th><th>ÉTIQUETTE DE VISIBILITÉ</th><th>SUPPORT MURAL</th><th>LIEU EXTINCTEUR</th>
  </tr></thead>
  <tbody>{lignes}</tbody>
</table>
{boyaux}
{_blocs_notes(rapport, remarques_lignes)}
{html_annexe_photos(rapport, "Photos des anomalies", "suite")}"""
    return _document(f"{titre} — {adresse}", corps)


# ── Éclairage d'urgence NFPA 101 ─────────────────────────────────────────────

ETAT_CONFORME = {"C": "OUI", "D": "NON", "NI": "N.I."}


def html_rapport_eclairage(rapport) -> str:
    bat = rapport.batiment
    client = bat.client
    organisation = client.organisation
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"

    items = list(rapport.eclairages_urgence.all())
    lignes, remarques_lignes = "", []
    for it in items:
        lignes += (
            f"<tr{_classe_etat(it.etat)}>"
            f"<td>{it.ordre}</td>"
            f"<td class='gauche'>{_emplacement(it)}</td>"
            f"<td>{_maj(it.fabricant) or '—'}</td>"
            f"<td>{escape(it.dispositif) or '—'}</td>"
            f"<td>{_maj(it.modele) or '—'}</td>"
            f"<td>{ETAT_CONFORME.get(it.etat, '—')}</td>"
            f"<td>{_maj(it.voltage) or '—'}</td>"
            f"</tr>"
        )
        if it.remarque:
            remarques_lignes.append(f"Dispositif n° {it.ordre} : {escape(it.remarque)}")
    if not lignes:
        lignes = "<tr><td colspan='7'>Aucun dispositif.</td></tr>"

    legende = "".join(
        f"<tr><td style='font-weight:700;width:22%;'>{code}</td><td>{escape(libelle.upper())}</td></tr>"
        for code, libelle in EclairageUrgenceItem.Dispositif.choices
    )

    titre = "RAPPORT D'INSPECTION - ÉCLAIRAGES D'URGENCE - NFPA 101"
    techniciens = _maj(_techniciens(rapport))
    corps = f"""
{_entete(organisation, titre)}
<table class="infos">
  <tr><td class="lib">NOM DU BÂTIMENT :</td><td>{_maj(client.nom)}</td>
      <td class="lib">NOM DU TECHNICIEN :</td><td>{techniciens}</td></tr>
  <tr><td class="lib">ADRESSE DE SERVICE :</td><td>{_maj(adresse)}</td>
      <td class="lib">DATE DE L’INSPECTION :</td><td>{_date(rapport.date_inspection)}</td></tr>
  <tr><td class="lib">NOM DU CONTACT :</td><td>{_maj(client.contact_nom) or '—'}</td>
      <td class="lib">NOMBRE DE DISPOSITIF :</td><td>{len(items)}</td></tr>
  <tr><td class="lib">TÉLÉPHONE DU CONTACT :</td><td>{escape(client.contact_telephone) or '—'}</td>
      <td class="lib">COURRIEL :</td><td>{_maj(client.contact_email) or '—'}</td></tr>
</table>
<table class="grille">
  <thead>
    <tr class="sur-titre"><th colspan="4">LES DISPOSITIFS SONT INSPECTÉS SELON LES NORMES NFPA 101.</th><th colspan="3">BATTERIES</th></tr>
    <tr><th>NO</th><th>EMPLACEMENT</th><th>FABRICANT</th><th>DISPOSITIF</th><th>MODÈLE</th><th>CONFORME</th><th>CAPACITÉ</th></tr>
  </thead>
  <tbody>{lignes}</tbody>
</table>
<table class="grille" style="page-break-inside:avoid;">
  <thead><tr><th>LÉGENDE DES DISPOSITIFS</th><th>SIGNIFICATION</th></tr></thead>
  <tbody>{legende}</tbody>
</table>
{_blocs_notes(rapport, remarques_lignes)}
{html_annexe_photos(rapport, "Photos des anomalies", "suite")}"""
    return _document(f"{titre} — {adresse}", corps)
