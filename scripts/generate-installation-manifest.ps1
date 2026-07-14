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

function Resolve-FlavorId {
  $envFlavor = [string]$env:EVALUAPRO_FLAVOR_ID
  if (-not [string]::IsNullOrWhiteSpace($envFlavor)) {
    return $envFlavor.Trim().ToLowerInvariant()
  }

  $updateConfigPath = Join-Path $configDir 'update-config.json'
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

function Resolve-ShortcutTargetPaths {
  $flavorId = Resolve-FlavorId
  $includeDevShortcut = $flavorId -ne 'docente-local'
  $desktop = if ($env:EVALUAPRO_DESKTOP_PATH) { [string]$env:EVALUAPRO_DESKTOP_PATH } else { [Environment]::GetFolderPath('Desktop') }
  $startMenuBase = if ($env:EVALUAPRO_STARTMENU_PATH) { [string]$env:EVALUAPRO_STARTMENU_PATH } elseif ($env:APPDATA) { Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro' } else { '' }
  $targets = [ordered]@{
    prodDesktop = if ($desktop) { Join-Path $desktop 'EvaluaPro - Prod.lnk' } else { '' }
    hubDesktop = if ($desktop) { Join-Path $desktop 'EvaluaPro - Hub.lnk' } else { '' }
    prodStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Prod.lnk' } else { '' }
    hubStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Hub.lnk' } else { '' }
    uninstallStart = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Desinstalar.lnk' } else { '' }
  }

  if ($includeDevShortcut) {
    $targets['devDesktop'] = if ($desktop) { Join-Path $desktop 'EvaluaPro - Dev.lnk' } else { '' }
    $targets['devStart'] = if ($startMenuBase) { Join-Path $startMenuBase 'EvaluaPro - Dev.lnk' } else { '' }
  }

  return $targets
}

function Resolve-WscriptExecutablePath {
  $candidates = @(
    (Join-Path $env:WINDIR 'System32\wscript.exe'),
    (Join-Path $env:WINDIR 'SysWOW64\wscript.exe'),
    'wscript.exe'
  )

  foreach ($candidate in $candidates) {
    try {
      if ([System.IO.Path]::IsPathRooted($candidate)) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      } else {
        $resolved = (Get-Command $candidate -ErrorAction Stop).Source
        if ($resolved) { return [string]$resolved }
      }
    } catch {}
  }

  return 'wscript.exe'
}

function Resolve-ShortcutIconPath {
  param([string]$IconFileName)

  $installCandidate = Join-Path $root ("scripts\icons\{0}" -f $IconFileName)
  if (Test-Path -LiteralPath $installCandidate) {
    return $installCandidate
  }

  $localIconDir = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'EvaluaPro\icons' } else { '' }
  if ($localIconDir) {
    $localCandidate = Join-Path $localIconDir $IconFileName
    if (Test-Path -LiteralPath $localCandidate) {
      return $localCandidate
    }
  }

  return $installCandidate
}

