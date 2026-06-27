from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.views import View
from django.views.static import serve as serve_static
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.views import APIView

from .responses import success_response


class FrontendIndexView(View):
    def get(self, request):
        index_path = Path(settings.FRONTEND_DIST_DIR) / "index.html"
        if not index_path.exists():
            return HttpResponse(
                "Frontend build not found. Run `npm run build` before using the single-port Django app.",
                status=503,
                content_type="text/plain; charset=utf-8",
            )
        return FileResponse(index_path.open("rb"), content_type="text/html; charset=utf-8")


def frontend_asset_view(request, path):
    return serve_static(request, path, document_root=settings.FRONTEND_DIST_DIR)


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
