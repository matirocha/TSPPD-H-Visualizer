@echo off
title Iniciar Todas las Paginas TSPPD-H
echo =====================================================
echo   Iniciando Pagina Web 1, Pagina Web 2 y Pagina Web 3
echo =====================================================
echo.
start "Pagina Web 1 (Puerto 3000)" cmd /k "cd /d "%~dp0Pagina Web 1" && node server.js"
start "Pagina Web 2 (Puerto 3001)" cmd /k "cd /d "%~dp0Pagina Web 2" && node server.js"
start "Pagina Web 3 (Puerto 3002)" cmd /k "cd /d "%~dp0Pagina Web 3" && node server.js"

echo Esperando 2 segundos para abrir navegadores...
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
start "" http://localhost:3001
start "" http://localhost:3002

echo Servidores iniciados en:
echo - Pagina 1: http://localhost:3000
echo - Pagina 2: http://localhost:3001
echo - Pagina 3: http://localhost:3002
echo.
echo Para detenerlos, cierra las ventanas de terminal.
