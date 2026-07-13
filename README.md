# 智慧农业管理大屏

一个面向温室大棚管理者的智慧农业系统。当前本地版本已经迁移为 Django API-first 架构：Django 在 `8000` 端口同时提供 React 前端、Django Admin 后台和 `/api` 接口；Vite `5173` 仅作为可选热更新开发入口。

## 功能概览

- 支持三种作物：冰糖枣、蓝莓、樱桃。
- 每种作物支持多个大棚，每个大棚展示在线状态、设备数和核心环境指标。
- 核心指标包括空气温度、空气湿度、光照、CO2、土壤湿度、土壤温度、EC、PH。
- 详情区展示最近 24 小时趋势图和预警中心。
- 支持浅色/深色主题切换，主题会保存到浏览器 `localStorage`。
- 默认每 30 秒刷新一次数据，并显示最后更新时间。
- 数据层已抽象，生产构建默认通过 Django `/api/v1/greenhouse/dashboard` 读取数据。
- 支持本地 Excel 数据模式，缺失传感器值会显示为无数据，不会被误写成 0。
- Django 后台已启用 `django-simpleui`，默认中文界面。
- 已接入 Open-Meteo 天气预报；AI 操作建议、图片诊断和农业问答仍保持受控关闭，等待 AI 适配器和凭据配置。

## 技术栈

- React 19
- TypeScript
- Vite
- Recharts
- lucide-react
- Django 4.2
- Django REST Framework
- drf-spectacular
- django-simpleui
- 原生 CSS 变量和响应式布局

## 本地运行

首次安装依赖：

```powershell
npm install
.venv\Scripts\python.exe -m pip install -r requirements\development.txt
```

推荐使用单端口 Django 模式：

```powershell
npm run build
$env:WEATHER_INTEGRATION_ENABLED = "true"
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

打开：

```text
http://127.0.0.1:8000/
```

后台：

```text
http://127.0.0.1:8000/admin/
```

## 常用命令

```bash
npm run dev
npm run local:data
npm run build
npm run preview
npm run lint
npm run verify
```

- `npm run dev`：启动 Vite 热更新开发服务器，仅用于前端开发。
- `npm run local:data`：读取本地 Excel 文件夹并生成网页使用的 `public/data/local-dashboard.json`。
- `npm run build`：执行 TypeScript 检查并打包生产版本。
- `npm run preview`：本地预览生产构建结果。
- `npm run lint`：运行 ESLint。
- `npm run verify`：运行 Django 检查、迁移 dry-run、种子导入、后端测试、OpenAPI 校验、前端 lint/build。

`package.json` 中仍保留 `dev:api`、`dev:full` 和 `youren:test` 等旧 Node 脚本，主要用于历史参考、有人云探测或临时回退；Node dashboard 路径只转发到 Django，日常集成运行以 Django `8000` 单端口为准。

## 目录结构

```text
src/
  App.tsx                 页面框架、作物切换、地图和大棚选择逻辑
  App.css                 看板页面样式，包含组件共享样式
  index.css               全局变量、主题和基础样式
  types.ts                前后端共享的仪表盘、诊断和天气建议类型
  components/             懒加载业务面板：天气、AI 诊断、冰糖枣顾问、趋势图
  data/
    dataProvider.ts       数据入口，可切换 mock、local 和 remote API
    mockDashboard.ts      演示用模拟数据
    greenhouseLocations.ts 大棚地图定位配置
  lib/
    formatters.ts         UI 文案、时间、风险和数值格式化
    http.ts               前端请求超时封装
    metrics.ts            诊断和天气建议共用的指标快照构造
server/
  youren-api.mjs          旧 Node 本地 API 网关，dashboard 路径转发到 Django，仅保留探测/回退能力
  ai-diagnosis.mjs        旧 Node 作物图片诊断接口
  agri-chat.mjs           旧 Node 冰糖枣问答接口
  weather-advice.mjs      旧 Node Open-Meteo 天气和棚内操作建议接口
