@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 8

echo.
echo ====================================================
echo   TSPPD-H Visualizador - Pagina Web 8
echo   Animacion LIFO + Ruta Optima
echo ====================================================
echo.

cd /d "%~dp0Pagina Web 8 (Claude Sonnet)"

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install fallo.
        pause
        exit /b 1
    )
    echo.
)

echo [INICIO] http://localhost:3008
call npm run dev
pause
