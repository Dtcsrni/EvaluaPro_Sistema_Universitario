Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'PrereqDetector.psm1') -DisableNameChecking

function Test-InstallerFlag {
  param(
    [string]$Value,
    [bool]$DefaultValue = $false
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $DefaultValue
  }

  $normalized = $Value.Trim().ToLowerInvariant()
  if ($normalized -in @('1', 'true', 'yes', 'on', 'si')) { return $true }
  if ($normalized -in @('0', 'false', 'no', 'off')) { return $false }
  return $DefaultValue
}

function Invoke-PrereqProgress {
  param(
    [scriptblock]$OnProgress,
    [string]$Activity,
    [int]$Percent,
    [string]$Status,
    [hashtable]$Meta
  )

  Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity $Activity -Percent $Percent -Status $Status -Meta $Meta
}

function New-ScaledProgressCallback {
  param(
    [scriptblock]$OnProgress,
    [int]$StartPercent,
    [int]$EndPercent,
    [string]$ActivityPrefix = ''
  )

  if (-not $OnProgress) {
    return $null
  }

  return {
    param($activity, $percent, $status, $meta)
    $range = [Math]::Max(0, $EndPercent - $StartPercent)
    $normalized = [Math]::Min(100, [Math]::Max(0, [int]$percent))
    $scaled = $StartPercent + [int][Math]::Round(($normalized / 100.0) * $range)
    $effectiveActivity = if ([string]::IsNullOrWhiteSpace($ActivityPrefix)) { [string]$activity } else { $ActivityPrefix }
    Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity $effectiveActivity -Percent $scaled -Status ([string]$status) -Meta $meta
  }.GetNewClosure()
}

function Get-DockerRuntimeBootstrapDistro {
  $raw = [string]$env:EVALUAPRO_INSTALLER_WSL_DISTRO
  if ([string]::IsNullOrWhiteSpace($raw)) { return 'Ubuntu' }
  return $raw.Trim()
}

function New-DockerRuntimeWindowsBootstrapPlan {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Status
  )

  $targetDistro = if (
    $Status.defaultDistro -and
    $Status.defaultDistro -notin @('docker-desktop', 'docker-desktop-data')
  ) {
    [string]$Status.defaultDistro
  } elseif (@($Status.userDistros).Count -gt 0) {
    [string]$Status.userDistros[0]
  } else {
    Get-DockerRuntimeBootstrapDistro
  }

  $steps = @()
  $requiresReboot = $false

  if (-not $Status.wslAvailable) {
    $requiresReboot = $true
    $steps += [pscustomobject]@{
      title = 'Habilitar WSL2 y distro base'
      executor = 'host'
      autoRunnable = $true
      command = "wsl --install -d $targetDistro"
    }
    $steps += [pscustomobject]@{
      title = 'Reiniciar Windows y reabrir Installer Hub'
      executor = 'manual'
      autoRunnable = $false
      command = 'Reinicia Windows y vuelve a ejecutar el Installer Hub para completar la validacion.'
    }
  } elseif (@($Status.userDistros).Count -eq 0) {
    $steps += [pscustomobject]@{
      title = 'Instalar distro soportada para WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl --install -d $targetDistro"
    }
    $steps += [pscustomobject]@{
      title = 'Abrir la distro e inicializar usuario'
      executor = 'manual'
      autoRunnable = $false
      command = "Abre `wsl -d $targetDistro`, completa el alta inicial de usuario y vuelve a correr el Installer Hub."
    }
  } else {
    $steps += [pscustomobject]@{
      title = 'Instalar Docker Engine dentro de WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""curl -fsSL https://get.docker.com | sh"""
    }
    $steps += [pscustomobject]@{
      title = 'Iniciar el daemon Docker en WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""service docker start || (nohup dockerd >/var/log/dockerd.log 2>&1 &)"""
    }
    $steps += [pscustomobject]@{
      title = 'Dar acceso al usuario actual'
      executor = 'manual'
      autoRunnable = $false
      command = ('wsl -d {0} -- sh -lc "sudo usermod -aG docker $USER"' -f $targetDistro)
    }
    $steps += [pscustomobject]@{
      title = 'Verificar runtime Docker en WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""docker version"""
    }
  }

  return [pscustomobject]@{
    distro = $targetDistro
    requiresReboot = $requiresReboot
    steps = @($steps)
  }
}

