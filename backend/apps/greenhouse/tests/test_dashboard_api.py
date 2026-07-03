from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import Client, TestCase, override_settings
from unittest.mock import patch
from rest_framework_simplejwt.tokens import AccessToken

from apps.greenhouse.models import DashboardSnapshot, EnvironmentReading, Greenhouse
from apps.integrations.youren.client import YourenUpstreamError


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
    def test_dashboard_default_public_paths_do_not_include_business_api(self):
        self.assertNotIn("/api/greenhouse/dashboard", settings.API_PUBLIC_PATHS)
        self.assertNotIn("/api/v1/greenhouse/dashboard", settings.API_PUBLIC_PATHS)

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="test-token", API_PUBLIC_PATHS=["/api/v1/health/"])
    def test_dashboard_requires_auth_when_api_auth_enabled(self):
        response = Client().get("/api/greenhouse/dashboard")

        self.assertIn(response.status_code, [401, 403])

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="test-token", API_PUBLIC_PATHS=[])
    def test_dashboard_accepts_legacy_api_key_when_enabled(self):
        response = Client().get("/api/greenhouse/dashboard", HTTP_X_API_KEY="test-token")

        self.assertEqual(response.status_code, 200)

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="", API_KEY_ALLOWLIST=["service-token"], API_PUBLIC_PATHS=[])
    def test_dashboard_accepts_allowlisted_api_key(self):
        response = Client().get("/api/v1/greenhouse/dashboard", HTTP_X_API_KEY="service-token")

        self.assertEqual(response.status_code, 200)

    @override_settings(API_AUTH_REQUIRED=True, API_AUTH_TOKEN="", API_KEY_ALLOWLIST=[], API_PUBLIC_PATHS=[])
    def test_dashboard_accepts_jwt_bearer_token(self):
        user = get_user_model().objects.create_user(username="dashboard-user")
        token = AccessToken.for_user(user)

        response = Client().get(
            "/api/v1/greenhouse/dashboard",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        self.assertEqual(response.status_code, 200)

    @override_settings(YOUREN_INTEGRATION_ENABLED=True)
    @patch("apps.greenhouse.views.get_youren_dashboard")
    def test_v1_dashboard_can_use_youren_service(self, mock_get_youren_dashboard):
        mock_get_youren_dashboard.return_value = {
            "generatedAt": "2026-07-03T00:00:00Z",
            "source": "youren",
            "crops": [],
        }

        response = Client().get("/api/v1/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["source"], "youren")
        mock_get_youren_dashboard.assert_called_once_with()

    @override_settings(YOUREN_INTEGRATION_ENABLED=True)
    @patch("apps.greenhouse.views.get_youren_dashboard")
    def test_v1_dashboard_sanitizes_youren_errors(self, mock_get_youren_dashboard):
        mock_get_youren_dashboard.side_effect = YourenUpstreamError("raw upstream body with secret")

        response = Client().get("/api/v1/greenhouse/dashboard")

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["message"], "Youren upstream service is unavailable")
        self.assertNotIn("secret", payload["message"])
