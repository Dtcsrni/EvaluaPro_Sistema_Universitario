param(
  [string]$SourcePath = '',
  [string]$InstallersDir = 'C:\Instaladores',
  [string]$ExpectedSha256 = '',
  [switch]$SkipHashCheck,
  [ValidateSet('saas-completo', 'docente-local')]
  [string]$FlavorId = 'docente-local'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha.ComputeHash($stream)
      return ([BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Resolve-DefaultSourcePath {
  param([string]$Candidate, [string]$Flavor)

  if ($Candidate -and (Test-Path $Candidate)) {
    return (Resolve-Path $Candidate).Path
  }

  $downloads = [Environment]::GetFolderPath('UserProfile') + '\Downloads'
  $fallback = Join-Path $downloads ("EvaluaPro-InstallerHub-{0}.exe" -f $Flavor)
  if (Test-Path $fallback) {
    return (Resolve-Path $fallback).Path
  }

  throw ("No se encontro el Installer Hub del flavor {0}. Usa -SourcePath `"ruta\EvaluaPro-InstallerHub-{0}.exe`"." -f $Flavor)
}

$resolvedSource = Resolve-DefaultSourcePath -Candidate $SourcePath -Flavor $FlavorId

if (-not (Test-Path $InstallersDir)) {
  New-Item -ItemType Directory -Path $InstallersDir -Force | Out-Null
}

$targetPath = Join-Path $InstallersDir ("EvaluaPro-InstallerHub-{0}.exe" -f $FlavorId)
Copy-Item -LiteralPath $resolvedSource -Destination $targetPath -Force
Unblock-File -LiteralPath $targetPath -ErrorAction SilentlyContinue

if (-not $SkipHashCheck) {
  if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) {
    Write-Host '[install-evaluapro] SHA256 esperado no definido; se omite validacion estricta. Usa -ExpectedSha256 para exigirlo.'
  } else {
    $actual = Get-Sha256Hex -Path $targetPath
    $expected = $ExpectedSha256.Trim().ToLowerInvariant()
    if ($actual -ne $expected) {
      throw "SHA256 invalido. Esperado=$expected Actual=$actual"
    }
    Write-Host "[install-evaluapro] SHA256 OK: $actual"
  }
}

Write-Host "[install-evaluapro] Ejecutando Installer Hub desde: $targetPath"
Write-Host "[install-evaluapro] Carpeta de trabajo preparada: $InstallersDir"

Start-Process -FilePath $targetPath -Verb RunAs
