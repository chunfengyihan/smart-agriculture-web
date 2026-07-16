from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import Client, TestCase, override_settings


class AdminSiteTests(TestCase):
    def test_root_serves_frontend_index(self):
        with TemporaryDirectory() as temp_dir:
            Path(temp_dir, "index.html").write_text("<html>frontend</html>", encoding="utf-8")

            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir)):
                response = Client().get("/")
                content = b"".join(response.streaming_content)
                response.close()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        self.assertEqual(content.decode("utf-8"), "<html>frontend</html>")

    def test_frontend_asset_serves_dist_file(self):
        with TemporaryDirectory() as temp_dir:
            assets_dir = Path(temp_dir, "assets")
            assets_dir.mkdir()
            Path(assets_dir, "app.js").write_text("console.log('frontend')", encoding="utf-8")

            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir)):
                response = Client().get("/assets/app.js")
                content = b"".join(response.streaming_content)
                response.close()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"console.log('frontend')", content)

    def test_frontend_spa_routes_serve_index(self):
        with TemporaryDirectory() as temp_dir:
            Path(temp_dir, "index.html").write_text("<html>frontend routes</html>", encoding="utf-8")

            with override_settings(FRONTEND_DIST_DIR=Path(temp_dir)):
                for route in (
                    "/monitoring",
                    "/map",
                    "/analytics",
                    "/analytics/wall",
                    "/analytics/wall/trends",
                    "/intelligence",
                ):
                    with self.subTest(route=route):
                        response = Client().get(route)
                        content = b"".join(response.streaming_content)
                        response.close()

                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
                        self.assertEqual(content.decode("utf-8"), "<html>frontend routes</html>")

    def test_frontend_spa_fallback_does_not_capture_unknown_api_route(self):
        response = Client().get("/api/not-a-real-route")

        self.assertEqual(response.status_code, 404)

    def test_frontend_spa_fallback_does_not_capture_unknown_file_path(self):
        response = Client().get("/private/not-a-real-file.png")

        self.assertEqual(response.status_code, 404)

    def test_admin_requires_login(self):
        response = Client().get("/admin/")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_admin_view_site_points_to_frontend(self):
        self.assertEqual(admin.site.site_url, "/")
        self.assertEqual(settings.SIMPLEUI_INDEX, "/")

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
        self.assertContains(response, "goIndex('/')")

    def test_simpleui_loads_before_django_admin(self):
        self.assertLess(
            settings.INSTALLED_APPS.index("simpleui"),
            settings.INSTALLED_APPS.index("django.contrib.admin"),
        )

    def test_admin_default_language_is_chinese(self):
        self.assertEqual(settings.LANGUAGE_CODE, "zh-hans")
