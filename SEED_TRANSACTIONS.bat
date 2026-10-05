@echo off
chcp 65001 >nul
cd /d "%~dp0denso-wms-backend"
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "node_modules" call npm install
call npm run migration:run
call npm run seed:transactions
pause
