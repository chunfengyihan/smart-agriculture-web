from rest_framework import serializers

from .models import Alert, DashboardSnapshot, Device, EnvironmentReading, Greenhouse


class GreenhouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Greenhouse
        fields = [
            "id",
            "code",
            "name",
            "location",
            "crop_code",
            "source",
            "created_at",
            "updated_at",
        ]


class EnvironmentReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnvironmentReading
        fields = [
            "id",
            "greenhouse",
            "recorded_at",
            "metric_type",
            "air_temp",
            "air_humidity",
            "light",
            "co2",
            "soil_humidity",
            "soil_temp",
            "ec",
            "ph",
            "source",
            "created_at",
            "updated_at",
        ]


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id",
            "greenhouse",
            "code",
            "name",
            "provider",
            "external_id",
            "status",
            "last_seen_at",
            "metadata",
            "created_at",
            "updated_at",
        ]


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            "id",
            "greenhouse",
            "device",
            "level",
            "metric_type",
            "message",
            "triggered_at",
            "resolved_at",
            "source",
            "metadata",
            "created_at",
            "updated_at",
        ]


class DashboardSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DashboardSnapshot
        fields = [
            "id",
            "greenhouse",
            "snapshot_at",
            "payload",
            "schema_version",
            "source",
            "created_at",
            "updated_at",
        ]


class DashboardPayloadSerializer(serializers.Serializer):
    generatedAt = serializers.DateTimeField()
    source = serializers.CharField()
    crops = serializers.ListField(child=serializers.DictField())


class V1DashboardResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    message = serializers.CharField()
    data = DashboardPayloadSerializer()
    request_id = serializers.CharField()
