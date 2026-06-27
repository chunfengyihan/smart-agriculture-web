from django.contrib import admin
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import Client, TestCase


class AdminSiteTests(TestCase):
    def test_root_redirects_to_admin(self):
        response = Client().get("/")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/admin/")

    def test_admin_requires_login(self):
        response = Client().get("/admin/")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_admin_view_site_points_to_frontend(self):
        self.assertEqual(admin.site.site_url, "http://127.0.0.1:5173/")
        self.assertEqual(settings.SIMPLEUI_INDEX, "http://127.0.0.1:5173/")

    def test_admin_home_renders_frontend_view_site_link(self):
        user = get_user_model().objects.create_superuser(
            username="admin-test",
            email="",
            password="admin-test-password",
        )
        client = Client()
        client.force_login(user)

        response = client.get("/admin/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "django-simpleui")
        self.assertContains(response, '<html lang="zh-hans"', html=False)
        self.assertContains(response, "智慧农业管理后台")
        self.assertContains(response, "goIndex('http://127.0.0.1:5173/')")

    def test_simpleui_loads_before_django_admin(self):
        self.assertLess(
            settings.INSTALLED_APPS.index("simpleui"),
            settings.INSTALLED_APPS.index("django.contrib.admin"),
        )

    def test_admin_default_language_is_chinese(self):
        self.assertEqual(settings.LANGUAGE_CODE, "zh-hans")
