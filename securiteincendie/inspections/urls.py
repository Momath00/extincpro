from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BatimentViewSet,
    ClientViewSet,
    ExtincteurItemViewSet,
    RapportExtincteurViewSet,
)

router = DefaultRouter()
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"batiments", BatimentViewSet, basename="batiment")
router.register(r"rapports-extincteurs", RapportExtincteurViewSet, basename="rapport-extincteur")
router.register(r"extincteurs", ExtincteurItemViewSet, basename="extincteur")

# Routes générées, à titre de référence :
# GET/POST    /api/clients/                              → liste / créer un client (superviseur)
# GET/POST    /api/batiments/                             → liste / créer un bâtiment
# GET/POST    /api/rapports-extincteurs/                  → liste / créer un rapport (superviseur)
# GET/PATCH   /api/rapports-extincteurs/{id}/              → détail / (bloqué si fermé)
# PATCH       /api/rapports-extincteurs/{id}/reassigner/    → réassigner bâtiment/techniciens/citoyen
# POST        /api/rapports-extincteurs/{id}/fermer/         → fermer + génère le certificat
# POST        /api/rapports-extincteurs/{id}/rouvrir/          → rouvrir un rapport fermé
# POST        /api/rapports-extincteurs/{id}/envoyer-certificat/ → envoyer le certificat au citoyen
# GET/POST    /api/rapports-extincteurs/{id}/extincteurs/         → lister/ajouter un extincteur
# GET         /api/rapports-extincteurs/{id}/historique/            → historique du rapport
# GET         /api/rapports-extincteurs/{id}/certificat-pdf/          → certificat imprimable (HTML)
# GET         /api/rapports-extincteurs/{id}/telecharger/              → rapport imprimable (HTML)
# GET/PATCH   /api/extincteurs/{id}/                                    → corriger une ligne d'extincteur

urlpatterns = [
    path("", include(router.urls)),
]
