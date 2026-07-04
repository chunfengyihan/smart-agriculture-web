import hashlib
import json
from datetime import datetime
from time import monotonic
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.core.metrics import record_cache_event, record_external_call


SHANGHAI_TIME_ZONE = "Asia/Shanghai"
CACHE_VERSION = "v2"


class WeatherIntegrationError(Exception):
    def __init__(self, message, status_code=502, degraded=None):
        super().__init__(message)
        self.status_code = status_code
        self.degraded = degraded or {}


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


def safe_key_part(value):
    return str(value).replace(":", "_").replace("|", "_").replace(" ", "_")


def make_cache_key(validated):
    context_hash = hashlib.sha256(
        json.dumps(
            {
                "includeAdvice": bool(validated.get("includeAdvice", True)),
                "metrics": validated.get("metrics") or [],
                "source": settings.WEATHER_SOURCE_NAME,
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()[:12]
    location_key = validated.get("greenhouseId") or validated.get("address") or "unknown-location"
    key_parts = [
        CACHE_VERSION,
        "weather",
        settings.WEATHER_SOURCE_NAME,
        cache_date_key(),
        validated.get("cropId") or "unknown-crop",
        location_key,
        f"{validated['latitude']:.4f}",
        f"{validated['longitude']:.4f}",
        context_hash,
    ]
    return ":".join(safe_key_part(part) for part in key_parts)


def cache_lock_key(cache_key):
    return f"{cache_key}:lock"


def cache_failure_key(cache_key):
    return f"{cache_key}:failure"


def get_cached_weather(cache_key):
    value = cache.get(cache_key)
    record_cache_event("weather", value is not None)
    return value


def set_cached_weather(cache_key, value):
    cache.set(cache_key, value, timeout=settings.WEATHER_CACHE_TTL_SECONDS)


def get_cached_failure(cache_key):
    value = cache.get(cache_failure_key(cache_key))
    record_cache_event("weather_failure", value is not None)
    return value


def set_cached_failure(cache_key, message):
    cache.set(
        cache_failure_key(cache_key),
        {
            "degraded": True,
            "source": settings.WEATHER_SOURCE_NAME,
            "message": message,
            "cachedAt": timezone.now().isoformat(),
        },
        timeout=settings.WEATHER_FAILURE_CACHE_TTL_SECONDS,
    )


def acquire_weather_lock(cache_key):
    return cache.add(cache_lock_key(cache_key), True, timeout=settings.WEATHER_CACHE_LOCK_SECONDS)


def release_weather_lock(cache_key):
    cache.delete(cache_lock_key(cache_key))


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
    started_at = monotonic()
    try:
        with urlopen(url, timeout=settings.WEATHER_FETCH_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        record_external_call("open_meteo", (monotonic() - started_at) * 1000, False)
        raise WeatherIntegrationError("Open-Meteo 天气预报获取失败") from exc
    record_external_call("open_meteo", (monotonic() - started_at) * 1000, True)
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
        "source": settings.WEATHER_SOURCE_NAME,
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


def build_weather_result(cache_key, weather, validated):
    return {
        "cacheKey": cache_key,
        "cachedAt": timezone.now().isoformat(),
        "cacheBackend": settings.CACHE_BACKEND,
        "weather": weather,
        "advice": None,
        "adviceError": (
            "AI 操作建议尚未启用；当前仅返回 Open-Meteo 天气预报。"
            if validated.get("includeAdvice") is True
            else None
        ),
    }


def cached_failure_error(cached_failure):
    return WeatherIntegrationError(
        cached_failure["message"],
        status_code=503,
        degraded=cached_failure,
    )


def get_greenhouse_weather_advice(validated):
    cache_key = make_cache_key(validated)
    cached = get_cached_weather(cache_key)
    if cached:
        return cached

    cached_failure = get_cached_failure(cache_key)
    if cached_failure:
        raise cached_failure_error(cached_failure)

    lock_acquired = acquire_weather_lock(cache_key)
    if not lock_acquired:
        cached = get_cached_weather(cache_key)
        if cached:
            return cached
        cached_failure = get_cached_failure(cache_key)
        if cached_failure:
            raise cached_failure_error(cached_failure)
        raise WeatherIntegrationError(
            "Weather request is already in progress",
            status_code=503,
            degraded={
                "degraded": True,
                "source": settings.WEATHER_SOURCE_NAME,
                "message": "Weather request is already in progress",
            },
        )

    try:
        payload = fetch_open_meteo_payload(validated["latitude"], validated["longitude"])
        weather = normalize_weather(payload, validated)
        result = build_weather_result(cache_key, weather, validated)
        set_cached_weather(cache_key, result)
        return result
    except WeatherIntegrationError as exc:
        set_cached_failure(cache_key, str(exc))
        exc.degraded = {
            "degraded": True,
            "source": settings.WEATHER_SOURCE_NAME,
            "message": str(exc),
        }
        raise
    finally:
        release_weather_lock(cache_key)
