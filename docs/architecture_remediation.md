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

## D-08

Issue: D-08
Status: completed, waiting for manual confirmation
Changed files:
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/pages/DashboardPage.tsx`
- `src/hooks/useDashboard.ts`
- `src/store/dashboardStore.ts`
- `src/components/dashboard/DashboardTopbar.tsx`
- `src/components/dashboard/HeroPanel.tsx`
- `src/components/dashboard/CropTabs.tsx`
- `src/components/dashboard/MapPanel.tsx`
- `src/components/dashboard/EnvironmentPanel.tsx`
- `src/components/dashboard/AlertPanel.tsx`
- `src/components/dashboard/PanelFallback.tsx`
- `docs/architecture_remediation.md`

Key decisions:
- Added `react-router-dom` and made `src/App.tsx` the application entry, route table, and global stylesheet boundary.
- Moved dashboard orchestration into `src/pages/DashboardPage.tsx`.
- Added `zustand` store for selected crop, selected greenhouse, theme, and mobile navigation UI state.
- Added `useDashboard()` as the testable view-model hook that combines query data, selection state, totals, and theme synchronization.
- Split dashboard presentation into typed components for topbar, hero, crop tabs, map, environment detail, alerts, and lazy fallback.
- Moved Dalian map loading and projection out of the page component into `MapPanel`.
- Kept the existing `/` route and hash anchors (`#overview`, `#map`, `#detail`, `#diagnosis`) compatible.

Automated checks:
- `npm run lint` passed.
- `npm run build` passed.
- `.venv\Scripts\python.exe backend\manage.py check` passed.

Browser verification:
- `GET /` returned 200 from `127.0.0.1:8000`.
- Playwright CLI loaded page title `智慧农业管理中枢`.
- Snapshot confirmed topbar, hero, crop tabs, Dalian map, greenhouse list, weather panel, diagnosis panel, trend chart, and alert panel render after the split.
- Browser request list showed `GET /api/v1/greenhouse/dashboard` 200 and `GET /data/dalian.geojson` 200.
- Clicking the `监测` navigation updated the URL to `http://127.0.0.1:8000/#detail`.

Compatibility impact:
- Current dashboard UI and hash navigation remain compatible.
- Bundle size increased because `react-router-dom` and `zustand` are now production dependencies.

Known limits:
- Component unit tests were not added yet; the split makes `useDashboard`, `MapPanel`, and `EnvironmentPanel` independently testable for a later test pass.

Git Commit: refactor(frontend): split dashboard app shell
Continue next item: waiting for manual confirmation

## D-09

Issue: D-09
Status: completed, waiting for manual confirmation
Changed files:
- `smart-agri-miniapp/utils/demoFallback.js`
- `smart-agri-miniapp/services/dashboard.js`
- `smart-agri-miniapp/services/weather.js`
- `smart-agri-miniapp/services/auth.js`
- `smart-agri-miniapp/services/advisor.js`
- `smart-agri-miniapp/services/diagnosis.js`
- `smart-agri-miniapp/pages/dashboard/dashboard.js`
- `smart-agri-miniapp/pages/dashboard/dashboard.wxml`
- `smart-agri-miniapp/pages/weather/weather.js`
- `smart-agri-miniapp/pages/weather/weather.wxml`
- `docs/architecture_remediation.md`

Key decisions:
- Added a shared miniapp fallback policy in `utils/demoFallback.js`.
- Demo fallback now requires both `ENABLE_DEMO_FALLBACK=true` and WeChat runtime `envVersion=develop`.
- `trial` and `release` runtimes throw the real service error instead of returning demo data.
- Fallback logs now include service name, whether fallback was enabled, configured environment, runtime environment, and original error summary.
- Dashboard, weather, auth, advisor, and diagnosis services now use the same fallback gate so release builds cannot reach demo through another API path.
- Dashboard and weather pages now expose explicit empty-data states with retry buttons.

Automated checks:
- `Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }` passed in `smart-agri-miniapp`.
- `Get-ChildItem -Recurse -Filter *.json | ForEach-Object { node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" $_.FullName }` passed in `smart-agri-miniapp`.
- `rg -n "ENABLE_DEMO_FALLBACK|using demo|demo login|throw error|if \(ENABLE" services utils config` confirmed direct fallback decisions only remain in `utils/demoFallback.js` and config.

Compatibility impact:
- Development runtime can still use demo data when explicitly configured.
- Trial and release users now see service/network errors and can retry instead of seeing fake data.

