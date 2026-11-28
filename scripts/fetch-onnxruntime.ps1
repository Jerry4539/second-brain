# Downloads the official Microsoft ONNX Runtime Windows x64 CPU-only prebuilt
# binary and places onnxruntime.dll in src-tauri/resources/onnxruntime/ so the
# decision engine can load it on demand via `ort`'s load-dynamic feature (no
# Python, no build-time linking — matches the llama.cpp/stable-diffusion.cpp
# bundled-binary pattern).
#
# Usage: powershell -File scripts/fetch-onnxruntime.ps1

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root 'src-tauri\resources\onnxruntime'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$vendorDir = Join-Path $root 'src-tauri\vendor'
New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null

Write-Host "Querying PyPI for official Microsoft ONNX Runtime Windows x64 wheel..."
try {
    $pypi = Invoke-RestMethod -Uri "https://pypi.org/pypi/onnxruntime/json" -Headers @{ "User-Agent" = "Mozilla/5.0" }
    $wheel = $pypi.urls | Where-Object { $_.filename -like "*win_amd64.whl" } | Select-Object -First 1
    if (-not $wheel) {
        throw "No Windows amd64 wheel found on PyPI for onnxruntime"
    }

    $wheelUrl = $wheel.url
    $wheelName = $wheel.filename
    $zipPath = Join-Path $vendorDir "$wheelName.zip"
    $extractDir = Join-Path $vendorDir 'onnxruntime-extract'

    Write-Host "Downloading $wheelName ($([math]::Round($wheel.size / 1MB, 1)) MB)..."
    Invoke-WebRequest -Uri $wheelUrl -OutFile $zipPath

    Write-Host "Extracting onnxruntime.dll..."
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $dll = Get-ChildItem $extractDir -Recurse -Filter 'onnxruntime.dll' | Select-Object -First 1
    if (-not $dll) {
        throw "onnxruntime.dll not found in $wheelName"
    }

    Copy-Item $dll.FullName (Join-Path $destDir 'onnxruntime.dll') -Force

    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    if (Test-Path $vendorDir) {
        Remove-Item $vendorDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Warning "PowerShell fetch encountered: $_. Attempting Python fallback..."
    python -c @"
import urllib.request, json, zipfile, io, os, sys
dest_dir = r'$destDir'
req = urllib.request.Request('https://pypi.org/pypi/onnxruntime/json', headers={'User-Agent': 'Mozilla/5.0'})
data = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
win_whl = next(u for u in data['urls'] if 'win_amd64.whl' in u['filename'])
print(f'Downloading {win_whl[\"filename\"]}...')
wreq = urllib.request.Request(win_whl['url'], headers={'User-Agent': 'Mozilla/5.0'})
raw = urllib.request.urlopen(wreq, timeout=120).read()
with zipfile.ZipFile(io.BytesIO(raw)) as zf:
    for name in zf.namelist():
        if name.endswith('onnxruntime.dll'):
            target = os.path.join(dest_dir, 'onnxruntime.dll')
            with open(target, 'wb') as f:
                f.write(zf.read(name))
            print('Extracted:', target)
            break
"@
}

if (-not (Test-Path (Join-Path $destDir 'onnxruntime.dll'))) {
    throw "Failed to install onnxruntime.dll to $destDir"
}

Write-Host "Done. Successfully placed onnxruntime.dll in $destDir"
