from django.test import Client, TestCase


class WeatherAdviceDisabledTests(TestCase):
    def test_legacy_weather_advice_returns_503_without_external_call(self):
        response = Client().post(
            "/api/weather/greenhouse-advice",
            data={
                "cropId": "jujube",
                "cropName": "冰糖枣",
                "greenhouseId": "jujube-1",
                "greenhouseName": "1 号棚",
                "latitude": 39.0,
                "longitude": 121.0,
                "metrics": [],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"message": "外部集成未启用"})

    def test_v1_weather_advice_returns_standard_503(self):
        response = Client().post(
            "/api/v1/weather/greenhouse-advice",
            data={
                "cropId": "jujube",
                "cropName": "冰糖枣",
                "greenhouseId": "jujube-1",
                "greenhouseName": "1 号棚",
                "latitude": 39.0,
                "longitude": 121.0,
                "metrics": [],
            },
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(payload["code"], 50020)
        self.assertEqual(payload["message"], "外部集成未启用")
        self.assertTrue(payload["request_id"])
