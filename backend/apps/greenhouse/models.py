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


class Device(models.Model):
    STATUS_ONLINE = "online"
    STATUS_WARNING = "warning"
    STATUS_OFFLINE = "offline"
    STATUS_CHOICES = [
        (STATUS_ONLINE, "Online"),
        (STATUS_WARNING, "Warning"),
        (STATUS_OFFLINE, "Offline"),
    ]

    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="devices",
    )
    code = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=128)
    provider = models.CharField(max_length=32, default="local", db_index=True)
    external_id = models.CharField(max_length=128, blank=True, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ONLINE, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ingest_enabled = models.BooleanField(default=False, db_index=True)
    ingest_token_hash = models.CharField(max_length=64, blank=True)
    ingest_allowed_ips = models.JSONField(default=list, blank=True)
    ingest_protocol = models.CharField(max_length=32, default="smart_agri_v1")
    last_ingest_at = models.DateTimeField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["greenhouse", "status"]),
            models.Index(fields=["provider", "external_id"]),
            models.Index(fields=["provider", "last_seen_at"]),
            models.Index(fields=["provider", "ingest_enabled"]),
        ]
        ordering = ["greenhouse__code", "code"]

    def __str__(self):
        return f"{self.code} {self.name}"


class EnvironmentReading(models.Model):
    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="readings",
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        related_name="readings",
        null=True,
        blank=True,
    )
    recorded_at = models.DateTimeField(db_index=True)
    metric_type = models.CharField(max_length=32, default="environment", db_index=True)
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
                fields=["greenhouse", "device", "recorded_at", "source"],
                name="uniq_greenhouse_device_reading_source",
            )
        ]
        indexes = [
            models.Index(fields=["greenhouse", "recorded_at"]),
            models.Index(fields=["device", "recorded_at"]),
            models.Index(fields=["greenhouse", "metric_type", "recorded_at"]),
            models.Index(fields=["source", "recorded_at"]),
            models.Index(fields=["source", "metric_type", "recorded_at"]),
        ]
        ordering = ["-recorded_at", "greenhouse_id"]


class Alert(models.Model):
    LEVEL_NOTICE = "notice"
    LEVEL_WARNING = "warning"
    LEVEL_CRITICAL = "critical"
    LEVEL_CHOICES = [
        (LEVEL_NOTICE, "Notice"),
        (LEVEL_WARNING, "Warning"),
        (LEVEL_CRITICAL, "Critical"),
    ]

    greenhouse = models.ForeignKey(
        Greenhouse,
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        related_name="alerts",
        null=True,
        blank=True,
    )
    level = models.CharField(max_length=16, choices=LEVEL_CHOICES, default=LEVEL_WARNING, db_index=True)
    metric_type = models.CharField(max_length=32, blank=True, db_index=True)
    message = models.CharField(max_length=512)
    triggered_at = models.DateTimeField(db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True, db_index=True)
    source = models.CharField(max_length=32, default="local", db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["greenhouse", "resolved_at", "-triggered_at"]),
            models.Index(fields=["greenhouse", "metric_type", "-triggered_at"]),
            models.Index(fields=["level", "resolved_at"]),
            models.Index(fields=["source", "-triggered_at"]),
        ]
        ordering = ["-triggered_at", "-id"]

    def __str__(self):
        return f"{self.greenhouse_id} {self.level} {self.message[:64]}"


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
