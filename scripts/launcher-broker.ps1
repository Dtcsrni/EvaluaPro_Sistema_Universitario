# Unified Windows launcher broker for EvaluaPro.
# Orchestrates dashboard bootstrap, stack start, shortcuts, Hub and splash state.
param(
  [ValidateSet('open-dashboard', 'restart-stack', 'stop-all', 'repair', 'open-hub', 'verify-installation')]
  [string]$Action = 'open-dashboard',
  [ValidateSet('dev', 'prod', 'auto')]
  [string]$Mode = 'auto',
  [ValidateRange(1, 65535)]
  [int]$Port = 4519,
  [string]$RunId = '',
  [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $root 'logs'
$logFile = Join-Path $logDir 'launcher-broker.log'
$dashboardLauncher = Join-Path $root 'scripts\launcher-dashboard.ps1'
$hubManifestPath = Join-Path $root 'dist\installer\installer-local-paths.json'
$hubManifestPathInternal = Join-Path $root 'dist\installer\_internal\installer-local-paths.json'
$manifestScript = Join-Path $root 'scripts\generate-installation-manifest.ps1'
$updateConfigPath = Join-Path $root 'config\update-config.json'
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-BrokerLog([string]$message) {
  try {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -LiteralPath $logFile -Value "[$ts] $message"
  } catch {}
}

function Get-EffectiveRunId {
  if (-not [string]::IsNullOrWhiteSpace($RunId)) { return $RunId.Trim() }
  return ("broker-" + [guid]::NewGuid().ToString('N'))
}

$script:RunIdEffective = Get-EffectiveRunId
$script:BootstrapPath = Join-Path $logDir ("bootstrap-state-{0}.json" -f ($script:RunIdEffective -replace '[^a-zA-Z0-9_-]', ''))

function Set-BootstrapState {
  param(
    [string]$State,
    [string]$Message,
    [string]$DesiredMode = '',
    [hashtable]$Meta = @{}
  )

  $payload = [ordered]@{
    runId = $script:RunIdEffective
    action = $Action
    state = $State
    message = $Message
    desiredMode = $DesiredMode
    port = $Port
    timestamp = (Get-Date).ToString('o')
    meta = $Meta
  }
  try {
    [IO.File]::WriteAllText($script:BootstrapPath, ($payload | ConvertTo-Json -Depth 8), [Text.Encoding]::UTF8)
  } catch {}
}

function Resolve-PowerShellExecutable {
  $candidates = @(
    (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'),
    'powershell.exe',
    'pwsh.exe'
  )
  foreach ($candidate in $candidates) {
    try {
      if ([IO.Path]::IsPathRooted($candidate)) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      } else {
        $null = Get-Command $candidate -ErrorAction Stop
        return $candidate
      }
    } catch {}
  }
  throw 'No se encontro ejecutable de PowerShell.'
}

function Get-LockPort {
  $lockPath = Join-Path $logDir 'dashboard.lock.json'
  try {
    if (-not (Test-Path -LiteralPath $lockPath)) { return $null }
    $raw = Get-Content -LiteralPath $lockPath -Raw
    if (-not $raw) { return $null }
    $parsed = $raw | ConvertFrom-Json
    $candidate = if ($null -ne $parsed.port) { [int]$parsed.port } else { 0 }
    if ($candidate -ge 1 -and $candidate -le 65535) { return $candidate }
  } catch {
    Write-BrokerLog("No se pudo leer lockfile: $($_.Exception.Message)")
  }
  return $null
}

function Get-ApiBase([int]$requestedPort) {
  $effectivePort = $requestedPort
  $lockPort = Get-LockPort
  if ($lockPort) { $effectivePort = $lockPort }
  return "http://127.0.0.1:$effectivePort"
}

function Invoke-JsonGet([string]$url, [int]$timeoutSec = 3) {
  Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $timeoutSec
}

function Invoke-JsonPost([string]$url, [hashtable]$body, [int]$timeoutSec = 10) {
  $json = $body | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body $json -TimeoutSec $timeoutSec
}

function Wait-DashboardReady([int]$requestedPort, [int]$timeoutMs = 45000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(2000, $timeoutMs))
  do {
    $base = Get-ApiBase $requestedPort
    try {
      $status = Invoke-JsonGet "$base/api/status" 2
      return [pscustomobject]@{
        base = $base
        status = $status
      }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Ensure-DashboardRunning([string]$bootstrapMode, [int]$requestedPort) {
  Set-BootstrapState -State 'booting_dashboard' -Message 'Inicializando control plane local.' -DesiredMode $bootstrapMode
  $ready = Wait-DashboardReady -requestedPort $requestedPort -timeoutMs 2000
  if ($ready) { return $ready }
  if (-not (Test-Path -LiteralPath $dashboardLauncher)) {
    throw "No se encontro launcher del dashboard: $dashboardLauncher"
  }
  $psExe = Resolve-PowerShellExecutable
  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-STA',
    '-File', $dashboardLauncher,
    '-Mode', $bootstrapMode,
    '-Port', [string]$requestedPort,
    '-NoOpen'
  )
  Write-BrokerLog("Iniciando dashboard (mode=$bootstrapMode, port=$requestedPort, runId=$script:RunIdEffective).")
  Start-Process -FilePath $psExe -ArgumentList $args -WindowStyle Hidden | Out-Null
  $ready = Wait-DashboardReady -requestedPort $requestedPort -timeoutMs 90000
  if (-not $ready) {
    throw 'Dashboard no respondio en el tiempo esperado.'
  }
  return $ready
}

function Resolve-DesiredMode([string]$modeRequested, $status) {
  if ($modeRequested -eq 'dev' -or $modeRequested -eq 'prod') { return $modeRequested }
  try {
    $running = @($status.running)
    if ($running -contains 'prod') { return 'prod' }
    if ($running -contains 'dev') { return 'dev' }
  } catch {}
  return 'prod'
}

function Test-ServiceOk($health, [string]$key) {
  try {
    return [bool]$health.services.$key.ok
  } catch {
    return $false
  }
}

function Test-RequiresLocalPortal {
  try {
    if (Test-Path -LiteralPath $updateConfigPath) {
      $raw = Get-Content -LiteralPath $updateConfigPath -Raw -Encoding utf8
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $cfg = $raw | ConvertFrom-Json
        $flavorId = [string]$cfg.flavorId
        if (-not [string]::IsNullOrWhiteSpace($flavorId)) {
          return ($flavorId.Trim().ToLowerInvariant() -ne 'docente-local')
        }
      }
    }
  } catch {}
  return $false
}

function Wait-DesiredHealth([string]$base, [string]$desiredMode, [int]$timeoutMs = 150000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(5000, $timeoutMs))
  $requireLocalPortal = Test-RequiresLocalPortal
  $portalStarted = $false
  do {
    try {
      $health = Invoke-JsonGet "$base/api/health" 4
      $apiOk = Test-ServiceOk -health $health -key 'apiDocente'
      $webOk = if ($desiredMode -eq 'dev') {
        Test-ServiceOk -health $health -key 'webDocenteDev'
      } else {
        Test-ServiceOk -health $health -key 'webDocenteProd'
      }
      $portalOk = if ($requireLocalPortal) { Test-ServiceOk -health $health -key 'apiPortal' } else { $true }
      if ($apiOk -and $webOk) {
        return [pscustomobject]@{
          ok = $true
          degraded = ($requireLocalPortal -and (-not $portalOk))
          health = $health
        }
      }
      if ($requireLocalPortal -and -not $portalStarted) {
        Set-BootstrapState -State 'booting_portal' -Message 'Sincronizando portal y servicios paralelos.' -DesiredMode $desiredMode -Meta @{ base = $base }
        $portalStarted = $true
      }
    } catch {}
    Start-Sleep -Milliseconds 1200
  } while ((Get-Date) -lt $deadline)

  $health = $null
  try { $health = Invoke-JsonGet "$base/api/health" 4 } catch {}
  return [pscustomobject]@{
    ok = $false
    degraded = $true
    health = $health
  }
}

function Ensure-StackReady([string]$base, [string]$desiredMode, [int]$timeoutMs = 150000) {
  Set-BootstrapState -State 'booting_stack' -Message ("Levantando stack {0}." -f $desiredMode.ToUpperInvariant()) -DesiredMode $desiredMode -Meta @{ base = $base }
  try {
    $null = Invoke-JsonPost "$base/api/lifecycle/policy" @{ desiredMode = $desiredMode } 8
  } catch {}
  $null = Invoke-JsonPost "$base/api/start" @{ task = $desiredMode } 8
  if (Test-RequiresLocalPortal) {
    try { $null = Invoke-JsonPost "$base/api/start" @{ task = 'portal' } 8 } catch {}
  }
  return Wait-DesiredHealth -base $base -desiredMode $desiredMode -timeoutMs $timeoutMs
}

function Open-Url([string]$url) {
  if ($NoOpen) { return }
  Start-Process $url | Out-Null
}

function Resolve-HubExecutablePath {
  $manifestPath = if (Test-Path -LiteralPath $hubManifestPath) { $hubManifestPath } elseif (Test-Path -LiteralPath $hubManifestPathInternal) { $hubManifestPathInternal } else { '' }
  if (-not $manifestPath) {
    throw "No se encontro manifiesto de hubs: $hubManifestPath ni $hubManifestPathInternal"
  }

  $raw = Get-Content -LiteralPath $manifestPath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Manifiesto de hubs vacio: $manifestPath"
  }
  $manifest = $raw | ConvertFrom-Json
  $candidate = [string]$manifest.recommendedHubExecutablePath
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    throw "Manifiesto sin recommendedHubExecutablePath: $manifestPath"
  }
  if (-not (Test-Path -LiteralPath $candidate)) {
    throw "No se encontro EXE del Hub recomendado: $candidate"
  }
  return $candidate
}

