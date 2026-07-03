from django.conf import settings

from .client import YourenClient, YourenConfigError
from .mapper import YourenMapper


class YourenService:
    def __init__(self, client=None, mapper=None):
        self.client = client or YourenClient()
        self.mapper = mapper or YourenMapper(self.client)

    def build_dashboard(self):
        devices = self.client.get_devices(page_size=settings.YOUREN_DASHBOARD_DEVICE_PAGE_SIZE)
        return self.mapper.build_dashboard(devices)

    def health(self, sample_size=10):
        configured = self.client.is_configured()
        if not settings.YOUREN_INTEGRATION_ENABLED or not configured:
            return {
                "ok": False,
                "configured": configured,
                "enabled": settings.YOUREN_INTEGRATION_ENABLED,
                "message": "Youren integration is disabled or not configured",
            }

        devices = self.client.get_devices(page_size=sample_size)
        return {
            "ok": True,
            "configured": True,
            "enabled": True,
            "deviceCountInSample": len(devices),
            "sampleDevices": [
                {
                    "deviceNo": device.get("deviceNo") or device.get("sn"),
                    "deviceName": device.get("deviceName"),
                    "projectName": device.get("projectName"),
                    "onlineOffline": (device.get("deviceStatus") or {}).get("onlineOffline"),
                }
                for device in devices
            ],
        }


def get_youren_dashboard():
    if not settings.YOUREN_INTEGRATION_ENABLED:
        raise YourenConfigError("Youren integration is disabled")
    return YourenService().build_dashboard()


def get_youren_health():
    return YourenService().health()
