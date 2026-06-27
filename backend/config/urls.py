from django.contrib import admin
from django.urls import path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import FrontendIndexView, HealthCheckView, frontend_asset_view
from apps.ai_advisory.views import (
    LegacyAgriChatView,
    LegacyCropDiagnosisView,
    V1AgriChatView,
    V1CropDiagnosisView,
)
from apps.greenhouse.views import LegacyGreenhouseDashboardView, V1GreenhouseDashboardView
from apps.weather.views import LegacyWeatherAdviceView, V1WeatherAdviceView


urlpatterns = [
    path("", FrontendIndexView.as_view(), name="frontend-index"),
    path("admin/", admin.site.urls),
    path(
        "api/greenhouse/dashboard",
        LegacyGreenhouseDashboardView.as_view(),
        name="api-legacy-greenhouse-dashboard",
    ),
    path(
        "api/weather/greenhouse-advice",
        LegacyWeatherAdviceView.as_view(),
        name="api-legacy-weather-greenhouse-advice",
    ),
    path(
        "api/ai/crop-diagnosis",
        LegacyCropDiagnosisView.as_view(),
        name="api-legacy-ai-crop-diagnosis",
    ),
    path(
        "api/ai/agri-chat",
        LegacyAgriChatView.as_view(),
        name="api-legacy-ai-agri-chat",
    ),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-v1-health"),
    path(
        "api/v1/greenhouse/dashboard",
        V1GreenhouseDashboardView.as_view(),
        name="api-v1-greenhouse-dashboard",
    ),
    path(
        "api/v1/weather/greenhouse-advice",
        V1WeatherAdviceView.as_view(),
        name="api-v1-weather-greenhouse-advice",
    ),
    path(
        "api/v1/ai/crop-diagnosis",
        V1CropDiagnosisView.as_view(),
        name="api-v1-ai-crop-diagnosis",
    ),
    path(
        "api/v1/ai/agri-chat",
        V1AgriChatView.as_view(),
        name="api-v1-ai-agri-chat",
    ),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="api-v1-schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="api-v1-schema"),
        name="api-v1-docs",
    ),
    re_path(
        r"^(?P<path>(assets|data|images)/.*|favicon\.(ico|png|svg)|icons\.svg|logo-(lockup|mark)\.(png|svg)|smart-agriculture-logo\.ico)$",
        frontend_asset_view,
        name="frontend-asset",
    ),
]
