# API Inventory

确认状态只使用 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`UNKNOWN`。

## OpenAPI Contract Baseline

- 契约基准文件：`docs/api_contract_v1.yaml`
- 在线 schema：`GET /api/v1/schema/`
- Swagger UI：`GET /api/v1/docs/`
- ReDoc UI：`GET /api/v1/redoc/`
- 生成命令：`.venv\Scripts\python.exe backend\manage.py spectacular --file docs\api_contract_v1.yaml --validate`
- CI 校验命令：`.venv\Scripts\python.exe backend\manage.py spectacular --file .runtime\openapi-ci.yaml --validate`
- 前端类型生成建议：
  - 使用 `openapi-typescript docs/api_contract_v1.yaml -o src/api/generated/schema.d.ts` 生成 TypeScript schema 类型。
  - 使用 `openapi-fetch` 或 `orval` 基于同一 schema 生成 typed client。
  - 小程序侧不直接引入生成器时，应以 `docs/api_contract_v1.yaml` 为字段契约，手写 wrapper 必须保持 `code/message/data/request_id` v1 包装结构。

所有 `/api/v1/*` 接口状态以 OpenAPI schema 为准；本文档只保留迁移盘点、调用方和兼容性说明。

## P0 - Greenhouse Dashboard

- 接口路径：`/api/v1/greenhouse/dashboard`
- 请求方法：`GET`
- 调用页面：监测详情、作物总览、地图和指标区域
- 调用文件：`src/api/dashboard.ts`、`src/data/dataProvider.ts`、`src/App.tsx`、`smart-agri-miniapp/services/dashboard.js`
- 请求字段：无
- 响应字段：`generatedAt`、`source`、`crops[]`；作物字段含 `id`、`name`、`latinName`、`description`、`heroImage`、`accent`、`greenhouses[]`；大棚字段含 `id`、`name`、`area`、`status`、`onlineDevices`、`totalDevices`、`metrics[]`、`trend[]`、`alerts[]`
- 当前数据来源：Django 规范化模型聚合；本地模式由 `seed_dev` 从 `public/data/local-dashboard.json` 导入 `Greenhouse`、`Device`、`EnvironmentReading`、`Alert`，`DashboardSnapshot` 仅作缓存/降级。
- Django 迁移状态：已迁移。Web 与小程序默认使用 v1 统一响应包装；Django 可在 `YOUREN_INTEGRATION_ENABLED=true` 时独立拉取有人云并映射；legacy `/api/greenhouse/dashboard` 仅作兼容 adapter 保留。
- 是否依赖第三方服务：是，有人云；本地 JSON 模式否
- 迁移优先级：P0
- 兼容性要求：legacy 路径保持旧响应直出；字段名、类型、嵌套层级、单位、时间格式、数组顺序和空值行为保持兼容
- 风险：有人云字段稳定性 UNKNOWN；静态 JSON 是展示快照，不是完整时序事实表
- 确认状态：CONFIRMED

### D-07 Frontend Query Notes

- Web dashboard caller now goes through `src/hooks/useDashboardQuery.ts`.
- The full dashboard, readings, alerts, and future alert stream are represented separately in `src/api/dashboard.ts` through `DASHBOARD_RESOURCE_PATHS`.
- Dashboard fetch supports `AbortSignal`; local JSON mode only adds cache-busting on retry/manual retry, so normal first load can reuse browser caching.
- Client cache keeps a 20s stale window, polls every 30s only while the page is visible, reuses an in-flight promise, and exposes a visible failed-refresh state.
- `DashboardRequestMetadata` reserves `etag`, `lastModified`, and `version` fields for later conditional request handling.
- `DASHBOARD_RESOURCE_PATHS.alertStream` reserves the interface layer for later SSE/WebSocket alert push.

## P0 - Environment Readings

