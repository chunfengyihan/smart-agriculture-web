import json
import logging
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


logger = logging.getLogger(__name__)


class YourenIntegrationError(Exception):
    safe_message = "Youren integration request failed"
    status_code = 502

    def __init__(self, message=None, *, status_code=None):
        super().__init__(message or self.safe_message)
        if status_code is not None:
            self.status_code = status_code


class YourenConfigError(YourenIntegrationError):
    safe_message = "Youren integration is not configured"
    status_code = 503


class YourenUpstreamError(YourenIntegrationError):
    safe_message = "Youren upstream service is unavailable"
    status_code = 502


class YourenClient:
    def __init__(self, urlopen_func=urlopen):
        self.urlopen = urlopen_func
        self.api_base = settings.YOUREN_API_BASE.strip().rstrip("/")
        self.auth_path = settings.YOUREN_AUTH_PATH
        self.app_key = settings.YOUREN_APP_KEY
        self.app_secret = settings.YOUREN_APP_SECRET
        self.timeout = settings.YOUREN_FETCH_TIMEOUT_SECONDS
        self._token = ""
        self._token_expires_at = 0

    def has_credentials(self):
        return bool(self.app_key and self.app_secret)

    def is_configured(self):
        return bool(self.api_base and self.has_credentials())

    def _require_configured(self):
        if not settings.YOUREN_INTEGRATION_ENABLED:
            raise YourenConfigError("Youren integration is disabled")
        if not self.api_base:
            raise YourenConfigError("Youren API base is not configured")
        if not self.has_credentials():
            raise YourenConfigError("Youren credentials are not configured")

    def post_json(self, path, body, headers=None):
        self._require_configured()
        request = Request(
            f"{self.api_base}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                **(headers or {}),
            },
            method="POST",
        )
        try:
            with self.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
        except (HTTPError, URLError, OSError) as exc:
            logger.warning(
                "youren_http_request_failed",
                extra={"path": path, "error": exc.__class__.__name__},
            )
            raise YourenUpstreamError() from exc

        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:
            logger.warning("youren_response_json_invalid", extra={"path": path})
            raise YourenUpstreamError("Youren response format is invalid") from exc

        if not isinstance(payload, dict):
            raise YourenUpstreamError("Youren response format is invalid")

        upstream_status = payload.get("status")
        if upstream_status not in (None, 0):
            logger.warning(
                "youren_api_rejected_request",
                extra={"path": path, "upstream_status": upstream_status},
            )
            raise YourenUpstreamError()

        return payload

    def get_access_token(self):
        if self._token and monotonic() < self._token_expires_at:
            return self._token

        payload = self.post_json(
            self.auth_path,
            {
                "appKey": self.app_key,
                "appSecret": self.app_secret,
            },
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        token = (
            data.get("X-Access-Token")
            or data.get("token")
            or payload.get("X-Access-Token")
            or payload.get("token")
        )
        if not token:
            logger.warning("youren_auth_response_missing_token")
            raise YourenUpstreamError("Youren auth response missing token")

        self._token = token
        self._token_expires_at = monotonic() + settings.YOUREN_TOKEN_TTL_SECONDS
        return token

    def _authorized_headers(self):
        token = self.get_access_token()
        return {"X-Access-Token": token}

    def get_devices(self, page_no=1, page_size=100, project_id=None, search_param=""):
        payload = self.post_json(
            "/usrCloud/V6/device/getDevices",
            {
                "pageNo": page_no,
                "pageSize": page_size,
                "projectId": project_id,
                "searchParam": search_param,
            },
            self._authorized_headers(),
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        return data.get("list") or []

    def get_data_points(self, cusdevice_no):
        payload = self.post_json(
            "/usrCloud/V6/cusdevice/getDataPointInfoForCusdeviceNo",
            {
                "cusdeviceNo": cusdevice_no,
                "pageNo": 1,
                "pageSize": 500,
            },
            self._authorized_headers(),
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        return data.get("cusdeviceDataPointList") or []

    def get_latest_history(self, dev_datapoints):
        if not dev_datapoints:
            return []
        token = self.get_access_token()
        payload = self.post_json(
            "/usrCloud/vn/ucloudSdk/getLastDataHistory",
            {"devDatapoints": dev_datapoints},
            {
                "token": token,
                "X-Access-Token": token,
            },
        )
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        return data.get("list") or []
