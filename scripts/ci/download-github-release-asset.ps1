[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][uri]$Uri,
  [Parameter(Mandatory = $true)][string]$Destination,
  [long]$ExpectedLength = 0,
  [string]$ExpectedSha256,
  [switch]$GitHubApiAsset,
  [ValidateRange(1, 8)][int]$MaxAttempts = 5,
  [ValidateRange(60, 3600)][int]$AttemptTimeoutSeconds = 1800
)

$ErrorActionPreference = 'Stop'

if (-not $Uri.IsAbsoluteUri -or ($Uri.Scheme -ne 'https' -and -not ($Uri.Scheme -eq 'http' -and $Uri.IsLoopback))) {
  throw 'La descarga requiere HTTPS; solo se permite HTTP para pruebas locales loopback.'
}
if ($ExpectedLength -lt 0) { throw 'ExpectedLength no puede ser negativo.' }
if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256) -and $ExpectedSha256 -notmatch '^(?i:[0-9a-f]{64})$') {
  throw 'ExpectedSha256 debe contener 64 dígitos hexadecimales.'
}
if ($GitHubApiAsset -and $Uri.Host -ne 'api.github.com') {
  throw 'La autenticación solo se permite contra api.github.com.'
}

$destinationPath = [IO.Path]::GetFullPath($Destination)
$destinationDirectory = Split-Path -Parent $destinationPath
New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
$curlPath = (Get-Command curl.exe -ErrorAction Stop).Source
$curlConfigPath = $null

function Get-DownloadedLength {
  if (Test-Path -LiteralPath $destinationPath -PathType Leaf) {
    return [long](Get-Item -LiteralPath $destinationPath).Length
  }
  return [long]0
}

function Assert-DownloadedAsset {
  $actualLength = Get-DownloadedLength
  if ($ExpectedLength -gt 0 -and $actualLength -ne $ExpectedLength) {
    throw "Longitud descargada incorrecta: actual=$actualLength esperada=$ExpectedLength."
  }
  if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
      $assetStream = [IO.File]::OpenRead($destinationPath)
      try { $actualSha256 = [BitConverter]::ToString($sha256.ComputeHash($assetStream)).Replace('-', '').ToLowerInvariant() }
      finally { $assetStream.Dispose() }
    }
    finally { $sha256.Dispose() }
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
      throw "SHA-256 descargado incorrecto para $([IO.Path]::GetFileName($destinationPath))."
    }
    Write-Host "[release-download] SHA-256 verificado: $actualSha256"
  }
  Write-Host "[release-download] Completo: $([IO.Path]::GetFileName($destinationPath)); bytes=$actualLength"
}

try {
  if ($GitHubApiAsset) {
    $token = [string]$env:GH_TOKEN
    if ([string]::IsNullOrWhiteSpace($token) -or $token -match '[\r\n"]') {
      throw 'GH_TOKEN falta o no es seguro para usarlo en el archivo de configuración temporal de curl.'
    }
    $tempDirectory = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) { [IO.Path]::GetTempPath() } else { $env:RUNNER_TEMP }
    $curlConfigPath = Join-Path $tempDirectory ('curl-auth-' + [guid]::NewGuid().ToString('N') + '.conf')
    [IO.File]::WriteAllText(
      $curlConfigPath,
      "header = `"Authorization: Bearer $token`"`nheader = `"Accept: application/octet-stream`"`nheader = `"X-GitHub-Api-Version: 2022-11-28`"`n",
      [Text.Encoding]::ASCII
    )
    $configAcl = New-Object System.Security.AccessControl.FileSecurity
    $configAcl.SetAccessRuleProtection($true, $false)
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $configAcl.SetOwner($currentIdentity)
    $configAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($currentIdentity, 'FullControl', 'Allow')))
    Set-Acl -LiteralPath $curlConfigPath -AclObject $configAcl
  }

  $existingLength = Get-DownloadedLength
  if ($ExpectedLength -gt 0 -and $existingLength -gt $ExpectedLength) {
    Remove-Item -LiteralPath $destinationPath -Force
    $existingLength = 0
  }
  if ($ExpectedLength -gt 0 -and $existingLength -eq $ExpectedLength) {
    Assert-DownloadedAsset
    return
  }

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $existingLength = Get-DownloadedLength
    if ($ExpectedLength -gt 0 -and $existingLength -gt $ExpectedLength) {
      Remove-Item -LiteralPath $destinationPath -Force
      $existingLength = 0
    }

    Write-Host "[release-download] Inicio: nombre=$([IO.Path]::GetFileName($destinationPath)); intento=$attempt/$MaxAttempts; bytes=$existingLength/$ExpectedLength"
    $curlArgs = @(
      '--fail', '--location', '--silent', '--show-error', '--progress-bar',
      '--connect-timeout', '30', '--max-time', [string]$AttemptTimeoutSeconds,
      '--speed-limit', '1024', '--speed-time', '120', '--max-redirs', '10',
      '--proto-redir', '=https', '--output', $destinationPath,
      '--write-out', "`n[release-download] HTTP=%{http_code}; bytes-intento=%{size_download}; segundos=%{time_total}; bytes-seg=%{speed_download}`n"
    )
    if ($curlConfigPath) { $curlArgs += @('--config', $curlConfigPath) }
    if ($existingLength -gt 0) { $curlArgs += @('--continue-at', '-') }
    $curlArgs += @('--', $Uri.AbsoluteUri)

    & $curlPath @curlArgs
    $curlExitCode = $LASTEXITCODE
    if ($curlExitCode -eq 0) {
      Assert-DownloadedAsset
      return
    }

    $currentLength = Get-DownloadedLength
    Write-Warning "[release-download] Reintento necesario: exit=$curlExitCode; bytes=$currentLength/$ExpectedLength; intento=$attempt/$MaxAttempts"
    if ($attempt -ge $MaxAttempts) {
      throw "curl.exe agotó $MaxAttempts intentos (exit=$curlExitCode) para $([IO.Path]::GetFileName($destinationPath))."
    }
    Start-Sleep -Seconds ([Math]::Min(30, 2 * $attempt))
  }
}
finally {
  if ($curlConfigPath -and (Test-Path -LiteralPath $curlConfigPath)) {
    Remove-Item -LiteralPath $curlConfigPath -Force -ErrorAction SilentlyContinue
  }
}
