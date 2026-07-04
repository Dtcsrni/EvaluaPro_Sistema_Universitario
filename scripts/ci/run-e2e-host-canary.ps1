# run-e2e-host-canary.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$ExpectedHostCanaryComputerName = 'TEZKATLI',
  [string]$ProjectRoot = 'V:\Software\EvaluaPro',
  [string]$ReportRoot = 'V:\Software\EvaluaPro\reports\qa\installer-hub-e2e-host-canary',
  [string]$QaPassSecretPath = (Join-Path $env:APPDATA 'EvaluaPro\e2e-qa-pass.dpapi'),
  [System.Security.SecureString]$QaPassSecureString,
  [switch]$AllowExistingInstall,
  [switch]$PromptForQaPass,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-SecureStringFromPlainText {
  param([Parameter(Mandatory=$true)][string]$Value)

  $secure = [System.Security.SecureString]::new()
  foreach ($ch in $Value.ToCharArray()) {
    $secure.AppendChar($ch)
  }
  $secure.MakeReadOnly()
  return $secure
}

function Resolve-QaPassSecureString {
  if ($QaPassSecureString) { return $QaPassSecureString }

  $envPass = [string]$env:EVALUAPRO_QA_PASS
  if (-not [string]::IsNullOrWhiteSpace($envPass)) {
    return New-SecureStringFromPlainText -Value $envPass
  }

  if (-not [string]::IsNullOrWhiteSpace($QaPassSecretPath) -and (Test-Path -LiteralPath $QaPassSecretPath -PathType Leaf)) {
    Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
    return Get-Content -LiteralPath $QaPassSecretPath -Raw | ConvertTo-SecureString
  }

  if (-not $PromptForQaPass) {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $rng.GetBytes($bytes)
      $generated = (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
      return New-SecureStringFromPlainText -Value $generated
    } finally {
      $rng.Dispose()
      Remove-Variable generated -ErrorAction SilentlyContinue
    }
  }

  return Read-Host -AsSecureString -Prompt 'Password QA evaluaqa'
}

function Test-CurrentProcessElevated {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$current = [string]$env:COMPUTERNAME
if (-not $current.Equals($ExpectedHostCanaryComputerName, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Este carril host-canary solo esta autorizado en $ExpectedHostCanaryComputerName; actual=$current"
}

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
  throw "No existe ProjectRoot: $ProjectRoot"
}
Set-Location -LiteralPath $ProjectRoot

$runnerPath = Join-Path $ProjectRoot 'scripts\tests\installer-hub-e2e-docente.ps1'
if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
  throw "No existe runner E2E: $runnerPath"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportDir = Join-Path $ReportRoot $stamp

if ($DryRun) {
  [pscustomobject]@{
    dryRun = $true
    target = 'host-canary'
    computerName = $current
    projectRoot = $ProjectRoot
    runner = $runnerPath
    reportDir = $reportDir
    mutatesHost = $true
    requiresElevatedProcess = $true
    currentProcessElevated = (Test-CurrentProcessElevated)
    requiresQaPassSecureString = $true
    supportsEnvQaPass = $true
    autoGeneratesEphemeralQaPass = $true
    qaPassSecretPath = $QaPassSecretPath
    qaPassSecretConfigured = (Test-Path -LiteralPath $QaPassSecretPath -PathType Leaf)
    promptForQaPass = [bool]$PromptForQaPass
  } | ConvertTo-Json -Depth 4
  exit 0
}

if (-not (Test-CurrentProcessElevated)) {
  throw 'El host-canary requiere un proceso PowerShell elevado antes de iniciar el Installer Hub. La sesion actual esta en integridad media; si se continua, Windows pedira credenciales/UAC y el runner no podra controlar la UI elevada. Abre Codex/PowerShell como administrador o ejecuta este script desde una tarea programada ya autorizada.'
}

$QaPassSecureString = Resolve-QaPassSecureString

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($QaPassSecureString)
try {
  $qaPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
  if ([string]::IsNullOrWhiteSpace($qaPass)) {
    throw 'Password QA requerido.'
  }

  $env:EVALUAPRO_QA_USER = 'evaluaqa'
  $env:EVALUAPRO_QA_PASS = $qaPass

  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $runnerPath,
    '-RootPath', $ProjectRoot,
    '-ReportDir', $reportDir,
    '-ExpectedHostCanaryComputerName', $ExpectedHostCanaryComputerName,
    '-IUnderstandThisMutatesVm',
    '-AllowHostCanary',
    '-SkipSnapshotCheck'
  )
  if ($AllowExistingInstall) {
    $args += '-AllowExistingInstall'
  }

  & powershell @args
  exit $LASTEXITCODE
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable qaPass -ErrorAction SilentlyContinue
  Remove-Item Env:\EVALUAPRO_QA_PASS -ErrorAction SilentlyContinue
}
