@echo off
title Iniciar TSPPD-H Visualizer - Pagina 3
echo ===================================================
echo   Iniciando TSPPD-H Visualizador - Pagina Web 3
echo ===================================================
echo.
cd /d "%~dp0Pagina Web 3 (Gemini Flash 3.7)"

if not exist "node_modules\" (
    echo [INFO] Instalando dependencias de Node.js...
    call npm install
)

if not exist "dist\" (
    echo [INFO] Compilando frontend para produccion...
    call npm run build
)

start "" http://localhost:3002
node server.js
pause
