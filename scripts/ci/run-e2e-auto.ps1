# run-e2e-auto.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [ValidateSet('host-canary', 'vm', 'all')]
  [string]$Target = 'host-canary',
  [string]$ExpectedHostCanaryComputerName = 'TEZKATLI',
  [string]$VMName = 'EvaluaPro-E2E-Win11',
  [string]$ExpectedSnapshotName = 'pre-evaluapro-installer-e2e',
  [string]$ExpectedVmComputerName = 'EVALPRO-E2E',
  [string]$QaPassSecretPath = (Join-Path $env:APPDATA 'EvaluaPro\e2e-qa-pass.dpapi'),
  [System.Management.Automation.PSCredential]$VmCredential,
  [System.Security.SecureString]$QaPassSecureString,
  [switch]$AllowExistingInstall,
  [switch]$PromptForQaPass,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$hostCanary = Join-Path $root 'scripts\ci\run-e2e-host-canary.ps1'
$vmLauncher = Join-Path $root 'scripts\ci\run-e2e-launcher.ps1'
$elevatedReadiness = Join-Path $root 'scripts\start-installer-hub-e2e-elevated.ps1'

function Invoke-HostCanary {
  $hostParams = @{
    ExpectedHostCanaryComputerName = $ExpectedHostCanaryComputerName
    QaPassSecretPath = $QaPassSecretPath
  }
  if ($QaPassSecureString) { $hostParams.QaPassSecureString = $QaPassSecureString }
  if ($AllowExistingInstall) { $hostParams.AllowExistingInstall = $true }
  if ($PromptForQaPass) { $hostParams.PromptForQaPass = $true }
  if ($DryRun) { $hostParams.DryRun = $true }
  & $hostCanary @hostParams
  if ($LASTEXITCODE -ne 0) { throw "host-canary fallo con exit=$LASTEXITCODE" }
}

function Invoke-VmE2E {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $elevatedReadiness -VmName $VMName -SnapshotName $ExpectedSnapshotName -ExpectedVmComputerName $ExpectedVmComputerName
  if ($LASTEXITCODE -ne 0) { throw "readiness VM fallo con exit=$LASTEXITCODE" }

  $vmParams = @{
    VMName = $VMName
    ExpectedSnapshotName = $ExpectedSnapshotName
    ExpectedVmComputerName = $ExpectedVmComputerName
  }
  if ($VmCredential) { $vmParams.Credential = $VmCredential }
  if ($QaPassSecureString) { $vmParams.QaPassSecureString = $QaPassSecureString }
  if ($DryRun) { $vmParams.DryRun = $true }
  & $vmLauncher @vmParams
  if ($LASTEXITCODE -ne 0) { throw "vm e2e fallo con exit=$LASTEXITCODE" }
}

switch ($Target) {
  'host-canary' { Invoke-HostCanary }
  'vm' { Invoke-VmE2E }
  'all' {
    Invoke-HostCanary
    Invoke-VmE2E
  }
}
