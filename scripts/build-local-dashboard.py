from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from statistics import mean

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "local-dashboard.json"
MAX_ROWS_PER_SHEET = 4000

CROPS = {
    "jujube": {
        "id": "jujube",
        "name": "冰糖枣",
        "latinName": "Crystal Jujube",
        "description": "本地 Excel 采集数据汇总，重点关注昼夜温差、土壤墒情与光照积累。",
        "heroImage": "/images/jujube-hero.jpg",
        "accent": "#16a34a",
        "greenhouses": [],
    },
    "blueberry": {
        "id": "blueberry",
        "name": "蓝莓",
        "latinName": "Blueberry",
        "description": "本地 Excel 采集数据汇总，重点关注基质湿度、温度、EC 与空气环境。",
        "heroImage": "/images/blueberry-hero.jpg",
        "accent": "#2563eb",
        "greenhouses": [],
    },
    "cherry": {
        "id": "cherry",
        "name": "樱桃",
        "latinName": "Cherry",
        "description": "当前本地文件夹尚未识别到樱桃采集数据，页面已预留接入位置。",
        "heroImage": "/images/cherry-hero.jpg",
        "accent": "#dc2626",
        "greenhouses": [],
    },
}

METRIC_META = {
    "airTemp": {"label": "空气温度", "unit": "°C", "target": "18-28°C"},
    "airHumidity": {"label": "空气湿度", "unit": "%", "target": "55-80%"},
    "light": {"label": "光照强度", "unit": "lux", "target": "12k-38k"},
    "co2": {"label": "CO2", "unit": "ppm", "target": "420-900"},
    "soilHumidity": {"label": "土壤湿度", "unit": "%", "target": "45-70%"},
    "soilTemp": {"label": "土壤温度", "unit": "°C", "target": "16-25°C"},
    "ec": {"label": "土壤 EC", "unit": "mS/cm", "target": "0.8-1.8"},
    "ph": {"label": "土壤 PH", "unit": "", "target": "5.8-7.2"},
}


@dataclass
class Reading:
    timestamp: datetime
    value: float


@dataclass
class GreenhouseBucket:
    crop_id: str
    greenhouse_id: str
    name: str
    area: str
    device_no: str = ""
    metrics: dict[str, list[Reading]] = field(default_factory=lambda: defaultdict(list))


def find_data_dir() -> Path:
    for path in ROOT.iterdir():
        if path.is_dir() and path.name.startswith("2026") and "数据采集" in path.name:
            return path
    raise FileNotFoundError("未找到本地数据采集文件夹")


def crop_and_greenhouse(folder_name: str) -> tuple[str, str, str]:
    lowered = folder_name.lower()
    if "冰糖枣" in folder_name:
        number = "2" if "2" in folder_name else "1"
        return "jujube", f"jujube-{number}", f"冰糖枣 {number} 号棚"
    if "蓝莓" in folder_name:
        code = "C2" if "c2" in lowered else "C1"
        return "blueberry", f"blueberry-{code.lower()}", f"蓝莓 {code} 棚"
    return "jujube", folder_name, folder_name


