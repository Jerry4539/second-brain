# Downloads the official Microsoft ONNX Runtime Windows x64 CPU-only prebuilt
# release and places onnxruntime.dll in src-tauri/resources/onnxruntime/ so the
# decision engine can load it on demand via `ort`'s load-dynamic feature (no
# Python, no build-time linking — matches the llama.cpp/stable-diffusion.cpp
# bundled-binary pattern).
#
# Usage: powershell -File scripts/fetch-onnxruntime.ps1

$ErrorActionPreference = 'Stop'

$version = '1.30.0'
$assetName = "onnxruntime-win-x64-$version.zip"
$url = "https://github.com/microsoft/onnxruntime/releases/download/v$version/$assetName"

$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root 'src-tauri\vendor'
$destDir = Join-Path $root 'src-tauri\resources\onnxruntime'

New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$zipPath = Join-Path $vendorDir $assetName
Write-Host "Downloading $assetName..."
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host 'Extracting...'
$extractDir = Join-Path $vendorDir 'onnxruntime-extract'
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$dll = Get-ChildItem $extractDir -Recurse -Filter 'onnxruntime.dll' | Select-Object -First 1
Copy-Item $dll.FullName (Join-Path $destDir 'onnxruntime.dll') -Force

Remove-Item $extractDir -Recurse -Force
Remove-Item $zipPath -Force

Write-Host "Done. $(Join-Path $destDir 'onnxruntime.dll')"
