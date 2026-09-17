# Creates Windows shortcuts (.lnk) for EvaluaPro.
param(
  [string]$OutputDir = "accesos-directos",
  [bool]$SyncRepoOutput = $false,
  [bool]$SyncDesktop = $true,
  [bool]$SyncStartMenu = $true,
  [bool]$IncludeOpsShortcuts = $true,
  [Nullable[bool]]$IncludeDevShortcut = $null,
  [switch]$AllowLegacyLauncherFallback,
  [switch]$SkipManifestUpdate,
  [ValidateRange(1, 65535)]
  [int]$Port = 4519,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$canonicalRoot = if ($env:LOCALAPPDATA) {
  [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'EvaluaPro')).TrimEnd('\')
} else { $null }
$normalizedRoot = [System.IO.Path]::GetFullPath($root).TrimEnd('\')
$isPackageStagingCopy = $normalizedRoot -match '\\AppData\\Local\\Packages\\[^\\]+\\LocalCache\\Local\\EvaluaPro$'
if ($isPackageStagingCopy -and $canonicalRoot -and
    -not [string]::Equals($normalizedRoot, $canonicalRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
    (Test-Path -LiteralPath (Join-Path $canonicalRoot 'config\shortcuts-manifest.json'))) {
  throw "Se rechazó la reconciliación desde una copia de staging de Codex. Use la instalación canónica: $canonicalRoot"
}

$shortcutManifestPath = Join-Path $root 'config\shortcuts-manifest.json'
if (-not (Test-Path -LiteralPath $shortcutManifestPath)) {
  throw "No se encontró el manifiesto canónico de accesos directos: $shortcutManifestPath"
}
$shortcutManifest = Get-Content -LiteralPath $shortcutManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
$manifestIconRoot = [string]$shortcutManifest.iconRoot
if ([string]::IsNullOrWhiteSpace($manifestIconRoot)) {
  throw "El manifiesto canónico no define iconRoot: $shortcutManifestPath"
}
$iconDir = Join-Path $root ($manifestIconRoot -replace '/', '\')
$targetWscript = Join-Path $env:WINDIR "System32\wscript.exe"
if (-not (Test-Path -LiteralPath $targetWscript)) {
  $targetWscript = 'wscript.exe'
}

$outputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $root $OutputDir }
$trayHiddenVbs = Join-Path $root 'scripts\launcher-tray-hidden.vbs'
$shortcutOpHiddenVbs = Join-Path $root 'scripts\shortcut-op-hidden.vbs'

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

$iconSpecs = @($shortcutManifest.shortcuts | ForEach-Object {
  [pscustomobject]@{ Key = [string]$_.name; File = [string]$_.icon }
} | Sort-Object File -Unique)

function Resolve-InstalledShortcutIconPath {
  param([string]$IconFileName)

  $installCandidate = Join-Path $iconDir $IconFileName
  if (Test-Path -LiteralPath $installCandidate) {
    return $installCandidate
  }

  throw "No se encontró ícono canónico requerido para shortcut: $installCandidate"
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
  $iconPathForLnk[[string]$spec.File] = Resolve-InstalledShortcutIconPath -IconFileName ([string]$spec.File)
}

$nativeAppHostExe = Join-Path $root 'EvaluaPro.exe'
if (-not (Test-Path -LiteralPath $nativeAppHostExe)) {
  $candidateHost = Join-Path $root 'packaging\app-host\bin\Release\net8.0-windows\win-x64\EvaluaPro.exe'
  if (Test-Path -LiteralPath $candidateHost) {
    $nativeAppHostExe = $candidateHost
  }
}
$isNativeHostAvailable = (Test-Path -LiteralPath $nativeAppHostExe)
if (-not $isNativeHostAvailable -and -not $AllowLegacyLauncherFallback) {
  throw "Payload incompleto: no existe EvaluaPro.exe en $root. No se creará un acceso principal que dependa de un script externo."
}

function Test-ManifestFlavorMatch($definition, [string]$flavorId) {
  $flavors = @()
  $excluded = @()
  if ($definition.PSObject.Properties.Name -contains 'flavors') {
    $flavors = @($definition.flavors | ForEach-Object { [string]$_ })
  }
  if ($definition.PSObject.Properties.Name -contains 'excludeFlavors') {
    $excluded = @($definition.excludeFlavors | ForEach-Object { [string]$_ })
  }
  if ($excluded -contains $flavorId) { return $false }
  return $flavors.Count -eq 0 -or $flavors -contains '*' -or $flavors -contains $flavorId
}

function New-ShortcutDefinition($definition, [string]$flavorId) {
  if (-not (Test-ManifestFlavorMatch -definition $definition -flavorId $flavorId)) { return $null }
  $launcher = [string]$definition.launcher
  $target = $null
  $arguments = ''
  switch ($launcher) {
    'native' {
      if ($isNativeHostAvailable) {
        $target = $nativeAppHostExe
      } elseif ($AllowLegacyLauncherFallback) {
        if (-not (Test-Path -LiteralPath $trayHiddenVbs)) { throw "No se encontró launcher requerido: $trayHiddenVbs" }
        $target = $targetWscript
        $arguments = "//nologo `"$trayHiddenVbs`" prod $Port"
      } else {
        return $null
      }
    }
    'tray' {
      $target = $targetWscript
      if (-not (Test-Path -LiteralPath $trayHiddenVbs)) { throw "No se encontró launcher requerido: $trayHiddenVbs" }
      $arguments = "//nologo `"$trayHiddenVbs`" $([string]$definition.mode) $Port"
    }
    'operation' {
      $target = $targetWscript
      if (-not (Test-Path -LiteralPath $shortcutOpHiddenVbs)) { throw "No se encontró launcher requerido: $shortcutOpHiddenVbs" }
      $arguments = "//nologo `"$shortcutOpHiddenVbs`" $([string]$definition.operation) $Port auto"
    }
    default { throw "Launcher no soportado en manifiesto: $launcher" }
  }

  return @{
    Name = [string]$definition.name
    Description = [string]$definition.description
    IconFile = [string]$definition.icon
    Desktop = [bool]$definition.desktop
    StartMenu = [bool]$definition.startMenu
    Target = $target
    Arguments = $arguments
  }
}

$detectedFlavorId = (Resolve-FlavorId).Trim().ToLowerInvariant()
$shortcuts = @($shortcutManifest.shortcuts | ForEach-Object {
  New-ShortcutDefinition -definition $_ -flavorId $detectedFlavorId
} | Where-Object { $null -ne $_ })

if (-not $IncludeOpsShortcuts) {
  $shortcuts = $shortcuts | Where-Object { $_.Name -in @('EvaluaPro', 'EvaluaPro - Hub') }
}

if (-not $includeDevShortcutEffective) {
  $shortcuts = $shortcuts | Where-Object { $_.Name -ne 'EvaluaPro - Dev' }
}

$isDocenteFlavor = ($detectedFlavorId -eq 'docente-local')
if ($isDocenteFlavor -and $env:EVALUAPRO_DEBUG -ne '1') {
  # REQ-030: En flavor docente-local, los accesos del menú y escritorio solo deben contener
  # la aplicación 'EvaluaPro' y el asistente 'EvaluaPro - Hub'.
  $shortcuts = $shortcuts | Where-Object { $_.Name -in @('EvaluaPro', 'EvaluaPro - Hub') }
}

$allManagedShortcutNames = @(
  @($shortcutManifest.shortcuts | ForEach-Object { [string]$_.name }),
  @($shortcutManifest.legacyShortcutNames | ForEach-Object { [string]$_ })
) | Where-Object { $_ } | Sort-Object -Unique

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
  # Windows Start/Recomendaciones resuelve de forma más estable el icono del
  # acceso principal desde el host nativo que desde un .ico externo.
  $shortcutIconPath = $iconPathForLnk[[string]$shortcutDef.IconFile]
  if (-not $shortcutIconPath) {
    throw "No se resolvió icono canónico para $($shortcutDef.Name): $($shortcutDef.IconFile)"
  }
  if ($shortcutDef.Name -eq 'EvaluaPro' -and $isNativeHostAvailable) {
    $shortcutIconPath = $nativeAppHostExe
  }
  $lnk.IconLocation = "$shortcutIconPath,0"
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

function Get-ShortcutIconPath([string]$iconLocation) {
  if ([string]::IsNullOrWhiteSpace($iconLocation)) { return '' }
  return ([string]$iconLocation -replace ',\s*-?\d+\s*$', '').Trim().Trim('"')
}

function Get-ShortcutScriptDependency([string]$arguments) {
  if ([string]::IsNullOrWhiteSpace($arguments)) { return '' }
  $match = [Regex]::Match($arguments, '"([^"]+\.(?:vbs|ps1))"', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success) { return $match.Groups[1].Value }
  return ''
}

$reconciliationEntries = @()
$reconciliationErrors = @()
foreach ($dest in $destinations) {
  foreach ($shortcutDef in $shortcuts) {
    if (-not (Test-ShortcutShouldBeCreated -shortcut $shortcutDef -destination $dest)) { continue }

    $lnkPath = Join-Path $dest.Path ($shortcutDef.Name + '.lnk')
    $entryErrors = @()
    $targetPath = ''
    $arguments = ''
    $iconLocation = ''
    $readOk = $false
    try {
      if (-not (Test-Path -LiteralPath $lnkPath)) {
        $entryErrors += "No existe el acceso: $lnkPath"
      } else {
        $shortcut = $wsh.CreateShortcut($lnkPath)
        $targetPath = [string]$shortcut.TargetPath
        $arguments = [string]$shortcut.Arguments
        $iconLocation = [string]$shortcut.IconLocation
        $readOk = $true
        if (-not (Test-Path -LiteralPath $targetPath)) {
          $entryErrors += "El destino no existe: $targetPath"
        }
        $dependency = Get-ShortcutScriptDependency -arguments $arguments
        if ($dependency -and -not (Test-Path -LiteralPath $dependency)) {
          $entryErrors += "La dependencia del launcher no existe: $dependency"
        }
        $iconPath = Get-ShortcutIconPath -iconLocation $iconLocation
        if (-not (Test-Path -LiteralPath $iconPath)) {
          $entryErrors += "El icono no existe: $iconPath"
        }
        if (([string]$shortcutDef.Target).Trim() -ne $targetPath.Trim()) {
          $entryErrors += "Destino inesperado; esperado '$($shortcutDef.Target)', actual '$targetPath'"
        }
      }
    } catch {
      $entryErrors += "No se pudo leer el acceso: $($_.Exception.Message)"
    }

    $entry = [ordered]@{
      destination = [string]$dest.Name
      path = $lnkPath
      name = [string]$shortcutDef.Name
      expectedTarget = [string]$shortcutDef.Target
      actualTarget = $targetPath
      arguments = $arguments
      iconLocation = $iconLocation
      readOk = $readOk
      valid = ($entryErrors.Count -eq 0)
      errors = @($entryErrors)
    }
    $reconciliationEntries += $entry
    if ($entryErrors.Count -gt 0) {
      $reconciliationErrors += $entryErrors
    }
  }
}

$reportDir = Join-Path $root 'logs'
if (-not (Test-Path -LiteralPath $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}
$reconciliationReport = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToString('o')
  root = $root
  flavorId = $detectedFlavorId
  manifest = $shortcutManifestPath
  state = if ($reconciliationErrors.Count -eq 0) { 'ok' } else { 'error' }
  entries = @($reconciliationEntries)
  errors = @($reconciliationErrors)
}
$reconciliationPath = Join-Path $reportDir 'shortcut-reconciliation.json'
$reconciliationReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reconciliationPath -Encoding utf8
if ($reconciliationErrors.Count -gt 0) {
  throw "La reconciliación de accesos directos falló. Consulta $reconciliationPath"
}

Write-Host "Accesos directos regenerados:"
foreach ($dest in $destinations) {
  Write-Host " - $($dest.Name): $($dest.Path)"
}
Write-Host " - Validación: OK ($reconciliationPath)"

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
