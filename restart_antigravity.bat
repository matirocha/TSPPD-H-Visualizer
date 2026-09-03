@echo off
echo ===================================================
echo     Reiniciando Antigravity limpiamente...
echo ===================================================
taskkill /F /IM antigravity.exe /T 2>nul
taskkill /F /IM language_server.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Iniciando Antigravity...
start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
echo [OK] Listo!
