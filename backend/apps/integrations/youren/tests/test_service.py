from django.test import SimpleTestCase

from apps.integrations.youren.service import YourenService


class FakeYourenClient:
    def get_devices(self, page_size=100):
        return [
            {
                "deviceNo": "dev-001",
                "deviceName": "一号蓝莓棚",
                "projectName": "新石村",
                "deviceStatus": {"onlineOffline": 1, "monitorAlarm": 0},
            }
        ]

    def get_data_points(self, cusdevice_no):
        return [
            {"name": "空气温度", "dataIdentifier": "air_temp", "dataPointId": 101},
            {"name": "空气湿度", "dataIdentifier": "humidity", "dataPointId": 102},
            {"name": "土壤 PH", "dataIdentifier": "ph", "dataPointId": 103},
        ]

    def get_latest_history(self, dev_datapoints):
        return [
            {"dataPointId": 101, "value": "23.5"},
            {"dataPointId": 102, "value": "68"},
            {"dataPointId": 103, "value": "6.2"},
        ]


class YourenServiceTests(SimpleTestCase):
    def test_build_dashboard_maps_devices_points_and_latest_values(self):
        payload = YourenService(client=FakeYourenClient()).build_dashboard()

        self.assertEqual(payload["source"], "youren")
        self.assertEqual(len(payload["crops"]), 3)

        greenhouses = [item for crop in payload["crops"] for item in crop["greenhouses"]]
        self.assertEqual(len(greenhouses), 1)
        greenhouse = greenhouses[0]
        self.assertEqual(greenhouse["id"], "dev-001")
        self.assertEqual(greenhouse["name"], "一号蓝莓棚")
        self.assertEqual(greenhouse["status"], "online")
        self.assertEqual(len(greenhouse["trend"]), 24)

        metrics = {metric["key"]: metric for metric in greenhouse["metrics"]}
        self.assertEqual(metrics["airTemp"]["value"], 23.5)
        self.assertEqual(metrics["airHumidity"]["status"], "normal")
        self.assertEqual(metrics["ph"]["value"], 6.2)
