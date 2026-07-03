from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response

from .client import YourenIntegrationError
from .service import get_youren_health


class YourenHealthSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    configured = serializers.BooleanField()
    enabled = serializers.BooleanField(required=False)
    message = serializers.CharField(required=False)
    deviceCountInSample = serializers.IntegerField(required=False)
    sampleDevices = serializers.ListField(child=serializers.DictField(), required=False)


class LegacyYourenHealthView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: YourenHealthSerializer})
    def get(self, request):
        try:
            payload = get_youren_health()
        except YourenIntegrationError as exc:
            return Response({"ok": False, "configured": True, "message": exc.safe_message}, status=exc.status_code)
        return Response(payload)


class V1YourenHealthView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(responses={200: YourenHealthSerializer})
    def get(self, request):
        try:
            return success_response(request, get_youren_health())
        except YourenIntegrationError as exc:
            return error_response(
                request,
                code=50020,
                message=exc.safe_message,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
