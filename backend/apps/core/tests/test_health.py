from django.test import Client, TestCase


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
