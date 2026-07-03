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