- 接口路径：`/api/v1/greenhouse/readings`
- 请求方法：`GET`
- 调用页面：后续历史曲线、运维排查、设备明细页面
- 调用文件：`backend/apps/greenhouse/views.py`
- 请求字段：`greenhouse?`、`start?`、`end?`、`metric_type?`、`page?`、`page_size?`
- 响应字段：v1 wrapper；`data.count`、`data.next`、`data.previous`、`data.results[]`；读数字段含 `greenhouse`、`recorded_at`、`metric_type`、`air_temp`、`air_humidity`、`light`、`co2`、`soil_humidity`、`soil_temp`、`ec`、`ph`、`source`
- 当前数据来源：`EnvironmentReading`
- Django 迁移状态：已实现，支持按温室、时间范围和 `metric_type` 过滤。
- 是否依赖第三方服务：否
- 迁移优先级：P0
- 兼容性要求：分页响应必须保留 `count/next/previous/results`，时间字段使用 ISO 8601。
- 确认状态：CONFIRMED

## P0 - Greenhouse Resource APIs

- 接口路径：`/api/v1/greenhouses/`
- 请求方法：`GET`
- 调用页面：温室列表、地图筛选、后续设备/告警/历史详情入口
- 调用文件：`backend/apps/greenhouse/views.py`
- 请求字段：`crop_code?`、`source?`、`q?`、`ordering?`、`page?`、`page_size?`
- 响应字段：v1 wrapper；`data.count`、`data.next`、`data.previous`、`data.results[]`；温室字段含 `id`、`code`、`name`、`location`、`crop_code`、`source`、`created_at`、`updated_at`
- 当前数据来源：`Greenhouse`
- Django 迁移状态：已实现，支持分页、作物/来源过滤、搜索和白名单排序。
- 是否依赖第三方服务：否
- 迁移优先级：P0
- 兼容性要求：新增资源型接口，不替代旧 dashboard 聚合接口。
- 确认状态：CONFIRMED

## P0 - Greenhouse Detail Readings

- 接口路径：`/api/v1/greenhouses/{id}/readings/`
- 请求方法：`GET`
- 调用页面：温室历史曲线、趋势图按需加载
- 调用文件：`backend/apps/greenhouse/views.py`
- 请求字段：`start_time?`、`end_time?`、`metrics?`、`metric_type?`、`ordering?`、`page?`、`page_size?`
- 响应字段：v1 wrapper；分页结构同上；读数字段按 `metrics` 可裁剪。
- 当前数据来源：`EnvironmentReading`
- Django 迁移状态：已实现，支持时间范围、指标列表、读数类型、排序和分页；超大时间范围会被拒绝。
- 是否依赖第三方服务：否
- 迁移优先级：P0
- 兼容性要求：曲线数据通过此接口按范围请求，dashboard 摘要不再承载完整历史曲线。
- 确认状态：CONFIRMED

## P0 - Greenhouse Detail Alerts

- 接口路径：`/api/v1/greenhouses/{id}/alerts/`
- 请求方法：`GET`
- 调用页面：告警列表、温室详情告警面板
- 调用文件：`backend/apps/greenhouse/views.py`
- 请求字段：`status?`、`level?`、`start_time?`、`end_time?`、`ordering?`、`page?`、`page_size?`
- 响应字段：v1 wrapper；分页结构同上；告警字段含 `id`、`greenhouse`、`device`、`level`、`metric_type`、`message`、`triggered_at`、`resolved_at`、`source`、`metadata`
- 当前数据来源：`Alert`
- Django 迁移状态：已实现，支持 active/resolved/all、等级、时间范围、排序和分页。
- 是否依赖第三方服务：否
- 迁移优先级：P0
- 兼容性要求：新增资源型接口；旧 dashboard 内嵌 alerts 仍保留首屏兼容。
- 确认状态：CONFIRMED

## P0 - Greenhouse Detail Dashboard Summary

