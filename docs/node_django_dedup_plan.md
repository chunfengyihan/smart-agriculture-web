# Node and Django Business Logic Deduplication

## Scope

D-04 audits the old Node gateway and the Django backend for duplicated business logic around greenhouse dashboard data and Youren integration access.

## Route Ownership

| Business route | Primary owner | Node status | Reason |
| --- | --- | --- | --- |
| `GET /api/v1/greenhouse/dashboard` | Django | Not implemented in Node | v1 contract owner is Django. |
| `GET /api/greenhouse/dashboard` | Django | Forward-only compatibility path | Keeps old Node callers working while removing Node dashboard mapping logic. |
| `GET /api/v1/integrations/youren/health` | Django | Not implemented in Node | Authenticated operations health endpoint. |
| `GET /api/youren/health` | Django and Node probe | Node retained as local probe only | Operational diagnostics for legacy local scripts. |
| `POST /api/weather/greenhouse-advice` | Django | Node legacy implementation still present | P1 safe-disabled Django endpoint exists; Node cleanup should follow after weather integration parity. |
| `POST /api/ai/crop-diagnosis` | Django | Node legacy implementation still present | P1 safe-disabled Django endpoint exists; full external AI parity is outside D-04. |
| `POST /api/ai/agri-chat` | Django | Node legacy implementation still present | P1 safe-disabled Django endpoint exists; full external AI parity is outside D-04. |

## D-04 Changes

- Django now owns Youren client access, authentication token caching, device and point reads, latest-value reads, error handling, and dashboard mapping under `backend/apps/integrations/youren/`.
- Django dashboard views call the Youren service only when `YOUREN_INTEGRATION_ENABLED=true`; otherwise they keep serving the latest local `DashboardSnapshot` payload.
- Node `server/youren-api.mjs` no longer builds dashboard data. Its `/api/greenhouse/dashboard` route forwards to Django using `DJANGO_API_BASE`.
- Node `server/dashboard-adapter.mjs` was removed from runtime ownership.

## Error Handling Contract

Youren upstream HTTP failures, invalid JSON, and nonzero upstream statuses are logged server-side with path/status metadata only. API responses return safe generic messages and do not include upstream response bodies, credentials, tokens, or raw request payloads.

## Remaining Node Retention

Node is retained for historical local probes and temporary rollback scripts only. The remaining Node weather and AI handlers should be removed or converted to Django forwarding after the corresponding Django integrations reach feature parity.
