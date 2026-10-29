"""Génère l'empreinte (hash) du mot de passe maître du super-admin.

Le mot de passe est demandé à l'écran, sans écho, et n'est jamais affiché ni
enregistré. La commande imprime seulement la ligne à copier dans la variable
d'environnement MASTER_PASSWORD_HASH (Railway → service backend → Variables).

    python manage.py definir_mot_de_passe_maitre
"""

from getpass import getpass

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Génère l'empreinte du mot de passe maître à mettre dans MASTER_PASSWORD_HASH."

    def handle(self, *args, **options):
        mot_de_passe = getpass("Nouveau mot de passe maître : ")
        if len(mot_de_passe) < 10:
            raise CommandError("Le mot de passe maître doit faire au moins 10 caractères.")
        if getpass("Confirmer : ") != mot_de_passe:
            raise CommandError("Les deux saisies ne correspondent pas.")

        empreinte = make_password(mot_de_passe)
        self.stdout.write(self.style.SUCCESS("\nEmpreinte générée. Copier cette ligne dans la variable Railway :\n"))
        self.stdout.write(f"MASTER_PASSWORD_HASH={empreinte}\n")
        self.stdout.write(self.style.WARNING(
            "\nLe mot de passe en clair n'est enregistré nulle part. "
            "Après avoir défini la variable, redéployer le service backend."
        ))
