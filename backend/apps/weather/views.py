from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response
from apps.core.serializers import LegacyExternalDisabledSerializer, V1ExternalDisabledSerializer

from .services import WeatherIntegrationError, get_greenhouse_weather_advice


EXTERNAL_INTEGRATION_DISABLED_MESSAGE = "外部集成未启用"


class WeatherAdviceRequestSerializer(serializers.Serializer):
    cropId = serializers.CharField(max_length=64)
    cropName = serializers.CharField(max_length=128)
    greenhouseId = serializers.CharField(max_length=64)
    greenhouseName = serializers.CharField(max_length=128)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    metrics = serializers.ListField(child=serializers.DictField(), required=False, max_length=64)
    includeAdvice = serializers.BooleanField(required=False, default=True)


class LegacyWeatherAdviceView(APIView):
    authentication_classes = []
    permission_classes = [ApiKeyRequired]

    @extend_schema(request=WeatherAdviceRequestSerializer, responses={503: LegacyExternalDisabledSerializer})
    def post(self, request):
        if not settings.WEATHER_INTEGRATION_ENABLED:
            return Response(
                {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = WeatherAdviceRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"message": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(get_greenhouse_weather_advice(serializer.validated_data))
        except WeatherIntegrationError as exc:
            return Response({"message": str(exc)}, status=exc.status_code)


class V1WeatherAdviceView(APIView):
    authentication_classes = []
    permission_classes = [ApiKeyRequired]

    @extend_schema(request=WeatherAdviceRequestSerializer, responses={503: V1ExternalDisabledSerializer})
    def post(self, request):
        if not settings.WEATHER_INTEGRATION_ENABLED:
            return error_response(
                request,
                code=50020,
                message=EXTERNAL_INTEGRATION_DISABLED_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = WeatherAdviceRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                request,
                code=40000,
                message="请求参数无效",
                data=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return success_response(request, get_greenhouse_weather_advice(serializer.validated_data))
        except WeatherIntegrationError as exc:
            return error_response(
                request,
                code=50021,
                message=str(exc),
                status_code=exc.status_code,
            )
