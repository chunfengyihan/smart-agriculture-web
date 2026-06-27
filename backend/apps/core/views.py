from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.views import APIView

from .responses import success_response


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    "code": {"type": "integer", "example": 0},
                    "message": {"type": "string", "example": "success"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "ok": {"type": "boolean", "example": True},
                            "service": {"type": "string", "example": "django-api"},
                        },
                    },
                    "request_id": {"type": "string", "format": "uuid"},
                },
            }
        },
        examples=[
            OpenApiExample(
                "Health check",
                value={
                    "code": 0,
                    "message": "success",
                    "data": {"ok": True, "service": "django-api"},
                    "request_id": "00000000-0000-0000-0000-000000000000",
                },
            )
        ],
    )
    def get(self, request):
        return success_response(request, {"ok": True, "service": "django-api"})
