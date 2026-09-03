@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 9

cd /d "%~dp0Pagina Web 9"

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
)

echo [INICIO] Abriendo http://localhost:3009
call npm run dev
pause
