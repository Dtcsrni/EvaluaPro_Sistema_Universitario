# authenticode-trust-validation.test.ps1
#
# Verify a self-signed code-signing certificate without adding it to Root, then
# confirm that a post-signing file change is rejected.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'Esta prueba solo debe ejecutarse en un runner efímero de GitHub Actions.'
}

$trustHelper = Join-Path $PSScriptRoot '..\ci\trust-release-signing-certificate.ps1'
$trustHelper = [System.IO.Path]::GetFullPath($trustHelper)
$testRoot = $env:RUNNER_TEMP
$scriptPath = Join-Path $testRoot ("evaluapro-signed-" + [guid]::NewGuid().ToString('N') + '.ps1')
$certificatePath = Join-Path $testRoot ("evaluapro-signer-" + [guid]::NewGuid().ToString('N') + '.cer')
$certificate = $null
$thumbprint = ''

try {
  $certificateParameters = @{
    Type = 'CodeSigningCert'
    Subject = 'CN=EvaluaPro CI Authenticode Test'
    CertStoreLocation = 'Cert:\CurrentUser\My'
    KeyAlgorithm = 'RSA'
    KeyLength = 2048
    HashAlgorithm = 'SHA256'
    NotAfter = (Get-Date).AddDays(1)
  }
  $certificate = New-SelfSignedCertificate @certificateParameters
  $thumbprint = ([string]$certificate.Thumbprint -replace '\s', '').ToUpperInvariant()

  [System.IO.File]::WriteAllText($scriptPath, "Write-Output 'signed test'" + [Environment]::NewLine, [System.Text.Encoding]::Unicode)
  Set-AuthenticodeSignature -FilePath $scriptPath -Certificate $certificate -HashAlgorithm SHA256 | Out-Null
  Export-Certificate -Cert $certificate -FilePath $certificatePath -Type CERT | Out-Null

  $certificateSha256 = (Get-FileHash -LiteralPath $certificatePath -Algorithm SHA256).Hash.ToLowerInvariant()
  & $trustHelper -TargetPath $scriptPath -CertificatePath $certificatePath -ExpectedCertificateSha256 $certificateSha256

  [System.IO.File]::AppendAllText($scriptPath, "# modified after signing" + [Environment]::NewLine, [System.Text.Encoding]::Unicode)
  $tamperedRejected = $false
  try {
    & $trustHelper -TargetPath $scriptPath -CertificatePath $certificatePath -ExpectedCertificateSha256 $certificateSha256
  } catch {
    $tamperedRejected = $true
    Write-Host 'PASS: modified signed content was rejected.'
  }
  if (-not $tamperedRejected) { throw 'La firma del archivo modificado no fue rechazada.' }

  Write-Host 'PASS: Autofirma y certificado esperado verificados sin modificar almacenes.'
} finally {
  if ($thumbprint -match '^[0-9A-F]{40}$') {
    $personalCertificate = "Cert:\CurrentUser\My\$thumbprint"
    if (Test-Path -LiteralPath $personalCertificate) { Remove-Item -LiteralPath $personalCertificate -Force }
  }
  if (Test-Path -LiteralPath $scriptPath) { Remove-Item -LiteralPath $scriptPath -Force }
  if (Test-Path -LiteralPath $certificatePath) { Remove-Item -LiteralPath $certificatePath -Force }
}
