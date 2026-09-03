@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 7 (Muse Park 1.2)

echo =======================================================
echo   TSPPD-H Visualizador - Pagina Web 7 (Muse Park 1.2)
echo   Muse Spark 1.2 · Node.js + Vite + Framer Motion
echo =======================================================
echo.

cd /d "%~dp0"

if not exist "node_modules\" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

echo [INFO] Iniciando servidor en http://localhost:3006 ...
echo.
call npm run dev -- --open --port 3006
