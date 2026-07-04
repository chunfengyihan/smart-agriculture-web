import json
import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=None):
    value = os.environ.get(name)
    if not value:
        return default or []
    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{name} must be an integer") from exc


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-local-development-only")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"])
LOG_FORMAT = os.environ.get("DJANGO_LOG_FORMAT", "json").strip().lower()
DB_SLOW_QUERY_MS = env_int("DB_SLOW_QUERY_MS", 500)
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
SENTRY_ENVIRONMENT = os.environ.get("SENTRY_ENVIRONMENT", "local")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0"))
PROMETHEUS_METRICS_ENABLED = env_bool("PROMETHEUS_METRICS_ENABLED", False)
API_AUTH_REQUIRED = env_bool("DJANGO_API_AUTH_REQUIRED", True)
API_AUTH_TOKEN = os.environ.get("DJANGO_API_AUTH_TOKEN", "")
API_KEY_HEADER = os.environ.get("DJANGO_API_KEY_HEADER", "X-API-Key")
API_KEY_ALLOWLIST = env_list("DJANGO_API_KEY_ALLOWLIST", [])
API_PUBLIC_PATHS = env_list(
    "DJANGO_API_PUBLIC_PATHS",
    [
        "/api/v1/health/",
        "/api/v1/schema/",
        "/api/v1/docs/",
        "/api/v1/redoc/",
        "/api/v1/auth/wechat-login",
        "/api/v1/auth/refresh",
    ],
)

INSTALLED_APPS = [
    "simpleui",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "apps.accounts",
    "apps.core",
    "apps.integrations",
    "apps.greenhouse",
    "apps.weather",
    "apps.ai_advisory",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
X_FRAME_OPTIONS = os.environ.get("DJANGO_X_FRAME_OPTIONS", "SAMEORIGIN")

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)

FRONTEND_DIST_DIR = Path(os.environ.get("DJANGO_FRONTEND_DIST_DIR", REPO_DIR / "dist"))
FRONTEND_SITE_URL = os.environ.get("DJANGO_FRONTEND_SITE_URL", "/")

PRIVATE_UPLOAD_ROOT = Path(os.environ.get("DJANGO_PRIVATE_UPLOAD_ROOT", REPO_DIR / ".runtime/private_uploads"))
PRIVATE_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
AI_UPLOAD_MAX_BYTES = env_int("AI_UPLOAD_MAX_BYTES", 8 * 1024 * 1024)
AI_UPLOAD_ALLOWED_CONTENT_TYPES = env_list(
    "AI_UPLOAD_ALLOWED_CONTENT_TYPES",
    ["image/jpeg", "image/png", "image/webp"],
)
AI_UPLOAD_SCAN_POLICY = os.environ.get("AI_UPLOAD_SCAN_POLICY", "hold_until_scanned")
AI_UPLOAD_SCAN_UNAVAILABLE_STRATEGY = os.environ.get(
    "AI_UPLOAD_SCAN_UNAVAILABLE_STRATEGY",
    "hold_and_block_use",
)
CLAMAV_ENABLED = env_bool("CLAMAV_ENABLED", False)
CLAMAV_HOST = os.environ.get("CLAMAV_HOST", "127.0.0.1")
CLAMAV_PORT = env_int("CLAMAV_PORT", 3310)
MINIO_UPLOADS_ENABLED = env_bool("MINIO_UPLOADS_ENABLED", False)
MINIO_UPLOADS_ENDPOINT = os.environ.get("MINIO_UPLOADS_ENDPOINT", "")
MINIO_UPLOADS_BUCKET = os.environ.get("MINIO_UPLOADS_BUCKET", "")
MINIO_UPLOADS_ACCESS_KEY = os.environ.get("MINIO_UPLOADS_ACCESS_KEY", "")
MINIO_UPLOADS_SECRET_KEY = os.environ.get("MINIO_UPLOADS_SECRET_KEY", "")

