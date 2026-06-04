param(
  [string]$VMName = 'EvaluaPro-E2E-Win11',
  [string]$ExpectedSnapshotName = 'pre-evaluapro-installer-e2e',
  [string]$ExpectedVmComputerName = 'EVALPRO-E2E',
  [string]$ReadinessReportPath = 'V:\Software\EvaluaPro\reports\qa\latest\installer-hub-vm-readiness.json',
  [string]$InVmScriptPath = 'V:\Software\EvaluaPro\scripts\ci\run-e2e-in-vm.ps1',
  [System.Management.Automation.PSCredential]$Credential,
  [System.Security.SecureString]$QaPassSecureString,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-ReadinessReport {
  if (-not (Test-Path -LiteralPath $ReadinessReportPath -PathType Leaf)) {
    throw "No existe readiness report: $ReadinessReportPath. Ejecuta primero npm run installer:hub:e2e:elevated."
  }

  $report = Get-Content -Path $ReadinessReportPath -Raw | ConvertFrom-Json
  if (-not $report.ok) {
    throw "VM readiness no esta verde: $ReadinessReportPath. Ejecuta primero npm run installer:hub:e2e:elevated."
  }
  if ($report.expectedSnapshotName -ne $ExpectedSnapshotName) {
    throw "Snapshot esperado no coincide. report=$($report.expectedSnapshotName) expected=$ExpectedSnapshotName"
  }

  $vmCheck = $report.checks | Where-Object { $_.id -eq 'hyperv.get-vm' } | Select-Object -First 1
  if (-not $vmCheck -or $vmCheck.detail -notmatch 'State=Running') {
    throw "La VM no figura Running en readiness: $($vmCheck.detail)"
  }

  return $report
}

$report = Get-ReadinessReport

if ($DryRun) {
  [pscustomobject]@{
    dryRun = $true
    vmName = $VMName
    expectedSnapshotName = $ExpectedSnapshotName
    expectedVmComputerName = $ExpectedVmComputerName
    readinessGeneratedAt = $report.generatedAt
    readinessReportPath = $ReadinessReportPath
    inVmScriptPath = $InVmScriptPath
    acceptsCredentialParameter = $true
    acceptsQaPassSecureString = $true
  } | ConvertTo-Json -Depth 4
  exit 0
}

# Launcher que pide credenciales y ejecuta el script en la VM (PowerShell Direct).
# No persistir ni versionar passwords de QA: se leen en runtime.
if (-not $Credential) {
  $Credential = Get-Credential -Message 'Credenciales admin VM'
}
if (-not $QaPassSecureString) {
  $QaPassSecureString = Read-Host -AsSecureString -Prompt 'Password QA evaluaqa'
}

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($QaPassSecureString)

try {
  $qaPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
  if ([string]::IsNullOrWhiteSpace($qaPass)) {
    throw 'Password QA requerido.'
  }

  Invoke-Command -VMName $VMName -Credential $Credential -FilePath $InVmScriptPath -ArgumentList $qaPass, $ExpectedSnapshotName, $ExpectedVmComputerName
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable qaPass -ErrorAction SilentlyContinue
}
