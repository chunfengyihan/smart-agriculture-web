from rest_framework import serializers


class WeChatLoginRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=512, trim_whitespace=True)


class RefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=2048, trim_whitespace=True)


class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=2048, trim_whitespace=True)


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    nickname = serializers.CharField(allow_blank=True)
    role = serializers.CharField()


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    token = serializers.CharField()
    user = UserSerializer()


class RefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    token = serializers.CharField()


class LogoutResponseSerializer(serializers.Serializer):
    logged_out = serializers.BooleanField()


def serialize_user(user):
    profile = getattr(user, "wechat_profile", None)
    return {
        "id": user.id,
        "username": user.get_username(),
        "nickname": getattr(profile, "nickname", ""),
        "role": getattr(profile, "role", "admin" if user.is_superuser else "viewer"),
    }
