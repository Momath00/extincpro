"""Dossier du bâtiment — preuves conservées en cas de litige.

Un bâtiment a des **cycles d'inspection** (une période d'environ un an à
partir de la première inspection). Chaque cycle regroupe les rapports de tous
les modules, le document exact archivé à chaque fermeture, chaque envoi au
client (avec les fichiers réellement envoyés, factures comprises) et un
journal. Un cycle fermé est verrouillé : on consulte, on ne modifie plus.

La logique (ouverture des cycles, archivage, envois, export) est dans
`dossier.py` ; ce module ne contient que les tables.

Les fichiers sont stockés en base (`FichierArchive`), comme les photos
d'anomalies : l'hébergement n'a pas de disque persistant. Tout passe par
`FichierArchive`, ce qui permettra de déplacer le contenu vers un stockage
objet (bucket) sans toucher au reste.
"""

import hashlib
import zlib

from django.conf import settings
from django.db import models
from django.utils import timezone


class FichierArchive(models.Model):
    """Contenu d'un fichier archivé + son empreinte SHA-256 (calculée sur le
    contenu d'origine, avant compression) — la preuve qu'il n'a pas changé."""

    nom = models.CharField(max_length=255)
    type_mime = models.CharField(max_length=100, default="application/octet-stream")
    taille = models.PositiveIntegerField(default=0, help_text="Taille d'origine, en octets.")
    empreinte = models.CharField(max_length=64, db_index=True)
    compresse = models.BooleanField(default=False)
    contenu = models.BinaryField()
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    @classmethod
    def depuis_octets(cls, nom: str, contenu: bytes, type_mime: str = "application/octet-stream") -> "FichierArchive":
        texte = type_mime.startswith("text/") or type_mime in ("application/json",)
        stocke = zlib.compress(contenu, 6) if texte else contenu
        return cls.objects.create(
            nom=nom[:255],
            type_mime=type_mime[:100],
            taille=len(contenu),
            empreinte=hashlib.sha256(contenu).hexdigest(),
            compresse=texte,
            contenu=stocke,
        )

    def lire(self) -> bytes:
        brut = bytes(self.contenu)
        return zlib.decompress(brut) if self.compresse else brut

    def __str__(self):
        return f"{self.nom} ({self.empreinte[:12]}…)"


