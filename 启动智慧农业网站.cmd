@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:5173/"

start "Smart Agriculture Full Stack" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run dev:full"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($response.StatusCode -lt 500) { Start-Process $url; exit 0 } } catch { Start-Sleep -Milliseconds 500 } }; Start-Process $url"

endlocal
