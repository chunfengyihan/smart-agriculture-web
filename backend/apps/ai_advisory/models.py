from django.conf import settings
from django.db import models


class UploadAsset(models.Model):
    SCAN_PENDING = "pending"
    SCAN_CLEAN = "clean"
    SCAN_INFECTED = "infected"
    SCAN_UNAVAILABLE = "scan_unavailable"
    SCAN_FAILED = "failed"
    SCAN_STATUS_CHOICES = [
        (SCAN_PENDING, "Pending"),
        (SCAN_CLEAN, "Clean"),
        (SCAN_INFECTED, "Infected"),
        (SCAN_UNAVAILABLE, "Scan unavailable"),
        (SCAN_FAILED, "Failed"),
    ]

    STORAGE_LOCAL_PRIVATE = "local_private"
    STORAGE_MINIO_PRIVATE = "minio_private"
    STORAGE_BACKEND_CHOICES = [
        (STORAGE_LOCAL_PRIVATE, "Local private filesystem"),
        (STORAGE_MINIO_PRIVATE, "MinIO private bucket"),
    ]

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_upload_assets",
    )
    original_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=512, unique=True)
    storage_backend = models.CharField(
        max_length=32,
        choices=STORAGE_BACKEND_CHOICES,
        default=STORAGE_LOCAL_PRIVATE,
    )
    content_type = models.CharField(max_length=128)
    detected_content_type = models.CharField(max_length=128)
    extension = models.CharField(max_length=16)
    size_bytes = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64, db_index=True)
    scan_status = models.CharField(
        max_length=32,
        choices=SCAN_STATUS_CHOICES,
        default=SCAN_PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["scan_status", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.original_name} ({self.scan_status})"


class UploadScanTask(models.Model):
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_CLEAN = "clean"
    STATUS_INFECTED = "infected"
    STATUS_UNAVAILABLE = "unavailable"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_CLEAN, "Clean"),
        (STATUS_INFECTED, "Infected"),
        (STATUS_UNAVAILABLE, "Unavailable"),
        (STATUS_FAILED, "Failed"),
    ]

    asset = models.ForeignKey(
        UploadAsset,
        on_delete=models.CASCADE,
        related_name="scan_tasks",
    )
    engine = models.CharField(max_length=64, default="clamav")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING)
    policy = models.CharField(max_length=64, default="hold_until_scanned")
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["engine", "status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.engine}:{self.status} for upload {self.asset_id}"
