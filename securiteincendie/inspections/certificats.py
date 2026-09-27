"""Certificats de vérification — extincteurs, éclairage d'urgence, cuisine.

Un certificat est composé de lignes, une par système (cuisine, extincteurs,
éclairage d'urgence). Chaque ligne a un statut calculé à partir du rapport
correspondant (conforme / non conforme / S.O.) que le superviseur peut
ajuster à la main, raison obligatoire, si l'organisation le permet.

Cycle de vie :

    brouillon ──émettre──▶ émis (HTML figé, révision N)
        ▲                      │
        └──── rapport rouvert / ligne ajustée ────┘

Une nouvelle émission crée une révision (R1, R2…) seulement si le contenu a
réellement changé (empreinte) — refermer un rapport sans rien modifier
réémet la même révision. Chaque révision garde son HTML exact, vérifiable
publiquement par le QR code imprimé dessus.

Les réglages viennent de `ParametresCertificat` (un par organisation).
"""

import base64
import hashlib
import hmac
import json
from datetime import date

from django.conf import settings
from django.utils import timezone
from django.utils.html import escape

from .models import CertificatExtincteur, ParametresCertificat, RevisionCertificat

CONFORME = "conforme"
NON_CONFORME = "non_conforme"
SO = "so"
STATUTS = (CONFORME, NON_CONFORME, SO)

# Ordre d'affichage des lignes sur le certificat.
SYSTEMES = ("cuisine", "extincteurs", "eclairage")

MODULE_SYSTEME = {
    "cuisine": "rapport_cuisine",
    "extincteurs": "rapport_extincteur",
    "eclairage": "rapport_eclairage_urgence",
}

I18N_CERT = {
    "ligne_cuisine": {"fr": "Système automatique de cuisine", "en": "Automatic kitchen system"},
    "ligne_extincteurs": {"fr": "Extincteurs portatifs", "en": "Portable fire extinguishers"},
    "ligne_eclairage": {"fr": "Éclairage d'urgence", "en": "Emergency lighting"},
    "echeance_col": {"fr": "Prochaine inspection", "en": "Next inspection"},
    "avis_titre": {"fr": "Avis de non-conformité", "en": "Notice of non-compliance"},
    "avis_bandeau": {
        "fr": "Des déficiences ont été constatées lors de la vérification de l'équipement sous mentionné",
        "en": "Deficiencies were found during the verification of the equipment listed below",
    },
    "avis_suite": {
        "fr": "Un certificat de conformité sera émis une fois les correctifs apportés et vérifiés.",
        "en": "A certificate of compliance will be issued once the corrections have been made and verified.",
    },
    "deficiences": {"fr": "Déficiences constatées", "en": "Deficiencies found"},
    "ajuste_par": {"fr": "Ajusté par", "en": "Adjusted by"},
    "absent_visite": {
        "fr": "Aucun système de ce type inspecté lors de cette visite",
        "en": "No system of this type inspected during this visit",
    },
    "normes_reference": {"fr": "Normes de référence", "en": "Reference standards"},
    "verifier_authenticite": {"fr": "Vérifier l'authenticité", "en": "Verify authenticity"},
    "footer_certificat": {
        "fr": "Ce document atteste la vérification des équipements indiqués à la date d'inspection mentionnée.",
        "en": "This document attests to the verification of the equipment listed on the inspection date indicated.",
    },
    "code_integrite": {"fr": "Code d'intégrité", "en": "Integrity code"},
    "brouillon_filigrane": {"fr": "BROUILLON — NON ÉMIS", "en": "DRAFT — NOT ISSUED"},
    "revision": {"fr": "Révision", "en": "Revision"},
    "remplace": {"fr": "remplace", "en": "supersedes"},
    "extincteur_defectueux": {"fr": "Extincteur défectueux", "en": "Defective extinguisher"},
    "eclairage_defectueux": {"fr": "Unité d'éclairage défectueuse", "en": "Defective lighting unit"},
    "verification_non_conforme": {"fr": "Vérification non conforme", "en": "Non-compliant check"},
    "decision_technicien": {
        "fr": "Le système nécessite des modifications (voir commentaires)",
        "en": "The system requires modifications (see comments)",
    },
}


