from django.contrib import admin
from django.urls import path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.accounts.views import (
    AuthMeView,
    LogoutView,
    RefreshTokenView,
    WeChatLoginView,
)
from apps.core.views import FrontendIndexView, HealthCheckView, MetricsView, frontend_asset_view
from apps.ai_advisory.views import (
    LegacyAgriChatView,
    LegacyCropDiagnosisView,
    V1AgriChatView,
    V1CropDiagnosisView,
)
from apps.greenhouse.views import (
    LegacyGreenhouseDashboardView,
    V1EnvironmentReadingsView,
    V1GreenhouseAlertsView,
    V1GreenhouseDashboardView,
    V1GreenhouseDetailDashboardView,
    V1GreenhouseListView,
    V1GreenhouseReadingsView,
)
from apps.ingest.views import V1DtuReadingIngestView
from apps.integrations.youren.views import LegacyYourenHealthView, V1YourenHealthView
from apps.weather.views import LegacyWeatherAdviceView, V1WeatherAdviceView


urlpatterns = [
    path("", FrontendIndexView.as_view(), name="frontend-index"),
    path("admin/", admin.site.urls),
    path(
        "api/greenhouse/dashboard",
        LegacyGreenhouseDashboardView.as_view(),
        name="api-legacy-greenhouse-dashboard",
    ),
    path("api/youren/health", LegacyYourenHealthView.as_view(), name="api-legacy-youren-health"),
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
    path("api/v1/metrics/", MetricsView.as_view(), name="api-v1-metrics"),
    path(
        "api/v1/integrations/youren/health",
        V1YourenHealthView.as_view(),
        name="api-v1-youren-health",
    ),
    path(
        "api/v1/ingest/dtu-readings",
        V1DtuReadingIngestView.as_view(),
        name="api-v1-ingest-dtu-readings",
    ),
    path("api/v1/auth/wechat-login", WeChatLoginView.as_view(), name="api-v1-auth-wechat-login"),
    path("api/v1/auth/refresh", RefreshTokenView.as_view(), name="api-v1-auth-refresh"),
    path("api/v1/auth/logout", LogoutView.as_view(), name="api-v1-auth-logout"),
    path("api/v1/auth/me", AuthMeView.as_view(), name="api-v1-auth-me"),
    path(
        "api/v1/greenhouse/dashboard",
        V1GreenhouseDashboardView.as_view(),
        name="api-v1-greenhouse-dashboard",
    ),
    path(
        "api/v1/greenhouse/readings",
        V1EnvironmentReadingsView.as_view(),
        name="api-v1-greenhouse-readings",
    ),
    path(
        "api/v1/greenhouses/",
        V1GreenhouseListView.as_view(),
        name="api-v1-greenhouses",
    ),
    path(
        "api/v1/greenhouses/<str:greenhouse_id>/readings/",
        V1GreenhouseReadingsView.as_view(),
        name="api-v1-greenhouse-detail-readings",
    ),
    path(
        "api/v1/greenhouses/<str:greenhouse_id>/alerts/",
        V1GreenhouseAlertsView.as_view(),
        name="api-v1-greenhouse-detail-alerts",
    ),
    path(
        "api/v1/greenhouses/<str:greenhouse_id>/dashboard/",
        V1GreenhouseDetailDashboardView.as_view(),
        name="api-v1-greenhouse-detail-dashboard",
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
    path(
        "api/v1/redoc/",
        SpectacularRedocView.as_view(url_name="api-v1-schema"),
        name="api-v1-redoc",
    ),
    re_path(
        r"^(?P<path>(assets|data|images)/.*|favicon\.(ico|png|svg)|icons\.svg|logo-(lockup|mark)\.(png|svg)|smart-agriculture-logo\.ico)$",
        frontend_asset_view,
        name="frontend-asset",
    ),
    re_path(
        r"^(?:monitoring|map|intelligence|analytics(?:/wall(?:/trends)?)?)/?$",
        FrontendIndexView.as_view(),
        name="frontend-spa",
    ),
]
