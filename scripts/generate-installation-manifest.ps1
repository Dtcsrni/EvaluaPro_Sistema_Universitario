# Generates a local installation manifest consumed by the dashboard, shortcuts and Installer Hub.
param(
  [string]$InstallDir = '',
  [ValidateRange(1, 65535)]
  [int]$Port = 4519
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = if ($InstallDir) { $InstallDir } else { (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$logDir = Join-Path $root 'logs'
$configDir = Join-Path $root 'config'
$manifestPath = Join-Path $logDir 'installation.manifest.json'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
if (-not (Test-Path -LiteralPath $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }

function Get-FileSha256OrEmpty([string]$path) {
  try {
    if (-not (Test-Path -LiteralPath $path)) { return '' }
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
  } catch {
    return ''
  }
}

function Resolve-ShortcutTargetPaths {
  $desktop = if ($env:EVALUAPRO_DESKTOP_PATH) { [string]$env:EVALUAPRO_DESKTOP_PATH } else { [Environment]::GetFolderPath('Desktop') }
  $startMenuBase = if ($env:EVALUAPRO_STARTMENU_PATH) { [string]$env:EVALUAPRO_STARTMENU_PATH } elseif ($env:APPDATA) { Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro' } else { '' }
  return [ordered]@{
    devDesktop = if ($desktop) { Join-Path $desktop 'EvaluaPro - Dev.lnk' } else { '' }
    prodDesktop = if ($desktop) { Join-Path $desktop 'EvaluaPro - Prod.lnk' } else { '' }
    hubDesktop = if ($desktop) { Join-Path $desktop 'EvaluaPro - Hub.lnk' } else { '' }
    devStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Dev.lnk' } else { '' }
    prodStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Prod.lnk' } else { '' }
    hubStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Hub.lnk' } else { '' }
  }
}

function Read-JsonFileSafe([string]$path) {
  try {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    return (Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Test-ShortcutPresence($paths) {
  $result = [ordered]@{}
  foreach ($entry in $paths.GetEnumerator()) {
    $exists = $false
    if ($entry.Value) {
      try { $exists = Test-Path -LiteralPath $entry.Value } catch { $exists = $false }
    }
    $result[$entry.Key] = [ordered]@{
      path = $entry.Value
      exists = $exists
    }
  }
  return $result
}

$packageJsonPath = Join-Path $root 'package.json'
$versionMetaPath = Join-Path $configDir 'app-version.json'
$pkg = @{ name = 'evaluapro'; version = '0.0.0' }
try {
  $pkg = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
} catch {}
$pkgName = if ($null -ne $pkg -and $null -ne $pkg.name -and [string]$pkg.name) { [string]$pkg.name } else { 'evaluapro' }
$pkgVersion = if ($null -ne $pkg -and $null -ne $pkg.version -and [string]$pkg.version) { [string]$pkg.version } else { '0.0.0' }
$pkgDisplayVersion = $pkgVersion
try {
  $versionMeta = Get-Content -LiteralPath $versionMetaPath -Raw | ConvertFrom-Json
  if ($null -ne $versionMeta -and $null -ne $versionMeta.displayVersion -and [string]$versionMeta.displayVersion) {
    $pkgDisplayVersion = [string]$versionMeta.displayVersion
  }
  if ($null -ne $versionMeta -and $null -ne $versionMeta.version -and [string]$versionMeta.version) {
    $pkgVersion = [string]$versionMeta.version
  }
} catch {}

$criticalFiles = @(
  'scripts\launcher-broker.ps1',
  'scripts\launcher-tray.ps1',
  'scripts\launcher-tray-hidden.vbs',
  'scripts\create-shortcuts.ps1',
  'scripts\shortcut-op-hidden.vbs',
  'scripts\launcher-dashboard.mjs',
  'scripts\dashboard.html'
)

$critical = @()
foreach ($relative in $criticalFiles) {
  $full = Join-Path $root $relative
  $critical += [ordered]@{
    path = $relative
    exists = (Test-Path -LiteralPath $full)
    sha256 = Get-FileSha256OrEmpty $full
  }
}

$licenseRoot = if ($env:EVALUAPRO_SECURITY_ROOT) { [string]$env:EVALUAPRO_SECURITY_ROOT } else { Join-Path $env:ProgramData 'EvaluaPro\security' }
$portableLicensePath = Join-Path $licenseRoot 'portable-license.epl'
$stepUpConfigPath = Join-Path $licenseRoot 'stepup.config.json'
$stepUpSessionPath = Join-Path $licenseRoot 'stepup.session.json'
$stepUpConfig = Read-JsonFileSafe $stepUpConfigPath
$stepUpSession = Read-JsonFileSafe $stepUpSessionPath
$recoveryCodesRemaining = 0
if ($null -ne $stepUpConfig -and $null -ne $stepUpConfig.payload -and $null -ne $stepUpConfig.payload.recovery -and $null -ne $stepUpConfig.payload.recovery.codes) {
  $recoveryCodesRemaining = @($stepUpConfig.payload.recovery.codes | Where-Object { -not $_.usedAt }).Count
}
$shortcutPaths = Resolve-ShortcutTargetPaths
$payload = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  app = [ordered]@{
    name = $pkgName
    version = $pkgVersion
    displayVersion = $pkgDisplayVersion
  }
  installation = [ordered]@{
    root = $root
    flavor = 'docente-local'
    port = $Port
    installed = Test-Path -LiteralPath $packageJsonPath
    nodePresent = [bool](Get-Command node -ErrorAction SilentlyContinue)
    dockerPresent = [bool](Get-Command docker -ErrorAction SilentlyContinue)
  }
  shortcuts = Test-ShortcutPresence $shortcutPaths
  license = [ordered]@{
    portablePath = $portableLicensePath
    portableExists = (Test-Path -LiteralPath $portableLicensePath)
    stepUpConfigPath = $stepUpConfigPath
    stepUpConfigExists = (Test-Path -LiteralPath $stepUpConfigPath)
    stepUpSessionPath = $stepUpSessionPath
    stepUpSessionExists = (Test-Path -LiteralPath $stepUpSessionPath)
    stepUpMethods = if ($null -ne $stepUpConfig -and $null -ne $stepUpConfig.payload -and $null -ne $stepUpConfig.payload.methods) { @($stepUpConfig.payload.methods) } else { @() }
    recoveryCodesRemaining = $recoveryCodesRemaining
    lastStepUpAt = if ($null -ne $stepUpSession -and $null -ne $stepUpSession.payload -and $null -ne $stepUpSession.payload.lastStepUpAt) { [string]$stepUpSession.payload.lastStepUpAt } else { '' }
  }
  criticalFiles = $critical
}

[IO.File]::WriteAllText($manifestPath, ($payload | ConvertTo-Json -Depth 8), [Text.Encoding]::UTF8)
Write-Output $manifestPath
