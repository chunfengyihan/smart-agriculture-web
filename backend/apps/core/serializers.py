from rest_framework import serializers


class LegacyExternalDisabledSerializer(serializers.Serializer):
    message = serializers.CharField()


class V1ExternalDisabledSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    message = serializers.CharField()
    data = serializers.DictField()
    request_id = serializers.CharField()
