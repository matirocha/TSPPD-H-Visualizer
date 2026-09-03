@echo off
title TSPPD-H Visualizador - Pagina Web 11

cd /d "%~dp0Pagina Web 11"

echo.
echo ====================================================
echo   TSPPD-H Visualizador Optimo - Pagina Web 11
echo   Simulacion Cinematica LIFO + Carga y Descarga
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

echo [INICIO] Abriendo http://localhost:3011
call npm run dev
pause
