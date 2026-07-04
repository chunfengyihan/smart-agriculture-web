import hashlib

from django.db import transaction
from django.utils import timezone

from apps.greenhouse.models import Device, EnvironmentReading

from .models import DtuIngestAuditEvent


class DtuIngestError(Exception):
    def __init__(self, code, message, status_code=400, details=None, device=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.device = device


def hash_ingest_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def sanitize_audit_details(payload):
    details = {}
    for key in ["raw_frame_hash", "frame_length", "parser_version", "connection_id"]:
        if payload.get(key) not in (None, ""):
            details[key] = payload[key]
    return details


def audit_event(status, payload, *, error_code="", device=None, details=None):
    return DtuIngestAuditEvent.objects.create(
        device=device,
        external_device_id=payload.get("device_id", "") or "",
        status=status,
        error_code=error_code,
        remote_ip=payload.get("remote_ip") or None,
        protocol=payload.get("protocol", "") or "",
        frame_hash=payload.get("raw_frame_hash", "") or "",
        redacted_snippet=(payload.get("redacted_snippet", "") or "")[:256],
        details=details or sanitize_audit_details(payload),
    )


def ip_allowed(device, remote_ip):
    allowed_ips = device.ingest_allowed_ips or []
    if not allowed_ips:
        return True
    return bool(remote_ip and remote_ip in allowed_ips)


def token_allowed(device, token):
    if not device.ingest_token_hash:
        return True
    if not token:
        return False
    return hash_ingest_token(token) == device.ingest_token_hash


def ingest_dtu_reading(payload):
    device_id = payload["device_id"]
    remote_ip = payload.get("remote_ip")
    token = payload.get("device_token", "")

    device = Device.objects.select_related("greenhouse").filter(code=device_id).first()
    if device is None:
        audit_event(DtuIngestAuditEvent.STATUS_REJECTED, payload, error_code="DTU_DEVICE_NOT_REGISTERED")
        raise DtuIngestError("DTU_DEVICE_NOT_REGISTERED", "DTU device is not registered", 403)

    if not device.ingest_enabled:
        audit_event(
            DtuIngestAuditEvent.STATUS_REJECTED,
            payload,
            error_code="DTU_DEVICE_DISABLED",
            device=device,
        )
        raise DtuIngestError("DTU_DEVICE_DISABLED", "DTU ingest is disabled for this device", 403, device=device)

    if payload.get("protocol") != device.ingest_protocol:
        audit_event(
            DtuIngestAuditEvent.STATUS_REJECTED,
            payload,
            error_code="DTU_PROTOCOL_MISMATCH",
            device=device,
        )
        raise DtuIngestError("DTU_PROTOCOL_MISMATCH", "DTU protocol does not match device registration", 400, device=device)

    if not ip_allowed(device, remote_ip):
        audit_event(DtuIngestAuditEvent.STATUS_REJECTED, payload, error_code="DTU_IP_DENIED", device=device)
        raise DtuIngestError("DTU_IP_DENIED", "DTU remote IP is not allowed for this device", 403, device=device)

    if not token_allowed(device, token):
        audit_event(DtuIngestAuditEvent.STATUS_REJECTED, payload, error_code="DTU_TOKEN_INVALID", device=device)
        raise DtuIngestError("DTU_TOKEN_INVALID", "DTU device token is invalid", 403, device=device)

    if not device.ingest_token_hash and not (device.ingest_allowed_ips or []):
        audit_event(DtuIngestAuditEvent.STATUS_REJECTED, payload, error_code="DTU_DEVICE_AUTH_NOT_CONFIGURED", device=device)
        raise DtuIngestError(
            "DTU_DEVICE_AUTH_NOT_CONFIGURED",
            "DTU device has no token hash or IP allowlist configured",
            403,
            device=device,
        )

    with transaction.atomic():
        recorded_at = payload.get("recorded_at") or timezone.now()
        metric_values = payload["metrics"]
        reading, created = EnvironmentReading.objects.update_or_create(
            greenhouse=device.greenhouse,
            device=device,
            recorded_at=recorded_at,
            source="dtu",
            defaults={
                "metric_type": "environment",
                **metric_values,
            },
        )

        now = timezone.now()
        device.status = Device.STATUS_ONLINE
        device.last_seen_at = now
        device.last_ingest_at = now
        device.save(update_fields=["status", "last_seen_at", "last_ingest_at", "updated_at"])

        audit_event(
            DtuIngestAuditEvent.STATUS_ACCEPTED,
            payload,
            device=device,
            details={**sanitize_audit_details(payload), "reading_id": reading.id, "created": created},
        )
    return reading, created
