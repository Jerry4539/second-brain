#!/usr/bin/env bash
# Downloads the official llama.cpp macOS (Apple Silicon Metal / Intel) prebuilt release
# and places the required runtime files into src-tauri/resources/llama/ so `tauri build`
# and `tauri dev` can bundle and run them with Metal GPU acceleration.
#
# Usage: bash scripts/fetch-llama-server.sh

set -euo pipefail

RELEASE_TAG="b10964"
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ASSET_NAME="llama-${RELEASE_TAG}-bin-macos-arm64.tar.gz"
else
  ASSET_NAME="llama-${RELEASE_TAG}-bin-macos-x64.tar.gz"
fi

URL="https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE_TAG}/${ASSET_NAME}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_DIR="${ROOT_DIR}/src-tauri/vendor/llama-macos"
DEST_DIR="${ROOT_DIR}/src-tauri/resources/llama"

mkdir -p "${VENDOR_DIR}" "${DEST_DIR}"

ARCHIVE_PATH="${VENDOR_DIR}/${ASSET_NAME}"
echo "Downloading ${ASSET_NAME}..."
curl -fL --retry 3 -o "${ARCHIVE_PATH}" "${URL}"

echo "Extracting ${ASSET_NAME}..."
tar -xzf "${ARCHIVE_PATH}" -C "${VENDOR_DIR}"

# Locate extracted directory containing llama-server
BIN_FILE="$(find "${VENDOR_DIR}" -type f -name "llama-server" | head -n 1)"
if [ -z "${BIN_FILE}" ]; then
  echo "Error: llama-server binary not found in archive" >&2
  exit 1
fi
EXTRACT_BIN_DIR="$(dirname "${BIN_FILE}")"

# Copy llama-server, all dynamic libraries (.dylib), and Metal shaders (.metal / .metallib)
cp -f "${EXTRACT_BIN_DIR}/llama-server" "${DEST_DIR}/"
find "${VENDOR_DIR}" \( -name "*.dylib" -o -name "*.metal" -o -name "*.metallib" -o -name "LICENSE*" \) -exec cp -fP {} "${DEST_DIR}/" \;

chmod +x "${DEST_DIR}/llama-server"
chmod +x "${DEST_DIR}"/*.dylib 2>/dev/null || true

# Clear macOS quarantine bit so Gatekeeper does not block local sidecar execution
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "${DEST_DIR}" 2>/dev/null || true
fi

rm -rf "${ROOT_DIR}/src-tauri/vendor"

echo "Done. macOS llama-server runtime installed to ${DEST_DIR}:"
ls -lh "${DEST_DIR}"

