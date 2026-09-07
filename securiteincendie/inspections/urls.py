from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppelServiceViewSet,
    BatimentViewSet,
    BoyauItemViewSet,
    CalendrierView,
    CertificatsCompteursView,
    CertificatsExcelView,
    CertificatsUnifiesView,
    ClientViewSet,
    CompteurRappelsView,
    DispositifViewSet,
    EclairageUrgenceItemViewSet,
    ExtincteurItemViewSet,
    HotteCuisineViewSet,
    PubmsCallbackAppelServiceView,
    RappelsEnRetardView,
    RapportCuisineViewSet,
    RapportEclairageUrgenceViewSet,
    RapportExtincteurViewSet,
    RapportViewSet,
    ReassignerCalendrierView,
    SectionDispositifViewSet,
    TechnicienAujourdhuiView,
    TechnicienProchainesVisitesView,
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
router.register(r"rapports-cuisine", RapportCuisineViewSet, basename="rapport-cuisine")
router.register(r"hottes-cuisine", HotteCuisineViewSet, basename="hotte-cuisine")
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
    path("certificats/compteurs/", CertificatsCompteursView.as_view(), name="certificats_compteurs"),
    path("calendrier/", CalendrierView.as_view(), name="calendrier"),
    path("calendrier/rappels-compteur/", CompteurRappelsView.as_view(), name="calendrier_rappels_compteur"),
    path("calendrier/rappels-en-retard/", RappelsEnRetardView.as_view(), name="calendrier_rappels_en_retard"),
    path("calendrier/<str:type_rapport>/<int:pk>/reassigner/", ReassignerCalendrierView.as_view(), name="calendrier_reassigner"),
    path("technicien/aujourdhui/", TechnicienAujourdhuiView.as_view(), name="technicien_aujourdhui"),
    path("technicien/prochaines-visites/", TechnicienProchainesVisitesView.as_view(), name="technicien_prochaines_visites"),
    path("certificats/excel/", CertificatsExcelView.as_view(), name="certificats_excel"),
    path("", include(router.urls)),
]