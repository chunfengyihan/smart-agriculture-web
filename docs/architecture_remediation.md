# Architecture Remediation Log

## D-01

问题编号：D-01
修复状态：completed, waiting for manual confirmation
修改文件：
- `requirements/base.txt`
- `backend/config/settings/base.py`
- `backend/config/settings/development.py`
- `backend/config/settings/production.py`
- `backend/config/settings/test.py`
- `backend/apps/core/permissions.py`
- `backend/apps/greenhouse/views.py`
- `backend/apps/weather/views.py`
- `backend/apps/ai_advisory/views.py`
- `backend/apps/greenhouse/tests/test_dashboard_api.py`
- `backend/apps/core/tests/test_health.py`
- `src/lib/http.ts`
- `.env.example`
- `README.md`
- `docs/deployment.md`
未提交但已检查的既有未跟踪目录：
- `smart-agri-miniapp/utils/request.js`
- `smart-agri-miniapp/services/auth.js`
- `smart-agri-miniapp/services/diagnosis.js`
关键设计决策：
- 默认公开路径只保留 health、schema/docs 和认证入口，业务接口不再默认公开。
- DRF 全局接入 SimpleJWT，业务接口通过 JWT Bearer、Session 或 allowlist API Key 访问。
- `DJANGO_API_KEY_ALLOWLIST` 是服务/设备调用的主配置，`DJANGO_API_AUTH_TOKEN` 仅作为旧环境兼容。
- 开发配置默认允许关闭 API 强制认证，生产配置默认启用认证。
- Django admin 使用 django-simpleui，同源管理页面需要在 iframe/tab 中打开，因此 `X_FRAME_OPTIONS` 使用 `SAMEORIGIN`，避免后台菜单点击后被浏览器拦截。
自动化检查结果：
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, no migrations to apply.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.greenhouse apps.weather apps.ai_advisory` passed, 38 tests.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d01.yaml` passed.
- `npm run lint` passed.
- `npm run build` passed.
后端启动结果：
- Django runserver started on `127.0.0.1:8010` and `127.0.0.1:8012` for verification, then stopped.
前端构建结果：
- Vite production build passed and emitted `dist/`.
网站运行验证结果：
- `GET /` returned 200 with `text/html; charset=utf-8`.
- Browser verification with a JWT in `localStorage.smart_agri_access_token` loaded title `智慧农业管理中枢`, body text length 1186, screenshot `output/playwright/d01-home-authenticated.png`.
- Browser console still showed one 503 from an external integration disabled path; this is a known disabled-integration state, not an authentication regression.
小程序运行验证结果：
- No standalone miniapp `package.json` build script is present.
- `node --check smart-agri-miniapp\utils\request.js` passed.
- `node --check smart-agri-miniapp\services\auth.js` passed.
- `node --check smart-agri-miniapp\services\diagnosis.js` passed.
- WeChat Developer Tools compile/runtime verification remains manual.
接口验证结果：
- `GET /api/v1/health/` without token returned 200.
- `GET /api/v1/schema/` without token returned 200.
- `GET /api/v1/greenhouse/dashboard` without token returned 401.
- `GET /api/v1/greenhouse/dashboard` with `X-API-Key: d01-test-key` returned 200.
- Unit tests cover JWT Bearer access to the protected dashboard API.
回归测试结果：
- Anonymous business API access is no longer allowed when `DJANGO_API_AUTH_REQUIRED=true`.
- Health and schema remain publicly accessible.
- Legacy `X-API-Key` compatibility and new allowlist API key behavior are covered.
兼容性影响：
- 业务接口在 `DJANGO_API_AUTH_REQUIRED=true` 时匿名访问会返回 401 或 403。
- 旧的 `X-API-Key: DJANGO_API_AUTH_TOKEN` 仍可用；Bearer 头用于 JWT。
外部依赖与已知限制：
- 新增 `djangorestframework-simplejwt` 依赖。
- D-02 尚未实现微信登录发 token，本项仅完成服务端 JWT 校验与客户端 token 注入能力。
Git Commit：fix(security): enforce API authentication defaults
是否允许继续下一项：等待人工确认
## D-02

