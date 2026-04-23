#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${1:-syedasadabbas/dialerv2-frontend:0.1}"
API_BASE_URL="${VITE_API_BASE_URL:-http://127.0.0.1:3100}"
PORTAL_WS_URL="${VITE_PORTAL_WS_URL:-ws://127.0.0.1:18081}"

echo "Building image: ${IMAGE}"
echo "VITE_API_BASE_URL=${API_BASE_URL}"
echo "VITE_PORTAL_WS_URL=${PORTAL_WS_URL}"

docker build \
  --build-arg VITE_API_BASE_URL="${API_BASE_URL}" \
  --build-arg VITE_PORTAL_WS_URL="${PORTAL_WS_URL}" \
  -t "${IMAGE}" \
  "${FRONTEND_DIR}"

echo "Build complete: ${IMAGE}"
