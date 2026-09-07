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


def _documents_prets_directs(batiment) -> list[dict]:
    """Construit la liste des rapports fermés et pas encore envoyés de ce
    bâtiment (incendie + extincteurs, éclairage d'urgence et système de
    cuisine inclus dans le certificat extincteurs) — un seul point d'entrée
    réutilisé pour l'aperçu (« combien de documents prêts ? ») et l'envoi
    réel, pour qu'un futur module suivant ce même patron de certificat
    (rapport fermé -> `certificat`) apparaisse ici automatiquement sans
    toucher au frontend."""
    elements = []

    for rapport in batiment.rapports.filter(statut="ferme"):
        if hasattr(rapport, "certificat") and not rapport.certificat.certificat_envoye:
            elements.append(_element_incendie(rapport))

    for rapport_ext in batiment.rapports_extincteurs.filter(statut="ferme"):
        if hasattr(rapport_ext, "certificat") and not rapport_ext.certificat.certificat_envoye:
            elements.append(_element_extincteur(rapport_ext))

    return elements


def _element_incendie(rapport) -> dict:
    """Construit l'élément (pièces jointes + méta) d'un rapport incendie
    fermé — sans condition sur `certificat_envoye`, pour être réutilisable
    autant par l'envoi groupé (documents pas encore envoyés) que par un
    renvoi ciblé d'un document déjà envoyé."""
    from .pdf import generer_pdf_certificat, generer_pdf_rapport_complet

    cert = rapport.certificat
    return {
        "label": "Réseau d'alarme incendie",
        "numero": cert.numero,
        "conforme": cert.conforme,
        "nb_rapports": 1,
        "attachments": [
            (f"rapport-{cert.numero}.pdf", generer_pdf_rapport_complet(rapport), "application/pdf"),
            (f"certificat-{cert.numero}.pdf", generer_pdf_certificat(rapport), "application/pdf"),
        ],
        "_obj": rapport,
    }


def _element_extincteur(rapport_ext) -> dict:
    """Équivalent de `_element_incendie` pour un rapport extincteur — chaque
    rapport lié (éclairage, cuisine) garde son propre fichier PDF
    indépendant, seul le certificat est partagé."""
    from .pdf import (
        conformite_extincteur,
        generer_pdf_certificat_extincteur,
        generer_pdf_rapport_cuisine_complet,
        generer_pdf_rapport_eclairage_complet,
        generer_pdf_rapport_extincteur_complet,
    )

    cert = rapport_ext.certificat
    eclairage_lie = getattr(rapport_ext, "rapport_eclairage_lie", None)
    cuisine_liee = getattr(rapport_ext, "rapport_cuisine_lie", None)
    attachments = [
        (f"rapport-extincteurs-{cert.numero}.pdf", generer_pdf_rapport_extincteur_complet(rapport_ext), "application/pdf"),
    ]
    if eclairage_lie:
        attachments.append(
            (f"rapport-eclairage-{eclairage_lie.id}.pdf", generer_pdf_rapport_eclairage_complet(eclairage_lie), "application/pdf")
        )
    if cuisine_liee:
        attachments.append(
            (f"rapport-cuisine-{cuisine_liee.id}.pdf", generer_pdf_rapport_cuisine_complet(cuisine_liee), "application/pdf")
        )
    attachments.append(
        (f"certificat-extincteurs-{cert.numero}.pdf", generer_pdf_certificat_extincteur(rapport_ext), "application/pdf")
    )
    return {
        "label": "Extincteurs portatifs"
        + (" et éclairage d'urgence" if eclairage_lie else "")
        + (" et système de cuisine" if cuisine_liee else ""),
        "numero": cert.numero,
        "conforme": conformite_extincteur(rapport_ext),
        "nb_rapports": 1 + (1 if eclairage_lie else 0) + (1 if cuisine_liee else 0),
        "attachments": attachments,
        "_obj": rapport_ext,
    }


def envoyer_certificats_directs_batiment(batiment, utilisateur) -> tuple[bool, str]:
    """Regroupe TOUS les documents prêts de ce bâtiment (voir
    `_documents_prets_directs`) et les envoie en un seul courriel —
    déclenché depuis la fiche du bâtiment, peu importe quel rapport a été
    fermé en dernier."""
    from .models import Client

    client = batiment.client
    if client.mode_livraison != Client.ModeLivraison.DIRECT:
        return False, "Ce client n'est pas en mode d'envoi direct."
    if not client.contact_email:
        return False, "Ce client n'a pas d'adresse courriel de contact — impossible d'envoyer en mode direct."

    elements = _documents_prets_directs(batiment)
    if not elements:
        return False, "Aucun rapport fermé à envoyer pour ce bâtiment."

    envoyer_email_documents_directs(batiment, elements)

    from django.utils import timezone

    for el in elements:
        cert = el["_obj"].certificat
        cert.certificat_envoye = True
        cert.mode_envoi = cert.ModeEnvoi.DIRECT
        cert.date_envoi = timezone.now()
        cert.envoye_a = client.contact_email
        cert.save()
        el["_obj"].historiser(
            utilisateur,
            f"Rapport et certificat envoyés par courriel (mode direct) à {client.contact_email}",
        )

    noms = " + ".join(el["label"] for el in elements)
    return True, (
        f"Envoyé avec succès ! {client.nom} recevra son rapport et son certificat "
        f"par courriel à {client.contact_email} ({noms})."
    )


