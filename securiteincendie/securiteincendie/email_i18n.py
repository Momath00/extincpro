"""Petit dictionnaire FR/EN pour les fragments traduisibles des courriels
automatiques (securiteincendie/emailing.py et inspections/emailing.py).

Miroir, côté backend, du système `frontend/lib/i18n.tsx` : la langue vient
de `organisation.langue` (le destinataire appartient toujours à une
organisation précise pour ces courriels), pas d'un choix utilisateur."""

EMAIL_DICT: dict[str, dict[str, str]] = {
    # ── Réparations requises (citoyen) ──────────────────────────────────
    "reparations_sujet": {
        "fr": "Réparations requises avant certificat — ExtincPro",
        "en": "Repairs required before certificate — ExtincPro",
    },
    "reparations_titre": {"fr": "Réparations requises", "en": "Repairs required"},
    "reparations_intro": {
        "fr": "l'inspection annuelle de votre réseau avertisseur d'incendie au",
        "en": "the annual inspection of your fire alarm system at",
    },
    "reparations_intro_suite": {
        "fr": "est terminée. Des réparations sont requises avant que votre certificat de conformité puisse être émis.",
        "en": "is complete. Repairs are required before your compliance certificate can be issued.",
    },
    "col_dispositif_email": {"fr": "Dispositif", "en": "Device"},
    "col_localisation_email": {"fr": "Localisation", "en": "Location"},
    "reparations_note": {
        "fr": "Votre certificat sera automatiquement marqué <strong>conforme</strong> dès que ces éléments auront été corrigés par votre technicien.",
        "en": "Your certificate will automatically be marked <strong>compliant</strong> once these items have been corrected by your technician.",
    },
    "voir_rapport_btn": {"fr": "Voir le rapport", "en": "View the report"},

    # ── Certificat disponible (rapport incendie) ────────────────────────
    "certificat_dispo_sujet": {
        "fr": "Votre rapport et certificat sont disponibles — ExtincPro",
        "en": "Your report and certificate are available — ExtincPro",
    },
    "rapport_dispo_titre": {"fr": "Votre rapport est disponible", "en": "Your report is available"},
    "rapport_dispo_intro": {
        "fr": "le rapport d'inspection annuelle de votre réseau avertisseur d'incendie au",
        "en": "the annual inspection report for your fire alarm system at",
    },
    "rapport_dispo_intro_suite": {
        "fr": "ainsi que son certificat sont maintenant disponibles sur la plateforme.",
        "en": "and its certificate are now available on the platform.",
    },
    "certificat_label_email": {"fr": "Certificat", "en": "Certificate"},
    "conforme_email": {"fr": "Conforme", "en": "Compliant"},
    "non_conforme_email": {"fr": "Non conforme", "en": "Non-compliant"},
    "voir_mon_rapport_btn": {"fr": "Voir mon rapport", "en": "View my report"},

    # ── Certificat extincteur disponible ────────────────────────────────
    "certificat_extincteur_sujet": {
        "fr": "Votre certificat d'extincteurs est disponible — ExtincPro",
        "en": "Your fire extinguisher certificate is available — ExtincPro",
    },
    "certificat_dispo_titre": {"fr": "Votre certificat est disponible", "en": "Your certificate is available"},
    "certificat_extincteur_intro": {
        "fr": "le rapport de vérification des extincteurs portatifs au",
        "en": "the portable fire extinguisher inspection report at",
    },

    # ── Invitation membre d'équipe ───────────────────────────────────────
    "invitation_sujet": {"fr": "Invitation — ExtincPro", "en": "Invitation — ExtincPro"},
    "bienvenue_titre": {"fr": "Bienvenue !", "en": "Welcome!"},
    "invitation_intro": {
        "fr": "vous avez été invité(e) en tant que",
        "en": "you have been invited as a",
    },
    "invitation_intro_suite": {
        "fr": "sur la plateforme <strong style=\"color:#0a0b0d;\">ExtincPro</strong>.",
        "en": "on the <strong style=\"color:#0a0b0d;\">ExtincPro</strong> platform.",
    },
    "nom_utilisateur_email": {"fr": "Nom d'utilisateur", "en": "Username"},
    "mdp_temporaire_email": {"fr": "Mot de passe temporaire", "en": "Temporary password"},
    "mdp_temporaire_note": {
        "fr": "Ce mot de passe est <strong>temporaire</strong>. Vous serez invité(e) à le modifier dès votre première connexion.",
        "en": "This password is <strong>temporary</strong>. You will be asked to change it on your first login.",
    },
    "se_connecter_portail_btn": {"fr": "Se connecter au portail", "en": "Log in to the portal"},

    # ── Bienvenue superviseur (nouvelle organisation) ───────────────────
    "bienvenue_org_sujet": {"fr": "Bienvenue sur ExtincPro", "en": "Welcome to ExtincPro"},
    "bienvenue_org_titre": {"fr": "Bienvenue sur ExtincPro !", "en": "Welcome to ExtincPro!"},
    "bienvenue_org_intro": {
        "fr": "votre organisation",
        "en": "your organisation",
    },
    "bienvenue_org_intro_suite": {
        "fr": "a été créée sur la plateforme. Vous êtes désormais <strong style=\"color:#e11324;\">Superviseur</strong> — vous pouvez inviter votre équipe (techniciens, citoyens) une fois connecté(e).",
        "en": "has been created on the platform. You are now a <strong style=\"color:#e11324;\">Supervisor</strong> — you can invite your team (technicians, citizens) once logged in.",
    },

    # ── Mot de passe oublié (code) ───────────────────────────────────────
    "reinit_sujet": {
        "fr": "Réinitialisation de mot de passe — ExtincPro",
        "en": "Password reset — ExtincPro",
    },
    "reinit_titre": {"fr": "Réinitialisation de mot de passe", "en": "Password reset"},
    "reinit_intro": {
        "fr": "voici votre code de réinitialisation de mot de passe.",
        "en": "here is your password reset code.",
    },
    "code_verification_label": {"fr": "Code de vérification", "en": "Verification code"},
    "code_expire_prefix": {"fr": "Ce code expire dans", "en": "This code expires in"},
    "code_expire_suffix": {"fr": "minutes.", "en": "minutes."},
    "reinit_ignorer": {
        "fr": "Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.",
        "en": "If you did not request this reset, please ignore this message.",
    },

    # ── Générique ────────────────────────────────────────────────────────
    "bonjour": {"fr": "Bonjour", "en": "Hello"},
}


