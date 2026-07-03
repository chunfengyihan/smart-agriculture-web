from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPageNumberPagination
from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response
from apps.integrations.youren.client import YourenIntegrationError
from apps.integrations.youren.service import get_youren_dashboard

from .models import Alert, DashboardSnapshot, EnvironmentReading, Greenhouse
from .repositories import GreenhouseRepository
from .serializers import (
    AlertSerializer,
    DashboardPayloadSerializer,
    ENVIRONMENT_READING_METRIC_FIELDS,
    EnvironmentReadingSerializer,
    GreenhouseDashboardSummarySerializer,
    GreenhouseSerializer,
    V1DashboardResponseSerializer,
)
from .services import build_dashboard_from_models


READING_ORDERING_FIELDS = {"recorded_at", "-recorded_at", "created_at", "-created_at", "id", "-id"}
ALERT_ORDERING_FIELDS = {"triggered_at", "-triggered_at", "created_at", "-created_at", "level", "-level", "id", "-id"}
GREENHOUSE_ORDERING_FIELDS = {"code", "-code", "name", "-name", "created_at", "-created_at", "id", "-id"}
METRIC_ALIASES = {
    "airTemp": "air_temp",
    "air_temp": "air_temp",
    "airHumidity": "air_humidity",
    "air_humidity": "air_humidity",
    "light": "light",
    "co2": "co2",
    "soilHumidity": "soil_humidity",
    "soil_humidity": "soil_humidity",
    "soilTemp": "soil_temp",
    "soil_temp": "soil_temp",
    "ec": "ec",
    "ph": "ph",
}


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


def max_query_range_days():
    return int(getattr(settings, "GREENHOUSE_HISTORY_MAX_RANGE_DAYS", 31))


def trim_reading_metrics(data, metrics):
    if not metrics:
        return data
    requested_metrics = set(metrics)
    return [
        {
            key: value
            for key, value in item.items()
            if key not in ENVIRONMENT_READING_METRIC_FIELDS or key in requested_metrics
        }
        for item in data
    ]


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


class GreenhouseListQuerySerializer(serializers.Serializer):
    crop_code = serializers.CharField(required=False, max_length=64)
    source = serializers.CharField(required=False, max_length=32)
    q = serializers.CharField(required=False, max_length=128)
    ordering = serializers.ChoiceField(required=False, choices=sorted(GREENHOUSE_ORDERING_FIELDS), default="code")


class TimeRangeSerializer(serializers.Serializer):
    start_time = serializers.DateTimeField(required=False)
    end_time = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")
        if start_time and end_time:
            if start_time > end_time:
                raise serializers.ValidationError({"end_time": "end_time must be greater than or equal to start_time"})
            max_days = max_query_range_days()
            if end_time - start_time > timedelta(days=max_days):
                raise serializers.ValidationError(
                    {"end_time": f"time range must not exceed {max_days} days"}
                )
        return attrs