def renvoyer_document_direct(rapport, type_rapport: str, utilisateur) -> tuple[bool, str]:
    """Renvoie UN SEUL document déjà envoyé (mode direct), sans toucher aux
    autres documents du bâtiment — contrairement à
    `envoyer_certificats_directs_batiment`, qui n'envoie que ce qui n'a
    jamais été envoyé, ceci ignore volontairement `certificat_envoye` pour
    permettre un renvoi (client qui a perdu le courriel, etc.)."""
    from django.utils import timezone

    from .models import Client

    batiment = rapport.batiment
    client = batiment.client
    if client.mode_livraison != Client.ModeLivraison.DIRECT:
        return False, "Ce client n'est pas en mode d'envoi direct."
    if not client.contact_email:
        return False, "Ce client n'a pas d'adresse courriel de contact — impossible d'envoyer en mode direct."

    element = _element_incendie(rapport) if type_rapport == "incendie" else _element_extincteur(rapport)
    envoyer_email_documents_directs(batiment, [element])

    cert = rapport.certificat
    cert.certificat_envoye = True
    cert.mode_envoi = cert.ModeEnvoi.DIRECT
    cert.date_envoi = timezone.now()
    cert.envoye_a = client.contact_email
    cert.save()
    rapport.historiser(utilisateur, f"Certificat renvoyé par courriel (mode direct) à {client.contact_email}")

    return True, f"Renvoyé avec succès à {client.contact_email}."


def envoyer_rappel_inspection(destinataire_email: str, destinataire_nom: str, est_superviseur: bool, label: str, batiment, prochaine_date, langue: str) -> None:
    """Un seul courriel de rappel, envoyé individuellement à chaque
    destinataire (citoyen ET chaque superviseur de l'organisation) — voir
    `inspections/tasks.py:envoyer_rappels_inspections`, exécutée
    quotidiennement 30 jours avant la date de `prochaine_inspection`."""
    adresse = f"{batiment.numero_civique} {batiment.rue}, {batiment.ville}"
    organisation = batiment.client.organisation

    intro_cle = "rappel_intro_superviseur" if est_superviseur else "rappel_intro_citoyen"
    conseil_cle = "rappel_conseil_superviseur" if est_superviseur else "rappel_conseil_citoyen"

    mois_courts = {
        "fr": ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"],
        "en": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    }
    mois_abbr = mois_courts.get(langue, mois_courts["fr"])[prochaine_date.month - 1]

    client_ligne = (
        f"<tr><td style='padding-top:10px;color:#94a3b8;font-size:12px;'>"
        f"{et('rappel_client_label', langue)} <strong style='color:#102a43;'>{batiment.client.nom}</strong></td></tr>"
        if est_superviseur else ""
    )

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
  <tr>
    <td style="width:34px;height:34px;background:#fef2f2;border-radius:9px;text-align:center;vertical-align:middle;">
      <span style="font-size:16px;">📅</span>
    </td>
    <td style="padding-left:10px;">
      <p style="margin:0;color:#e11324;font-size:11px;font-weight:800;letter-spacing:1.5px;">{et('rappel_eyebrow', langue)}</p>
      <h2 style="margin:1px 0 0;font-size:19px;font-weight:800;color:#102a43;">{et('rappel_titre', langue)}</h2>
    </td>
  </tr>
</table>

