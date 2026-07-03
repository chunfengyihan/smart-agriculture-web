from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPageNumberPagination
from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response
from apps.integrations.youren.client import YourenIntegrationError
from apps.integrations.youren.service import get_youren_dashboard

from .models import DashboardSnapshot
from .repositories import GreenhouseRepository
from .serializers import DashboardPayloadSerializer, EnvironmentReadingSerializer, V1DashboardResponseSerializer
from .services import build_dashboard_from_models


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
    return build_dashboard_from_models() or latest_dashboard_payload()


class EnvironmentReadingQuerySerializer(serializers.Serializer):
    greenhouse = serializers.CharField(required=False, max_length=64)
    start = serializers.DateTimeField(required=False)
    end = serializers.DateTimeField(required=False)
    metric_type = serializers.CharField(required=False, max_length=32)

    def validate(self, attrs):
        start = attrs.get("start")
        end = attrs.get("end")
        if start and end and start > end:
            raise serializers.ValidationError({"end": "end must be greater than or equal to start"})
        return attrs


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


class V1EnvironmentReadingsView(APIView):
    permission_classes = [ApiKeyRequired]
    pagination_class = StandardPageNumberPagination

    @extend_schema(parameters=[EnvironmentReadingQuerySerializer], responses={200: EnvironmentReadingSerializer(many=True)})
    def get(self, request):
        serializer = EnvironmentReadingQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return error_response(
                request,
                code=40000,
                message="请求参数无效",
                data=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        queryset = GreenhouseRepository().query_readings(**serializer.validated_data)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = EnvironmentReadingSerializer(page, many=True).data
        paginated = paginator.get_paginated_response(data).data
        return success_response(request, paginated)
