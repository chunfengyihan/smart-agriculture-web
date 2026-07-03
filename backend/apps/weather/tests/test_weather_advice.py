from unittest.mock import patch

from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from apps.weather.views import EXTERNAL_INTEGRATION_DISABLED_MESSAGE


OPEN_METEO_PAYLOAD = {
    "current": {
        "time": "2026-06-27T12:00",
        "temperature_2m": 25.5,
        "apparent_temperature": 26.1,
        "relative_humidity_2m": 62,
        "precipitation": 0,
        "weather_code": 1,
        "wind_speed_10m": 8.4,
    },
    "daily": {
        "time": ["2026-06-27", "2026-06-28", "2026-06-29"],
        "weather_code": [1, 2, 61],
        "temperature_2m_max": [28.0, 29.0, 24.0],
        "temperature_2m_min": [19.0, 20.0, 18.0],
        "precipitation_probability_max": [10, 20, 70],
        "precipitation_sum": [0, 0.2, 6.5],
        "wind_speed_10m_max": [12.0, 15.0, 20.0],
    },
}


def weather_request_payload(include_advice=False):
    return {
        "cropId": "jujube",
        "cropName": "冰糖枣",
        "greenhouseId": "jujube-1",
        "greenhouseName": "1 号棚",
        "latitude": 39.0,
        "longitude": 121.0,
        "address": "测试棚区",
        "metrics": [],
        "includeAdvice": include_advice,
    }


class WeatherAdviceDisabledTests(TestCase):
    def test_legacy_weather_advice_returns_503_without_external_call(self):
        response = Client().post(
            "/api/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"message": EXTERNAL_INTEGRATION_DISABLED_MESSAGE})

    def test_v1_weather_advice_returns_standard_503(self):
        response = Client().post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(payload["code"], 50020)
        self.assertEqual(payload["message"], EXTERNAL_INTEGRATION_DISABLED_MESSAGE)
        self.assertTrue(payload["request_id"])

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    def test_v1_weather_advice_rejects_invalid_coordinates(self):
        invalid = weather_request_payload()
        invalid["latitude"] = 999
        response = Client().post(
            "/api/v1/weather/greenhouse-advice",
            data=invalid,
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["code"], 40000)
        self.assertIn("latitude", payload["data"])


class WeatherAdviceEnabledTests(TestCase):
    def setUp(self):
        cache.clear()

    @override_settings(WEATHER_SOURCE_NAME="Open-Meteo")
    def test_cache_key_includes_source_location_coordinates_date_and_advice_context(self):
        from apps.weather.services import make_cache_key

        key = make_cache_key(weather_request_payload(include_advice=True))

        self.assertIn("Open-Meteo", key)
        self.assertIn("jujube-1", key)
        self.assertIn("39.0000", key)
        self.assertIn("121.0000", key)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload", return_value=OPEN_METEO_PAYLOAD)
    def test_legacy_weather_advice_returns_open_meteo_payload(self, fetch_mock):
        response = Client().post(
            "/api/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["weather"]["source"], "Open-Meteo")
        self.assertEqual(payload["weather"]["current"]["description"], "基本晴朗")
        self.assertEqual(len(payload["weather"]["forecast"]), 3)
        self.assertIsNone(payload["advice"])
        self.assertIsNone(payload["adviceError"])
        fetch_mock.assert_called_once_with(39.0, 121.0)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload", return_value=OPEN_METEO_PAYLOAD)
    def test_legacy_weather_advice_reports_ai_advice_disabled(self, fetch_mock):
        response = Client().post(
            "/api/weather/greenhouse-advice",
            data=weather_request_payload(include_advice=True),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["weather"]["source"], "Open-Meteo")
        self.assertIsNone(payload["advice"])
        self.assertEqual(payload["adviceError"], "AI 操作建议尚未启用；当前仅返回 Open-Meteo 天气预报。")
        fetch_mock.assert_called_once_with(39.0, 121.0)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload", return_value=OPEN_METEO_PAYLOAD)
    def test_v1_weather_advice_wraps_open_meteo_payload(self, fetch_mock):
        response = Client().post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertEqual(payload["data"]["weather"]["source"], "Open-Meteo")
        self.assertEqual(payload["data"]["cacheBackend"], "locmem")
        self.assertTrue(payload["request_id"])
        fetch_mock.assert_called_once_with(39.0, 121.0)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload", return_value=OPEN_METEO_PAYLOAD)
    def test_include_advice_changes_cache_key(self, fetch_mock):
        client = Client()

        without_advice = client.post(
            "/api/weather/greenhouse-advice",
            data=weather_request_payload(include_advice=False),
            content_type="application/json",
        ).json()
        with_advice = client.post(
            "/api/weather/greenhouse-advice",
            data=weather_request_payload(include_advice=True),
            content_type="application/json",
        ).json()

        self.assertNotEqual(without_advice["cacheKey"], with_advice["cacheKey"])
        self.assertIsNone(without_advice["adviceError"])
        self.assertIsNotNone(with_advice["adviceError"])
        self.assertEqual(fetch_mock.call_count, 2)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload", return_value=OPEN_METEO_PAYLOAD)
    def test_weather_cache_hit_skips_external_call(self, fetch_mock):
        client = Client()

        first = client.post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        ).json()
        second = client.post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        ).json()

        self.assertEqual(first["data"]["cacheKey"], second["data"]["cacheKey"])
        self.assertEqual(fetch_mock.call_count, 1)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.fetch_open_meteo_payload")
    def test_external_failure_returns_degraded_status_and_is_short_cached(self, fetch_mock):
        from apps.weather.services import WeatherIntegrationError

        fetch_mock.side_effect = WeatherIntegrationError("Open-Meteo 天气预报获取失败")
        client = Client()

        first = client.post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        ).json()
        second = client.post(
            "/api/v1/weather/greenhouse-advice",
            data=weather_request_payload(),
            content_type="application/json",
        ).json()

        self.assertTrue(first["data"]["degraded"])
        self.assertEqual(first["data"]["source"], "Open-Meteo")
        self.assertEqual(second["data"]["message"], "Open-Meteo 天气预报获取失败")
        self.assertEqual(fetch_mock.call_count, 1)

    @override_settings(WEATHER_INTEGRATION_ENABLED=True)
    @patch("apps.weather.services.urlopen")
    def test_invalid_open_meteo_payload_returns_controlled_error(self, urlopen_mock):
        from apps.weather.services import WeatherIntegrationError, fetch_open_meteo_payload

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return b"[]"

        urlopen_mock.return_value = FakeResponse()

        with self.assertRaises(WeatherIntegrationError):
            fetch_open_meteo_payload(39.0, 121.0)
