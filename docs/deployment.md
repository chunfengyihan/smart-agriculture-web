# Deployment Notes

## API authentication

Django API authentication is controlled by environment variables:

- `DJANGO_API_AUTH_REQUIRED`: set to `true` in production. Development may set it to `false` for local debugging.
- `DJANGO_API_PUBLIC_PATHS`: comma-separated public paths. The safe default is `/api/v1/health/`, `/api/v1/schema/`, `/api/v1/docs/`, `/api/v1/auth/wechat-login`, and `/api/v1/auth/refresh`.
- `DJANGO_API_KEY_HEADER`: header used by service or device callers. Default: `X-API-Key`.
- `DJANGO_API_KEY_ALLOWLIST`: comma-separated API keys for service or device callers. Keep real values outside the repository.
- `DJANGO_API_AUTH_TOKEN`: legacy single API key compatibility setting. Prefer `DJANGO_API_KEY_ALLOWLIST`.
- `DJANGO_JWT_ACCESS_TOKEN_MINUTES` and `DJANGO_JWT_REFRESH_TOKEN_DAYS`: SimpleJWT token lifetime settings.
- `DJANGO_X_FRAME_OPTIONS`: default `SAMEORIGIN`, required by django-simpleui because admin change-list pages are opened in same-origin tabs/iframes.

Web and miniapp clients should send `Authorization: Bearer <JWT>` for protected business APIs. API keys should be reserved for backend services, ingest jobs, or trusted device gateways.

If external authentication or service keys are not configured, protected business APIs must return 401 or 403 instead of silently allowing anonymous access.
