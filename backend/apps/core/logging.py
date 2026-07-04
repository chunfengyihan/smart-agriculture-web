import json
import logging
from datetime import datetime, timezone


RESERVED_LOG_ATTRS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
}

SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "password",
    "secret",
    "token",
    "access_token",
    "accesstoken",
    "refresh_token",
    "refreshtoken",
    "appsecret",
    "app_secret",
    "session",
    "credential",
}


def sanitize_value(key, value):
    lowered = str(key).lower()
    if any(sensitive in lowered for sensitive in SENSITIVE_KEYS):
        return "[redacted]"
    if lowered == "request" and hasattr(value, "path_info"):
        return {
            "method": getattr(value, "method", ""),
            "path": getattr(value, "path_info", ""),
        }
    if isinstance(value, dict):
        return {item_key: sanitize_value(item_key, item_value) for item_key, item_value in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_value(key, item) for item in value]
    return value


class JsonLogFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in RESERVED_LOG_ATTRS or key.startswith("_"):
                continue
            payload[key] = sanitize_value(key, value)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
