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

function Get-RegisteredWslDistroNames {
  $simulated = [string]$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_DISTROS
  if (-not [string]::IsNullOrWhiteSpace($simulated)) {
    return @(
      $simulated -split '[,;]' |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
  }

  try {
    $raw = (& wsl.exe -l -q 2>$null) -join "`n"
    $normalized = $raw -replace "`0", ''
    return @(
      $normalized -split '\r?\n' |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
  } catch {
    return @()
  }
}

function Test-WslDistroRegistered {
  param([string]$Name)

  if ([string]::IsNullOrWhiteSpace($Name)) { return $false }
  $target = $Name.Trim()
  foreach ($distro in @(Get-RegisteredWslDistroNames)) {
    if ([string]::Equals([string]$distro, $target, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }
  return $false
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
    [string](@($Status.userDistros)[0])
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
    $requiresReboot = $true
    $steps += [pscustomobject]@{
      title = 'Instalar distro soportada para WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl --install -d $targetDistro"
    }
    $steps += [pscustomobject]@{
      title = 'Finalizar inicializacion de distro tras reinicio'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""echo distro-ready"""
    }
  } else {
    $steps += [pscustomobject]@{
      title = 'Instalar Docker Engine dentro de WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""curl -fsSL https://get.docker.com -o /tmp/evaluapro-get-docker.sh && sh /tmp/evaluapro-get-docker.sh"""
    }
    $steps += [pscustomobject]@{
      title = 'Iniciar el daemon Docker en WSL2'
      executor = 'host'
      autoRunnable = $true
      command = "wsl -d $targetDistro -u root -- sh -lc ""service docker start || (nohup dockerd >/var/log/dockerd.log 2>&1 &)"""
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
            if ($distro -and (Test-WslDistroRegistered -Name $distro)) {
              if ($OnLog) {
                & $OnLog 'ok' ("[auto-bootstrap] distro WSL ya registrada; se omite wsl --install -d {0}." -f $distro)
              }
              Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $endPercent -Status ("Distro WSL ya registrada: {0}" -f $distro)
            } else {
              $wslInstallParameters = @('--install')
              if ($distro) {
                $wslInstallParameters += @('-d', $distro)
              }
              Start-Process -FilePath 'wsl.exe' -ArgumentList $wslInstallParameters -WindowStyle Hidden | Out-Null
              if ($OnLog) {
                & $OnLog 'warn' ("[auto-bootstrap] instalacion WSL iniciada en segundo plano. Requiere completar setup manual/reinicio.")
              }
              Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-bootstrap' -Percent $endPercent -Status ("Instalacion WSL iniciada: {0}" -f [string]$step.title)
            }
          } else {
            $global:LASTEXITCODE = 0
            Invoke-Expression -Command $rawCommand | Out-Null
            if ($global:LASTEXITCODE -ne 0) {
              throw ("Comando finalizo con exit code {0}." -f $global:LASTEXITCODE)
            }
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

function Start-DockerDesktopIfAvailable {
  param(
    [scriptblock]$OnLog,
    [scriptblock]$OnProgress
  )

  $candidates = @(
    (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path ${env:LOCALAPPDATA} 'Docker\Docker Desktop.exe')
  )
  $dockerDesktop = @($candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
  if (-not $dockerDesktop) { return $false }

  if ($OnLog) { & $OnLog 'info' ("Iniciando Docker Desktop: {0}" -f [string]$dockerDesktop) }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 10 -Status 'Iniciando Docker Desktop.'
  try {
    Start-Process -FilePath ([string]$dockerDesktop) -WindowStyle Minimized | Out-Null
    return $true
  } catch {
    if ($OnLog) { & $OnLog 'warn' ("No se pudo iniciar Docker Desktop automaticamente: {0}" -f $_.Exception.Message) }
    return $false
  }
}

function Wait-DockerRuntimeReady {
  param(
    [int]$TimeoutSec = 300,
    [scriptblock]$OnLog,
    [scriptblock]$OnProgress
  )

  $deadline = (Get-Date).AddSeconds([Math]::Max(10, $TimeoutSec))
  $lastStatus = $null
  do {
    $lastStatus = Get-DockerRuntimeStatus
    if ([bool]$lastStatus.installed -and [bool]$lastStatus.ready) {
      if ($OnLog) { & $OnLog 'ok' ("Runtime Docker listo: {0}" -f [string]$lastStatus.mode) }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 100 -Status ("Runtime Docker listo: {0}" -f [string]$lastStatus.mode)
      return $lastStatus
    }
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'docker-runtime' -Percent 35 -Status 'Esperando daemon Docker.'
    Start-Sleep -Seconds 5
  } while ((Get-Date) -lt $deadline)

  if ($OnLog -and $lastStatus) {
    & $OnLog 'warn' ("Runtime Docker no quedo listo antes del timeout: {0}" -f [string]$lastStatus.reason)
  }
  return $lastStatus
}

function Resolve-PrereqPackageSelection {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite,
    [scriptblock]$OnLog
  )

  $downloadUrl = [string]$Prerequisite.downloadUrl
  if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
    throw "downloadUrl vacia para prerequisito $($Prerequisite.name)"
  }

  $sourceFileName = [System.IO.Path]::GetFileName(([uri]$downloadUrl).AbsolutePath)
  if ([string]::IsNullOrWhiteSpace($sourceFileName)) {
    $sourceFileName = ("{0}.bin" -f (([string]$Prerequisite.name) -replace '[^a-zA-Z0-9\-_.]', '-'))
  }

  $inline = [string]$Prerequisite.sha256
  if ($inline -match '^[a-fA-F0-9]{64}$') {
    return [pscustomobject]@{
      expectedSha256 = $inline.ToLowerInvariant()
      downloadUrl = $downloadUrl
      fileName = $sourceFileName
      resolvedBy = 'inline'
    }
  }

  $shaUrl = [string]$Prerequisite.sha256Url
  if (-not $shaUrl) {
    throw "No se encontro sha256 ni sha256Url para prerequisito $($Prerequisite.name)."
  }

  if ($OnLog) { & $OnLog 'info' "Resolviendo SHA256 remoto para $($Prerequisite.name)..." }

  $shaText = ''
  $headers = @{ 'User-Agent' = 'EvaluaPro-InstallerHub' }
  try {
    $response = Invoke-InstallerHubWebRequest -Url $shaUrl -Method GET -Headers $headers -TimeoutSec 30 -RetryCount 2
    $shaText = [string]$response.Content
  } catch {
    if ($OnLog) {
      & $OnLog 'warn' ("Fallo lectura SHASUMS por WebRequest para {0}. Se intentara fallback de descarga robusta: {1}" -f [string]$Prerequisite.name, [string]$_.Exception.Message)
    }
    $shaFallbackRoot = Join-Path $env:TEMP ('evaluapro-shasums-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $shaFallbackRoot -Force | Out-Null
    $shaFallbackPath = Join-Path $shaFallbackRoot 'SHASUMS256.txt'
    try {
      Invoke-InstallerHubDownloadFile -Url $shaUrl -Destination $shaFallbackPath
      $shaText = [string](Get-Content -LiteralPath $shaFallbackPath -Raw -Encoding utf8)
      if ($OnLog) {
        & $OnLog 'info' ("SHASUMS obtenido por fallback robusto para {0}." -f [string]$Prerequisite.name)
      }
    } finally {
      if (Test-Path -LiteralPath $shaFallbackRoot) {
        Remove-Item -LiteralPath $shaFallbackRoot -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($shaText)) {
    throw "No se pudo obtener contenido SHASUMS para $($Prerequisite.name)."
  }

  $pattern = [string]$Prerequisite.sha256Pattern
  $fallbackRegex = ''
  $ruleType = [string]$Prerequisite.detectRule.type
  if ($ruleType -eq 'node_major') {
    $requiredMajor = [int]$Prerequisite.detectRule.minMajor
    $fallbackRegex = ('^node-v{0}\.\d+\.\d+-x64\.msi$' -f $requiredMajor)
  }

  $resolved = Resolve-InstallerHubPackageFromShasums -Text $shaText -PreferredPattern $pattern -FallbackRegex $fallbackRegex
  if (-not $resolved -or [string]::IsNullOrWhiteSpace([string]$resolved.sha256)) {
    throw "No se pudo resolver SHA256 desde sha256Url para $($Prerequisite.name)."
  }

  $resolvedFileName = if ([string]::IsNullOrWhiteSpace([string]$resolved.fileName)) { $sourceFileName } else { [string]$resolved.fileName }
  $resolvedUrl = $downloadUrl
  if ($resolvedFileName -ne $sourceFileName) {
    $baseUri = [uri]$downloadUrl
    $resolvedUri = [uri]::new($baseUri, $resolvedFileName)
    $resolvedUrl = [string]$resolvedUri.AbsoluteUri
    if ($OnLog) {
      & $OnLog 'info' ("Ajustando artefacto remoto para {0}: {1} -> {2}" -f [string]$Prerequisite.name, $sourceFileName, $resolvedFileName)
      & $OnLog 'warn' ("Fallback dinamico aplicado para {0} usando {1}" -f [string]$Prerequisite.name, [string]$resolved.matchedPattern)
    }
  }

  return [pscustomobject]@{
    expectedSha256 = [string]$resolved.sha256
    downloadUrl = $resolvedUrl
    fileName = $resolvedFileName
    resolvedBy = [string]$resolved.matchedBy
    matchedPattern = [string]$resolved.matchedPattern
  }
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
    if ($status.installed -and $status.ready) {
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

    if ($status.desktopInstalled -and -not $status.ready -and (Get-DockerRuntimePreference) -ne 'wsl2-engine') {
      Start-DockerDesktopIfAvailable -OnLog $OnLog -OnProgress $OnProgress | Out-Null
      $statusAfterDesktopStart = Wait-DockerRuntimeReady -TimeoutSec 90 -OnLog $OnLog -OnProgress $OnProgress
      if ($statusAfterDesktopStart -and $statusAfterDesktopStart.installed -and $statusAfterDesktopStart.ready) {
        return [pscustomobject]@{
          name = [string]$Prerequisite.name
          filePath = ''
          sha256 = ''
          exitCode = 0
          mode = [string]$statusAfterDesktopStart.mode
          autoStarted = 'Docker Desktop'
        }
      }
      if ($OnLog) {
        & $OnLog 'warn' 'Docker Desktop no quedo operativo tras el intento automatico; se continuara con bootstrap WSL2 si el sistema lo permite.'
      }
      $status = $statusAfterDesktopStart
    }

    if ($status.installed -and -not $status.ready -and $OnLog) {
      & $OnLog 'warn' ("Runtime Docker detectado pero no utilizable aun: {0}" -f [string]$status.reason)
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
      if ($statusAfterAuto.installed -and $statusAfterAuto.ready) {
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
    $message = "Bootstrap guiado pendiente para runtime Docker Windows. " + $detail
    if ([bool]$plan.requiresReboot) {
      $restartReason = 'Se requiere reiniciar Windows para completar la activacion de WSL2 y retomar la instalacion.'
      $exception = [System.Exception]::new($message + ' ' + $restartReason)
      $exception.Data['requiresRestart'] = $true
      $exception.Data['restartReason'] = $restartReason
      $exception.Data['phase'] = 'wsl_bootstrap'
      $exception.Data['resumeToken'] = ('resume-' + [Guid]::NewGuid().ToString('N'))
      throw $exception
    }

    throw $message
  }

  if ($ruleType -eq 'node_major_wsl') {
    $runtimeStatus = Get-DockerRuntimeStatus
    if ([bool]$runtimeStatus.ready -and [string]$runtimeStatus.mode -eq 'desktop') {
      if ($OnLog) { & $OnLog 'ok' 'Node.js WSL2 omitido: Docker Desktop activo no requiere Node dentro de WSL2.' }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'node-wsl' -Percent 100 -Status 'Node.js WSL2 no requerido con Docker Desktop.'
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        filePath = ''
        sha256 = ''
        exitCode = 0
        mode = 'not-required-desktop'
      }
    }

    $required = [int]$Prerequisite.detectRule.minMajor
    $distro = Get-PreferredWslBootstrapDistro
    $actual = Get-WslNodeMajorVersion
    if ($actual -ge $required) {
      if ($OnLog) { & $OnLog 'ok' ("Node.js WSL2 detectado en {0}: {1}.x" -f $distro, $actual) }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'node-wsl' -Percent 100 -Status ("Node.js WSL2 disponible en {0}: {1}.x" -f [string]$distro, $actual)
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        filePath = ''
        sha256 = ''
        exitCode = 0
        mode = 'wsl2-node'
        distro = [string]$distro
      }
    }

    if (-not $runtimeStatus.installed) {
      throw ("Node.js WSL2 requiere un runtime Docker/WSL2 listo primero. " + [string]$runtimeStatus.reason)
    }

    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'node-wsl' -Percent 5 -Status ("Instalando Node.js 24 dentro de {0}" -f [string]$distro)
    if ($OnLog) {
      & $OnLog 'info' ("Provisionando Node.js WSL2 en {0}..." -f $distro)
      & $OnLog 'info' ("Instalar Node.js 24 dentro de WSL2: wsl -d {0} -u root -- sh -lc ""curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs""" -f $distro)
    }

    if (@('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_BOOTSTRAP).Trim().ToLowerInvariant()) {
      $env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_MAJOR = [string]$required
    } else {
      $installCommand = ('wsl -d {0} -u root -- sh -lc "curl -fsSL https://deb.nodesource.com/setup_{1}.x | bash - && apt-get install -y nodejs"' -f $distro, $required)
      Invoke-Expression -Command $installCommand | Out-Null
    }

    $actualAfter = Get-WslNodeMajorVersion
    if ($actualAfter -lt $required) {
      throw ("Node.js WSL2 sigue sin cumplir en {0}. Detectado: {1}.x. Requerido: {2}.x" -f $distro, $actualAfter, $required)
    }

    if ($OnLog) { & $OnLog 'ok' ("Node.js WSL2 listo en {0}: {1}.x" -f $distro, $actualAfter) }
    Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'node-wsl' -Percent 100 -Status ("Node.js WSL2 listo en {0}: {1}.x" -f [string]$distro, $actualAfter)
    return [pscustomobject]@{
      name = [string]$Prerequisite.name
      filePath = ''
      sha256 = ''
      exitCode = 0
      mode = 'wsl2-node'
      distro = [string]$distro
    }
  }

  if (-not (Test-Path $DownloadRoot)) {
    New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
  }

  $name = [string]$Prerequisite.name
  $selection = Resolve-PrereqPackageSelection -Prerequisite $Prerequisite -OnLog $OnLog
  $downloadUrl = [string]$selection.downloadUrl
  $fileName = [string]$selection.fileName
  $expected = [string]$selection.expectedSha256
  $localPath = Join-Path $DownloadRoot $fileName

  if ($OnLog) { & $OnLog 'info' "Descargando prerequisito: $name" }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'download' -Percent 0 -Status ("Preparando descarga de {0}" -f $name)
  Invoke-InstallerHubDownloadFile -Url $downloadUrl -Destination $localPath -RetryCount 2 -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent 0 -EndPercent 60 -ActivityPrefix 'download')

  $actual = Get-InstallerHubFileSha256 -Path $localPath
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'verify' -Percent 70 -Status ("Verificando integridad SHA256 de {0}" -f $name)
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue
    throw "SHA256 invalido para prerequisito $name"
  }

  $silentInstallSwitches = [string]$Prerequisite.silentArgs
  if (-not $silentInstallSwitches) {
    throw "silentArgs vacio para prerequisito $name"
  }

  if ($OnLog) { & $OnLog 'info' "Ejecutando instalacion silenciosa de $name..." }
  Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'install' -Percent 75 -Status ("Instalando {0}" -f $name)
  $exitCode = Invoke-InstallerHubProcess -FilePath $localPath -Arguments $silentInstallSwitches -TimeoutSec 3600 -OnProgress (New-ScaledProgressCallback -OnProgress $OnProgress -StartPercent 75 -EndPercent 95 -ActivityPrefix 'install')
  $processResult = Get-InstallerHubLastProcessResult
  $msiLogPath = ''
  if ($processResult -and [bool]$processResult.isMsi -and -not [string]::IsNullOrWhiteSpace([string]$processResult.msiLogPath)) {
    $msiLogPath = [string]$processResult.msiLogPath
  }

  if ($exitCode -ne 0) {
    $afterStatus = Test-PrerequisiteStatus -Prerequisite $Prerequisite
    if ([bool]$afterStatus.installed) {
      if ($OnLog) {
        & $OnLog 'warn' ("$name devolvio codigo $exitCode, pero el prerequisito quedo disponible tras revalidacion ($($afterStatus.actualVersion)).")
      }
      Invoke-PrereqProgress -OnProgress $OnProgress -Activity 'install' -Percent 100 -Status ("{0} quedo listo tras revalidacion" -f $name)
    } else {
      if ($exitCode -in @(3010, 1641)) {
        $restartReason = "Se requiere reiniciar Windows para completar la instalacion de $name."
        $exception = [System.Exception]::new($restartReason)
        $exception.Data['requiresRestart'] = $true
        $exception.Data['restartReason'] = $restartReason
        $exception.Data['phase'] = 'prerequisitos'
        $exception.Data['resumeToken'] = ('resume-' + [Guid]::NewGuid().ToString('N'))
        throw $exception
      }

      $logHint = if ([string]::IsNullOrWhiteSpace($msiLogPath)) { '' } else { " Log MSI: $msiLogPath." }
      if ($OnLog -and -not [string]::IsNullOrWhiteSpace($msiLogPath)) {
        & $OnLog 'error' ("$name fallo con codigo $exitCode. Log MSI: $msiLogPath")
      }

      if ($exitCode -eq 1603) {
        throw "Instalacion de $name fallo con codigo 1603 (MSI).$logHint Verifica permisos administrativos, conflictos con instalacion previa de Node.js y el detalle de Windows Installer. Estado posterior: $([string]$afterStatus.reason)"
      }

      throw "Instalacion de $name fallo con codigo $exitCode.$logHint Estado posterior: $([string]$afterStatus.reason)"
    }
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
      requiresRestart = $false
      restartReason = ''
      resumeToken = ''
      phase = ''
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
    requiresRestart = $false
    restartReason = ''
    resumeToken = ''
    phase = ''
  }
}

Export-ModuleMember -Function @(
  'Invoke-PrerequisiteInstallationFlow'
)
