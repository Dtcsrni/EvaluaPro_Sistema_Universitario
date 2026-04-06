$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$installerHubPath = Join-Path $root 'scripts\installer-hub\InstallerHub.ps1'
$tempRoot = Join-Path $env:TEMP ('evaluapro-debug-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

$installDir = Join-Path $tempRoot 'EvaluaPro'
$fakeReleaseDir = Join-Path $tempRoot 'release'
$securityDir = Join-Path $tempRoot 'security'
$desktopDir = Join-Path $tempRoot 'desktop'
$startMenuDir = Join-Path $tempRoot 'startmenu\EvaluaPro'

New-Item -ItemType Directory -Path $fakeReleaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $securityDir -Force | Out-Null
New-Item -ItemType Directory -Path $desktopDir -Force | Out-Null
New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

$fakeMsiPath = Join-Path $fakeReleaseDir 'EvaluaPro-docente-local.msi'
$fakeShaPath = Join-Path $fakeReleaseDir 'EvaluaPro-docente-local.msi.sha256'
Set-Content -Path $fakeMsiPath -Value "fake-msi-for-release-smoke`n" -Encoding utf8
$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $fakeMsiPath).Hash.ToLowerInvariant()
Set-Content -Path $fakeShaPath -Value "$sha  $(Split-Path -Leaf $fakeMsiPath)`n" -Encoding utf8

$env:EVALUAPRO_LICENSE_ACTIVATION_SIMULATE = '1'
$env:EVALUAPRO_INSTALLER_ASSUME_INTERNET = '1'
$env:EVALUAPRO_INSTALLER_RELEASE_MSI_PATH = $fakeMsiPath
$env:EVALUAPRO_INSTALLER_RELEASE_SHA_PATH = $fakeShaPath
$env:EVALUAPRO_INSTALLER_RELEASE_TAG = '1.0.0-test'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP = '1'
$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP = '1'
$env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL = '1'
$env:EVALUAPRO_INSTALLER_SIMULATE_PRODUCT_ACTION = '1'
$env:EVALUAPRO_INSTALLER_SIMULATE_SOURCE_DIR = $root
$env:EVALUAPRO_INSTALLER_ALLOW_UNREGISTERED = '1'
$env:EVALUAPRO_SECURITY_ROOT = $securityDir
$env:EVALUAPRO_DESKTOP_PATH = $desktopDir
$env:EVALUAPRO_STARTMENU_PATH = $startMenuDir

Write-Host "DEBUG: InstallDir = $installDir"

if (-not (Test-Path $installerHubPath)) {
  Write-Host "ERROR: InstallerHub.ps1 no encontrado en $installerHubPath"
  exit 2
}

# Run install (headless)
Write-Host "DEBUG: Ejecutando Install (headless) ..."
try {
  $installOutput = & $installerHubPath -Headless -NoElevation -Mode install -FlavorId 'docente-local' -InstallDir $installDir -ApiComercialBaseUrl 'http://127.0.0.1:4000' -TenantId 'tenant-smoke' -CodigoActivacion 'code-smoke' -PasswordResetUrlBase 'https://localhost/reset' 2>&1
  $installExit = $LASTEXITCODE
} catch {
  Write-Host "INSTALL ERROR: $_"
  $installExit = 1
  $installOutput = "ERROR: $_"
}
Write-Host "DEBUG: Install exit code = $installExit"
Write-Host "DEBUG: Install output START"
Write-Host $installOutput
Write-Host "DEBUG: Install output END"

$manifestFile = Join-Path $installDir 'logs\installation.manifest.json'
$brokerFile = Join-Path $installDir 'scripts\launcher-broker.ps1'
$trayHiddenFile = Join-Path $installDir 'scripts\launcher-tray-hidden.vbs'
Write-Host "DEBUG: manifest exists: $(Test-Path $manifestFile)"
Write-Host "DEBUG: broker exists: $(Test-Path $brokerFile)"
Write-Host "DEBUG: trayHidden exists: $(Test-Path $trayHiddenFile)"

# Remove to simulate damage
if (Test-Path $manifestFile) { Remove-Item -LiteralPath $manifestFile -Force -ErrorAction SilentlyContinue }
if (Test-Path $brokerFile) { Remove-Item -LiteralPath $brokerFile -Force -ErrorAction SilentlyContinue }
if (Test-Path $trayHiddenFile) { Remove-Item -LiteralPath $trayHiddenFile -Force -ErrorAction SilentlyContinue }

foreach ($s in @('EvaluaPro - Dev.lnk','EvaluaPro - Prod.lnk','EvaluaPro - Hub.lnk')) {
  $d = Join-Path $desktopDir ($s)
  if (Test-Path $d) { Remove-Item -LiteralPath $d -Force -ErrorAction SilentlyContinue }
  $s2 = Join-Path $startMenuDir ($s)
  if (Test-Path $s2) { Remove-Item -LiteralPath $s2 -Force -ErrorAction SilentlyContinue }
}

$updateConfigFile = Join-Path $installDir 'config\update-config.json'
if (Test-Path $updateConfigFile) {
  try {
    $json = Get-Content -LiteralPath $updateConfigFile -Raw -Encoding utf8 | ConvertFrom-Json
    $json.flavorId = 'saas-completo'
    $json.assetName = 'wrong-installer.exe'
    $json | ConvertTo-Json -Depth 8 | Set-Content -Path $updateConfigFile -Encoding utf8
    Write-Host "DEBUG: update-config corrompido"
  } catch {
    Write-Host "DEBUG: no pude corromper update-config: $_"
  }
} else {
  Write-Host "DEBUG: update-config no existe en $updateConfigFile"
}

# Run health check
Write-Host "DEBUG: Ejecutando Get-EvaluaProInstallationHealth"
try {
  Import-Module -Force (Join-Path $root 'scripts\installer-hub\modules\PrereqDetector.psm1') -DisableNameChecking
  $health = Get-EvaluaProInstallationHealth -InstallDir $installDir | ConvertTo-Json -Depth 8
  Write-Host "HEALTH_JSON_START"
  Write-Host $health
  Write-Host "HEALTH_JSON_END"
  try { $obj = $health | ConvertFrom-Json; Write-Host "HEALTH_STATE: $($obj.state)"; if ($obj.issues) { Write-Host "HEALTH_ISSUES: $($obj.issues -join ' | ')" } }
  catch { Write-Host "DEBUG: no pude parsear health JSON" }
} catch {
  Write-Host "HEALTH ERROR: $_"
}

Write-Host "DEBUG: Fin del script (tempRoot: $tempRoot)"

# NOT removing temp dir to allow inspection

exit 0
