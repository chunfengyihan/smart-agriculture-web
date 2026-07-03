import tempfile
from pathlib import Path

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from rest_framework.throttling import ScopedRateThrottle

from apps.ai_advisory.models import UploadAsset, UploadScanTask


class AiAdvisoryDisabledTests(TestCase):
    def test_legacy_crop_diagnosis_returns_503_without_external_call(self):
        response = Client().post("/api/ai/crop-diagnosis", data={})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"message": "外部集成未启用"})

    def test_v1_crop_diagnosis_returns_standard_503(self):
        response = Client().post("/api/v1/ai/crop-diagnosis", data={})

        payload = response.json()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(payload["code"], 50020)
        self.assertEqual(payload["message"], "外部集成未启用")
        self.assertTrue(payload["request_id"])

    def test_legacy_agri_chat_returns_503_without_external_call(self):
        response = Client().post(
            "/api/ai/agri-chat",
            data={"question": "现在怎么管理？"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"message": "外部集成未启用"})

    def test_v1_agri_chat_returns_standard_503(self):
        response = Client().post(
            "/api/v1/ai/agri-chat",
            data={"question": "现在怎么管理？"},
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(payload["code"], 50020)
        self.assertEqual(payload["message"], "外部集成未启用")
        self.assertTrue(payload["request_id"])

    @override_settings(EXTERNAL_INTEGRATIONS_ENABLED=True)
    def test_v1_agri_chat_validates_request_before_adapter(self):
        response = Client().post("/api/v1/ai/agri-chat", data={}, content_type="application/json")

        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["code"], 40000)
        self.assertIn("field_errors", payload["data"])
        self.assertIn("question", payload["data"]["field_errors"])

    @override_settings(EXTERNAL_INTEGRATIONS_ENABLED=True)
    def test_v1_crop_diagnosis_rejects_non_image_upload(self):
        response = Client().post(
            "/api/v1/ai/crop-diagnosis",
            data={
                "image": SimpleUploadedFile("note.txt", b"not an image", content_type="text/plain"),
                "cropId": "jujube",
                "cropName": "jujube",
                "greenhouseId": "jujube-1",
            },
        )

        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", payload["data"]["field_errors"])

    @override_settings(EXTERNAL_INTEGRATIONS_ENABLED=True)
    def test_v1_crop_diagnosis_rejects_oversized_upload(self):
        response = Client().post(
            "/api/v1/ai/crop-diagnosis",
            data={
                "image": SimpleUploadedFile(
                    "leaf.jpg",
                    b"x" * (8 * 1024 * 1024 + 1),
                    content_type="image/jpeg",
                ),
                "cropId": "jujube",
                "cropName": "jujube",
                "greenhouseId": "jujube-1",
            },
        )

        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", payload["data"]["field_errors"])


class AiAdvisoryUploadSecurityTests(TestCase):
    def setUp(self):
        self.private_uploads = tempfile.TemporaryDirectory()
        self.override = override_settings(
            EXTERNAL_INTEGRATIONS_ENABLED=True,
            PRIVATE_UPLOAD_ROOT=Path(self.private_uploads.name),
            CLAMAV_ENABLED=False,
        )
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        self.private_uploads.cleanup()

    def diagnosis_payload(self, image):
        return {
            "image": image,
            "cropId": "jujube",
            "cropName": "jujube",
            "greenhouseId": "jujube-1",
        }

    def test_v1_crop_diagnosis_rejects_forged_mime_upload(self):
        response = Client().post(
            "/api/v1/ai/crop-diagnosis",
            data=self.diagnosis_payload(
                SimpleUploadedFile("leaf.jpg", b"not an image", content_type="image/jpeg")
            ),
        )

        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", payload["data"]["field_errors"])
        self.assertFalse(UploadAsset.objects.exists())

    def test_v1_crop_diagnosis_records_private_upload_and_scan_status(self):
        image = SimpleUploadedFile(
            "leaf.png",
            b"\x89PNG\r\n\x1a\n" + b"\x00" * 32,
            content_type="image/png",
        )

        response = Client().post(
            "/api/v1/ai/crop-diagnosis",
            data=self.diagnosis_payload(image),
        )

        payload = response.json()
        self.assertEqual(response.status_code, 503)
        asset = UploadAsset.objects.get()
        self.assertEqual(payload["data"]["upload_asset_id"], asset.id)
        self.assertEqual(asset.original_name, "leaf.png")
        self.assertNotEqual(asset.stored_name, "leaf.png")
        self.assertEqual(asset.detected_content_type, "image/png")
        self.assertEqual(asset.scan_status, UploadAsset.SCAN_UNAVAILABLE)
        self.assertEqual(asset.size_bytes, 40)
        self.assertEqual(len(asset.sha256), 64)

        stored_path = Path(self.private_uploads.name) / asset.storage_key
        self.assertTrue(stored_path.exists())
        self.assertFalse(asset.storage_key.startswith(("assets/", "data/", "images/", "static/")))
        self.assertEqual(Client().get(f"/{asset.storage_key}").status_code, 404)

        scan_task = UploadScanTask.objects.get(asset=asset)
        self.assertEqual(scan_task.status, UploadScanTask.STATUS_UNAVAILABLE)
        self.assertEqual(scan_task.details["reason"], "clamav_unavailable")


class AiAdvisoryUploadThrottleTests(TestCase):
    def test_v1_crop_diagnosis_is_throttled(self):
        cache.clear()
        original_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {"ai_upload": "1/min"}
        client = Client()

        try:
            first = client.post("/api/v1/ai/crop-diagnosis", data={})
            second = client.post("/api/v1/ai/crop-diagnosis", data={})
        finally:
            ScopedRateThrottle.THROTTLE_RATES = original_rates

        self.assertEqual(first.status_code, 503)
        self.assertEqual(second.status_code, 429)
