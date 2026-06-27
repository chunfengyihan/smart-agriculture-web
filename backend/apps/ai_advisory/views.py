from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.responses import error_response
from apps.core.serializers import LegacyExternalDisabledSerializer, V1ExternalDisabledSerializer


EXTERNAL_INTEGRATION_DISABLED_MESSAGE = "外部集成未启用"


class CropDiagnosisRequestSerializer(serializers.Serializer):
    image = serializers.FileField()
    cropId = serializers.CharField()
    cropName = serializers.CharField()
    greenhouseId = serializers.CharField()
    greenhouseName = serializers.CharField(required=False, allow_blank=True)
    useEnvironmentContext = serializers.BooleanField(required=False, default=False)
    metrics = serializers.CharField(required=False, allow_blank=True)


class AgriChatRequestSerializer(serializers.Serializer):
    cropId = serializers.CharField()
    cropName = serializers.CharField()
    greenhouseId = serializers.CharField()
    greenhouseName = serializers.CharField()
    metrics = serializers.ListField(child=serializers.DictField(), required=False)
    question = serializers.CharField()


class LegacyCropDiagnosisView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(request=CropDiagnosisRequestSerializer, responses={503: LegacyExternalDisabledSerializer})
    def post(self, request):
        return Response(
            {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class V1CropDiagnosisView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(request=CropDiagnosisRequestSerializer, responses={503: V1ExternalDisabledSerializer})
    def post(self, request):
        if not settings.EXTERNAL_INTEGRATIONS_ENABLED:
            return error_response(
                request,
                code=50020,
                message=EXTERNAL_INTEGRATION_DISABLED_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return error_response(
            request,
            code=50020,
            message="外部集成适配器尚未配置",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class LegacyAgriChatView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(request=AgriChatRequestSerializer, responses={503: LegacyExternalDisabledSerializer})
    def post(self, request):
        return Response(
            {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class V1AgriChatView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(request=AgriChatRequestSerializer, responses={503: V1ExternalDisabledSerializer})
    def post(self, request):
        if not settings.EXTERNAL_INTEGRATIONS_ENABLED:
            return error_response(
                request,
                code=50020,
                message=EXTERNAL_INTEGRATION_DISABLED_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return error_response(
            request,
            code=50020,
            message="外部集成适配器尚未配置",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
