@echo off
title Iniciar Ambas Paginas TSPPD-H
echo ===================================================
echo   Iniciando Pagina Web 1 y Pagina Web 2...
echo ===================================================
echo.
start "Pagina Web 1 (Puerto 3000)" cmd /k "cd /d "%~dp0Pagina Web 1 (Gemini Flash 3.7)" && node server.js"
start "Pagina Web 2 (Puerto 3001)" cmd /k "cd /d "%~dp0Pagina Web 2 (Gemini Flash 3.7)" && node server.js"
echo Esperando 2 segundos para abrir navegador...
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
start "" http://localhost:3001
echo Servidores iniciados en:
echo - Pagina 1: http://localhost:3000
echo - Pagina 2: http://localhost:3001
echo.
echo Para detenerlos, simplemente cierra las ventanas de terminal abiertas.

