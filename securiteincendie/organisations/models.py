from django.db import models


class Organisation(models.Model):
    """Une compagnie cliente de la plateforme SaaS — regroupe ses propres
    utilisateurs, clients, bâtiments et rapports, isolés des autres
    organisations."""

    nom = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    adresse = models.CharField(max_length=300, blank=True)
    logo = models.TextField(
        blank=True, default="",
        help_text="Logo de l'organisation, en data URI base64 — affiché sur ses rapports et "
                   "certificats (ExtincPro fournit le logiciel, chaque organisation garde sa marque).",
    )
    est_active = models.BooleanField(
        default=True,
        help_text="Coupe-circuit global — désactive l'accès à la plateforme pour toute l'organisation.",
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    def a_le_module(self, code: str) -> bool:
        return self.organisationmodule_set.filter(module__code=code, actif=True).exists()


class Module(models.Model):
    """Un module fonctionnel de la plateforme, activable par organisation."""

    code = models.SlugField(max_length=50, unique=True)
    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class OrganisationModule(models.Model):
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    module = models.ForeignKey(Module, on_delete=models.CASCADE)
    actif = models.BooleanField(default=False)
    date_activation = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("organisation", "module")]

    def __str__(self):
        return f"{self.organisation.nom} — {self.module.nom} ({'actif' if self.actif else 'inactif'})"


class DemandeEssai(models.Model):
    """Une demande d'essai gratuit soumise via le formulaire de contact du
    site vitrine — capturée en plus du courriel de notification, pour que
    le super-admin puisse la suivre et la traiter depuis la plateforme."""

    class Statut(models.TextChoices):
        NOUVEAU = "nouveau", "Nouveau"
        CONTACTE = "contacte", "Contacté"
        CONVERTI = "converti", "Converti"
        REJETE = "rejete", "Rejeté"

    nom_complet = models.CharField(max_length=200)
    entreprise = models.CharField(max_length=150, blank=True)
    email = models.EmailField()
    telephone = models.CharField(max_length=30, blank=True)
    message = models.TextField()
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.NOUVEAU)
    organisation_creee = models.ForeignKey(
        Organisation, on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Renseigné une fois la demande convertie en organisation cliente.",
    )
    note_interne = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.nom_complet} ({self.entreprise or 'sans entreprise'}) — {self.get_statut_display()}"
