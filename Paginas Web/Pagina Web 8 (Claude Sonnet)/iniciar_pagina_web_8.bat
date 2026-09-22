@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 8

echo.
echo ====================================================
echo   TSPPD-H Visualizador - Pagina Web 8
echo   Animacion LIFO + Ruta Optima
echo ====================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Instalando dependencias por primera vez...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install fallo. Verifica Node.js instalado.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas.
    echo.
)

echo [INICIO] Iniciando servidor de desarrollo en http://localhost:3008
echo.
echo [INFO] Presiona Ctrl+C para detener el servidor.
echo.

call npm run dev
pause
