from django.contrib import admin

from .models import Alert, DashboardSnapshot, Device, EnvironmentReading, Greenhouse


@admin.register(Greenhouse)
class GreenhouseAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "crop_code", "location", "source", "updated_at")
    list_filter = ("source", "crop_code")
    search_fields = ("code", "name", "location", "crop_code")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "greenhouse", "provider", "status", "last_seen_at", "updated_at")
    list_filter = ("provider", "status", "last_seen_at")
    search_fields = ("code", "name", "external_id", "greenhouse__code", "greenhouse__name")
    autocomplete_fields = ("greenhouse",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "last_seen_at"


@admin.register(EnvironmentReading)
class EnvironmentReadingAdmin(admin.ModelAdmin):
    list_display = (
        "greenhouse",
        "recorded_at",
        "metric_type",
        "air_temp",
        "air_humidity",
        "soil_humidity",
        "soil_temp",
        "source",
    )
    list_filter = ("source", "metric_type", "recorded_at")
    search_fields = ("greenhouse__code", "greenhouse__name")
    autocomplete_fields = ("greenhouse",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "recorded_at"


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("id", "greenhouse", "device", "level", "metric_type", "triggered_at", "resolved_at", "source")
    list_filter = ("level", "source", "metric_type", "resolved_at", "triggered_at")
    search_fields = ("message", "greenhouse__code", "greenhouse__name", "device__code", "device__name")
    autocomplete_fields = ("greenhouse", "device")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "triggered_at"


@admin.register(DashboardSnapshot)
class DashboardSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "greenhouse", "snapshot_at", "schema_version", "source", "updated_at")
    list_filter = ("source", "schema_version", "snapshot_at")
    search_fields = ("greenhouse__code", "greenhouse__name", "schema_version")
    autocomplete_fields = ("greenhouse",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "snapshot_at"
