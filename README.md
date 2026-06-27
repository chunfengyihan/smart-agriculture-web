# 智慧农业管理大屏

一个面向温室大棚管理者的单页智慧农业网站。首版使用 React + Vite + TypeScript 构建，默认展示模拟数据，并预留 `/api/greenhouse/dashboard` 接口，方便后续在云服务器上对接有人云平台。

## 功能概览

- 支持三种作物：冰糖枣、蓝莓、樱桃。
- 每种作物支持多个大棚，每个大棚展示在线状态、设备数和核心环境指标。
- 核心指标包括空气温度、空气湿度、光照、CO2、土壤湿度、土壤温度、EC、PH。
- 详情区展示最近 24 小时趋势图和预警中心。
- 支持浅色/深色主题切换，主题会保存到浏览器 `localStorage`。
- 默认每 30 秒刷新一次数据，并显示最后更新时间。
- 数据层已抽象，可从模拟数据切换到后端真实接口。
- 支持本地 Excel 数据模式，缺失传感器值会显示为无数据，不会被误写成 0。
- 支持 AI 作物图片诊断，后端统一接收图片和环境指标后调用视觉模型。

## 技术栈

- React 19
- TypeScript
- Vite
- Recharts
- lucide-react
- 原生 CSS 变量和响应式布局

## 本地运行

```bash
npm install
npm run dev
```

启动后打开终端显示的本地地址，通常是：

```text
http://localhost:5173/
```

## 常用命令

```bash
npm run dev
npm run local:data
npm run build
npm run preview
npm run lint
```

- `npm run dev`：启动本地开发服务器。
- `npm run local:data`：读取本地 Excel 文件夹并生成网页使用的 `public/data/local-dashboard.json`。
- `npm run build`：执行 TypeScript 检查并打包生产版本。
- `npm run preview`：本地预览生产构建结果。
- `npm run lint`：运行 ESLint。

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
  youren-api.mjs          本地 API 网关
  dashboard-adapter.mjs   有人云数据适配到 DashboardData
  ai-diagnosis.mjs        作物图片诊断接口
  agri-chat.mjs           冰糖枣问答接口
  weather-advice.mjs      Open-Meteo 天气和棚内操作建议接口
scripts/
  build-local-dashboard.py 本地 Excel 转换为 public/data/local-dashboard.json
public/
  data/                   前端可直接读取的地图和本地数据 JSON
  images/                 作物主视觉图片
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

项目通过 `.env.local` 中的 `VITE_DATA_SOURCE` 选择数据源：

```env
VITE_DATA_SOURCE=mock
VITE_USE_REMOTE_DATA=false
VITE_DASHBOARD_ENDPOINT=/api/greenhouse/dashboard
VITE_LOCAL_DASHBOARD_PATH=/data/local-dashboard.json
```

- `mock`：使用 `src/data/mockDashboard.ts`，适合前端开发和演示。
- `local`：请求 `VITE_LOCAL_DASHBOARD_PATH`，读取 `npm run local:data` 生成的 JSON。
- `remote`：请求 `VITE_DASHBOARD_ENDPOINT`，由本地或云端后端代理有人云数据。

推荐只通过 `VITE_DATA_SOURCE` 切换模式。`VITE_USE_REMOTE_DATA` 保留为兼容旧配置；默认示例中设为 `false`，避免复制 `.env.example` 后误连远程接口。

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
```

然后启动网页：

```bash
npm run dev
```

当前脚本会自动识别：

- `冰糖枣1号数据` -> 冰糖枣 1号棚
- `冰糖枣2号数据` -> 冰糖枣 2号棚
- `蓝莓c1` -> 蓝莓 C1 棚
- `蓝莓c2` -> 蓝莓 C2 棚

Excel 工作表会按“变量名称、从机名称”映射为空气温度、空气湿度、光照、CO2、土壤湿度、土壤温度、EC、PH。当前文件夹没有樱桃 Excel 数据，所以樱桃页面会显示“暂无本地数据”。

## 切换到真实 API

当前默认使用模拟数据。要尝试接入有人云，在项目根目录复制 `.env.example` 为 `.env.local`，然后填入有人云二次开发密钥：

```env
VITE_DATA_SOURCE=remote
VITE_USE_REMOTE_DATA=true
VITE_DASHBOARD_ENDPOINT=/api/greenhouse/dashboard
API_PORT=8787
YOUREN_APP_KEY=your_app_key
YOUREN_APP_SECRET=your_app_secret
```

前端会调用：

```http
GET /api/greenhouse/dashboard
```

本地联调时使用：

```bash
npm run dev:full
```

这个命令会同时启动：

- Vite 前端：`http://127.0.0.1:5173/`
- 有人云代理：`http://127.0.0.1:8787/`

如果只想测试有人云凭据和设备读取：

```bash
npm run youren:test
```

如果只想启动后端代理：

```bash
npm run dev:api
```

健康检查接口：

```http
GET /api/youren/health
```

远程适配器会把有人云原始设备、变量和历史值转换为统一的 `DashboardData`。如果某个 `dataPointId` 没有返回有效值，响应中的指标值应为 `null`；不要用 `0` 代表缺失，否则会影响预警和趋势判断。

建议响应格式：

