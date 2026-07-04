from django.contrib import admin

from .models import DtuIngestAuditEvent


@admin.register(DtuIngestAuditEvent)
class DtuIngestAuditEventAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "external_device_id", "error_code", "remote_ip", "protocol", "created_at")
    list_filter = ("status", "error_code", "protocol", "created_at")
    search_fields = ("device_id", "frame_hash", "redacted_snippet")
    autocomplete_fields = ("device",)
    readonly_fields = (
        "device",
        "external_device_id",
        "status",
        "error_code",
        "remote_ip",
        "protocol",
        "frame_hash",
        "redacted_snippet",
        "details",
        "created_at",
    )
    date_hierarchy = "created_at"
