from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthCheckView
from apps.greenhouse.views import LegacyGreenhouseDashboardView, V1GreenhouseDashboardView


urlpatterns = [
    path(
        "api/greenhouse/dashboard",
        LegacyGreenhouseDashboardView.as_view(),
        name="api-legacy-greenhouse-dashboard",
    ),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-v1-health"),
    path(
        "api/v1/greenhouse/dashboard",
        V1GreenhouseDashboardView.as_view(),
        name="api-v1-greenhouse-dashboard",
    ),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="api-v1-schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="api-v1-schema"),
        name="api-v1-docs",
    ),
]
