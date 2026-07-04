#!/usr/bin/env python
"""Run the local/CI verification suite for the Django migration."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DIR = REPO_DIR / ".runtime" / "verify"
VERIFY_DB_PATH = RUNTIME_DIR / "db.sqlite3"
SCHEMA_PATH = RUNTIME_DIR / "schema.yaml"


def run(command: list[str], env: dict[str, str]) -> None:
    print(f"\n$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=REPO_DIR, env=env, check=True)


def python_executable() -> str:
    venv_python = REPO_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def npm_executable() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def reset_verify_db() -> None:
    resolved_runtime = RUNTIME_DIR.resolve()
    resolved_db = VERIFY_DB_PATH.resolve()
    if resolved_runtime not in resolved_db.parents:
        raise RuntimeError(f"Refusing to remove database outside {resolved_runtime}: {resolved_db}")
    if VERIFY_DB_PATH.exists():
        VERIFY_DB_PATH.unlink()
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def build_env(database: str) -> dict[str, str]:
    env = os.environ.copy()
    backend_path = str(REPO_DIR / "backend")
    env["PYTHONPATH"] = (
        backend_path if not env.get("PYTHONPATH") else f"{backend_path}{os.pathsep}{env['PYTHONPATH']}"
    )
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    if database == "sqlite":
        env["DB_ENGINE"] = "sqlite"
        env["DJANGO_DB_PATH"] = str(VERIFY_DB_PATH)
    env["EXTERNAL_INTEGRATIONS_ENABLED"] = "false"
    env.setdefault("DJANGO_SECRET_KEY", "django-insecure-verify-only-with-sufficient-length-for-jwt")
    env.setdefault("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
    env.setdefault("DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Skip frontend lint/build checks.",
    )
    parser.add_argument(
        "--keep-db",
        action="store_true",
        help="Reuse the previous .runtime/verify SQLite database.",
    )
    parser.add_argument(
        "--database",
        choices=["sqlite", "configured"],
        default="sqlite",
        help=(
            "Use an isolated SQLite verify database, or use the database already configured "
            "through environment variables such as DB_ENGINE=mysql."
        ),
    )
    args = parser.parse_args()

    if args.database == "sqlite" and not args.keep_db:
        reset_verify_db()
    else:
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    env = build_env(args.database)
    py = python_executable()
    npm = npm_executable()
    manage = str(REPO_DIR / "backend" / "manage.py")

    commands = [
        [py, manage, "check"],
        [py, manage, "makemigrations", "--check", "--dry-run"],
        [py, manage, "migrate", "--noinput"],
        [py, manage, "seed_dev"],
        [py, manage, "seed_dev"],
        [
            py,
            manage,
            "test",
            "apps.core",
            "apps.accounts",
            "apps.greenhouse",
            "apps.ingest",
            "apps.weather",
            "apps.ai_advisory",
        ],
        [py, manage, "spectacular", "--validate", "--file", str(SCHEMA_PATH)],
    ]
    if not args.backend_only:
        if shutil.which(npm) is None:
            raise RuntimeError("npm is required unless --backend-only is used")
        commands.extend([[npm, "run", "dtu:test"], [npm, "run", "lint"], [npm, "run", "build"]])

    for command in commands:
        run(command, env)

    print("\nVerification passed.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