问题编号：D-02
修复状态：completed, waiting for manual confirmation
修改文件：
- `backend/config/settings/base.py`
- `backend/config/urls.py`
- `backend/apps/accounts/`
- `scripts/verify.py`
- `.env.example`
- `README.md`
- `docs/deployment.md`
关键设计决策：
- 使用 Django 内置 User 作为认证主体，新增 `WeChatUserProfile` 保存 openid、unionid、role、session_key_hash 和登录时间。
- 使用 DRF SimpleJWT 签发 access/refresh token，并启用 token blacklist 支持 logout。
- `wechat-login` 和 `refresh` 保持公开入口；`logout` 和 `me` 必须携带 Bearer token。
- 微信 `code2session` 通过服务层封装，生产缺少微信凭据时返回明确 503；mock 登录仅允许 `DEBUG=true` 且显式开启。
- 用户角色预留 `admin`、`operator`、`viewer`，默认微信用户为 `viewer`。
自动化检查结果：
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, applied `accounts.0001_initial` and SimpleJWT token blacklist migrations locally.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.accounts apps.greenhouse apps.weather apps.ai_advisory` passed, 45 tests.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d02.yaml` passed.
- `npm run verify -- --backend-only` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `.venv\Scripts\python.exe -m pytest` was not executable because pytest is not installed in this project.
后端启动结果：
- Django runserver restarted on `127.0.0.1:8000` with `DJANGO_API_AUTH_REQUIRED=true` and `WECHAT_LOGIN_MOCK_ENABLED=true` for D-02 verification.
前端构建结果：
- Vite production build passed and emitted `dist/`.
网站运行验证结果：
- `GET /` returned 200.
- Browser verification used `POST /api/v1/auth/wechat-login` to obtain a mock JWT, injected it into `localStorage.smart_agri_access_token`, and loaded title `智慧农业管理中枢`; screenshot `output/playwright/d02-home-authenticated.png`.
- Browser console still showed one 503 from an external integration disabled path; this is a known disabled-integration state, not a WeChat login regression.
小程序运行验证结果：
- No standalone miniapp `package.json` build script is present.
- `node --check smart-agri-miniapp\config\api.js` passed.
- `node --check smart-agri-miniapp\utils\request.js` passed.
- `node --check smart-agri-miniapp\services\auth.js` passed.
- WeChat Developer Tools compile/runtime verification remains manual.
接口验证结果：
- `POST /api/v1/auth/wechat-login` with mock code returned access token, refresh token, compatibility `token`, and user role `viewer`.
- `GET /api/v1/auth/me` without token returned 401.
- `GET /api/v1/auth/me` with Bearer token returned 200 and role `viewer`.
- `POST /api/v1/auth/refresh` with refresh token returned a new access token.
- `POST /api/v1/auth/logout` with Bearer token and refresh token returned 200.
- Refreshing the same token after logout returned 401.
- `GET /api/v1/greenhouse/dashboard` with the issued Bearer token returned 200.
回归测试结果：
- Existing health/schema, dashboard, weather, and AI-disabled tests still pass.
- Existing admin iframe behavior from D-01 remains covered through `SAMEORIGIN` setting test.
- Protected auth endpoints reject anonymous access.
兼容性影响：
- 小程序现有 `WECHAT_LOGIN_ENDPOINT=/api/v1/auth/wechat-login` 可对接新接口。
- 登录响应同时返回 `access` 和兼容字段 `token`，便于现有小程序请求层继续读取 token。
外部依赖与已知限制：
- 真实微信登录需要外部配置 `WECHAT_MINIAPP_APPID` 和 `WECHAT_MINIAPP_SECRET`。
- 当前环境无法运行微信开发者工具，只能完成代码级和 HTTP API 验证。
Git Commit：feat(accounts): add WeChat JWT authentication
是否允许继续下一项：等待人工确认

## D-03

