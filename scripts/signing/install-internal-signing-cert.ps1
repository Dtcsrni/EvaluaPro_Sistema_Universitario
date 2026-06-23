# install-internal-signing-cert.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$CertPath = '',
  [switch]$CurrentUserOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $CertPath) {
  $CertPath = Join-Path $root 'dist\signing-internal\evaluapro-internal-signing.cer'
}

if (-not (Test-Path $CertPath)) {
  throw "No existe certificado CER: $CertPath"
}

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath)
$thumbprint = [string]$cert.Thumbprint

function Import-ToStore {
  param(
    [string]$StoreName,
    [System.Security.Cryptography.X509Certificates.StoreLocation]$Location,
    [System.Security.Cryptography.X509Certificates.X509Certificate2]$InputCert
  )

  $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($StoreName, $Location)
  try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $exists = $store.Certificates | Where-Object { [string]$_.Thumbprint -eq [string]$InputCert.Thumbprint } | Select-Object -First 1
    if (-not $exists) {
      $store.Add($InputCert)
    }
  } finally {
    $store.Close()
  }
}

Import-ToStore -StoreName 'Root' -Location ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser) -InputCert $cert
Import-ToStore -StoreName 'TrustedPublisher' -Location ([System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser) -InputCert $cert

if (-not $CurrentUserOnly) {
  Import-ToStore -StoreName 'Root' -Location ([System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine) -InputCert $cert
  Import-ToStore -StoreName 'TrustedPublisher' -Location ([System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine) -InputCert $cert
}

Write-Host ('[internal-signing] Certificado instalado. Thumbprint: ' + $thumbprint)
Write-Host '[internal-signing] Stores: Root + TrustedPublisher'
