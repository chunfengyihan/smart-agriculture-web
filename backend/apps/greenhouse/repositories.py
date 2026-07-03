from django.db.models import Prefetch

from .models import Alert, Device, EnvironmentReading, Greenhouse


class GreenhouseRepository:
    def dashboard_greenhouses(self):
        return (
            Greenhouse.objects.prefetch_related(
                Prefetch("devices", queryset=Device.objects.order_by("code")),
                Prefetch(
                    "alerts",
                    queryset=Alert.objects.filter(resolved_at__isnull=True).order_by("-triggered_at", "-id"),
                    to_attr="active_alerts",
                ),
            )
            .order_by("crop_code", "code")
        )

    def readings_for_dashboard(self, greenhouse_ids, limit_per_greenhouse=24):
        readings_by_greenhouse = {}
        if not greenhouse_ids:
            return readings_by_greenhouse

        queryset = (
            EnvironmentReading.objects.filter(greenhouse_id__in=greenhouse_ids)
            .order_by("greenhouse_id", "-recorded_at", "-id")
        )
        counts = {}
        for reading in queryset:
            count = counts.get(reading.greenhouse_id, 0)
            if count >= limit_per_greenhouse:
                continue
            readings_by_greenhouse.setdefault(reading.greenhouse_id, []).append(reading)
            counts[reading.greenhouse_id] = count + 1
        return readings_by_greenhouse

    def query_readings(self, *, greenhouse=None, start=None, end=None, metric_type=None):
        queryset = EnvironmentReading.objects.select_related("greenhouse").order_by("-recorded_at", "-id")
        if greenhouse:
            queryset = queryset.filter(greenhouse__code=greenhouse)
        if start:
            queryset = queryset.filter(recorded_at__gte=start)
        if end:
            queryset = queryset.filter(recorded_at__lte=end)
        if metric_type:
            queryset = queryset.filter(metric_type=metric_type)
        return queryset
