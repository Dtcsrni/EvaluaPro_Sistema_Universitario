# generate-installer-hashes.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
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

function Get-Crc32Hex {
  param([Parameter(Mandatory = $true)][string]$Path)
  [int64]$polynomial = 3988292384
  $table = New-Object int64[] 256
  for ($seed = 0; $seed -lt 256; $seed++) {
    [int64]$value = $seed
    for ($bit = 0; $bit -lt 8; $bit++) {
      $lsb = $value -band 1
      $value = [int64]($value -shr 1)
      if ($lsb -ne 0) { $value = $value -bxor $polynomial }
    }
    $table[$seed] = $value
  }
  [int64]$crc = 4294967295
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $buffer = New-Object byte[] 1048576
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      for ($i = 0; $i -lt $read; $i++) {
        $index = [int](($crc -bxor [int64]$buffer[$i]) -band 255)
        $crc = ($crc -shr 8) -bxor $table[$index]
      }
    }
  } finally { $stream.Dispose() }
  return ('{0:X8}' -f ([uint64]($crc -bxor 4294967295))).ToLowerInvariant()
}
$internalInstallerDir = Join-Path $InstallerDir '_internal'

function Resolve-VersionTag {
  param(
    [string]$RootPath,
    [string]$RequestedVersion
  )

  $resolved = [string]$RequestedVersion
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $pkgPath = Join-Path $RootPath 'package.json'
    if (Test-Path -LiteralPath $pkgPath) {
      $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding utf8 | ConvertFrom-Json
      $resolved = [string]$pkg.version
    }
  }
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $resolved = '0.0.0'
  }
  return (($resolved -replace '[^0-9A-Za-z\.-]', '-').Trim())
}

function Get-VersionedArtifactName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseName,
    [Parameter(Mandatory = $true)]
    [string]$VersionTag
  )

  if ([string]::IsNullOrWhiteSpace($VersionTag)) {
    return $BaseName
  }

  $ext = [System.IO.Path]::GetExtension($BaseName)
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($BaseName)
  if ([string]::IsNullOrWhiteSpace($ext)) {
    return ("{0}-v{1}" -f $BaseName, $VersionTag)
  }
  return ("{0}-v{1}{2}" -f $stem, $VersionTag, $ext)
}

$optionalArtifactPatterns = @('*.extracted.ico')
foreach ($pattern in $optionalArtifactPatterns) {
  Get-ChildItem -Path $InstallerDir -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[installer-hash] Ignorando artefacto opcional no contractual: $($_.Name)"
  }
}

function Resolve-InstallerArtifactPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactName,
    [string]$FlavorId = '',
    [switch]$PreferInternal
  )

  $candidatePaths = @()
  if (-not [string]::IsNullOrWhiteSpace($FlavorId)) {
    if ($PreferInternal) {
      $candidatePaths += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
      $candidatePaths += @(Join-Path (Join-Path $InstallerDir $FlavorId) $ArtifactName)
    } else {
      $candidatePaths += @(Join-Path (Join-Path $InstallerDir $FlavorId) $ArtifactName)
      $candidatePaths += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
    }
  }

  if ($PreferInternal) {
    $candidatePaths += @(Join-Path $internalInstallerDir $ArtifactName)
    $candidatePaths += @(Join-Path $InstallerDir $ArtifactName)
  } else {
    $candidatePaths += @(Join-Path $InstallerDir $ArtifactName)
    $candidatePaths += @(Join-Path $internalInstallerDir $ArtifactName)
  }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return ''
}

$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json
$versionTag = Resolve-VersionTag -RootPath $root -RequestedVersion $Version
$shasumsByDirectory = @{}

foreach ($flavor in $catalog.flavors) {
  $flavorId = [string]$flavor.flavorId
  $versionedHubName = Get-VersionedArtifactName -BaseName ([string]$flavor.installerHubExeName) -VersionTag $versionTag
  $artifacts = @(
    @{ name = [string]$flavor.msiName; preferInternal = $true },
    @{ name = [string]$versionedHubName; preferInternal = $false }
  )
  foreach ($artifact in $artifacts) {
    $artifactName = [string]$artifact.name
    $artifactPath = Resolve-InstallerArtifactPath -ArtifactName $artifactName -FlavorId $flavorId -PreferInternal:([bool]$artifact.preferInternal)
    if ([string]::IsNullOrWhiteSpace($artifactPath)) { continue }
    if (-not (Test-Path $artifactPath)) { continue }
    $hash = Get-Sha256Hex -Path $artifactPath
    $artifactDir = Split-Path -Parent $artifactPath
    $hashPath = Join-Path $artifactDir ($artifactName + '.sha256')
    "$hash  $artifactName" | Set-Content -Path $hashPath -Encoding ascii
    Write-Host "[installer-hash] Generado: $hashPath"
    $crc32 = Get-Crc32Hex -Path $artifactPath
    $crcPath = Join-Path $artifactDir ($artifactName + '.crc32')
    "$crc32  $artifactName" | Set-Content -Path $crcPath -Encoding ascii
    Write-Host "[installer-hash] Generado: $crcPath"
    if (-not $shasumsByDirectory.ContainsKey($artifactDir)) {
      $shasumsByDirectory[$artifactDir] = New-Object System.Collections.Generic.List[string]
    }
    $shasumsByDirectory[$artifactDir].Add(("$hash  $artifactName")) | Out-Null
  }
}

foreach ($entry in $shasumsByDirectory.GetEnumerator()) {
  $shasumsPath = Join-Path $entry.Key 'SHASUMS256.txt'
  @($entry.Value | Sort-Object) | Set-Content -Path $shasumsPath -Encoding ascii
  Write-Host "[installer-hash] Generado: $shasumsPath"
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
