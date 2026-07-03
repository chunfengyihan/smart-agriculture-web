from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response
from apps.core.serializers import LegacyExternalDisabledSerializer, V1ExternalDisabledSerializer

from .upload_security import save_private_upload, validate_upload_image


EXTERNAL_INTEGRATION_DISABLED_MESSAGE = "外部集成未启用"


class CropDiagnosisRequestSerializer(serializers.Serializer):
    image = serializers.FileField()
    cropId = serializers.CharField(max_length=64)
    cropName = serializers.CharField(max_length=128)
    greenhouseId = serializers.CharField(max_length=64)
    greenhouseName = serializers.CharField(required=False, allow_blank=True, max_length=128)
    useEnvironmentContext = serializers.BooleanField(required=False, default=False)
    metrics = serializers.CharField(required=False, allow_blank=True, max_length=32768)

    def validate_image(self, image):
        return validate_upload_image(image)


class AgriChatRequestSerializer(serializers.Serializer):
    cropId = serializers.CharField(max_length=64)
    cropName = serializers.CharField(max_length=128)
    greenhouseId = serializers.CharField(max_length=64)
    greenhouseName = serializers.CharField(max_length=128)
    metrics = serializers.ListField(child=serializers.DictField(), required=False, max_length=64)
    question = serializers.CharField(max_length=2000, trim_whitespace=True)


class LegacyCropDiagnosisView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(request=CropDiagnosisRequestSerializer, responses={503: LegacyExternalDisabledSerializer})
    def post(self, request):
        return Response(
            {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class V1CropDiagnosisView(APIView):
    permission_classes = [ApiKeyRequired]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_upload"

    @extend_schema(request=CropDiagnosisRequestSerializer, responses={503: V1ExternalDisabledSerializer})
    def post(self, request):
        upload_asset = None
        if request.FILES:
            serializer = CropDiagnosisRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            upload_asset = save_private_upload(serializer.validated_data["image"], request.user)

        if not settings.EXTERNAL_INTEGRATIONS_ENABLED:
            data = {}
            if upload_asset:
                data = {
                    "upload_asset_id": upload_asset.id,
                    "scan_status": upload_asset.scan_status,
                }
            return error_response(
                request,
                code=50020,
                message=EXTERNAL_INTEGRATION_DISABLED_MESSAGE,
                data=data,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if upload_asset is None:
            serializer = CropDiagnosisRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            upload_asset = save_private_upload(serializer.validated_data["image"], request.user)

        return error_response(
            request,
            code=50020,
            message="外部集成适配器尚未配置",
            data={
                "upload_asset_id": upload_asset.id,
                "scan_status": upload_asset.scan_status,
            },
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class LegacyAgriChatView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(request=AgriChatRequestSerializer, responses={503: LegacyExternalDisabledSerializer})
    def post(self, request):
        return Response(
            {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class V1AgriChatView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(request=AgriChatRequestSerializer, responses={503: V1ExternalDisabledSerializer})
    def post(self, request):
        if not settings.EXTERNAL_INTEGRATIONS_ENABLED:
            return error_response(
                request,
                code=50020,
                message=EXTERNAL_INTEGRATION_DISABLED_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = AgriChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return error_response(
            request,
            code=50020,
            message="外部集成适配器尚未配置",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
