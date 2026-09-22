@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 9

echo.
echo ====================================================
echo   TSPPD-H Visualizador - Pagina Web 9
echo   Animacion LIFO + Mapa de Ruta Optima
echo ====================================================
echo.

cd /d "%~dp0Pagina Web 9 (Gemini 3.7 Flash)"

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

echo [INICIO] Abriendo http://localhost:3009
call npm run dev
pause