Known limits:
- WeChat DevTools compile was not run from this environment; syntax and JSON checks passed.

Miniapp Git Commit: fix(miniapp): gate demo fallback by runtime (`3864881`)
Parent Git Commit: docs(remediation): record d09 miniapp fallback policy
Continue next item: waiting for manual confirmation
是否允许继续下一项：等待人工确认

## D-10

Issue: D-10
Status: completed, waiting for manual confirmation
Changed files:
- `smart-agri-miniapp/config/api.js`
- `smart-agri-miniapp/config/api.env.js`
- `smart-agri-miniapp/config/api.env.example.js`
- `smart-agri-miniapp/scripts/validate-api-config.cjs`
- `smart-agri-miniapp/utils/request.js`
- `smart-agri-miniapp/utils/demoFallback.js`
- `smart-agri-miniapp/README.md`
- `docs/architecture_remediation.md`

Key decisions:
- Replaced the hard-coded miniapp API environment with WeChat runtime-aware `develop`, `trial`, and `release` mapping.
- Moved API bases, timeout, retry count, and demo fallback switch into `config/api.env.js`, with a committed example file.
- Kept local `develop` on `http://127.0.0.1:8000`, required HTTPS for `trial` and `release`, and blocked release-like test hosts.
- Added `scripts/validate-api-config.cjs` so packaging can fail before release when the production domain is missing or unsafe.
- Made the request wrapper use configured timeout and retry count, retrying only network and 5xx failures.
- Updated demo fallback runtime detection to support the new `develop` environment name.
- Documented legal-domain, HTTPS, timeout, retry, and release-domain validation steps in the miniapp README.

Automated checks:
- `Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }` passed in `smart-agri-miniapp`.
- `Get-ChildItem -Recurse -Filter *.json | ForEach-Object { node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" $_.FullName }` passed in `smart-agri-miniapp`.
- `node scripts\validate-api-config.cjs develop` passed and resolved `http://127.0.0.1:8000`.
- `node scripts\validate-api-config.cjs trial` passed and resolved `https://trial-api.smart-agri.cn`.
- `node scripts\validate-api-config.cjs release` failed as expected because the production domain is intentionally missing.
- `$env:MINIAPP_API_BASE_URL='https://api.smart-agri.cn'; node scripts\validate-api-config.cjs release` passed.
- Release validation rejected `https://127.0.0.1` and `https://api.example.com` as unsafe hosts.

Compatibility impact:
- Development runtime remains local-debug friendly.
- Trial and release runtimes no longer inherit local or placeholder API domains.
- A real production API domain must be supplied in `config/api.env.js` or via `MINIAPP_API_BASE_URL` before release packaging.

Known limits:
- WeChat DevTools compile was not run from this environment; syntax, JSON, and environment validation checks passed.

Miniapp Git Commit: fix(miniapp): validate API environment config (`ea80df7`)
Parent Git Commit: docs(remediation): record d10 miniapp api config
Continue next item: waiting for manual confirmation

## D-11

Issue: D-11
Status: completed, waiting for manual confirmation
Changed files:
- `backend/apps/ai_advisory/models.py`
- `backend/apps/ai_advisory/admin.py`
- `backend/apps/ai_advisory/upload_security.py`
- `backend/apps/ai_advisory/views.py`
- `backend/apps/ai_advisory/migrations/0001_initial.py`
- `backend/apps/ai_advisory/tests/test_disabled_integrations.py`
- `backend/config/settings/base.py`
- `docs/architecture_remediation.md`

Key decisions:
- Added `UploadAsset` and `UploadScanTask` to trace uploader, original name, random storage key, content type, detected content type, extension, size, SHA-256, scan status, and creation time.
- Added signature-based image detection for JPEG, PNG, and WebP as an equivalent local alternative to `python-magic`; declared MIME, detected MIME, and extension must all agree.
- Added `ScopedRateThrottle` on the v1 crop diagnosis upload endpoint with `DRF_AI_UPLOAD_THROTTLE_RATE` defaulting to `20/min`.
- Stored accepted uploads under `DJANGO_PRIVATE_UPLOAD_ROOT` instead of frontend/static paths and generated random file names.
- Added ClamAV scan task records. When `CLAMAV_ENABLED=false`, assets are marked `scan_unavailable` with a task detail policy of `hold_and_block_use`.
- Added MinIO private bucket configuration placeholders for production migration without exposing public upload URLs.
- Registered upload assets and scan tasks in Django admin for auditability.