function Get-ShortcutDefinition {
  param([string]$Name)

  $wscriptPath = Resolve-WscriptExecutablePath
  $trayHiddenVbs = Join-Path $root 'scripts\launcher-tray-hidden.vbs'
  $shortcutOpHiddenVbs = Join-Path $root 'scripts\shortcut-op-hidden.vbs'
  switch ($Name) {
    'EvaluaPro - Dev' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$trayHiddenVbs`" dev 4519"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-dev.ico'
      }
    }
    'EvaluaPro - Prod' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$trayHiddenVbs`" prod 4519"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-prod.ico'
      }
    }
    'EvaluaPro - Hub' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" open-hub 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'installer-canonical.ico'
      }
    }
    'EvaluaPro - Abrir Dashboard' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" open-dashboard 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-open.ico'
      }
    }
    'EvaluaPro - Reiniciar Stack' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" restart-stack 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-restart.ico'
      }
    }
    'EvaluaPro - Detener Todo' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" stop-all 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-stop.ico'
      }
    }
    'EvaluaPro - Desinstalar' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" uninstall 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-stop.ico'
      }
    }
    'EvaluaPro - Reparar Entorno' {
      return [ordered]@{
        name = $Name
        targetPath = $wscriptPath
        arguments = "//nologo `"$shortcutOpHiddenVbs`" repair 4519 auto"
        iconLocation = Resolve-ShortcutIconPath 'dashboard-repair.ico'
      }
    }
    default {
      return $null
    }
  }
}

function Read-ShortcutLinkMetadata {
  param([string]$Path)

  $metadata = [ordered]@{
    readOk = $false
    targetPath = ''
    arguments = ''
    workingDirectory = ''
    iconLocation = ''
    description = ''
    error = ''
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    return $metadata
  }

  try {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($Path)
    $metadata.readOk = $true
    $metadata.targetPath = [string]$shortcut.TargetPath
    $metadata.arguments = [string]$shortcut.Arguments
    $metadata.workingDirectory = [string]$shortcut.WorkingDirectory
    $metadata.iconLocation = [string]$shortcut.IconLocation
    $metadata.description = [string]$shortcut.Description
  } catch {
    $metadata.error = [string]$_.Exception.Message
  }

  return $metadata
}

function New-ShortcutManifestEntry {
  param(
    [string]$Name,
    [string]$Path,
    [bool]$ExpectedIncluded
  )

  $definition = Get-ShortcutDefinition -Name $Name
  $actual = Read-ShortcutLinkMetadata -Path $Path
  return [ordered]@{
    name = $Name
    path = $Path
    exists = [bool](Test-Path -LiteralPath $Path)
    expectedIncluded = $ExpectedIncluded
    expectedTargetPath = [string]$definition.targetPath
    expectedArguments = [string]$definition.arguments
    expectedIconLocation = [string]$definition.iconLocation
    targetPath = [string]$actual.targetPath
    arguments = [string]$actual.arguments
    workingDirectory = [string]$actual.workingDirectory
    iconLocation = [string]$actual.iconLocation
    description = [string]$actual.description
    readOk = [bool]$actual.readOk
    readError = [string]$actual.error
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

function Get-EmbeddedNodePath([string]$baseDir) {
  if (-not $baseDir) { return '' }
  return (Join-Path $baseDir 'runtime\node\node.exe')
}

function Get-EmbeddedNodeVersion([string]$baseDir) {
  $nodePath = Get-EmbeddedNodePath -baseDir $baseDir
  if (-not (Test-Path -LiteralPath $nodePath)) { return '' }
  try {
    return [string]((& $nodePath -v 2>$null | Select-Object -First 1))
  } catch {
    return ''
  }
}

function Get-WslPreferredDistro {
  $envDistro = [string]$env:EVALUAPRO_INSTALLER_WSL_DISTRO
  if (-not [string]::IsNullOrWhiteSpace($envDistro)) {
    return $envDistro.Trim()
  }
  return 'Ubuntu'
}

function Get-WslNodeVersion([string]$distro) {
  if (-not $distro) { return '' }
  try {
    return [string]((& wsl.exe -d $distro -- sh -lc 'node -v' 2>$null | Select-Object -First 1))
  } catch {
    return ''
  }
}

function Test-WslDockerReady([string]$distro) {
  if (-not $distro) { return $false }
  try {
    $raw = [string]((& wsl.exe -d $distro -- sh -lc 'docker version --format "{{.Server.Version}}"' 2>$null | Select-Object -First 1))
    return -not [string]::IsNullOrWhiteSpace($raw)
  } catch {
    return $false
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
$embeddedNodePath = Get-EmbeddedNodePath -baseDir $root
$embeddedNodeVersion = Get-EmbeddedNodeVersion -baseDir $root
$flavorId = Resolve-FlavorId
$requiresDockerRuntime = ($flavorId -ne 'docente-local')
$wslDistro = Get-WslPreferredDistro
$wslNodeVersion = if ($requiresDockerRuntime) { Get-WslNodeVersion -distro $wslDistro } else { '' }
$wslDockerReady = if ($requiresDockerRuntime) { Test-WslDockerReady -distro $wslDistro } else { $false }
$payload = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  app = [ordered]@{
    name = $pkgName
    version = $pkgVersion
    displayVersion = $pkgDisplayVersion
  }
  installation = [ordered]@{
    root = $root
    flavor = $flavorId
    requireLocalPortal = $false
    requireDockerRuntime = [bool]$requiresDockerRuntime
    runtimeTarget = if ($requiresDockerRuntime) { 'docker-compatible' } else { 'native-node-sqlite' }
    dockerImages = if ($requiresDockerRuntime) {
      [ordered]@{
        apiDocente = if ($env:EVALUAPRO_API_DOCENTE_IMAGE) { [string]$env:EVALUAPRO_API_DOCENTE_IMAGE } else { 'ghcr.io/dtcsrni/evaluapro_sistema_universitario/evaluapro-api-docente:1.1.1' }
        webDocente = if ($env:EVALUAPRO_WEB_DOCENTE_IMAGE) { [string]$env:EVALUAPRO_WEB_DOCENTE_IMAGE } else { 'ghcr.io/dtcsrni/evaluapro_sistema_universitario/evaluapro-web-docente:1.1.1' }
        mongo = 'mongo:8.0.23'
      }
    } else { [ordered]@{} }
    port = $Port
    installed = Test-Path -LiteralPath $packageJsonPath
    nodePresent = [bool](Get-Command node -ErrorAction SilentlyContinue)
    dockerPresent = [bool](Get-Command docker -ErrorAction SilentlyContinue)
  }
  runtime = [ordered]@{
    embeddedNode = [ordered]@{
      present = (Test-Path -LiteralPath $embeddedNodePath)
      path = $embeddedNodePath
      version = $embeddedNodeVersion
    }
    wsl = [ordered]@{
      distro = $wslDistro
      nodeVersion = $wslNodeVersion
      dockerReady = [bool]$wslDockerReady
    }
  }
  shortcuts = [ordered]@{}
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

$shortcutDefinitions = @(
  @{ Name = 'EvaluaPro - Prod'; Key = 'prodDesktop' },
  @{ Name = 'EvaluaPro - Hub'; Key = 'hubDesktop' },
  @{ Name = 'EvaluaPro - Prod'; Key = 'prodStart' },
  @{ Name = 'EvaluaPro - Hub'; Key = 'hubStart' },
  @{ Name = 'EvaluaPro - Desinstalar'; Key = 'uninstallStart' }
)

if (($shortcutPaths.Keys -contains 'devDesktop') -or ($shortcutPaths.Keys -contains 'devStart')) {
  $shortcutDefinitions += @(
    @{ Name = 'EvaluaPro - Dev'; Key = 'devDesktop' },
    @{ Name = 'EvaluaPro - Dev'; Key = 'devStart' }
  )
}

foreach ($entry in $shortcutDefinitions) {
  $name = [string]$entry.Name
  $key = [string]$entry.Key
  $path = [string]$shortcutPaths[$key]
  $includeDev = ($shortcutPaths.Keys -contains 'devDesktop') -or ($shortcutPaths.Keys -contains 'devStart')
  $expectedIncluded = $key -notin @('devDesktop', 'devStart') -or $includeDev
  $payload.shortcuts[$key] = New-ShortcutManifestEntry -Name $name -Path $path -ExpectedIncluded $expectedIncluded
}

[IO.File]::WriteAllText($manifestPath, ($payload | ConvertTo-Json -Depth 8), [Text.Encoding]::UTF8)
Write-Output $manifestPath
