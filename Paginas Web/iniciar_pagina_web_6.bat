@echo off
chcp 65001 >nul
title Pagina Web 6 (Nemotron 3 Ultra) - TSPPD-H Visualizador

echo =======================================================
echo   Iniciando Pagina Web 6 (Nemotron 3 Ultra)
echo =======================================================
echo.

cd /d "%~dp0Pagina Web 6 (Nemotron 3 Ultra)"

if not exist "node_modules\" (
    echo [INFO] Instalando dependencias de Node.js...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

echo Iniciando servidor y abriendo la aplicacion en el navegador...
echo.
call npm run dev -- --open