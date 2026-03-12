Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PrereqDetector.psm1') -DisableNameChecking

function Invoke-PostInstallVerification {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [string]$InstallDir,
    [pscustomobject]$Flavor,
    [scriptblock]$OnLog
  )

  $issues = @()

  if ($Mode -eq 'install' -or $Mode -eq 'repair') {
    $installation = Get-EvaluaProInstallationInfo
    if (-not $installation.Installed) {
      $issues += 'No se detecta EvaluaPro en registro tras instalacion/reparacion.'
    }

    $effectiveDir = $InstallDir
    if (-not $effectiveDir -and $installation.InstallLocation) {
      $effectiveDir = $installation.InstallLocation
    }
    if (-not $effectiveDir) {
      $effectiveDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
    }

    $requiredFiles = @(
      (Join-Path $effectiveDir 'package.json'),
      (Join-Path $effectiveDir 'scripts\\launcher-tray-hidden.vbs'),
      (Join-Path $effectiveDir 'scripts\\launcher-dashboard-hidden.vbs')
    )

    foreach ($file in $requiredFiles) {
      if (-not (Test-Path $file)) {
        $issues += "No se encontro archivo requerido: $file"
      }
    }

    $envPath = Join-Path $effectiveDir '.env'
    if (-not (Test-Path $envPath)) {
      $issues += "No se encontro archivo de configuracion operativa: $envPath"
    } else {
      $envRaw = Get-Content -Path $envPath -Raw -Encoding utf8
      foreach ($requiredKey in @('MONGODB_URI', 'JWT_SECRETO', 'CORS_ORIGENES', 'PORTAL_ALUMNO_URL', 'PORTAL_ALUMNO_API_KEY', 'PORTAL_API_KEY')) {
        if ($envRaw -notmatch ("(?m)^\s*{0}\s*=" -f [Regex]::Escape($requiredKey))) {
          $issues += "Falta variable operativa en .env: $requiredKey"
        }
      }

      if ($envRaw -match '(?m)^\s*REQUIRE_GOOGLE_OAUTH\s*=\s*1\s*$') {
        foreach ($oauthKey in @('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLASSROOM_CLIENT_ID', 'GOOGLE_CLASSROOM_CLIENT_SECRET', 'GOOGLE_CLASSROOM_REDIRECT_URI')) {
          if ($envRaw -notmatch ("(?m)^\s*{0}\s*=" -f [Regex]::Escape($oauthKey))) {
            $issues += "OAuth requerido y falta variable en .env: $oauthKey"
          }
        }
      }
    }

    $nodeMajor = Get-NodeMajorVersion
    if ($nodeMajor -lt 24) {
      $issues += 'Node.js 24+ no disponible tras instalacion.'
    }

    $requireDocker = $true
    if ($Flavor -and $Flavor.PSObject.Properties.Match('requireDockerDesktop').Count -gt 0) {
      $requireDocker = [bool]$Flavor.requireDockerDesktop
    }

    if ($requireDocker -and -not (Test-DockerDesktopInstalled)) {
      $issues += 'Docker Desktop no disponible tras instalacion.'
    }

    $updateConfigPath = Join-Path $effectiveDir 'config\update-config.json'
    if (-not (Test-Path $updateConfigPath)) {
      $issues += "No se encontro configuracion de update: $updateConfigPath"
    } else {
      try {
        $updateCfg = Get-Content -Path $updateConfigPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 8
        if ($Flavor) {
          if ([string]$updateCfg.flavorId -ne [string]$Flavor.flavorId) {
            $issues += "Flavor update-config inconsistente. Esperado=$($Flavor.flavorId) Actual=$([string]$updateCfg.flavorId)"
          }
          if ([string]$updateCfg.assetName -ne [string]$Flavor.bundleName) {
            $issues += "Asset updater inconsistente. Esperado=$($Flavor.bundleName) Actual=$([string]$updateCfg.assetName)"
          }
        }
      } catch {
        $issues += 'No se pudo leer config/update-config.json tras instalacion.'
      }
    }
  }

  if ($Mode -eq 'uninstall') {
    $installation = Get-EvaluaProInstallationInfo
    if ($installation.Installed) {
      $issues += 'EvaluaPro sigue detectado tras desinstalacion.'
    }
  }

  if ($issues.Count -eq 0) {
    if ($OnLog) { & $OnLog 'ok' 'Verificacion final completada sin hallazgos.' }
    return [pscustomobject]@{ ok = $true; issues = @() }
  }

  if ($OnLog) {
    foreach ($issue in $issues) {
      & $OnLog 'warn' $issue
    }
  }

  return [pscustomobject]@{ ok = $false; issues = $issues }
}

Export-ModuleMember -Function @(
  'Invoke-PostInstallVerification'
)