def tc(langue, cle):
    """Traduction : dictionnaire propre au certificat, sinon celui des vues."""
    if cle in I18N_CERT:
        return I18N_CERT[cle].get(langue, I18N_CERT[cle]["fr"])
    from .views import _t

    return _t(langue, cle)


# ── Paramètres ───────────────────────────────────────────────────────────────

def parametres_pour(organisation):
    return ParametresCertificat.pour(organisation)


def _organisation(rapport_ou_cert):
    batiment = rapport_ou_cert.batiment
    return batiment.client.organisation


def systeme_du_rapport(rapport):
    from .models import RapportCuisine, RapportEclairageUrgence, RapportExtincteur

    if isinstance(rapport, RapportExtincteur):
        return "extincteurs"
    if isinstance(rapport, RapportCuisine):
        return "cuisine"
    if isinstance(rapport, RapportEclairageUrgence):
        return "eclairage"
    raise ValueError(f"Rapport non géré par les certificats : {type(rapport).__name__}")


# ── Quel certificat couvre quel rapport ────────────────────────────────────

def certificat_couvrant(rapport):
    """Le certificat qui couvre ce rapport : le sien s'il en a un, sinon
    (cuisine/éclairage lié) celui de son rapport extincteur en regroupement
    « par visite ». None si aucun n'existe encore."""
    propre = getattr(rapport, "certificat", None)
    if propre is not None:
        return propre
    if systeme_du_rapport(rapport) != "extincteurs" and rapport.rapport_extincteur_id:
        cert_ext = getattr(rapport.rapport_extincteur, "certificat", None)
        if cert_ext is not None and cert_ext.regroupement == ParametresCertificat.Regroupement.VISITE:
            return cert_ext
    return None


def rapports_couverts(cert):
    """{systeme: rapport} des rapports dont ce certificat reflète l'état."""
    if cert.rapport_id:
        couverts = {"extincteurs": cert.rapport}
        if cert.regroupement == ParametresCertificat.Regroupement.VISITE:
            cuisine = getattr(cert.rapport, "rapport_cuisine_lie", None)
            eclairage = getattr(cert.rapport, "rapport_eclairage_lie", None)
            if cuisine is not None:
                couverts["cuisine"] = cuisine
            if eclairage is not None:
                couverts["eclairage"] = eclairage
        return couverts
    if cert.rapport_cuisine_id:
        return {"cuisine": cert.rapport_cuisine}
    return {"eclairage": cert.rapport_eclairage}


# ── Calcul des lignes ────────────────────────────────────────────────────────

def _texte_item(item):
    morceaux = [m for m in (item.emplacement, item.etage) if m]
    texte = " — ".join(morceaux) or "—"
    if item.remarque:
        texte += f" ({item.remarque})"
    return texte


def statut_calcule(systeme, rapport, langue="fr"):
    """(statut, déficiences) calculés à partir du rapport."""
    if systeme == "extincteurs":
        items = list(rapport.extincteurs.all())
        defauts = [f"{tc(langue, 'extincteur_defectueux')} : {_texte_item(i)}" for i in items if i.etat == "D"]
        if not items:
            return SO, []
        return (NON_CONFORME if defauts else CONFORME), defauts
    if systeme == "eclairage":
        items = list(rapport.eclairages_urgence.all())
        defauts = [f"{tc(langue, 'eclairage_defectueux')} : {_texte_item(i)}" for i in items if i.etat == "D"]
        if not items:
            return SO, []
        return (NON_CONFORME if defauts else CONFORME), defauts
    # Cuisine : décision du technicien, sinon la checklist.
    from .views import CHECKLIST_CUISINE

    defauts = [
        f"{tc(langue, 'verification_non_conforme')} : {libelle}"
        for champ, libelle in CHECKLIST_CUISINE if getattr(rapport, champ) is False
    ]
    if rapport.conforme_recommandations is False:
        defauts.insert(0, tc(langue, "decision_technicien"))
    if rapport.commentaires and not rapport.est_conforme:
        defauts.append(rapport.commentaires.strip())
    return (CONFORME if rapport.est_conforme else NON_CONFORME), defauts


