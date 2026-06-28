from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings


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