function Write-DockerRuntimeBootstrapGuide {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Plan,
    [Parameter(Mandatory = $true)]
    [string]$DownloadRoot
  )

  if (-not (Test-Path $DownloadRoot)) {
    New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
  }

  $guidePath = Join-Path $DownloadRoot 'docker-runtime-bootstrap-guide.txt'
  $scriptPath = Join-Path $DownloadRoot 'docker-runtime-bootstrap.ps1'

  $guideLines = @(
    'EvaluaPro - Bootstrap guiado WSL2 + Docker Engine',
    '',
    "Distro objetivo: $($Plan.distro)",
    "Requiere reinicio: $($Plan.requiresReboot)",
    ''
  )

  $scriptLines = @(
    'param()',
    '$ErrorActionPreference = ''Stop''',
    ''
  )

  $index = 1
  foreach ($step in @($Plan.steps)) {
    $guideLines += @(
      ("Paso {0}: {1}" -f $index, $step.title),
      ("Comando: {0}" -f $step.command),
      ''
    )
    if ($step.executor -eq 'host' -and $step.autoRunnable) {
      $scriptLines += $step.command
    } else {
      $scriptLines += ('# ' + $step.title)
      $scriptLines += ('# ' + $step.command)
    }
    $scriptLines += ''
    $index += 1
  }

  Set-Content -Path $guidePath -Value ($guideLines -join [Environment]::NewLine) -Encoding utf8
  Set-Content -Path $scriptPath -Value ($scriptLines -join [Environment]::NewLine) -Encoding utf8

  return [pscustomobject]@{
    guidePath = $guidePath
    scriptPath = $scriptPath
  }
}

function Invoke-DockerRuntimeBootstrapAuto {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Plan,
    [scriptblock]$OnLog,
    [scriptblock]$OnProgress
  )

  $executed = @()
  $pending = @()
  $failed = @()
  $simulateAuto = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP).Trim().ToLowerInvariant()

  $autoSteps = @($Plan.steps | Where-Object { $_.executor -eq 'host' -and $_.autoRunnable })
  $autoStepCount = [Math]::Max(1, @($autoSteps).Count)
  $autoStepIndex = 0

  foreach ($step in @($Plan.steps)) {
    if ($step.executor -eq 'host' -and $step.autoRunnable) {
      $autoStepIndex += 1
      $startPercent = [int][Math]::Round((($autoStepIndex - 1) / $autoStepCount) * 100)
      $endPercent = [int][Math]::Round(($autoStepIndex / $autoStepCount) * 100)
      try {
        if ($OnLog) { & $OnLog 'info' ("[auto-bootstrap] ejecutando: {0}" -f $step.command) }
        Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $startPercent -Status ("Ejecutando: {0}" -f [string]$step.title)
        if (-not $simulateAuto) {
          $rawCommand = [string]$step.command
          if ($rawCommand -match '^\s*wsl\s+--install\b') {
            # Evita bloqueo de UI: dispara instalación de distro en background y continúa.
            $distro = ''
            if ($rawCommand -match '-d\s+([A-Za-z0-9._-]+)') {
              $distro = [string]$Matches[1]
            }
            $args = @('--install')
            if ($distro) {
              $args += @('-d', $distro)
            }
            Start-Process -FilePath 'wsl.exe' -ArgumentList $args -WindowStyle Hidden | Out-Null
            if ($OnLog) {
              & $OnLog 'warn' ("[auto-bootstrap] instalacion WSL iniciada en segundo plano. Requiere completar setup manual/reinicio.")
            }
            Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $endPercent -Status ("Instalacion WSL iniciada: {0}" -f [string]$step.title)
          } else {
            Invoke-Expression -Command $rawCommand | Out-Null
            Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $endPercent -Status ("Paso completado: {0}" -f [string]$step.title)
          }
        }
        $executed += [pscustomobject]@{
          title = [string]$step.title
          command = [string]$step.command
          ok = $true
        }
      } catch {
        Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $startPercent -Status ("Fallo: {0}" -f [string]$step.title)
        $failed += [pscustomobject]@{
          title = [string]$step.title
          command = [string]$step.command
          ok = $false
          error = [string]$_.Exception.Message
        }
      }
      continue
    }

    $pending += [pscustomobject]@{
      title = [string]$step.title
      command = [string]$step.command
      executor = [string]$step.executor
      autoRunnable = [bool]$step.autoRunnable
    }
  }

  return [pscustomobject]@{
    executed = @($executed)
    pending = @($pending)
    failed = @($failed)
    simulated = $simulateAuto
  }
}