class CycleInspection(models.Model):
    """Une période d'inspection d'un bâtiment (environ 12 mois à partir de
    `date_debut`), qui regroupe tous les rapports de cette période."""

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    DUREE_JOURS = 365

    batiment = models.ForeignKey("Batiment", on_delete=models.CASCADE, related_name="cycles")
    annee = models.PositiveIntegerField(help_text="Année de début — sert au libellé « Cycle 2026 ».")
    date_debut = models.DateField()
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    ferme_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cycles_fermes"
    )
    note_fermeture = models.CharField(max_length=300, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_debut", "-id"]

    @property
    def libelle(self) -> str:
        meme_annee = CycleInspection.objects.filter(batiment_id=self.batiment_id, annee=self.annee)
        if meme_annee.count() > 1:
            rang = list(meme_annee.order_by("date_debut", "id").values_list("id", flat=True)).index(self.id) + 1
            return f"Cycle {self.annee} ({rang})"
        return f"Cycle {self.annee}"

    @property
    def date_fin_prevue(self):
        from datetime import timedelta

        return self.date_debut + timedelta(days=self.DUREE_JOURS - 1)

    @property
    def est_ferme(self) -> bool:
        return self.statut == self.Statut.FERME

    def __str__(self):
        return f"{self.libelle} — {self.batiment}"


class ArchiveDocument(models.Model):
    """Document figé : la copie exacte d'un rapport ou d'un certificat au
    moment de sa fermeture/émission. Jamais modifié ni supprimé : rouvrir un
    rapport puis le refermer crée une nouvelle version (v2, v3…)."""

    class TypeDocument(models.TextChoices):
        RAPPORT = "rapport", "Rapport"
        CERTIFICAT = "certificat", "Certificat"
        AVIS = "avis", "Avis de non-conformité"

    class Module(models.TextChoices):
        INCENDIE = "incendie", "Système d'alarme incendie"
        EXTINCTEUR = "extincteur", "Extincteurs portatifs"
        ECLAIRAGE = "eclairage", "Éclairage d'urgence"
        CUISINE = "cuisine", "Système de cuisine"
        GICLEUR = "gicleur", "Gicleurs"

    batiment = models.ForeignKey("Batiment", on_delete=models.CASCADE, related_name="archives")
    cycle = models.ForeignKey(CycleInspection, on_delete=models.SET_NULL, null=True, blank=True, related_name="archives")
    module = models.CharField(max_length=12, choices=Module.choices)
    rapport_id = models.PositiveIntegerField(help_text="Identifiant du rapport du module (conservé même si le rapport est supprimé).")
    type_document = models.CharField(max_length=12, choices=TypeDocument.choices, default=TypeDocument.RAPPORT)
    titre = models.CharField(max_length=255)
    numero = models.CharField(max_length=40, blank=True, help_text="Numéro du certificat, s'il y a lieu.")
    version = models.PositiveIntegerField(default=1)
    fichier = models.ForeignKey(FichierArchive, on_delete=models.PROTECT, related_name="archives")
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_creation = models.DateTimeField(default=timezone.now)
    remplacee_le = models.DateTimeField(null=True, blank=True, help_text="Date à laquelle une version plus récente l'a remplacée.")

    class Meta:
        ordering = ["module", "type_document", "-version"]

    @property
    def est_courante(self) -> bool:
        return self.remplacee_le is None

    def __str__(self):
        return f"{self.titre} v{self.version}"


class Envoi(models.Model):
    """Un courriel parti vers le client : à qui, quand, par qui, avec le
    texte et la copie exacte des fichiers joints — la preuve d'envoi."""

    class Type(models.TextChoices):
        DOCUMENTS = "documents", "Rapports et certificats"
        NOTIFICATION = "notification", "Avis de documents disponibles"
        RENVOI = "renvoi", "Renvoi d'un document"
        REPARATIONS = "reparations", "Avis de réparations requises"
        RAPPEL = "rappel", "Rappel d'inspection"
        PLANIFICATION = "planification", "Planification d'une visite"
        MANUEL = "manuel", "Envoi depuis le dossier"

    class Mode(models.TextChoices):
        DIRECT = "direct", "Courriel avec documents joints"
        PLATEFORME = "plateforme", "Espace client"

    class Statut(models.TextChoices):
        ENVOYE = "envoye", "Envoyé"
        ECHEC = "echec", "Échec"

    batiment = models.ForeignKey("Batiment", on_delete=models.CASCADE, related_name="envois")
    cycle = models.ForeignKey(CycleInspection, on_delete=models.SET_NULL, null=True, blank=True, related_name="envois")
    type_envoi = models.CharField(max_length=15, choices=Type.choices)
    mode = models.CharField(max_length=12, choices=Mode.choices, default=Mode.DIRECT)
    destinataire = models.CharField(max_length=255)
    destinataire_nom = models.CharField(max_length=150, blank=True)
    sujet = models.CharField(max_length=300)
    corps_html = models.TextField(blank=True)
    message = models.TextField(blank=True, help_text="Message ajouté par l'expéditeur, s'il y a lieu.")
    rapports = models.JSONField(default=list, blank=True, help_text="[{module, id, libelle}] concernés par l'envoi.")
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.ENVOYE)
    reference = models.CharField(max_length=120, blank=True, help_text="Identifiant du message chez le fournisseur de courriel.")
    erreur = models.CharField(max_length=300, blank=True)
    envoye_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="envois")
    date_envoi = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-date_envoi", "-id"]

    def __str__(self):
        return f"{self.get_type_envoi_display()} → {self.destinataire} ({self.date_envoi:%Y-%m-%d})"


class EnvoiPieceJointe(models.Model):
    """Copie exacte d'un fichier joint à un envoi."""

    class Origine(models.TextChoices):
        DOCUMENT = "document", "Document généré (rapport, certificat)"
        AJOUT = "ajout", "Fichier ajouté par l'expéditeur (facture…)"

    envoi = models.ForeignKey(Envoi, on_delete=models.CASCADE, related_name="pieces_jointes")
    fichier = models.ForeignKey(FichierArchive, on_delete=models.PROTECT, related_name="pieces_jointes")
    origine = models.CharField(max_length=10, choices=Origine.choices, default=Origine.DOCUMENT)

    class Meta:
        ordering = ["id"]


class EvenementCycle(models.Model):
    """Journal du cycle : ouverture, fermeture, réouverture (avec motif),
    archivage, envoi, export… Les historiques propres à chaque rapport
    restent dans leurs tables et sont fusionnés à l'affichage."""

    cycle = models.ForeignKey(CycleInspection, on_delete=models.CASCADE, related_name="evenements")
    type_evenement = models.CharField(max_length=30)
    description = models.CharField(max_length=400)
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    date_heure = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-date_heure", "-id"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"
