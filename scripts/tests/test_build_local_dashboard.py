from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "build-local-dashboard.py"
SPEC = importlib.util.spec_from_file_location("build_local_dashboard", MODULE_PATH)
assert SPEC and SPEC.loader
dashboard_builder = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = dashboard_builder
SPEC.loader.exec_module(dashboard_builder)


class MetricInferenceTests(unittest.TestCase):
    def test_infers_air_and_soil_metrics(self) -> None:
        self.assertEqual(dashboard_builder.infer_metric("温度", "温度", "空气"), "airTemp")
        self.assertEqual(dashboard_builder.infer_metric("温度(1)", "温度", "土壤"), "soilTemp")
        self.assertEqual(dashboard_builder.infer_metric("湿度", "湿度", "空气"), "airHumidity")
        self.assertEqual(dashboard_builder.infer_metric("湿度(1)", "湿度", "土壤"), "soilHumidity")

    def test_infers_new_metrics(self) -> None:
        self.assertEqual(dashboard_builder.infer_metric("大气压力", "", "空气"), "pressure")
        self.assertEqual(dashboard_builder.infer_metric("土壤盐分", "", "土壤"), "salinity")


class AggregationTests(unittest.TestCase):
    def make_bucket(self):
        return dashboard_builder.GreenhouseBucket("jujube", "jujube-1", "一号棚", "一号数据")

    def test_keeps_light_zero_but_filters_other_zero_values(self) -> None:
        bucket = self.make_bucket()
        light_time = datetime(2026, 1, 5, 1)
        soil_time = datetime(2026, 1, 5, 2)

        dashboard_builder.ingest_reading(bucket, "light", light_time, 0.0)
        dashboard_builder.ingest_reading(bucket, "soilHumidity", soil_time, 0.0)

        self.assertEqual(bucket.daily["light"]["2026-01-05"].valid_count, 1)
        self.assertEqual(bucket.daily["soilHumidity"]["2026-01-05"].valid_count, 0)
        self.assertEqual(bucket.daily["soilHumidity"]["2026-01-05"].filtered_zero_count, 1)

    def test_deduplicates_metric_timestamps(self) -> None:
        bucket = self.make_bucket()
        timestamp = datetime(2026, 1, 5, 3)

        dashboard_builder.ingest_reading(bucket, "airTemp", timestamp, 20.0)
        dashboard_builder.ingest_reading(bucket, "airTemp", timestamp, 30.0)

        aggregate = bucket.daily["airTemp"]["2026-01-05"]
        self.assertEqual(aggregate.valid_count, 1)
        self.assertEqual(aggregate.average, 20.0)

    def test_tracks_minimum_maximum_average_and_invalid_records(self) -> None:
        bucket = self.make_bucket()
        dashboard_builder.ingest_reading(bucket, "airTemp", datetime(2026, 1, 5, 3), 18.0)
        dashboard_builder.ingest_reading(bucket, "airTemp", datetime(2026, 1, 5, 4), 22.0)
        dashboard_builder.ingest_reading(bucket, "airTemp", datetime(2026, 1, 5, 5), None)

        aggregate = bucket.daily["airTemp"]["2026-01-05"]
        self.assertEqual(aggregate.average, 20.0)
        self.assertEqual(aggregate.minimum, 18.0)
        self.assertEqual(aggregate.maximum, 22.0)
        self.assertEqual(aggregate.invalid_count, 1)


class GeneratedOutputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        output_path = Path(__file__).resolve().parents[2] / "public" / "data" / "historical-analytics.json"
        cls.payload = json.loads(output_path.read_text(encoding="utf-8"))

    def greenhouse(self, crop_id: str, greenhouse_id: str):
        crop = next(crop for crop in self.payload["crops"] if crop["id"] == crop_id)
        return next(greenhouse for greenhouse in crop["greenhouses"] if greenhouse["id"] == greenhouse_id)

    def test_contains_expected_period_and_greenhouses(self) -> None:
        self.assertEqual(self.payload["period"], {"start": "2026-01-05", "end": "2026-06-09"})
        self.greenhouse("jujube", "jujube-1")
        self.greenhouse("jujube", "jujube-2")
        self.greenhouse("blueberry", "blueberry-c1")
        self.greenhouse("blueberry", "blueberry-c2")

    def test_contains_pressure_and_salinity(self) -> None:
        series = self.greenhouse("jujube", "jujube-1")["series"]
        keys = {item["key"] for item in series}
        self.assertIn("pressure", keys)
        self.assertIn("salinity", keys)

    def test_generated_quality_counts_follow_zero_policy(self) -> None:
        series = {item["key"]: item for item in self.greenhouse("jujube", "jujube-2")["series"]}
        self.assertEqual(series["light"]["filteredZeroCount"], 0)
        self.assertGreater(series["soilHumidity"]["filteredZeroCount"], 0)
        self.assertGreater(series["ec"]["filteredZeroCount"], 0)
        self.assertGreater(series["salinity"]["filteredZeroCount"], 0)


if __name__ == "__main__":
    unittest.main()