ADMIN_SITE_URL = os.environ.get("DJANGO_ADMIN_SITE_URL", FRONTEND_SITE_URL)
ADMIN_SITE_HEADER = os.environ.get("DJANGO_ADMIN_SITE_HEADER", "智慧农业管理后台")
ADMIN_SITE_TITLE = os.environ.get("DJANGO_ADMIN_SITE_TITLE", "智慧农业管理后台")
ADMIN_INDEX_TITLE = os.environ.get("DJANGO_ADMIN_INDEX_TITLE", "后台首页")

SIMPLEUI_HOME_TITLE = "智慧农业管理后台"
SIMPLEUI_HOME_ICON = "fa fa-leaf"
SIMPLEUI_INDEX = ADMIN_SITE_URL
SIMPLEUI_ANALYSIS = False


def sqlite_database():
    db_path = Path(os.environ.get("DJANGO_DB_PATH", ".runtime/local/db.sqlite3"))
    if not db_path.is_absolute():
        db_path = REPO_DIR / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(db_path),
    }


def mysql_ssl_options():
    ssl_paths = {
        "ca": os.environ.get("MYSQL_SSL_CA"),
        "cert": os.environ.get("MYSQL_SSL_CERT"),
        "key": os.environ.get("MYSQL_SSL_KEY"),
    }
    return {key: value for key, value in ssl_paths.items() if value}


def mysql_options():
    raw_options = os.environ.get("MYSQL_OPTIONS_JSON", "{}")
    try:
        options = json.loads(raw_options)
    except json.JSONDecodeError as exc:
        raise ImproperlyConfigured("MYSQL_OPTIONS_JSON is not valid JSON") from exc
    if not isinstance(options, dict):
        raise ImproperlyConfigured("MYSQL_OPTIONS_JSON must decode to an object")

    options.setdefault("charset", os.environ.get("MYSQL_CHARSET", "utf8mb4"))
    options.setdefault("init_command", "SET sql_mode='STRICT_TRANS_TABLES'")
    ssl_options = mysql_ssl_options()
    if ssl_options:
        options["ssl"] = ssl_options
    return options


def mysql_database():
    return {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("MYSQL_DB_NAME", ""),
        "USER": os.environ.get("MYSQL_DB_USER", ""),
        "PASSWORD": os.environ.get("MYSQL_DB_PASSWORD", ""),
        "HOST": os.environ.get("MYSQL_DB_HOST", ""),
        "PORT": os.environ.get("MYSQL_DB_PORT", "3306"),
        "CONN_MAX_AGE": int(os.environ.get("MYSQL_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": mysql_options(),
        "TEST": {
            "NAME": os.environ.get("MYSQL_TEST_DB_NAME") or None,
        },
    }


db_engine = os.environ.get("DB_ENGINE", "sqlite").strip().lower()
if db_engine == "sqlite":
    DATABASES = {"default": sqlite_database()}
elif db_engine == "mysql":
    DATABASES = {"default": mysql_database()}
else:
    raise ImproperlyConfigured("DB_ENGINE must be either 'sqlite' or 'mysql'")

CACHE_BACKEND = os.environ.get("DJANGO_CACHE_BACKEND", "locmem").strip().lower()
CACHE_KEY_PREFIX = os.environ.get("DJANGO_CACHE_KEY_PREFIX", "smart-agri")
if CACHE_BACKEND == "redis":
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.environ.get("REDIS_CACHE_URL", "redis://127.0.0.1:6379/1"),
            "KEY_PREFIX": CACHE_KEY_PREFIX,
            "TIMEOUT": None,
        }
    }
elif CACHE_BACKEND == "locmem":
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": os.environ.get("DJANGO_LOCMEM_CACHE_LOCATION", "smart-agri-local"),
            "KEY_PREFIX": CACHE_KEY_PREFIX,
            "TIMEOUT": None,
            "OPTIONS": {
                "MAX_ENTRIES": int(os.environ.get("DJANGO_LOCMEM_CACHE_MAX_ENTRIES", "512")),
            },
        }
    }
