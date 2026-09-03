@echo off
echo ===================================================
echo     Restaurando Antigravity a su version original
echo ===================================================
taskkill /F /IM antigravity.exe /T 2>nul
timeout /t 2 /nobreak >nul

set "TARGET=C:\Users\MatiasPC\AppData\Local\Programs\antigravity\resources\app.asar"
set "BACKUP=C:\Users\MatiasPC\AppData\Local\Programs\antigravity\resources\app.asar.backup"

if exist "%BACKUP%" (
    copy /Y "%BACKUP%" "%TARGET%"
    echo.
    echo [OK] Antigravity restaurado correctamente desde el respaldo.
) else (
    echo.
    echo [ERROR] No se encontro el archivo de respaldo app.asar.backup.
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
