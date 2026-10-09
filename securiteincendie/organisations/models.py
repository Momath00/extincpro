from django.db import models


class Organisation(models.Model):
    """Une compagnie cliente de la plateforme SaaS — regroupe ses propres
    utilisateurs, clients, bâtiments et rapports, isolés des autres
    organisations."""

    class Langue(models.TextChoices):
        FRANCAIS = "fr", "Français"
        ANGLAIS = "en", "Anglais"

    nom = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    adresse = models.CharField(max_length=300, blank=True)
    langue = models.CharField(
        max_length=2, choices=Langue.choices, default=Langue.FRANCAIS,
        help_text="Langue de l'interface et des documents générés (rapports, certificats) pour cette organisation.",
    )
    logo = models.TextField(
        blank=True, default="",
        help_text="Logo de l'organisation, en data URI base64 — affiché sur ses rapports et "
                   "certificats (ExtincPro fournit le logiciel, chaque organisation garde sa marque).",
    )
    est_active = models.BooleanField(
        default=True,
        help_text="Coupe-circuit global — désactive l'accès à la plateforme pour toute l'organisation.",
    )
    date_fin_essai = models.DateField(
        null=True, blank=True,
        help_text="Date de fin de l'essai gratuit — vide une fois l'organisation confirmée comme "
                   "cliente payante. Un courriel d'avis est envoyé automatiquement 7 jours avant.",
    )
    ms_client_id = models.PositiveIntegerField(
        null=True, blank=True, unique=True,
        help_text="Client correspondant dans MS Solution Informatique (facturation). Une fois "
                   "renseigné, les modules, la fin d'essai et l'accès sont pilotés par MS Solution.",
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    @property
    def geree_par_ms_solution(self) -> bool:
        return self.ms_client_id is not None

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


DOMAINES_COURRIEL_GRATUITS = {
    "gmail.com", "hotmail.com", "hotmail.ca", "outlook.com", "live.com", "live.ca", "msn.com",
    "yahoo.com", "yahoo.ca", "icloud.com", "me.com", "aol.com", "videotron.ca", "sympatico.ca",
    "protonmail.com", "proton.me", "gmx.com",
}


class DemandeEssai(models.Model):
    """Une demande de démonstration soumise via le formulaire de contact du
    site vitrine — capturée en plus du courriel de notification, pour que
    le super-admin puisse la suivre et la traiter depuis la plateforme.
    (Le nom date de l'époque de l'essai gratuit, retiré en octobre 2026 :
    trop d'organisations s'en servaient pour copier le logiciel.)

    NEQ, site web et nombre de techniciens servent à vérifier qu'il s'agit
    d'une vraie entreprise d'inspection avant d'accorder une démo."""

    class Statut(models.TextChoices):
        NOUVEAU = "nouveau", "Nouveau"
        CONTACTE = "contacte", "Contacté"
        CONVERTI = "converti", "Converti"
        REJETE = "rejete", "Rejeté"

    nom_complet = models.CharField(max_length=200)
    entreprise = models.CharField(max_length=150, blank=True)
    email = models.EmailField()
    telephone = models.CharField(max_length=30, blank=True)
    neq = models.CharField("NEQ", max_length=20, blank=True, help_text="Numéro d'entreprise du Québec.")
    site_web = models.CharField(max_length=200, blank=True)
    nb_techniciens = models.PositiveIntegerField(null=True, blank=True)
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

    @property
    def courriel_gratuit(self) -> bool:
        """Adresse Gmail, Hotmail, etc. — une vraie entreprise d'inspection
        écrit généralement depuis le domaine de son entreprise."""
        return self.email.rsplit("@", 1)[-1].lower() in DOMAINES_COURRIEL_GRATUITS


class JournalIntegration(models.Model):
    """Trace de chaque ordre reçu de MS Solution (qui pilote la facturation)
    — sert de preuve en cas de litige sur un blocage ou une activation."""

    organisation = models.ForeignKey(
        Organisation, on_delete=models.SET_NULL, null=True, blank=True, related_name="journal_integration",
    )
    organisation_nom = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=50)
    donnees = models.JSONField(default=dict, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date:%Y-%m-%d %H:%M} — {self.action} ({self.organisation_nom})"
