# Project Audit

## 任务表

| 任务编号 | 子智能体角色 | 任务目标 | 允许读取范围 | 允许修改范围 | 禁止修改范围 | 依赖任务 | 完成标准 |
|---|---|---|---|---|---|---|---|
| P0-A | Git 基线审计 | 确认 Git 仓库、远程、分支、提交、工作区状态 | Git 元数据 | 无 | 全部项目文件 | 无 | 输出 Git 基线结果 |
| P0-B | 敏感文件与忽略规则审计 | 检查 `.env.local`、`.env*`、敏感文件与历史文件名 | `.env*`、Git 索引、Git 历史文件名、server/src/public 路径级扫描 | 无 | 敏感值输出 | P0-A | 输出脱敏风险结果 |
| P0-C | `.gitignore` 审计 | 检查环境文件、Python/Django、SQLite、运行时和产物忽略规则 | `.gitignore` | 无 | 直接修改 | P0-A | 输出缺失规则 |
| P1-A | 前端架构与 API 调用审计 | 识别框架、路由、API 调用、请求/响应字段、LocalStorage、图片上传 | `src/`、`public/`、`package.json`、`vite.config.ts` | 无 | 全部项目文件 | P0 | 输出前端审计结果 |
| P1-B | 旧 Node 网关与第三方依赖审计 | 识别旧网关路由、外部 AI、有人云、环境变量、错误处理 | `server/`、`.env.example`、配置和依赖清单 | 无 | 全部项目文件 | P0 | 输出网关审计结果 |
| P1-C | 数据、部署、测试与数据库资产审计 | 识别静态数据、部署方式、测试/CI、数据库资产 | `public/data/`、脚本、部署/CI/测试路径 | 无 | 全部项目文件 | P0 | 输出数据与部署审计结果 |
| P1-D | 接口契约与 P0 模型建议 | 输出接口优先级、兼容策略、v1 标准路径、P0 模型建议 | 已知接口、前端和网关审计结果 | 无 | 接口实现文件 | P1-A/B/C | 输出契约建议 |

## Git 基线

- 是否位于 Git 仓库：是。
- 远程仓库：`origin https://github.com/chunfengyihan/smart-agriculture-web.git`。
- 起始分支：`main`。
- 当前迁移分支：`feat/django-api-first-20260627-160415-ed1933`。
- 起点标签：`pre-django-api-20260627-160415-ed1933`。
- 当前提交：`d09debd2c38826b8d08979889bcb1e33f5184fa5`。
- 工作区状态：阶段 0/1 文档生成前，安全修复已提交；文档为当前新增文件。

## 敏感信息与忽略规则审计

- `.env.local` 被 `.gitignore` 的 `.env.*` 规则忽略。
- `git ls-files .env.local` 无输出，说明未被当前 Git 索引跟踪。
- 文件名级历史检查只发现 `.env.example` 和 `server/env.mjs`。
- 已跟踪代码中的默认有人云和 AI API 基地址已移除。
- 常见密钥扫描工具 `gitleaks`、`trufflehog`、`detect-secrets` 当前不可用，历史内容扫描覆盖有限。

## 前端架构审计

- 前端框架：React 19 + TypeScript + Vite。
- 包管理器：npm，存在 `package-lock.json`。
- 启动命令：
  - `npm run dev`
  - `npm run dev:api`
  - `npm run dev:full`
- 构建命令：`npm run build`。
- 当前无 React Router；页面以单页应用和锚点导航组织。
- 页面/视图区：
  - `#overview` 总览。
  - `#map` 大连棚区地图。
  - `#detail` 监测详情、指标、天气、趋势、预警。
  - `#diagnosis` AI 图片诊断。
- LocalStorage：仅发现 `theme = light | dark`。
- 登录或身份识别流程：UNKNOWN，当前未发现前端登录、Token 或权限流程。

## 前端 API 调用

- `GET /data/dalian.geojson`：地图边界数据。
- `GET /data/local-dashboard.json?t=...`：本地看板快照。
- `GET /api/greenhouse/dashboard`：远程看板数据。
- `POST /api/weather/greenhouse-advice`：天气与棚内操作建议。
- `POST /api/ai/crop-diagnosis`：图片诊断。
- `POST /api/ai/agri-chat`：农业问答。

## 旧 Node 网关审计

- 入口：`server/youren-api.mjs`。
- 默认端口：`API_PORT`，当前示例为 `8787`。
- Vite 开发代理：`/api -> http://127.0.0.1:8787`。
- 路由：
  - `GET /api/youren/health`
  - `GET /api/greenhouse/dashboard`
  - `POST /api/weather/greenhouse-advice`
  - `POST /api/ai/crop-diagnosis`
  - `POST /api/ai/agri-chat`
- 外部依赖：
  - 有人云：`YOUREN_APP_KEY`、`YOUREN_APP_SECRET`、`YOUREN_API_BASE`、`YOUREN_AUTH_PATH`。
  - AI：`AI_API_KEY`、`AI_API_BASE`、`AI_MODEL`、`AI_PROVIDER`。
  - 天气：Open-Meteo 当前为公开天气查询依赖，后续需由外部集成开关统一治理。
- 写操作风险：未发现有人云写接口；UNKNOWN 是否外部服务侧保留调用日志。

## 数据与数据库资产审计

- `public/data/local-dashboard.json`：有效 JSON，顶层为 `generatedAt`、`source`、`crops`。
- `public/data/dalian.geojson`：有效 GeoJSON `FeatureCollection`，用于地图轮廓。
- 未发现 SQL 文件、旧 ORM Model、数据库连接、迁移目录或迁移脚本。
- 未发现 Docker、Compose、Nginx 配置。
- 未发现 `.github/workflows/`。
- 未发现前端或后端自动化测试目录。

## 运行时接口发现

本轮未启动项目做运行时接口发现，原因：

- 阶段 0 原始安全阻塞已修复后才允许继续。
- 当前要求只推进阶段 0/1，不调用真实 AI、有人云或生产接口。
- 项目中存在外部服务依赖，后续运行时发现必须在 `EXTERNAL_INTEGRATIONS_ENABLED=false` 和外呼拦截条件下进行。

替代方法：本轮采用静态代码审计、类型定义审计、静态 JSON 解析和 lint 验证。