backend/
  manage.py               Django 管理入口
  config/                 Django URL 和 settings
  apps/
    core/                 统一响应、异常、权限、健康检查和前端 dist 服务
    greenhouse/           P0 看板模型、种子导入和 dashboard API
    weather/              Open-Meteo 天气预报 API
    ai_advisory/          AI 图片诊断/问答 safe-disabled API
scripts/
  build-local-dashboard.py 本地 Excel 转换为 public/data/local-dashboard.json
  verify.py               本地和 CI 统一验证入口
public/
  data/                   前端可直接读取的地图和本地数据 JSON
  images/                 作物主视觉图片
requirements/
  base.txt                Django 基础依赖
  development.txt         本地开发依赖
  mysql.txt               MySQL 驱动依赖
config/
  greenhouse.mapping.example.json 有人云大棚和变量映射示例
```

## 数据模型

前端统一使用 `DashboardData`：

```ts
interface DashboardData {
  generatedAt: string
  source: 'mock' | 'youren' | 'local'
  crops: Crop[]
}
```

核心指标允许返回空值：

```ts
interface MetricReading {
  key: MetricKey
  label: string
  value: number | null
  unit: string
  status: 'normal' | 'warning' | 'critical'
  target: string
}
```

`value: null` 表示该传感器当前没有有效数据。前端会显示 `-`，后端不应把缺失值、空字符串或无法解析的值转换成 `0`。真实的 `0` 仍应作为有效数值保留，例如夜间光照为 `0 lux`。

核心层级是：

```text
DashboardData
  Crop[]
    Greenhouse[]
      MetricReading[]
      TrendPoint[]
      AlertItem[]
