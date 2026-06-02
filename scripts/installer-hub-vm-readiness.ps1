<#
  Preflight no destructivo para el E2E real del Installer Hub.
  No instala, no repara, no arranca el Hub y no modifica la VM.
#>
[CmdletBinding()]
param(
  [string]$VmName = 'EvaluaPro-E2E-Win11',
  [string]$ComputerName = 'EVALPRO-E2E',
  [string]$ExpectedSnapshotName = 'pre-evaluapro-installer-e2e',
  [string]$ReportPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path (Get-Location) 'reports\qa\latest\installer-hub-vm-readiness.json'
}

function New-Check {
  param(
    [string]$Id,
    [bool]$Ok,
    [string]$Detail
  )
  [pscustomobject]@{
    id = $Id
    ok = $Ok
    detail = $Detail
  }
}

$checks = New-Object System.Collections.Generic.List[object]

$snapshot = $env:EVALUAPRO_E2E_VM_SNAPSHOT
$checks.Add((New-Check -Id 'snapshot.env' -Ok ($snapshot -eq $ExpectedSnapshotName) -Detail "EVALUAPRO_E2E_VM_SNAPSHOT=$snapshot; expected=$ExpectedSnapshotName"))

try {
  $trustedHosts = (Get-Item WSMan:\localhost\Client\TrustedHosts -ErrorAction Stop).Value
  $hasTrustedHost = [string]::IsNullOrWhiteSpace($trustedHosts) -eq $false -and $trustedHosts -match [regex]::Escape($ComputerName)
  $checks.Add((New-Check -Id 'winrm.trusted-hosts' -Ok $hasTrustedHost -Detail "TrustedHosts=$trustedHosts"))
} catch {
  $checks.Add((New-Check -Id 'winrm.trusted-hosts' -Ok $false -Detail $_.Exception.Message))
}

try {
  $wsman = Test-WSMan -ComputerName $ComputerName -ErrorAction Stop
  $checks.Add((New-Check -Id 'winrm.wsman' -Ok ($null -ne $wsman) -Detail "Test-WSMan $ComputerName responde"))
} catch {
  $checks.Add((New-Check -Id 'winrm.wsman' -Ok $false -Detail $_.Exception.Message))
}

try {
  $vm = Get-VM -Name $VmName -ErrorAction Stop
  $checks.Add((New-Check -Id 'hyperv.get-vm' -Ok ($null -ne $vm) -Detail "Name=$($vm.Name); State=$($vm.State); MemoryAssigned=$($vm.MemoryAssigned)"))
} catch {
  $checks.Add((New-Check -Id 'hyperv.get-vm' -Ok $false -Detail $_.Exception.Message))
}

$ok = -not ($checks | Where-Object { -not $_.ok } | Select-Object -First 1)
$report = [pscustomobject]@{
  ok = $ok
  generatedAt = (Get-Date).ToString('o')
  vmName = $VmName
  computerName = $ComputerName
  expectedSnapshotName = $ExpectedSnapshotName
  checks = @($checks.ToArray())
  nextCommand = 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm'
}

$directory = Split-Path -Parent $ReportPath
if (-not [string]::IsNullOrWhiteSpace($directory)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
$report | ConvertTo-Json -Depth 5 | Set-Content -Path $ReportPath -Encoding UTF8
$report | ConvertTo-Json -Depth 5

if (-not $ok) {
  exit 2
}