def calculer_lignes(cert):
    """Lignes actuelles du certificat (calculées + ajustements)."""
    organisation = _organisation(cert)
    parametres = parametres_pour(organisation)
    langue = organisation.langue
    couverts = rapports_couverts(cert)

    afficher_absents = (
        cert.regroupement == ParametresCertificat.Regroupement.VISITE
        and cert.rapport_id is not None
        and parametres.systemes_absents == ParametresCertificat.SystemesAbsents.AFFICHER_SO
    )

    lignes = []
    for systeme in SYSTEMES:
        rapport = couverts.get(systeme)
        if rapport is None:
            if not (afficher_absents and organisation.a_le_module(MODULE_SYSTEME[systeme])):
                continue
            calcule, defauts, echeance, rapport_id = SO, [], None, None
            raison_auto = tc(langue, "absent_visite")
        else:
            calcule, defauts = statut_calcule(systeme, rapport, langue)
            echeance = rapport.prochaine_inspection.isoformat() if rapport.prochaine_inspection else None
            rapport_id = rapport.id
            raison_auto = ""

        ajustement = cert.ajustements.get(systeme) if parametres.ajustement_manuel else None
        statut = ajustement["statut"] if ajustement else calcule
        lignes.append({
            "systeme": systeme,
            "label": tc(langue, f"ligne_{systeme}"),
            "present": rapport is not None,
            "rapport_id": rapport_id,
            "statut_calcule": calcule,
            "statut": statut,
            "ajuste": bool(ajustement),
            "raison": ajustement["raison"] if ajustement else raison_auto,
            "ajuste_par": ajustement.get("par_nom", "") if ajustement else "",
            "date_ajustement": ajustement.get("date", "") if ajustement else "",
            "echeance": echeance,
            # Une ligne ramenée à S.O. à la main n'a plus de déficiences à lister.
            "deficiences": defauts if statut == NON_CONFORME else [],
        })
    return lignes


def conformite(lignes):
    """Conforme si aucune ligne applicable n'est non conforme (S.O. ignoré)."""
    return not any(l["statut"] == NON_CONFORME for l in lignes)


def type_document(lignes, parametres):
    if not conformite(lignes) and parametres.non_conformite == ParametresCertificat.NonConformite.AVIS:
        return CertificatExtincteur.TypeDocument.AVIS
    return CertificatExtincteur.TypeDocument.CERTIFICAT


def _date_inspection(cert):
    couverts = rapports_couverts(cert)
    ancre = cert.rapport_ancre
    if ancre.date_inspection:
        return ancre.date_inspection
    dates = [r.date_inspection for r in couverts.values() if r.date_inspection]
    return min(dates) if dates else None


def _techniciens(cert):
    vus = {}
    for rapport in rapports_couverts(cert).values():
        for tech in rapport.techniciens.all():
            vus[tech.id] = tech.get_full_name() or tech.username
    return list(vus.values())


