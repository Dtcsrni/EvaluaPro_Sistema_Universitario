Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PrereqDetector.psm1') -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'OperationalConfig.psm1') -DisableNameChecking

function Read-PostInstallEnvMap {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in @(Get-Content -LiteralPath $Path -Encoding utf8)) {
    if ([string]::IsNullOrWhiteSpace([string]$line)) { continue }
    $trimmed = ([string]$line).Trim()
    if ($trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -le 0) { continue }
    $key = $trimmed.Substring(0, $separator).Trim()
    if ([string]::IsNullOrWhiteSpace($key)) { continue }
    $map[$key] = $trimmed.Substring($separator + 1)
  }
  return $map
}

function Get-EmbeddedNodeRuntimePath {
  param([string]$InstallDir)
  if (-not $InstallDir) { return '' }
  return (Join-Path $InstallDir 'runtime\node\node.exe')
}

function Get-EmbeddedNodeMajorVersion {
  param([string]$InstallDir)
  $nodePath = Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir
  if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) { return 0 }

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

function Invoke-InstalledClassroomDoctor {
  param(
    [string]$InstallDir,
    [string]$EnvPath,
    [hashtable]$EnvMap,
    [bool]$UseEmbeddedNode
  )

  $classroomConfigured = ConvertTo-InstallerHubBool -Value ([string]$EnvMap['CLASSROOM_ENABLED'])
  foreach ($key in @('GOOGLE_CLASSROOM_CLIENT_ID', 'GOOGLE_CLASSROOM_CLIENT_SECRET', 'GOOGLE_CLASSROOM_REDIRECT_URI', 'CLASSROOM_TOKEN_CIPHER_KEY')) {
    if (-not [string]::IsNullOrWhiteSpace([string]$EnvMap[$key])) {
      $classroomConfigured = $true
      break
    }
  }
  if (-not $classroomConfigured) { return $null }

  $doctorPath = Join-Path $InstallDir 'scripts\classroom-doctor.mjs'
  if (-not (Test-Path -LiteralPath $doctorPath)) {
    return 'No se encontro classroom-doctor.mjs en el runtime instalado.'
  }

  $nodePath = if ($UseEmbeddedNode) {
    Get-EmbeddedNodeRuntimePath -InstallDir $InstallDir
  } else {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) { [string]$nodeCommand.Source } else { '' }
  }
  if ([string]::IsNullOrWhiteSpace($nodePath) -or -not (Test-Path -LiteralPath $nodePath)) {
    return 'No se encontro Node.js para ejecutar classroom-doctor.mjs.'
  }

  & $nodePath $doctorPath "--env=$EnvPath" *> $null
  if ($LASTEXITCODE -ne 0) {
    return 'classroom-doctor.mjs rechazo la configuracion efectiva del .env instalado.'
  }
  return $null
}

