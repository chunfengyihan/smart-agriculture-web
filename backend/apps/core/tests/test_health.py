import json
import logging

from django.conf import settings
from django.test import RequestFactory
from django.test import Client, TestCase, override_settings

from apps.core.logging import JsonLogFormatter
from apps.core.metrics import reset_metrics


class HealthCheckTests(TestCase):
    def tearDown(self):
        reset_metrics()

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

    def test_json_log_formatter_outputs_structured_and_redacted_payload(self):
        record = logging.LogRecord(
            name="apps.core.request",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="http_request_completed",
            args=(),
            exc_info=None,
        )
        record.request_id = "request-123"
        record.user_id = 42
        record.path = "/api/v1/health/"
        record.method = "GET"
        record.status_code = 200
        record.duration_ms = 12.5
        record.authorization = "Bearer secret-token"
        record.request = RequestFactory().get("/api/v1/health/?token=secret-token")

        payload = json.loads(JsonLogFormatter().format(record))

        self.assertEqual(payload["message"], "http_request_completed")
        self.assertEqual(payload["request_id"], "request-123")
        self.assertEqual(payload["user_id"], 42)
        self.assertEqual(payload["path"], "/api/v1/health/")
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["status_code"], 200)
        self.assertEqual(payload["duration_ms"], 12.5)
        self.assertEqual(payload["authorization"], "[redacted]")
        self.assertEqual(payload["request"], {"method": "GET", "path": "/api/v1/health/"})
        self.assertNotIn("secret-token", json.dumps(payload))

    def test_metrics_endpoint_is_disabled_by_default(self):
        response = Client().get("/api/v1/metrics/")

        self.assertEqual(response.status_code, 404)

    @override_settings(PROMETHEUS_METRICS_ENABLED=True)
    def test_metrics_endpoint_outputs_prometheus_text_when_enabled(self):
        Client().get("/api/v1/health/", headers={"X-Request-ID": "metrics-request"})

        response = Client().get("/api/v1/metrics/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; version=0.0.4; charset=utf-8")
        body = response.content.decode("utf-8")
        self.assertIn("smart_agri_http_requests_total", body)
        self.assertIn('method="GET"', body)
