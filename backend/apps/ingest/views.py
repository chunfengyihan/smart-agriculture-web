import logging

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.core.permissions import ApiKeyRequired
from apps.core.responses import error_response, success_response

from .serializers import DtuReadingIngestSerializer
from .services import DtuIngestError, ingest_dtu_reading


logger = logging.getLogger(__name__)


class V1DtuReadingIngestView(APIView):
    permission_classes = [ApiKeyRequired]

    @extend_schema(
        request=DtuReadingIngestSerializer,
        responses={200: None, 201: None},
        examples=[
            OpenApiExample(
                "DTU normalized reading",
                value={
                    "device_id": "dtu-greenhouse-1",
                    "device_token": "device-token-from-secure-env",
                    "protocol": "smart_agri_v1",
                    "recorded_at": "2026-07-04T10:00:00+08:00",
                    "metrics": {"air_temp": 25.6, "air_humidity": 68, "soil_humidity": 52},
                    "raw_frame_hash": "0" * 64,
                    "frame_length": 128,
                    "redacted_snippet": "DTU1|device=dtu-greenhouse-1|token=[redacted]|...",
                },
            )
        ],
    )
    def post(self, request):
        serializer = DtuReadingIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                request,
                code=40000,
                message="Invalid DTU ingest payload",
                data={"field_errors": serializer.errors},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        payload = serializer.validated_data
        payload.setdefault("remote_ip", dtu_remote_ip(request))

        try:
            reading, created = ingest_dtu_reading(payload)
        except DtuIngestError as exc:
            logger.warning(
                "dtu_ingest_rejected",
                extra={
                    "device_id": payload.get("device_id"),
                    "remote_ip": payload.get("remote_ip"),
                    "error_code": exc.code,
                    "frame_hash": payload.get("raw_frame_hash"),
                    "redacted_snippet": payload.get("redacted_snippet"),
                },
            )
            return error_response(
                request,
                code=exc.status_code * 100,
                message=exc.message,
                data={"error_code": exc.code, **exc.details},
                status_code=exc.status_code,
            )

        return success_response(
            request,
            data={
                "reading_id": reading.id,
                "device_id": payload["device_id"],
                "greenhouse_id": reading.greenhouse_id,
                "recorded_at": reading.recorded_at.isoformat(),
                "created": created,
            },
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


def dtu_remote_ip(request):
    header_value = request.headers.get("X-DTU-Remote-IP", "").split(",", 1)[0].strip()
    if header_value:
        return header_value
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",", 1)[0].strip()
    if forwarded_for:
        return forwarded_for
    return request.META.get("REMOTE_ADDR")

