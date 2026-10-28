# signing-cert-store-helper.test.ps1
#
# Exercise the temporary CurrentUser\Root helper with an ephemeral self-signed
# public certificate. The private key is never written to disk or imported.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'Esta prueba solo debe ejecutarse en un runner efímero de GitHub Actions.'
}

$storeManager = Join-Path $PSScriptRoot '..\ci\manage-temporary-root-certificate.ps1'
$storeManager = [System.IO.Path]::GetFullPath($storeManager)
if (-not (Test-Path -LiteralPath $storeManager -PathType Leaf)) { throw 'No se encontró el helper de almacén temporal.' }

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$certificate = $null
$certificatePath = Join-Path $env:RUNNER_TEMP ("evaluapro-test-" + [guid]::NewGuid().ToString('N') + '.cer')
try {
  $subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new('CN=EvaluaPro CI Store Test')
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    $subject,
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )
  $now = [DateTimeOffset]::UtcNow
  $certificate = $request.CreateSelfSigned($now.AddMinutes(-1), $now.AddDays(1))
  [System.IO.File]::WriteAllBytes(
    $certificatePath,
    $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
  )
  $thumbprint = ([string]$certificate.Thumbprint -replace '\s', '').ToUpperInvariant()

  $addOutput = (& $storeManager -Action Add -CertificatePath $certificatePath -Thumbprint $thumbprint -TimeoutSeconds 45 | Out-String)
  if ($addOutput -notmatch 'Certificado añadido temporalmente') {
    throw "El helper no confirmó que el certificado de prueba fue añadido. $addOutput"
  }

  $removeOutput = (& $storeManager -Action Remove -Thumbprint $thumbprint -TimeoutSeconds 45 | Out-String)
  if ($removeOutput -notmatch 'Limpieza del certificado completada') {
    throw "El helper no confirmó la limpieza del certificado de prueba. $removeOutput"
  }

  Write-Host 'PASS: Add/Remove de CurrentUser\Root completaron con el límite de proceso.'
} finally {
  if ($null -ne $certificate) { $certificate.Dispose() }
  $rsa.Dispose()
  if (Test-Path -LiteralPath $certificatePath) { Remove-Item -LiteralPath $certificatePath -Force }
}
