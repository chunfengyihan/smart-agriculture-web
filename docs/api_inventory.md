# API Inventory

确认状态只使用 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`UNKNOWN`。

## P0 - Greenhouse Dashboard

- 接口路径：`/api/greenhouse/dashboard`
- 请求方法：`GET`
- 调用页面：监测详情、作物总览、地图和指标区域
- 调用文件：`src/data/dataProvider.ts`、`src/App.tsx`
- 请求字段：无
- 响应字段：`generatedAt`、`source`、`crops[]`；作物字段含 `id`、`name`、`latinName`、`description`、`heroImage`、`accent`、`greenhouses[]`；大棚字段含 `id`、`name`、`area`、`status`、`onlineDevices`、`totalDevices`、`metrics[]`、`trend[]`、`alerts[]`
- 当前数据来源：旧 Node 网关从有人云查询后聚合；本地模式使用 `public/data/local-dashboard.json`
- Django 迁移状态：已迁移。legacy 路径从 `DashboardSnapshot.payload` 直出；v1 路径使用统一响应包装。
- 是否依赖第三方服务：是，有人云；本地 JSON 模式否
- 迁移优先级：P0
- 兼容性要求：legacy 路径保持旧响应直出；字段名、类型、嵌套层级、单位、时间格式、数组顺序和空值行为保持兼容
- 风险：有人云字段稳定性 UNKNOWN；静态 JSON 是展示快照，不是完整时序事实表
- 确认状态：CONFIRMED

## P1 - Weather Greenhouse Advice

- 接口路径：`/api/weather/greenhouse-advice`
- 请求方法：`POST`
- 调用页面：天气与棚内建议面板
- 调用文件：`src/data/weatherAdvice.ts`、`src/components/WeatherAdvicePanel.tsx`
- 请求字段：`cropId`、`cropName`、`greenhouseId`、`greenhouseName`、`latitude`、`longitude`、`address?`、`metrics`、`includeAdvice?`
- 响应字段：`cacheKey`、`cachedAt`、`weather`、`advice`、`adviceError`
- 当前数据来源：Open-Meteo 天气接口；AI 建议依赖外部 AI 服务
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造农业建议；应返回清晰 503 错误
- 风险：天气接口和 AI 接口均为外部依赖；缓存与超时策略需迁移复核
- 确认状态：CONFIRMED

## P1 - Crop Diagnosis

- 接口路径：`/api/ai/crop-diagnosis`
- 请求方法：`POST`
- 调用页面：AI 图片诊断面板
- 调用文件：`src/data/aiDiagnosis.ts`、`src/components/CropDiagnosisPanel.tsx`
- 请求字段：`image`、`cropId`、`cropName`、`greenhouseId`、`greenhouseName?`、`useEnvironmentContext`、`metrics`
- 响应字段：`riskLevel`、`hasPestOrDisease`、`suspectedIssues[]`、`environmentAssessment`、`recommendations[]`、`disclaimer`、`evidence?`、`matchedRules?`、`confidenceReason?`、`followUpQuestions?`
- 当前数据来源：外部 AI 服务
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造诊断结论；图片不得上传到真实外部服务，除非显式启用
- 风险：图片数据外传、模型返回结构漂移、无运行时 schema 校验
- 确认状态：CONFIRMED

## P1 - Agri Chat

- 接口路径：`/api/ai/agri-chat`
- 请求方法：`POST`
- 调用页面：冰糖枣顾问面板
- 调用文件：`src/data/agriChat.ts`、`src/components/JujubeAdvisorPanel.tsx`
- 请求字段：`cropId`、`cropName`、`greenhouseId`、`greenhouseName`、`metrics`、`question`
- 响应字段：`riskLevel`、`summary`、`likelyCauses[]`、`actions[]`、`watchItems[]`、`matchedRules[]`、`disclaimer`
- 当前数据来源：外部 AI 服务
- 是否依赖第三方服务：是
- 迁移优先级：P1
- 兼容性要求：外部集成关闭时不得生成伪造农业建议
- 风险：模型输出结构漂移；仅冰糖枣范围已静态约束，新增作物支持 UNKNOWN
- 确认状态：CONFIRMED

## P2 - Youren Health

- 接口路径：`/api/youren/health`
- 请求方法：`GET`
- 调用页面：UNKNOWN，主要为本地联调/运维检查
- 调用文件：`server/youren-api.mjs`
- 请求字段：无
- 响应字段：`ok`、`configured`、`message?`、`deviceCountInSample?`、`sampleDevices?`
- 当前数据来源：有人云凭据检查和样本设备读取
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

## UNKNOWN 接口

- 生产鉴权接口：UNKNOWN
- 用户/管理员身份接口：UNKNOWN
- 历史曲线分页接口：UNKNOWN
- 告警列表分页接口：UNKNOWN
- 作物/大棚 CRUD 接口：UNKNOWN
- `/api/v1/*` 当前均未实现