```json
{
  "generatedAt": "2026-05-25T09:30:00.000Z",
  "source": "youren",
  "crops": [
    {
      "id": "jujube",
      "name": "冰糖枣",
      "latinName": "Crystal Jujube",
      "description": "水肥一体化管理...",
      "heroImage": "https://example.com/image.jpg",
      "accent": "#16a34a",
      "greenhouses": []
    }
  ]
}
```

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

服务端环境变量：

```env
AI_API_KEY=your_ai_api_key
AI_MODEL=gpt-4o-mini
AI_API_BASE=
```

前端会在选择非法格式或超大图片时清空旧图片实例，避免误提交上一张图片。AI 返回结果会被服务端标准化为 `CropDiagnosisResult` 后再返回给页面。

## 有人云接入设计

不要在前端保存有人云账号、密码、`appKey` 或 `appSecret`。真实接入应放在云服务器后端：

1. 在有人云平台的二次开发功能中获取 `appKey` 和 `appSecret`。
2. 在服务器环境变量中配置：

```env
YOUREN_APP_KEY=your_app_key
YOUREN_APP_SECRET=your_app_secret
```

3. 后端调用有人云鉴权接口获取 `X-Access-Token`，并缓存 Token。
4. 后端继续调用有人云设备列表、变量列表、实时数据、历史数据接口。
5. 后端把有人云原始数据组装成前端需要的 `DashboardData`。
6. 前端只请求自己的 `/api/greenhouse/dashboard`。

有人云文档中提到：

- 二次开发 API 需要通过 `appKey` 和 `appSecret` 获取 `X-Access-Token`。
- `X-Access-Token` 有效期约 2 小时。
- 网关列表接口地址以有人云官方文档和服务器环境变量配置为准，请求头需要携带 `X-Access-Token`。

## 后端接口建议

首个后端接口只需要实现：

```http
GET /api/greenhouse/dashboard
```

服务端职责：

- 读取有人云密钥环境变量。
- 获取并缓存 `X-Access-Token`。
- 查询设备、变量、实时值和历史数据。
- 根据本项目的作物和大棚映射关系组装响应。

建议后续新增一个服务器侧配置文件或数据库表，用来维护：

- 作物 ID 和名称。
- 作物下包含哪些大棚。
- 每个大棚对应哪些有人云设备或网关。
- 有人云变量名和本项目指标键的映射关系。
- 每个指标的目标范围和预警阈值。

## 大棚和变量映射

真实数据接入推荐创建：

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

如果暂时没有映射文件，后端会尝试自动读取有人云网关列表，并按设备顺序分配到三种作物下；这只能用于初次探测，不建议作为正式展示数据。

获取 `deviceNo` 和 `dataPointId` 的方式：

```bash
npm run youren:test
```

脚本会输出网关样本和变量样本，之后把对应值填入 `config/greenhouse.mapping.json`。

## 开发说明

- `src/App.tsx` 保留页面编排和大棚地图逻辑；天气、诊断、问答、趋势图等较重模块已拆到 `src/components/` 并使用 `React.lazy` 懒加载。
- 样式使用 CSS 变量实现主题，浅色和深色主题都在 `src/index.css` 中。
- 作物主视觉当前使用 Wikimedia Commons 上对应作物图片：枣树果实、蓝莓灌木、樱桃树果实。后续建议替换为你自己的基地实拍照片。
- 模拟数据在 `src/data/mockDashboard.ts`，可直接修改大棚数量、指标值、告警内容。
- 模拟模式图片在 `src/data/mockDashboard.ts` 修改；真实接口默认图片在 `server/dashboard-adapter.mjs` 修改，也可以由后端 `DashboardData.crops[].heroImage` 直接返回。
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

## Django Local Integration

On this migration branch, Django can serve the built React frontend, admin, and API from one port.

Build the frontend:

```powershell
npm run build
```

Start Django:

```powershell
$env:WEATHER_INTEGRATION_ENABLED = "true"
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

Open the integrated site:

```text
http://127.0.0.1:8000/
```

Open Django Admin:

```text
http://127.0.0.1:8000/admin/
```

The admin UI uses `django-simpleui` and defaults to Simplified Chinese through `LANGUAGE_CODE=zh-hans`.

The admin "View site" and simple-ui home button point to the integrated frontend by default. Override them when using a separate frontend dev server:

```powershell
$env:DJANGO_ADMIN_SITE_URL = "http://127.0.0.1:5173/"
$env:DJANGO_FRONTEND_SITE_URL = "http://127.0.0.1:5173/"
```

Create a local admin user when needed:

```powershell
.venv\Scripts\python.exe backend\manage.py createsuperuser
```

Optional Vite hot-reload frontend:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

When using Vite directly, open:

```text
http://127.0.0.1:5173/
```

By default `EXTERNAL_INTEGRATIONS_ENABLED=false`. Set `WEATHER_INTEGRATION_ENABLED=true` to enable Open-Meteo weather forecasts. AI operation advice, crop diagnosis, and agricultural chat remain disabled until their AI adapters and credentials are configured.

Run the full local verification suite:

```powershell
npm run verify
```

Stage 5 references:

- `docs/stage5_acceptance_report.md`
- `docs/mysql_switch_runbook.md`

