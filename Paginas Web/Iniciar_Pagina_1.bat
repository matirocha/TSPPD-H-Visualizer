@echo off
title Iniciar TSPPD-H Visualizer - Pagina 1
echo ===================================================
echo   Iniciando TSPPD-H Visualizador - Pagina Web 1
echo ===================================================
echo.
cd /d "%~dp0Pagina Web 1 (Gemini Flash 3.7)"
start "" http://localhost:3000
node server.js
pause
