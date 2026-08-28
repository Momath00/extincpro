from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DemandeEssaiViewSet, OrganisationViewSet

router = DefaultRouter()
router.register(r"organisations", OrganisationViewSet, basename="organisation")
router.register(r"demandes-essai", DemandeEssaiViewSet, basename="demande-essai")

urlpatterns = [
    path("", include(router.urls)),
]