<p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{destinataire_nom}</strong>,<br>
  {et(intro_cle, langue)} <strong style="color:#102a43;">{label}</strong> {et('rappel_au', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('rappel_prevue_le', langue)}
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#fff7ed;border:1px solid #fde3cc;border-radius:12px;margin-bottom:18px;">
  <tr>
    <td style="padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:58px;height:58px;background:#fff;border:1px solid #fde3cc;border-radius:10px;text-align:center;vertical-align:middle;">
            <p style="margin:0;color:#e11324;font-size:9px;font-weight:800;letter-spacing:1px;line-height:1;">{mois_abbr}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:20px;font-weight:800;line-height:1;">{prochaine_date.day}</p>
          </td>
          <td style="padding-left:14px;">
            <p style="margin:0;color:#9a4a13;font-size:11px;font-weight:800;letter-spacing:0.5px;">{et('rappel_dans_30_jours', langue)}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:15px;font-weight:700;">{prochaine_date.strftime('%d/%m/%Y')}</p>
          </td>
        </tr>
        {client_ligne}
      </table>
    </td>
  </tr>
</table>

<p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
  {et(conseil_cle, langue)}
</p>"""

    envoyer_email(destinataire_email, et('rappel_sujet', langue), html_template(html_body))


def envoyer_confirmation_planification(citoyen_email: str, citoyen_nom: str, label: str, batiment, date_inspection, langue: str) -> None:
    """Avise le citoyen qu'une visite vient d'être planifiée pour son adresse
    — envoyé une seule fois, à la création du rapport (voir perform_create
    de RapportViewSet/RapportExtincteurViewSet)."""
    adresse = f"{batiment.numero_civique} {batiment.rue}, {batiment.ville}"
    organisation = batiment.client.organisation

    mois_courts = {
        "fr": ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"],
        "en": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    }
    mois_abbr = mois_courts.get(langue, mois_courts["fr"])[date_inspection.month - 1]

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
  <tr>
    <td style="width:34px;height:34px;background:#e9f6f2;border-radius:9px;text-align:center;vertical-align:middle;">
      <span style="font-size:16px;">✅</span>
    </td>
    <td style="padding-left:10px;">
      <p style="margin:0;color:#0d6b4f;font-size:11px;font-weight:800;letter-spacing:1.5px;">{et('confirmation_eyebrow', langue)}</p>
      <h2 style="margin:1px 0 0;font-size:19px;font-weight:800;color:#102a43;">{et('confirmation_titre', langue)}</h2>
    </td>
  </tr>
</table>

<p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen_nom}</strong>,<br>
  {et('confirmation_intro', langue)} <strong style="color:#102a43;">{label}</strong> {et('rappel_au', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('confirmation_a_ete_planifiee', langue)}
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#e9f6f2;border:1px solid #bfe3d5;border-radius:12px;margin-bottom:18px;">
  <tr>
    <td style="padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:58px;height:58px;background:#fff;border:1px solid #bfe3d5;border-radius:10px;text-align:center;vertical-align:middle;">
            <p style="margin:0;color:#0d6b4f;font-size:9px;font-weight:800;letter-spacing:1px;line-height:1;">{mois_abbr}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:20px;font-weight:800;line-height:1;">{date_inspection.day}</p>
          </td>
          <td style="padding-left:14px;">
            <p style="margin:0;color:#0d6b4f;font-size:11px;font-weight:800;letter-spacing:0.5px;">{et('confirmation_date_label', langue)}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:15px;font-weight:700;">{date_inspection.strftime('%d/%m/%Y')}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
  {et('confirmation_conseil', langue)}
</p>"""

    envoyer_email(citoyen_email, et('confirmation_sujet', langue), html_template(html_body))


def envoyer_avis_changement_date(citoyen_email: str, citoyen_nom: str, label: str, batiment, ancienne_date, nouvelle_date, langue: str) -> None:
    """Avise le citoyen que la date d'une visite déjà planifiée vient d'être
    modifiée — envoyé quand `date_inspection` change sur un rapport ouvert
    (voir perform_update des ViewSets de rapport)."""
    adresse = f"{batiment.numero_civique} {batiment.rue}, {batiment.ville}"
    organisation = batiment.client.organisation

    mois_courts = {
        "fr": ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"],
        "en": ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    }
    mois_abbr = mois_courts.get(langue, mois_courts["fr"])[nouvelle_date.month - 1]

    html_body = f"""
{_bandeau_organisation(organisation, langue)}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
  <tr>
    <td style="width:34px;height:34px;background:#fff7ed;border-radius:9px;text-align:center;vertical-align:middle;">
      <span style="font-size:16px;">🔄</span>
    </td>
    <td style="padding-left:10px;">
      <p style="margin:0;color:#9a4a13;font-size:11px;font-weight:800;letter-spacing:1.5px;">{et('changement_eyebrow', langue)}</p>
      <h2 style="margin:1px 0 0;font-size:19px;font-weight:800;color:#102a43;">{et('changement_titre', langue)}</h2>
    </td>
  </tr>
</table>

<p style="margin:0 0 18px;color:#64748b;font-size:14px;line-height:1.6;">
  {et('bonjour', langue)} <strong style="color:#102a43;">{citoyen_nom}</strong>,<br>
  {et('changement_intro', langue)} <strong style="color:#102a43;">{label}</strong> {et('rappel_au', langue)}
  <strong style="color:#102a43;">{adresse}</strong> {et('changement_a_ete_modifiee', langue)}
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="background:#fff7ed;border:1px solid #fde3cc;border-radius:12px;margin-bottom:18px;">
  <tr>
    <td style="padding:18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:14px;">
            <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.5px;">{et('changement_ancienne_date', langue)}</p>
            <p style="margin:2px 0 0;color:#94a3b8;font-size:15px;font-weight:700;text-decoration:line-through;">{ancienne_date.strftime('%d/%m/%Y')}</p>
          </td>
          <td style="padding-right:14px;color:#cbd5e1;font-size:18px;">→</td>
          <td>
            <p style="margin:0;color:#9a4a13;font-size:11px;font-weight:800;letter-spacing:0.5px;">{et('changement_nouvelle_date', langue)}</p>
            <p style="margin:2px 0 0;color:#102a43;font-size:15px;font-weight:700;">{nouvelle_date.strftime('%d/%m/%Y')}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
  {et('changement_conseil', langue)}
</p>"""

    envoyer_email(citoyen_email, et('changement_sujet', langue), html_template(html_body))
