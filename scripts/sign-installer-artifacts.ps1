param(
  [string]$InstallerDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $InstallerDir) {
  $InstallerDir = Join-Path $root 'dist\\installer'
}

if (-not (Test-Path $InstallerDir)) {
  throw "No existe carpeta de instaladores: $InstallerDir"
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json

$certBase64 = [string]$env:EVALUAPRO_SIGN_CERT_BASE64
$certPassword = [string]$env:EVALUAPRO_SIGN_CERT_PASSWORD
$timestampUrl = [string]$env:EVALUAPRO_SIGN_TIMESTAMP_URL
if (-not $timestampUrl) {
  $timestampUrl = 'http://timestamp.digicert.com'
}

$markerPath = Join-Path $InstallerDir 'SIGNING-NOT-PRODUCTION.txt'

if ([string]::IsNullOrWhiteSpace($certBase64) -or [string]::IsNullOrWhiteSpace($certPassword)) {
  $marker = @(
    'NO_PRODUCTION_SIGNATURE',
    'Installer artifacts were generated without code-signing certificate.',
    ('GeneratedAt=' + (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ'))
  ) -join "`r`n"

  $marker | Set-Content -Path $markerPath -Encoding ascii
  Write-Host '[signing] Certificado ausente. Se marca build como NO PRODUCTIVA.'
  exit 0
}

function Find-SignTool {
  $candidates = @(
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\x64\\signtool.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $glob = Get-ChildItem -Path 'C:\\Program Files (x86)\\Windows Kits\\10\\bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($glob) { return $glob.FullName }

  return ''
}

function ConvertFrom-PossiblyWrappedBase64 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RawValue
  )

  $normalized = [string]$RawValue
  if ($normalized -match '^[A-Z0-9_]+=') {
    $normalized = $normalized.Substring($normalized.IndexOf('=') + 1)
  }

  $normalized = ($normalized -replace '\s', '').Trim()
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    throw 'Valor base64 vacio para certificado de firma.'
  }

  try {
    return [Convert]::FromBase64String($normalized)
  } catch {
    # Intento de compatibilidad base64url.
    $urlSafe = $normalized.Replace('-', '+').Replace('_', '/')
    $pad = $urlSafe.Length % 4
    if ($pad -ne 0) {
      $urlSafe = $urlSafe.PadRight($urlSafe.Length + (4 - $pad), '=')
    }
    return [Convert]::FromBase64String($urlSafe)
  }
}

$signtool = Find-SignTool
if (-not $signtool) {
  throw 'No se encontro signtool.exe para firmar artefactos.'
}

$pfxPath = Join-Path $env:TEMP ('evaluapro-sign-' + [Guid]::NewGuid().ToString('N') + '.pfx')
try {
  [IO.File]::WriteAllBytes($pfxPath, (ConvertFrom-PossiblyWrappedBase64 -RawValue $certBase64))

  $targets = @()
  foreach ($flavor in $catalog.flavors) {
    $targets += @(
      (Join-Path $InstallerDir ([string]$flavor.msiName)),
      (Join-Path $InstallerDir ([string]$flavor.bundleName)),
      (Join-Path $InstallerDir ([string]$flavor.installerHubExeName))
    )
  }
  $targets = $targets | Select-Object -Unique | Where-Object { Test-Path $_ }

  if ($targets.Count -eq 0) {
    throw 'No hay artefactos para firmar.'
  }

  foreach ($target in $targets) {
    Write-Host "[signing] Firmando $target"
    & $signtool sign /fd SHA256 /f $pfxPath /p $certPassword /tr $timestampUrl /td SHA256 $target
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo firma de $target (exit=$LASTEXITCODE)."
    }
  }

  if (Test-Path $markerPath) {
    Remove-Item -LiteralPath $markerPath -Force
  }

  Write-Host '[signing] Firma completada con timestamp.'
} finally {
  if (Test-Path $pfxPath) {
    Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue
  }
}
