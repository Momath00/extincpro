from django.contrib import admin

from .models import DemandeEssai, Module, Organisation, OrganisationModule


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display = ("nom", "est_active", "date_creation")
    search_fields = ("nom",)


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ("nom", "code")


admin.site.register(OrganisationModule)


@admin.register(DemandeEssai)
class DemandeEssaiAdmin(admin.ModelAdmin):
    list_display = ("nom_complet", "entreprise", "email", "statut", "date_creation")
    list_filter = ("statut",)
    search_fields = ("nom_complet", "entreprise", "email")
    readonly_fields = ("date_creation", "date_maj")
