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
$modulesRoot = Join-Path $repoRoot 'scripts\installer-burn\modules'
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
    [string]$InstallDir
  )

  if (-not (Test-Path -LiteralPath $InstallDir)) {
    throw "No existe carpeta de instalacion para refrescar assets: $InstallDir"
  }

  $shortcutsScript = Join-Path $InstallDir 'scripts\create-shortcuts.ps1'
  $manifestScript = Join-Path $InstallDir 'scripts\generate-installation-manifest.ps1'

  if (Test-Path -LiteralPath $shortcutsScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shortcutsScript -Port 4519 -Force | Out-Null
    Add-HelperLog -Level 'ok' -Message 'Accesos directos oficiales regenerados.'
  }

  if (Test-Path -LiteralPath $manifestScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $manifestScript -InstallDir $InstallDir -Port 4519 | Out-Null
    Add-HelperLog -Level 'ok' -Message 'installation.manifest.json actualizado.'
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
    & $Action
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

function Invoke-DetectPrereqsMode {
  param([object]$Request)

  $requestTable = ConvertTo-HashtableDeep -InputObject $Request
  $flavor = Resolve-FlavorDefinition -FlavorId ([string](Get-InputValue -Table $requestTable -Key 'flavorId'))
  $installDir = [string](Get-InputValue -Table $requestTable -Key 'installDir')
  $autoRemediate = [bool](Get-InputValue -Table $requestTable -Key 'autoRemediate' -DefaultValue $false)
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

  $ready = ($system.IsReadyForFlow -and (@($prereqs | Where-Object { -not $_.installed }).Count -eq 0))
  $remediation = $null

  if ($autoRemediate -and -not $ready -and $recommendedMode -ne 'uninstall') {
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
        downloadRoot = $downloadRoot
      }
      Write-HelperProgress -Activity 'prerequisites' -Percent 100 -Status 'Remediacion automatica completada.'
    } catch {
      $remediation = [ordered]@{
        attempted = $true
        ok = $false
        error = [string]$_.Exception.Message
        downloadRoot = $downloadRoot
      }
      Add-HelperLog -Level 'warn' -Message ('Remediacion automatica de prerequisitos incompleta: ' + [string]$_.Exception.Message)
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
    $ready = ($system.IsReadyForFlow -and (@($prereqs | Where-Object { -not $_.installed }).Count -eq 0))
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

  $responsePhase = 'configuracion_operativa'

  Invoke-HelperPhase -Name 'configuracion_operativa' -FailCode 35 -Action {
    $setup = Invoke-EvaluaProOperationalConfiguration -Mode $mode -InstallDir $installDir -Config $config -OnLog {
      param($lvl, $msg)
      Add-HelperLog -Level $lvl -Message $msg
    }
    $script:helperArtifacts['envPath'] = [string]$setup.envPath
    $script:helperArtifacts['operationalProfilePath'] = [string]$setup.profilePath

    if ($mode -ne 'uninstall') {
      Invoke-DesktopAssetRefresh -InstallDir $installDir
    }
  }

  $responsePhase = 'verificacion_final'
  Invoke-HelperPhase -Name 'verificacion_final' -FailCode 40 -Action {
    $verify = Invoke-PostInstallVerification -Mode $mode -InstallDir $installDir -Flavor $flavor -OnLog {
      param($lvl, $msg)
      Add-HelperLog -Level $lvl -Message $msg
    }
    if (-not $verify.ok) {
      throw ("Verificacion final fallo: " + ($verify.issues -join ' | '))
    }
  }

  $responsePhase = 'blindaje_licencia_local'
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