def empreinte(cert, lignes):
    """Empreinte du contenu d'inspection — deux émissions de même empreinte
    produisent le même document (pas de nouvelle révision)."""
    bat = cert.batiment
    parametres = parametres_pour(bat.client.organisation)
    contenu = {
        "type": type_document(lignes, parametres),
        "lignes": [
            {k: l[k] for k in ("systeme", "statut", "raison", "echeance", "deficiences")}
            for l in lignes
        ],
        "date": str(_date_inspection(cert)),
        "techniciens": sorted(_techniciens(cert)),
        "adresse": f"{bat.numero_civique} {bat.rue} {bat.ville} {bat.code_postal}",
        "client": bat.client.nom,
    }
    return hashlib.sha256(json.dumps(contenu, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# ── Cycle de vie ─────────────────────────────────────────────────────────────

def _historiser(cert, utilisateur, description):
    cert.rapport_ancre.historiser(utilisateur, description)


def assurer_certificat(rapport, utilisateur, cascade=False):
    """Appelé à la fermeture d'un rapport : crée son certificat si besoin et
    l'émet si l'organisation est en émission automatique. `cascade` : fermé
    par son rapport extincteur, qui émettra lui-même le certificat de visite."""
    organisation = _organisation(rapport)
    parametres = parametres_pour(organisation)
    systeme = systeme_du_rapport(rapport)

    cert = certificat_couvrant(rapport)
    if cascade and cert is not None and cert.systeme_ancre != systeme:
        return cert
    if cert is None:
        lie = systeme != "extincteurs" and rapport.rapport_extincteur_id
        if lie and parametres.regroupement == ParametresCertificat.Regroupement.VISITE:
            # Couvert par le certificat de son rapport extincteur, créé à la
            # fermeture de celui-ci.
            return None
        champ = {"extincteurs": "rapport", "cuisine": "rapport_cuisine", "eclairage": "rapport_eclairage"}[systeme]
        cert = CertificatExtincteur.objects.create(
            **{champ: rapport},
            batiment=rapport.batiment,
            regroupement=parametres.regroupement,
            statut=CertificatExtincteur.Statut.BROUILLON,
            emis_par=utilisateur,
        )

    # Le certificat peut garder en cache une copie périmée de son rapport
    # d'ancrage (chargée avant la fermeture) : on travaille sur le rapport
    # qu'on vient de fermer, ou on recharge l'ancre si c'est un autre.
    champ_ancre = {"extincteurs": "rapport", "cuisine": "rapport_cuisine", "eclairage": "rapport_eclairage"}[cert.systeme_ancre]
    if cert.systeme_ancre == systeme and getattr(cert, f"{champ_ancre}_id") == rapport.pk:
        setattr(cert, champ_ancre, rapport)
    else:
        cert.rapport_ancre.refresh_from_db()

    if cert.rapport_ancre.statut != "ferme":
        return cert
    if parametres.mode_emission == ParametresCertificat.ModeEmission.AUTO:
        emettre(cert, utilisateur)
    else:
        _historiser(cert, utilisateur, f"Certificat {cert.numero} prêt à émettre (émission manuelle)")
    return cert


def invalider_certificat(rapport, utilisateur):
    """Appelé à la réouverture d'un rapport : le certificat qui le couvre
    repasse en brouillon (et « non envoyé ») jusqu'à la prochaine émission."""
    cert = certificat_couvrant(rapport)
    if cert is None or cert.statut != CertificatExtincteur.Statut.EMIS:
        return
    cert.statut = CertificatExtincteur.Statut.BROUILLON
    cert.certificat_envoye = False
    cert.save(update_fields=["statut", "certificat_envoye"])
    _historiser(cert, utilisateur, f"Certificat {cert.numero_affiche} en révision (rapport rouvert)")


def ajuster_ligne(cert, systeme, statut, raison, utilisateur):
    """Ajuste (ou remet en automatique si `statut` est None) une ligne."""
    if statut is None:
        cert.ajustements.pop(systeme, None)
        description = f"Certificat : ligne « {systeme} » remise en calcul automatique"
    else:
        cert.ajustements[systeme] = {
            "statut": statut,
            "raison": raison,
            "par": utilisateur.id,
            "par_nom": utilisateur.get_full_name() or utilisateur.username,
            "date": timezone.now().isoformat(),
        }
        description = f"Certificat : ligne « {systeme} » ajustée à {statut} — {raison}"
    champs = ["ajustements"]
    if cert.statut == CertificatExtincteur.Statut.EMIS:
        # Le document émis ne correspond plus — à réémettre.
        cert.statut = CertificatExtincteur.Statut.BROUILLON
        champs.append("statut")
    cert.save(update_fields=champs)
    _historiser(cert, utilisateur, description)


def emettre(cert, utilisateur, historiser=True):
    """Fige le certificat. Retourne (révision, nouvelle: bool)."""
    organisation = _organisation(cert)
    parametres = parametres_pour(organisation)
    lignes = calculer_lignes(cert)
    emp = empreinte(cert, lignes)
    precedente = cert.revisions.first()

    if precedente is not None and precedente.empreinte == emp:
        # Contenu identique : on réémet le même document, sans révision.
        if cert.statut != CertificatExtincteur.Statut.EMIS:
            cert.statut = CertificatExtincteur.Statut.EMIS
            cert.save(update_fields=["statut"])
        return precedente, False

    maintenant = timezone.now()
    cert.revision = precedente.revision + 1 if precedente else 0
    cert.statut = CertificatExtincteur.Statut.EMIS
    cert.date_emission = maintenant
    cert.emis_par = utilisateur
    cert.lignes = lignes
    cert.conforme = conformite(lignes)
    cert.type_document = type_document(lignes, parametres)
    cert.empreinte = emp
    if precedente is not None:
        # Nouvelle version du document : elle doit être (re)transmise.
        cert.certificat_envoye = False
    cert.html_fige = rendre_html(cert, lignes, parametres, brouillon=False)
    cert.save()

    if precedente is not None:
        precedente.remplacee_le = maintenant
        precedente.save(update_fields=["remplacee_le"])
    revision = RevisionCertificat.objects.create(
        certificat=cert,
        revision=cert.revision,
        numero_affiche=cert.numero_affiche,
        type_document=cert.type_document,
        conforme=cert.conforme,
        lignes=lignes,
        html=cert.html_fige,
        empreinte=emp,
        date_emission=maintenant,
        emis_par=utilisateur,
    )
    if historiser:
        nature = "Avis de non-conformité" if cert.type_document == CertificatExtincteur.TypeDocument.AVIS else "Certificat"
        _historiser(cert, utilisateur, f"{nature} {cert.numero_affiche} émis")
    return revision, True


def figer_si_absent(cert):
    """Certificats émis avant l'introduction des révisions : fige leur
    contenu actuel en révision 0 la première fois qu'on les consulte."""
    if cert.statut == CertificatExtincteur.Statut.EMIS and not cert.revisions.exists():
        date_origine = cert.date_emission
        emettre(cert, cert.emis_par, historiser=False)
        if cert.date_emission != date_origine:
            cert.date_emission = date_origine
            cert.html_fige = rendre_html(cert, cert.lignes, parametres_pour(_organisation(cert)), brouillon=False)
            cert.save(update_fields=["date_emission", "html_fige"])
            cert.revisions.filter(revision=cert.revision).update(date_emission=date_origine, html=cert.html_fige)


def html_certificat(cert, apercu=False):
    """HTML à servir : le document figé s'il est émis, sinon un aperçu en
    direct marqué BROUILLON."""
    figer_si_absent(cert)
    if cert.statut == CertificatExtincteur.Statut.EMIS and cert.html_fige and not apercu:
        return cert.html_fige
    parametres = parametres_pour(_organisation(cert))
    return rendre_html(cert, calculer_lignes(cert), parametres, brouillon=True)


def conformite_certificat(cert):
    """Conformité affichée dans les listes : celle du document émis, sinon
    celle calculée en direct."""
    if cert.statut == CertificatExtincteur.Statut.EMIS and cert.conforme is not None:
        return cert.conforme
    return conformite(calculer_lignes(cert))


def url_verification(cert, revision=None):
    rev = cert.revision if revision is None else revision
    return url_verification_jeton(cert.jeton) + (f"?r={rev}" if rev else "")


def etat_verification(cert, revision):
    """État public d'une révision : valide / remplace / en_revision / expire."""
    if revision.revision < cert.revision or revision.remplacee_le:
        return "remplace"
    if cert.statut != CertificatExtincteur.Statut.EMIS:
        return "en_revision"
    echeances = [l["echeance"] for l in revision.lignes if l.get("echeance")]
    if echeances and min(echeances) < date.today().isoformat():
        return "expire"
    return "valide"


# ── Rendu HTML ───────────────────────────────────────────────────────────────

def _qr_svg(url):
    import segno

    return segno.make(url, error="m").svg_inline(scale=2.2, border=0, dark="#0a0b0d")


def url_verification_jeton(jeton):
    base = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    return f"{base}/verifier/{jeton}"


def code_integrite(jeton, *elements):
    """Code court (XXXX-XXXX) signé avec la SECRET_KEY du serveur, calculé
    sur le contenu du certificat. Imprimé sur le document ET affiché par la
    page de vérification : un document retouché (statut, numéro, date…) ne
    correspond plus au code officiel, et un faussaire ne peut pas en
    fabriquer un valide sans la clé du serveur."""
    message = "|".join(str(e) for e in (jeton, *elements)).encode()
    signature = hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest()
    code = base64.b32encode(signature).decode()[:8]
    return f"{code[:4]}-{code[4:]}"


def code_integrite_simple(cert):
    """Certificats incendie / gicleurs (sans révisions figées)."""
    return code_integrite(cert.jeton, cert.numero, cert.conforme, cert.date_emission.date().isoformat())


def bloc_qr(organisation, url, code=""):
    """QR code « Vérifier l'authenticité » + code d'intégrité — commun à
    TOUS les certificats (extincteurs/éclairage/cuisine, incendie, gicleurs).
    Le QR suit le réglage `afficher_qr` ; le code d'intégrité est toujours
    imprimé."""
    langue = organisation.langue
    qr = _qr_svg(url) if parametres_pour(organisation).afficher_qr else ""
    if not qr and not code:
        return ""
    libelle = (
        f"<div style='font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#0a0b0d;'>"
        f"{tc(langue, 'verifier_authenticite')}</div>" if qr else ""
    )
    code_html = (
        f"<div style='font-size:6.5pt;color:#374151;text-align:center;'>{tc(langue, 'code_integrite')}<br>"
        f"<span style='font-family:monospace;font-size:8.5pt;font-weight:800;letter-spacing:1px;color:#0a0b0d;'>{code}</span></div>"
        if code else ""
    )
    return (
        f"<div style='display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;'>"
        f"{qr}{libelle}{code_html}</div>"
    )


def avec_qr(html_signatures, organisation, url, code=""):
    """Place le QR code (et le code d'intégrité) à droite du bloc de
    signatures d'un certificat."""
    qr = bloc_qr(organisation, url, code)
    if not qr:
        return html_signatures
    return f"<div style='display:flex;align-items:flex-end;gap:24px;'><div style='flex:1;'>{html_signatures}</div>{qr}</div>"


def rendre_html(cert, lignes, parametres, brouillon):
    from securiteincendie.emailing import organisation_logo_content

    from .pdf_design import (
        CSS_DOCUMENT, ICONE_BOUCLIER, ICONE_CALENDRIER, ICONE_CUISINE, ICONE_EXTINCTEUR,
        ICONE_PERSONNE, ICONE_PIN, ICONE_SORTIE, case, entete, icone, icone_badge, pied_de_page,
    )
    from .views import _date_fr

    bat = cert.batiment
    organisation = bat.client.organisation
    langue = organisation.langue
    t = lambda cle: tc(langue, cle)

    adresse = f"{bat.numero_civique} {bat.rue}, {bat.ville}"
    if bat.code_postal:
        adresse += f"  {bat.code_postal}"
    date_insp = _date_fr(_date_inspection(cert))
    date_cert = _date_fr(cert.date_emission if not brouillon else timezone.now())
    tech_noms = ", ".join(_techniciens(cert)) or "—"
    est_conforme = conformite(lignes)
    est_avis = type_document(lignes, parametres) == CertificatExtincteur.TypeDocument.AVIS
    numero = cert.numero_affiche if not brouillon else cert.numero

    icones = {"cuisine": ICONE_CUISINE, "extincteurs": ICONE_EXTINCTEUR, "eclairage": ICONE_SORTIE}

    def badge(statut):
        styles = {
            SO: ("#9ca3af", "#f3f4f6", "#e5e7eb", t("so")),
            NON_CONFORME: ("#e11324", "#fee2e2", "#fecaca", t("non_conforme_badge")),
            CONFORME: ("#16a34a", "#dcfce7", "#bbf7d0", t("conforme_badge")),
        }
        couleur, fond, bord, texte = styles[statut]
        return (
            f"<span style='display:inline-block;font-size:7.5pt;font-weight:800;letter-spacing:0.5px;"
            f"color:{couleur};background:{fond};border:1px solid {bord};border-radius:100px;padding:3px 10px;'>{texte}</span>"
        )

    def echeance(iso):
        if not iso:
            return "<span class='muted'>—</span>"
        return _date_fr(date.fromisoformat(iso))

    lignes_html = ""
    for l in lignes:
        note = ""
        if l["ajuste"]:
            note = (
                f"<div style='font-size:7pt;color:#6b7280;font-weight:400;margin-top:2px;'>"
                f"{t('ajuste_par')} {escape(l['ajuste_par'])} — {escape(l['raison'])}</div>"
            )
        elif l["raison"]:
            note = f"<div style='font-size:7pt;color:#9ca3af;font-weight:400;margin-top:2px;'>{escape(l['raison'])}</div>"
        lignes_html += (
            f"<tr><td class='bold'><span style='display:inline-flex;align-items:center;gap:8px;'>"
            f"{icone_badge(icones[l['systeme']])}<span>{escape(l['label'])}{note}</span></span></td>"
            f"<td class='center'>{case(l['statut'] == CONFORME, '#16a34a')}</td>"
            f"<td class='center'>{case(l['statut'] == NON_CONFORME, '#e11324')}</td>"
            f"<td class='center'>{case(l['statut'] == SO, '#9ca3af')}</td>"
            f"<td class='center' style='font-size:8pt;'>{echeance(l['echeance'])}</td>"
            f"<td class='center'>{badge(l['statut'])}</td></tr>"
        )

    deficiences_html = ""
    if est_avis:
        items = "".join(
            f"<li style='margin:2px 0;'><strong>{escape(l['label'])}</strong> — {escape(d)}</li>"
            for l in lignes for d in l["deficiences"]
        )
        deficiences_html = (
            f"<div class='sec-title' style='margin-top:14px;'>{t('deficiences')}</div>"
            f"<ul style='font-size:8.5pt;color:#111;padding-left:18px;margin:4px 0 6px;'>{items}</ul>"
            f"<p style='font-size:8.5pt;font-weight:700;color:#e11324;margin-top:6px;'>{t('avis_suite')}</p>"
        )

    systemes_couverts = " · ".join(escape(l["label"]) for l in lignes if l["present"])
    titre = t("avis_titre") if est_avis else t("certificat_verification")
    bandeau = t("avis_bandeau") if est_avis else t("conformite_bandeau")
    bandeau_fond = "#e11324" if est_avis else "#0a0b0d"
    if est_avis:
        badge_global = ""
    else:
        couleur = "#16a34a" if est_conforme else "#e11324"
        fond = "#dcfce7" if est_conforme else "#fee2e2"
        badge_global = (
            f"<div style='text-align:center;margin-bottom:14px;'><span style='display:inline-block;background:{fond};"
            f"border:1.5px solid {couleur};color:{couleur};font-size:11pt;font-weight:900;letter-spacing:2px;"
            f"padding:5px 22px;border-radius:100px;'>{t('conforme_badge') if est_conforme else t('non_conforme_badge')}</span></div>"
        )

    # Signature : signataire configuré par l'organisation, sinon l'émetteur.
    if parametres.signataire_nom:
        signataire = escape(parametres.signataire_nom)
        titre_signataire = escape(parametres.signataire_titre) or organisation.nom
    else:
        emetteur = cert.emis_par
        signataire = escape(emetteur.get_full_name() or emetteur.username) if emetteur else "—"
        titre_signataire = organisation.nom
    signature_img = (
        f"<img src='{parametres.signature}' alt='' style='max-height:38px;max-width:170px;display:block;margin-bottom:2px;'/>"
        if parametres.signature.startswith("data:image/") else ""
    )

    revision_txt = ""
    if cert.revision and not brouillon:
        revision_txt = f"<div style='font-size:7.5pt;color:#555;'>{t('revision')} {cert.revision} — {t('remplace')} {cert.numero}{'-R' + str(cert.revision - 1) if cert.revision > 1 else ''}</div>"

    normes_html = (
        f"<p style='text-align:center;font-size:7.5pt;color:#374151;margin-top:6px;'>"
        f"<strong>{t('normes_reference')} :</strong> {escape(parametres.normes_citees)}</p>"
        if parametres.normes_citees else ""
    )
    legal_html = (
        f"<p style='font-size:6.8pt;color:#6b7280;line-height:1.4;margin-top:10px;text-align:justify;'>{escape(parametres.texte_legal)}</p>"
        if parametres.texte_legal else ""
    )
    qr_html = "" if brouillon else bloc_qr(
        organisation, url_verification(cert), code_integrite(cert.jeton, cert.numero_affiche, cert.empreinte)
    )
    filigrane = ""
    if brouillon:
        filigrane = (
            f"<div style='position:fixed;top:42%;left:0;right:0;text-align:center;transform:rotate(-24deg);"
            f"font-size:46pt;font-weight:900;color:rgba(225,19,36,0.12);pointer-events:none;z-index:50;'>{t('brouillon_filigrane')}</div>"
        )

    entete_html = entete(
        organisation_logo_content(organisation, 46), organisation.nom,
        f"{t('inspection_certification')} — {systemes_couverts}",
        t("certificat_no"), numero, t("date_inspection"), date_insp, t("technicien_s"), tech_noms,
    )

    return f"""<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="UTF-8">
<title>{titre} {numero}</title>
<style>{CSS_DOCUMENT}</style>
</head>
<body>
{filigrane}
<div class="no-print" style="text-align:right;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
  <button onclick="window.print()" style="background:#0a0b0d;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-weight:700;cursor:pointer;font-size:10pt;">{t("imprimer_pdf")}</button>
</div>
<div style="padding:20px 24px;">
{entete_html}
<div class="title-banner">
  <h2>{titre}</h2>
  <div style="width:140px;height:1.5px;background:linear-gradient(90deg, transparent, #e11324, transparent);margin:6px auto;"></div>
  <p>{systemes_couverts}</p>
</div>
{badge_global}
<div style="text-align:left;margin-bottom:6px;">
  <div class="card-title">{t("client")}</div>
  <div class="card-main" style="font-size:11pt;">{escape(bat.client.nom)}</div>
</div>
<div style="text-align:center;margin-bottom:6px;">
  <div class="card-title">{t("adresse_inspectee")}</div>
</div>
<div class="info-card" style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:18px;">
  <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#f1f5f9;flex-shrink:0;">{icone(ICONE_PIN, 16, '#6b7280')}</span>
  <div class="card-main" style="font-size:20pt; font-weight:900;">{escape(adresse)}</div>
</div>
<div style="background:{bandeau_fond};color:#fff;text-align:center;padding:7px 10px;border-radius:4px;margin-bottom:8px;">
  <span style="display:inline-flex;align-items:center;gap:6px;font-size:8pt;font-weight:800;letter-spacing:0.3px;">{icone(ICONE_BOUCLIER, 13, '#fff')}{bandeau}</span>
</div>
<table class="equip-table">
  <thead><tr><th>{t("equipement")}</th><th class="center">{t("conforme_col")}</th><th class="center">{t("non_conforme_col")}</th><th class="center">{t("so")}</th><th class="center">{t("echeance_col")}</th><th class="center">{t("statut_col")}</th></tr></thead>
  <tbody>{lignes_html}</tbody>
</table>
{deficiences_html}
<p style="text-align:center;font-weight:700;font-size:8.5pt;color:#0a0b0d;margin-top:14px;line-height:1.4;">
  {t("inspection_entretien")}
</p>
{normes_html}
<div style="display:flex;align-items:flex-end;gap:24px;">
  <div class="sig-row" style="flex:1;">
    <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
      <span class="sig-icon">{icone(ICONE_PERSONNE, 14, '#e11324')}</span>
      <div>
        {signature_img}
        <div class="sig-label">{t("superviseur_responsable")}</div>
        <div class="sig-name">{signataire}</div>
        <div style="font-size:8pt;color:#555;">{titre_signataire}</div>
      </div>
    </div>
    <div class="sig-block" style="display:flex;align-items:center;gap:10px;">
      <span class="sig-icon">{icone(ICONE_CALENDRIER, 14, '#e11324')}</span>
      <div>
        <div class="sig-label">{t("date_emission")}</div>
        <div class="sig-name">{date_cert}</div>
        <div style="font-size:8pt;color:#555;">{t("certificat_no")} {numero}</div>
        {revision_txt}
      </div>
    </div>
  </div>
  {qr_html}
</div>
{legal_html}
{pied_de_page(organisation.nom, t("footer_certificat"))}
</div>
</body>
</html>"""
