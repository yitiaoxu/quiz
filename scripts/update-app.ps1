$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

$cache = Join-Path $env:LOCALAPPDATA "electron-builder\Cache"
$za = Get-ChildItem -LiteralPath $cache -Filter "7za.exe" -Recurse -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($za) {
  $env:ELECTRON_BUILDER_7ZIP_PATH = $za.FullName
  Write-Host "Using 7za: $($za.FullName)"
}

function Stop-ExesIn([string]$dir) {
  if (-not (Test-Path -LiteralPath $dir)) {
    return
  }
  Get-ChildItem -LiteralPath $dir -Filter "*.exe" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $full = $_.FullName
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -eq $full } |
      ForEach-Object {
        Write-Host "Stopping PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  }
}

$releaseDir = Join-Path $root "release"
Stop-ExesIn $releaseDir
Stop-ExesIn (Join-Path $releaseDir "win-unpacked")
Start-Sleep -Seconds 1

Write-Host "Packaging portable exe ..."
cmd /c "npm run dist:win"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

$exe = Get-ChildItem -LiteralPath $releaseDir -Filter "*.exe" -File -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $exe) {
  Write-Host "No exe found in $releaseDir"
  exit 1
}

Write-Host "Done:" $exe.FullName
Write-Host ("Size: {0:N0} bytes" -f $exe.Length)
Write-Host "Reopen this exe to see the latest UI."
exit 0
