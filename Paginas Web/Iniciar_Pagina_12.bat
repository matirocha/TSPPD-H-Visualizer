@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 12 (Opus 5.5)

cd /d "%~dp0Pagina Web 12 (Opus 5.5)"

echo.
echo ====================================================
echo   TSPPD-H Laboratorio LIFO - Pagina Web 12 (Opus 5.5)
echo   Simulacion unidad por unidad + comparativa de politicas
echo ====================================================
echo.

if not exist "node_modules" (
    echo [INFO] Instalando dependencias de Node.js...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install fallo.
        pause
        exit /b 1
    )
    echo.
)

echo [INICIO] Abriendo http://localhost:3012
call npm run dev
pause
