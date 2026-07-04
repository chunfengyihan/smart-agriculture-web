from decimal import Decimal, InvalidOperation

from rest_framework import serializers


METRIC_ALIASES = {
    "airTemp": "air_temp",
    "air_temp": "air_temp",
    "temp": "air_temp",
    "temperature": "air_temp",
    "airHumidity": "air_humidity",
    "air_humidity": "air_humidity",
    "humidity": "air_humidity",
    "light": "light",
    "co2": "co2",
    "soilHumidity": "soil_humidity",
    "soil_humidity": "soil_humidity",
    "soil_moisture": "soil_humidity",
    "soilTemp": "soil_temp",
    "soil_temp": "soil_temp",
    "ec": "ec",
    "ph": "ph",
}


class DtuReadingIngestSerializer(serializers.Serializer):
    device_id = serializers.CharField(max_length=128)
    device_token = serializers.CharField(required=False, allow_blank=True, write_only=True, max_length=512)
    protocol = serializers.CharField(required=False, default="smart_agri_v1", max_length=32)
    recorded_at = serializers.DateTimeField(required=False)
    metrics = serializers.DictField()
    remote_ip = serializers.IPAddressField(required=False, allow_null=True)
    raw_frame_hash = serializers.RegexField(required=False, regex=r"^[0-9a-f]{64}$", max_length=64)
    frame_length = serializers.IntegerField(required=False, min_value=0)
    parser_version = serializers.CharField(required=False, allow_blank=True, max_length=32)
    connection_id = serializers.CharField(required=False, allow_blank=True, max_length=64)
    redacted_snippet = serializers.CharField(required=False, allow_blank=True, max_length=256)

    def validate_metrics(self, value):
        normalized = {}
        for key, raw_value in value.items():
            metric = METRIC_ALIASES.get(key)
            if not metric:
                raise serializers.ValidationError(f"unsupported metric: {key}")
            if raw_value in (None, ""):
                continue
            try:
                normalized[metric] = Decimal(str(raw_value))
            except (InvalidOperation, ValueError) as exc:
                raise serializers.ValidationError(f"invalid numeric value for {key}") from exc

        if not normalized:
            raise serializers.ValidationError("at least one metric is required")
        return normalized

