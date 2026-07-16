# 智慧农业网站下次更新提示词

将下面整段内容粘贴到新的 Codex 对话中，并在最后补充本次具体修改内容。

---

继续处理我的智慧农业网站阿里云 ECS 更新部署。请先阅读本地工作区并核对当前状态，不要直接覆盖服务器配置。

## 本地项目

- Windows 工作区：`C:\Users\zhaoxihan\Desktop\Smart Agriculture Website`
- 项目包含 React/Vite 前端和 Django 后端。
- 当前工作区可能有尚未提交的修改；发布包必须包含当前实际工作区内容，不能只使用 `git archive HEAD`。
- 发布前运行项目自带的完整验证：`python scripts\verify.py`。
- 如果验证失败，先修复并重新运行，不能带着失败测试部署。

## 云服务器

- 阿里云 ECS：Ubuntu 22.04
- 公网 IP：`114.215.164.142`
- 应用目录：`/opt/smart-agri`
- 公网地址：`http://114.215.164.142`
- 我会在自己的 PowerShell 和阿里云终端执行命令，请一次只给一组命令，等我贴回输出后再继续。

## 当前生产架构

- MySQL 8.0 运行在 ECS 宿主机，由 systemd 管理。
- 数据库名：`smart_agriculture`。
- MySQL 只监听 `127.0.0.1`，不得暴露公网。
- Docker Compose 只运行 Django、Redis、Nginx，不得重新加入 MySQL 容器。
- Django 通过 `/var/run/mysqld` 连接宿主机 MySQL。
- 服务器配置文件：`/opt/smart-agri/.env.host`。
- `.env.host` 包含密钥和数据库密码，不得输出、上传、写入发布包或粘贴到对话。
- 服务器当前 `docker-compose.yml` 是宿主机 MySQL 专用版本；本地 `docker-compose.yml` 仍可能是旧的容器 MySQL 版本，不得上传覆盖。
- 服务器现有 Nginx 配置、证书、Docker volumes、媒体文件和数据库必须保留。

## 当前基线版本

- 当前镜像标签：`smart-agri-django:20260716-113853` 和 `smart-agri-django:latest`，两者是同一镜像。
- 保留的回滚镜像：`smart-agri-django:history-20260713-205937`。
- 上一版源码：`/opt/smart-agri-previous-20260716-113853`。
- 部署前数据库备份：`/root/smart-agri-before-20260716-113853.sql`。
- 以上信息可能随时间变化，开始前必须用只读命令重新检查。

## 发布包要求

- 使用新的时间戳生成版本号，例如 `YYYYMMDD-HHMMSS`。
- 发布包包含构建所需的当前源码、前端资源、后端和依赖清单。
- 必须排除 `.env*`、密钥、密码、证书、`docker-compose.yml`、线上 Nginx 配置、日志、数据库、`node_modules`、`.venv`、`dist` 旧产物、旧压缩包和 Docker 数据。
- 生成 SHA-256，并在上传 ECS 后再次校验；校验一致后才能部署。

## 加速构建要求

- 日常更新使用 Docker 缓存，不要使用 `--pull` 或 `--no-cache`。
- 日常构建命令应类似：`docker build -t "$IMAGE" "$STAGE"`。
- 不要在部署前执行 `docker builder prune`，避免删除 npm、APT 和 pip 构建缓存。
- 只有我明确要求刷新基础镜像或执行定期安全维护时，才使用 `--pull`。
- 如果依赖文件未变化，应复用 npm、系统依赖和 Python 依赖层，只重建改变的应用层。

## 部署安全流程

1. 先检查线上网站、MySQL、Compose 服务、磁盘、内存、Swap 和现有版本。
2. 确认服务器 Compose 服务列表中没有 `mysql`。
3. 使用宿主机 `mysqldump` 备份 `smart_agriculture`，验证备份完整并设置权限 `600`。
4. 在全新的 staging 目录解压发布包，不能直接覆盖 `/opt/smart-agri`。
5. 构建带版本号的新 Django 镜像；构建失败时当前网站必须继续运行。
6. 从当前生产目录继承 `.env.host`、服务器 `docker-compose.yml` 和 Nginx 配置，不能使用发布包中的替代品。
7. 构建成功后再原子切换应用目录，并只重建 Django 容器；Redis、Nginx 和数据卷尽量不动。
8. 长时间构建使用 `nohup` 后台脚本和日志文件，SSH 断开不能中止部署。
9. 部署失败时自动恢复上一版源码和上一版镜像，不要自动恢复数据库；先保留数据库备份并分析迁移影响。

## 部署后验证

- 检查 Docker Compose 容器状态和 Django 日志。
- 从 ECS 内部和本地公网分别验证以下路径：
  - `/`
  - `/monitoring`
  - `/map`
  - `/analytics`
  - `/analytics/wall`
  - `/analytics/wall/trends`
  - `/intelligence`
  - `/api/v1/health/`
  - `/api/v1/greenhouse/dashboard`
- 上述路径应返回 HTTP 200。
- `/private/not-a-real-file.png` 应返回 HTTP 404，防止 SPA fallback 暴露私有上传路径。
- 仪表盘 API 应正常返回数据库中的作物和温室数据。
- 确认公网加载的是本次新构建的 JS/CSS 资源哈希。
- 部署完成后保留当前版本和一个上一版本，不执行 `docker volume prune` 或 `docker system prune -a`。

## 本次更新内容

我本次修改的是：请在这里填写新增页面、修复内容或数据变更。

请从只读检查本地 Git 状态和服务器当前状态开始，然后按步骤带我完成发布、验证和必要的回滚保护。
