from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import success_response

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


class LegacyGreenhouseDashboardView(APIView):
    authentication_classes = []
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: DashboardPayloadSerializer})
    def get(self, request):
        return Response(latest_dashboard_payload())


class V1GreenhouseDashboardView(APIView):
    authentication_classes = []
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: V1DashboardResponseSerializer})
    def get(self, request):
        return success_response(request, latest_dashboard_payload())
