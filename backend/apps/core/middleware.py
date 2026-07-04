import re
import uuid
from time import monotonic

from django.conf import settings
from django.db import connection
import logging

from .metrics import increment_counter, observe_histogram


REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
logger = logging.getLogger("apps.core.request")


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = monotonic()
        provided_request_id = (request.headers.get("X-Request-ID") or "").strip()
        request.request_id = (
            provided_request_id if REQUEST_ID_PATTERN.fullmatch(provided_request_id) else str(uuid.uuid4())
        )
        request._observability_query_start = len(getattr(connection, "queries", []))
        try:
            response = self.get_response(request)
        except Exception:
            duration_ms = round((monotonic() - started_at) * 1000, 2)
            self.record_request(request, 500, duration_ms, exception=True)
            raise

        duration_ms = round((monotonic() - started_at) * 1000, 2)
        response["X-Request-ID"] = request.request_id
        self.record_request(request, response.status_code, duration_ms, exception=False)
        return response

    def record_request(self, request, status_code, duration_ms, exception):
        path_template = getattr(getattr(request, "resolver_match", None), "route", "") or request.path
        user = getattr(request, "user", None)
        user_id = getattr(user, "id", None) if getattr(user, "is_authenticated", False) else None

        increment_counter(
            "smart_agri_http_requests_total",
            method=request.method,
            path=path_template,
            status=str(status_code),
        )
        observe_histogram(
            "smart_agri_http_request_duration_ms",
            duration_ms,
            method=request.method,
            path=path_template,
        )
        self.record_slow_queries(request)

        logger.info(
            "http_request_completed",
            extra={
                "request_id": getattr(request, "request_id", ""),
                "user_id": user_id,
                "path": request.path,
                "method": request.method,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "exception": exception,
            },
        )

    def record_slow_queries(self, request):
        slow_threshold_ms = int(getattr(settings, "DB_SLOW_QUERY_MS", 500))
        query_start = getattr(request, "_observability_query_start", 0)
        for query in getattr(connection, "queries", [])[query_start:]:
            try:
                duration_ms = float(query.get("time", 0)) * 1000
            except (TypeError, ValueError):
                continue
            if duration_ms >= slow_threshold_ms:
                increment_counter("smart_agri_slow_queries_total", path=request.path)
                observe_histogram("smart_agri_slow_query_duration_ms", duration_ms, path=request.path)
