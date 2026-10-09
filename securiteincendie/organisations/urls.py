from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import integration
from .views import DemandeEssaiViewSet, OrganisationViewSet

router = DefaultRouter()
router.register(r"organisations", OrganisationViewSet, basename="organisation")
router.register(r"demandes-essai", DemandeEssaiViewSet, basename="demande-essai")

urlpatterns = [
    path("", include(router.urls)),
    # Intégration avec MS Solution Informatique (facturation) — voir integration.py
    path("integration/ms-solution/modules/", integration.ModulesDisponiblesView.as_view()),
    path("integration/ms-solution/organisations/", integration.OrganisationsIntegrationView.as_view()),
    path("integration/ms-solution/organisations/<int:pk>/", integration.OrganisationIntegrationView.as_view()),
    path("integration/ms-solution/organisations/<int:pk>/lier/", integration.LierClientView.as_view()),
    path("integration/ms-solution/organisations/<int:pk>/modules/", integration.ModulesIntegrationView.as_view()),
    path("integration/ms-solution/organisations/<int:pk>/acces/", integration.AccesIntegrationView.as_view()),
    path("integration/ms-solution/organisations/<int:pk>/essai/", integration.EssaiIntegrationView.as_view()),
]
