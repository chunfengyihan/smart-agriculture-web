from django.conf import settings
from django.test import Client, TestCase, override_settings


class HealthCheckTests(TestCase):
    def test_health_check_uses_standard_response(self):
        response = Client().get("/api/v1/health/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["message"], "success")
        self.assertEqual(payload["data"], {"ok": True, "service": "django-api"})
        self.assertTrue(payload["request_id"])
        self.assertEqual(response["X-Request-ID"], payload["request_id"])

    def test_health_check_preserves_request_id_header(self):
        response = Client().get(
            "/api/v1/health/",
            headers={"X-Request-ID": "stage2-request-id"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["request_id"], "stage2-request-id")
        self.assertEqual(response["X-Request-ID"], "stage2-request-id")

    def test_health_check_replaces_invalid_request_id_header(self):
        invalid_request_id = "bad request id"

        response = Client().get(
            "/api/v1/health/",
            headers={"X-Request-ID": invalid_request_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()["request_id"], invalid_request_id)
        self.assertEqual(response["X-Request-ID"], response.json()["request_id"])

    def test_clickjacking_middleware_is_enabled(self):
        self.assertIn("django.middleware.clickjacking.XFrameOptionsMiddleware", settings.MIDDLEWARE)
        self.assertEqual(settings.X_FRAME_OPTIONS, "SAMEORIGIN")

    @override_settings(API_AUTH_REQUIRED=True, API_PUBLIC_PATHS=["/api/v1/health/", "/api/v1/schema/"])
    def test_health_check_remains_public_when_api_auth_is_required(self):
        response = Client().get("/api/v1/health/")

        self.assertEqual(response.status_code, 200)

    @override_settings(API_AUTH_REQUIRED=True, API_PUBLIC_PATHS=["/api/v1/health/", "/api/v1/schema/"])
    def test_schema_remains_public_when_api_auth_is_required(self):
        response = Client().get("/api/v1/schema/")

        self.assertEqual(response.status_code, 200)
