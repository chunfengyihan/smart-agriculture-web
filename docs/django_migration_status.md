# Django Migration Status

## 当前阶段

阶段 4：前端联调与 P1 接口迁移。当前禁止进入阶段 5。

## 迁移分支名

`feat/django-api-first-20260627-160415-ed1933`

## 迁移起点标签

`pre-django-api-20260627-160415-ed1933`

## 当前 Git 提交哈希

以 `git rev-parse HEAD` 为准；阶段 4 提交完成后由最终阶段报告记录实际 HEAD。

## 已完成事项

- 完成 Git 基线确认：仓库位于 Git 工作区，远程为 GitHub `origin`，当前工作分支已切换到迁移分支。
- 完成安全修复：移除已跟踪代码和示例文档中的默认真实外部 API 基地址。
- 完成忽略规则补齐：`.env`、`.env.*`、Python/Django 运行文件、SQLite、`.runtime/`、coverage、build 产物均已纳入忽略规则。
- 确认 `.env.local` 被忽略且未被 Git 跟踪。
- 创建安全修复提交：`chore: harden external integration defaults`。
- 创建迁移起点标签。
- 完成阶段 1 静态审计：前端架构、旧 Node 网关、静态数据、部署/测试/数据库资产、接口契约与 P0 数据模型建议。
- 创建接口清单、OpenAPI 草案、项目审计和迁移计划文档。
- 创建 Django 基础工程骨架：`backend/manage.py`、分层 settings、根 URL、ASGI/WSGI。
- 添加 Django REST Framework、drf-spectacular、django-cors-headers 基础依赖文件。
- 添加 SQLite/MySQL 环境变量驱动的数据库配置，其中 MySQL 驱动单独放在 `requirements/mysql.txt`。
- 添加 request_id 中间件、统一成功响应、统一异常响应、分页类、健康检查接口。
- 添加基础测试，覆盖 `/api/v1/health/` 标准响应和 `X-Request-ID` 透传。
- 生成并验证 Django OpenAPI schema。
- 在 SQLite 开发库上执行 Django 内置迁移，确认 `.runtime/local/db.sqlite3` 运行时数据库可生成且被 Git 忽略。
- 创建 P0 greenhouse app，包含 `Greenhouse`、`EnvironmentReading`、`DashboardSnapshot` 模型和初始 migration。
- 创建 `seed_dev` 命令，从 `public/data/local-dashboard.json` 可重复导入开发数据。
- 创建 P0 legacy `/api/greenhouse/dashboard` 和 v1 `/api/v1/greenhouse/dashboard`。
- 创建 P0 兼容性测试和字段比对证据文档。
- 将 Vite `/api` 开发代理切换到 Django `http://127.0.0.1:8000`。
- 创建 P1 Django safe-disabled endpoints：天气建议、图片诊断、农业问答。
- P1 legacy 路径返回 `{message:"外部集成未启用"}` 和 HTTP 503。
- P1 v1 路径返回 `{code:50020,message:"外部集成未启用",data:{},request_id}` 和 HTTP 503。
- 创建前端代理联调证据文档。

## 验证命令

- `node --check server/youren-client.mjs`
- `node --check server/agri-chat.mjs`
- `node --check server/ai-diagnosis.mjs`
- `node --check server/weather-advice.mjs`
- `npm run lint`
- `.venv\Scripts\python.exe backend\manage.py check`
- `.venv\Scripts\python.exe backend\manage.py test apps.core`
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-stage2.yaml`
- `.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run`
- `.venv\Scripts\python.exe backend\manage.py migrate --noinput`
- `.venv\Scripts\python.exe backend\manage.py seed_dev`
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.greenhouse`
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-stage3.yaml`
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.greenhouse apps.weather apps.ai_advisory`
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-stage4.yaml`
- `npm run build`
- `curl.exe -s -i -X POST http://127.0.0.1:5173/api/weather/greenhouse-advice ...`
- `curl.exe -s -i -X POST http://127.0.0.1:5173/api/ai/agri-chat ...`
- `.venv\Scripts\python.exe backend\manage.py test apps.core apps.greenhouse apps.weather apps.ai_advisory`
- `.venv\Scripts\python.exe backend\manage.py spectacular --validate --file .runtime\schema-stage4.yaml`
- `npm run build`
- `curl.exe -s -i -X POST http://127.0.0.1:5173/api/weather/greenhouse-advice ...`
- `curl.exe -s -i -X POST http://127.0.0.1:5173/api/ai/agri-chat ...`

