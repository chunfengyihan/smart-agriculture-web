from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from apps.greenhouse.models import DashboardSnapshot, EnvironmentReading, Greenhouse


class GreenhouseDashboardApiTests(TestCase):
    def test_legacy_dashboard_empty_data(self):
        response = Client().get("/api/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "local")
        self.assertEqual(payload["crops"], [])
        self.assertIn("generatedAt", payload)

    def test_v1_dashboard_empty_data_uses_standard_response(self):
        response = Client().get("/api/v1/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["message"], "success")
        self.assertEqual(payload["data"]["source"], "local")
        self.assertEqual(payload["data"]["crops"], [])
        self.assertTrue(payload["request_id"])

    def test_seed_dev_is_repeatable(self):
        call_command("seed_dev", verbosity=0)
        call_command("seed_dev", verbosity=0)

        self.assertEqual(Greenhouse.objects.count(), 4)
        self.assertEqual(EnvironmentReading.objects.count(), 4)
        self.assertEqual(DashboardSnapshot.objects.count(), 1)

    def test_legacy_dashboard_after_seed_preserves_payload_shape(self):
        call_command("seed_dev", verbosity=0)

        response = Client().get("/api/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(set(payload.keys()), {"generatedAt", "source", "crops"})
        self.assertEqual(payload["source"], "local")
        self.assertEqual(len(payload["crops"]), 3)
        self.assertEqual(payload["crops"][0]["id"], "jujube")
        self.assertEqual(len(payload["crops"][0]["greenhouses"]), 2)
        self.assertEqual(len(payload["crops"][0]["greenhouses"][0]["metrics"]), 8)
        self.assertEqual(len(payload["crops"][0]["greenhouses"][0]["trend"]), 24)

    def test_v1_dashboard_after_seed_wraps_payload(self):
        call_command("seed_dev", verbosity=0)

        response = Client().get("/api/v1/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["message"], "success")
        self.assertEqual(payload["data"]["source"], "local")
        self.assertEqual(len(payload["data"]["crops"]), 3)
        self.assertTrue(payload["request_id"])

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="test-token")
    def test_dashboard_public_path_works_when_api_key_auth_enabled(self):
        response = Client().get("/api/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="test-token", API_PUBLIC_PATHS=[])
    def test_dashboard_requires_api_key_when_removed_from_public_paths(self):
        response = Client().get("/api/greenhouse/dashboard")

        self.assertEqual(response.status_code, 403)

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="test-token")
    def test_dashboard_accepts_api_key_when_enabled(self):
        response = Client().get("/api/greenhouse/dashboard", HTTP_X_API_KEY="test-token")

        self.assertEqual(response.status_code, 200)
