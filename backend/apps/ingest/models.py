from django.db import models

from apps.greenhouse.models import Device


class DtuIngestAuditEvent(models.Model):
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
    ]

    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        related_name="dtu_ingest_events",
        null=True,
        blank=True,
    )
    external_device_id = models.CharField(max_length=128, blank=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, db_index=True)
    error_code = models.CharField(max_length=64, blank=True, db_index=True)
    remote_ip = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    protocol = models.CharField(max_length=32, blank=True)
    frame_hash = models.CharField(max_length=64, blank=True, db_index=True)
    redacted_snippet = models.CharField(max_length=256, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["external_device_id", "-created_at"]),
            models.Index(fields=["error_code", "-created_at"]),
        ]
        ordering = ["-created_at", "-id"]
