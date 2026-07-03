from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response
from apps.integrations.youren.client import YourenIntegrationError
from apps.integrations.youren.service import get_youren_dashboard

from .models import DashboardSnapshot
from .serializers import DashboardPayloadSerializer, V1DashboardResponseSerializer


def empty_dashboard_payload():
    return {
        "generatedAt": timezone.now().isoformat().replace("+00:00", "Z"),
        "source": "local",
        "crops": [],
    }


def latest_dashboard_payload():
    snapshot = DashboardSnapshot.objects.order_by("-snapshot_at", "-id").first()
    if not snapshot:
        return empty_dashboard_payload()
    return snapshot.payload


def dashboard_payload():
    if settings.YOUREN_INTEGRATION_ENABLED:
        return get_youren_dashboard()
    return latest_dashboard_payload()


class LegacyGreenhouseDashboardView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: DashboardPayloadSerializer})
    def get(self, request):
        try:
            return Response(dashboard_payload())
        except YourenIntegrationError as exc:
            return Response(
                {"message": exc.safe_message},
                status=exc.status_code,
            )


class V1GreenhouseDashboardView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: V1DashboardResponseSerializer})
    def get(self, request):
        try:
            return success_response(request, dashboard_payload())
        except YourenIntegrationError as exc:
            return error_response(
                request,
                code=50020,
                message=exc.safe_message,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
