from django.db import models


class Greenhouse(models.Model):
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    location = models.CharField(max_length=255, blank=True)
    crop_code = models.CharField(max_length=64, blank=True, db_index=True)
    source = models.CharField(max_length=32, default="local", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["crop_code", "source"]),
        ]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} {self.name}"


class EnvironmentReading(models.Model):
    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="readings",
    )
    recorded_at = models.DateTimeField(db_index=True)
    air_temp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    air_humidity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    light = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    co2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    soil_humidity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    soil_temp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    ec = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    ph = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    source = models.CharField(max_length=32, default="local", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["greenhouse", "recorded_at", "source"],
                name="uniq_greenhouse_reading_recorded_source",
            )
        ]
        indexes = [
            models.Index(fields=["greenhouse", "recorded_at"]),
            models.Index(fields=["source", "recorded_at"]),
        ]
        ordering = ["-recorded_at", "greenhouse_id"]


class DashboardSnapshot(models.Model):
    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="dashboard_snapshots",
        null=True,
        blank=True,
    )
    snapshot_at = models.DateTimeField(db_index=True)
    payload = models.JSONField()
    schema_version = models.CharField(max_length=32, default="dashboard-v1")
    source = models.CharField(max_length=32, default="local", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "schema_version", "snapshot_at"],
                name="uniq_dashboard_snapshot_source_schema_time",
            )
        ]
        indexes = [
            models.Index(fields=["source", "schema_version", "-snapshot_at"]),
        ]
        ordering = ["-snapshot_at", "-id"]
