Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NodeMajorVersion {
  try {
    $raw = (& node -v 2>$null | Select-Object -First 1)
    if (-not $raw) { return 0 }
    $clean = [string]$raw
    $clean = $clean.Trim().TrimStart('v', 'V')
    $major = [int]($clean.Split('.')[0])
    if ($major -lt 0) { return 0 }
    return $major
  } catch {
    return 0
  }
}

function Test-DockerDesktopInstalled {
  $registryPaths = @(
    'HKLM:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop',
    'HKCU:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop'
  )

  foreach ($path in $registryPaths) {
    if (Test-Path $path) {
      return $true
    }
  }

  try {
    $dockerVersion = (& docker version --format '{{.Client.Version}}' 2>$null | Select-Object -First 1)
    if ($dockerVersion) { return $true }
  } catch {}

  return $false
}

function Get-EvaluaProInstallationInfo {
  $roots = @(
    'HKLM:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )

  foreach ($root in $roots) {
    $items = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
      Where-Object {
        $_.PSObject.Properties.Match('DisplayName').Count -gt 0 -and
        [string]$_.DisplayName -like 'EvaluaPro*'
      }

    foreach ($item in $items) {
      $uninstallString = [string]$item.UninstallString
      $productCode = ''
      if ($uninstallString -match '(\{[A-Fa-f0-9\-]{36}\})') {
        $productCode = $Matches[1]
      }

      return [pscustomobject]@{
        Installed = $true
        DisplayName = [string]$item.DisplayName
        DisplayVersion = [string]$item.DisplayVersion
        InstallLocation = [string]$item.InstallLocation
        ProductCode = $productCode
        UninstallString = $uninstallString
      }
    }
  }

  return [pscustomobject]@{
    Installed = $false
    DisplayName = ''
    DisplayVersion = ''
    InstallLocation = ''
    ProductCode = ''
    UninstallString = ''
  }
}

function Get-EvaluaProInstallationHealth {
  param([string]$InstallDir = '')

  $allowUnregistered = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_ALLOW_UNREGISTERED).Trim().ToLowerInvariant()

  $info = Get-EvaluaProInstallationInfo
  $effectiveDir = if ($InstallDir) { $InstallDir } elseif ($info.InstallLocation) { [string]$info.InstallLocation } else { '' }
  if (-not $info.Installed -and -not $effectiveDir) {
    return [pscustomobject]@{
      state = 'ausente'
      issues = @('No hay instalacion registrada.')
      installDir = ''
    }
  }

  if (-not $effectiveDir) {
    return [pscustomobject]@{
      state = 'incompleta'
      issues = @('Existe registro de instalacion pero sin ruta valida.')
      installDir = ''
    }
  }

  $issues = @()
  $required = @(
    (Join-Path $effectiveDir 'package.json'),
    (Join-Path $effectiveDir 'scripts\launcher-broker.ps1'),
    (Join-Path $effectiveDir 'scripts\launcher-tray-hidden.vbs'),
    (Join-Path $effectiveDir 'scripts\installer-hub\InstallerHub.ps1'),
    (Join-Path $effectiveDir 'logs\installation.manifest.json')
  )
  foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
      $issues += "Falta archivo crítico: $file"
    }
  }

  if (-not $info.Installed -and -not $allowUnregistered) {
    return [pscustomobject]@{
      state = if ($issues.Count -gt 0) { 'dañada' } else { 'degradada' }
      issues = @('La ruta parece contener EvaluaPro, pero no existe registro MSI.') + $issues
      installDir = $effectiveDir
    }
  }

  $state = if ($issues.Count -eq 0) { 'ok' } elseif ($issues.Count -le 2) { 'degradada' } else { 'dañada' }
  return [pscustomobject]@{
    state = $state
    issues = $issues
    installDir = $effectiveDir
  }
}

function Resolve-InstallerMode {
  param(
    [ValidateSet('auto', 'install', 'repair', 'uninstall')]
    [string]$RequestedMode,
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Installation
  )

  if ($RequestedMode -ne 'auto') {
    return $RequestedMode
  }

  if ($Installation.Installed) {
    return 'repair'
  }

  return 'install'
}

