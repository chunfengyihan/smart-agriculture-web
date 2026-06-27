@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:8000/"
set "PYTHON_EXE=%PROJECT_DIR%.venv\Scripts\python.exe"
set "WEATHER_INTEGRATION_ENABLED=true"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

start "Smart Agriculture Django" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run build && ""%PYTHON_EXE%"" backend\manage.py migrate --noinput && ""%PYTHON_EXE%"" backend\manage.py seed_dev && ""%PYTHON_EXE%"" backend\manage.py runserver 127.0.0.1:8000 --noreload"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($response.StatusCode -lt 500) { Start-Process $url; exit 0 } } catch { Start-Sleep -Milliseconds 500 } }; Start-Process $url"

endlocal