function Invoke-PostInstallVerification {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [string]$InstallDir,
    [pscustomobject]$Flavor,
    [scriptblock]$OnLog
  )

  $issues = @()
  $allowUnregistered = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_ALLOW_UNREGISTERED).Trim().ToLowerInvariant()

  if ($Mode -eq 'install' -or $Mode -eq 'repair') {
    $installation = Get-EvaluaProInstallationInfo -IgnoreInstallerHub
    if (-not $installation.Installed -and -not $allowUnregistered) {
      $issues += 'No se detecta EvaluaPro en registro tras instalacion/reparacion.'
    }

    $effectiveDir = $InstallDir
    $installLocationProp = $installation.PSObject.Properties['InstallLocation']
    if (-not $effectiveDir -and $installLocationProp -and $installLocationProp.Value) {
      $effectiveDir = [string]$installLocationProp.Value
    }
    if (-not $effectiveDir) {
      $effectiveDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
    }

    $requiredFiles = @(
      (Join-Path $effectiveDir 'package.json'),
      (Join-Path $effectiveDir 'scripts\\launcher-broker.ps1'),
      (Join-Path $effectiveDir 'scripts\\launcher-tray-hidden.vbs'),
      (Join-Path $effectiveDir 'scripts\\launcher-dashboard-hidden.vbs'),
      (Join-Path $effectiveDir 'logs\\installation.manifest.json')
    )

    foreach ($file in $requiredFiles) {
      if (-not (Test-Path $file)) {
        $issues += "No se encontro archivo requerido: $file"
      }
    }

    $desktopRoot = if ($env:EVALUAPRO_DESKTOP_PATH) { [string]$env:EVALUAPRO_DESKTOP_PATH } else { [Environment]::GetFolderPath('Desktop') }
    $startMenuRoot = if ($env:EVALUAPRO_STARTMENU_PATH) { [string]$env:EVALUAPRO_STARTMENU_PATH } elseif ($env:APPDATA) { Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro' } else { '' }
    $includeDevShortcut = ([string]$Flavor.flavorId).Trim().ToLowerInvariant() -ne 'docente-local'
    $shortcutTargets = @(
      (Join-Path $desktopRoot 'EvaluaPro - Prod.lnk'),
      (Join-Path $desktopRoot 'EvaluaPro - Hub.lnk')
    )
    if ($includeDevShortcut) {
      $shortcutTargets += (Join-Path $desktopRoot 'EvaluaPro - Dev.lnk')
    }
    if ($startMenuRoot) {
      $shortcutTargets += @(
        (Join-Path $startMenuRoot 'EvaluaPro - Prod.lnk'),
        (Join-Path $startMenuRoot 'EvaluaPro - Hub.lnk'),
        (Join-Path $startMenuRoot 'EvaluaPro - Desinstalar.lnk')
      )
      if ($includeDevShortcut) {
        $shortcutTargets += (Join-Path $startMenuRoot 'EvaluaPro - Dev.lnk')
      }
    }
    foreach ($shortcut in $shortcutTargets) {
      if (-not (Test-Path -LiteralPath $shortcut)) {
        $issues += "Falta acceso directo esperado: $shortcut"
      }
    }

    $envPath = Join-Path $effectiveDir '.env'
    if (-not (Test-Path $envPath)) {
      $issues += "No se encontro archivo de configuracion operativa: $envPath"
    } else {
      $envRaw = Get-Content -Path $envPath -Raw -Encoding utf8
      $envMap = Read-PostInstallEnvMap -Path $envPath
      $requiredEnvKeys = @('DATABASE_URL', 'BACKEND_DATABASE_URL', 'JWT_SECRETO', 'CORS_ORIGENES')
      if ([string]$Flavor.flavorId -ne 'docente-local') {
        $requiredEnvKeys += @('PORTAL_ALUMNO_URL', 'PORTAL_ALUMNO_API_KEY', 'PORTAL_API_KEY')
      } else {
        $requiredEnvKeys += @('EVALUAPRO_FLAVOR', 'PORTAL_SYNC_REQUIRED')
        if ($envRaw -match '(?m)^\s*PORTAL_SYNC_REQUIRED\s*=\s*1\s*$') {
          $requiredEnvKeys += @('PORTAL_ALUMNO_URL', 'PORTAL_ALUMNO_API_KEY', 'PORTAL_API_KEY')
        }
      }
      foreach ($requiredKey in $requiredEnvKeys) {
        if ($envRaw -notmatch ("(?m)^\s*{0}\s*=" -f [Regex]::Escape($requiredKey))) {
          $issues += "Falta variable operativa en .env: $requiredKey"
        }
      }

      $oauthValidation = Test-InstallerOAuthEnv -EnvMap $envMap
      if (-not $oauthValidation.ok) {
        foreach ($oauthError in @($oauthValidation.errors)) {
          $issues += "Configuracion Google OAuth invalida: $oauthError"
        }
      }
      $doctorIssue = Invoke-InstalledClassroomDoctor `
        -InstallDir $effectiveDir `
        -EnvPath $envPath `
        -EnvMap $envMap `
        -UseEmbeddedNode ([string]$Flavor.flavorId -eq 'docente-local')
      if ($doctorIssue) {
        $issues += "Doctor Classroom: $doctorIssue"
      }
    }

    if ([string]$Flavor.flavorId -eq 'docente-local') {
      $embeddedNodeMajor = Get-EmbeddedNodeMajorVersion -InstallDir $effectiveDir
      if ($embeddedNodeMajor -lt 24) {
        $issues += 'Runtime Node embebido local no disponible o incompatible tras instalacion.'
      }

    } else {
      $nodeMajor = Get-NodeMajorVersion
      if ($nodeMajor -lt 24) {
        $issues += 'Node.js 24+ no disponible tras instalacion.'
      }
    }

    $requireDocker = $true
    if ($Flavor -and $Flavor.PSObject.Properties.Match('requireDockerRuntime').Count -gt 0) {
      $requireDocker = [bool]$Flavor.requireDockerRuntime
    } elseif ($Flavor -and $Flavor.PSObject.Properties.Match('requireDockerDesktop').Count -gt 0) {
      $requireDocker = [bool]$Flavor.requireDockerDesktop
    }

    if ($requireDocker) {
      $runtime = Get-DockerRuntimeStatus
      if (-not $runtime.installed) {
        $issues += "Runtime Docker compatible no disponible tras instalacion. $($runtime.reason)"
      }
    }

    $updateConfigPath = Join-Path $effectiveDir 'config\update-config.json'
    if (-not (Test-Path $updateConfigPath)) {
      $issues += "No se encontro configuracion de update: $updateConfigPath"
    } else {
      try {
        $updateCfg = Get-Content -Path $updateConfigPath -Raw -Encoding utf8 | ConvertFrom-Json
        if ($Flavor) {
          $expectedAsset = if ($Flavor.PSObject.Properties.Match('installerHubExeName').Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$Flavor.installerHubExeName)) { [string]$Flavor.installerHubExeName } else { [string]$Flavor.bundleName }
          if ([string]$updateCfg.flavorId -ne [string]$Flavor.flavorId) {
            $issues += "Flavor update-config inconsistente. Esperado=$($Flavor.flavorId) Actual=$([string]$updateCfg.flavorId)"
          }
          if ([string]$updateCfg.assetName -ne $expectedAsset) {
            $issues += "Asset updater inconsistente. Esperado=$expectedAsset Actual=$([string]$updateCfg.assetName)"
          }
        }
      } catch {
        $issues += 'No se pudo leer config/update-config.json tras instalacion.'
      }
    }
  }

  if ($Mode -eq 'uninstall') {
    $effectiveDir = $InstallDir
    if ([string]::IsNullOrWhiteSpace($effectiveDir)) {
      $effectiveDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
    }

    if (Test-Path -LiteralPath $effectiveDir) {
      $leftovers = @()
      try {
        $leftovers = @(Get-ChildItem -LiteralPath $effectiveDir -Force -ErrorAction SilentlyContinue)
      } catch {
        $leftovers = @()
      }

      if ($leftovers.Count -gt 0) {
        $issues += "Persisten archivos tras desinstalacion: $effectiveDir"
      } else {
        $issues += "Persiste la carpeta de desinstalacion: $effectiveDir"
      }
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
