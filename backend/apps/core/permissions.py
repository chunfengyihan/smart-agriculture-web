from django.conf import settings
from rest_framework.permissions import BasePermission


class ApiKeyRequired(BasePermission):
    message = "API authentication is required"

    def has_permission(self, request, view):
        if not settings.API_AUTH_REQUIRED:
            return True

        expected_token = settings.API_AUTH_TOKEN
        if not expected_token:
            return False

        provided_token = request.headers.get("X-API-Key", "")
        authorization = request.headers.get("Authorization", "")
        if authorization.lower().startswith("bearer "):
            provided_token = authorization.split(" ", 1)[1].strip()

        return provided_token == expected_token
