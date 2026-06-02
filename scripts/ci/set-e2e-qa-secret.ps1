param(
  [string]$QaPassSecretPath = (Join-Path $env:APPDATA 'EvaluaPro\e2e-qa-pass.dpapi'),
  [System.Security.SecureString]$QaPassSecureString,
  [switch]$FromEnvironment,
  [switch]$Clear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Clear) {
  Remove-Item -LiteralPath $QaPassSecretPath -Force -ErrorAction SilentlyContinue
  [pscustomobject]@{
    ok = $true
    action = 'cleared'
    path = $QaPassSecretPath
  } | ConvertTo-Json -Depth 3
  exit 0
}

if ($FromEnvironment) {
  $envPass = [string]$env:EVALUAPRO_QA_PASS
  if ([string]::IsNullOrWhiteSpace($envPass)) {
    throw 'EVALUAPRO_QA_PASS no esta definido.'
  }
  $QaPassSecureString = ConvertTo-SecureString -String $envPass -AsPlainText -Force
}

if (-not $QaPassSecureString) {
  $QaPassSecureString = Read-Host -AsSecureString -Prompt 'Password QA evaluaqa'
}

$dir = Split-Path -Parent $QaPassSecretPath
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$QaPassSecureString | ConvertFrom-SecureString | Set-Content -LiteralPath $QaPassSecretPath -Encoding UTF8

[pscustomobject]@{
  ok = $true
  action = 'saved'
  path = $QaPassSecretPath
  scope = 'current-windows-user-dpapi'
} | ConvertTo-Json -Depth 3
