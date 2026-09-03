@echo off
chcp 65001 >nul
title TSPPD-H Visualizador - Pagina Web 6 (Nemotron 3 Ultra)

echo =======================================================
echo   TSPPD-H Visualizador - Pagina Web 6 (Nemotron 3 Ultra)
echo =======================================================
echo.

cd /d "%~dp0"

if not exist "node_modules\" (
    echo [INFO] Instalando dependencias de Node.js...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

echo [INFO] Iniciando servidor y abriendo navegador...
echo.
call npm run dev -- --open