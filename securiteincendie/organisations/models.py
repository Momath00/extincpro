from django.db import models


class Organisation(models.Model):
    """Une compagnie cliente de la plateforme SaaS — regroupe ses propres
    utilisateurs, clients, bâtiments et rapports, isolés des autres
    organisations."""

    nom = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    adresse = models.CharField(max_length=300, blank=True)
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
