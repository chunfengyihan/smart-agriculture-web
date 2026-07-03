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

## Cache backend

Django cache is controlled by environment variables:

- `DJANGO_CACHE_BACKEND`: `locmem` for local development, `redis` for shared production cache.
- `DJANGO_CACHE_KEY_PREFIX`: cache key prefix, default `smart-agri`.
- `DJANGO_LOCMEM_CACHE_LOCATION`: LocMemCache location for development.
- `DJANGO_LOCMEM_CACHE_MAX_ENTRIES`: development LocMemCache size guard.
- `REDIS_CACHE_URL`: Redis URL when `DJANGO_CACHE_BACKEND=redis`.

Weather integration cache settings:

- `WEATHER_CACHE_TTL_SECONDS`: successful weather response TTL, default 21600.
- `WEATHER_FAILURE_CACHE_TTL_SECONDS`: short TTL for upstream failure markers, default 60.
- `WEATHER_CACHE_LOCK_SECONDS`: duplicate external request lock TTL, default 30.
- `WEATHER_SOURCE_NAME`: included in weather cache keys, default `Open-Meteo`.

Production multi-process deployments should use Redis so weather cache entries survive Django process restarts and are shared by all workers.

## WeChat miniapp login

Configure these variables before enabling real miniapp login:

- `WECHAT_MINIAPP_APPID`: miniapp AppID.
- `WECHAT_MINIAPP_SECRET`: miniapp AppSecret. Keep the real value outside the repository.
- `WECHAT_CODE2SESSION_URL`: defaults to the official WeChat `jscode2session` endpoint.
- `WECHAT_CODE2SESSION_TIMEOUT_SECONDS`: external request timeout.
- `WECHAT_LOGIN_MOCK_ENABLED`: development-only mock login switch. The backend rejects mock login when `DEBUG=false`.

The login flow is:

1. The miniapp calls `wx.login()` and sends the returned `code` to `POST /api/v1/auth/wechat-login`.
2. Django exchanges the code through `code2session`, creates or reuses a local user profile linked to `openid`, and returns `access` and `refresh` tokens.
3. Miniapp and web clients send `Authorization: Bearer <access>` for protected APIs.
4. Clients call `POST /api/v1/auth/refresh` with the refresh token when the access token expires.
5. Clients call `POST /api/v1/auth/logout` with a valid access token and refresh token to blacklist the refresh token.
