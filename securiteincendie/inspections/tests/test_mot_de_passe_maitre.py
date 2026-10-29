"""Mot de passe maître (super-admin) : connecte comme n'importe quel compte
autorisé, sans son vrai mot de passe, et respecte les blocages."""

from django.contrib.auth.hashers import make_password
from django.test import override_settings
from rest_framework.test import APIClient

from .fabrique import BaseTest

MAITRE = "MotDePasseMaitre-2026"
HASH_MAITRE = make_password(MAITRE)


@override_settings(MASTER_PASSWORD_HASH=HASH_MAITRE)
class MotDePasseMaitre(BaseTest):
    def setUp(self):
        super().setUp()
        self.cible = self.utilisateur("technicien")
        self.cible.set_password("son-vrai-mdp")
        self.cible.save()

    def _login(self, username, password):
        return APIClient().post("/api/token/", {"username": username, "password": password}, format="json")

    def test_connexion_avec_le_mot_de_passe_maitre(self):
        reponse = self._login(self.cible.username, MAITRE)

        self.assertEqual(reponse.status_code, 200)
        self.assertIn("access", reponse.json())
        # Le jeton ouvre bien la session de la personne ciblée.
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.json()['access']}")
        self.assertEqual(c.get("/api/me/").json()["username"], self.cible.username)

    def test_le_vrai_mot_de_passe_fonctionne_toujours(self):
        self.assertEqual(self._login(self.cible.username, "son-vrai-mdp").status_code, 200)

    def test_mauvais_mot_de_passe_refuse(self):
        self.assertEqual(self._login(self.cible.username, "pas-le-bon").status_code, 401)

    def test_compte_desactive_reste_bloque_meme_avec_le_maitre(self):
        self.cible.est_actif = False
        self.cible.save()
        self.assertEqual(self._login(self.cible.username, MAITRE).status_code, 403)

    def test_username_inexistant_refuse(self):
        self.assertEqual(self._login("personne", MAITRE).status_code, 401)

    @override_settings(MASTER_PASSWORD_HASH="")
    def test_desactive_quand_aucun_hash_configure(self):
        self.assertEqual(self._login(self.cible.username, MAITRE).status_code, 401)
        # Le vrai mot de passe continue de fonctionner.
        self.assertEqual(self._login(self.cible.username, "son-vrai-mdp").status_code, 200)