def et(key: str, langue: str = "fr") -> str:
    """Traduit une clé de courriel — repli sur le français puis sur la clé
    brute si absente, jamais d'exception."""
    entree = EMAIL_DICT.get(key)
    if not entree:
        return key
    return entree.get(langue) or entree.get("fr", key)


def langue_utilisateur(utilisateur) -> str:
    """Langue de l'organisation d'un utilisateur, 'fr' par défaut (super
    admin sans organisation, ou organisation sans langue définie)."""
    org = getattr(utilisateur, "organisation", None)
    return getattr(org, "langue", "fr") or "fr"


ROLE_LABELS: dict[str, dict[str, str]] = {
    "technicien": {"fr": "Technicien", "en": "Technician"},
    "superviseur": {"fr": "Superviseur", "en": "Supervisor"},
    "citoyen": {"fr": "Citoyen", "en": "Citizen"},
    "super_admin": {"fr": "Super admin", "en": "Super admin"},
}


def role_label(role_code: str, langue: str = "fr") -> str:
    """Libellé de rôle traduit pour les courriels — indépendant de
    `get_role_display()` (qui reste en français, static Django choices)."""
    entree = ROLE_LABELS.get(role_code)
    if not entree:
        return role_code
    return entree.get(langue) or entree.get("fr", role_code)
