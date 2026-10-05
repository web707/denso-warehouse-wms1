@echo off
chcp 65001 >nul
cd /d "%~dp0denso-wms-backend"
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "node_modules" (
  echo [1/3] Dang cai package backend...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo [2/3] Dang cap nhat database...
call npm run migration:run
if errorlevel 1 pause & exit /b 1
echo [3/3] Khoi dong backend...
call npm run start:dev