function Resolve-PrereqExpectedSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite,
    [scriptblock]$OnLog
  )

  $inline = [string]$Prerequisite.sha256
  if ($inline -match '^[a-fA-F0-9]{64}$') {
    return $inline.ToLowerInvariant()
  }

  $shaUrl = [string]$Prerequisite.sha256Url
  if (-not $shaUrl) {
    throw "No se encontro sha256 ni sha256Url para prerequisito $($Prerequisite.name)."
  }

  if ($OnLog) { & $OnLog 'info' "Resolviendo SHA256 remoto para $($Prerequisite.name)..." }

  $response = Invoke-InstallerHubWebRequest -Url $shaUrl -Method GET -TimeoutSec 30 -RetryCount 2
  $pattern = [string]$Prerequisite.sha256Pattern
  $expected = Resolve-InstallerHubSha256FromText -Text $response.Content -Pattern $pattern
  if (-not $expected) {
    throw "No se pudo resolver SHA256 desde sha256Url para $($Prerequisite.name)."
  }

  return $expected
}

function Install-PrerequisitePackage {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite,
    [Parameter(Mandatory = $true)]
    [string]$DownloadRoot,
    [scriptblock]$OnLog,
    [scriptblock]$OnProgress
  )

  $ruleType = [string]$Prerequisite.detectRule.type
  if ($ruleType -eq 'docker_runtime_windows') {
    $status = Get-DockerRuntimeStatus
    if ($status.installed) {
      if ($OnLog) { & $OnLog 'ok' ("Runtime Docker compatible detectado: $($status.mode)") }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 100 -Status ("Runtime Docker disponible: {0}" -f [string]$status.mode)
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        filePath = ''
        sha256 = ''
        exitCode = 0
        mode = [string]$status.mode
      }
    }

    $plan = New-DockerRuntimeWindowsBootstrapPlan -Status $status
    $guide = Write-DockerRuntimeBootstrapGuide -Plan $plan -DownloadRoot $DownloadRoot
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 5 -Status ("Plan de bootstrap generado para {0}" -f [string]$plan.distro)
    $autoBootstrapEnabled = Test-InstallerFlag -Value ([string]$env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL) -DefaultValue $true
    $bootstrapExecution = $null

    if (@('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP).Trim().ToLowerInvariant()) {
      $env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE = if (
        $env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_BOOTSTRAP
      ) {
        [string]$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_BOOTSTRAP
      } else {
        'wsl2-engine'
      }
      if ($OnLog) {
        & $OnLog 'ok' "Bootstrap guiado simulado para runtime Docker Windows ($($plan.distro))."
      }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 100 -Status ("Bootstrap simulado completado para {0}" -f [string]$plan.distro)
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        filePath = [string]$guide.guidePath
        sha256 = ''
        exitCode = 0
        mode = 'wsl2-engine'
        guidePath = [string]$guide.guidePath
        scriptPath = [string]$guide.scriptPath
      }
    }

    if ($autoBootstrapEnabled) {
      $bootstrapExecution = Invoke-DockerRuntimeBootstrapAuto -Plan $plan -OnLog $OnLog -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent 10 -EndPercent 85 -ActivityPrefix 'docker-runtime')
      $modeAfterAuto = [string]$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_AUTO
      if ([bool]$bootstrapExecution.simulated -and -not [string]::IsNullOrWhiteSpace($modeAfterAuto)) {
        $env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE = $modeAfterAuto.Trim()
      }
      if ($OnLog) {
        & $OnLog 'info' ("Auto-bootstrap ejecutado: {0} pasos OK, {1} pasos fallidos, {2} pasos pendientes." -f @($bootstrapExecution.executed).Count, @($bootstrapExecution.failed).Count, @($bootstrapExecution.pending).Count)
      }
      $statusAfterAuto = Get-DockerRuntimeStatus
      if ($statusAfterAuto.installed) {
        if ($OnLog) { & $OnLog 'ok' ("Runtime Docker compatible detectado tras auto-bootstrap: $($statusAfterAuto.mode)") }
        Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 100 -Status ("Runtime Docker listo: {0}" -f [string]$statusAfterAuto.mode)
        return [pscustomobject]@{
          name = [string]$Prerequisite.name
          filePath = [string]$guide.guidePath
          sha256 = ''
          exitCode = 0
          mode = [string]$statusAfterAuto.mode
          guidePath = [string]$guide.guidePath
          scriptPath = [string]$guide.scriptPath
          autoBootstrap = $bootstrapExecution
        }
      }
    }

    if ($OnLog) {
      & $OnLog 'warn' 'No se detecto runtime Docker compatible. Se requiere bootstrap guiado para WSL2 + Docker Engine o activar modo compatibilidad Docker Desktop.'
      & $OnLog 'info' ("Guia local: $($guide.guidePath)")
      & $OnLog 'info' ("Script base: $($guide.scriptPath)")
      if ($autoBootstrapEnabled -and $bootstrapExecution) {
        foreach ($failedStep in @($bootstrapExecution.failed)) {
          & $OnLog 'warn' ("Auto-bootstrap fallo en '{0}': {1}" -f $failedStep.title, $failedStep.error)
        }
      }
      foreach ($action in @($status.manualActions)) {
        & $OnLog 'info' $action
      }
      foreach ($step in @($plan.steps)) {
        & $OnLog 'info' ("{0}: {1}" -f $step.title, $step.command)
      }
    }
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 90 -Status 'Bootstrap automatico incompleto; se requieren acciones manuales.'

    $statusForError = if ($autoBootstrapEnabled) { Get-DockerRuntimeStatus } else { $status }
    $detail = if (@($statusForError.manualActions).Count -gt 0) { ($statusForError.manualActions -join ' ') } else { [string]$statusForError.reason }
    throw ("Bootstrap guiado pendiente para runtime Docker Windows. " + $detail)
  }

  if (-not (Test-Path $DownloadRoot)) {
    New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
  }

  $name = [string]$Prerequisite.name
  $downloadUrl = [string]$Prerequisite.downloadUrl
  if (-not $downloadUrl) {
    throw "downloadUrl vacia para prerequisito $name"
  }

  $fileName = [System.IO.Path]::GetFileName(([uri]$downloadUrl).AbsolutePath)
  if (-not $fileName) {
    $fileName = ("{0}.bin" -f ($name -replace '[^a-zA-Z0-9\-_.]', '-'))
  }

  $localPath = Join-Path $DownloadRoot $fileName
  $expected = Resolve-PrereqExpectedSha256 -Prerequisite $Prerequisite -OnLog $OnLog

  if ($OnLog) { & $OnLog 'info' "Descargando prerequisito: $name" }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'download' -Percent 0 -Status ("Preparando descarga de {0}" -f $name)
  Invoke-InstallerHubDownloadFile -Url $downloadUrl -Destination $localPath -RetryCount 2 -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent 0 -EndPercent 60 -ActivityPrefix 'download')

  $actual = Get-InstallerHubFileSha256 -Path $localPath
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'verify' -Percent 70 -Status ("Verificando integridad SHA256 de {0}" -f $name)
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue
    throw "SHA256 invalido para prerequisito $name"
  }

  $args = [string]$Prerequisite.silentArgs
  if (-not $args) {
    throw "silentArgs vacio para prerequisito $name"
  }

  if ($OnLog) { & $OnLog 'info' "Ejecutando instalacion silenciosa de $name..." }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'install' -Percent 75 -Status ("Instalando {0}" -f $name)
  $exitCode = Invoke-InstallerHubProcess -FilePath $localPath -Arguments $args -TimeoutSec 3600 -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent 75 -EndPercent 95 -ActivityPrefix 'install')
  if ($exitCode -ne 0) {
    throw "Instalacion de $name fallo con codigo $exitCode"
  }

  if ($OnLog) { & $OnLog 'ok' "Prerequisito instalado: $name" }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'complete' -Percent 100 -Status ("Prerequisito instalado: {0}" -f $name)

  return [pscustomobject]@{
    name = $name
    filePath = $localPath
    sha256 = $actual
    exitCode = $exitCode
  }
}

