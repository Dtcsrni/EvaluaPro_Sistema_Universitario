# Compatibility wrapper that delegates shortcut operations to the unified launcher broker.
param(
  [ValidateSet('open-dashboard', 'restart-stack', 'stop-all', 'repair', 'uninstall', 'open-hub', 'verify-installation')]
  [string]$Action = 'open-dashboard',
  [ValidateSet('dev', 'prod', 'auto')]
  [string]$Mode = 'auto',
  [ValidateRange(1, 65535)]
  [int]$Port = 4519
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$broker = Join-Path $PSScriptRoot 'launcher-broker.ps1'
if (-not (Test-Path -LiteralPath $broker)) {
  throw "No se encontró launcher-broker.ps1 en $broker"
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $broker -Action $Action -Mode $Mode -Port $Port
exit $LASTEXITCODE