def parse_time(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if value is None:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def parse_float(value) -> float | None:
    if value is None:
        return None
    try:
        number = float(str(value).strip())
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def infer_metric(sheet: str, variable: str, slave: str) -> str | None:
    text = f"{sheet} {variable} {slave}".lower()
    is_soil = "土壤" in text

    if "二氧化碳" in text or "co2" in text:
        return "co2"
    if "光照" in text:
        return "light"
    if "ph" in text:
        return "ph"
    if "电导" in text or "ec" in text:
        return "ec"
    if "湿度" in text:
        return "soilHumidity" if is_soil else "airHumidity"
    if "温度" in text:
        return "soilTemp" if is_soil else "airTemp"
    return None


def metric_status(key: str, value: float) -> str:
    if key == "airTemp" and not 12 <= value <= 32:
        return "warning"
    if key == "airHumidity" and not 40 <= value <= 85:
        return "warning"
    if key == "soilHumidity" and not 35 <= value <= 80:
        return "warning"
    if key == "ph" and not 5.2 <= value <= 7.8:
        return "warning"
    return "normal"


def build_trend(bucket: GreenhouseBucket) -> list[dict]:
    all_times = [reading.timestamp for readings in bucket.metrics.values() for reading in readings]
    if not all_times:
        return []

    latest_day = max(all_times).date()
    rows = []
    for hour in range(24):
        item = {"time": f"{hour:02d}:00"}
        for key in ("airTemp", "airHumidity", "soilHumidity", "light"):
            values = [
                reading.value
                for reading in bucket.metrics.get(key, [])
                if reading.timestamp.date() == latest_day and reading.timestamp.hour == hour
            ]
            fallback = bucket.metrics.get(key, [])[-1].value if bucket.metrics.get(key) else 0
            value = mean(values) if values else fallback
            item[key] = round(value, 1) if key == "airTemp" else round(value)
        rows.append(item)
    return rows


def build_metrics(bucket: GreenhouseBucket) -> list[dict]:
    metrics = []
    for key, meta in METRIC_META.items():
        readings = sorted(bucket.metrics.get(key, []), key=lambda item: item.timestamp)
        if not readings:
            continue
        value = readings[-1].value
        metrics.append(
            {
                "key": key,
                "label": meta["label"],
                "value": round(value, 2),
                "unit": meta["unit"],
                "status": metric_status(key, value),
                "target": meta["target"],
            }
        )
    return metrics


def build_alerts(metrics: list[dict]) -> list[dict]:
    alerts = []
    for metric in metrics:
        if metric["status"] != "normal":
            alerts.append(
                {
                    "id": f"local-{metric['key']}",
                    "level": "warning",
                    "message": f"{metric['label']} 当前值 {metric['value']}{metric['unit']}，建议复核目标范围 {metric['target']}。",
                    "time": datetime.now().strftime("%H:%M"),
                }
            )
    return alerts


def read_workbooks() -> dict[str, GreenhouseBucket]:
    data_dir = find_data_dir()
    buckets: dict[str, GreenhouseBucket] = {}
    latest_workbooks = {}

    for workbook_path in data_dir.rglob("*.xlsx"):
        current = latest_workbooks.get(workbook_path.parent)
        if current is None or workbook_path.stat().st_mtime > current.stat().st_mtime:
            latest_workbooks[workbook_path.parent] = workbook_path

    for workbook_path in sorted(latest_workbooks.values()):
        crop_id, greenhouse_id, greenhouse_name = crop_and_greenhouse(workbook_path.parent.name)
        bucket = buckets.setdefault(
            greenhouse_id,
            GreenhouseBucket(
                crop_id=crop_id,
                greenhouse_id=greenhouse_id,
                name=greenhouse_name,
                area=workbook_path.parent.name,
            ),
        )

        workbook = load_workbook(workbook_path, read_only=True, data_only=True)
        for sheet in workbook.worksheets:
            sheet.reset_dimensions()
            rows = sheet.iter_rows(values_only=True)
            headers = [str(value).strip() if value is not None else "" for value in next(rows, [])]
            if "时间" not in headers or "值" not in headers:
                continue

            index = {name: position for position, name in enumerate(headers)}
            for row_number, row in enumerate(rows, start=1):
                if row_number > MAX_ROWS_PER_SHEET:
                    break
                variable = row[index.get("变量名称", -1)] if index.get("变量名称", -1) >= 0 else ""
                slave = row[index.get("从机名称", -1)] if index.get("从机名称", -1) >= 0 else ""
                metric_key = infer_metric(sheet.title, str(variable), str(slave))
                timestamp = parse_time(row[index["时间"]])
                value = parse_float(row[index["值"]])
                if not metric_key or timestamp is None or value is None:
                    continue
                if not bucket.device_no and "设备编号" in index:
                    bucket.device_no = str(row[index["设备编号"]])
                bucket.metrics[metric_key].append(Reading(timestamp=timestamp, value=value))
    return buckets


def main() -> None:
    buckets = read_workbooks()
    crops = {crop_id: {**crop, "greenhouses": []} for crop_id, crop in CROPS.items()}

    for bucket in sorted(buckets.values(), key=lambda item: item.greenhouse_id):
        metrics = build_metrics(bucket)
        alerts = build_alerts(metrics)
        crops[bucket.crop_id]["greenhouses"].append(
            {
                "id": bucket.greenhouse_id,
                "name": bucket.name,
                "area": bucket.area,
                "status": "warning" if alerts else "online",
                "onlineDevices": 1,
                "totalDevices": 1,
                "metrics": metrics,
                "trend": build_trend(bucket),
                "alerts": alerts,
            }
        )

    dashboard = {
        "generatedAt": datetime.now().isoformat(),
        "source": "local",
        "crops": list(crops.values()),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}")
    for crop in dashboard["crops"]:
        print(f"{crop['name']}: {len(crop['greenhouses'])} greenhouses")


if __name__ == "__main__":
    main()
