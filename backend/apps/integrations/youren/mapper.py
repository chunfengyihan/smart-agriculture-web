import json
import math
from pathlib import Path

from django.conf import settings
from django.utils import timezone


METRIC_DEFS = {
    "airTemp": {
        "label": "空气温度",
        "unit": "°C",
        "target": "18-28°C",
        "keywords": ["空气温度", "气温", "温度", "temp"],
    },
    "airHumidity": {
        "label": "空气湿度",
        "unit": "%",
        "target": "55-80%",
        "keywords": ["空气湿度", "湿度", "humidity"],
    },
    "light": {
        "label": "光照强度",
        "unit": "lux",
        "target": "12k-38k",
        "keywords": ["光照", "照度", "light", "lux"],
    },
    "co2": {
        "label": "CO2",
        "unit": "ppm",
        "target": "420-900",
        "keywords": ["co2", "二氧化碳"],
    },
    "soilHumidity": {
        "label": "土壤湿度",
        "unit": "%",
        "target": "45-70%",
        "keywords": ["土壤湿度", "土湿", "墒情"],
    },
    "soilTemp": {
        "label": "土壤温度",
        "unit": "°C",
        "target": "16-25°C",
        "keywords": ["土壤温度", "地温"],
    },
    "ec": {
        "label": "土壤 EC",
        "unit": "mS/cm",
        "target": "0.8-1.8",
        "keywords": ["ec", "电导"],
    },
    "ph": {
        "label": "土壤 PH",
        "unit": "",
        "target": "5.8-7.2",
        "keywords": ["ph", "酸碱"],
    },
}


CROP_DEFAULTS = [
    {
        "id": "jujube",
        "name": "冰糖枣",
        "latinName": "Crystal Jujube",
        "description": "水肥一体化管理，重点监测昼夜温差、土壤墒情与光照积累。",
        "heroImage": (
            "https://commons.wikimedia.org/wiki/Special:FilePath/"
            "Ziziphus%20jujuba%20%27Li%27%20with%20fruit%20in%20mid-summer%20-%20live%20oak%20in%20background.JPG?width=1800"
        ),
        "accent": "#16a34a",
    },
    {
        "id": "blueberry",
        "name": "蓝莓",
        "latinName": "Blueberry",
        "description": "偏酸性基质栽培，重点关注 PH、EC、空气湿度和根区温度。",
        "heroImage": "https://commons.wikimedia.org/wiki/Special:FilePath/Blueray%20Blueberry%20Bush.JPG?width=1800",
        "accent": "#2563eb",
    },
    {
        "id": "cherry",
        "name": "樱桃",
        "latinName": "Cherry",
        "description": "精细化控温控湿，保障花果期稳定环境和病害风险预警。",
        "heroImage": "https://commons.wikimedia.org/wiki/Special:FilePath/Cherry%20fruit%20on%20tree.jpg?width=1800",
        "accent": "#dc2626",
    },
]


def read_mapping():
    mapping_path = Path(settings.YOUREN_MAPPING_PATH)
    if not mapping_path.is_absolute():
        mapping_path = settings.REPO_DIR / mapping_path
    if not mapping_path.exists():
        return None
    return json.loads(mapping_path.read_text(encoding="utf-8"))


def device_no(device):
    return device.get("deviceNo") or device.get("sn") or ""


