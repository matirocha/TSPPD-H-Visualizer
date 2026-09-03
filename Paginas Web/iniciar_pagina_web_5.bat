@echo off
echo Preparando datos y abriendo Pagina Web 5...
cd "Pagina Web 5"
node scripts/copy-outputs.js
npm run dev -- --open
