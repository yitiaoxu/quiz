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

$releaseDir = Join-Path $root "release"
$stageDir = Join-Path $env:LOCALAPPDATA "fpga-quiz-build"

function Stop-QuizApp {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
    $name = [string]$_.Name
    $path = [string]$_.ExecutablePath
    if ($name -match '^(node|powershell|pwsh|cmd|conhost)\.exe$') {
      return
    }
    $isApp = $false
    if ($name -match '面试默写' -or $name -match 'fpga-quiz') {
      $isApp = $true
    }
    if ($path) {
      if ($path -match '面试默写' -or $path -match 'fpga-quiz') { $isApp = $true }
      if ($path.StartsWith($releaseDir, [StringComparison]::OrdinalIgnoreCase)) { $isApp = $true }
      if ($path -match '\\quiz\\release\\') { $isApp = $true }
    }
    if (-not $isApp) {
      return
    }
    Write-Host "Stopping PID $($_.ProcessId) $name"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Copy-ExeWithRetry([string]$source, [string]$destination) {
  $destDir = Split-Path -Parent $destination
  if (-not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  }
  for ($i = 1; $i -le 8; $i++) {
    try {
      Copy-Item -LiteralPath $source -Destination $destination -Force
      return
    } catch {
      Write-Host "Copy retry $i : $($_.Exception.Message)"
      Stop-QuizApp
      Start-Sleep -Seconds 2
    }
  }
  throw "Could not copy exe into release (file still in use)"
}

Stop-QuizApp
Start-Sleep -Seconds 1

Write-Host "Building web assets ..."
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "Packaging portable exe in $stageDir ..."
$builder = Join-Path $root "node_modules\.bin\electron-builder.cmd"
if (-not (Test-Path -LiteralPath $builder)) {
  Write-Host "electron-builder not found. Run npm install first."
  exit 1
}
& $builder --win portable "-c.directories.output=$stageDir"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Packaging failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

$built = Get-ChildItem -LiteralPath $stageDir -Filter "*.exe" -File -ErrorAction SilentlyContinue |
  Where-Object { $_.DirectoryName -eq $stageDir } |
  Select-Object -First 1
if (-not $built) {
  Write-Host "No portable exe found in $stageDir"
  exit 1
}

$dest = Join-Path $releaseDir $built.Name
Copy-ExeWithRetry $built.FullName $dest

Write-Host "Done:" $dest
Write-Host ("Size: {0:N0} bytes" -f (Get-Item -LiteralPath $dest).Length)
Write-Host "Reopen this exe to see the latest UI."
exit 0