问题编号：D-03
修复状态：completed, waiting for manual confirmation
修改文件：
- `src/types/api/index.ts`
- `src/api/client.ts`
- `src/api/dashboard.ts`
- `src/data/dataProvider.ts`
- `src/data/agriChat.ts`
- `src/data/aiDiagnosis.ts`
- `src/data/weatherAdvice.ts`
- `smart-agri-miniapp/utils/request.js`
- `.env.example`
- `README.md`
- `docs/api_inventory.md`
- `docs/api_contract_v1.yaml`
- `docs/architecture_remediation.md`
关键设计决策：
- Web 端新增统一 v1 API client，默认解析 `{ code, message, data, request_id }` 成业务 payload。
- 统一将 v1 error body 的 `details` 或兼容字段 `data` 归一到 `ApiRequestError.details`，保留现有后端响应兼容性。
- Web dashboard、weather advice、AI diagnosis、agri chat 全部切换到 `/api/v1/*`。
- dashboard 默认端点从 `/api/greenhouse/dashboard` 切换到 `/api/v1/greenhouse/dashboard`，legacy 路径仅作兼容 adapter。
- 小程序请求层统一解析 v1 wrapper，并自动注入 `Authorization: Bearer <token>`。
- OpenAPI 草案补充 D-02 auth paths，并维持 v1 dashboard、weather、AI 接口作为契约源。
自动化检查结果：
- `npm run lint` passed.
- `npm run build` passed.
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d03.yaml` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.accounts apps.greenhouse apps.weather apps.ai_advisory` passed, 45 tests.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, no migrations.
- `node --check smart-agri-miniapp\utils\request.js` passed.
- `node --check smart-agri-miniapp\config\api.js` passed.
- `node --check smart-agri-miniapp\services\dashboard.js` passed.
- `node --check smart-agri-miniapp\services\weather.js` passed.
- `node --check smart-agri-miniapp\services\advisor.js` passed.
前端构建结果：
- Vite production build passed and emitted `dist/`.
- Built bundle contains `/api/v1/greenhouse/dashboard`.
网站运行验证结果：
- `GET /` returned 200.
- `GET /api/v1/greenhouse/dashboard` returned 200.
- `GET /api/greenhouse/dashboard` returned 200 as legacy compatibility.
- Browser verification loaded title `智慧农业管理中枢`; runtime requests included `GET /api/v1/greenhouse/dashboard` and did not include legacy dashboard.
- Browser screenshot: `output/playwright/d03-home-v1-final.png`.
- Browser console still showed one 503 from `/api/v1/weather/greenhouse-advice` because external weather integration is disabled in the current environment.
小程序运行验证结果：
- No standalone miniapp `package.json` build script is present.
- 小程序统一 request wrapper passed syntax verification.
- WeChat Developer Tools compile/runtime verification remains manual.
接口验证结果：
- v1 dashboard returns unified `{ code, message, data, request_id }` wrapper.
- Web and miniapp request layers unwrap v1 success responses to business payloads.
- Web and miniapp request layers normalize nonzero code and non-2xx responses into error objects with status/code/details/requestId.
回归测试结果：
- Existing Django health/schema, auth, dashboard, weather, and AI-disabled tests still pass.
- Legacy dashboard endpoint remains reachable for backward compatibility.
兼容性影响：
- Web and miniapp should use `/api/v1/*` by default.
- Existing legacy dashboard consumers can continue using `/api/greenhouse/dashboard` during migration.
- `.env.local` in the local workspace was updated to `/api/v1/greenhouse/dashboard` for runtime verification and is not committed.
外部依赖与已知限制：
- 当前环境无法运行微信开发者工具，只能完成小程序代码级验证。
- 天气 v1 接口在外部集成未启用时返回 503，属于既有配置状态。
Git Commit：refactor(api): unify v1 API contract
是否允许继续下一项：等待人工确认

## D-04

