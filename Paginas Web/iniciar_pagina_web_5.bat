@echo off
echo Preparando datos y abriendo Pagina Web 5...
cd /d "%~dp0Pagina Web 5 (Claude Opus 4.6)"
node scripts/copy-outputs.js
npm run dev -- --open
