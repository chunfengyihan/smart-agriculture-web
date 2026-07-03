from datetime import timedelta
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from unittest.mock import patch
from rest_framework_simplejwt.tokens import AccessToken

from apps.greenhouse.models import Alert, DashboardSnapshot, Device, EnvironmentReading, Greenhouse
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
        self.assertEqual(Device.objects.count(), 4)
        self.assertEqual(EnvironmentReading.objects.count(), 4)
        self.assertGreater(Alert.objects.count(), 0)
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

    def test_dashboard_uses_normalized_models_before_snapshot(self):
        call_command("seed_dev", verbosity=0)
        snapshot = DashboardSnapshot.objects.get()
        snapshot.payload = {
            "generatedAt": "2026-07-03T00:00:00Z",
            "source": "local",
            "crops": [],
        }
        snapshot.save(update_fields=["payload", "updated_at"])

        response = Client().get("/api/v1/greenhouse/dashboard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["source"], "local")
        self.assertEqual(len(payload["data"]["crops"]), 3)
        self.assertGreater(len(payload["data"]["crops"][0]["greenhouses"]), 0)

    def test_v1_environment_readings_filter_by_greenhouse_and_time_range(self):
        call_command("seed_dev", verbosity=0)
        reading = EnvironmentReading.objects.select_related("greenhouse").first()

        response = Client().get(
            "/api/v1/greenhouse/readings",
            {
                "greenhouse": reading.greenhouse.code,
                "start": reading.recorded_at.isoformat(),
                "end": reading.recorded_at.isoformat(),
                "metric_type": "environment",
                "page_size": 5,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["data"]["count"], 1)
        self.assertEqual(payload["data"]["results"][0]["greenhouse"], reading.greenhouse.id)
        self.assertEqual(payload["data"]["results"][0]["metric_type"], "environment")

    def test_v1_greenhouses_list_is_paginated_and_filterable(self):
        call_command("seed_dev", verbosity=0)

        response = Client().get("/api/v1/greenhouses/", {"crop_code": "jujube", "page_size": 1})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["data"]["count"], 2)
        self.assertEqual(len(payload["data"]["results"]), 1)
        self.assertEqual(payload["data"]["results"][0]["crop_code"], "jujube")

    def test_v1_greenhouse_readings_are_paginated_and_metric_filtered(self):
        greenhouse = Greenhouse.objects.create(code="gh-1", name="Greenhouse 1", crop_code="jujube")
        now = timezone.now()
        for index in range(25):
            EnvironmentReading.objects.create(
                greenhouse=greenhouse,
                recorded_at=now - timedelta(hours=index),
                air_temp=20 + index,
                air_humidity=60,
                soil_humidity=50,
                co2=500,
            )

        response = Client().get(
            f"/api/v1/greenhouses/{greenhouse.code}/readings/",
            {
                "start_time": (now - timedelta(days=2)).isoformat(),
                "end_time": now.isoformat(),
                "metrics": "airTemp,soilHumidity",
                "ordering": "-recorded_at",
                "page_size": 10,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["count"], 25)
        self.assertEqual(len(payload["data"]["results"]), 10)
        first = payload["data"]["results"][0]
        self.assertIn("air_temp", first)
        self.assertIn("soil_humidity", first)
        self.assertNotIn("co2", first)

    def test_v1_greenhouse_readings_reject_invalid_and_too_large_ranges(self):
        greenhouse = Greenhouse.objects.create(code="gh-2", name="Greenhouse 2")
        now = timezone.now()

        invalid = Client().get(
            f"/api/v1/greenhouses/{greenhouse.id}/readings/",
            {
                "start_time": now.isoformat(),
                "end_time": (now - timedelta(hours=1)).isoformat(),
            },
        )
        self.assertEqual(invalid.status_code, 400)

        with override_settings(GREENHOUSE_HISTORY_MAX_RANGE_DAYS=1):
            too_large = Client().get(
                f"/api/v1/greenhouses/{greenhouse.id}/readings/",
                {
                    "start_time": (now - timedelta(days=2)).isoformat(),
                    "end_time": now.isoformat(),
                },
            )
        self.assertEqual(too_large.status_code, 400)

    def test_v1_greenhouse_alerts_filter_status_level_and_time_range(self):
        greenhouse = Greenhouse.objects.create(code="gh-3", name="Greenhouse 3")
        now = timezone.now()
        active_warning = Alert.objects.create(
            greenhouse=greenhouse,
            level=Alert.LEVEL_WARNING,
            message="Air humidity high",
            triggered_at=now,
        )
        Alert.objects.create(
            greenhouse=greenhouse,
            level=Alert.LEVEL_CRITICAL,
            message="Resolved issue",
            triggered_at=now - timedelta(hours=2),
            resolved_at=now - timedelta(hours=1),
        )

        response = Client().get(
            f"/api/v1/greenhouses/{greenhouse.code}/alerts/",
            {
                "status": "active",
                "level": "warning",
                "start_time": (now - timedelta(hours=1)).isoformat(),
                "end_time": now.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["data"]["count"], 1)
        self.assertEqual(payload["data"]["results"][0]["id"], active_warning.id)

    def test_v1_greenhouse_dashboard_returns_first_screen_summary(self):
        greenhouse = Greenhouse.objects.create(code="gh-4", name="Greenhouse 4", crop_code="blueberry")
        Device.objects.create(code="device-1", greenhouse=greenhouse, name="Device 1")
        EnvironmentReading.objects.create(
            greenhouse=greenhouse,
            recorded_at=timezone.now(),
            air_temp=23,
            air_humidity=66,
        )
        Alert.objects.create(
            greenhouse=greenhouse,
            level=Alert.LEVEL_NOTICE,
            message="Light is close to target",
            triggered_at=timezone.now(),
        )

        response = Client().get(f"/api/v1/greenhouses/{greenhouse.code}/dashboard/")

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["id"], greenhouse.code)
        self.assertEqual(data["active_alert_count"], 1)
        self.assertIn("latest_reading", data)
        self.assertNotIn("trend", data)

    def test_v1_greenhouse_detail_routes_hide_unknown_greenhouse(self):
        response = Client().get("/api/v1/greenhouses/unknown-greenhouse/readings/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], 40400)

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
