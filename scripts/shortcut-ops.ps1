# Shortcut operations helper for EvaluaPro.
# Executes dashboard API actions and bootstraps dashboard when needed.
param(
  [ValidateSet('open-dashboard', 'restart-stack', 'stop-all', 'repair')]
  [string]$Action = 'open-dashboard',
  [ValidateSet('dev', 'prod', 'auto')]
  [string]$Mode = 'auto',
  [ValidateRange(1, 65535)]
  [int]$Port = 4519
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $root 'logs'
$logFile = Join-Path $logDir 'shortcut-ops.log'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-OpLog([string]$message) {
  try {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -LiteralPath $logFile -Value "[$ts] $message"
  } catch {
    # no-op
  }
}

function Get-LockPort {
  $lockPath = Join-Path $logDir 'dashboard.lock.json'
  try {
    if (-not (Test-Path $lockPath)) { return $null }
    $raw = Get-Content -LiteralPath $lockPath -Raw
    if (-not $raw) { return $null }
    $parsed = $raw | ConvertFrom-Json
    if ($parsed -and $parsed.port) {
      $candidate = [int]$parsed.port
      if ($candidate -ge 1 -and $candidate -le 65535) {
        return $candidate
      }
      Write-OpLog("Puerto inválido en lockfile (port=$candidate); se ignora lockfile.")
    }
  } catch {
    Write-OpLog("No se pudo leer lockfile: $($_.Exception.Message)")
  }
  return $null
}

function Get-ApiBase([int]$requestedPort) {
  $lockPort = Get-LockPort
  $requested = if ($requestedPort -ge 1 -and $requestedPort -le 65535) { $requestedPort } else { 4519 }
  $effective = if ($lockPort -and $lockPort -ge 1 -and $lockPort -le 65535) { $lockPort } else { $requested }
  return "http://127.0.0.1:$effective"
}

function Resolve-PowerShellExecutable {
  $candidates = @(
    (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'),
    'powershell.exe',
    'pwsh.exe'
  )
  foreach ($candidate in $candidates) {
    try {
      if ([System.IO.Path]::IsPathRooted($candidate)) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      } else {
        $null = Get-Command $candidate -ErrorAction Stop
        return $candidate
      }
    } catch {
      continue
    }
  }
  throw 'No se encontró ejecutable de PowerShell para iniciar dashboard.'
}

function Invoke-JsonGet([string]$url, [int]$timeoutSec = 2) {
  return Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $timeoutSec
}

function Invoke-JsonPost([string]$url, [hashtable]$body, [int]$timeoutSec = 6) {
  $json = ($body | ConvertTo-Json -Depth 6)
  return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body $json -TimeoutSec $timeoutSec
}

function Wait-DashboardReady([int]$port, [int]$timeoutMs = 30000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(1000, $timeoutMs))
  do {
    $base = Get-ApiBase $port
    try {
      $null = Invoke-JsonGet "$base/api/status" 2
      return $base
    } catch {
      Start-Sleep -Milliseconds 300
    }
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Ensure-DashboardRunning([string]$mode, [int]$port) {
  $base = Wait-DashboardReady -port $port -timeoutMs 2000
  if ($base) { return $base }

  $launcher = Join-Path $root 'scripts\launcher-dashboard.ps1'
  if (-not (Test-Path -LiteralPath $launcher)) {
    throw "No se encontró launcher de dashboard: $launcher"
  }
  $psExe = Resolve-PowerShellExecutable

  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-File', $launcher,
    '-Mode', $mode,
    '-NoOpen',
    '-Port', [string]$port
  )
  Write-OpLog("Iniciando dashboard fallback (mode=$mode, port=$port).")
  Start-Process -FilePath $psExe -ArgumentList $args -WindowStyle Hidden | Out-Null

  $base = Wait-DashboardReady -port $port -timeoutMs 60000
  if (-not $base) {
    throw "Dashboard no respondió en el tiempo esperado."
  }
  return $base
}

function Resolve-Mode([string]$desiredMode, [pscustomobject]$status) {
  if ($desiredMode -eq 'dev' -or $desiredMode -eq 'prod') { return $desiredMode }
  try {
    $running = @($status.running)
    if ($running -contains 'prod') { return 'prod' }
    if ($running -contains 'dev') { return 'dev' }
  } catch {}
  return 'prod'
}

function Wait-HealthReady([string]$base, [int]$timeoutMs = 120000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(5000, $timeoutMs))
  do {
    try {
      $health = Invoke-JsonGet "$base/api/health" 3
      $okApi = $false
      $okPortal = $false
      try { $okApi = [bool]$health.services.apiDocente.ok } catch {}
      try { $okPortal = [bool]$health.services.apiPortal.ok } catch {}
      if ($okApi -and $okPortal) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 1200
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Test-ServiceOk([pscustomobject]$health, [string]$key) {
  try {
    return [bool]$health.services.$key.ok
  } catch {
    return $false
  }
}

function Ensure-StackReady([string]$base, [string]$effectiveMode, [int]$timeoutMs = 150000) {
  try {
    $health = Invoke-JsonGet "$base/api/health" 4
    $apiOk = Test-ServiceOk -health $health -key 'apiDocente'
    $portalOk = Test-ServiceOk -health $health -key 'apiPortal'
    if ($apiOk -and $portalOk) {
      Write-OpLog("Stack ya saludable; solo se abre dashboard (mode=$effectiveMode).")
      return
    }
  } catch {
    # Si no se puede leer salud, intentamos iniciar tareas igualmente.
  }

  Write-OpLog("Stack no saludable; iniciando tareas (mode=$effectiveMode).")
  $null = Invoke-JsonPost "$base/api/start" @{ task = $effectiveMode } 8
  $null = Invoke-JsonPost "$base/api/start" @{ task = 'portal' } 8
  if (-not (Wait-HealthReady -base $base -timeoutMs $timeoutMs)) {
    throw "Stack/portal no alcanzaron estado saludable."
  }
}

function Open-DashboardUrl([string]$base) {
  Start-Process "$base/" | Out-Null
}

try {
  Write-OpLog("Action=$Action Mode=$Mode Port=$Port")
  $bootstrapMode = if ($Mode -eq 'auto') { 'prod' } else { $Mode }
  $base = Ensure-DashboardRunning -mode $bootstrapMode -port $Port
  $status = Invoke-JsonGet "$base/api/status" 3
  $effectiveMode = Resolve-Mode -desiredMode $Mode -status $status

  switch ($Action) {
    'open-dashboard' {
      Ensure-StackReady -base $base -effectiveMode $effectiveMode -timeoutMs 150000
      Open-DashboardUrl $base
      Write-OpLog("Dashboard abierto (mode=$effectiveMode).")
    }
    'restart-stack' {
      $null = Invoke-JsonPost "$base/api/restart" @{ task = 'stack' } 8
      $null = Invoke-JsonPost "$base/api/start" @{ task = $effectiveMode } 8
      $null = Invoke-JsonPost "$base/api/start" @{ task = 'portal' } 8
      if (-not (Wait-HealthReady -base $base -timeoutMs 150000)) {
        throw "Stack/portal no alcanzaron estado saludable."
      }
      Open-DashboardUrl $base
      Write-OpLog("Stack reiniciado y saludable (mode=$effectiveMode).")
    }
    'stop-all' {
      $latest = Invoke-JsonGet "$base/api/status" 3
      $running = @()
      try { $running = @($latest.running) } catch {}
      foreach ($task in $running) {
        try { $null = Invoke-JsonPost "$base/api/stop" @{ task = "$task" } 8 } catch {}
      }
      Write-OpLog("Se solicitó stop para: $($running -join ', ').")
      Open-DashboardUrl $base
    }
    'repair' {
      $run = Invoke-JsonPost "$base/api/repair/run" @{} 10
      $runId = ''
      try { $runId = [string]$run.runId } catch {}
      $deadline = (Get-Date).AddMilliseconds(240000)
      $finalState = ''
      do {
        Start-Sleep -Milliseconds 1500
        $progress = Invoke-JsonGet "$base/api/repair/progress" 4
        try { $finalState = [string]$progress.state } catch { $finalState = '' }
        if ($finalState -eq 'ok' -or $finalState -eq 'error') { break }
      } while ((Get-Date) -lt $deadline)

      if ($finalState -ne 'ok') {
        throw "Repair no terminó en estado OK (state=$finalState, runId=$runId)."
      }
      Open-DashboardUrl $base
      Write-OpLog("Repair completado (runId=$runId).")
    }
  }
} catch {
  Write-OpLog("Fallo en acción: $($_.Exception.Message)")
  [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
  [System.Windows.Forms.MessageBox]::Show(
    "EvaluaPro: no se pudo ejecutar '$Action'.`n$($_.Exception.Message)",
    'EvaluaPro - Acceso directo',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

exit 0
