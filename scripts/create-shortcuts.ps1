# Creates Windows shortcuts (.lnk) for EvaluaPro.
param(
  [string]$OutputDir = "accesos-directos",
  [bool]$SyncRepoOutput = $false,
  [bool]$SyncDesktop = $true,
  [bool]$SyncStartMenu = $true,
  [bool]$IncludeOpsShortcuts = $true,
  [Nullable[bool]]$IncludeDevShortcut = $null,
  [switch]$SkipManifestUpdate,
  [ValidateRange(1, 65535)]
  [int]$Port = 4519,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetWscript = Join-Path $env:WINDIR "System32\wscript.exe"
if (-not (Test-Path -LiteralPath $targetWscript)) {
  $targetWscript = 'wscript.exe'
}

$iconDir = Join-Path $root "scripts\icons"
$outputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $root $OutputDir }
$trayHiddenVbs = Join-Path $root 'scripts\launcher-tray-hidden.vbs'
$shortcutOpHiddenVbs = Join-Path $root 'scripts\shortcut-op-hidden.vbs'
foreach ($requiredFile in @($trayHiddenVbs, $shortcutOpHiddenVbs)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) {
    throw "No se encontró archivo requerido para accesos directos: $requiredFile"
  }
}

$desktopPathCandidates = New-Object System.Collections.Generic.List[string]
$overrideDesktopPath = [string]$env:EVALUAPRO_DESKTOP_PATH
if ($overrideDesktopPath) {
  $desktopPathCandidates.Add($overrideDesktopPath)
} else {
  $desktopPath = [Environment]::GetFolderPath('Desktop')
  if ($desktopPath) { $desktopPathCandidates.Add($desktopPath) }
  if ($env:USERPROFILE) {
    $userDesktop = Join-Path $env:USERPROFILE "Desktop"
    if (-not $desktopPathCandidates.Contains($userDesktop)) { $desktopPathCandidates.Add($userDesktop) }
  }
  if ($env:OneDrive) {
    $oneDriveDesktop = Join-Path $env:OneDrive "Desktop"
    if (-not $desktopPathCandidates.Contains($oneDriveDesktop)) { $desktopPathCandidates.Add($oneDriveDesktop) }
  }
}
$startMenuBase = if ($env:APPDATA) { Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs" } else { $null }
$startMenuOverride = [string]$env:EVALUAPRO_STARTMENU_PATH
$startMenuPath = if ($startMenuOverride) { $startMenuOverride } elseif ($startMenuBase) { Join-Path $startMenuBase "EvaluaPro" } else { $null }

$localIconDir = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "EvaluaPro\icons" } else { $null }

foreach ($dir in @($(if ($SyncRepoOutput) { $outputPath } else { $null }))) {
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
}

if ($SyncStartMenu -and $startMenuPath) {
  New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
}

function Resolve-FlavorId {
  $envFlavor = [string]$env:EVALUAPRO_FLAVOR_ID
  if (-not [string]::IsNullOrWhiteSpace($envFlavor)) {
    return $envFlavor.Trim().ToLowerInvariant()
  }

  $updateConfigPath = Join-Path $root 'config\update-config.json'
  try {
    if (Test-Path -LiteralPath $updateConfigPath) {
      $raw = Get-Content -LiteralPath $updateConfigPath -Raw -Encoding utf8
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $json = $raw | ConvertFrom-Json
        $cfgFlavor = [string]$json.flavorId
        if (-not [string]::IsNullOrWhiteSpace($cfgFlavor)) {
          return $cfgFlavor.Trim().ToLowerInvariant()
        }
      }
    }
  } catch {}

  return 'docente-local'
}

function Resolve-IncludeDevShortcut {
  param([Nullable[bool]]$Requested)

  if ($null -ne $Requested) {
    return [bool]$Requested
  }

  $override = [string]$env:EVALUAPRO_INCLUDE_DEV_SHORTCUT
  if (-not [string]::IsNullOrWhiteSpace($override)) {
    $normalized = $override.Trim().ToLowerInvariant()
    if (@('1', 'true', 'yes', 'on') -contains $normalized) { return $true }
    if (@('0', 'false', 'no', 'off') -contains $normalized) { return $false }
  }

  return (Resolve-FlavorId) -ne 'docente-local'
}

$includeDevShortcutEffective = Resolve-IncludeDevShortcut -Requested $IncludeDevShortcut

$iconSpecs = @(
  @{ Key = 'dev'; File = 'dashboard-dev.ico' },
  @{ Key = 'prod'; File = 'dashboard-prod.ico' },
  @{ Key = 'hub'; File = 'installer-canonical.ico' },
  @{ Key = 'open'; File = 'dashboard-open.ico' },
  @{ Key = 'restart'; File = 'dashboard-restart.ico' },
  @{ Key = 'stop'; File = 'dashboard-stop.ico' },
  @{ Key = 'uninstall'; File = 'dashboard-stop.ico' },
  @{ Key = 'repair'; File = 'dashboard-repair.ico' }
)

