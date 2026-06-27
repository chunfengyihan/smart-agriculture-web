# Django Migration Plan

## 当前边界

本计划记录阶段 0 至阶段 4 当前迁移状态。阶段 5 前不执行真实 AI、有人云写接口或生产环境调用。

## 阶段 0：GitHub 基线确认与敏感信息审查

状态：已完成当前轮。

已完成：

- 确认 Git 远程、分支和提交。
- 修复已跟踪代码中的默认真实外部服务目标。
- 补齐 `.gitignore`。
- 确认 `.env.local` 未被 Git 跟踪。
- 创建迁移分支和起点标签。

补充建议：

- 安装并运行 `gitleaks` 或 `trufflehog`，对 Git 当前树和历史做完整密钥扫描。
- 如扫描发现真实凭据历史泄漏，只输出路径、风险类型、是否跟踪、是否可能历史泄漏、建议轮换类别和处置动作，不输出敏感值。

## 阶段 1：项目审计与接口契约

状态：已完成当前轮文档输出。

已完成：

- 前端架构与 API 调用审计。
- 旧 Node 网关与第三方依赖审计。
- 静态数据、部署、测试与数据库资产审计。
- 接口清单。
- OpenAPI v1 草案。
- P0 数据模型建议。

阶段 1 验收标准：

- `docs/project_audit.md` 覆盖静态项目审计结果。
- `docs/api_inventory.md` 覆盖所有已知接口并标注优先级和确认状态。
- `docs/api_contract_v1.yaml` 至少覆盖指定 legacy/v1 路径。
- `docs/migration_plan.md` 明确后续阶段顺序和禁止项。

## 阶段 2：Django 基础工程

状态：已完成基础工程骨架。

进入条件：

- 阶段 1 文档确认通过。
- Python 版本和依赖版本范围确认。
- 外部集成默认关闭策略确认。

计划内容：

- 创建 `backend/` 工程。
- 使用 Django REST Framework。
- 使用 drf-spectacular 生成 OpenAPI。
- 使用 django-cors-headers 处理开发 CORS。
- 当前开发数据库使用 SQLite。
- 通过环境变量准备 MySQL 切换。
- 增加统一响应、统一异常、request_id、结构化日志、分页、健康检查。

已完成：

- 创建 `backend/` 基础工程。
- 添加 `GET /api/v1/health/`、`GET /api/v1/schema/`、`GET /api/v1/docs/`。
- 添加分层 settings：`base`、`development`、`test`、`production`。
- 添加环境变量驱动的 SQLite/MySQL 配置。
- 添加 request_id 中间件、统一响应、统一异常、分页类。
- 添加基础健康检查测试。
- 完成 Django `check`、单元测试、OpenAPI schema 校验、`makemigrations --check --dry-run` 和 SQLite 空库 `migrate` 验证。

禁止事项：

- 不调用真实 AI 服务。
- 不调用有人云写接口。
- 不连接生产数据库。
- 不提交 SQLite 数据库、`.runtime/`、密钥或构建产物。

## 阶段 3：P0 温室看板接口迁移

状态：已完成 P0 Django 迁移。

进入条件：

- Django 基础工程通过 `check`。
- P0 契约和字段兼容清单确认。

计划内容：

- 只迁移 `GET /api/greenhouse/dashboard` 和 `GET /api/v1/greenhouse/dashboard`。
- legacy 路径保持旧前端可消费响应。
- v1 路径使用统一响应包装。
- 使用 `public/data/local-dashboard.json` 作为初始种子来源。
- 创建模型、迁移、种子命令、序列化器、视图、URL 和测试。

已完成：

- 创建 `apps.greenhouse`。
- 创建 `Greenhouse`、`EnvironmentReading`、`DashboardSnapshot`。
- 创建 `0001_initial` migration。
- 创建 `seed_dev` 命令。
- 创建 legacy `/api/greenhouse/dashboard` 和 v1 `/api/v1/greenhouse/dashboard`。
- 创建 P0 单元测试和兼容性证据文档。

P0 数据模型建议：

- `Greenhouse`
  - `id`
  - `code`
  - `name`
  - `location`
  - `created_at`
  - `updated_at`
- `EnvironmentReading`
  - `id`
  - `greenhouse`
  - `recorded_at`
  - `air_temp`
  - `air_humidity`
  - 可选环境指标字段
  - `source`
  - `created_at`
  - `updated_at`
- `DashboardSnapshot`
  - `id`
  - `greenhouse`
  - `snapshot_at`
  - `payload`
  - `schema_version`
  - `source`
  - `created_at`
  - `updated_at`

MySQL 预备约束：

- 时间字段使用时区感知时间。
- 温湿度等精度字段优先使用 DecimalField。
- 常用过滤和排序字段建立索引。
- JSONField 仅保存展示层快照或未知扩展字段。
- 不依赖 SQLite 宽松类型转换或 SQLite 专属 SQL。

## 阶段 4：前端联调与 P1 接口迁移

状态：已完成 Django 开发代理切换和 P1 safe-disabled endpoints。

进入条件：

- P0 Django 接口迁移通过兼容性测试。

计划内容：

- 先完成 P0 看板页面联调。
- 再迁移天气建议接口。
- 再迁移图片诊断接口。
- 再迁移农业问答接口。
- 最后迁移健康检查与辅助接口。

已完成：

- Vite `/api` 代理切换到 Django `127.0.0.1:8000`。
- 新增 Django P1 routes:
  - `POST /api/weather/greenhouse-advice`
  - `POST /api/v1/weather/greenhouse-advice`
  - `POST /api/ai/crop-diagnosis`
  - `POST /api/v1/ai/crop-diagnosis`
  - `POST /api/ai/agri-chat`
  - `POST /api/v1/ai/agri-chat`
- 默认 `EXTERNAL_INTEGRATIONS_ENABLED=false` 时返回 503，不执行真实外部调用。
- P0 dashboard 已通过 Vite proxy 联调。
- P1 disabled error responses 已通过 Vite proxy 联调。

外部集成规则：

- `EXTERNAL_INTEGRATIONS_ENABLED=false` 时禁止真实外部调用。
- 未配置真实服务时返回 HTTP 503 和应用错误码 `50020`。
- 测试适配器不得生成真实诊断结论或真实农业操作建议。

## 阶段 5：测试、CI、MySQL 切换准备与总体验收

进入条件：

- P0/P1 迁移和前端联调通过。

计划内容：

- 创建 `python scripts/verify.py`。
- 增加 CI 验证工作流。
- 验证 SQLite 空库迁移和种子数据重复执行。
- 在独立、空白、非生产 MySQL 8.0+ 数据库上验证迁移、种子、测试和 OpenAPI。
- 生成最终验收报告、MySQL 切换手册和 schema diff。

最终提交计划：

- 阶段 5 全部验收通过后，再创建最终迁移提交和 `django-api-v1-*` 标签。
