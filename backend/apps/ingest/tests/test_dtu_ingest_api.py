from django.test import Client, TestCase, override_settings
from django.utils import timezone

from apps.greenhouse.models import Device, EnvironmentReading, Greenhouse
from apps.ingest.models import DtuIngestAuditEvent
from apps.ingest.services import hash_ingest_token


@override_settings(API_AUTH_REQUIRED=True, API_KEY_ALLOWLIST=["service-key"], API_PUBLIC_PATHS=[])
class DtuIngestApiTests(TestCase):
    def setUp(self):
        self.greenhouse = Greenhouse.objects.create(code="gh-dtu", name="DTU Greenhouse")
        self.device = Device.objects.create(
            code="dtu-001",
            name="DTU 001",
            greenhouse=self.greenhouse,
            provider="dtu",
            ingest_enabled=True,
            ingest_token_hash=hash_ingest_token("device-token"),
            ingest_allowed_ips=["127.0.0.1"],
        )
        self.client = Client(HTTP_X_API_KEY="service-key")

    def payload(self, **overrides):
        data = {
            "device_id": "dtu-001",
            "device_token": "device-token",
            "protocol": "smart_agri_v1",
            "recorded_at": timezone.now().isoformat(),
            "metrics": {"air_temp": 25.6, "air_humidity": 68, "soil_humidity": 52},
            "raw_frame_hash": "a" * 64,
            "frame_length": 80,
            "redacted_snippet": "DTU1|device=dtu-001|token=[redacted]|air_temp=25.6",
        }
        data.update(overrides)
        return data

    def test_unregistered_device_cannot_write_readings(self):
        response = self.client.post(
            "/api/v1/ingest/dtu-readings",
            self.payload(device_id="unknown"),
            content_type="application/json",
            HTTP_X_DTU_REMOTE_IP="127.0.0.1",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(EnvironmentReading.objects.count(), 0)
        self.assertEqual(DtuIngestAuditEvent.objects.get().error_code, "DTU_DEVICE_NOT_REGISTERED")

    def test_invalid_token_is_rejected_and_audited(self):
        response = self.client.post(
            "/api/v1/ingest/dtu-readings",
            self.payload(device_token="bad-token"),
            content_type="application/json",
            HTTP_X_DTU_REMOTE_IP="127.0.0.1",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(EnvironmentReading.objects.count(), 0)
        audit = DtuIngestAuditEvent.objects.get()
        self.assertEqual(audit.error_code, "DTU_TOKEN_INVALID")
        self.assertNotIn("bad-token", audit.redacted_snippet)

    def test_remote_ip_allowlist_is_enforced(self):
        response = self.client.post(
            "/api/v1/ingest/dtu-readings",
            self.payload(),
            content_type="application/json",
            HTTP_X_DTU_REMOTE_IP="10.10.10.10",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(EnvironmentReading.objects.count(), 0)
        self.assertEqual(DtuIngestAuditEvent.objects.get().error_code, "DTU_IP_DENIED")

    def test_legal_frame_writes_traceable_environment_reading(self):
        response = self.client.post(
            "/api/v1/ingest/dtu-readings",
            self.payload(),
            content_type="application/json",
            HTTP_X_DTU_REMOTE_IP="127.0.0.1",
        )

        self.assertEqual(response.status_code, 201)
        reading = EnvironmentReading.objects.get()
        self.assertEqual(reading.device, self.device)
        self.assertEqual(reading.greenhouse, self.greenhouse)
        self.assertEqual(str(reading.air_temp), "25.60")
        self.assertEqual(reading.source, "dtu")
        self.device.refresh_from_db()
        self.assertIsNotNone(self.device.last_ingest_at)
        self.assertEqual(DtuIngestAuditEvent.objects.get().status, "accepted")

