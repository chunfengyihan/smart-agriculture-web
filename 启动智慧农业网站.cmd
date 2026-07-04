@echo off
setlocal

set "PROJECT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\start-smart-agriculture.ps1"

endlocal