## 验证结果

- Node 语法检查通过。
- 前端 ESLint 通过。
- Django system check 通过。
- `apps.core` 2 个测试通过。
- OpenAPI schema 生成和校验通过。
- `makemigrations --check --dry-run` 显示 `No changes detected`。
- SQLite 开发库迁移通过，仅执行 Django 内置 `auth`、`contenttypes` 迁移。
- `.venv/`、`.runtime/`、`.runtime/schema-stage2.yaml`、`.runtime/local/db.sqlite3` 均被 Git 忽略。
- P0 `seed_dev` 可重复执行。
- P0 legacy dashboard 响应与 `local-dashboard.json` 顶层字段、source、作物数量、关键数组长度匹配。
- P0 v1 dashboard 响应使用统一包装。
- OpenAPI 中 legacy dashboard 为 raw `DashboardPayload`，v1 dashboard 为 `V1DashboardResponse`。
- 后端 13 个测试通过。
- 前端 build 通过。
- Vite 5173 代理到 Django 8000 后，P0 dashboard 返回 200 和 3 个 crops。
- P1 legacy/v1 通过 Vite 代理返回安全 503，未执行真实外部调用。

## 风险项

- 常见密钥扫描工具未安装，Git 历史内容级密钥扫描覆盖有限；当前仅完成文件名级历史检查和路径级关键词审计。
- `.env.local` 中的外部 API 已由项目方确认废弃，但仍应避免提交和展示其内容。
- 当前没有 CI、完整自动化测试基线或真实 MySQL 8.0+ 验证结果。
- 旧 Node 网关仍保留外部集成能力；真实外呼必须依赖显式环境变量配置，且后续需统一由 `EXTERNAL_INTEGRATIONS_ENABLED=false` 默认关闭。
- README 与示例配置已移除默认真实基地址，但历史提交中曾出现外部服务示例地址；如需发布或开源，应使用 gitleaks/trufflehog 做完整历史扫描。

## 阻塞项

- 阶段 5 前需完成 full browser visual QA。
- 阶段 5 前需创建统一 `scripts/verify.py` 和 CI。
- MySQL 8.0+ 非生产数据库尚未验收。

## Stage 5 Update

Status: partially completed.

Completed in this round:

- Added `scripts/verify.py` as the unified local and CI verification entry.
- Added `npm run verify`.
- Added `.github/workflows/verify.yml`.
- Added `docs/mysql_switch_runbook.md`.
- Added `docs/stage5_acceptance_report.md`.
- Ran `.venv\Scripts\python.exe scripts\verify.py` successfully.
- Ran browser QA for `http://127.0.0.1:5173/`; the page shows `Django API / 本地 Excel 数据`.
- Confirmed Vite proxy request `GET /api/greenhouse/dashboard` returns 200 through Django.
- Confirmed P1 safe-disabled request `POST /api/weather/greenhouse-advice` returns expected HTTP 503.

Pending:

- Live MySQL 8.0+ validation requires a disposable non-production MySQL database.
- Dedicated secret-history scanning with gitleaks or trufflehog is still recommended before public release.

## 下一步

1. 安装并运行专用密钥扫描工具，补充历史内容级扫描证据。
2. 进入阶段 5：测试、CI、MySQL 切换准备与总体验收。
3. 创建统一验证入口、CI workflow、MySQL runbook 和最终验收报告。