function Resolve-InstalledShortcutIconPath {
  param([string]$IconFileName)

  $installCandidate = Join-Path $iconDir $IconFileName
  if (Test-Path -LiteralPath $installCandidate) {
    return $installCandidate
  }

  if ($localIconDir) {
    $legacyCandidate = Join-Path $localIconDir $IconFileName
    if (Test-Path -LiteralPath $legacyCandidate) {
      return $legacyCandidate
    }
  }

  throw "No se encontró ícono requerido para shortcut: $IconFileName"
}

function Remove-LegacyShortcutIcons {
  param([object[]]$Specs)

  if (-not $localIconDir -or -not (Test-Path -LiteralPath $localIconDir)) {
    return
  }

  foreach ($spec in $Specs) {
    $legacyPaths = @(
      (Join-Path $localIconDir ([string]$spec.File)),
      (Join-Path $localIconDir ("dashboard-{0}.ico" -f [string]$spec.Key))
    ) | Select-Object -Unique

    foreach ($legacyPath in $legacyPaths) {
      try {
        if (Test-Path -LiteralPath $legacyPath) {
          Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    }
  }
}

if ($Force) {
  Remove-LegacyShortcutIcons -Specs $iconSpecs
}

$iconPathForLnk = @{}
foreach ($spec in $iconSpecs) {
  $iconPathForLnk[$spec.Key] = Resolve-InstalledShortcutIconPath -IconFileName ([string]$spec.File)
}

$shortcuts = @(
  @{
    Name = 'EvaluaPro - Dev'
    Description = 'Bandeja (tray) modo desarrollo - arranque estricto de stack + portal'
    IconKey = 'dev'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$trayHiddenVbs`" dev $Port"
  },
  @{
    Name = 'EvaluaPro - Prod'
    Description = 'Bandeja (tray) modo estable - arranque estricto de stack + portal'
    IconKey = 'prod'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$trayHiddenVbs`" prod $Port"
  },
  @{
    Name = 'EvaluaPro - Hub'
    Description = 'Installer Hub local para instalar, verificar, reparar y operar EvaluaPro'
    IconKey = 'hub'
    Desktop = $true
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" open-hub $Port auto"
  },
  @{
    Name = 'EvaluaPro - Abrir Dashboard'
    Description = 'Abre dashboard local y asegura backend de control'
    IconKey = 'open'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" open-dashboard $Port auto"
  },
  @{
    Name = 'EvaluaPro - Reiniciar Stack'
    Description = 'Reinicia stack y valida salud de servicios clave'
    IconKey = 'restart'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" restart-stack $Port auto"
  },
  @{
    Name = 'EvaluaPro - Detener Todo'
    Description = 'Solicita detener procesos activos del stack local'
    IconKey = 'stop'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" stop-all $Port auto"
  },
  @{
    Name = 'EvaluaPro - Desinstalar'
    Description = 'Inicia la desinstalación guiada de EvaluaPro'
    IconKey = 'uninstall'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" uninstall $Port auto"
  },
  @{
    Name = 'EvaluaPro - Reparar Entorno'
    Description = 'Ejecuta reparación automática y validación de salud'
    IconKey = 'repair'
    Desktop = $false
    StartMenu = $true
    Target = $targetWscript
    Arguments = "//nologo `"$shortcutOpHiddenVbs`" repair $Port auto"
  }
)

if (-not $IncludeOpsShortcuts) {
  $shortcuts = $shortcuts | Where-Object { $_.Name -in @('EvaluaPro - Dev', 'EvaluaPro - Prod', 'EvaluaPro - Hub') }
}

if (-not $includeDevShortcutEffective) {
  $shortcuts = $shortcuts | Where-Object { $_.Name -ne 'EvaluaPro - Dev' }
}

$detectedFlavorId = ''
if ($env:EVALUAPRO_FLAVOR) {
  $detectedFlavorId = [string]$env:EVALUAPRO_FLAVOR
} else {
  $updateConfigPath = Join-Path $root 'config\update-config.json'
  if (Test-Path -LiteralPath $updateConfigPath) {
    try {
      $cfg = Get-Content -LiteralPath $updateConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
      $detectedFlavorId = [string]$cfg.flavorId
    } catch {}
  }
}
$isDocenteFlavor = ($detectedFlavorId.Trim().ToLowerInvariant() -eq 'docente-local')
if ($isDocenteFlavor -and $env:EVALUAPRO_DEBUG -ne '1') {
  # REQ-030: En flavor docente-local, los accesos del menú y escritorio solo deben contener
  # la aplicación 'EvaluaPro - Prod' y el asistente 'EvaluaPro - Hub'.
  $shortcuts = $shortcuts | Where-Object { $_.Name -in @('EvaluaPro - Prod', 'EvaluaPro - Hub') }
}

$allManagedShortcutNames = @(
  'EvaluaPro - Dev',
  'EvaluaPro - Prod',
  'EvaluaPro - Hub',
  'EvaluaPro - Abrir Dashboard',
  'EvaluaPro - Reiniciar Stack',
  'EvaluaPro - Detener Todo',
  'EvaluaPro - Desinstalar',
  'EvaluaPro - Reparar Entorno'
)

$selectedShortcutNames = @($shortcuts | ForEach-Object { [string]$_.Name })

$destinations = @()
if ($SyncRepoOutput) {
  $destinations += @{ Name = 'Repo'; Path = $outputPath; Include = $true; UseDesktopFlag = $false; UseStartMenuFlag = $false }
}
if ($SyncDesktop) {
  foreach ($desktopCandidate in $desktopPathCandidates) {
    if ($desktopCandidate) {
      $destinations += @{ Name = 'Desktop'; Path = $desktopCandidate; Include = $true; UseDesktopFlag = $true; UseStartMenuFlag = $false }
    }
  }
}
if ($SyncStartMenu -and $startMenuPath) {
  $destinations += @{ Name = 'StartMenu'; Path = $startMenuPath; Include = $true; UseDesktopFlag = $false; UseStartMenuFlag = $true }
}

function Test-ShortcutShouldBeCreated($shortcut, $destination) {
  if (-not $destination.Include) { return $false }
  if (-not $destination.UseDesktopFlag -and -not $destination.UseStartMenuFlag) { return $true }
  if ($destination.UseDesktopFlag) { return [bool]$shortcut.Desktop }
  if ($destination.UseStartMenuFlag) { return [bool]$shortcut.StartMenu }
  return $false
}

function Remove-LegacyShortcuts([string]$dirPath) {
  if (-not (Test-Path $dirPath)) { return }
  $patterns = @('Sistema Evaluacion - *.lnk', 'EvaluaPro - *.lnk', 'Sistema EvaluaPro - *.lnk')
  foreach ($pattern in $patterns) {
    Get-ChildItem -Path $dirPath -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
      try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

function Remove-UnmanagedShortcuts([string]$dirPath, [string[]]$allowedNames, [string[]]$managedNames) {
  if (-not (Test-Path -LiteralPath $dirPath)) { return }

  foreach ($name in $managedNames) {
    if ($allowedNames -contains $name) {
      continue
    }

    $lnkPath = Join-Path $dirPath ($name + '.lnk')
    try {
      if (Test-Path -LiteralPath $lnkPath) {
        Remove-Item -LiteralPath $lnkPath -Force -ErrorAction SilentlyContinue
      }
    } catch {}
  }
}

$wsh = New-Object -ComObject WScript.Shell

function New-ShortcutLink([string]$dirPath, $shortcutDef) {
  if (-not (Test-Path $dirPath)) {
    New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
  }
  $lnkPath = Join-Path $dirPath ($shortcutDef.Name + '.lnk')
  $lnk = $wsh.CreateShortcut($lnkPath)
  $lnk.TargetPath = $shortcutDef.Target
  $lnk.Arguments = $shortcutDef.Arguments
  $lnk.WorkingDirectory = $root
  $lnk.Description = $shortcutDef.Description
  $lnk.IconLocation = "$($iconPathForLnk[$shortcutDef.IconKey]),0"
  $lnk.Save()
}

if ($Force) {
  foreach ($dest in $destinations) {
    Remove-LegacyShortcuts -dirPath $dest.Path
  }
}

if ($startMenuBase -and (Test-Path -LiteralPath $startMenuBase)) {
  Remove-UnmanagedShortcuts -dirPath $startMenuBase -allowedNames @() -managedNames $allManagedShortcutNames
}

foreach ($dest in $destinations) {
  Remove-UnmanagedShortcuts -dirPath $dest.Path -allowedNames $selectedShortcutNames -managedNames $allManagedShortcutNames
  foreach ($shortcutDef in $shortcuts) {
    if (Test-ShortcutShouldBeCreated -shortcut $shortcutDef -destination $dest) {
      New-ShortcutLink -dirPath $dest.Path -shortcutDef $shortcutDef
    }
  }
}

Write-Host "Accesos directos regenerados:"
foreach ($dest in $destinations) {
  Write-Host " - $($dest.Name): $($dest.Path)"
}

if (-not $SkipManifestUpdate) {
  $manifestScript = Join-Path $root 'scripts\generate-installation-manifest.ps1'
  if (Test-Path -LiteralPath $manifestScript) {
    try {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $manifestScript -Port $Port | Out-Null
    } catch {
      Write-Warning "No se pudo actualizar installation.manifest.json: $($_.Exception.Message)"
    }
  }
}

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class EvaluaProShellNotify {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@ -ErrorAction SilentlyContinue | Out-Null
  [EvaluaProShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}
