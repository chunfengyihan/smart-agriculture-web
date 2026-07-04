import hashlib
import uuid
from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from apps.core.metrics import record_upload_failure

from .models import UploadAsset, UploadScanTask


DETECTED_IMAGE_TYPES = {
    "image/jpeg": {
        "extensions": {".jpg", ".jpeg"},
        "matches": lambda header: header.startswith(b"\xff\xd8\xff"),
    },
    "image/png": {
        "extensions": {".png"},
        "matches": lambda header: header.startswith(b"\x89PNG\r\n\x1a\n"),
    },
    "image/webp": {
        "extensions": {".webp"},
        "matches": lambda header: header.startswith(b"RIFF") and header[8:12] == b"WEBP",
    },
}


def allowed_content_types():
    return set(getattr(settings, "AI_UPLOAD_ALLOWED_CONTENT_TYPES", DETECTED_IMAGE_TYPES.keys()))


def max_upload_bytes():
    return int(getattr(settings, "AI_UPLOAD_MAX_BYTES", 8 * 1024 * 1024))


def detect_content_type(uploaded_file):
    position = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    header = uploaded_file.read(64)
    if position is not None:
        uploaded_file.seek(position)

    for content_type, rule in DETECTED_IMAGE_TYPES.items():
        if rule["matches"](header):
            return content_type
    return ""


def validate_upload_image(uploaded_file):
    if uploaded_file.size > max_upload_bytes():
        record_upload_failure("too_large")
        raise serializers.ValidationError("Image must not exceed 8MB")

    extension = Path(uploaded_file.name).suffix.lower()
    declared_content_type = getattr(uploaded_file, "content_type", "")
    detected_content_type = detect_content_type(uploaded_file)

    if declared_content_type not in allowed_content_types():
        record_upload_failure("declared_type_not_allowed")
        raise serializers.ValidationError("Only JPG, PNG, and WebP images are supported")
    if detected_content_type not in allowed_content_types():
        record_upload_failure("content_type_not_allowed")
        raise serializers.ValidationError("Uploaded file content is not a supported image")
    if declared_content_type != detected_content_type:
        record_upload_failure("mime_mismatch")
        raise serializers.ValidationError("Uploaded file MIME type does not match its content")
    if extension not in DETECTED_IMAGE_TYPES[detected_content_type]["extensions"]:
        record_upload_failure("extension_mismatch")
        raise serializers.ValidationError("Uploaded file extension does not match its content")

    uploaded_file.detected_content_type = detected_content_type
    uploaded_file.safe_extension = extension
    return uploaded_file


def storage_key_for(extension):
    random_name = uuid.uuid4().hex
    return f"ai_advisory/{random_name[:2]}/{random_name}{extension}"


def save_private_upload(uploaded_file, user):
    extension = getattr(uploaded_file, "safe_extension", Path(uploaded_file.name).suffix.lower())
    storage_key = storage_key_for(extension)
    sha256 = hashlib.sha256()

    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)

    target_path = settings.PRIVATE_UPLOAD_ROOT / storage_key
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("wb") as stored_path:
        for chunk in uploaded_file.chunks():
            sha256.update(chunk)
            stored_path.write(chunk)

    if hasattr(uploaded_file, "seek"):
        uploaded_file.seek(0)

    asset = UploadAsset.objects.create(
        uploaded_by=user if getattr(user, "is_authenticated", False) else None,
        original_name=Path(uploaded_file.name).name[:255],
        stored_name=Path(storage_key).name,
        storage_key=storage_key,
        storage_backend=UploadAsset.STORAGE_LOCAL_PRIVATE,
        content_type=getattr(uploaded_file, "content_type", ""),
        detected_content_type=getattr(uploaded_file, "detected_content_type", ""),
        extension=extension.lstrip("."),
        size_bytes=uploaded_file.size,
        sha256=sha256.hexdigest(),
    )
    enqueue_scan_task(asset)
    return asset


def enqueue_scan_task(asset):
    if getattr(settings, "CLAMAV_ENABLED", False):
        UploadScanTask.objects.create(
            asset=asset,
            status=UploadScanTask.STATUS_PENDING,
            policy=getattr(settings, "AI_UPLOAD_SCAN_POLICY", "hold_until_scanned"),
            details={"queue": "clamav", "storage_key": asset.storage_key},
        )
        return

    asset.scan_status = UploadAsset.SCAN_UNAVAILABLE
    asset.save(update_fields=["scan_status"])
    UploadScanTask.objects.create(
        asset=asset,
        status=UploadScanTask.STATUS_UNAVAILABLE,
        policy=getattr(settings, "AI_UPLOAD_SCAN_POLICY", "hold_until_scanned"),
        details={
            "reason": "clamav_unavailable",
            "strategy": getattr(settings, "AI_UPLOAD_SCAN_UNAVAILABLE_STRATEGY", "hold_and_block_use"),
        },
    )