```

这样 UI 不依赖有人云原始字段。后续只需要在后端把有人云设备、变量、实时数据和历史数据转换成这个结构即可。

## 数据源配置

当前生产构建默认使用 Django API：

```env
VITE_DATA_SOURCE=remote
VITE_DASHBOARD_ENDPOINT=/api/v1/greenhouse/dashboard
VITE_LOCAL_DASHBOARD_PATH=/data/local-dashboard.json
VITE_HISTORICAL_ANALYTICS_PATH=/data/historical-analytics.json
```

- `mock`：使用 `src/data/mockDashboard.ts`，适合前端开发和演示。
- `local`：请求 `VITE_LOCAL_DASHBOARD_PATH`，读取 `npm run local:data` 生成的 JSON。
- 历史分析区始终请求 `VITE_HISTORICAL_ANALYTICS_PATH`；`npm run local:data` 会同时生成实时本地快照和 2026 日级历史分析文件。
- `remote`：请求 `VITE_DASHBOARD_ENDPOINT`，当前由 Django 提供。

如果没有设置 `VITE_DATA_SOURCE`，前端默认按 `remote` 处理。`VITE_USE_REMOTE_DATA` 仅为旧配置兼容项。

## 使用本地 Excel 数据

当前项目已经支持直接读取本地 Excel 转换后的 JSON 数据。你的 Excel 源文件放在：

```text
2026冰糖枣蓝莓数据采集/
```

生成网页数据：

```bash
npm run local:data
```

生成结果：

```text
public/data/local-dashboard.json
```

本地数据模式需要在 `.env.local` 中配置：

```env
VITE_DATA_SOURCE=local
VITE_LOCAL_DASHBOARD_PATH=/data/local-dashboard.json
VITE_HISTORICAL_ANALYTICS_PATH=/data/historical-analytics.json
```

然后启动 Vite 开发网页：

```bash
npm run dev
```

当前脚本会自动识别：

- `冰糖枣1号数据` -> 冰糖枣 1号棚
- `冰糖枣2号数据` -> 冰糖枣 2号棚
- `蓝莓c1` -> 蓝莓 C1 棚
- `蓝莓c2` -> 蓝莓 C2 棚

Excel 工作表会按“变量名称、从机名称”映射为空气温度、空气湿度、光照、CO2、土壤湿度、土壤温度、EC、PH。当前文件夹没有樱桃 Excel 数据，所以樱桃页面会显示“暂无本地数据”。

## Django API 状态

当前前端默认调用：

```http
GET /api/v1/greenhouse/dashboard
```

Django 已实现：

- `GET /api/v1/greenhouse/dashboard`：v1 dashboard，返回 `{ code, message, data, request_id }`，Web 与小程序默认使用该路径。
- `GET /api/greenhouse/dashboard`：legacy dashboard，由 Django 返回前端可消费的 `DashboardData`，仅作兼容 adapter 保留。
- `POST /api/v1/weather/greenhouse-advice`：v1 天气接口，返回统一包装。
- `POST /api/v1/ai/crop-diagnosis`、`POST /api/v1/ai/agri-chat`：当前为 safe-disabled，默认不调用真实 AI。

Open-Meteo 天气预报不需要 API key：

```powershell
$env:WEATHER_INTEGRATION_ENABLED = "true"
```

开发环境默认使用 Django `LocMemCache`；生产多进程部署建议启用 Redis：

```env
DJANGO_CACHE_BACKEND=redis
REDIS_CACHE_URL=redis://127.0.0.1:6379/1
WEATHER_CACHE_TTL_SECONDS=21600
WEATHER_FAILURE_CACHE_TTL_SECONDS=60
WEATHER_CACHE_LOCK_SECONDS=30
```

天气缓存 key 包含数据源、日期、作物/温室、经纬度和 advice 参数。外部天气接口失败时，v1 错误响应会在 `data` 中返回 `degraded=true`、`source` 和降级消息。

AI 相关接口目前只保留安全关闭入口。即使配置 `EXTERNAL_INTEGRATIONS_ENABLED=true`，Django 版 AI 适配器仍需后续实现后才能真实调用模型。

健康检查：

```http
GET /api/v1/health/
```

## DTU TCP ingest

D-16 adds a guarded DTU ingest path for TCP transparent-transmission devices:

- TCP gateway: `server/dtu-tcp-server.mjs`
- Protocol/parser tests: `server/ingest/dtu-protocol.test.mjs`
- Simulation script: `scripts/simulate-dtu-frame.mjs`
- Backend API: `POST /api/v1/ingest/dtu-readings`
- Detailed runbook: `docs/dtu_tcp_receiver.md`

Local commands:

```powershell
npm run dev:dtu
npm run dtu:simulate -- --device dtu-001 --token replace-with-device-token
npm run dtu:test
```

The gateway requires a private registry at `config/dtu.devices.json`; copy from `config/dtu.devices.example.json` and replace placeholder values locally. Do not commit real device tokens or real source IPs.

In Django Admin, register a `Device` with `provider=dtu`, `ingest_enabled=true`, a SHA-256 `ingest_token_hash` or strict `ingest_allowed_ips`, and the target `Greenhouse`. Accepted DTU readings are stored as `EnvironmentReading(source=dtu)` and linked back to the device and greenhouse. Rejected frames are recorded in `DtuIngestAuditEvent` with only hash and redacted snippets.

## AI 作物诊断

页面中的 AI 诊断面板会上传一张 JPG、PNG 或 WebP 图片，并附带当前大棚的环境指标：

```http
POST /api/ai/crop-diagnosis
Content-Type: multipart/form-data
```

表单字段：

- `image`：作物图片，单张不超过 8MB。
- `cropId`：作物 ID。
- `cropName`：作物名称。
- `greenhouseId`：大棚 ID。
- `metrics`：环境指标 JSON 字符串。

当前 Django 版本默认返回 503，不会上传图片到真实外部模型。后续启用 AI 适配器时才需要配置：

```env
EXTERNAL_INTEGRATIONS_ENABLED=true
AI_API_KEY=your_ai_api_key
AI_MODEL=gpt-4o-mini
AI_API_BASE=your_openai_compatible_base
```

前端会在选择非法格式或超大图片时清空旧图片实例，避免误提交上一张图片。AI 返回结果应由服务端标准化为 `CropDiagnosisResult` 后再返回给页面。

## 有人云接入设计

有人云真实接入当前尚未迁入 Django。旧 Node 网关仍保留在 `server/` 目录中作为参考/回退，但本地单端口运行默认不使用它。

不要在前端保存有人云账号、密码、`appKey` 或 `appSecret`。真实接入应放在 Django 后端或云服务器后端：

1. 在有人云平台的二次开发功能中获取 `appKey` 和 `appSecret`。
2. 在服务器环境变量中配置：

```env
YOUREN_APP_KEY=your_app_key
YOUREN_APP_SECRET=your_app_secret
YOUREN_API_BASE=https://example.youren-cloud-api.invalid
YOUREN_INTEGRATION_ENABLED=true
```

3. 后端调用有人云鉴权接口获取 `X-Access-Token`，并缓存 Token。
4. 后端继续调用有人云设备列表、变量列表、实时数据、历史数据接口。
5. 后端把有人云原始数据组装成前端需要的 `DashboardData`。
6. 前端只请求自己的 `/api/v1/greenhouse/dashboard`；legacy `/api/greenhouse/dashboard` 仅作旧调用兼容。

有人云文档中提到：

- 二次开发 API 需要通过 `appKey` 和 `appSecret` 获取 `X-Access-Token`。
- `X-Access-Token` 有效期约 2 小时。
- 网关列表接口地址以有人云官方文档和服务器环境变量配置为准，请求头需要携带 `X-Access-Token`。

## 后端接口与后台

当前 Django 后端已经具备：

- 单端口前端服务：`GET /`
- Django Admin：`GET /admin/`
- OpenAPI：`GET /api/v1/schema/`
- Swagger UI：`GET /api/v1/docs/`
- 健康检查：`GET /api/v1/health/`
- P0 看板：`GET /api/v1/greenhouse/dashboard`，legacy `GET /api/greenhouse/dashboard`
- P0 环境读数查询：`GET /api/v1/greenhouse/readings?greenhouse=...&start=...&end=...`
- P1 天气：`POST /api/weather/greenhouse-advice`

Django Admin 使用 `django-simpleui`，默认中文；已注册：

- `Greenhouse`
- `Device`
- `EnvironmentReading`
- `Alert`
- `DashboardSnapshot`

本地超级管理员需要在本地数据库中创建，账号密码不会提交到 Git。

## API 安全配置

本地开发默认不强制 API key：

```env
DJANGO_API_AUTH_REQUIRED=false
```

生产配置默认要求 API key。启用后，请设置：

```env
DJANGO_API_AUTH_REQUIRED=true
DJANGO_API_AUTH_TOKEN=your_random_token
```

客户端可通过任一方式传入：

```http
X-API-Key: your_random_token
Authorization: Bearer your_random_token
```

生产 settings 还要求：

- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- 启用 API 鉴权时必须设置 `DJANGO_API_AUTH_TOKEN`

## 大棚和变量映射

有人云真实数据接入后，推荐创建：

```text
config/greenhouse.mapping.json
```

可以从模板复制：

```bash
copy config\greenhouse.mapping.example.json config\greenhouse.mapping.json
```

映射文件用于告诉系统：

- 冰糖枣、蓝莓、樱桃分别包含哪些大棚。
- 每个大棚对应哪个有人云 `deviceNo`。
- 每个环境指标对应哪个有人云 `dataPointId`。

当前 Django 单端口版本默认不启用有人云真实读取；P0 看板优先使用 `seed_dev` 导入的 `Greenhouse`、`Device`、`EnvironmentReading` 和 `Alert` 规范化数据聚合，`DashboardSnapshot` 仅作为缓存和降级数据。启用有人云后，应优先使用数据库表或该映射文件维护设备关系，不要在前端保存有人云密钥。

旧 Node 探测脚本仍可作为临时工具获取 `deviceNo` 和 `dataPointId`：

```bash
npm run youren:test
```

脚本依赖服务端环境变量中的有人云密钥，输出网关样本和变量样本后，再把对应值填入 `config/greenhouse.mapping.json` 或后续 Django 配置表。

## 开发说明

- `src/App.tsx` 保留页面编排和大棚地图逻辑；天气、诊断、问答、趋势图等较重模块已拆到 `src/components/` 并使用 `React.lazy` 懒加载。
- 样式使用 CSS 变量实现主题，浅色和深色主题都在 `src/index.css` 中。
- 作物主视觉当前使用 Wikimedia Commons 上对应作物图片：枣树果实、蓝莓灌木、樱桃树果实。后续建议替换为你自己的基地实拍照片。
- 模拟数据在 `src/data/mockDashboard.ts`，可直接修改大棚数量、指标值、告警内容。
- 模拟模式图片在 `src/data/mockDashboard.ts` 修改；Django dashboard 默认从规范化模型聚合 `DashboardData`，没有规范化数据时才降级读取 `DashboardSnapshot.payload`，启用 `YOUREN_INTEGRATION_ENABLED=true` 后由 Django 有人云 service 实时映射。
- 前端刷新间隔在 `src/App.tsx` 的 `refreshIntervalMs` 中，默认 30 秒。
- 前端刷新有请求序号保护，轮询和手动刷新并发时，旧响应不会覆盖新数据。
- 新增工具函数或类型时优先保持模块内私有；只有被其他文件实际导入时再 `export`。
- 诊断和天气建议共用的指标字段在 `src/lib/metrics.ts` 维护，避免在组件里重复拼装指标对象。
- `src/assets/` 中的 Vite 模板资源已清理；新增图片优先放在 `public/images/`，便于 mock、local 和 remote 数据统一引用。
- README 和源码均使用 UTF-8。Windows PowerShell 读取中文文件时建议加 `-Encoding UTF8`。

## 验收清单

- 页面打开后直接显示管理大屏，不是宣传落地页。
- 三种作物可以切换。
- 每种作物下有多个大棚。
- 点击大棚后详情指标、趋势图、预警列表会同步切换。
- 主题按钮可切换浅色/深色，刷新页面后保持选择。
- 移动端布局不重叠，作物标签可横向滚动。
- `npm run build` 可以通过。
- `npm run lint` 可以通过。
- `npm run local:data` 可以生成可解析的 `public/data/local-dashboard.json`。

## Django 单端口集成

Django 当前可以在一个端口同时提供打包后的 React 前端、Django Admin 和 `/api` 接口。

打包前端：

```powershell
npm run build
```

启动 Django：

```powershell
$env:WEATHER_INTEGRATION_ENABLED = "true"
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

