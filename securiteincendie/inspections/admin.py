from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import (
    Batiment,
    Certificat,
    Client,
    Dispositif,
    FicheE1,
    FicheE2,
    FicheLegende,
    HistoriqueRapport,
    Rapport,
)


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "contact_nom", "contact_email", "contact_telephone", "mode_livraison")
    list_filter = ("mode_livraison",)
    search_fields = ("nom", "contact_nom", "contact_email")


@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    list_display = ("adresse_complete", "client", "ville", "direction", "type_application", "proprietaire")
    list_filter = ("client", "ville", "direction", "type_application")
    search_fields = ("numero_civique", "rue", "ville")


class FicheE1Inline(admin.StackedInline):
    model = FicheE1
    extra = 0


class FicheE2Inline(admin.StackedInline):
    model = FicheE2
    extra = 0


class FicheLegendeInline(admin.StackedInline):
    model = FicheLegende
    extra = 0


class DispositifInline(admin.TabularInline):
    model = Dispositif
    extra = 0


class HistoriqueInline(admin.TabularInline):
    model = HistoriqueRapport
    extra = 0
    readonly_fields = ("utilisateur", "description", "date_heure")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ("batiment", "statut", "liste_techniciens", "citoyen", "date_inspection", "date_fermeture")
    list_filter = ("statut", "batiment__client")
    filter_horizontal = ("techniciens",)
    inlines = [FicheE1Inline, FicheE2Inline, FicheLegendeInline, DispositifInline, HistoriqueInline]

    def liste_techniciens(self, obj):
        return ", ".join(t.username for t in obj.techniciens.all()) or "—"
    liste_techniciens.short_description = "Techniciens"

    def save_model(self, request, obj, form, change):
        """Historise la création/modification faite depuis l'admin."""
        nouveau = obj.pk is None
        super().save_model(request, obj, form, change)
        if nouveau:
            obj.historiser(request.user, "Rapport créé (admin)")
        else:
            obj.historiser(request.user, "Rapport modifié (admin)")


@admin.register(Certificat)
class CertificatAdmin(admin.ModelAdmin):
    list_display = ("numero", "rapport", "date_emission", "emis_par")
    readonly_fields = ("numero", "date_emission")


@admin.register(HistoriqueRapport)
class HistoriqueRapportAdmin(admin.ModelAdmin):
    list_display = ("rapport", "utilisateur", "description", "date_heure")
    list_filter = ("date_heure",)
    readonly_fields = ("rapport", "utilisateur", "description", "date_heure")