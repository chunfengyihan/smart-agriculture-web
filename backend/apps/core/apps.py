from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"

    def ready(self):
        from django.conf import settings
        from django.contrib import admin

        admin.site.site_url = settings.ADMIN_SITE_URL