Automated checks:
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.ai_advisory` passed with 10 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps` passed with 56 tests.

Acceptance coverage:
- Forged MIME upload `leaf.jpg` with `image/jpeg` but non-image bytes is rejected.
- Oversized upload is rejected by serializer validation.
- Upload throttling returns HTTP 429 when the configured rate is exceeded.
- Accepted uploads are written to private storage and `GET /<storage_key>` returns 404.
- Upload and scan records are persisted with SHA-256, size, detected MIME, scan status, and timestamps.

Compatibility impact:
- Existing disabled external integration behavior remains unchanged for empty diagnosis requests.
- Valid diagnosis uploads are now validated and recorded before the external adapter 503 response.
- Production deployments can later enable ClamAV and MinIO without changing the API contract.

Known limits:
- The ClamAV worker itself is not implemented in this pass; unavailable scanner state is explicit and blocks implicit trust of uploaded files.

Parent Git Commit: feat(ai): secure crop diagnosis uploads
Continue next item: waiting for manual confirmation

## D-12

Issue: D-12
Status: completed, waiting for manual confirmation
Changed files:
- `backend/apps/greenhouse/views.py`
- `backend/apps/greenhouse/serializers.py`
- `backend/apps/greenhouse/tests/test_dashboard_api.py`
- `backend/config/urls.py`
- `backend/config/settings/base.py`
- `docs/architecture_remediation.md`

Key decisions:
- Added the requested resource routes:
  - `GET /api/v1/greenhouses/`
  - `GET /api/v1/greenhouses/{id}/readings/`
  - `GET /api/v1/greenhouses/{id}/alerts/`
  - `GET /api/v1/greenhouses/{id}/dashboard/`
- Kept the existing `/api/v1/greenhouse/dashboard` response shape compatible for current web and miniapp clients.
- Added serializer-based filter validation as the local equivalent to `django-filter`, with whitelisted ordering fields.
- Added `start_time`, `end_time`, `metrics`, `metric_type`, and `ordering` support for paginated greenhouse readings.
- Added `status`, `level`, `start_time`, `end_time`, and `ordering` support for paginated greenhouse alerts.
- Added `GREENHOUSE_HISTORY_MAX_RANGE_DAYS`, default `31`, to reject oversized historical range queries.
- Added single-greenhouse dashboard summaries that return first-screen state only; trend/curve history is fetched through the readings endpoint.
- Added a greenhouse access resolver that returns 404 for unknown or inaccessible greenhouse ids/codes while preserving `ApiKeyRequired`.
- Added explicit OpenAPI parameter descriptions through `drf-spectacular` parameters.

Automated checks:
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.greenhouse` passed with 20 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps` passed with 62 tests.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed.
- `.venv\Scripts\python.exe backend\manage.py spectacular --file .runtime\openapi-d12.yaml --validate` passed.

Acceptance coverage:
- Large greenhouse reading sets are returned through the unified paginated response.
- Readings can be queried by time range and metric list for curve data.
- Invalid time range and oversized range requests return HTTP 400.
- Alerts can be filtered by active/resolved status, level, and time range.
- Unknown greenhouse detail access returns HTTP 404.
- Per-greenhouse dashboard summary omits trend data and leaves curve loading to the readings endpoint.

Compatibility impact:
- Existing dashboard clients continue to use the old dashboard route without a payload shape change.
- New clients can migrate to the resource-oriented plural endpoints incrementally.

Known limits:
- There is not yet a greenhouse-to-user ACL model; the access resolver currently enforces authentication and hides unknown resources, and is the extension point for future object permissions.

Parent Git Commit: feat(greenhouse): add paginated resource APIs
Continue next item: waiting for manual confirmation

## D-13

Issue: D-13
Status: completed, waiting for manual confirmation
Changed files:
- `backend/apps/core/logging.py`
- `backend/apps/core/metrics.py`
- `backend/apps/core/middleware.py`
- `backend/apps/core/views.py`
- `backend/apps/core/tests/test_health.py`
- `backend/apps/weather/services.py`
- `backend/apps/integrations/youren/client.py`
- `backend/apps/ai_advisory/upload_security.py`
- `backend/config/settings/base.py`
- `backend/config/urls.py`
- `docs/observability.md`
- `docs/architecture_remediation.md`

