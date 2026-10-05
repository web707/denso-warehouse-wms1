@echo off
chcp 65001 >nul
cd /d "%~dp0denso-wms-frontend"
if not exist "node_modules" (
  echo Dang cai package frontend...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo Khoi dong frontend...
call npm run dev
