# Django Migration Status

## 当前阶段

阶段 0 与阶段 1 已完成当前轮审计和契约草案输出。当前禁止进入阶段 2、阶段 3、阶段 4、阶段 5。

## 迁移分支名

`feat/django-api-first-20260627-160415-ed1933`

## 迁移起点标签

`pre-django-api-20260627-160415-ed1933`

## 当前 Git 提交哈希

`d09debd2c38826b8d08979889bcb1e33f5184fa5`

## 已完成事项

- 完成 Git 基线确认：仓库位于 Git 工作区，远程为 GitHub `origin`，当前工作分支已切换到迁移分支。
- 完成安全修复：移除已跟踪代码和示例文档中的默认真实外部 API 基地址。
- 完成忽略规则补齐：`.env`、`.env.*`、Python/Django 运行文件、SQLite、`.runtime/`、coverage、build 产物均已纳入忽略规则。
- 确认 `.env.local` 被忽略且未被 Git 跟踪。
- 创建安全修复提交：`chore: harden external integration defaults`。
- 创建迁移起点标签。
- 完成阶段 1 静态审计：前端架构、旧 Node 网关、静态数据、部署/测试/数据库资产、接口契约与 P0 数据模型建议。
- 创建接口清单、OpenAPI 草案、项目审计和迁移计划文档。

## 风险项

- 常见密钥扫描工具未安装，Git 历史内容级密钥扫描覆盖有限；当前仅完成文件名级历史检查和路径级关键词审计。
- `.env.local` 中的外部 API 已由项目方确认废弃，但仍应避免提交和展示其内容。
- 当前没有数据库、ORM、迁移、CI 或自动化测试基线。
- 旧 Node 网关仍保留外部集成能力；真实外呼必须依赖显式环境变量配置，且后续需统一由 `EXTERNAL_INTEGRATIONS_ENABLED=false` 默认关闭。
- README 与示例配置已移除默认真实基地址，但历史提交中曾出现外部服务示例地址；如需发布或开源，应使用 gitleaks/trufflehog 做完整历史扫描。

## 阻塞项

- 阶段 2 前需确认阶段 1 契约是否按 `docs/api_contract_v1.yaml` 作为实施依据。
- 阶段 2 前需确认 Python 版本、Django/DRF/drf-spectacular/mysqlclient 兼容版本范围。
- 阶段 3 前需确认 P0 看板 legacy 响应字段与 `public/data/local-dashboard.json` 及旧 Node 响应保持一致。

## 下一步

1. 审阅阶段 1 文档并确认契约。
2. 安装并运行专用密钥扫描工具，补充历史内容级扫描证据。
3. 阶段 1 验收通过后，再进入阶段 2：Django 基础工程。
