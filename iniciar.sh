#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

NODE_VERSION="v24.11.0"
NODE_BIN=""
NPM_BIN=""

if [ -x "./runtime/bin/node" ]; then
  NODE_BIN="./runtime/bin/node"
  NPM_BIN="./runtime/bin/npm"
elif command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "${NODE_MAJOR:-0}" -ge 22 ]; then
    NODE_BIN="node"
    NPM_BIN="$(command -v npm || true)"
  fi
fi

if [ -z "$NODE_BIN" ]; then
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    *) echo "[ERROR] Sistema operativo no soportado para descarga automatica: $OS"; exit 1 ;;
  esac
  case "$ARCH" in
    x86_64|amd64) ARCH_TAG="x64" ;;
    arm64|aarch64) ARCH_TAG="arm64" ;;
    *) echo "[ERROR] Arquitectura no soportada: $ARCH"; exit 1 ;;
  esac

  PKG_NAME="node-${NODE_VERSION}-${PLATFORM}-${ARCH_TAG}"
  URL="https://nodejs.org/dist/${NODE_VERSION}/${PKG_NAME}.tar.gz"
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  echo "[CuseSoft] Descargando Node.js portable ${NODE_VERSION} (${PLATFORM}-${ARCH_TAG}) en ./runtime..."
  curl -fsSL "$URL" -o "$TMP_DIR/node.tar.gz"
  tar -xzf "$TMP_DIR/node.tar.gz" -C "$TMP_DIR"
  rm -rf ./runtime
  mv "$TMP_DIR/$PKG_NAME" ./runtime

  NODE_BIN="./runtime/bin/node"
  NPM_BIN="./runtime/bin/npm"
fi

if [ ! -d "node_modules" ]; then
  echo "[CuseSoft] Instalando librerias en ./node_modules..."
  export PATH="$(pwd)/runtime/bin:$PATH"
  if [ -f "package-lock.json" ]; then
    "$NPM_BIN" ci
  else
    "$NPM_BIN" install
  fi
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "[CuseSoft] Archivo .env creado desde .env.example."
fi

if [ ! -d "public/assets/covers" ]; then
  echo "[CuseSoft] Generando portadas y archivos de ejemplo..."
  "$NODE_BIN" scripts/make-assets.mjs
fi

if [ "${1:-}" = "--dev" ]; then
  echo "[CuseSoft] Iniciando en modo desarrollo (recarga automatica)..."
  exec "$NODE_BIN" --watch --env-file-if-exists=.env server/index.js
else
  echo "[CuseSoft] Iniciando CuseSoft Store..."
  exec "$NODE_BIN" --env-file-if-exists=.env server/index.js
fi
