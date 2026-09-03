@echo off
chcp 65001 >nul
title TSPPD-H - Pagina Web 7 (Muse Park 1.2)

echo =======================================================
echo   TSPPD-H - Pagina Web 7 (Muse Park 1.2)
echo =======================================================
echo.

cd /d "%~dp0Pagina Web 7 (Muse Park 1.2)"

if not exist "node_modules\" (
    echo [INFO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Fallo al instalar dependencias.
        pause
        exit /b 1
    )
)

echo [INFO] Iniciando en http://localhost:3006 ...
call npm run dev -- --open --port 3006
