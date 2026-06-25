# Hybrid helper for the Burn-based EvaluaPro installer.
# Detects prerequisites and executes post-install operational configuration,
# verification and local license hardening under a JSON contract.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('detect-prereqs', 'post-install')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$RequestPath,
  [Parameter(Mandatory = $true)]
  [string]$ResponsePath
)

function Write-BootstrapFatalHelperResponse {
  param(
    [string]$TargetPath,
    [string]$Phase,
    [int]$ExitCode,
    [string]$Message
  )

  try {
    $dir = Split-Path -Parent $TargetPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $payload = [ordered]@{
      ok = $false
      phase = $Phase
      exitCode = $ExitCode
      message = $Message
      artifacts = @{}
      warnings = @()
      logs = @(
        [ordered]@{
          timestamp = (Get-Date).ToString('o')
          level = 'error'
          message = $Message
        }
      )
      data = $null
    }
    $json = $payload | ConvertTo-Json -Depth 16
    [IO.File]::WriteAllText($TargetPath, $json + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
  } catch {
    # Evitar errores silenciosos incluso si no se puede escribir el JSON.
    Write-Error ("No se pudo escribir respuesta fatal del helper: {0}" -f $_.Exception.Message)
  }
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$modulesRoot = Join-Path (Join-Path (Join-Path $repoRoot 'scripts') 'installer-burn') 'modules'
$configRoot = Join-Path $repoRoot 'config'
if (-not (Test-Path -LiteralPath $modulesRoot)) {
  $repoRoot = $PSScriptRoot
  $modulesRoot = $PSScriptRoot
}
if (-not (Test-Path -LiteralPath $configRoot)) {
  $configRoot = $PSScriptRoot
}
if (-not $env:EVALUAPRO_PORTABLE_LICENSE_SCRIPT) {
  $flatPortableLicense = Join-Path $PSScriptRoot 'portable-license.mjs'
  if (Test-Path -LiteralPath $flatPortableLicense) {
    $env:EVALUAPRO_PORTABLE_LICENSE_SCRIPT = $flatPortableLicense
  }
}

try {
  Import-Module (Join-Path $modulesRoot 'Common.psm1') -DisableNameChecking
  Import-Module (Join-Path $modulesRoot 'PrereqDetector.psm1') -DisableNameChecking
  Import-Module (Join-Path $modulesRoot 'PrereqInstaller.psm1') -DisableNameChecking
  Import-Module (Join-Path $modulesRoot 'OperationalConfig.psm1') -DisableNameChecking
  Import-Module (Join-Path $modulesRoot 'PostInstallVerifier.psm1') -DisableNameChecking
  Import-Module (Join-Path $modulesRoot 'LicenseClientSecurity.psm1') -DisableNameChecking
} catch {
  $msg = "No se pudieron cargar modulos requeridos del helper Burn: $($_.Exception.Message)"
  Write-BootstrapFatalHelperResponse -TargetPath $ResponsePath -Phase 'helper_init' -ExitCode 50 -Message $msg
  exit 50
}

$script:helperLogs = New-Object System.Collections.Generic.List[object]
$script:helperWarnings = New-Object System.Collections.Generic.List[string]
$script:helperArtifacts = [ordered]@{}
$script:helperProgressPrefix = 'EVALUAPRO_PROGRESS:'

function Add-HelperLog {
  param(
    [string]$Level,
    [string]$Message
  )

  $entry = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    level = $Level
    message = $Message
  }
  $script:helperLogs.Add([pscustomobject]$entry)
}

function Write-HelperProgress {
  param(
    [string]$Activity,
    [int]$Percent,
    [string]$Status,
    [hashtable]$Meta
  )

  $payload = [ordered]@{
    activity = $Activity
    percent = [Math]::Min(100, [Math]::Max(0, $Percent))
    status = $Status
    meta = if ($Meta) { $Meta } else { @{} }
  }
  [Console]::Out.WriteLine($script:helperProgressPrefix + ($payload | ConvertTo-Json -Depth 8 -Compress))
}

function ConvertTo-HashtableDeep {
  param([object]$InputObject)

  if ($null -eq $InputObject) {
    return @{}
  }

  if ($InputObject -is [hashtable]) {
    $copy = @{}
    foreach ($key in $InputObject.Keys) {
      $copy[$key] = ConvertTo-HashtableDeep -InputObject $InputObject[$key]
    }
    return $copy
  }

  if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
    $items = @()
    foreach ($item in $InputObject) {
      $items += ,(ConvertTo-HashtableDeep -InputObject $item)
    }
    return $items
  }

  if ($InputObject -is [psobject]) {
    $table = @{}
    foreach ($property in $InputObject.PSObject.Properties) {
      $table[$property.Name] = ConvertTo-HashtableDeep -InputObject $property.Value
    }
    return $table
  }

  return $InputObject
}

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No existe archivo JSON requerido: $Path"
  }

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding utf8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @{}
  }

  return ($raw | ConvertFrom-Json)
}

