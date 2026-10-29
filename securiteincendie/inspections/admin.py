from django.contrib import admin

from .models import (
    Batiment,
    BoyauItem,
    Certificat,
    CertificatExtincteur,
    CertificatGicleur,
    Client,
    Dispositif,
    EclairageUrgenceItem,
    ExtincteurItem,
    FicheE1,
    FicheE2,
    FicheLegende,
    HistoriqueRapport,
    HistoriqueRapportCuisine,
    HistoriqueRapportEclairageUrgence,
    HistoriqueRapportExtincteur,
    HistoriqueRapportGicleur,
    HotteCuisine,
    ParametresCertificat,
    Rapport,
    RapportCuisine,
    RapportEclairageUrgence,
    RapportExtincteur,
    RapportGicleur,
    RevisionCertificat,
    SectionDispositif,
    SousRapportGicleur,
)


# ── Outils communs ──────────────────────────────────────────────────────────

class LectureSeuleInline(admin.TabularInline):
    """Liste de liens vers des objets modifiables sur leur propre page."""

    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


def _historique_inline(modele):
    class HistoriqueInline(admin.TabularInline):
        model = modele
        extra = 0
        readonly_fields = ("utilisateur", "description", "date_heure")
        can_delete = False

        def has_add_permission(self, request, obj=None):
            return False

    HistoriqueInline.__name__ = f"{modele.__name__}Inline"
    return HistoriqueInline


class RapportAdminBase(admin.ModelAdmin):
    """Tous les rapports : recherche par adresse/client, filtre par
    organisation, et chaque modification faite ici est historisée."""

    list_display = ("batiment", "organisation", "statut", "liste_techniciens", "date_inspection", "date_fermeture")
    list_filter = ("statut", "batiment__client__organisation")
    search_fields = ("batiment__numero_civique", "batiment__rue", "batiment__ville", "batiment__client__nom")
    autocomplete_fields = ("batiment",)
    raw_id_fields = ("cycle",)
    filter_horizontal = ("techniciens",)
    date_hierarchy = "date_inspection"
    list_select_related = ("batiment", "batiment__client", "batiment__client__organisation")

    @admin.display(description="Organisation", ordering="batiment__client__organisation__nom")
    def organisation(self, obj):
        return obj.batiment.client.organisation

    @admin.display(description="Techniciens")
    def liste_techniciens(self, obj):
        return ", ".join(t.username for t in obj.techniciens.all()) or "—"

    def save_model(self, request, obj, form, change):
        nouveau = obj.pk is None
        super().save_model(request, obj, form, change)
        obj.historiser(request.user, "Rapport créé (admin)" if nouveau else "Rapport modifié (admin)")


# ── Clients et bâtiments ────────────────────────────────────────────────────

class BatimentDuClientInline(LectureSeuleInline):
    model = Batiment
    fields = ("numero_civique", "rue", "ville")
    readonly_fields = fields


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("nom", "organisation", "contact_nom", "contact_email", "contact_telephone", "mode_livraison")
    list_filter = ("organisation", "mode_livraison")
    search_fields = ("nom", "contact_nom", "contact_email")
    inlines = [BatimentDuClientInline]


def _rapports_du_batiment(modele, titre):
    class RapportsInline(LectureSeuleInline):
        model = modele
        fields = ("date_inspection", "statut", "date_fermeture")
        readonly_fields = fields
        verbose_name_plural = titre
        ordering = ("-date_inspection",)

    RapportsInline.__name__ = f"{modele.__name__}DuBatimentInline"
    return RapportsInline


@admin.register(Batiment)
class BatimentAdmin(admin.ModelAdmin):
    """Fiche d'un bâtiment : tous ses rapports, chacun avec son lien de
    modification (en cas de problème à corriger)."""

    list_display = ("adresse_complete", "client", "organisation", "ville", "direction", "type_application", "proprietaire")
    list_filter = ("client__organisation", "ville", "direction", "type_application")
    search_fields = ("numero_civique", "rue", "ville", "client__nom")
    autocomplete_fields = ("client",)
    inlines = [
        _rapports_du_batiment(Rapport, "Rapports alarme incendie (S-536)"),
        _rapports_du_batiment(RapportExtincteur, "Rapports extincteurs"),
        _rapports_du_batiment(RapportEclairageUrgence, "Rapports éclairage d'urgence"),
        _rapports_du_batiment(RapportCuisine, "Rapports cuisine"),
        _rapports_du_batiment(RapportGicleur, "Rapports gicleurs"),
    ]

    @admin.display(description="Organisation", ordering="client__organisation__nom")
    def organisation(self, obj):
        return obj.client.organisation


# ── Alarme incendie (S-536) ─────────────────────────────────────────────────

class FicheE1Inline(admin.StackedInline):
    model = FicheE1
    extra = 0


