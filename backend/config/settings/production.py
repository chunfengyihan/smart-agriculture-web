import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403


DEBUG = False

if not os.environ.get("DJANGO_SECRET_KEY"):
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production")

if not ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production")
