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