打开集成后的前台：

```text
http://127.0.0.1:8000/
```

打开 Django 后台：

```text
http://127.0.0.1:8000/admin/
```

Django Admin 使用 `django-simpleui`，并通过 `LANGUAGE_CODE=zh-hans` 默认显示中文。

后台的 "View site" 和 simple-ui 首页按钮默认指向 `http://127.0.0.1:8000/`。只有在单独使用 Vite 热更新开发前端时，才需要覆盖为 `5173`：

```powershell
$env:DJANGO_ADMIN_SITE_URL = "http://127.0.0.1:5173/"
$env:DJANGO_FRONTEND_SITE_URL = "http://127.0.0.1:5173/"
```

需要本地后台账号时自行创建超级管理员：

```powershell
.venv\Scripts\python.exe backend\manage.py createsuperuser
```

可选的 Vite 热更新前端：

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

直接使用 Vite 时打开：

```text
http://127.0.0.1:5173/
```

默认 `EXTERNAL_INTEGRATIONS_ENABLED=false`。设置 `WEATHER_INTEGRATION_ENABLED=true` 后启用 Open-Meteo 天气预报。天气结果通过 Django cache framework 缓存；本地默认 LocMemCache，生产可通过 `DJANGO_CACHE_BACKEND=redis` 与 `REDIS_CACHE_URL` 切换到 Redis。AI 操作建议、作物图片诊断和农业问答在 Django 版中仍保持关闭，直到后续完成 AI 适配器和凭据配置。