问题编号：D-04
修复状态：completed, waiting for manual confirmation
修改文件：
- `backend/apps/integrations/`
- `backend/apps/greenhouse/views.py`
- `backend/apps/greenhouse/tests/test_dashboard_api.py`
- `backend/config/settings/base.py`
- `backend/config/urls.py`
- `server/youren-api.mjs`
- `server/dashboard-adapter.mjs`
- `.env.example`
- `README.md`
- `docs/api_inventory.md`
- `docs/api_contract_v1.yaml`
- `docs/node_django_dedup_plan.md`
- `docs/architecture_remediation.md`
关键设计决策：
- 新增 Django `apps.integrations.youren` service layer，包含 `YourenClient`、`YourenMapper`、`YourenService`。
- 有人云鉴权、token 缓存、设备列表、变量点位、最新值读取和 DashboardData 映射迁移到 Django。
- Django dashboard 默认继续读取 `DashboardSnapshot`；仅在 `YOUREN_INTEGRATION_ENABLED=true` 时实时调用有人云 service。
- 新增 Django `GET /api/v1/integrations/youren/health` 和 legacy `GET /api/youren/health`。
- Node `/api/greenhouse/dashboard` 改为转发到 Django，删除 Node dashboard adapter 主实现。
- Node 仍保留有人云 health/probe 和旧脚本回退能力；天气和 AI Node handlers 的后续清理由单独 parity 项处理。
- 外部有人云异常只返回安全通用消息，原始上游响应体、token、凭据和请求体不进入 API 响应。
自动化检查结果：
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d04.yaml` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.greenhouse apps.integrations` passed, 13 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.accounts apps.greenhouse apps.integrations apps.weather apps.ai_advisory` passed, 48 tests.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, no migrations.
- `npm run lint` passed.
- `npm run build` passed.
- `node --check server\youren-api.mjs` passed.
- `node --check server\youren-client.mjs` passed.
- `node --check server\youren-test.mjs` passed.
网站运行验证结果：
- Django runserver restarted on `127.0.0.1:8000` with `YOUREN_INTEGRATION_ENABLED=false`.
- `GET /` returned 200.
- `GET /api/v1/greenhouse/dashboard` returned 200 with local dashboard source.
- `GET /api/greenhouse/dashboard` returned 200 with local dashboard source.
- `GET /api/v1/integrations/youren/health` returned 200 with `ok=false` and `configured=false`.
- `GET /api/youren/health` returned 200 with `ok=false`, `configured=false`, and `enabled=false`.
- `GET /api/v1/schema/` returned 200.
接口验证结果：
- Node temporary server on `127.0.0.1:18787` forwarded `GET /api/greenhouse/dashboard` to Django and returned header `X-Smart-Agri-Migrated-To: django`.
- Node forwarded response returned 200 with local dashboard payload.
- Static OpenAPI draft includes `/api/v1/integrations/youren/health`, `/api/youren/health`, and `YourenHealth` schema.
回归测试结果：
- Existing local dashboard, auth, weather safe-disabled, and AI safe-disabled tests still pass.
- Frontend production build still emits `dist/` and homepage remains reachable through Django.
兼容性影响：
- Dashboard primary implementation is now Django.
- Legacy Node dashboard callers should receive forwarded Django responses when `DJANGO_API_BASE` points to the Django service.
- Enabling real-time Youren dashboard now requires `YOUREN_INTEGRATION_ENABLED=true`, `YOUREN_API_BASE`, `YOUREN_APP_KEY`, and `YOUREN_APP_SECRET`.
外部依赖与已知限制：
- 当前环境未配置真实有人云凭据，未执行真实外呼。
- Node weather and AI legacy handlers仍保留，后续应在对应 Django 外部集成达到 parity 后删除或转发。
Git Commit：refactor(integrations): move youren dashboard to Django
是否允许继续下一项：等待人工确认

## D-05

问题编号：D-05
修复状态：completed, waiting for manual confirmation
修改文件：
- `backend/apps/greenhouse/models.py`
- `backend/apps/greenhouse/admin.py`
- `backend/apps/greenhouse/serializers.py`
- `backend/apps/greenhouse/repositories.py`
- `backend/apps/greenhouse/services.py`
- `backend/apps/greenhouse/views.py`
- `backend/apps/greenhouse/management/commands/seed_dev.py`
- `backend/apps/greenhouse/tests/test_dashboard_api.py`
- `backend/apps/greenhouse/migrations/0002_alert_device_environmentreading_metric_type_and_more.py`
- `backend/config/urls.py`
- `README.md`
- `docs/api_inventory.md`
- `docs/api_contract_v1.yaml`
- `docs/p0_dashboard_compatibility.md`
- `docs/migration_plan.md`
- `docs/architecture_remediation.md`
关键设计决策：
- 补齐 `Device`、`Alert` 规范化模型，并为 `EnvironmentReading` 增加 `metric_type`。
- 保留现有宽表读数字段，避免破坏既有本地 seed 和 dashboard 页面。
- 新增 greenhouse repository/service 分层，dashboard 默认从 `Greenhouse`、`Device`、`EnvironmentReading`、`Alert` 聚合。
- `DashboardSnapshot` 降级为缓存、降级数据或历史快照；只有规范化模型没有可用数据时才读取 snapshot。
- 新增 `/api/v1/greenhouse/readings`，支持按 `greenhouse`、`start`、`end`、`metric_type` 查询并分页。
- 新增组合索引覆盖 greenhouse、recorded_at、metric_type、source、device provider/status 和 alert active 查询。
自动化检查结果：
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py makemigrations greenhouse` generated `0002_alert_device_environmentreading_metric_type_and_more.py`.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, applied greenhouse `0002`.
- `.venv\Scripts\python.exe backend\manage.py seed_dev` passed, seeded 4 greenhouses, 4 devices, 4 readings, 5 alerts, 1 dashboard snapshot.
- `.venv\Scripts\python.exe backend\manage.py test apps.greenhouse` passed, 14 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.accounts apps.greenhouse apps.integrations apps.weather apps.ai_advisory` passed, 50 tests.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d05.yaml` passed.
- `npm run lint` passed.
- `npm run build` passed.
网站运行验证结果：
- Django runserver restarted on `127.0.0.1:8000` with `YOUREN_INTEGRATION_ENABLED=false`.
- `GET /` returned 200.
- `GET /api/v1/greenhouse/dashboard` returned 200 with `source=local`, 3 crops, first crop 2 greenhouses, and 24 trend points.
- `GET /api/greenhouse/dashboard` returned 200 with `source=local` and 3 crops.
- Browser verification loaded title `智慧农业管理中枢`; runtime requested `GET /api/v1/greenhouse/dashboard` with 200.
- Browser screenshot: `output/playwright/d05-dashboard-normalized.png`.
接口验证结果：
- `GET /api/v1/greenhouse/readings?greenhouse=<id>&metric_type=environment&page_size=5` returned 200 with paginated `count/results`.
- Static OpenAPI draft includes `/api/v1/greenhouse/readings` and `EnvironmentReadingPage`.
回归测试结果：
- Existing dashboard shape remains compatible: 3 crop categories, 8 metrics, 24 trend points.
- Test coverage confirms dashboard uses normalized models even if `DashboardSnapshot.payload` is changed to an empty crop list.
- Existing auth, integrations, weather safe-disabled, and AI safe-disabled tests still pass.
兼容性影响：
- Dashboard no longer depends on snapshot as the only source of business data.
- Existing snapshot payload remains usable as cache/fallback.
- Existing `EnvironmentReading` rows receive default `metric_type=environment` during migration.
外部依赖与已知限制：
- 当前仍未连接真实 MySQL 实例；索引已按 MySQL 查询模式设计并通过 SQLite 迁移验证。
- 告警列表分页和作物/大棚 CRUD 仍留给后续 D-12 等项处理。
Git Commit：feat(greenhouse): build dashboard from normalized models
是否允许继续下一项：等待人工确认

