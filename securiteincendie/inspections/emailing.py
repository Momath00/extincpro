from django.conf import settings

from securiteincendie.emailing import envoyer_email, html_template
from securiteincendie.email_i18n import et, langue_utilisateur


def _langue_organisation(organisation) -> str:
    """Langue d'une organisation — même repli que `langue_utilisateur`, pour
    les courriels adressés à un client (pas un compte Utilisateur)."""
    return getattr(organisation, "langue", "fr") or "fr"


def _bandeau_organisation(organisation, langue: str = "fr") -> str:
    """Puce affichant le nom de l'organisation cliente qui a réalisé
    l'inspection — essentiel en SaaS multi-organisation : le citoyen/client
    final doit savoir de quelle compagnie vient le courriel, même si la
    plateforme (ExtincPro, dans l'en-tête) est partagée par plusieurs."""
    return (
        f'<div style="display:inline-block;background:#f1f5f9;color:#334155;font-size:11px;'
        f'font-weight:700;letter-spacing:0.5px;padding:5px 12px;border-radius:100px;margin-bottom:14px;">'
        f"{et('inspection_realisee_par', langue)} {organisation.nom}</div>"
    )


def envoyer_email_reparations_requises(rapport) -> None:
    """Avertit le citoyen que des réparations sont requises avant que son
    certificat ne soit conforme — envoyé à la fermeture du rapport."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    bat = rapport.batiment
    organisation = bat.client.organisation
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
{_bandeau_organisation(organisation, langue)}
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#102a43;">{et('reparations_titre', langue)}</h2>
<p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen.get_full_name() or citoyen.username}</strong>,<br>
  <strong style="color:#102a43;">{organisation.nom}</strong> — {et('reparations_intro', langue)}
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
        f"{organisation.nom} — {et('reparations_sujet_court', langue)}",
        html_template(html_body),
    )


def envoyer_email_certificat_disponible(rapport) -> None:
    """Avertit le citoyen que son rapport/certificat est disponible sur la
    plateforme — envoyé automatiquement quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    cert = rapport.certificat
    bat = rapport.batiment
    organisation = bat.client.organisation
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports/{rapport.id}" if frontend_url else ""

    conforme = cert.conforme
    badge_color = "#0d6b4f" if conforme else "#e11324"
    badge_bg = "#e9f6f2" if conforme else "#fef2f2"
    badge_texte = et("conforme_email", langue) if conforme else et("non_conforme_email", langue)

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
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
        f"{organisation.nom} — {et('certificat_dispo_sujet_court', langue)}",
        html_template(html_body),
    )


def envoyer_email_certificat_extincteur_disponible(rapport) -> None:
    """Avertit le citoyen que le certificat de vérification des extincteurs
    portatifs est disponible — envoyé quand le superviseur l'envoie."""
    citoyen = rapport.citoyen
    langue = langue_utilisateur(citoyen)
    cert = rapport.certificat
    bat = rapport.batiment
    organisation = bat.client.organisation
    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    lien = f"{frontend_url}/citoyen/rapports-extincteurs/{rapport.id}" if frontend_url else ""

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
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
        f"{organisation.nom} — {et('certificat_extincteur_sujet_court', langue)}",
        html_template(html_body),
    )


def envoyer_email_documents_directs(batiment, elements: list[dict]) -> None:
    """Mode « direct » (clients sans espace dédié) : UN SEUL courriel regroupant
    tous les documents prêts pour ce bâtiment — chaque élément de `elements`
    apporte son rapport complet + son certificat en pièce jointe, pour que le
    client reçoive exactement ce qu'un citoyen verrait sur son espace."""
    client = batiment.client
    organisation = client.organisation
    langue = _langue_organisation(organisation)
    adresse = f"{batiment.numero_civique} {batiment.rue}, {batiment.ville}"
    destinataire_nom = client.contact_nom or client.nom

    cartes = ""
    attachments: list[tuple[str, bytes, str]] = []
    for el in elements:
        badge = ""
        if el["conforme"] is not None:
            badge_color = "#0d6b4f" if el["conforme"] else "#e11324"
            badge_bg = "#e9f6f2" if el["conforme"] else "#fef2f2"
            badge_texte = et("conforme_email", langue) if el["conforme"] else et("non_conforme_email", langue)
            badge = (
                f'<span style="display:inline-block;background:{badge_bg};color:{badge_color};'
                f'font-size:11px;font-weight:700;padding:4px 12px;border-radius:100px;margin-top:4px;">{badge_texte}</span>'
            )
        cartes += f"""
<tr>
  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
    <span style="display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">{el['label']}</span>
    <span style="font-size:14px;font-weight:700;color:#102a43;">{el['numero']}</span><br>{badge}
  </td>
</tr>"""
        attachments.extend(el["attachments"])

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
<h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#102a43;">{et('direct_titre', langue)}</h2>
<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{destinataire_nom}</strong>,<br>
  <strong style="color:#102a43;">{organisation.nom}</strong> {et('direct_a_realise_inspection', langue)}
  <strong style="color:#102a43;">{adresse}</strong>. {et('direct_intro_suite', langue)}