运行完整本地验证：

```powershell
npm run verify
```

## Final acceptance checklist

Use this checklist after D-01 through D-16 remediation or before handing the project to deployment/operations.

1. Run the full automated suite:

```powershell
npm run verify
```

This runs Django system checks, migration dry-run, isolated SQLite migration, dev seeding idempotency, backend tests, OpenAPI validation, DTU parser tests, ESLint, and the production frontend build.

2. Start the integrated local site:

```powershell
npm run build
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

Then verify:

- `http://127.0.0.1:8000/` opens the dashboard without a blank screen.
- `http://127.0.0.1:8000/admin/` opens the Django Admin login/admin UI.
- `http://127.0.0.1:8000/api/v1/health/` returns `code=0` and `data.ok=true`.
- `http://127.0.0.1:8000/api/v1/schema/`, `/api/v1/docs/`, and `/api/v1/redoc/` are reachable.

3. Verify protected API behavior when auth is enabled:

```powershell
$env:DJANGO_API_AUTH_REQUIRED = "true"
$env:DJANGO_API_KEY_ALLOWLIST = "local-service-key"
```

Business APIs should reject anonymous requests and accept the configured service key or JWT Bearer token.

4. Verify DTU ingest locally only with placeholder credentials:

```powershell
copy config\dtu.devices.example.json config\dtu.devices.json
npm run dev:dtu
npm run dtu:simulate -- --device dtu-001 --token replace-with-device-token
```