- 接口路径：`/api/v1/greenhouses/{id}/dashboard/`
- 请求方法：`GET`
- 调用页面：温室详情首屏摘要
- 调用文件：`backend/apps/greenhouse/views.py`
- 请求字段：路径参数 `id` 可为温室 numeric id 或 code
- 响应字段：v1 wrapper；`id`、`name`、`crop_code`、`location`、`source`、`status`、`online_devices`、`total_devices`、`latest_reading`、`active_alert_count`、`latest_alerts`
- 当前数据来源：`Greenhouse`、`Device`、`EnvironmentReading`、`Alert`
- Django 迁移状态：已实现，只返回首屏摘要；趋势曲线使用 readings 接口单独请求。
- 是否依赖第三方服务：否
- 迁移优先级：P0
- 兼容性要求：不存在或无访问权限的温室统一返回 404。
- 确认状态：CONFIRMED

## P1 - Weather Greenhouse Advice

- 接口路径：`/api/v1/weather/greenhouse-advice`
- 请求方法：`POST`
- 调用页面：天气与棚内建议面板
- 调用文件：`src/data/weatherAdvice.ts`、`src/components/WeatherAdvicePanel.tsx`、`smart-agri-miniapp/services/weather.js`
- 请求字段：`cropId`、`cropName`、`greenhouseId`、`greenhouseName`、`latitude`、`longitude`、`address?`、`metrics`、`includeAdvice?`
- 响应字段：`cacheKey`、`cachedAt`、`cacheBackend`、`weather`、`advice`、`adviceError`
- 当前数据来源：Open-Meteo 天气接口；天气结果通过 Django cache framework 缓存；AI 建议依赖外部 AI 服务
- Django 迁移状态：已迁移为 safe-disabled endpoint。默认不调用外部服务，返回 HTTP 503。
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造农业建议；应返回清晰 503 错误
- 风险：天气接口和 AI 接口均为外部依赖；生产多进程缓存必须使用 Redis
- 确认状态：CONFIRMED

## P1 - Crop Diagnosis

- 接口路径：`/api/v1/ai/crop-diagnosis`
- 请求方法：`POST`
- 调用页面：AI 图片诊断面板
- 调用文件：`src/data/aiDiagnosis.ts`、`src/components/CropDiagnosisPanel.tsx`、`smart-agri-miniapp/services/diagnosis.js`
- 请求字段：`image`、`cropId`、`cropName`、`greenhouseId`、`greenhouseName?`、`useEnvironmentContext`、`metrics`
- 响应字段：`riskLevel`、`hasPestOrDisease`、`suspectedIssues[]`、`environmentAssessment`、`recommendations[]`、`disclaimer`、`evidence?`、`matchedRules?`、`confidenceReason?`、`followUpQuestions?`
- 当前数据来源：外部 AI 服务
- Django 迁移状态：已迁移为 safe-disabled endpoint。默认不调用外部服务，返回 HTTP 503。
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造诊断结论；图片不得上传到真实外部服务，除非显式启用
- 风险：图片数据外传、模型返回结构漂移、无运行时 schema 校验
- 确认状态：CONFIRMED

## P1 - Agri Chat

- 接口路径：`/api/v1/ai/agri-chat`
- 请求方法：`POST`
- 调用页面：冰糖枣顾问面板
- 调用文件：`src/data/agriChat.ts`、`src/components/JujubeAdvisorPanel.tsx`、`smart-agri-miniapp/services/advisor.js`
- 请求字段：`cropId`、`cropName`、`greenhouseId`、`greenhouseName`、`metrics`、`question`
- 响应字段：`riskLevel`、`summary`、`likelyCauses[]`、`actions[]`、`watchItems[]`、`matchedRules[]`、`disclaimer`
- 当前数据来源：外部 AI 服务
- Django 迁移状态：已迁移为 safe-disabled endpoint。默认不调用外部服务，返回 HTTP 503。
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造农业建议
- 风险：模型输出结构漂移；仅冰糖枣范围已静态约束，新增作物支持 UNKNOWN
- 确认状态：CONFIRMED

## P2 - Youren Health