Key decisions:
- Added JSON structured logging with redaction for token, password, secret, cookie, session, credential, and related field names.
- Extended request middleware to log request_id, user_id, path, method, status_code, duration_ms, and exception state for every request.
- Preserved and returned `X-Request-ID`; invalid incoming ids are still replaced with generated UUIDs.
- Added a lightweight in-process Prometheus text renderer and `/api/v1/metrics/` endpoint controlled by `PROMETHEUS_METRICS_ENABLED`.
- Kept the metrics endpoint behind the existing API authentication policy when enabled.
- Added metric hooks for HTTP requests, request duration, slow queries, third-party call duration, cache hit/miss events, and upload failures.
- Reserved Sentry settings (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`) without requiring the SDK when DSN is empty.
- Added `docs/observability.md` with Prometheus scrape examples, Grafana starter panels, and sensitive logging guidance.

Automated checks:
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.core` passed with 16 tests.
- `.venv\Scripts\python.exe backend\manage.py test apps` passed with 65 tests.
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run` passed.
- `.venv\Scripts\python.exe backend\manage.py spectacular --file .runtime\openapi-d13.yaml --validate` passed.

Acceptance coverage:
- Local test runs output structured JSON logs.
- `request_id` is preserved across request header, response header, response body, and request log fields.
- Empty Sentry DSN requires no SDK and does not affect startup.
- Metrics endpoint returns HTTP 404 while disabled and Prometheus text when enabled.
- Formatter redacts sensitive fields and serializes Django request objects without query strings.
- Prometheus and Grafana setup instructions are documented.

Compatibility impact:
- Default log format is now JSON. Set `DJANGO_LOG_FORMAT=plain` for local plain-text logs.
- Metrics are disabled unless explicitly enabled with `PROMETHEUS_METRICS_ENABLED=true`.

Known limits:
- Metrics are in-process counters suitable for a single Django process. Multi-process production deployments should use a Prometheus-compatible multiprocess backend or sidecar in a later hardening pass.
- Sentry is configuration-only in this pass; enabling real Sentry capture requires adding and initializing `sentry-sdk`.

Parent Git Commit: feat(observability): add structured logs and metrics
Continue next item: waiting for manual confirmation

## D-14

Issue: D-14
Status: completed, waiting for manual confirmation
Changed files:
- `backend/config/urls.py`
- `backend/config/settings/base.py`
- `backend/apps/core/tests/test_health.py`
- `docs/api_contract_v1.yaml`
- `docs/api_inventory.md`
- `docs/architecture_remediation.md`

Key decisions:
- Kept `drf-spectacular` as the OpenAPI source of truth and regenerated `docs/api_contract_v1.yaml` from the live Django URL/schema configuration.
- Added ReDoc at `GET /api/v1/redoc/` alongside existing schema and Swagger routes.
- Added `/api/v1/redoc/` to default public API paths so schema, Swagger, and ReDoc share the same access behavior.
- Updated `docs/api_inventory.md` to state that OpenAPI is the contract baseline and to document generation, CI validation, and frontend/client type generation commands.
- Removed stale D-12-era descriptions that said alert pagination and other current v1 endpoints were still unknown or pending.
- Documented the implemented greenhouse resource APIs, auth/platform endpoints, and remaining deferred API surfaces.
- Reused the existing `scripts/verify.py` CI path, which already runs `spectacular --validate`.

Automated checks:
- `.venv\Scripts\python.exe backend\manage.py spectacular --file docs\api_contract_v1.yaml --validate` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps.core` passed with 17 tests.
- `.venv\Scripts\python.exe backend\manage.py check` passed.
- `.venv\Scripts\python.exe backend\manage.py test apps` passed with 66 tests.
- `.venv\Scripts\python.exe backend\manage.py spectacular --file .runtime\openapi-d14.yaml --validate` passed.
- `rg` found no stale `告警列表分页接口：UNKNOWN` or `仍待 D-12` text in `docs/api_inventory.md`.

Acceptance coverage:
- OpenAPI schema reflects current v1 greenhouse resource routes.
- Schema can be generated and validated from the command line.
- Swagger and ReDoc routes return HTTP 200 in tests.
- CI can validate schema generation through `scripts/verify.py`.
- Frontend TypeScript/client generation workflow is documented.

Compatibility impact:
- Existing `/api/v1/schema/` and `/api/v1/docs/` routes remain unchanged.
- New `/api/v1/redoc/` route is additive.

Known limits:
- Generated frontend client code was not introduced in this pass; the documented command establishes the workflow while avoiding generated-code churn.

Parent Git Commit: docs(api): refresh OpenAPI contract baseline
Continue next item: waiting for manual confirmation
