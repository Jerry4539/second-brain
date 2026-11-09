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

# Copy llama-server.exe and all required runtime and CPU variant DLLs
Copy-Item (Join-Path $extractDir 'llama-server.exe') $destDir -Force
$copiedDlls = Get-ChildItem $extractDir -Filter '*.dll'
foreach ($dll in $copiedDlls) {
  Copy-Item $dll.FullName (Join-Path $destDir $dll.Name) -Force
}
if (Test-Path (Join-Path $extractDir 'LICENSE-LLVM-OpenMP')) {
  Copy-Item (Join-Path $extractDir 'LICENSE-LLVM-OpenMP') $destDir -Force
}

Remove-Item $vendorDir -Recurse -Force

Write-Host "Done. llama-server.exe and $($copiedDlls.Count) DLLs copied to $destDir"