- 接口路径：`/api/youren/health`
- 请求方法：`GET`
- 调用页面：UNKNOWN，主要为本地联调/运维检查
- 调用文件：`backend/apps/integrations/youren/views.py`、`server/youren-api.mjs`
- 请求字段：无
- 响应字段：`ok`、`configured`、`message?`、`deviceCountInSample?`、`sampleDevices?`
- 当前数据来源：Django 有人云 service 进行凭据检查和样本设备读取；旧 Node 网关仅保留探测/回退
- 是否依赖第三方服务：凭据存在时是
- 迁移优先级：P2
- 兼容性要求：外部集成关闭时不得外呼；运维信息不得泄露敏感字段
- 风险：读取样本设备可能暴露设备元数据；应限制访问权限
- 确认状态：PARTIALLY_CONFIRMED

## Static - Local Dashboard

- 接口路径：`/data/local-dashboard.json`
- 请求方法：`GET`
- 调用页面：本地数据模式下的看板页面
- 调用文件：`src/data/dataProvider.ts`
- 请求字段：可选 cache-busting `t`
- 响应字段：同 `DashboardData`
- 当前数据来源：`public/data/local-dashboard.json`
- 是否依赖第三方服务：否
- 迁移优先级：P3
- 兼容性要求：可作为种子数据来源，但不应作为长期数据库替代
- 风险：展示快照无法代表完整时序事实表
- 确认状态：CONFIRMED

## Static - Dalian GeoJSON

- 接口路径：`/data/dalian.geojson`
- 请求方法：`GET`
- 调用页面：地图区域
- 调用文件：`src/App.tsx`
- 请求字段：无
- 响应字段：GeoJSON `FeatureCollection`
- 当前数据来源：`public/data/dalian.geojson`
- 是否依赖第三方服务：否
- 迁移优先级：P3
- 兼容性要求：地图静态资源可继续由前端静态文件提供
- 风险：不是传感器业务数据
- 确认状态：CONFIRMED

## Implemented Platform Endpoints

- `/api/v1/health/`：已实现，公开健康检查。
- `/api/v1/schema/`：已实现，OpenAPI schema。
- `/api/v1/docs/`：已实现，Swagger UI。
- `/api/v1/redoc/`：已实现，ReDoc UI。
- `/api/v1/metrics/`：已实现，受 `PROMETHEUS_METRICS_ENABLED` 控制，默认关闭。
- `/api/v1/auth/wechat-login`：已实现。
- `/api/v1/auth/refresh`：已实现。
- `/api/v1/auth/logout`：已实现。
- `/api/v1/auth/me`：已实现。
- `/api/v1/integrations/youren/health`：已实现。

## P1 - DTU Ingest

- Endpoint: `POST /api/v1/ingest/dtu-readings`
- Caller: `server/dtu-tcp-server.mjs` or a trusted device gateway.
- Request fields: `device_id`, `device_token?`, `protocol`, `recorded_at?`, `metrics`, `remote_ip?`, `raw_frame_hash?`, `frame_length?`, `redacted_snippet?`.
- Response fields: v1 wrapper with `data.reading_id`, `data.device_id`, `data.greenhouse_id`, `data.recorded_at`, and `data.created`.
- Data source: normalized DTU TCP frames.
- Django migration status: implemented; writes `EnvironmentReading(source=dtu)` and records `DtuIngestAuditEvent`.
- External dependency: none by default; high-concurrency deployments can replace direct forwarding with Redis Queue, Celery, RabbitMQ, or Kafka.
- Compatibility: additive service endpoint; existing web and miniapp dashboard read APIs are unchanged.
- Security: unregistered, disabled, token-mismatched, IP-denied, protocol-mismatched, and invalid-metric frames are rejected before write. Normal logs store only hashes and redacted snippets.
- Confirmation status: CONFIRMED

## Deferred API Surface

- 作物 CRUD：UNKNOWN，当前没有独立作物模型和管理接口。
- 温室写入型 CRUD：UNKNOWN，当前只实现读取型资源接口；写入仍通过后台、种子数据或集成同步流程处理。
