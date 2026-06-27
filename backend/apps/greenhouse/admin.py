from django.contrib import admin

from .models import DashboardSnapshot, EnvironmentReading, Greenhouse


@admin.register(Greenhouse)
class GreenhouseAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "crop_code", "location", "source", "updated_at")
    list_filter = ("source", "crop_code")
    search_fields = ("code", "name", "location", "crop_code")
    readonly_fields = ("created_at", "updated_at")


@admin.register(EnvironmentReading)
class EnvironmentReadingAdmin(admin.ModelAdmin):
    list_display = (
        "greenhouse",
        "recorded_at",
        "air_temp",
        "air_humidity",
        "soil_humidity",
        "soil_temp",
        "source",
    )
    list_filter = ("source", "recorded_at")
    search_fields = ("greenhouse__code", "greenhouse__name")
    autocomplete_fields = ("greenhouse",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "recorded_at"


@admin.register(DashboardSnapshot)
class DashboardSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "greenhouse", "snapshot_at", "schema_version", "source", "updated_at")
    list_filter = ("source", "schema_version", "snapshot_at")
    search_fields = ("greenhouse__code", "greenhouse__name", "schema_version")
    autocomplete_fields = ("greenhouse",)
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "snapshot_at"
