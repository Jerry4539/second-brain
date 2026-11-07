#!/usr/bin/env bash
# Downloads the official stable-diffusion.cpp macOS Apple Silicon (Metal) prebuilt release
# and places sd-cli, sd-server, and required dylibs in src-tauri/resources/sd/.
#
# Usage: bash scripts/fetch-sd.sh

set -euo pipefail

RELEASE_TAG="master-890-74988b2"
ASSET_NAME="sd-master-74988b2-bin-Darwin-macOS-26.6.2-arm64.zip"
URL="https://github.com/leejet/stable-diffusion.cpp/releases/download/${RELEASE_TAG}/${ASSET_NAME}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENDOR_DIR="${ROOT_DIR}/src-tauri/vendor/sd-macos"
DEST_DIR="${ROOT_DIR}/src-tauri/resources/sd"

mkdir -p "${VENDOR_DIR}" "${DEST_DIR}"

ZIP_PATH="${VENDOR_DIR}/${ASSET_NAME}"
echo "Downloading ${ASSET_NAME}..."
curl -fL --retry 3 -o "${ZIP_PATH}" "${URL}"

echo "Extracting ${ASSET_NAME}..."
unzip -qo "${ZIP_PATH}" -d "${VENDOR_DIR}/extracted"

# Copy all binaries and dynamic libraries into resources/sd/
find "${VENDOR_DIR}/extracted" -type f \( -name "sd-cli" -o -name "sd-server" -o -name "sd" -o -name "*.dylib" -o -name "*.metal" -o -name "*.metallib" \) -exec cp -f {} "${DEST_DIR}/" \;

# If the archive only contains `sd` instead of `sd-cli`, link/copy `sd` to `sd-cli`
if [ ! -f "${DEST_DIR}/sd-cli" ] && [ -f "${DEST_DIR}/sd" ]; then
  cp -f "${DEST_DIR}/sd" "${DEST_DIR}/sd-cli"
fi

chmod +x "${DEST_DIR}/sd-cli" 2>/dev/null || true
chmod +x "${DEST_DIR}/sd-server" 2>/dev/null || true
chmod +x "${DEST_DIR}"/*.dylib 2>/dev/null || true

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "${DEST_DIR}" 2>/dev/null || true
fi

rm -rf "${ROOT_DIR}/src-tauri/vendor"

echo "Done. macOS stable-diffusion.cpp runtime installed to ${DEST_DIR}:"
ls -lh "${DEST_DIR}"