function Invoke-PrerequisiteInstallationFlow {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Manifest,
    [Parameter(Mandatory = $true)]
    [string]$DownloadRoot,
    [scriptblock]$OnLog,
    [scriptblock]$OnProgress
  )

  $results = @()
  $statuses = @()

  foreach ($item in $Manifest.prerequisites) {
    $status = Test-PrerequisiteStatus -Prerequisite $item
    $statuses += $status
  }

  $missing = @($statuses | Where-Object { -not $_.installed })
  if ($missing.Count -eq 0) {
    if ($OnLog) { & $OnLog 'ok' 'No hay prerequisitos faltantes.' }
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'prerequisites' -Percent 100 -Status 'No hay prerequisitos faltantes.'
    return [pscustomobject]@{
      ok = $true
      statuses = $statuses
      installed = @()
      missing = @()
    }
  }

  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'prerequisites' -Percent 5 -Status ("Se instalaran {0} prerequisitos faltantes." -f $missing.Count)

  $missingCount = [Math]::Max(1, $missing.Count)
  $missingIndex = 0
  foreach ($item in $Manifest.prerequisites) {
    $state = @($statuses | Where-Object { $_.name -eq $item.name } | Select-Object -First 1)[0]
    if ($state.installed) { continue }
    $missingIndex += 1
    $slotStart = [int][Math]::Round((($missingIndex - 1) / $missingCount) * 100)
    $slotEnd = [int][Math]::Round(($missingIndex / $missingCount) * 100)
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'prerequisites' -Percent $slotStart -Status ("Iniciando remediacion de {0}" -f [string]$item.name)

    $result = Install-PrerequisitePackage -Prerequisite $item -DownloadRoot $DownloadRoot -OnLog $OnLog -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent $slotStart -EndPercent $slotEnd -ActivityPrefix ([string]$item.name))
    $results += $result

    $after = Test-PrerequisiteStatus -Prerequisite $item
    if (-not $after.installed) {
      throw "Prerequisito $($item.name) sigue sin cumplir tras instalacion."
    }

    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'prerequisites' -Percent $slotEnd -Status ("Prerequisito verificado: {0}" -f [string]$item.name)
  }

  $finalStatuses = @()
  foreach ($item in $Manifest.prerequisites) {
    $finalStatuses += (Test-PrerequisiteStatus -Prerequisite $item)
  }

  return [pscustomobject]@{
    ok = $true
    statuses = $finalStatuses
    installed = $results
    missing = @($finalStatuses | Where-Object { -not $_.installed })
  }
}

Export-ModuleMember -Function @(
  'Invoke-PrerequisiteInstallationFlow'
)