else:
    raise ImproperlyConfigured("DJANGO_CACHE_BACKEND must be either 'locmem' or 'redis'")

EXTERNAL_INTEGRATIONS_ENABLED = env_bool("EXTERNAL_INTEGRATIONS_ENABLED", False)
WEATHER_INTEGRATION_ENABLED = env_bool("WEATHER_INTEGRATION_ENABLED", EXTERNAL_INTEGRATIONS_ENABLED)
WEATHER_FETCH_TIMEOUT_SECONDS = float(os.environ.get("WEATHER_FETCH_TIMEOUT_SECONDS", "8"))
WEATHER_CACHE_TTL_SECONDS = int(os.environ.get("WEATHER_CACHE_TTL_SECONDS", str(6 * 60 * 60)))
WEATHER_FAILURE_CACHE_TTL_SECONDS = int(os.environ.get("WEATHER_FAILURE_CACHE_TTL_SECONDS", "60"))
WEATHER_CACHE_LOCK_SECONDS = int(os.environ.get("WEATHER_CACHE_LOCK_SECONDS", "30"))
WEATHER_SOURCE_NAME = os.environ.get("WEATHER_SOURCE_NAME", "Open-Meteo")

YOUREN_INTEGRATION_ENABLED = env_bool("YOUREN_INTEGRATION_ENABLED", EXTERNAL_INTEGRATIONS_ENABLED)
YOUREN_APP_KEY = os.environ.get("YOUREN_APP_KEY", "")
YOUREN_APP_SECRET = os.environ.get("YOUREN_APP_SECRET", "")
YOUREN_API_BASE = os.environ.get("YOUREN_API_BASE", "")
YOUREN_AUTH_PATH = os.environ.get("YOUREN_AUTH_PATH", "/usrCloud/user/getAuthToken")
YOUREN_FETCH_TIMEOUT_SECONDS = float(os.environ.get("YOUREN_FETCH_TIMEOUT_SECONDS", "8"))
YOUREN_TOKEN_TTL_SECONDS = int(os.environ.get("YOUREN_TOKEN_TTL_SECONDS", str(110 * 60)))
YOUREN_DASHBOARD_DEVICE_PAGE_SIZE = int(os.environ.get("YOUREN_DASHBOARD_DEVICE_PAGE_SIZE", "100"))
YOUREN_MAPPING_PATH = os.environ.get("YOUREN_MAPPING_PATH", "config/greenhouse.mapping.json")
GREENHOUSE_HISTORY_MAX_RANGE_DAYS = env_int("GREENHOUSE_HISTORY_MAX_RANGE_DAYS", 31)

WECHAT_MINIAPP_APPID = os.environ.get("WECHAT_MINIAPP_APPID", "")
WECHAT_MINIAPP_SECRET = os.environ.get("WECHAT_MINIAPP_SECRET", "")
WECHAT_CODE2SESSION_URL = os.environ.get(
    "WECHAT_CODE2SESSION_URL",
    "https://api.weixin.qq.com/sns/jscode2session",
)
WECHAT_CODE2SESSION_TIMEOUT_SECONDS = float(os.environ.get("WECHAT_CODE2SESSION_TIMEOUT_SECONDS", "5"))
WECHAT_LOGIN_MOCK_ENABLED = env_bool("WECHAT_LOGIN_MOCK_ENABLED", False)

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "apps.core.permissions.ApiKeyRequired",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "ai_upload": os.environ.get("DRF_AI_UPLOAD_THROTTLE_RATE", "20/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.environ.get("DJANGO_JWT_ACCESS_TOKEN_MINUTES", "30"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.environ.get("DJANGO_JWT_REFRESH_TOKEN_DAYS", "7"))
    ),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Smart Agriculture API",
    "DESCRIPTION": "Django API for the smart agriculture migration.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "apps.core.logging.JsonLogFormatter",
        },
        "plain": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json" if LOG_FORMAT == "json" else "plain",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
