# Windows tray launcher for the local dashboard/stack.
# - Shows a notification-area icon with live system status.
# - Controls the existing dashboard API (/api/*).
# Usage (recommended via VBS wrapper): powershell.exe -STA -WindowStyle Hidden -File scripts\launcher-tray.ps1 -Mode none -Port 4519

param(
  [ValidateSet('dev','prod','none')]
  [string]$Mode = 'none',
  [int]$Port = 4519,
  [switch]$NoOpen,
  [switch]$Attach
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$logDir = Join-Path $root 'logs'
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir 'tray.log'

function Log([string]$msg) {
  try {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $logFile -Value ("[$ts] " + $msg)
  } catch {
    # ignore logging failures
  }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  return $null
}

function Get-ApiBase {
  return "http://127.0.0.1:$Port"
}

function Get-JsonOrNull([string]$path) {
  try {
    return Invoke-RestMethod -Uri ((Get-ApiBase) + $path) -TimeoutSec 1
  } catch {
    Log("GET $path failed")
    return $null
  }
}

function Invoke-PostJsonOrNull([string]$path, [hashtable]$body) {
  try {
    $json = ($body | ConvertTo-Json -Depth 5)
    return Invoke-RestMethod -Method Post -Uri ((Get-ApiBase) + $path) -ContentType 'application/json' -Body $json -TimeoutSec 2
  } catch {
    Log("POST $path failed")
    return $null
  }
}

function Start-DashboardIfNeeded {
  Log("Tray start. Mode=$Mode Port=$Port Attach=$Attach")
  $status = Get-JsonOrNull '/api/status'
  if ($status) { return @{ started = $false; pid = $null } }

  if ($Attach) {
    return @{ started = $false; pid = $null }
  }

  $node = Get-NodePath
  if (-not $node) {
    Log('Node no encontrado en PATH.')
    [System.Windows.Forms.MessageBox]::Show('Node no encontrado en PATH.', 'SEU - Bandeja', 'OK', 'Error') | Out-Null
    return @{ started = $false; pid = $null }
  }

  Log("Node: $node")

  $script = Join-Path $root 'scripts\launcher-dashboard.mjs'
  $dashArgs = @($script, '--mode', $Mode, '--port', [string]$Port, '--no-open')

  $p = Start-Process -FilePath $node -WorkingDirectory $root -ArgumentList $dashArgs -PassThru -WindowStyle Hidden
  Log("Dashboard spawn PID=$($p.Id)")

  # Esperar breve a que abra puerto.
  $deadline = (Get-Date).AddSeconds(6)
  do {
    Start-Sleep -Milliseconds 250
    $status = Get-JsonOrNull '/api/status'
  } while (-not $status -and (Get-Date) -lt $deadline)

  if ($status) { Log('Dashboard OK (api/status responde)') }
  else { Log('Dashboard NO responde en el tiempo esperado') }

  return @{ started = $true; pid = $p.Id }
}

function Get-SystemMood($status, $health) {
  if (-not $status) { return 'error' }

  $running = @()
  try { $running = @($status.running) } catch { $running = @() }
  $hasDevOrProd = $running -contains 'dev' -or $running -contains 'prod'
  $hasPortal = $running -contains 'portal'

  $mode = ("$($status.mode)").ToLowerInvariant()
  if ($mode -ne 'prod') { $mode = 'dev' }

  $services = $null
  try { $services = $health.services } catch { $services = $null }

  $expected = @()
  if ($hasDevOrProd) {
    $expected += @('apiDocente')
    $expected += @($(if ($mode -eq 'prod') { 'webDocenteProd' } else { 'webDocenteDev' }))
  }
  if ($hasPortal) { $expected += @('apiPortal') }

  if ($expected.Count -eq 0) { return 'info' }

  $ok = 0
  $down = 0
  $unknown = 0

  foreach ($key in $expected) {
    $info = $null
    try { $info = $services.$key } catch { $info = $null }

    if (-not $info -or ($info.ok -isnot [bool])) {
      $unknown += 1
      continue
    }

    if ($info.ok) { $ok += 1 } else { $down += 1 }
  }

  if ($down -gt 0) { return 'error' }
  if ($unknown -gt 0) { return 'warn' }
  return 'ok'
}

function Get-MoodIcon([string]$mood) {
  switch ($mood) {
    'ok' { return [System.Drawing.SystemIcons]::Shield }
    'warn' { return [System.Drawing.SystemIcons]::Warning }
    'error' { return [System.Drawing.SystemIcons]::Error }
    default { return [System.Drawing.SystemIcons]::Information }
  }
}

function ConvertTo-ShortText([string]$s, [int]$max = 60) {
  if (-not $s) { return '' }
  $t = $s.Trim()
  if ($t.Length -le $max) { return $t }
  return $t.Substring(0, [Math]::Max(0, $max - 1)) + '…'
}

$launch = Start-DashboardIfNeeded

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Visible = $true
$notify.Text = 'SEU: iniciando…'
$notify.Icon = (Get-MoodIcon 'info')
Log('NotifyIcon visible')

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$miTitle = $menu.Items.Add('SEU - Stack local')
$miTitle.Enabled = $false
$menu.Items.Add('-') | Out-Null

$miOpen = $menu.Items.Add('Abrir dashboard')
$miStartDev = $menu.Items.Add('Iniciar DEV')
$miStartProd = $menu.Items.Add('Iniciar PROD')
$miStopAll = $menu.Items.Add('Detener todo')
$miRestartStack = $menu.Items.Add('Reiniciar stack')
$menu.Items.Add('-') | Out-Null
$miPid = $menu.Items.Add('PID: -')
$miPid.Enabled = $false
$miExit = $menu.Items.Add('Salir')

$notify.ContextMenuStrip = $menu

$miOpen.add_Click({
  Start-Process ((Get-ApiBase) + '/') | Out-Null
})

$notify.add_DoubleClick({
  Start-Process ((Get-ApiBase) + '/') | Out-Null
})

$miStartDev.add_Click({ Invoke-PostJsonOrNull '/api/start' @{ task = 'dev' } | Out-Null })
$miStartProd.add_Click({ Invoke-PostJsonOrNull '/api/start' @{ task = 'prod' } | Out-Null })

$miRestartStack.add_Click({ Invoke-PostJsonOrNull '/api/restart' @{ task = 'stack' } | Out-Null })

$miStopAll.add_Click({
  $st = Get-JsonOrNull '/api/status'
  if ($st -and $st.running) {
    foreach ($t in @($st.running)) {
      Invoke-PostJsonOrNull '/api/stop' @{ task = "$t" } | Out-Null
    }
  }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500

$lastMood = 'info'

$timer.add_Tick({
  $st = Get-JsonOrNull '/api/status'
  $hl = Get-JsonOrNull '/api/health'

  $mood = Get-SystemMood $st $hl
  if (-not $mood) { $mood = 'error' }

  if ($mood -ne $lastMood) {
    $lastMood = $mood
    $notify.Icon = (Get-MoodIcon $mood)
  }

  $runningCount = 0
  try { $runningCount = @($st.running).Count } catch { $runningCount = 0 }
  $mode = '-'
  try { $mode = ("$($st.mode)").ToUpperInvariant() } catch { $mode = '-' }

  $label = switch ($mood) {
    'ok' { 'OK' }
    'warn' { 'WARN' }
    'error' { 'ERROR' }
    default { 'INFO' }
  }

  $text = "SEU $label | $mode | proc:$runningCount"
  $notify.Text = ConvertTo-ShortText $text 60

  $dashPidText = '-'
  $install = Get-JsonOrNull '/api/install'
  try { if ($install.dashboard.pid) { $dashPidText = [string]$install.dashboard.pid } } catch { $dashPidText = '-' }
  $miPid.Text = "PID: $dashPidText"
})

$exiting = $false
$miExit.add_Click({
  if ($exiting) { return }
  $exiting = $true
  $timer.Stop()
  $notify.Visible = $false
  $notify.Dispose()

  # Si nosotros lo lanzamos, intentamos cerrarlo.
  if ($launch.started -and $launch.pid) {
    try { Stop-Process -Id $launch.pid -Force -ErrorAction SilentlyContinue } catch {}
  }

  [System.Windows.Forms.Application]::Exit()
})

$timer.Start()

if (-not $NoOpen) {
  # Abrir dashboard una vez que esté arriba.
  $deadline = (Get-Date).AddSeconds(6)
  do {
    Start-Sleep -Milliseconds 250
    $st = Get-JsonOrNull '/api/status'
  } while (-not $st -and (Get-Date) -lt $deadline)

  if ($st) {
    Start-Process ((Get-ApiBase) + '/') | Out-Null
  }
}

[System.Windows.Forms.Application]::Run()
