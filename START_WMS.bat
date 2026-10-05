@echo off
start "DENSO WMS Backend" cmd /k ""%~dp0START_BACKEND.bat""
timeout /t 4 /nobreak >nul
start "DENSO WMS Frontend" cmd /k ""%~dp0START_FRONTEND.bat""
