import hashlib
import json
import logging
from dataclasses import dataclass
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import WeChatUserProfile


logger = logging.getLogger(__name__)


class WeChatLoginConfigError(Exception):
    pass


class WeChatCodeExchangeError(Exception):
    pass


@dataclass(frozen=True)
class WeChatSession:
    openid: str
    session_key: str
    unionid: str = ""


def hash_value(value):
    if not value:
        return ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def username_for_openid(openid):
    return f"wx_{hash_value(openid)[:24]}"


def mock_session_for_code(code):
    return WeChatSession(
        openid=f"mock_{hash_value(code)[:24]}",
        session_key=f"mock_session_{hash_value('session:' + code)[:24]}",
    )


def exchange_code_for_session(code):
    if settings.WECHAT_LOGIN_MOCK_ENABLED:
        if not settings.DEBUG:
            raise WeChatLoginConfigError("Mock WeChat login is only allowed when DEBUG is enabled")
        return mock_session_for_code(code)

    if not settings.WECHAT_MINIAPP_APPID or not settings.WECHAT_MINIAPP_SECRET:
        raise WeChatLoginConfigError("WeChat miniapp credentials are not configured")

    query = urlencode(
        {
            "appid": settings.WECHAT_MINIAPP_APPID,
            "secret": settings.WECHAT_MINIAPP_SECRET,
            "js_code": code,
            "grant_type": "authorization_code",
        }
    )
    url = f"{settings.WECHAT_CODE2SESSION_URL}?{query}"

    try:
        with urlopen(url, timeout=settings.WECHAT_CODE2SESSION_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError) as exc:
        logger.warning("wechat_code2session_failed", extra={"error": exc.__class__.__name__})
        raise WeChatCodeExchangeError("WeChat code2session request failed") from exc

    errcode = payload.get("errcode")
    if errcode:
        raise WeChatCodeExchangeError(f"WeChat code2session rejected the login code: {errcode}")

    openid = payload.get("openid")
    session_key = payload.get("session_key")
    if not openid or not session_key:
        raise WeChatCodeExchangeError("WeChat code2session response missing openid or session_key")

    return WeChatSession(openid=openid, session_key=session_key, unionid=payload.get("unionid", ""))


@transaction.atomic
def get_or_create_user_for_wechat_session(wechat_session):
    User = get_user_model()
    profile = (
        WeChatUserProfile.objects.select_related("user")
        .filter(openid=wechat_session.openid)
        .first()
    )
    now = timezone.now()

    if profile:
        profile.unionid = wechat_session.unionid or profile.unionid
        profile.session_key_hash = hash_value(wechat_session.session_key)
        profile.last_login_at = now
        profile.save(update_fields=["unionid", "session_key_hash", "last_login_at", "updated_at"])
        return profile.user, profile

    user = User.objects.create_user(username=username_for_openid(wechat_session.openid))
    user.set_unusable_password()
    user.save(update_fields=["password"])
    profile = WeChatUserProfile.objects.create(
        user=user,
        openid=wechat_session.openid,
        unionid=wechat_session.unionid,
        session_key_hash=hash_value(wechat_session.session_key),
        role=WeChatUserProfile.ROLE_VIEWER,
        last_login_at=now,
    )
    return user, profile
