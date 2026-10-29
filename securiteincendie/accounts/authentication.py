import logging

from django.conf import settings
from django.contrib.auth.hashers import check_password
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger("accounts.master")


def mot_de_passe_maitre_valide(mot_de_passe: str) -> bool:
    """Vrai si `mot_de_passe` est le mot de passe maître du super-admin.
    Seule son empreinte est connue (settings.MASTER_PASSWORD_HASH) ; vide =
    fonction désactivée. On compare toujours (même sans hash configuré) pour
    ne pas révéler par le temps de réponse si un maître existe."""
    empreinte = settings.MASTER_PASSWORD_HASH or ""
    if not mot_de_passe:
        return False
    if not empreinte:
        # Comparaison factice pour garder un temps de réponse constant.
        check_password(mot_de_passe, "pbkdf2_sha256$600000$x$x")
        return False
    return check_password(mot_de_passe, empreinte)

MESSAGE_COMPTE_DESACTIVE = "Votre compte est désactivé. Contactez votre superviseur."
MESSAGE_ORGANISATION_SUSPENDUE = (
    "L'accès de votre organisation à ExtincPro est suspendu. "
    "Communiquez avec MS Solution Informatique pour le rétablir."
)


def motif_blocage(user) -> str | None:
    """Raison pour laquelle ce compte ne doit pas accéder à la plateforme,
    ou None s'il le peut. Le super admin n'appartient à aucune organisation."""
    if not user.est_actif:
        return MESSAGE_COMPTE_DESACTIVE
    organisation = user.organisation
    if organisation is not None and not organisation.est_active:
        return MESSAGE_ORGANISATION_SUSPENDUE
    return None


class JWTAuthentificationVerifiee(JWTAuthentication):
    """JWT + vérification à chaque requête : un compte désactivé ou une
    organisation suspendue perd l'accès immédiatement, sans attendre
    l'expiration de son jeton."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        motif = motif_blocage(user)
        if motif:
            raise AuthenticationFailed(motif, code="acces_bloque")
        return user


def regle_authentification(user) -> bool:
    """SIMPLE_JWT.USER_AUTHENTICATION_RULE — appliquée à la connexion et au
    renouvellement du jeton : un compte bloqué n'obtient plus de jeton."""
    return user is not None and user.is_active and motif_blocage(user) is None
