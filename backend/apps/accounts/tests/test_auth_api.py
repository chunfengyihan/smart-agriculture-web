from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from apps.accounts.models import WeChatUserProfile


PUBLIC_AUTH_PATHS = [
    "/api/v1/health/",
    "/api/v1/schema/",
    "/api/v1/docs/",
    "/api/v1/auth/wechat-login",
    "/api/v1/auth/refresh",
]


class WeChatAuthApiTests(TestCase):
    @override_settings(
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=False,
        WECHAT_MINIAPP_APPID="",
        WECHAT_MINIAPP_SECRET="",
    )
    def test_wechat_login_requires_credentials_when_mock_disabled(self):
        response = Client().post(
            "/api/v1/auth/wechat-login",
            data={"code": "dev-code"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        payload = response.json()
        self.assertEqual(payload["code"], 50030)
        self.assertIn("WeChat miniapp credentials", payload["message"])

    @override_settings(
        DEBUG=True,
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=True,
    )
    def test_mock_wechat_login_returns_token_pair_and_user_role(self):
        response = Client().post(
            "/api/v1/auth/wechat-login",
            data={"code": "mock-code"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["code"], 0)
        self.assertTrue(payload["data"]["access"])
        self.assertTrue(payload["data"]["refresh"])
        self.assertEqual(payload["data"]["token"], payload["data"]["access"])
        self.assertEqual(payload["data"]["user"]["role"], "viewer")
        self.assertEqual(WeChatUserProfile.objects.count(), 1)
        self.assertTrue(WeChatUserProfile.objects.first().openid.startswith("mock_"))

    @override_settings(
        DEBUG=False,
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=True,
    )
    def test_mock_wechat_login_is_blocked_when_debug_is_false(self):
        response = Client().post(
            "/api/v1/auth/wechat-login",
            data={"code": "mock-code"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("only allowed when DEBUG is enabled", response.json()["message"])

    @override_settings(
        DEBUG=True,
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=True,
    )
    def test_wechat_login_token_can_access_protected_api_and_me(self):
        client = Client()
        login = client.post(
            "/api/v1/auth/wechat-login",
            data={"code": "protected-code"},
            content_type="application/json",
        )
        access = login.json()["data"]["access"]

        dashboard = client.get(
            "/api/v1/greenhouse/dashboard",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        me = client.get("/api/v1/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}")

        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["data"]["role"], "viewer")

    @override_settings(API_AUTH_REQUIRED=True, API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS)
    def test_me_requires_authentication(self):
        response = Client().get("/api/v1/auth/me")

        self.assertIn(response.status_code, [401, 403])

    @override_settings(
        DEBUG=True,
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=True,
    )
    def test_refresh_and_logout_flow(self):
        client = Client()
        login = client.post(
            "/api/v1/auth/wechat-login",
            data={"code": "refresh-code"},
            content_type="application/json",
        )
        access = login.json()["data"]["access"]
        refresh = login.json()["data"]["refresh"]

        refreshed = client.post(
            "/api/v1/auth/refresh",
            data={"refresh": refresh},
            content_type="application/json",
        )
        self.assertEqual(refreshed.status_code, 200)
        self.assertTrue(refreshed.json()["data"]["access"])

        logout = client.post(
            "/api/v1/auth/logout",
            data={"refresh": refresh},
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )
        self.assertEqual(logout.status_code, 200)
        self.assertTrue(logout.json()["data"]["logged_out"])

        rejected = client.post(
            "/api/v1/auth/refresh",
            data={"refresh": refresh},
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 401)

    @override_settings(
        DEBUG=True,
        API_AUTH_REQUIRED=True,
        API_PUBLIC_PATHS=PUBLIC_AUTH_PATHS,
        WECHAT_LOGIN_MOCK_ENABLED=True,
    )
    def test_existing_profile_is_reused_for_same_mock_code(self):
        client = Client()
        for _index in range(2):
            response = client.post(
                "/api/v1/auth/wechat-login",
                data={"code": "same-code"},
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 200)

        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(WeChatUserProfile.objects.count(), 1)
