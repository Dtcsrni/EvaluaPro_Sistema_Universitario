param(
  [string]$Subject = 'CN=EvaluaPro Internal Code Signing',
  [string]$OutputDir = '',
  [string]$PfxPassword = '',
  [int]$YearsValid = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  Import-Module Microsoft.PowerShell.Security -ErrorAction Stop | Out-Null
} catch {
  # Continue with .NET fallback for SecureString creation.
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $OutputDir) {
  $OutputDir = Join-Path $root 'dist\signing-internal'
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
  $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*+-_'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 24
  $rng.GetBytes($bytes)
  $sb = New-Object System.Text.StringBuilder
  foreach ($b in $bytes) {
    [void]$sb.Append($chars[$b % $chars.Length])
  }
  $PfxPassword = $sb.ToString()
}

try {
  $securePassword = ConvertTo-SecureString -String $PfxPassword -AsPlainText -Force
} catch {
  $securePassword = New-Object System.Security.SecureString
  foreach ($ch in $PfxPassword.ToCharArray()) {
    $securePassword.AppendChar($ch)
  }
  $securePassword.MakeReadOnly()
}
$notAfter = (Get-Date).AddYears($YearsValid)
$notBefore = (Get-Date).AddDays(-1)

$rsa = [System.Security.Cryptography.RSA]::Create(3072)
try {
  $dn = New-Object System.Security.Cryptography.X509Certificates.X500DistinguishedName($Subject)
  $request = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
    $dn,
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
  )

  $ekuOids = New-Object System.Security.Cryptography.OidCollection
  [void]$ekuOids.Add((New-Object System.Security.Cryptography.Oid('1.3.6.1.5.5.7.3.3', 'Code Signing')))
  $ekuExt = New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension($ekuOids, $false)
  $request.CertificateExtensions.Add($ekuExt)

  $keyUsage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature
  $keyUsageExt = New-Object System.Security.Cryptography.X509Certificates.X509KeyUsageExtension($keyUsage, $true)
  $request.CertificateExtensions.Add($keyUsageExt)

  $basicConstraints = New-Object System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension($false, $false, 0, $true)
  $request.CertificateExtensions.Add($basicConstraints)

  $subjectKeyId = New-Object System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension($request.PublicKey, $false)
  $request.CertificateExtensions.Add($subjectKeyId)

  $cert = $request.CreateSelfSigned($notBefore, $notAfter)
  if (-not $cert) {
    throw 'No se pudo generar certificado interno de firma.'
  }

  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $PfxPassword), $PfxPassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
} finally {
  if ($rsa) { $rsa.Dispose() }
}

$thumbprint = [string]$cert.Thumbprint
$pfxPath = Join-Path $OutputDir 'evaluapro-internal-signing.pfx'
$cerPath = Join-Path $OutputDir 'evaluapro-internal-signing.cer'
$metaPath = Join-Path $OutputDir 'evaluapro-internal-signing.meta.json'
$secretsPath = Join-Path $OutputDir 'github-secrets.internal-signing.env'

$pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $PfxPassword)
$cerBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
[IO.File]::WriteAllBytes($cerPath, $cerBytes)

$pfxBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath))

@(
  ('EVALUAPRO_SIGN_CERT_BASE64=' + $pfxBase64)
  ('EVALUAPRO_SIGN_CERT_PASSWORD=' + $PfxPassword)
  'EVALUAPRO_SIGN_TIMESTAMP_URL=http://timestamp.digicert.com'
) | Set-Content -Path $secretsPath -Encoding ascii

$meta = [ordered]@{
  subject = $Subject
  thumbprint = $thumbprint
  notAfter = $cert.NotAfter.ToString('yyyy-MM-ddTHH:mm:ssK')
  output = [ordered]@{
    pfx = $pfxPath
    cer = $cerPath
    githubSecretsEnv = $secretsPath
  }
}

$meta | ConvertTo-Json -Depth 6 | Set-Content -Path $metaPath -Encoding utf8

Write-Host ('[internal-signing] Certificado generado: ' + $thumbprint)
Write-Host ('[internal-signing] PFX: ' + $pfxPath)
Write-Host ('[internal-signing] CER: ' + $cerPath)
Write-Host ('[internal-signing] Secrets env: ' + $secretsPath)
Write-Host '[internal-signing] Importa el CER en equipos del piloto para confianza local.'
