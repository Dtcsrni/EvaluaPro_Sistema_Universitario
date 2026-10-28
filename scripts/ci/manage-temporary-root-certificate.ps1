# manage-temporary-root-certificate.ps1
#
# Add or remove one signing certificate in CurrentUser\Root on an ephemeral
# GitHub Actions runner. X509Store operations run in a child process so a
# blocked CryptoAPI call cannot hang the workflow indefinitely.
param(
  [Parameter(Mandatory = $true)][ValidateSet('Add', 'Remove')][string]$Action,
  [string]$CertificatePath = '',
  [string]$Thumbprint = '',
  [int]$TimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'La modificación temporal del almacén de raíces se limita a runners efímeros de GitHub Actions.'
}
if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 120) {
  throw 'TimeoutSeconds debe estar entre 1 y 120.'
}
if ($Action -eq 'Add') {
  if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) { throw 'No existe el certificado público que se va a confiar.' }
  if ($Thumbprint -notmatch '^[0-9A-Fa-f]{40}$') { throw 'Thumbprint inválido para añadir al almacén temporal.' }
} elseif ($Thumbprint -notmatch '^[0-9A-Fa-f]{40}$') {
  throw 'Thumbprint inválido para retirar del almacén temporal.'
}

$pathBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($CertificatePath))
$thumbprintBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Thumbprint.ToUpperInvariant()))
$childScript = @'
$ErrorActionPreference = 'Stop'
try {
  $action = '__ACTION__'
  $certificatePath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PATH_BASE64__'))
  $thumbprint = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__THUMBPRINT_BASE64__'))
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    [System.Security.Cryptography.X509Certificates.StoreName]::Root,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  $opened = $false
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $opened = $true
    $matches = @($store.Certificates | Where-Object { ([string]$_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $thumbprint })
    if ($action -eq 'Add') {
      if ($matches.Count -gt 0) {
        [pscustomobject]@{ added = $false } | ConvertTo-Json -Compress
      } else {
        $certificate = New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $certificatePath
        if (([string]$certificate.Thumbprint -replace '\s', '').ToUpperInvariant() -ne $thumbprint) {
          throw 'El thumbprint del certificado no coincide antes de añadirlo.'
        }
        $store.Add($certificate)
        $verified = @($store.Certificates | Where-Object { ([string]$_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $thumbprint }).Count -gt 0
        if (-not $verified) { throw 'El certificado no quedó en CurrentUser\Root después de añadirlo.' }
        [pscustomobject]@{ added = $true } | ConvertTo-Json -Compress
      }
    } else {
      foreach ($certificate in $matches) { $store.Remove($certificate) }
      $remaining = @($store.Certificates | Where-Object { ([string]$_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $thumbprint }).Count
      if ($remaining -gt 0) { throw 'El certificado siguió presente después de retirarlo de CurrentUser\Root.' }
      [pscustomobject]@{ removed = ($matches.Count -gt 0) } | ConvertTo-Json -Compress
    }
  } finally {
    if ($opened) { $store.Close() }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
'@
$childScript = $childScript.Replace('__ACTION__', $Action)
$childScript = $childScript.Replace('__PATH_BASE64__', $pathBase64)
$childScript = $childScript.Replace('__THUMBPRINT_BASE64__', $thumbprintBase64)
$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childScript))
$powershellPath = (Get-Process -Id $PID).Path
$process = New-Object System.Diagnostics.Process
$process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
$process.StartInfo.FileName = $powershellPath
$process.StartInfo.Arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encodedCommand"
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.CreateNoWindow = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true
if (-not $process.Start()) { throw "No se pudo iniciar la operación $Action del almacén de certificados." }
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
  try { $process.Kill() } catch {}
  $stopped = $process.WaitForExit(5000)
  $process.Dispose()
  if (-not $stopped) { throw "La operación $Action del almacén excedió $TimeoutSeconds s y el proceso no terminó tras solicitar su cierre." }
  throw "Timeout de $TimeoutSeconds s al ejecutar $Action en CurrentUser\Root."
}
$stdout = $stdoutTask.Result.Trim()
$stderr = $stderrTask.Result.Trim()
$exitCode = $process.ExitCode
$process.Dispose()
if ($exitCode -ne 0) { throw "La operación $Action del almacén terminó con código $exitCode. $stderr" }
if ([string]::IsNullOrWhiteSpace($stdout)) { throw "La operación $Action del almacén no produjo resultado." }
try { $result = $stdout | ConvertFrom-Json -ErrorAction Stop } catch { throw "La operación $Action del almacén produjo una respuesta inválida." }

if ($Action -eq 'Add' -and [bool]$result.added) {
  if ([string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) { throw 'GITHUB_ENV no está disponible para registrar la limpieza del certificado.' }
  Add-Content -LiteralPath $env:GITHUB_ENV -Value "EVALUAPRO_TEMP_TRUST_THUMBPRINT=$($Thumbprint.ToUpperInvariant())"
  Write-Host "Certificado añadido temporalmente; thumbprint=$($Thumbprint.ToUpperInvariant())."
} elseif ($Action -eq 'Add') {
  Write-Host "El certificado ya estaba en CurrentUser\Root; no se marcará para retirada: $($Thumbprint.ToUpperInvariant())."
} else {
  Write-Host "Limpieza del certificado completada; thumbprint=$($Thumbprint.ToUpperInvariant())."
}