</p>
<table role="presentation" cellpadding="0" cellspacing="0"
  style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
  {cartes}
</table>
<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
  📎 {len(attachments)} {et('direct_pieces_jointes_suffixe', langue)}
</p>"""

    sujet = f"{organisation.nom} — {et('direct_sujet_court', langue)} ({adresse})"

    envoyer_email(client.contact_email, sujet, html_template(html_body), attachments=attachments)


def envoyer_certificats_directs_batiment(batiment, utilisateur) -> tuple[bool, str]:
    """Regroupe TOUS les rapports fermés et pas encore envoyés de ce bâtiment
    (incendie + extincteurs, éclairage d'urgence inclus dans le certificat
    extincteurs) et les envoie en un seul courriel — déclenché depuis
    n'importe lequel des types de rapport. Chaque type prêt est inclus, pour
    que le client reçoive tout en une fois plutôt que plusieurs courriels."""
    from .models import Client
    from .pdf import (
        conformite_extincteur,
        generer_pdf_certificat,
        generer_pdf_certificat_extincteur,
        generer_pdf_rapport_complet,
        generer_pdf_rapport_extincteur_complet,
    )

    client = batiment.client
    if client.mode_livraison != Client.ModeLivraison.DIRECT:
        return False, "Ce client n'est pas en mode d'envoi direct."
    if not client.contact_email:
        return False, "Ce client n'a pas d'adresse courriel de contact — impossible d'envoyer en mode direct."

    elements = []

    for rapport in batiment.rapports.filter(statut="ferme"):
        if hasattr(rapport, "certificat") and not rapport.certificat.certificat_envoye:
            cert = rapport.certificat
            elements.append({
                "label": "Réseau d'alarme incendie",
                "numero": cert.numero,
                "conforme": cert.conforme,
                "attachments": [
                    (f"rapport-{cert.numero}.pdf", generer_pdf_rapport_complet(rapport), "application/pdf"),
                    (f"certificat-{cert.numero}.pdf", generer_pdf_certificat(rapport), "application/pdf"),
                ],
                "_obj": rapport,
            })

    for rapport_ext in batiment.rapports_extincteurs.filter(statut="ferme"):
        if hasattr(rapport_ext, "certificat") and not rapport_ext.certificat.certificat_envoye:
            cert = rapport_ext.certificat
            elements.append({
                "label": "Extincteurs portatifs" + (" et éclairage d'urgence" if getattr(rapport_ext, "rapport_eclairage_lie", None) else ""),
                "numero": cert.numero,
                "conforme": conformite_extincteur(rapport_ext),
                "attachments": [
                    (f"rapport-extincteurs-{cert.numero}.pdf", generer_pdf_rapport_extincteur_complet(rapport_ext), "application/pdf"),
                    (f"certificat-extincteurs-{cert.numero}.pdf", generer_pdf_certificat_extincteur(rapport_ext), "application/pdf"),
                ],
                "_obj": rapport_ext,
            })

    if not elements:
        return False, "Aucun rapport fermé à envoyer pour ce bâtiment."

    envoyer_email_documents_directs(batiment, elements)

    for el in elements:
        el["_obj"].certificat.certificat_envoye = True
        el["_obj"].certificat.save()
        el["_obj"].historiser(
            utilisateur,
            f"Rapport et certificat envoyés par courriel (mode direct) à {client.contact_email}",
        )

    noms = " + ".join(el["label"] for el in elements)
    return True, f"Envoyé par courriel à {client.contact_email} ({noms})."