class FicheE2Inline(admin.StackedInline):
    model = FicheE2
    extra = 0


class FicheLegendeInline(admin.StackedInline):
    model = FicheLegende
    extra = 0


class SectionDispositifInline(admin.TabularInline):
    model = SectionDispositif
    extra = 0


class DispositifInline(admin.TabularInline):
    model = Dispositif
    extra = 0


@admin.register(Rapport)
class RapportAdmin(RapportAdminBase):
    list_display = ("batiment", "organisation", "statut", "liste_techniciens", "citoyen", "date_inspection", "date_fermeture")
    raw_id_fields = ("cycle", "citoyen")
    inlines = [
        FicheE1Inline, FicheE2Inline, FicheLegendeInline, SectionDispositifInline, DispositifInline,
        _historique_inline(HistoriqueRapport),
    ]


@admin.register(Certificat)
class CertificatAdmin(admin.ModelAdmin):
    list_display = ("numero", "rapport", "date_emission", "emis_par")
    search_fields = ("numero", "rapport__batiment__rue", "rapport__batiment__numero_civique")
    readonly_fields = ("numero", "date_emission", "jeton")
    raw_id_fields = ("rapport",)


@admin.register(HistoriqueRapport)
class HistoriqueRapportAdmin(admin.ModelAdmin):
    list_display = ("rapport", "utilisateur", "description", "date_heure")
    list_filter = ("date_heure",)
    readonly_fields = ("rapport", "utilisateur", "description", "date_heure")


# ── Extincteurs, éclairage d'urgence, cuisine ───────────────────────────────

class ExtincteurItemInline(admin.TabularInline):
    model = ExtincteurItem
    extra = 0


class BoyauItemInline(admin.TabularInline):
    model = BoyauItem
    extra = 0


@admin.register(RapportExtincteur)
class RapportExtincteurAdmin(RapportAdminBase):
    raw_id_fields = ("cycle", "citoyen", "rapport_alarme", "rapport_precedent")
    inlines = [ExtincteurItemInline, BoyauItemInline, _historique_inline(HistoriqueRapportExtincteur)]


class EclairageUrgenceItemInline(admin.TabularInline):
    model = EclairageUrgenceItem
    extra = 0


@admin.register(RapportEclairageUrgence)
class RapportEclairageUrgenceAdmin(RapportAdminBase):
    raw_id_fields = ("cycle", "rapport_extincteur")
    inlines = [EclairageUrgenceItemInline, _historique_inline(HistoriqueRapportEclairageUrgence)]


class HotteCuisineInline(admin.StackedInline):
    model = HotteCuisine
    extra = 0


@admin.register(RapportCuisine)
class RapportCuisineAdmin(RapportAdminBase):
    raw_id_fields = ("cycle", "rapport_extincteur")
    inlines = [HotteCuisineInline, _historique_inline(HistoriqueRapportCuisine)]


class RevisionCertificatInline(admin.TabularInline):
    model = RevisionCertificat
    extra = 0
    fields = ("revision", "numero_affiche", "type_document", "conforme", "date_emission", "emis_par", "remplacee_le")
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(CertificatExtincteur)
class CertificatExtincteurAdmin(admin.ModelAdmin):
    """Certificats extincteurs / éclairage / cuisine (par visite ou système)."""

    list_display = ("numero", "batiment", "statut", "type_document", "revision", "conforme", "date_emission")
    list_filter = ("statut", "type_document", "batiment__client__organisation")
    search_fields = ("numero", "batiment__numero_civique", "batiment__rue", "batiment__client__nom")
    # Contenu figé et preuve d'authenticité : ne se modifient qu'en réémettant.
    readonly_fields = ("numero", "date_emission", "revision", "html_fige", "empreinte", "jeton", "lignes")
    raw_id_fields = ("rapport", "rapport_cuisine", "rapport_eclairage", "batiment", "emis_par")
    inlines = [RevisionCertificatInline]


@admin.register(ParametresCertificat)
class ParametresCertificatAdmin(admin.ModelAdmin):
    list_display = ("organisation",)


# ── Gicleurs (NFPA 25) ──────────────────────────────────────────────────────

class SousRapportGicleurInline(admin.StackedInline):
    model = SousRapportGicleur
    extra = 0


@admin.register(RapportGicleur)
class RapportGicleurAdmin(RapportAdminBase):
    raw_id_fields = ("cycle", "citoyen")
    inlines = [SousRapportGicleurInline, _historique_inline(HistoriqueRapportGicleur)]


@admin.register(CertificatGicleur)
class CertificatGicleurAdmin(admin.ModelAdmin):
    list_display = ("numero", "rapport", "date_emission", "emis_par")
    search_fields = ("numero", "rapport__batiment__rue", "rapport__batiment__numero_civique")
    readonly_fields = ("numero", "date_emission", "jeton")
    raw_id_fields = ("rapport",)
