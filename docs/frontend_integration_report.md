# Frontend Integration Report

## Scope

Stage 4 frontend integration for Django-backed `/api` development proxy.

## Dev Proxy

`vite.config.ts` now proxies `/api` to:

```text
http://127.0.0.1:8000
```

The old Node gateway code remains under `server/` and can still be run for reference, but the active Vite development proxy targets Django.

## Local Runtime

Django:

```powershell
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000 --noreload
```

Vite:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

## Proxy Verification

`GET http://127.0.0.1:5173/api/greenhouse/dashboard`

```text
P0_STATUS=200
P0_KEYS=generatedAt,source,crops
P0_CROPS=3
```

`POST http://127.0.0.1:5173/api/weather/greenhouse-advice`

```http
HTTP/1.1 503 Service Unavailable
content-type: application/json

{"message":"外部集成未启用"}
```

`POST http://127.0.0.1:5173/api/ai/agri-chat`

```http
HTTP/1.1 503 Service Unavailable
content-type: application/json

{"message":"外部集成未启用"}
```

`POST http://127.0.0.1:5173/api/v1/ai/agri-chat`

```json
{
  "code": 50020,
  "message": "外部集成未启用",
  "data": {},
  "request_id": "uuid"
}
```

## External Calls

No real AI service, weather service, or Youren Cloud write API was called during this verification. P1 endpoints currently provide safe disabled responses only.

## Risks

- `npm run dev:full` still starts the old Node helper path. For Django integration use the explicit Django + Vite commands above.
- P1 endpoints are not full business implementations yet; they are safe disabled adapters for frontend error-state integration.
- Full browser visual QA is still needed before Stage 5 acceptance.
