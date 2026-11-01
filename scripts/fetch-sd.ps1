# Downloads the official stable-diffusion.cpp Windows CPU-only prebuilt release
# and places it in src-tauri/resources/sd/ so `tauri build` can bundle it as an
# app resource. Pure C/C++, no Python/CUDA required — same family as llama.cpp.
# This keeps the binaries out of git; run this once after cloning (and again
# whenever SD_RELEASE_TAG below is bumped).
#
# Usage: powershell -File scripts/fetch-sd.ps1

$ErrorActionPreference = 'Stop'

# Release tags look like "master-<buildnum>-<shorthash>" but the asset
# filenames only use "master-<shorthash>" (no build number) — keep both in
# sync when bumping. Check https://github.com/leejet/stable-diffusion.cpp/releases/latest
$releaseTag = 'master-890-74988b2'
$assetName = 'sd-master-74988b2-bin-win-cpu-x64.zip'
$url = "https://github.com/leejet/stable-diffusion.cpp/releases/download/$releaseTag/$assetName"

$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root 'src-tauri\vendor'
$destDir = Join-Path $root 'src-tauri\resources\sd'

New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$zipPath = Join-Path $vendorDir $assetName
Write-Host "Downloading $assetName..."
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host 'Extracting...'
Expand-Archive -Path $zipPath -DestinationPath $destDir -Force

Remove-Item $zipPath -Force

Write-Host "Done. Contents of $destDir :"
Get-ChildItem $destDir | Select-Object Name
