from rest_framework import serializers

from .models import DashboardSnapshot, EnvironmentReading, Greenhouse


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
