import hashlib
import json
from collections import OrderedDict
from datetime import datetime
from time import monotonic
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.utils import timezone


SHANGHAI_TIME_ZONE = "Asia/Shanghai"
WEATHER_CACHE = OrderedDict()


class WeatherIntegrationError(Exception):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


WEATHER_DESCRIPTIONS = {
    0: "晴",
    1: "基本晴朗",
    2: "局部多云",
    3: "阴",
    45: "有雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "中等毛毛雨",
    55: "大毛毛雨",
    56: "冻毛毛雨",
    57: "强冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "小阵雨",
    81: "中等阵雨",
    82: "强阵雨",
    85: "小阵雪",
    86: "强阵雪",
    95: "雷暴",
    96: "雷暴伴小冰雹",
    99: "雷暴伴强冰雹",
}


def weather_description(code):
    return WEATHER_DESCRIPTIONS.get(code, "未知天气")


def value_at(values, index):
    if not isinstance(values, list):
        return None
    return values[index] if index < len(values) else None


def cache_date_key():
    return timezone.localtime(timezone.now()).date().isoformat()


def make_cache_key(validated):
    context_hash = hashlib.sha256(
        json.dumps(
            {
                "includeAdvice": bool(validated.get("includeAdvice", True)),
                "metrics": validated.get("metrics") or [],
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()[:12]
    return "|".join(
        [
            cache_date_key(),
            validated.get("cropId") or "unknown-crop",
            validated.get("greenhouseId") or "unknown-greenhouse",
            f"{validated['latitude']:.4f}",
            f"{validated['longitude']:.4f}",
            context_hash,
        ]
    )


def get_cached_weather(cache_key):
    cached = WEATHER_CACHE.get(cache_key)
    if not cached:
        return None

    expires_at, value = cached
    if expires_at <= monotonic():
        WEATHER_CACHE.pop(cache_key, None)
        return None

    WEATHER_CACHE.move_to_end(cache_key)
    return value


def set_cached_weather(cache_key, value):
    WEATHER_CACHE[cache_key] = (monotonic() + settings.WEATHER_CACHE_TTL_SECONDS, value)
    WEATHER_CACHE.move_to_end(cache_key)

    max_items = max(1, settings.WEATHER_CACHE_MAX_ITEMS)
    while len(WEATHER_CACHE) > max_items:
        WEATHER_CACHE.popitem(last=False)


def fetch_open_meteo_payload(latitude, longitude):
    query = urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "daily": (
                "weather_code,temperature_2m_max,temperature_2m_min,"
                "precipitation_probability_max,precipitation_sum,wind_speed_10m_max"
            ),
            "timezone": SHANGHAI_TIME_ZONE,
            "forecast_days": 3,
        }
    )
    url = f"https://api.open-meteo.com/v1/forecast?{query}"
    try:
        with urlopen(url, timeout=settings.WEATHER_FETCH_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise WeatherIntegrationError("Open-Meteo 天气预报获取失败") from exc
    if not isinstance(payload, dict):
        raise WeatherIntegrationError("Open-Meteo response format is invalid")
    return payload


def normalize_weather(payload, validated):
    current_payload = payload.get("current") or {}
    current_code = current_payload.get("weather_code")
    daily = payload.get("daily") or {}
    forecast_dates = daily.get("time") if isinstance(daily.get("time"), list) else []
    forecast = []
    for index, date in enumerate(forecast_dates[:3]):
        code = value_at(daily.get("weather_code"), index)
        forecast.append(
            {
                "date": date,
                "weatherCode": code,
                "description": weather_description(code),
                "temperatureMax": value_at(daily.get("temperature_2m_max"), index),
                "temperatureMin": value_at(daily.get("temperature_2m_min"), index),
                "precipitationProbabilityMax": value_at(daily.get("precipitation_probability_max"), index),
                "precipitationSum": value_at(daily.get("precipitation_sum"), index),
                "windSpeedMax": value_at(daily.get("wind_speed_10m_max"), index),
            }
        )

    return {
        "source": "Open-Meteo",
        "sourceUrl": "https://open-meteo.com/",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "location": {
            "latitude": validated["latitude"],
            "longitude": validated["longitude"],
            "address": validated.get("address", ""),
        },
        "current": {
            "time": current_payload.get("time", ""),
            "temperature": current_payload.get("temperature_2m"),
            "apparentTemperature": current_payload.get("apparent_temperature"),
            "humidity": current_payload.get("relative_humidity_2m"),
            "precipitation": current_payload.get("precipitation"),
            "windSpeed": current_payload.get("wind_speed_10m"),
            "weatherCode": current_code,
            "description": weather_description(current_code),
        },
        "forecast": forecast,
    }


def get_greenhouse_weather_advice(validated):
    cache_key = make_cache_key(validated)
    cached = get_cached_weather(cache_key)
    if cached:
        return cached

    payload = fetch_open_meteo_payload(validated["latitude"], validated["longitude"])
    weather = normalize_weather(payload, validated)
    result = {
        "cacheKey": cache_key,
        "cachedAt": timezone.now().isoformat(),
        "weather": weather,
        "advice": None,
        "adviceError": (
            "AI 操作建议尚未启用；当前仅返回 Open-Meteo 天气预报。"
            if validated.get("includeAdvice") is True
            else None
        ),
    }
    set_cached_weather(cache_key, result)
    return result
