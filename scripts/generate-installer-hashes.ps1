param(
  [string]$InstallerDir = '',
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$ReleaseBaseUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
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

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $InstallerDir) {
  $InstallerDir = Join-Path $root 'dist\installer'
}
$internalInstallerDir = Join-Path $InstallerDir '_internal'

function Resolve-InstallerArtifactPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactName
  )

  $candidatePaths = @(
    (Join-Path $InstallerDir $ArtifactName),
    (Join-Path $internalInstallerDir $ArtifactName)
  )

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return ''
}

$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json

foreach ($flavor in $catalog.flavors) {
  foreach ($artifactName in @([string]$flavor.msiName, [string]$flavor.installerHubExeName)) {
    $artifactPath = Resolve-InstallerArtifactPath -ArtifactName $artifactName
    if ([string]::IsNullOrWhiteSpace($artifactPath)) { continue }
    if (-not (Test-Path $artifactPath)) { continue }
    $hash = Get-Sha256Hex -Path $artifactPath
    $hashPath = Join-Path (Split-Path -Parent $artifactPath) ($artifactName + '.sha256')
    "$hash  $artifactName" | Set-Content -Path $hashPath -Encoding ascii
    Write-Host "[installer-hash] Generado: $hashPath"
  }
}

$manifestScript = Join-Path $PSScriptRoot 'generate-installer-release-manifest.ps1'
$manifestPath = Join-Path $InstallerDir 'EvaluaPro-release-manifest.json'

$manifestParams = @{
  Channel = $Channel
  OutputPath = $manifestPath
}
if ($Version) { $manifestParams.Version = $Version }
if ($ReleaseBaseUrl) { $manifestParams.ReleaseBaseUrl = $ReleaseBaseUrl }

& $manifestScript @manifestParams
