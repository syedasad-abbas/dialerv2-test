#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Bootstrapping React app in ${FRONTEND_DIR} using Docker (no host npm needed)..."

docker run --rm -it \
  --user "$(id -u):$(id -g)" \
  -v "${FRONTEND_DIR}:/app" \
  -w /app \
  node:20-alpine \
  sh -lc "npm create vite@latest . -- --template react-ts --force && npm i && npm i react-router-dom axios zustand react-hook-form zod @hookform/resolvers"

echo "Frontend bootstrap complete."