class GreenhouseReadingsQuerySerializer(TimeRangeSerializer):
    metrics = serializers.CharField(required=False, allow_blank=True, max_length=256)
    metric_type = serializers.CharField(required=False, max_length=32)
    ordering = serializers.ChoiceField(
        required=False,
        choices=sorted(READING_ORDERING_FIELDS),
        default="-recorded_at",
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        raw_metrics = attrs.get("metrics", "")
        metrics = []
        if raw_metrics:
            for item in [part.strip() for part in raw_metrics.split(",") if part.strip()]:
                metric = METRIC_ALIASES.get(item)
                if not metric:
                    raise serializers.ValidationError({"metrics": f"unsupported metric: {item}"})
                metrics.append(metric)
        attrs["metrics"] = metrics
        return attrs


class GreenhouseAlertsQuerySerializer(TimeRangeSerializer):
    status = serializers.ChoiceField(required=False, choices=["active", "resolved", "all"], default="active")
    level = serializers.CharField(required=False, allow_blank=True, max_length=128)
    ordering = serializers.ChoiceField(
        required=False,
        choices=sorted(ALERT_ORDERING_FIELDS),
        default="-triggered_at",
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        raw_levels = attrs.get("level", "")
        levels = []
        if raw_levels:
            valid_levels = {choice[0] for choice in Alert.LEVEL_CHOICES}
            for item in [part.strip() for part in raw_levels.split(",") if part.strip()]:
                if item not in valid_levels:
                    raise serializers.ValidationError({"level": f"unsupported level: {item}"})
                levels.append(item)
        attrs["levels"] = levels
        return attrs


def accessible_greenhouses(_request):
    return Greenhouse.objects.all()


def get_accessible_greenhouse(request, greenhouse_id):
    queryset = accessible_greenhouses(request)
    lookup = Q(code=greenhouse_id)
    if str(greenhouse_id).isdigit():
        lookup |= Q(id=int(greenhouse_id))
    greenhouse = queryset.filter(lookup).first()
    if greenhouse:
        return greenhouse
    return None


def inaccessible_greenhouse_response(request):
    return error_response(
        request,
        code=40400,
        message="温室不存在或无访问权限",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def validation_error_response(request, errors):
    return error_response(
        request,
        code=40000,
        message="请求参数无效",
        data={"field_errors": errors},
        status_code=status.HTTP_400_BAD_REQUEST,
    )


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


class V1GreenhouseListView(APIView):
    permission_classes = [ApiKeyRequired]
    pagination_class = StandardPageNumberPagination

    @extend_schema(
        parameters=[
            OpenApiParameter("crop_code", str, description="Filter by crop code."),
            OpenApiParameter("source", str, description="Filter by data source."),
            OpenApiParameter("q", str, description="Search greenhouse code, name, or location."),
            OpenApiParameter("ordering", str, description="One of code, -code, name, -name, created_at, -created_at."),
            OpenApiParameter("page", int, description="Page number."),
            OpenApiParameter("page_size", int, description="Page size, capped by the global max page size."),
        ],
        responses={200: GreenhouseSerializer(many=True)},
    )
    def get(self, request):
        serializer = GreenhouseListQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return validation_error_response(request, serializer.errors)

        params = serializer.validated_data
        queryset = accessible_greenhouses(request).annotate(
            devices_total=Count("devices", distinct=True),
            active_alerts_total=Count("alerts", filter=Q(alerts__resolved_at__isnull=True), distinct=True),
        )
        if params.get("crop_code"):
            queryset = queryset.filter(crop_code=params["crop_code"])
        if params.get("source"):
            queryset = queryset.filter(source=params["source"])
        if params.get("q"):
            query = params["q"]
            queryset = queryset.filter(Q(code__icontains=query) | Q(name__icontains=query) | Q(location__icontains=query))

        queryset = queryset.order_by(params["ordering"], "id")
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = GreenhouseSerializer(page, many=True).data
        return success_response(request, paginator.get_paginated_response(data).data)


class V1GreenhouseReadingsView(APIView):
    permission_classes = [ApiKeyRequired]
    pagination_class = StandardPageNumberPagination

    @extend_schema(
        parameters=[
            OpenApiParameter("greenhouse_id", str, OpenApiParameter.PATH, description="Greenhouse numeric id or code."),
            OpenApiParameter("start_time", str, description="Inclusive ISO-8601 recorded_at lower bound."),
            OpenApiParameter("end_time", str, description="Inclusive ISO-8601 recorded_at upper bound."),
            OpenApiParameter("metrics", str, description="Comma-separated metric fields, e.g. airTemp,airHumidity,soilHumidity."),
            OpenApiParameter("metric_type", str, description="Filter by reading metric_type."),
            OpenApiParameter("ordering", str, description="One of recorded_at, -recorded_at, created_at, -created_at, id, -id."),
            OpenApiParameter("page", int, description="Page number."),
            OpenApiParameter("page_size", int, description="Page size, capped by the global max page size."),
        ],
        responses={200: EnvironmentReadingSerializer(many=True)},
    )
    def get(self, request, greenhouse_id):
        greenhouse = get_accessible_greenhouse(request, greenhouse_id)
        if greenhouse is None:
            return inaccessible_greenhouse_response(request)

        serializer = GreenhouseReadingsQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return validation_error_response(request, serializer.errors)

        params = serializer.validated_data
        queryset = EnvironmentReading.objects.filter(greenhouse=greenhouse).select_related("greenhouse")
        if params.get("start_time"):
            queryset = queryset.filter(recorded_at__gte=params["start_time"])
        if params.get("end_time"):
            queryset = queryset.filter(recorded_at__lte=params["end_time"])
        if params.get("metric_type"):
            queryset = queryset.filter(metric_type=params["metric_type"])
        queryset = queryset.order_by(params["ordering"], "-id")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = trim_reading_metrics(EnvironmentReadingSerializer(page, many=True).data, params["metrics"])
        return success_response(request, paginator.get_paginated_response(data).data)


class V1GreenhouseAlertsView(APIView):
    permission_classes = [ApiKeyRequired]
    pagination_class = StandardPageNumberPagination

    @extend_schema(
        parameters=[
            OpenApiParameter("greenhouse_id", str, OpenApiParameter.PATH, description="Greenhouse numeric id or code."),
            OpenApiParameter("status", str, description="Alert status: active, resolved, or all. Default active."),
            OpenApiParameter("level", str, description="Comma-separated levels: notice, warning, critical."),
            OpenApiParameter("start_time", str, description="Inclusive ISO-8601 triggered_at lower bound."),
            OpenApiParameter("end_time", str, description="Inclusive ISO-8601 triggered_at upper bound."),
            OpenApiParameter("ordering", str, description="One of triggered_at, -triggered_at, created_at, -created_at, level, -level."),
            OpenApiParameter("page", int, description="Page number."),
            OpenApiParameter("page_size", int, description="Page size, capped by the global max page size."),
        ],
        responses={200: AlertSerializer(many=True)},
    )
    def get(self, request, greenhouse_id):
        greenhouse = get_accessible_greenhouse(request, greenhouse_id)
        if greenhouse is None:
            return inaccessible_greenhouse_response(request)

        serializer = GreenhouseAlertsQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return validation_error_response(request, serializer.errors)

        params = serializer.validated_data
        queryset = Alert.objects.filter(greenhouse=greenhouse).select_related("greenhouse", "device")
        if params["status"] == "active":
            queryset = queryset.filter(resolved_at__isnull=True)
        elif params["status"] == "resolved":
            queryset = queryset.filter(resolved_at__isnull=False)
        if params.get("levels"):
            queryset = queryset.filter(level__in=params["levels"])
        if params.get("start_time"):
            queryset = queryset.filter(triggered_at__gte=params["start_time"])
        if params.get("end_time"):
            queryset = queryset.filter(triggered_at__lte=params["end_time"])
        queryset = queryset.order_by(params["ordering"], "-id")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = AlertSerializer(page, many=True).data
        return success_response(request, paginator.get_paginated_response(data).data)


class V1GreenhouseDetailDashboardView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(
        parameters=[
            OpenApiParameter("greenhouse_id", str, OpenApiParameter.PATH, description="Greenhouse numeric id or code."),
        ],
        responses={200: GreenhouseDashboardSummarySerializer},
    )
    def get(self, request, greenhouse_id):
        greenhouse = get_accessible_greenhouse(request, greenhouse_id)
        if greenhouse is None:
            return inaccessible_greenhouse_response(request)

        devices = list(greenhouse.devices.order_by("code"))
        latest_reading = greenhouse.readings.order_by("-recorded_at", "-id").first()
        latest_alerts = list(greenhouse.alerts.filter(resolved_at__isnull=True).order_by("-triggered_at", "-id")[:5])
        total_devices = len(devices)
        online_devices = sum(1 for device in devices if device.status != "offline")
        if total_devices and online_devices == 0:
            greenhouse_status = "offline"
        elif latest_alerts or any(device.status == "warning" for device in devices):
            greenhouse_status = "warning"
        else:
            greenhouse_status = "online"

        data = {
            "id": greenhouse.code,
            "name": greenhouse.name,
            "crop_code": greenhouse.crop_code,
            "location": greenhouse.location,
            "source": greenhouse.source,
            "status": greenhouse_status,
            "online_devices": online_devices,
            "total_devices": total_devices,
            "latest_reading": EnvironmentReadingSerializer(latest_reading).data if latest_reading else None,
            "active_alert_count": greenhouse.alerts.filter(resolved_at__isnull=True).count(),
            "latest_alerts": AlertSerializer(latest_alerts, many=True).data,
        }
        return success_response(request, data)
