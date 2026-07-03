from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from .models import Device
from .repositories import GreenhouseRepository


METRIC_CONFIG = {
    "airTemp": {"field": "air_temp", "label": "空气温度", "unit": "°C", "target": "18-28°C"},
    "airHumidity": {"field": "air_humidity", "label": "空气湿度", "unit": "%", "target": "55-80%"},
    "light": {"field": "light", "label": "光照强度", "unit": "lux", "target": "12k-38k"},
    "co2": {"field": "co2", "label": "CO2", "unit": "ppm", "target": "420-900"},
    "soilHumidity": {"field": "soil_humidity", "label": "土壤湿度", "unit": "%", "target": "45-70%"},
    "soilTemp": {"field": "soil_temp", "label": "土壤温度", "unit": "°C", "target": "16-25°C"},
    "ec": {"field": "ec", "label": "土壤 EC", "unit": "mS/cm", "target": "0.8-1.8"},
    "ph": {"field": "ph", "label": "土壤 PH", "unit": "", "target": "5.8-7.2"},
}


CROP_CONFIG = {
    "jujube": {
        "id": "jujube",
        "name": "冰糖枣",
        "latinName": "Crystal Jujube",
        "description": "本地模型数据汇总，重点关注昼夜温差、土壤墒情与光照积累。",
        "heroImage": "/images/jujube-hero.jpg",
        "accent": "#16a34a",
    },
    "blueberry": {
        "id": "blueberry",
        "name": "蓝莓",
        "latinName": "Blueberry",
        "description": "偏酸性基质栽培，重点关注 PH、EC、空气湿度和根区温度。",
        "heroImage": "/images/blueberry-hero.jpg",
        "accent": "#2563eb",
    },
    "cherry": {
        "id": "cherry",
        "name": "樱桃",
        "latinName": "Cherry",
        "description": "精细化控温控湿，保障花果期稳定环境和病害风险预警。",
        "heroImage": "/images/cherry-hero.jpg",
        "accent": "#dc2626",
    },
}


def number_or_none(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def metric_status(key, value):
    if value is None:
        return "warning"
    if key == "airTemp" and (value < 12 or value > 32):
        return "warning"
    if key == "airHumidity" and (value < 40 or value > 85):
        return "warning"
    if key == "soilHumidity" and (value < 35 or value > 80):
        return "warning"
    if key == "ph" and (value < 5.2 or value > 7.8):
        return "warning"
    return "normal"


def build_metric(key, reading):
    config = METRIC_CONFIG[key]
    value = number_or_none(getattr(reading, config["field"]))
    return {
        "key": key,
        "label": config["label"],
        "value": value,
        "unit": config["unit"],
        "status": metric_status(key, value),
        "target": config["target"],
    }


def build_trend(readings):
    if not readings:
        return []
    ordered = list(reversed(readings[:24]))
    if len(ordered) < 24:
        latest = readings[0]
        existing_by_time = {
            timezone.localtime(reading.recorded_at).replace(minute=0, second=0, microsecond=0): reading
            for reading in ordered
        }
        end_time = timezone.localtime(latest.recorded_at).replace(minute=0, second=0, microsecond=0)
        ordered_items = [
            (
                end_time - timedelta(hours=23 - index),
                existing_by_time.get(end_time - timedelta(hours=23 - index), latest),
            )
            for index in range(24)
        ]
    else:
        ordered_items = [(timezone.localtime(reading.recorded_at), reading) for reading in ordered]
    return [
        {
            "time": slot.strftime("%H:%M"),
            "airTemp": number_or_none(reading.air_temp),
            "airHumidity": number_or_none(reading.air_humidity),
            "soilHumidity": number_or_none(reading.soil_humidity),
            "light": number_or_none(reading.light),
        }
        for slot, reading in ordered_items
    ]


def device_counts(devices, latest_reading):
    if devices:
        total = len(devices)
        online = sum(1 for device in devices if device.status != Device.STATUS_OFFLINE)
        if any(device.status == Device.STATUS_WARNING for device in devices):
            status = "warning"
        elif online == 0:
            status = "offline"
        else:
            status = "online"
        return online, total, status

    if latest_reading:
        return 1, 1, "online"
    return 0, 0, "offline"


def alert_payload(alert):
    return {
        "id": str(alert.id),
        "level": alert.level,
        "message": alert.message,
        "time": timezone.localtime(alert.triggered_at).strftime("%H:%M"),
    }


def derived_alerts(greenhouse_code, metrics):
    return [
        {
            "id": f"{greenhouse_code}-{metric['key']}",
            "level": "warning" if metric["status"] == "warning" else metric["status"],
            "message": (
                f"{metric['label']} 当前值"
                f"{'无数据' if metric['value'] is None else str(metric['value']) + metric['unit']}，"
                f"请检查目标范围 {metric['target']}"
            ),
            "time": timezone.localtime(timezone.now()).strftime("%H:%M"),
        }
        for metric in metrics
        if metric["status"] != "normal"
    ]


class DashboardService:
    def __init__(self, repository=None):
        self.repository = repository or GreenhouseRepository()

    def build_from_models(self):
        greenhouses = list(self.repository.dashboard_greenhouses())
        greenhouse_ids = [greenhouse.id for greenhouse in greenhouses]
        readings_by_greenhouse = self.repository.readings_for_dashboard(greenhouse_ids)
        if not greenhouses or not readings_by_greenhouse:
            return None

        crops = defaultdict(list)
        generated_at = None
        source = "local"

        for greenhouse in greenhouses:
            readings = readings_by_greenhouse.get(greenhouse.id, [])
            if not readings:
                continue
            latest = readings[0]
            generated_at = max(generated_at, latest.recorded_at) if generated_at else latest.recorded_at
            source = latest.source or source
            metrics = [build_metric(key, latest) for key in METRIC_CONFIG]
            devices = list(greenhouse.devices.all())
            online_devices, total_devices, device_status = device_counts(devices, latest)
            alerts = [alert_payload(alert) for alert in getattr(greenhouse, "active_alerts", [])]
            if not alerts:
                alerts = derived_alerts(greenhouse.code, metrics)
            status = "warning" if alerts else device_status
            if device_status == "offline":
                status = "offline"

            crops[greenhouse.crop_code or "unknown"].append(
                {
                    "id": greenhouse.code,
                    "name": greenhouse.name,
                    "area": greenhouse.location,
                    "status": status,
                    "onlineDevices": online_devices,
                    "totalDevices": total_devices,
                    "metrics": metrics,
                    "trend": build_trend(readings),
                    "alerts": alerts,
                }
            )

        crop_payloads = [
            {**config, "greenhouses": crops.get(crop_code, [])}
            for crop_code, config in CROP_CONFIG.items()
        ]
        for crop_code in sorted(code for code in crops if code not in CROP_CONFIG):
            crop_payloads.append(
                {
                    "id": crop_code,
                    "name": crop_code or "未分类作物",
                    "latinName": "",
                    "description": "",
                    "heroImage": "",
                    "accent": "#64748b",
                    "greenhouses": crops[crop_code],
                }
            )

        if not crop_payloads:
            return None
        return {
            "generatedAt": (generated_at or timezone.now()).isoformat(),
            "source": source,
            "crops": crop_payloads,
        }


def build_dashboard_from_models():
    return DashboardService().build_from_models()
