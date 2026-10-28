# trust-release-signing-certificate.ps1
#
# Valida una firma Authenticode con autofirma usando confianza manual explícita.
# En CI, agrega la raíz solo al almacén CurrentUser del runner efímero.
param(
  [string]$TargetPath = '',
  [string]$CertificatePath = '',
  [string]$ExpectedCertificateSha256 = '',
  [string]$OutputDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$hasTarget = -not [string]::IsNullOrWhiteSpace($TargetPath)
$hasCertificate = -not [string]::IsNullOrWhiteSpace($CertificatePath)
if (-not $hasTarget -and -not $hasCertificate) { throw 'Indique TargetPath, CertificatePath o ambos.' }
if ($env:GITHUB_ACTIONS -ne 'true') {
  throw 'La instalación temporal de confianza se limita a runners efímeros de GitHub Actions.'
}

$signature = $null
$certificate = $null
if ($hasTarget) {
  if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) { throw "No existe el ejecutable firmado: $TargetPath" }
  $signature = Get-AuthenticodeSignature -FilePath $TargetPath -ErrorAction Stop
  if (-not $hasCertificate) {
    $certificate = $signature.SignerCertificate
    if ($null -eq $certificate) { throw "El artefacto no expone certificado firmante: $TargetPath (Status=$($signature.Status))." }
  }
}
if ($hasCertificate) {
  if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) { throw "No existe el certificado público: $CertificatePath" }
  $certificate = New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $CertificatePath
  if (-not [string]::IsNullOrWhiteSpace($ExpectedCertificateSha256)) {
    if ($ExpectedCertificateSha256 -notmatch '^(?i)[0-9a-f]{64}$') { throw 'ExpectedCertificateSha256 no tiene formato SHA-256.' }
    $actualCertificateSha256 = (Get-FileHash -LiteralPath $CertificatePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualCertificateSha256 -ne $ExpectedCertificateSha256.ToLowerInvariant()) { throw 'El certificado descargado no coincide con el SHA-256 esperado.' }
  }
}

$now = Get-Date
if ($certificate.NotBefore.ToUniversalTime() -gt $now.ToUniversalTime() -or $certificate.NotAfter.ToUniversalTime() -le $now.ToUniversalTime()) {
  throw "El certificado firmante está fuera de vigencia: $($certificate.NotBefore.ToString('o')) - $($certificate.NotAfter.ToString('o'))."
}
$thumbprint = ([string]$certificate.Thumbprint -replace '\s', '').ToUpperInvariant()
if ($thumbprint -notmatch '^[0-9A-F]{40}$') { throw 'Thumbprint SHA-1 del certificado inválido.' }
$isSelfSigned = [string]$certificate.Subject -eq [string]$certificate.Issuer
$mode = if ($isSelfSigned) { 'autofirma: requiere confianza manual por el usuario' } else { 'certificado con cadena de confianza de Windows' }

if ($isSelfSigned) {
  $store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    [System.Security.Cryptography.X509Certificates.StoreName]::Root,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
  )
  $storeOpened = $false
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $storeOpened = $true
    $alreadyTrusted = @($store.Certificates | Where-Object { ([string]$_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $thumbprint }).Count -gt 0
    if (-not $alreadyTrusted) {
      $store.Add($certificate)
      if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
        Add-Content -LiteralPath $env:GITHUB_ENV -Value "EVALUAPRO_TEMP_TRUST_THUMBPRINT=$thumbprint"
      }
    }
  } finally {
    if ($storeOpened) { $store.Close() }
  }
} elseif (-not $certificate.Verify()) {
  throw 'El certificado no es autofirmado y su cadena no es confiable en el runner; no se añadirá una CA desconocida.'
}

if ($hasTarget) {
  $signature = Get-AuthenticodeSignature -FilePath $TargetPath -ErrorAction Stop
  if ([string]$signature.Status -ne 'Valid') {
    throw "La firma sigue sin validarse después de aplicar confianza manual en el runner (Status=$($signature.Status)). $($signature.StatusMessage)"
  }
  if ([string]$signature.SignerCertificate.Thumbprint -ne [string]$certificate.Thumbprint) {
    throw 'El certificado de firma no coincide con el certificado del artefacto.'
  }
}

if (-not [string]::IsNullOrWhiteSpace($OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
  $thumbprintPath = Join-Path $OutputDir '.release-signer-thumbprint'
  if (Test-Path -LiteralPath $thumbprintPath) {
    $priorThumbprint = (Get-Content -Raw -LiteralPath $thumbprintPath).Trim()
    if ($priorThumbprint -ne $thumbprint) { throw 'Los artefactos de release usan certificados firmantes distintos.' }
  } else {
    Set-Content -LiteralPath $thumbprintPath -Value $thumbprint -Encoding ascii
  }
  $publicCertPath = Join-Path $OutputDir 'EvaluaPro-CodeSigning-Certificate.cer'
  [System.IO.File]::WriteAllBytes($publicCertPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
  $certificateSha256 = (Get-FileHash -LiteralPath $publicCertPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath ($publicCertPath + '.sha256') -Value "$certificateSha256 *EvaluaPro-CodeSigning-Certificate.cer" -Encoding ascii
  $manualTrust = if ($isSelfSigned) {
    @'
## Importación manual para el usuario actual

Compruebe primero que el SHA-256 del archivo CER coincide con el publicado en los assets oficiales de EvaluaPro. Después, en PowerShell:

```powershell
Import-Certificate -FilePath .\EvaluaPro-CodeSigning-Certificate.cer -CertStoreLocation Cert:\CurrentUser\Root
Get-AuthenticodeSignature .\EvaluaPro-InstallerHub-docente-local-*.exe | Format-List Status, StatusMessage, SignerCertificate
```

No ejecute el instalador si el estado no es `Valid` o si la huella no coincide.
'@
  } else {
    'Windows valida la cadena del certificado por defecto; no importe este certificado a una raíz local.'
  }
  $guide = @"
# Confianza de firma de EvaluaPro

Modo: $mode
Emisor: $($certificate.Issuer)
Sujeto: $($certificate.Subject)
Thumbprint del certificado: $thumbprint
SHA-256 del archivo CER: $certificateSha256
Vigencia: $($certificate.NotBefore.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')) a $($certificate.NotAfter.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))

$manualTrust

SmartScreen puede mostrar advertencias para una autofirma. App Control puede bloquear el programa incluso después de importar el certificado. Este procedimiento no modifica ni desactiva políticas de App Control. La firma no tiene sello de tiempo externo y deja de validar cuando expire el certificado.
"@
  Set-Content -LiteralPath (Join-Path $OutputDir 'FIRMA-LEEME.md') -Value $guide -Encoding utf8
}
if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
  Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value "Firma Authenticode validada. Modo de confianza: $mode; thumbprint: $thumbprint; la autofirma requiere confianza manual y App Control puede bloquearla."
}
Write-Host "Firma Authenticode validada; thumbprint=$thumbprint; selfSigned=$isSelfSigned"
