#!/usr/bin/env bash
# Downloads the official Microsoft ONNX Runtime macOS prebuilt library
# and places libonnxruntime.dylib in src-tauri/resources/onnxruntime/.
#
# Usage: bash scripts/fetch-onnxruntime.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST_DIR="${ROOT_DIR}/src-tauri/resources/onnxruntime"
LAYA_DIR="${ROOT_DIR}/src-tauri/resources/laya"

mkdir -p "${DEST_DIR}" "${LAYA_DIR}"

if [ ! -f "${LAYA_DIR}/.gitkeep" ]; then
  touch "${LAYA_DIR}/.gitkeep"
fi

python3 - "${DEST_DIR}" <<'EOF'
import urllib.request, json, zipfile, io, os, sys

dest_dir = sys.argv[1]
req = urllib.request.Request("https://pypi.org/pypi/onnxruntime/json", headers={"User-Agent": "Mozilla/5.0"})
data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
wheel_url = None
for u in data["urls"]:
    if "macosx" in u["filename"] and ("arm64" in u["filename"] or "universal2" in u["filename"]):
        print(f"Downloading {u['filename']} ({u['size'] / (1024*1024):.1f} MB)...")
        wheel_url = u["url"]
        break

if not wheel_url:
    raise RuntimeError("No macOS wheel found on PyPI")

wreq = urllib.request.Request(wheel_url, headers={"User-Agent": "Mozilla/5.0"})
wheel_bytes = urllib.request.urlopen(wreq, timeout=120).read()
with zipfile.ZipFile(io.BytesIO(wheel_bytes)) as zf:
    for name in zf.namelist():
        if "libonnxruntime" in name and name.endswith(".dylib"):
            target = os.path.join(dest_dir, "libonnxruntime.dylib")
            with open(target, "wb") as f:
                f.write(zf.read(name))
            os.chmod(target, 0o755)
            print("Extracted:", target)
            break
EOF

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "${DEST_DIR}" 2>/dev/null || true
fi

rm -rf "${ROOT_DIR}/src-tauri/vendor"

echo "Done. macOS ONNX Runtime installed:"
ls -lh "${DEST_DIR}"