function Get-SystemRequirementReport {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallPath,
    [int]$MinDiskGb = 6,
    [bool]$InternetOk = $false
  )

  $os = Get-CimInstance -ClassName Win32_OperatingSystem
  $osVersion = [Version]::new(($os.Version.Split('.') | Select-Object -First 4) -join '.')
  $isWindows10Plus = $osVersion.Major -ge 10
  $is64 = [Environment]::Is64BitOperatingSystem

  $targetRoot = [System.IO.Path]::GetPathRoot($InstallPath)
  if (-not $targetRoot) {
    $targetRoot = [System.IO.Path]::GetPathRoot($env:SystemDrive)
  }

  $drive = Get-PSDrive -Name ($targetRoot.TrimEnd('\\').TrimEnd(':')) -ErrorAction SilentlyContinue
  $freeBytes = if ($drive) { [double]$drive.Free } else { 0 }
  $freeGb = [math]::Round(($freeBytes / 1GB), 2)
  $diskOk = $freeGb -ge $MinDiskGb

  $nodeMajor = Get-NodeMajorVersion
  $dockerOk = Test-DockerDesktopInstalled

  $issues = @()
  if (-not $isWindows10Plus) { $issues += 'Se requiere Windows 10/11 o superior.' }
  if (-not $is64) { $issues += 'Se requiere arquitectura x64.' }
  if (-not $diskOk) { $issues += "Espacio insuficiente en $targetRoot (libre: ${freeGb}GB, minimo: ${MinDiskGb}GB)." }
  if (-not $InternetOk) { $issues += 'No se detecta conectividad a Internet.' }

  return [pscustomobject]@{
    OsCaption = [string]$os.Caption
    OsVersion = [string]$os.Version
    IsWindows10Plus = $isWindows10Plus
    Is64Bit = $is64
    DiskFreeGb = $freeGb
    DiskOk = $diskOk
    InternetOk = $InternetOk
    NodeMajor = $nodeMajor
    DockerOk = $dockerOk
    Issues = $issues
    IsReadyForFlow = ($issues.Count -eq 0)
  }
}

function Read-PrereqManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
  )

  if (-not (Test-Path $ManifestPath)) {
    throw "No existe manifiesto de prerequisitos: $ManifestPath"
  }

  $raw = Get-Content -Path $ManifestPath -Raw
  $json = $raw | ConvertFrom-Json
  $list = @($json.prerequisites)
  $profiles = @($json.profiles)

  if ($list.Count -eq 0) {
    throw 'El manifiesto de prerequisitos esta vacio.'
  }

  return [pscustomobject]@{
    version = [string]$json.version
    defaultProfile = if ($null -ne $json.defaultProfile) { [string]$json.defaultProfile } else { '' }
    profiles = $profiles
    prerequisites = $list
  }
}

function Resolve-PrereqProfile {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Manifest,
    [string]$ProfileId = ''
  )

  $effectiveProfileId = [string]$ProfileId
  if ([string]::IsNullOrWhiteSpace($effectiveProfileId)) {
    $effectiveProfileId = if ($null -ne $Manifest.defaultProfile) { [string]$Manifest.defaultProfile } else { '' }
  }

  if ([string]::IsNullOrWhiteSpace($effectiveProfileId)) {
    return $Manifest
  }

  $profile = @($Manifest.profiles | Where-Object { [string]$_.profileId -eq $effectiveProfileId } | Select-Object -First 1)
  if ($profile.Count -eq 0) {
    throw "Perfil de prerequisitos no soportado: $effectiveProfileId"
  }

  $names = @($profile[0].prerequisites)
  $selected = @($Manifest.prerequisites | Where-Object { $names -contains [string]$_.name })
  if ($selected.Count -eq 0) {
    throw "Perfil $effectiveProfileId no resolvio prerequisitos."
  }

  return [pscustomobject]@{
    version = [string]$Manifest.version
    defaultProfile = $effectiveProfileId
    profiles = @($profile[0])
    prerequisites = $selected
  }
}

function Test-PrerequisiteStatus {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite
  )

  $rule = $Prerequisite.detectRule
  $type = [string]$rule.type

  switch ($type) {
    'node_major' {
      $actual = Get-NodeMajorVersion
      $required = [int]$rule.minMajor
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = ($actual -ge $required)
        actualVersion = if ($actual -gt 0) { "${actual}.x" } else { '' }
        reason = if ($actual -ge $required) { 'ok' } else { "Node detectado: ${actual}.x. Requerido: ${required}.x" }
      }
    }
    'docker_desktop' {
      $ok = Test-DockerDesktopInstalled
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = $ok
        actualVersion = ''
        reason = if ($ok) { 'ok' } else { 'Docker Desktop no detectado o no responde.' }
      }
    }
    default {
      throw "detectRule.type no soportado: $type"
    }
  }
}

Export-ModuleMember -Function @(
  'Get-NodeMajorVersion',
  'Test-DockerDesktopInstalled',
  'Get-EvaluaProInstallationInfo',
  'Get-EvaluaProInstallationHealth',
  'Resolve-InstallerMode',
  'Get-SystemRequirementReport',
  'Read-PrereqManifest',
  'Resolve-PrereqProfile',
  'Test-PrerequisiteStatus'
)
