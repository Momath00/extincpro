from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppelServiceViewSet,
    BatimentViewSet,
    BoyauItemViewSet,
    CertificatsExcelView,
    CertificatsUnifiesView,
    ClientViewSet,
    DispositifViewSet,
    EclairageUrgenceItemViewSet,
    ExtincteurItemViewSet,
    PubmsCallbackAppelServiceView,
    RapportEclairageUrgenceViewSet,
    RapportExtincteurViewSet,
    RapportViewSet,
    SectionDispositifViewSet,
)

router = DefaultRouter()
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"batiments", BatimentViewSet, basename="batiment")
router.register(r"rapports", RapportViewSet, basename="rapport")
router.register(r"sections", SectionDispositifViewSet, basename="section")
router.register(r"dispositifs", DispositifViewSet, basename="dispositif")
router.register(r"rapports-extincteurs", RapportExtincteurViewSet, basename="rapport-extincteur")
router.register(r"extincteurs", ExtincteurItemViewSet, basename="extincteur")
router.register(r"boyaux", BoyauItemViewSet, basename="boyau")
router.register(r"rapports-eclairage-urgence", RapportEclairageUrgenceViewSet, basename="rapport-eclairage-urgence")
router.register(r"eclairages-urgence", EclairageUrgenceItemViewSet, basename="eclairage-urgence")
router.register(r"appels-service", AppelServiceViewSet, basename="appel-service")

# Routes générées, à titre de référence :
# GET/POST    /api/clients/                     → liste / créer un client (superviseur)
# GET/POST    /api/batiments/                    → liste / créer un bâtiment
# GET/POST    /api/rapports/                      → liste / créer un rapport (superviseur)
# GET/PATCH   /api/rapports/{id}/                  → détail / (bloqué si fermé)
# POST        /api/rapports/{id}/fermer/            → fermer + génère le certificat
# GET/PATCH   /api/rapports/{id}/fiche-e1/           → lire/remplir la fiche E1
# GET/PATCH   /api/rapports/{id}/fiche-e2/           → lire/remplir la fiche E2
# GET/POST    /api/rapports/{id}/dispositifs/         → lister/ajouter un dispositif (E3)
# GET         /api/rapports/{id}/historique/           → historique du rapport
# GET         /api/rapports/aujourdhui/                → mes rapports du jour (technicien)
# GET         /api/rapports/stats/                      → compteurs pour le panneau du haut
# GET/PATCH   /api/dispositifs/{id}/                     → corriger une ligne de dispositif

urlpatterns = [
    # Route explicite AVANT le router : évite que le pattern détail du router
    # (appels-service/<pk>/) n'intercepte cette URL en premier.
    path("appels-service/pubms-callback/", PubmsCallbackAppelServiceView.as_view(), name="appel_service_pubms_callback"),
    path("certificats/", CertificatsUnifiesView.as_view(), name="certificats_unifies"),
    path("certificats/excel/", CertificatsExcelView.as_view(), name="certificats_excel"),
    path("", include(router.urls)),
]