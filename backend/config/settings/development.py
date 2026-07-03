from .base import *  # noqa: F403


DEBUG = env_bool("DJANGO_DEBUG", True)  # noqa: F405
API_AUTH_REQUIRED = env_bool("DJANGO_API_AUTH_REQUIRED", False)  # noqa: F405