class YourenMapper:
    def __init__(self, client):
        self.client = client

    def infer_metric_key(self, point):
        text = f"{point.get('name', '')} {point.get('dataIdentifier', '')}".lower()
        for key, definition in METRIC_DEFS.items():
            if any(keyword.lower() in text for keyword in definition["keywords"]):
                return key
        return None

    def status_from_device(self, device):
        status = device.get("deviceStatus") or {}
        if status.get("monitorAlarm") == 1:
            return "warning"
        if status.get("onlineOffline") == 0:
            return "offline"
        return "online"

    def metric_status(self, key, value):
        if value is None:
            return "warning"
        try:
            number_value = float(value)
        except (TypeError, ValueError):
            return "warning"
        if key == "airTemp" and (number_value < 12 or number_value > 32):
            return "warning"
        if key == "airHumidity" and (number_value < 40 or number_value > 85):
            return "warning"
        if key == "soilHumidity" and (number_value < 35 or number_value > 80):
            return "warning"
        if key == "ph" and (number_value < 5.2 or number_value > 7.8):
            return "warning"
        return "normal"

    def build_metric(self, key, value):
        definition = METRIC_DEFS[key]
        try:
            number_value = float(value)
            has_value = math.isfinite(number_value)
        except (TypeError, ValueError):
            number_value = None
            has_value = False
        normalized_value = number_value if has_value else None
        return {
            "key": key,
            "label": definition["label"],
            "value": normalized_value,
            "unit": definition["unit"],
            "status": self.metric_status(key, normalized_value),
            "target": definition["target"],
        }

    def build_trend(self, metrics):
        by_key = {metric["key"]: metric["value"] for metric in metrics}

        def waved(key, offset, transform):
            value = by_key.get(key)
            if value is None:
                return None
            return transform(float(value) + offset)

        return [
            {
                "time": f"{index:02d}:00",
                "airTemp": waved("airTemp", math.sin(index / 4) * 1.4, lambda value: round(value, 1)),
                "airHumidity": waved("airHumidity", math.cos(index / 5) * 3, round),
                "soilHumidity": waved("soilHumidity", math.sin(index / 6) * 2, round),
                "light": waved("light", math.sin(index / 3) * 4000, lambda value: max(0, round(value))),
            }
            for index in range(24)
        ]

    def point_mappings(self, points, mapping_item):
        if mapping_item and mapping_item.get("metrics"):
            return mapping_item["metrics"]
        inferred = {}
        for point in points:
            key = self.infer_metric_key(point)
            if key:
                inferred[key] = point.get("dataPointId") or point.get("dataPointRelId")
        return inferred

    def greenhouse_from_device(self, device, mapping_item=None):
        mapping_item = mapping_item or {}
        current_device_no = mapping_item.get("deviceNo") or device_no(device)
        points = self.client.get_data_points(current_device_no)
        point_mappings = self.point_mappings(points, mapping_item)
        requests = [
            {
                "key": key,
                "deviceNo": current_device_no,
                "dataPointId": int(data_point_id),
                "slaveIndex": "1",
            }
            for key, data_point_id in list(point_mappings.items())[:10]
            if data_point_id
        ]
        latest = self.client.get_latest_history(
            [
                {
                    "deviceNo": item["deviceNo"],
                    "dataPointId": item["dataPointId"],
                    "slaveIndex": item["slaveIndex"],
                }
                for item in requests
            ]
        )
        value_by_point_id = {
            int(item.get("dataPointId")): item.get("value")
            for item in latest
            if item.get("dataPointId") is not None
        }
        metrics = [
            self.build_metric(request["key"], value_by_point_id.get(request["dataPointId"]))
            for request in requests
        ]
        status = self.status_from_device(device)
        return {
            "id": mapping_item.get("id") or current_device_no,
            "name": mapping_item.get("name") or device.get("deviceName") or f"大棚 {current_device_no}",
            "area": mapping_item.get("area") or device.get("projectName") or "有人云",
            "status": status,
            "onlineDevices": 0 if status == "offline" else 1,
            "totalDevices": 1,
            "metrics": metrics,
            "trend": self.build_trend(metrics),
            "alerts": [
                {
                    "id": f"{current_device_no}-{metric['key']}",
                    "level": "critical" if metric["status"] == "critical" else "warning",
                    "message": (
                        f"{metric['label']} 当前值"
                        f"{'无数据' if metric['value'] is None else str(metric['value']) + metric['unit']}，"
                        f"请检查目标范围 {metric['target']}"
                    ),
                    "time": timezone.localtime(timezone.now()).strftime("%H:%M"),
                }
                for metric in metrics
                if metric["status"] != "normal"
            ],
        }

    def build_dashboard(self, devices, mapping=None):
        mapping = mapping if mapping is not None else read_mapping()
        by_device_no = {device_no(device): device for device in devices}
        if mapping and mapping.get("crops"):
            crop_configs = mapping["crops"]
        else:
            crop_configs = []
            for index, crop in enumerate(CROP_DEFAULTS):
                greenhouses = [
                    {
                        "deviceNo": device_no(device),
                        "name": device.get("deviceName"),
                        "area": device.get("projectName"),
                    }
                    for device_index, device in enumerate(devices)
                    if device_index % len(CROP_DEFAULTS) == index
                ][:3]
                crop_configs.append({**crop, "greenhouses": greenhouses})

        crops = []
        for crop_config in crop_configs:
            crop_default = next(
                (crop for crop in CROP_DEFAULTS if crop["id"] == crop_config.get("id")),
                CROP_DEFAULTS[0],
            )
            greenhouses = []
            for greenhouse_config in crop_config.get("greenhouses") or []:
                mapped_device_no = greenhouse_config.get("deviceNo")
                device = by_device_no.get(mapped_device_no) or {"deviceNo": mapped_device_no}
                greenhouses.append(self.greenhouse_from_device(device, greenhouse_config))
            crops.append({**crop_default, **crop_config, "greenhouses": greenhouses})

        return {
            "generatedAt": timezone.now().isoformat(),
            "source": "youren",
            "crops": crops,
        }
