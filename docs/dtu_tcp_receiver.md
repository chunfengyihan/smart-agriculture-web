# DTU TCP Receiver

The DTU TCP receiver is a thin device gateway. It validates registered DTU frames, redacts raw payloads, and forwards normalized environment readings to Django.

## Architecture

```text
DTU TCP client
  -> server/dtu-tcp-server.mjs
  -> local device registry and protocol parser
  -> POST /api/v1/ingest/dtu-readings
  -> Device + EnvironmentReading + DtuIngestAuditEvent
```

The receiver must not be treated as the long-term data store. Django remains the source of truth for devices, greenhouses, readings, and ingest audit records.

## Protocol

Supported frame formats:

```text
DTU1|device=dtu-001|token=<device-token>|ts=2026-07-04T10:00:00+08:00|air_temp=25.6|humidity=68|soil_humidity=52
```

```json
{
  "deviceId": "dtu-001",
  "recordedAt": "2026-07-04T10:00:00+08:00",
  "metrics": {
    "airTemp": 25.6,
    "airHumidity": 68,
    "soilHumidity": 52
  },
  "signature": "hmac-sha256-over-canonical-payload"
}
```

The JSON signature is HMAC-SHA256 over:

```text
deviceId|recordedAt|metric_name=value&metric_name=value
```

with metric names normalized and sorted. Plain token frames are supported for simple DTU devices; signed JSON frames are preferred when the device or upstream gateway can generate HMAC.

Supported metrics:

```text
air_temp / airTemp / temp / temperature
air_humidity / airHumidity / humidity
light
co2
soil_humidity / soilHumidity / soil_moisture
soil_temp / soilTemp
ec
ph
```

## Device Registration

Registration has two layers.

1. Django `Device`
   - `code`: must equal the DTU `device` or `deviceId`.
   - `provider`: recommended value `dtu`.
   - `greenhouse`: target greenhouse for readings.
   - `ingest_enabled`: must be `true`.
   - `ingest_token_hash`: SHA-256 of the device token, or blank when strict IP allowlist is used.
   - `ingest_allowed_ips`: optional list of DTU source IPs.
   - `ingest_protocol`: default `smart_agri_v1`.

2. TCP receiver registry
   - Copy `config/dtu.devices.example.json` to `config/dtu.devices.json`.
   - Replace placeholder token and IP values.
   - Do not commit the real registry file.

Example registry:

```json
{
  "devices": [
    {
      "deviceId": "dtu-001",
      "token": "replace-with-device-token",
      "allowedIps": ["127.0.0.1"],
      "protocol": "smart_agri_v1"
    }
  ]
}
```

## Environment

```env
DTU_TCP_HOST=0.0.0.0
DTU_TCP_PORT=9000
DTU_TCP_LOG_DIR=.runtime/dtu
DTU_TCP_MAX_FRAME_BYTES=4096
DTU_TCP_REDACTED_PREVIEW_BYTES=160
DTU_DEVICE_REGISTRY_PATH=config/dtu.devices.json
DTU_INGEST_API_URL=http://127.0.0.1:8000/api/v1/ingest/dtu-readings
DTU_INGEST_API_KEY=<service-api-key>
```

`DTU_INGEST_API_KEY` must match `DJANGO_API_KEY_ALLOWLIST` or the legacy `DJANGO_API_AUTH_TOKEN` when API authentication is enabled.

## Start Locally

Run Django first:

```powershell
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

Start the TCP receiver:

```powershell
npm run dev:dtu
```

Send a software simulation frame:

```powershell
npm run dtu:simulate -- --device dtu-001 --token replace-with-device-token
```

Run parser tests:

```powershell
npm run dtu:test
```

## Logs And Audit

The receiver writes only sanitized local logs:

```text
.runtime/dtu/audit-YYYY-MM-DD.jsonl
.runtime/dtu/events-YYYY-MM-DD.jsonl
```

Audit entries include status, device id, timestamp, error code, frame length, raw frame SHA-256 hash, and a redacted/truncated snippet. Full hex payloads and full text frames are not written to normal logs.

Django stores accepted and rejected ingest attempts in `DtuIngestAuditEvent`. Accepted readings are written to `EnvironmentReading` with:

```text
source=dtu
device=<registered Device>
greenhouse=<device.greenhouse>
recorded_at=<frame timestamp or gateway receipt time>
```

## Rejection Cases

The gateway and backend reject:

- unregistered devices
- disabled devices
- token or signature mismatch
- remote IP outside allowlist
- unsupported protocol
- oversized frames
- frames with no supported numeric metrics
- frames with invalid metric values

Rejected frames are audited with a code such as `DTU_DEVICE_NOT_REGISTERED`, `DTU_TOKEN_INVALID`, `DTU_DEVICE_IP_DENIED`, or `DTU_METRIC_INVALID`.

## Queue Reservation

The current local implementation forwards directly to Django. For high-concurrency deployments, keep the parser and gateway validation in place, but replace direct forwarding with Redis Queue, Celery, RabbitMQ, or Kafka. Queue payloads should contain normalized readings plus `raw_frame_hash` and `redacted_snippet`, not full raw frames or cleartext tokens.
