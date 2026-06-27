# Stage 5 Acceptance Report

## Scope

Stage 5 covers verification automation, CI readiness, browser visual QA, MySQL switch preparation, and final migration risk tracking.

## Added Assets

- `scripts/verify.py`: one-command verification entry for local and CI use.
- `.github/workflows/verify.yml`: GitHub Actions workflow using the same verify script.
- `npm run verify`: frontend-facing shortcut for the full verification suite.
- `docs/mysql_switch_runbook.md`: non-production MySQL switch and validation guide.

## Local Verification

Command:

```powershell
.venv\Scripts\python.exe scripts\verify.py
```

Result:

```text
Verification passed.
```

Covered checks:

- Django `check`
- `makemigrations --check --dry-run`
- isolated SQLite migrate
- repeated `seed_dev`
- 13 backend tests
- OpenAPI schema validation
- frontend ESLint
- frontend production build

## Browser QA

Runtime:

- Django: `http://127.0.0.1:8000`
- Vite: `http://127.0.0.1:5173`

Observed page:

- URL: `http://127.0.0.1:5173/`
- Title: `智慧农业管理中枢`
- Header source label: `Django API / 本地 Excel 数据`

Observed network:

```text
GET  http://127.0.0.1:5173/api/greenhouse/dashboard          200 OK
GET  http://127.0.0.1:5173/data/dalian.geojson               200 OK
POST http://127.0.0.1:5173/api/weather/greenhouse-advice     503 Service Unavailable
```

The 503 response is expected while external integrations remain disabled.

Screenshot:

```text
output/playwright/stage5-dashboard.png
```

## CI Readiness

The GitHub Actions workflow installs Python and Node dependencies, then runs:

```bash
python scripts/verify.py
```

CI intentionally uses SQLite because no MySQL service or secrets are configured in the repository.

## Remaining Risks

- Live MySQL 8.0+ validation is pending until a disposable non-production database is available.
- Dedicated secret-history scanning with tools such as gitleaks or trufflehog is still recommended before public release or broader sharing.
- P1 endpoints are safe-disabled adapters only; they do not yet implement real weather or AI business behavior.
- The old Node gateway remains in the repo for fallback/reference until Django acceptance is signed off.