function Open-Hub {
  $hubExecutablePath = Resolve-HubExecutablePath
  Write-BrokerLog("Abriendo Hub empaquetado: $hubExecutablePath")
  Start-Process -FilePath $hubExecutablePath -WorkingDirectory (Split-Path -Path $hubExecutablePath -Parent) | Out-Null
}

function Invoke-ManifestRefresh {
  if (-not (Test-Path -LiteralPath $manifestScript)) { return $null }
  $psExe = Resolve-PowerShellExecutable
  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $manifestScript,
    '-Port', [string]$Port
  )
  try {
    & $psExe @args | Out-Null
  } catch {
    Write-BrokerLog("No se pudo refrescar manifiesto: $($_.Exception.Message)")
  }
}

try {
  Write-BrokerLog("Broker start action=$Action mode=$Mode port=$Port runId=$script:RunIdEffective")
  $bootstrapMode = if ($Mode -eq 'auto') { 'prod' } else { $Mode }

  switch ($Action) {
    'open-hub' {
      Set-BootstrapState -State 'booting_dashboard' -Message 'Abriendo Installer Hub.' -DesiredMode $bootstrapMode
      Invoke-ManifestRefresh
      Open-Hub
      Set-BootstrapState -State 'healthy' -Message 'Installer Hub abierto.' -DesiredMode $bootstrapMode
      return
    }
    'verify-installation' {
      Set-BootstrapState -State 'booting_dashboard' -Message 'Verificando instalacion local.' -DesiredMode $bootstrapMode
      Invoke-ManifestRefresh
      Set-BootstrapState -State 'healthy' -Message 'Verificacion completada.' -DesiredMode $bootstrapMode
      return
    }
  }

  $ready = Ensure-DashboardRunning -bootstrapMode $bootstrapMode -requestedPort $Port
  $base = [string]$ready.base
  $status = $ready.status
  $desiredMode = Resolve-DesiredMode -modeRequested $Mode -status $status

  switch ($Action) {
    'open-dashboard' {
      $result = Ensure-StackReady -base $base -desiredMode $desiredMode -timeoutMs 150000
      Invoke-ManifestRefresh
      if ($result.ok) {
        Set-BootstrapState -State 'healthy' -Message 'Plataforma docente lista.' -DesiredMode $desiredMode -Meta @{ degraded = [bool]$result.degraded; base = $base }
        Open-Url "$base/"
      } else {
        Set-BootstrapState -State 'degraded' -Message 'Dashboard activo, pero el stack no alcanzo salud completa.' -DesiredMode $desiredMode -Meta @{ base = $base }
        if (-not $NoOpen) { Open-Url "$base/" }
      }
    }
    'restart-stack' {
      Set-BootstrapState -State 'booting_stack' -Message 'Reiniciando stack local.' -DesiredMode $desiredMode
      $null = Invoke-JsonPost "$base/api/restart" @{ task = 'stack' } 8
      $result = Ensure-StackReady -base $base -desiredMode $desiredMode -timeoutMs 150000
      Invoke-ManifestRefresh
      if (-not $result.ok) {
        throw 'Stack reiniciado pero no saludable.'
      }
      Set-BootstrapState -State 'healthy' -Message 'Stack reiniciado y saludable.' -DesiredMode $desiredMode -Meta @{ base = $base }
      Open-Url "$base/"
    }
    'stop-all' {
      Set-BootstrapState -State 'booting_stack' -Message 'Deteniendo tareas activas.' -DesiredMode $desiredMode
      $latest = Invoke-JsonGet "$base/api/status" 4
      foreach ($task in @($latest.running)) {
        try { $null = Invoke-JsonPost "$base/api/stop" @{ task = [string]$task } 8 } catch {}
      }
      Invoke-ManifestRefresh
      Set-BootstrapState -State 'healthy' -Message 'Tareas detenidas.' -DesiredMode $desiredMode -Meta @{ base = $base }
      Open-Url "$base/"
    }
    'repair' {
      Set-BootstrapState -State 'booting_stack' -Message 'Ejecutando reparacion controlada.' -DesiredMode $desiredMode
      $run = Invoke-JsonPost "$base/api/repair/run" @{} 12
      $runIdRepair = if ($null -ne $run.runId) { [string]$run.runId } else { '' }
      $deadline = (Get-Date).AddMinutes(4)
      $state = 'running'
      while ((Get-Date) -lt $deadline -and $state -eq 'running') {
        Start-Sleep -Milliseconds 1500
        $progress = Invoke-JsonGet "$base/api/repair/progress" 4
        $state = if ($null -ne $progress.state) { [string]$progress.state } else { '' }
      }
      Invoke-ManifestRefresh
      if ($state -ne 'ok') {
        throw "Repair no termino correctamente (state=$state, runId=$runIdRepair)."
      }
      Set-BootstrapState -State 'healthy' -Message 'Repair completado.' -DesiredMode $desiredMode -Meta @{ base = $base; repairRunId = $runIdRepair }
      Open-Url "$base/"
    }
  }
} catch {
  $message = $_.Exception.Message
  Write-BrokerLog("Broker failed: $message")
  Set-BootstrapState -State 'failed' -Message $message -DesiredMode $Mode
  [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
  if (-not $NoOpen) {
    [System.Windows.Forms.MessageBox]::Show(
      "EvaluaPro no pudo completar '$Action'.`n$message",
      'EvaluaPro - Launcher Broker',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
  exit 1
}

exit 0
