param(
  [Parameter(Mandatory=$true)]
  [string]$QaPass,
  [string]$ExpectedSnapshotName = 'pre-evaluapro-installer-e2e',
  [string]$ExpectedVmComputerName = 'EVALPRO-E2E',
  [string]$ProjectRoot = 'C:\EvaluaPro'
)

if ([string]::IsNullOrWhiteSpace($QaPass)) {
  throw 'QaPass requerido.'
}

function Write-LaunchReport {
  param(
    [Parameter(Mandatory=$true)][string]$Status,
    [Parameter(Mandatory=$true)][string]$Detail
  )

  $reportDir = Join-Path $ProjectRoot 'reports\qa\latest'
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
  [pscustomobject]@{
    status = $Status
    detail = $Detail
    generatedAt = (Get-Date).ToString('o')
    computerName = $env:COMPUTERNAME
    expectedVmComputerName = $ExpectedVmComputerName
    projectRoot = $ProjectRoot
    expectedSnapshotName = $ExpectedSnapshotName
    runner = Join-Path $ProjectRoot 'scripts\tests\installer-hub-e2e-docente.ps1'
  } | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $reportDir 'powershell-direct-e2e-launch.json') -Encoding UTF8
}

if (-not $env:COMPUTERNAME.Equals($ExpectedVmComputerName, [StringComparison]::OrdinalIgnoreCase)) {
  Write-LaunchReport -Status 'blocked' -Detail "wrong-computer:$env:COMPUTERNAME"
  throw "Este script debe ejecutarse dentro de $ExpectedVmComputerName; actual=$env:COMPUTERNAME"
}

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
  Write-LaunchReport -Status 'blocked' -Detail 'missing-project-root'
  throw "No existe ProjectRoot en VM: $ProjectRoot"
}

$runnerPath = Join-Path $ProjectRoot 'scripts\tests\installer-hub-e2e-docente.ps1'
if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
  Write-LaunchReport -Status 'blocked' -Detail 'missing-e2e-runner'
  throw "No existe runner E2E en VM: $runnerPath"
}

$envLines = @(
  "EVALUAPRO_QA_USER=evaluaqa",
  ("EVALUAPRO_QA_PASS={0}" -f $QaPass),
  "EVALUAPRO_DOCKER_RUNTIME=wsl2"
)

($envLines -join "`n") | Out-File -Encoding UTF8 (Join-Path $ProjectRoot '.env')
Write-Host ".env escrito en $ProjectRoot"

Set-Location $ProjectRoot

$env:EVALUAPRO_E2E_VM_SNAPSHOT = $ExpectedSnapshotName
Write-LaunchReport -Status 'launching-runner' -Detail 'preflight-ok'

powershell -NoProfile -ExecutionPolicy Bypass -File $runnerPath -IUnderstandThisMutatesVm
