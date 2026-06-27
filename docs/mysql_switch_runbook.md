# MySQL Switch Runbook

## Scope

This runbook prepares a non-production MySQL 8.0+ validation path for the Django API migration. It must not be run against production data.

## Safety Rules

- Keep `EXTERNAL_INTEGRATIONS_ENABLED=false` during database validation.
- Do not place secrets in Git-tracked files.
- Do not reuse production MySQL users, databases, or credentials.
- Use a disposable empty database for first-pass migration validation.

## Required Environment

Install the MySQL driver:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements\mysql.txt
```

Set environment variables in the shell or CI secret store:

```powershell
$env:DB_ENGINE = "mysql"
$env:MYSQL_DB_NAME = "smart_agriculture_verify"
$env:MYSQL_DB_USER = "smart_agriculture_verify"
$env:MYSQL_DB_PASSWORD = "<secret>"
$env:MYSQL_DB_HOST = "127.0.0.1"
$env:MYSQL_DB_PORT = "3306"
$env:MYSQL_TEST_DB_NAME = "smart_agriculture_verify_test"
$env:DJANGO_SECRET_KEY = "<non-production-secret>"
$env:EXTERNAL_INTEGRATIONS_ENABLED = "false"
```

Optional SSL variables:

```powershell
$env:MYSQL_SSL_CA = "C:\path\to\ca.pem"
$env:MYSQL_SSL_CERT = "C:\path\to\client-cert.pem"
$env:MYSQL_SSL_KEY = "C:\path\to\client-key.pem"
```

## Validation Commands

Run the full backend validation against the configured database:

```powershell
.venv\Scripts\python.exe scripts\verify.py --backend-only --database configured
```

Run the full suite, including frontend lint and build:

```powershell
.venv\Scripts\python.exe scripts\verify.py --database configured
```

## Expected Result

- Django system check passes.
- `makemigrations --check --dry-run` reports no model drift.
- Migrations apply on an empty MySQL database.
- `seed_dev` is repeatable.
- Backend tests pass with P1 integrations disabled.
- OpenAPI schema validation passes.
- Frontend lint and production build pass when the full suite is used.

## Rollback

For local development, return to SQLite by removing the MySQL variables or setting:

```powershell
$env:DB_ENGINE = "sqlite"
$env:DJANGO_DB_PATH = ".runtime/local/db.sqlite3"
```

Then run:

```powershell
.venv\Scripts\python.exe backend\manage.py migrate --noinput
.venv\Scripts\python.exe backend\manage.py seed_dev
```

## Current Status

SQLite verification is automated and passing. A live MySQL 8.0+ database has not been provided in this workspace yet, so MySQL validation remains a pending acceptance item.
