# Downloads the official llama.cpp Windows CPU (AVX2, no CUDA) prebuilt release
# and trims it down to just the files llama-server.exe actually needs, placing
# them in src-tauri/resources/llama/ so `tauri build` can bundle them as app
# resources. This keeps the ~40MB of binaries out of git; run this once after
# cloning (and again whenever LLAMA_RELEASE_TAG below is bumped).
#
# Usage: powershell -File scripts/fetch-llama-server.ps1

$ErrorActionPreference = 'Stop'

$releaseTag = 'b10964'
$assetName = "llama-$releaseTag-bin-win-cpu-x64.zip"
$url = "https://github.com/ggml-org/llama.cpp/releases/download/$releaseTag/$assetName"

$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root 'src-tauri\vendor'
$extractDir = Join-Path $vendorDir 'llama-win-cpu-x64'
$destDir = Join-Path $root 'src-tauri\resources\llama'

New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$zipPath = Join-Path $vendorDir $assetName
Write-Host "Downloading $assetName..."
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host 'Extracting...'
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

# Only these files are required to run llama-server.exe. The many
# ggml-cpu-*.dll variants are kept so the app works on any x64 CPU
# (the right one is auto-selected at runtime based on detected CPU features).
$keep = @(
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama.dll',
  'llama-common.dll',
  'mtmd.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-rpc.dll',
  'libomp.dll',
  'LICENSE-LLVM-OpenMP'
) + (Get-ChildItem $extractDir -Filter 'ggml-cpu-*.dll').Name

foreach ($file in $keep) {
  Copy-Item (Join-Path $extractDir $file) (Join-Path $destDir $file) -Force
}

Remove-Item $vendorDir -Recurse -Force

Write-Host "Done. $($keep.Count) files copied to $destDir"
