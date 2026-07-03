from django.contrib import admin

from .models import UploadAsset, UploadScanTask


@admin.register(UploadAsset)
class UploadAssetAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "original_name",
        "uploaded_by",
        "content_type",
        "detected_content_type",
        "size_bytes",
        "scan_status",
        "created_at",
    )
    list_filter = ("scan_status", "storage_backend", "detected_content_type", "created_at")
    search_fields = ("original_name", "stored_name", "storage_key", "sha256")
    readonly_fields = (
        "uploaded_by",
        "original_name",
        "stored_name",
        "storage_key",
        "storage_backend",
        "content_type",
        "detected_content_type",
        "extension",
        "size_bytes",
        "sha256",
        "created_at",
    )


@admin.register(UploadScanTask)
class UploadScanTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "asset", "engine", "status", "policy", "created_at", "updated_at")
    list_filter = ("status", "engine", "policy", "created_at")
    search_fields = ("asset__original_name", "asset__sha256", "details")
    readonly_fields = ("asset", "engine", "status", "policy", "details", "created_at", "updated_at")
