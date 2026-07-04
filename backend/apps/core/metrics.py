import threading
from collections import defaultdict


_lock = threading.Lock()
_counters = defaultdict(float)
_histograms = defaultdict(list)


def increment_counter(name, amount=1, **labels):
    key = (name, tuple(sorted(labels.items())))
    with _lock:
        _counters[key] += amount


def observe_histogram(name, value, **labels):
    key = (name, tuple(sorted(labels.items())))
    with _lock:
        _histograms[key].append(float(value))


def reset_metrics():
    with _lock:
        _counters.clear()
        _histograms.clear()


def _format_labels(labels):
    if not labels:
        return ""
    rendered = ",".join(f'{key}="{value}"' for key, value in labels)
    return "{" + rendered + "}"


def render_prometheus_metrics():
    lines = [
        "# HELP smart_agri_http_requests_total HTTP requests grouped by method, path template, and status.",
        "# TYPE smart_agri_http_requests_total counter",
    ]

    with _lock:
        counters = dict(_counters)
        histograms = {key: list(values) for key, values in _histograms.items()}

    for (name, labels), value in sorted(counters.items()):
        lines.append(f"{name}{_format_labels(labels)} {value:g}")

    for (name, labels), values in sorted(histograms.items()):
        count = len(values)
        total = sum(values)
        lines.append(f"# TYPE {name} summary")
        lines.append(f"{name}_count{_format_labels(labels)} {count:g}")
        lines.append(f"{name}_sum{_format_labels(labels)} {total:g}")

    return "\n".join(lines) + "\n"


def record_external_call(service, duration_ms, success):
    observe_histogram("smart_agri_external_call_duration_ms", duration_ms, service=service, success=str(bool(success)).lower())
    increment_counter("smart_agri_external_calls_total", service=service, success=str(bool(success)).lower())


def record_cache_event(cache_name, hit):
    increment_counter("smart_agri_cache_events_total", cache=cache_name, result="hit" if hit else "miss")


def record_upload_failure(reason):
    increment_counter("smart_agri_upload_failures_total", reason=reason)
