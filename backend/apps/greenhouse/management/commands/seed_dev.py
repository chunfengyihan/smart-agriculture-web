import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.greenhouse.models import DashboardSnapshot, EnvironmentReading, Greenhouse
from config.settings.base import REPO_DIR


METRIC_FIELD_BY_KEY = {
    "airTemp": "air_temp",
    "airHumidity": "air_humidity",
    "light": "light",
    "co2": "co2",
    "soilHumidity": "soil_humidity",
    "soilTemp": "soil_temp",
    "ec": "ec",
    "ph": "ph",
}


def aware_datetime(value):
    parsed = parse_datetime(value or "")
    if parsed is None:
        return timezone.now()
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone=timezone.utc)
    return parsed


def decimal_or_none(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


class Command(BaseCommand):
    help = "Seed local dashboard data for development."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default=str(REPO_DIR / "public" / "data" / "local-dashboard.json"),
            help="Path to local-dashboard.json.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        source_path = Path(options["source"])
        if not source_path.exists():
            raise CommandError(f"Seed source not found: {source_path}")

        payload = json.loads(source_path.read_text(encoding="utf-8"))
        snapshot_at = aware_datetime(payload.get("generatedAt"))
        source = payload.get("source") or "local"
        greenhouse_count = 0
        reading_count = 0

        for crop in payload.get("crops", []):
            crop_code = crop.get("id", "")
            for greenhouse_data in crop.get("greenhouses", []):
                greenhouse, _ = Greenhouse.objects.update_or_create(
                    code=greenhouse_data["id"],
                    defaults={
                        "name": greenhouse_data.get("name", greenhouse_data["id"]),
                        "location": greenhouse_data.get("area", ""),
                        "crop_code": crop_code,
                        "source": source,
                    },
                )
                greenhouse_count += 1

                reading_defaults = {"source": source}
                for metric in greenhouse_data.get("metrics", []):
                    field_name = METRIC_FIELD_BY_KEY.get(metric.get("key"))
                    if field_name:
                        reading_defaults[field_name] = decimal_or_none(metric.get("value"))

                EnvironmentReading.objects.update_or_create(
                    greenhouse=greenhouse,
                    recorded_at=snapshot_at,
                    source=source,
                    defaults=reading_defaults,
                )
                reading_count += 1

        DashboardSnapshot.objects.update_or_create(
            source=source,
            schema_version="dashboard-v1",
            snapshot_at=snapshot_at,
            defaults={
                "greenhouse": None,
                "payload": payload,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {greenhouse_count} greenhouses, {reading_count} readings, 1 dashboard snapshot."
            )
        )
