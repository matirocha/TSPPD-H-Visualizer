#!/bin/bash

# TSPPD-H Visualizador - Pagina Web 10 (macOS)
echo -ne "\033]0;TSPPD-H Visualizador - Pagina Web 10\007"

# Asegurar rutas comunes de binarios en macOS (Homebrew Apple Silicon/Intel, MacPorts)
export PATH="/opt/homebrew/bin:/usr/local/bin:/opt/local/bin:$PATH"

# Cargar NVM si está disponible
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    \. "$NVM_DIR/nvm.sh" 2>/dev/null
fi

# Cargar configuraciones de usuario si existen
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile" 2>/dev/null
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null
[ -f "$HOME/.bash_profile" ] && source "$HOME/.bash_profile" 2>/dev/null

# Cambiar al directorio del script y luego a Pagina Web 10
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/Pagina Web 10" || {
    echo "[ERROR] No se pudo acceder al directorio: $DIR/Pagina Web 10"
    read -n 1 -s -r -p "Presiona cualquier tecla para salir..."
    echo ""
    exit 1
}

# Verificar que Node y npm estén disponibles
if ! command -v npm &> /dev/null; then
    echo "[ERROR] No se encontró 'npm' en el sistema."
    echo "Por favor instala Node.js (https://nodejs.org) o verifica que esté en tu PATH."
    read -n 1 -s -r -p "Presiona cualquier tecla para salir..."
    echo ""
    exit 1
fi

echo ""
echo "===================================================="
echo "  TSPPD-H Visualizador - Pagina Web 10"
echo "===================================================="
echo ""

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "[INFO] Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] npm install falló."
        read -n 1 -s -r -p "Presiona cualquier tecla para salir..."
        echo ""
        exit 1
    fi
fi

echo "[INICIO] Abriendo http://localhost:3010"
npm run dev

echo ""
read -n 1 -s -r -p "Presiona cualquier tecla para cerrar..."
echo ""
