@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 10

cd /d "%~dp0Pagina Web 10 (Gemini 3.8 Flash)"

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
)

echo [INICIO] Abriendo http://localhost:3010
call npm run dev
pause
