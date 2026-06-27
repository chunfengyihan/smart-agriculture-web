from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.responses import error_response, success_response
from apps.core.serializers import LegacyExternalDisabledSerializer, V1ExternalDisabledSerializer

from .services import WeatherIntegrationError, get_greenhouse_weather_advice


EXTERNAL_INTEGRATION_DISABLED_MESSAGE = "外部集成未启用"


class WeatherAdviceRequestSerializer(serializers.Serializer):
    cropId = serializers.CharField()
    cropName = serializers.CharField()
    greenhouseId = serializers.CharField()
    greenhouseName = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    address = serializers.CharField(required=False, allow_blank=True)
    metrics = serializers.ListField(child=serializers.DictField(), required=False)
    includeAdvice = serializers.BooleanField(required=False, default=True)


class LegacyWeatherAdviceView(APIView):
    authentication_classes = []
    permission_classes = []

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
    permission_classes = []

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
