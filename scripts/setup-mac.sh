#!/usr/bin/env bash
# One-command macOS setup script for Second Brain (Apple Silicon M-series & Intel)
# Fetches all native sidecar runtimes (llama.cpp Metal, stable-diffusion.cpp Metal, ONNX Runtime)
# and prepares resource directories for development and production builds.
#
# Usage: bash scripts/setup-mac.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== [1/3] Fetching llama.cpp macOS runtime (Apple Metal GPU enabled) ==="
bash "${SCRIPT_DIR}/fetch-llama-server.sh"

echo ""
echo "=== [2/3] Fetching stable-diffusion.cpp macOS runtime (Apple Metal GPU enabled) ==="
bash "${SCRIPT_DIR}/fetch-sd.sh"

echo ""
echo "=== [3/3] Fetching Microsoft ONNX Runtime for macOS ==="
bash "${SCRIPT_DIR}/fetch-onnxruntime.sh"

echo ""
echo "✅ All macOS native AI runtimes are installed and ready!"