## D-06

问题编号：D-06
修复状态：completed, waiting for manual confirmation
修改文件：
- `backend/config/settings/base.py`
- `backend/apps/weather/services.py`
- `backend/apps/weather/views.py`
- `backend/apps/weather/tests/test_weather_advice.py`
- `requirements/base.txt`
- `.env.example`
- `README.md`
- `docs/deployment.md`
- `docs/api_inventory.md`
- `docs/api_contract_v1.yaml`
- `docs/architecture_remediation.md`
关键设计决策：
- 移除天气服务进程内 `OrderedDict` 缓存，统一使用 Django cache framework。
- 开发默认 `LocMemCache`，生产可通过 `DJANGO_CACHE_BACKEND=redis` 和 `REDIS_CACHE_URL` 启用 Redis。
- 天气缓存 key 版本化，并包含数据源名称、日期、作物、温室/位置标识、经纬度和 advice/metrics 参数 hash。
- 成功响应使用 `WEATHER_CACHE_TTL_SECONDS`；上游失败使用 `WEATHER_FAILURE_CACHE_TTL_SECONDS` 做短缓存，避免缓存穿透。
- 使用 `cache.add()` 建立短锁，减少并发或多进程下对外部天气接口的重复请求。
- 外部天气失败时 v1 错误响应在 `data` 中返回 `degraded=true`、`source` 和降级消息。
自动化检查结果：
- `.venv\Scripts\python.exe -m pip install -r requirements\base.txt` passed, installed `redis`.
- `.venv\Scripts\python.exe backend\manage.py check` passed with default LocMem cache.
- `DJANGO_CACHE_BACKEND=redis REDIS_CACHE_URL=redis://127.0.0.1:6379/1 .venv\Scripts\python.exe backend\manage.py check` passed as Redis configuration-level verification.
- `.venv\Scripts\python.exe backend\manage.py test apps.weather` passed, 11 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.accounts apps.greenhouse apps.integrations apps.weather apps.ai_advisory` passed, 53 tests.
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-d06.yaml` passed.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed, no changes detected.
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput` passed, no migrations.
- `npm run lint` passed.
- `npm run build` passed.
接口验证结果：
- Unit tests cover cache key construction with source, location, coordinates and advice context.
- Unit tests cover cache hit behavior and verify repeated same request skips external weather fetch.
- Unit tests cover external failure degraded response and short failure-cache behavior.
- Static OpenAPI draft includes `cacheBackend` in `WeatherAdviceResponse`.
兼容性影响：
- Weather success payload keeps `cacheKey`, `cachedAt`, `weather`, `advice`, and `adviceError`; adds `cacheBackend`.
- Default local development behavior remains LocMemCache.
- Production Redis requires installing `redis` dependency and setting `DJANGO_CACHE_BACKEND=redis`.
外部依赖与已知限制：
- Redis server connectivity was not exercised because no Redis service is configured in the local environment; Django Redis backend configuration and dependency import were verified.
- Weather integration remains guarded by `WEATHER_INTEGRATION_ENABLED`.
Git Commit：refactor(weather): use Django cache backend

## D-07

Issue: D-07
Status: completed, waiting for manual confirmation
Changed files:
- `src/hooks/useDashboardQuery.ts`
- `src/App.tsx`
- `src/api/dashboard.ts`
- `src/data/dataProvider.ts`
- `src/App.css`
- `docs/api_inventory.md`
- `docs/architecture_remediation.md`

Key decisions:
- Added a lightweight TanStack Query equivalent for the dashboard path instead of adding a new dependency to the existing package manifest.
- Dashboard requests now have a 20s stale window, reuse an in-flight promise, retry failed requests twice, and cancel the active request through `AbortController`.
- Polling remains 30s when the page is visible, but the hook stops scheduling polling while `document.hidden` is true and refreshes again when visible if data is stale.
- Local JSON mode no longer appends `?t=Date.now()` on every normal request; cache-busting is reserved for retries/manual retry paths.
- Split future interface paths for dashboard, readings, alerts, and alert stream in `DASHBOARD_RESOURCE_PATHS`.
- Reserved `DashboardRequestMetadata` with `etag`, `lastModified`, and `version` fields for later conditional requests.
- Reserved `alertStream` path for later SSE/WebSocket alert push without changing the current screen behavior.

Automated checks:
- `npm run lint` passed.
- `npm run build` passed.
- `.venv\Scripts\python.exe backend\manage.py check` passed.

Browser verification:
- `GET /` returned 200 from `127.0.0.1:8000`.
- Playwright CLI loaded page title `智慧农业管理中枢`.
- Initial browser request list contained one `GET /api/v1/greenhouse/dashboard` 200 request.
- Clicking the detail navigation kept the page stable; later dashboard requests observed were scheduled polling/manual refresh, not route remounts.
- Simulated `document.hidden=true` and waited 35 seconds; no new dashboard request was added during the hidden interval.

Compatibility impact:
- Core dashboard rendering remains unchanged.
- Manual refresh still exists; its icon now reflects active query fetching.
- If refresh fails after data is already visible, the page keeps the cached dashboard and shows a visible failed-refresh status.

Known limits:
- Backend conditional response headers and push transport are only reserved at the client interface layer in this item.

Git Commit: refactor(frontend): cache dashboard polling
Continue next item: waiting for manual confirmation
是否允许继续下一项：等待人工确认