Before using a real DTU, create the matching Django `Device` row with `provider=dtu`, `ingest_enabled=true`, a SHA-256 `ingest_token_hash` or strict `ingest_allowed_ips`, and a target `Greenhouse`. Do not commit `config/dtu.devices.json` or real device tokens.

5. Production readiness gates:

- Set `DJANGO_SETTINGS_MODULE=config.settings.production`.
- Set a strong `DJANGO_SECRET_KEY`.
- Set explicit `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, and `DJANGO_CSRF_TRUSTED_ORIGINS`.
- Enable HTTPS-related settings behind the reverse proxy.
- Configure MySQL, Redis, Nginx/TLS, static/media paths, and miniapp request domains.
- Treat Sentry, MinIO, ClamAV, Prometheus/Grafana, and queue-backed DTU ingest as external configuration items until real services are provisioned.

阶段 5 参考文档：

- `docs/stage5_acceptance_report.md`
- `docs/mysql_switch_runbook.md`

## 桌面快捷方式

桌面快捷方式 `智慧农业网站.lnk` 指向项目内的 `启动智慧农业网站.cmd`。该脚本当前会：

1. 打包前端：`npm run build`
2. 执行 Django migration
3. 执行 `seed_dev`
4. 启动 `http://127.0.0.1:8000/`
5. 设置 `WEATHER_INTEGRATION_ENABLED=true`

因此日常使用只需要双击桌面快捷方式。

## API authentication

D-01 收窄了 Django API 的默认公开面。生产环境 `DJANGO_API_AUTH_REQUIRED` 默认为 `true`，默认公开路径仅包含 `/api/v1/health/`、`/api/v1/schema/`、`/api/v1/docs/` 以及后续登录/刷新入口。业务接口默认需要认证。

支持两类调用方：

- Web 和小程序客户端：使用 `Authorization: Bearer <JWT>`。Web 请求层会从 `localStorage` 或 `sessionStorage` 的 `smart_agri_access_token`、`access_token`、`token` 读取 token；小程序请求层会从 `wx` storage 的 `token` 读取 token。
- 设备或服务调用方：使用 `DJANGO_API_KEY_HEADER` 指定的请求头，默认 `X-API-Key`。允许的 key 通过 `DJANGO_API_KEY_ALLOWLIST` 以逗号分隔配置。`DJANGO_API_AUTH_TOKEN` 仅作为旧环境的单 token 兼容项保留。

本地开发可在 `.env.local` 或 shell 中设置 `DJANGO_API_AUTH_REQUIRED=false` 继续无 token 调试；生产环境不得把业务接口加入 `DJANGO_API_PUBLIC_PATHS`。

## WeChat miniapp login

D-02 新增了微信小程序登录接口：

- `POST /api/v1/auth/wechat-login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

生产环境需要配置 `WECHAT_MINIAPP_APPID` 和 `WECHAT_MINIAPP_SECRET`，服务端会调用微信 `code2session` 后建立本地用户和 openid 关联，并返回 SimpleJWT `access` 和 `refresh`。本地开发可显式设置 `WECHAT_LOGIN_MOCK_ENABLED=true` 使用 mock code 登录；该 mock 仅在 `DEBUG=true` 时允许启用。
