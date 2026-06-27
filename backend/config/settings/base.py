import json
import os
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


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-local-development-only")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "apps.core",
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

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)


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

EXTERNAL_INTEGRATIONS_ENABLED = env_bool("EXTERNAL_INTEGRATIONS_ENABLED", False)

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPageNumberPagination",
    "PAGE_SIZE": 20,
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
        "structured": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}
