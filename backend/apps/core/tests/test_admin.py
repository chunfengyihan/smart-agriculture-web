from django.contrib import admin
from django.contrib.auth import get_user_model
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
        self.assertContains(response, 'href="http://127.0.0.1:5173/"')
