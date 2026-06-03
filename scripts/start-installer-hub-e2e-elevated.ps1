<#
  Prepara el E2E real del Installer Hub docente-local desde el host.
  La ventana elevada arranca la VM si hace falta, ejecuta el preflight y se detiene antes de mutar si no esta dentro de la VM.
#>
[CmdletBinding()]
param(
  [string]$VmName = 'EvaluaPro-E2E-Win11',
  [string]$SnapshotName = 'pre-evaluapro-installer-e2e',
  [string]$ExpectedVmComputerName = 'EVALPRO-E2E',
  [int]$WinRmTimeoutSeconds = 180,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$readiness = Join-Path $root 'scripts\installer-hub-vm-readiness.ps1'
$logDir = Join-Path $root 'reports\qa\latest'
$transcript = Join-Path $logDir 'installer-hub-e2e-elevated-transcript.txt'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$commands = @(
  '$ErrorActionPreference = ''Stop''',
  "Set-Location -LiteralPath '$root'",
  "Start-Transcript -Path '$transcript' -Force",
  "`$env:EVALUAPRO_E2E_VM_SNAPSHOT = '$SnapshotName'",
  "`$vm = Get-VM -Name '$VmName' -ErrorAction Stop",
  "if (`$vm.State -ne 'Running') { Write-Host 'VM $VmName esta apagada; iniciando para preflight E2E.'; Start-VM -Name '$VmName' -ErrorAction Stop }",
  "`$deadline = (Get-Date).AddSeconds($WinRmTimeoutSeconds)",
  "do { try { Test-WSMan -ComputerName '$ExpectedVmComputerName' -ErrorAction Stop | Out-Null; `$winRmReady = `$true } catch { `$winRmReady = `$false; Start-Sleep -Seconds 5 } } while (-not `$winRmReady -and (Get-Date) -lt `$deadline)",
  "if (-not `$winRmReady) { throw 'VM arranco, pero WinRM no respondio dentro del timeout; no se ejecuta E2E mutante.' }",
  "powershell -NoProfile -ExecutionPolicy Bypass -File '$readiness'",
  "if (`$LASTEXITCODE -ne 0) { throw 'VM readiness fallo; no se ejecuta E2E mutante.' }",
  "if (-not `$env:COMPUTERNAME.Equals('$ExpectedVmComputerName', [StringComparison]::OrdinalIgnoreCase)) { Write-Host 'Readiness OK. Ejecuta el runner mutante dentro de la VM $ExpectedVmComputerName, no en este host.'; Stop-Transcript; exit 3 }",
  'Stop-Transcript'
)

$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(($commands -join '; ')))

if ($DryRun) {
  [pscustomobject]@{
    dryRun = $true
    vmName = $VmName
    snapshotName = $SnapshotName
    expectedVmComputerName = $ExpectedVmComputerName
    winRmTimeoutSeconds = $WinRmTimeoutSeconds
    transcript = $transcript
    command = "powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
  } | ConvertTo-Json -Depth 3
  exit 0
}

Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -Verb RunAs -WorkingDirectory $root -Wait