function Write-JsonFile {
  param(
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [object]$Data
  )

  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  $json = $Data | ConvertTo-Json -Depth 16
  [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
}

function Resolve-FlavorDefinition {
  param([string]$FlavorId)

  $catalog = Read-JsonFile -Path (Join-Path $configRoot 'installer-flavors.json')
  $flavors = @($catalog.flavors)
  if ([string]::IsNullOrWhiteSpace($FlavorId)) {
    $FlavorId = [string]$catalog.defaultFlavorId
  }

  $resolved = @($flavors | Where-Object { [string]$_.flavorId -eq $FlavorId } | Select-Object -First 1)
  if ($resolved.Count -eq 0) {
    throw "Flavor no soportado por helper Burn: $FlavorId"
  }

  return $resolved[0]
}

function Use-FlavorRuntimePreference {
  param([pscustomobject]$Flavor)

  if (-not $Flavor -or [string]$Flavor.flavorId -ne 'docente-local') {
    return
  }

  $requested = [string]$env:EVALUAPRO_DOCKER_RUNTIME
  if ([string]::IsNullOrWhiteSpace($requested) -or $requested.Trim().ToLowerInvariant() -eq 'auto') {
    $env:EVALUAPRO_DOCKER_RUNTIME = 'wsl2-engine'
    Add-HelperLog -Level 'info' -Message 'docente-local prioriza WSL2 + Docker Engine para el runtime Docker.'
  }
}

function Get-InputValue {
  param(
    [hashtable]$Table,
    [string]$Key,
    [object]$DefaultValue = ''
  )

  if ($null -eq $Table) {
    return $DefaultValue
  }

  if ($Table.ContainsKey($Key)) {
    return $Table[$Key]
  }

  return $DefaultValue
}

function Test-InternetConnectivity {
  if (@('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_ASSUME_INTERNET).Trim().ToLowerInvariant()) {
    return $true
  }

  $targets = @(
    'https://api.github.com',
    'https://github.com'
  )

  foreach ($target in $targets) {
    try {
      $response = Invoke-WebRequest -Uri $target -Method Head -TimeoutSec 6 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      continue
    }
  }

  return $false
}

function Invoke-DesktopAssetRefresh {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir,
    [Parameter(Mandatory = $true)]
    [string]$FlavorId,
    [switch]$SkipManifestUpdate
  )

  if (-not (Test-Path -LiteralPath $InstallDir)) {
    throw "No existe carpeta de instalacion para refrescar assets: $InstallDir"
  }

  $shortcutsScript = Join-Path $InstallDir 'scripts\create-shortcuts.ps1'
  $manifestScript = Join-Path $InstallDir 'scripts\generate-installation-manifest.ps1'

  if ([string]::IsNullOrWhiteSpace([string]$env:EVALUAPRO_DESKTOP_PATH) -and -not [string]::IsNullOrWhiteSpace([string]$env:USERPROFILE)) {
    $env:EVALUAPRO_DESKTOP_PATH = Join-Path ([string]$env:USERPROFILE) 'Desktop'
  }
  if ([string]::IsNullOrWhiteSpace([string]$env:EVALUAPRO_STARTMENU_PATH) -and -not [string]::IsNullOrWhiteSpace([string]$env:APPDATA)) {
    $env:EVALUAPRO_STARTMENU_PATH = Join-Path ([string]$env:APPDATA) 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'
  }

  if (Test-Path -LiteralPath $shortcutsScript) {
    $includeDevShortcut = ([string]$FlavorId).Trim().ToLowerInvariant() -ne 'docente-local'
    try {
      $shortcutOutput = & $shortcutsScript -Port 4519 -IncludeDevShortcut ([bool]$includeDevShortcut) -SkipManifestUpdate:$SkipManifestUpdate -Force 2>&1
    } catch {
      throw ("No se pudieron regenerar accesos directos oficiales. Error={0}. Output={1}" -f ([string]$_.Exception.Message), (($shortcutOutput | ForEach-Object { [string]$_ }) -join ' '))
    }
    Add-HelperLog -Level 'ok' -Message 'Accesos directos oficiales regenerados.'
  }

  if (-not $SkipManifestUpdate -and (Test-Path -LiteralPath $manifestScript)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $manifestScript -InstallDir $InstallDir -Port 4519 | Out-Null
    Add-HelperLog -Level 'ok' -Message 'installation.manifest.json actualizado.'
  }
}

function Get-EmbeddedNodeRuntimePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
  )

  return (Join-Path $InstallDir 'runtime\node\node.exe')
}

function Get-EmbeddedNodeMajorVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
  )

  $nodePath = Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir
  if (-not (Test-Path -LiteralPath $nodePath)) { return 0 }

  try {
    $raw = (& $nodePath -v 2>$null | Select-Object -First 1)
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

function Resolve-EmbeddedNodeBootstrapPackage {
  $manifestPath = Join-Path $configRoot 'installer-prereqs.manifest.json'
  $manifest = Read-PrereqManifest -ManifestPath $manifestPath
  $nodePrereq = @($manifest.prerequisites | Where-Object { [string]$_.name -eq 'Node.js' } | Select-Object -First 1)
  if ($nodePrereq.Count -eq 0) {
    throw 'No se encontro prerequisito Node.js en installer-prereqs.manifest.json.'
  }

  $downloadUrl = [string]$nodePrereq[0].downloadUrl
  $zipUrl = $downloadUrl -replace '-x64\.msi$', '-win-x64.zip'
  $zipPattern = [string]$nodePrereq[0].sha256Pattern -replace '-x64\.msi$', '-win-x64.zip'

  return [pscustomobject]@{
    version = [string]$nodePrereq[0].version
    downloadUrl = $zipUrl
    sourceFileName = [System.IO.Path]::GetFileName(([uri]$zipUrl).AbsolutePath)
    sha256 = [string]$nodePrereq[0].sha256
    sha256Url = [string]$nodePrereq[0].sha256Url
    sha256Pattern = $zipPattern
  }
}

function Resolve-EmbeddedNodePackageSelection {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Package
  )

  $downloadUrl = [string]$Package.downloadUrl
  $sourceFileName = [string]$Package.sourceFileName
  if ([string]::IsNullOrWhiteSpace($sourceFileName)) {
    $sourceFileName = [System.IO.Path]::GetFileName(([uri]$downloadUrl).AbsolutePath)
  }

  $inline = [string]$Package.sha256
  if (-not [string]::IsNullOrWhiteSpace($inline) -and $inline -notin @('DYNAMIC_FROM_URL', 'GUIDED_BOOTSTRAP')) {
    return [pscustomobject]@{
      expectedSha256 = $inline.Trim().ToLowerInvariant()
      downloadUrl = $downloadUrl
      fileName = $sourceFileName
      resolvedBy = 'inline'
    }
  }

  $shaUrl = [string]$Package.sha256Url
  if ([string]::IsNullOrWhiteSpace($shaUrl)) {
    throw 'No se encontro sha256Url para runtime Node embebido.'
  }

  $text = ''
  $headers = @{ 'User-Agent' = 'EvaluaPro-InstallerHub' }
  try {
    $text = [string]((Invoke-InstallerHubWebRequest -Url $shaUrl -Method GET -Headers $headers -TimeoutSec 30 -RetryCount 2).Content)
  } catch {
    Add-HelperLog -Level 'warn' -Message ("Fallo lectura SHASUMS del runtime embebido por WebRequest. Se intentara fallback robusto: {0}" -f [string]$_.Exception.Message)
    $shaFallbackRoot = Join-Path $env:TEMP ('evaluapro-embedded-shasums-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $shaFallbackRoot -Force | Out-Null
    $shaFallbackPath = Join-Path $shaFallbackRoot 'SHASUMS256.txt'
    try {
      Invoke-InstallerHubDownloadFile -Url $shaUrl -Destination $shaFallbackPath
      $text = [string](Get-Content -LiteralPath $shaFallbackPath -Raw -Encoding utf8)
      Add-HelperLog -Level 'info' -Message 'SHASUMS del runtime embebido obtenido por fallback robusto.'
    } finally {
      if (Test-Path -LiteralPath $shaFallbackRoot) {
        Remove-Item -LiteralPath $shaFallbackRoot -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($text)) {
    throw 'No se pudo obtener SHASUMS remoto para runtime Node embebido.'
  }

  $preferredPattern = [string]$Package.sha256Pattern
  $fallbackRegex = '^node-v24\.\d+\.\d+-win-x64\.zip$'
  $resolved = Resolve-InstallerHubPackageFromShasums -Text ([string]$text) -PreferredPattern $preferredPattern -FallbackRegex $fallbackRegex
  if (-not $resolved -or [string]::IsNullOrWhiteSpace([string]$resolved.sha256)) {
    throw 'No se pudo resolver SHA256 remoto para runtime Node embebido.'
  }

  $resolvedFileName = if ([string]::IsNullOrWhiteSpace([string]$resolved.fileName)) { $sourceFileName } else { [string]$resolved.fileName }
  $resolvedUrl = $downloadUrl
  if ($resolvedFileName -ne $sourceFileName) {
    $baseUri = [uri]$downloadUrl
    $resolvedUri = [uri]::new($baseUri, $resolvedFileName)
    $resolvedUrl = [string]$resolvedUri.AbsoluteUri
    Add-HelperLog -Level 'info' -Message ("Ajustando paquete Node embebido: {0} -> {1}" -f $sourceFileName, $resolvedFileName)
    Add-HelperLog -Level 'warn' -Message ("Fallback dinamico SHASUMS aplicado para runtime Node embebido usando {0}" -f [string]$resolved.matchedPattern)
  }

  return [pscustomobject]@{
    expectedSha256 = [string]$resolved.sha256
    downloadUrl = $resolvedUrl
    fileName = $resolvedFileName
    resolvedBy = [string]$resolved.matchedBy
    matchedPattern = [string]$resolved.matchedPattern
  }
}

function Install-EmbeddedNodeRuntime {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
  )

  $requiredMajor = 24
  $currentMajor = Get-EmbeddedNodeMajorVersion -InstallDir $InstallDir
  if ($currentMajor -ge $requiredMajor) {
    Add-HelperLog -Level 'ok' -Message ("Runtime Node embebido ya disponible: {0}.x" -f $currentMajor)
    return [pscustomobject]@{
      ok = $true
      path = (Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir)
      version = "${currentMajor}.x"
      downloaded = $false
    }
  }

  $useHostNodeRuntime = (@('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_USE_HOST_NODE_RUNTIME).Trim().ToLowerInvariant())
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  if ($nodeCommand -and -not [string]::IsNullOrWhiteSpace([string]$nodeCommand.Source)) {
    $hostMajor = 0
    try {
      $hostVersionRaw = (& ([string]$nodeCommand.Source) -v 2>$null | Select-Object -First 1)
      if ($hostVersionRaw) {
        $hostMajor = [int](([string]$hostVersionRaw).Trim().TrimStart('v', 'V').Split('.')[0])
      }
    } catch {
      $hostMajor = 0
    }

    if ($hostMajor -lt $requiredMajor -and $useHostNodeRuntime) {
      throw ("EVALUAPRO_INSTALLER_USE_HOST_NODE_RUNTIME activo, pero node.exe host no cumple version requerida: {0}.x" -f $hostMajor)
    }

    if ($hostMajor -ge $requiredMajor) {
      $hostNodeRoot = Split-Path -Parent ([string]$nodeCommand.Source)
      $runtimeRoot = Join-Path $InstallDir 'runtime'
      $nodeRoot = Join-Path $runtimeRoot 'node'
      if (Test-Path -LiteralPath $nodeRoot) {
        Remove-Item -LiteralPath $nodeRoot -Recurse -Force -ErrorAction SilentlyContinue
      }
      New-Item -ItemType Directory -Path $nodeRoot -Force | Out-Null
      Copy-Item -Path (Join-Path $hostNodeRoot '*') -Destination $nodeRoot -Recurse -Force

      $copiedMajor = Get-EmbeddedNodeMajorVersion -InstallDir $InstallDir
      if ($copiedMajor -lt $requiredMajor) {
        throw ("Node host copiado no cumple version requerida: {0}.x" -f $copiedMajor)
      }

      Add-HelperLog -Level 'ok' -Message ("Runtime Node embebido preparado desde Node host: {0}" -f $hostNodeRoot)
      return [pscustomobject]@{
        ok = $true
        path = (Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir)
        version = "${copiedMajor}.x"
        downloaded = $false
        source = 'host-node'
      }
    }
  } elseif ($useHostNodeRuntime) {
    throw 'EVALUAPRO_INSTALLER_USE_HOST_NODE_RUNTIME activo, pero no se encontro node.exe en el host.'
  }

  $package = Resolve-EmbeddedNodeBootstrapPackage
  $selection = Resolve-EmbeddedNodePackageSelection -Package $package
  $downloadRoot = Join-Path $env:TEMP ('evaluapro-burn-node-runtime-' + [Guid]::NewGuid().ToString('N'))
  $zipPath = Join-Path $downloadRoot ([string]$selection.fileName)
  $extractRoot = Join-Path $downloadRoot 'extract'
  $runtimeRoot = Join-Path $InstallDir 'runtime'
  $nodeRoot = Join-Path $runtimeRoot 'node'
  $stagingRoot = Join-Path $runtimeRoot ('node.stage-' + [Guid]::NewGuid().ToString('N'))

  New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

  if (Test-Path -LiteralPath $runtimeRoot) {
    try {
      Remove-Item -LiteralPath $runtimeRoot -Recurse -Force -ErrorAction Stop
    } catch {
      throw ("No se pudo preparar la ruta del runtime embebido en {0}: {1}" -f $runtimeRoot, [string]$_.Exception.Message)
    }
  }

  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

  Add-HelperLog -Level 'info' -Message 'Descargando runtime Node embebido para Windows.'
  $downloadProgress = {
    param($activity, $percent, $status, $meta)
    Write-HelperProgress -Activity $activity -Percent $percent -Status $status -Meta $meta
  }
  Invoke-InstallerHubDownloadFile -Url ([string]$selection.downloadUrl) -Destination $zipPath -RetryCount 2 -OnProgress $downloadProgress
  $expected = [string]$selection.expectedSha256
  $actual = Get-InstallerHubFileSha256 -Path $zipPath
  if ($actual -ne $expected) {
    throw 'SHA256 invalido para runtime Node embebido.'
  }

  if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

  $expandedRoot = Get-ChildItem -LiteralPath $extractRoot -Directory | Select-Object -First 1
  if (-not $expandedRoot) {
    throw 'No se pudo extraer runtime Node embebido.'
  }

  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $expandedRoot.FullName '*') -Destination $stagingRoot -Recurse -Force

  if (Test-Path -LiteralPath $nodeRoot) {
    Remove-Item -LiteralPath $nodeRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  New-Item -ItemType Directory -Path $nodeRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $stagingRoot '*') -Destination $nodeRoot -Recurse -Force

  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  $finalMajor = Get-EmbeddedNodeMajorVersion -InstallDir $InstallDir
  if ($finalMajor -lt $requiredMajor) {
    throw 'El runtime Node embebido no quedo operativo tras la extraccion.'
  }

  Add-HelperLog -Level 'ok' -Message ("Runtime Node embebido preparado en {0}" -f $nodeRoot)
  return [pscustomobject]@{
    ok = $true
    path = (Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir)
    version = "${finalMajor}.x"
    downloaded = $true
    archivePath = $zipPath
  }
}

function Invoke-HelperPhase {
  param(
    [string]$Name,
    [int]$FailCode,
    [scriptblock]$Action
  )

  try {
    Add-HelperLog -Level 'info' -Message ("Fase helper: {0}" -f $Name)
    Write-HelperProgress -Activity 'helper-phase' -Percent 0 -Status ("Fase helper: {0}" -f $Name) -Meta @{ phase = $Name }
    & $Action
    Write-HelperProgress -Activity 'helper-phase' -Percent 100 -Status ("Fase completada: {0}" -f $Name) -Meta @{ phase = $Name }
  } catch {
    $exception = New-Object System.Exception($_.Exception.Message, $_.Exception)
    $exception.Data['phase'] = $Name
    $exception.Data['exitCode'] = $FailCode
    throw $exception
  }
}

function New-HelperResponse {
  param(
    [bool]$Ok,
    [string]$Phase,
    [int]$ExitCode,
    [string]$Message,
    [object]$Data = $null
  )

  return [ordered]@{
    ok = $Ok
    phase = $Phase
    exitCode = $ExitCode
    message = $Message
    artifacts = $script:helperArtifacts
    warnings = @($script:helperWarnings.ToArray())
    logs = @($script:helperLogs.ToArray())
    data = $Data
  }
}

function Test-DirectoryWriteAccess {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  $probe = Join-Path $Path ('.evaluapro-write-test-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  try {
    [IO.File]::WriteAllText($probe, 'ok', [System.Text.Encoding]::UTF8)
    Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    return $false
  }
}

function Remove-InstallerInstallDirectory {
  param([string]$InstallDir)

  if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    Add-HelperLog -Level 'warn' -Message 'Limpieza de uninstall omitida: ruta de instalacion vacia.'
    return
  }

  if (-not (Test-Path -LiteralPath $InstallDir)) {
    Add-HelperLog -Level 'ok' -Message ("Limpieza de uninstall: la ruta ya no existe ({0})." -f $InstallDir)
    return
  }

  for ($attempt = 1; $attempt -le 2; $attempt++) {
    try {
      Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction Stop
      Start-Sleep -Seconds 1
      if (-not (Test-Path -LiteralPath $InstallDir)) {
        Add-HelperLog -Level 'ok' -Message ("Limpieza de uninstall completada: {0}" -f $InstallDir)
        return
      }
    } catch {
      if ($attempt -eq 2) {
        Add-HelperLog -Level 'warn' -Message ("No se pudo eliminar la ruta de uninstall {0}: {1}" -f $InstallDir, $_.Exception.Message)
        return
      }
      Start-Sleep -Seconds 2
    }
  }
}

function Invoke-DetectPrereqsMode {
  param([object]$Request)

  $requestTable = ConvertTo-HashtableDeep -InputObject $Request
  $flavor = Resolve-FlavorDefinition -FlavorId ([string](Get-InputValue -Table $requestTable -Key 'flavorId'))
  Use-FlavorRuntimePreference -Flavor $flavor
  $installDir = [string](Get-InputValue -Table $requestTable -Key 'installDir')
  $autoRemediate = [bool](Get-InputValue -Table $requestTable -Key 'autoRemediate' -DefaultValue $false)
  $resumeTokenInput = [string](Get-InputValue -Table $requestTable -Key 'resumeToken')
  if ([string]::IsNullOrWhiteSpace($installDir)) {
    $installDir = Join-Path ${env:ProgramFiles} ([string]$flavor.productName)
  }

  $manifest = Read-PrereqManifest -ManifestPath (Join-Path $configRoot 'installer-prereqs.manifest.json')
  $profileManifest = Resolve-PrereqProfile -Manifest $manifest -ProfileId ([string]$flavor.prerequisitesProfile)
  $internetOk = Test-InternetConnectivity
  $system = Get-SystemRequirementReport -InstallPath $installDir -MinDiskGb ([int]$flavor.minDiskGb) -InternetOk $internetOk
  $runtime = Get-DockerRuntimeStatus
  $installation = Get-EvaluaProInstallationInfo
  $recommendedMode = Resolve-InstallerMode -RequestedMode 'auto' -Installation $installation
  $prereqs = @()

  foreach ($prereq in @($profileManifest.prerequisites)) {
    $status = Test-PrerequisiteStatus -Prerequisite $prereq
    $prereqs += [ordered]@{
      name = [string]$status.name
      installed = [bool]$status.installed
      actualVersion = [string]$status.actualVersion
      reason = [string]$status.reason
    }
  }

  $missingPrereqs = @($prereqs | Where-Object { -not $_.installed })
  $ready = ($system.IsReadyForFlow -and (@($prereqs | Where-Object { -not $_.installed }).Count -eq 0))
  $remediation = $null

  if ($autoRemediate -and -not $ready -and $recommendedMode -ne 'uninstall' -and $missingPrereqs.Count -gt 0) {
    Add-HelperLog -Level 'info' -Message 'Intentando remediacion automatica de prerequisitos antes de continuar.'
    Write-HelperProgress -Activity 'prerequisites' -Percent 1 -Status 'Preparando remediacion automatica de prerequisitos.'
    $downloadRoot = Join-Path $env:TEMP ('evaluapro-burn-prereqs-' + [Guid]::NewGuid().ToString('N'))
    try {
      $installResult = Invoke-PrerequisiteInstallationFlow -Manifest $profileManifest -DownloadRoot $downloadRoot -OnLog {
        param($lvl, $msg)
        Add-HelperLog -Level $lvl -Message $msg
      } -OnProgress {
        param($activity, $percent, $status, $meta)
        Write-HelperProgress -Activity ([string]$activity) -Percent ([int]$percent) -Status ([string]$status) -Meta $meta
      }
      $remediation = [ordered]@{
        attempted = $true
        ok = [bool]$installResult.ok
        installed = @($installResult.installed)
        missing = @($installResult.missing)
        requiresRestart = [bool](if ($null -ne $installResult.requiresRestart) { $installResult.requiresRestart } else { $false })
        restartReason = [string](if ($null -ne $installResult.restartReason) { $installResult.restartReason } else { '' })
        resumeToken = [string](if ($null -ne $installResult.resumeToken -and -not [string]::IsNullOrWhiteSpace([string]$installResult.resumeToken)) { $installResult.resumeToken } else { $resumeTokenInput })
        phase = [string](if ($null -ne $installResult.phase) { $installResult.phase } else { '' })
        downloadRoot = $downloadRoot
      }
      Write-HelperProgress -Activity 'prerequisites' -Percent 100 -Status 'Remediacion automatica completada.'
    } catch {
      $requiresRestart = $false
      $restartReason = ''
      $resumeToken = ''
      $remediationPhase = ''
      if ($_.Exception -and $_.Exception.Data) {
        if ($_.Exception.Data.Contains('requiresRestart')) {
          $requiresRestart = [bool]$_.Exception.Data['requiresRestart']
        }
        if ($_.Exception.Data.Contains('restartReason')) {
          $restartReason = [string]$_.Exception.Data['restartReason']
        }
        if ($_.Exception.Data.Contains('resumeToken')) {
          $resumeToken = [string]$_.Exception.Data['resumeToken']
        }
        if ($_.Exception.Data.Contains('phase')) {
          $remediationPhase = [string]$_.Exception.Data['phase']
        }
      }
      $remediation = [ordered]@{
        attempted = $true
        ok = $false
        error = [string]$_.Exception.Message
        requiresRestart = $requiresRestart
        restartReason = $restartReason
        resumeToken = if ([string]::IsNullOrWhiteSpace($resumeToken)) { $resumeTokenInput } else { $resumeToken }
        phase = $remediationPhase
        downloadRoot = $downloadRoot
      }
      Add-HelperLog -Level 'warn' -Message ('Remediacion automatica de prerequisitos incompleta: ' + [string]$_.Exception.Message)
      if ($requiresRestart -and -not [string]::IsNullOrWhiteSpace($restartReason)) {
        Add-HelperLog -Level 'warn' -Message ('Remediacion bloqueada por reinicio requerido: ' + $restartReason)
      }
      Write-HelperProgress -Activity 'prerequisites' -Percent 100 -Status 'La remediacion automatica termino con pasos pendientes.'
    }

    $internetOk = Test-InternetConnectivity
    $system = Get-SystemRequirementReport -InstallPath $installDir -MinDiskGb ([int]$flavor.minDiskGb) -InternetOk $internetOk
    $runtime = Get-DockerRuntimeStatus
    $prereqs = @()
    foreach ($prereq in @($profileManifest.prerequisites)) {
      $status = Test-PrerequisiteStatus -Prerequisite $prereq
      $prereqs += [ordered]@{
        name = [string]$status.name
        installed = [bool]$status.installed
        actualVersion = [string]$status.actualVersion
        reason = [string]$status.reason
      }
    }
    $missingPrereqs = @($prereqs | Where-Object { -not $_.installed })
    $ready = ($system.IsReadyForFlow -and $missingPrereqs.Count -eq 0)
  } elseif ($autoRemediate -and -not $ready -and $recommendedMode -ne 'uninstall' -and $missingPrereqs.Count -eq 0) {
    Add-HelperLog -Level 'info' -Message 'Se omite remediacion automatica: no hay prerequisitos faltantes que instalar.'
  }

  Add-HelperLog -Level 'info' -Message ("Detectado flavor={0} mode={1} ready={2}" -f [string]$flavor.flavorId, $recommendedMode, $ready)

  $payload = [ordered]@{
    recommendedMode = $recommendedMode
    ready = $ready
    flavor = [ordered]@{
      flavorId = [string]$flavor.flavorId
      displayName = [string]$flavor.displayName
      productName = [string]$flavor.productName
      installerHubExeName = [string]$flavor.installerHubExeName
    }
    installation = [ordered]@{
      installed = [bool]$installation.Installed
      installLocation = [string]$installation.InstallLocation
      displayVersion = [string]$installation.DisplayVersion
    }
    system = [ordered]@{
      issues = @($system.Issues)
      internetOk = [bool]$system.InternetOk
      diskFreeGb = [double]$system.DiskFreeGb
      nodeMajor = [int]$system.NodeMajor
    }
    runtime = [ordered]@{
      installed = [bool]$runtime.installed
      ready = [bool]$runtime.ready
      reason = [string]$runtime.reason
      mode = [string]$runtime.mode
    }
    prerequisites = $prereqs
    remediation = $remediation
  }

  return (New-HelperResponse -Ok $true -Phase 'analisis_requisitos' -ExitCode 0 -Message 'Detección completada.' -Data $payload)
}

function Invoke-PostInstallMode {
  param([object]$Request)

  $requestTable = ConvertTo-HashtableDeep -InputObject $Request
  $flavor = Resolve-FlavorDefinition -FlavorId ([string](Get-InputValue -Table $requestTable -Key 'flavorId'))
  Use-FlavorRuntimePreference -Flavor $flavor
  $mode = [string](Get-InputValue -Table $requestTable -Key 'mode')
  if ([string]::IsNullOrWhiteSpace($mode)) {
    $mode = 'install'
  }

  $installDir = [string](Get-InputValue -Table $requestTable -Key 'installDir')
  if ([string]::IsNullOrWhiteSpace($installDir)) {
    $installDir = Join-Path ${env:ProgramFiles} ([string]$flavor.productName)
  }

  $config = @{}
  if ($requestTable.ContainsKey('config')) {
    $config = ConvertTo-HashtableDeep -InputObject $requestTable.config
  }

  if (-not $config.ContainsKey('flavorId')) { $config.flavorId = [string]$flavor.flavorId }
  if (-not $config.ContainsKey('updateAssetName')) { $config.updateAssetName = [string]$flavor.installerHubExeName }
  if (-not $config.ContainsKey('updateShaAssetName')) { $config.updateShaAssetName = ([string]$flavor.installerHubExeName + '.sha256') }
  if (-not $config.ContainsKey('updateOwner')) { $config.updateOwner = 'Dtcsrni' }
  if (-not $config.ContainsKey('updateRepo')) { $config.updateRepo = 'EvaluaPro_Sistema_Universitario' }
  if (-not $config.ContainsKey('updateChannel')) { $config.updateChannel = 'stable' }
  if (-not $config.ContainsKey('updateRequireSha256')) { $config.updateRequireSha256 = '1' }
  if (-not $config.ContainsKey('requireLicenseActivation')) { $config.requireLicenseActivation = '0' }
  if (-not $config.ContainsKey('passwordResetEnabled')) { $config.passwordResetEnabled = '0' }

  $isRepairMode = ([string]$mode).Trim().ToLowerInvariant() -eq 'repair'
  $canWriteInstallDir = Test-DirectoryWriteAccess -Path $installDir
  $skipRestrictedRepairPhases = ($isRepairMode -and -not $canWriteInstallDir)

  if ($skipRestrictedRepairPhases) {
    $warnMessage = 'Repair detectado sin permisos de escritura en la carpeta de instalacion. Se omiten ajustes locales que requieren elevacion.'
    $script:helperWarnings.Add($warnMessage)
    Add-HelperLog -Level 'warn' -Message ($warnMessage + ' Ruta: ' + $installDir)

    if ($mode -ne 'uninstall') {
      try {
        Invoke-DesktopAssetRefresh -InstallDir $installDir -FlavorId ([string]$flavor.flavorId) -SkipManifestUpdate
        Add-HelperLog -Level 'ok' -Message 'Accesos directos de usuario regenerados en modo restringido.'
      } catch {
        Add-HelperLog -Level 'warn' -Message ("No se pudieron regenerar accesos directos en modo restringido: {0}" -f $_.Exception.Message)
      }
    }
  }

  if ($mode -ne 'uninstall' -and [string]$flavor.flavorId -eq 'docente-local') {
    if ($skipRestrictedRepairPhases) {
      Add-HelperLog -Level 'warn' -Message 'Fase runtime_local_embebido omitida en repair por permisos insuficientes.'
    } else {
      $responsePhase = 'runtime_local_embebido'
      Invoke-HelperPhase -Name 'runtime_local_embebido' -FailCode 30 -Action {
        $runtime = Install-EmbeddedNodeRuntime -InstallDir $installDir
        $script:helperArtifacts['embeddedNodePath'] = [string]$runtime.path
        $script:helperArtifacts['embeddedNodeVersion'] = [string]$runtime.version
      }
    }
  }

  $responsePhase = 'configuracion_operativa'

  if ($skipRestrictedRepairPhases) {
    Add-HelperLog -Level 'warn' -Message 'Fase configuracion_operativa omitida en repair por permisos insuficientes.'
  } else {
    Invoke-HelperPhase -Name 'configuracion_operativa' -FailCode 35 -Action {
      $setup = Invoke-EvaluaProOperationalConfiguration -Mode $mode -InstallDir $installDir -Config $config -OnLog {
        param($lvl, $msg)
        Add-HelperLog -Level $lvl -Message $msg
      }
      $script:helperArtifacts['envPath'] = [string]$setup.envPath
      $script:helperArtifacts['operationalProfilePath'] = [string]$setup.profilePath

      if ($mode -ne 'uninstall') {
        Invoke-DesktopAssetRefresh -InstallDir $installDir -FlavorId ([string]$flavor.flavorId)
      }
    }
  }

  if ($mode -eq 'uninstall') {
    $responsePhase = 'limpieza_residual'
    Invoke-HelperPhase -Name 'limpieza_residual' -FailCode 38 -Action {
      Remove-InstallerInstallDirectory -InstallDir $installDir
    }
  }

  $responsePhase = 'verificacion_final'
  if ($skipRestrictedRepairPhases) {
    Add-HelperLog -Level 'warn' -Message 'Fase verificacion_final omitida en repair por restricciones de permisos detectadas.'
  } else {
    Invoke-HelperPhase -Name 'verificacion_final' -FailCode 40 -Action {
      $verify = Invoke-PostInstallVerification -Mode $mode -InstallDir $installDir -Flavor $flavor -OnLog {
        param($lvl, $msg)
        Add-HelperLog -Level $lvl -Message $msg
      }
      if (-not $verify.ok) {
        throw ("Verificacion final fallo: " + ($verify.issues -join ' | '))
      }
    }
  }

  $responsePhase = 'blindaje_licencia_local'
  if ($skipRestrictedRepairPhases) {
    Add-HelperLog -Level 'warn' -Message 'Fase blindaje_licencia_local omitida en repair por restricciones de permisos detectadas.'
  } else {
    Invoke-HelperPhase -Name 'blindaje_licencia_local' -FailCode 50 -Action {
      if ($mode -eq 'uninstall') {
        Add-HelperLog -Level 'info' -Message 'Blindaje de licencia omitido en uninstall.'
        return
      }

      $integrityTargets = @(
        (Join-Path $installDir 'scripts\launcher-dashboard.mjs'),
        (Join-Path $installDir 'scripts\launcher-tray-hidden.vbs'),
        (Join-Path $installDir 'scripts\update-manager.mjs')
      ) | Where-Object { Test-Path -LiteralPath $_ }

      if ($integrityTargets.Count -gt 0) {
        $baseline = Register-EvaluaProIntegrityBaseline -Paths $integrityTargets
        $script:helperArtifacts['integrityBaseline'] = [string]$baseline
        Add-HelperLog -Level 'ok' -Message ("Baseline de integridad registrado: {0}" -f [string]$baseline)
      }

      $requireLicense = @('1', 'true', 'yes', 'on') -contains ([string]$config.requireLicenseActivation).Trim().ToLowerInvariant()
      $tenantId = [string]$config.tenantId
      $codigoActivacion = [string]$config.codigoActivacion
      if ($tenantId -and $codigoActivacion) {
        $license = Invoke-EvaluaProLicenseActivationSecure `
          -ApiBaseUrl ([string]$config.apiComercialBaseUrl) `
          -TenantId $tenantId `
          -CodigoActivacion $codigoActivacion `
          -VersionInstalada 'burn-bootstrapper'
        $script:helperArtifacts['secureLicensePath'] = [string]$license.securePath
        Add-HelperLog -Level 'ok' -Message ("Licencia activada y sellada en: {0}" -f [string]$license.securePath)
      } elseif ($requireLicense) {
        throw 'La activación de licencia es obligatoria y faltan TenantId/CodigoActivacion.'
      } else {
        Add-HelperLog -Level 'info' -Message 'Activación de licencia omitida.'
      }

      try {
        $portable = Initialize-EvaluaProPortableAdminLicense -HolderName 'I.S.C. Erick Renato Vega Ceron'
        $stepUp = Initialize-EvaluaProAdminStepUp -HolderName 'I.S.C. Erick Renato Vega Ceron'
        $script:helperArtifacts['portableLicensePath'] = [string]$portable.outPath
        Add-HelperLog -Level 'ok' -Message ("Licencia portable emitida: {0}" -f [string]$portable.outPath)
        Add-HelperLog -Level 'ok' -Message ("Step-up inicializado. Recovery codes restantes: {0}" -f [int]$stepUp.recoveryCodesRemaining)
      } catch {
        $script:helperWarnings.Add("Licencia portable/step-up no disponible: $($_.Exception.Message)")
        Add-HelperLog -Level 'warn' -Message ("Licencia portable/step-up no disponible: {0}" -f $_.Exception.Message)
      }
    }
  }

  return (New-HelperResponse -Ok $true -Phase $responsePhase -ExitCode 0 -Message 'Post-install completado.' -Data ([ordered]@{
      flavorId = [string]$flavor.flavorId
      mode = $mode
      installDir = $installDir
    }))
}

try {
  $request = Read-JsonFile -Path $RequestPath
  $response = switch ($Mode) {
    'detect-prereqs' { Invoke-DetectPrereqsMode -Request $request }
    'post-install' { Invoke-PostInstallMode -Request $request }
    default { throw "Modo helper no soportado: $Mode" }
  }
} catch {
  $phase = if ($_.Exception.Data.Contains('phase')) { [string]$_.Exception.Data['phase'] } else { 'helper' }
  $exitCode = if ($_.Exception.Data.Contains('exitCode')) { [int]$_.Exception.Data['exitCode'] } else { 50 }
  Add-HelperLog -Level 'error' -Message $_.Exception.Message
  $response = New-HelperResponse -Ok $false -Phase $phase -ExitCode $exitCode -Message $_.Exception.Message
}

Write-JsonFile -Path $ResponsePath -Data $response
if (-not $response.ok) {
  exit ([int]$response.exitCode)
}

exit 0
