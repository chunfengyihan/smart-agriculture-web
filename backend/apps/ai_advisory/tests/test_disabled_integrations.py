from django.test import Client, TestCase


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
