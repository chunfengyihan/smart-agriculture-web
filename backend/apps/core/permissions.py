import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class ApiKeyRequired(BasePermission):
    message = "API authentication is required"

    def has_permission(self, request, view):
        if is_public_path(request.path):
            return True

        if not settings.API_AUTH_REQUIRED:
            return True

        if getattr(request.user, "is_authenticated", False):
            return True

        provided_token = api_key_from_request(request)
        if not provided_token:
            return False

        return any(
            hmac.compare_digest(provided_token, allowed_token)
            for allowed_token in allowed_api_keys()
        )


def normalize_path(path):
    if path == "/":
        return path
    return path.rstrip("/")


def is_public_path(path):
    normalized_path = normalize_path(path)
    return any(normalized_path == normalize_path(public_path) for public_path in settings.API_PUBLIC_PATHS)


def allowed_api_keys():
    keys = list(getattr(settings, "API_KEY_ALLOWLIST", []))
    legacy_token = getattr(settings, "API_AUTH_TOKEN", "")
    if legacy_token:
        keys.append(legacy_token)
    return [key for key in keys if key]


def api_key_from_request(request):
    header_name = getattr(settings, "API_KEY_HEADER", "X-API-Key")
    provided_token = request.headers.get(header_name, "")
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("apikey "):
        provided_token = authorization.split(" ", 1)[1].strip()
    return provided_token.strip()
