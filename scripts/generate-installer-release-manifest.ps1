# generate-installer-release-manifest.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$OutputPath = '',
  [string]$DeploymentTarget = '',
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

function Test-ArtifactSigned {
  param([Parameter(Mandatory = $true)][string]$Path)

  $extension = [System.IO.Path]::GetExtension($Path)
  if ($extension -and $extension.Equals('.json', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  if (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue) {
    try {
      $signature = Get-AuthenticodeSignature -FilePath $Path
      $status = [string]$signature.Status
      if ($status -eq 'Valid') {
        return $true
      }
      return ($null -ne $signature.SignerCertificate -and $status -ne 'NotSigned')
    } catch {
      return $false
    }
  }

  $signtoolCandidates = @(
    (Join-Path $root 'dist\signing-internal\tools\bin\10.0.22621.0\x64\signtool.exe'),
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\x64\\signtool.exe'
  )
  foreach ($candidate in $signtoolCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    try {
      & $candidate verify /pa $Path *> $null
      if ($LASTEXITCODE -eq 0) { return $true }
    } catch { continue }
  }

  return $false
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

function Resolve-VersionTag {
  param(
    [string]$RootPath,
    [string]$RequestedVersion
  )

  $resolved = [string]$RequestedVersion
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $pkgPath = Join-Path $RootPath 'package.json'
    if (Test-Path -LiteralPath $pkgPath) {
      $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
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

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Version) {
  $pkgPath = Join-Path $root 'package.json'
  $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}
$versionTag = Resolve-VersionTag -RootPath $root -RequestedVersion $Version

if (-not $OutputPath) {
  $OutputPath = Join-Path $root 'dist\installer\EvaluaPro-release-manifest.json'
}

$commit = [string]$env:GITHUB_SHA
if (-not $commit) {
  try {
    $commit = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
  } catch {
    $commit = ''
  }
}
if (-not $commit) {
  $commit = 'local'
}

$installerDir = Split-Path -Parent $OutputPath
$internalInstallerDir = Join-Path $installerDir '_internal'
$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json

function Join-UrlPath {
  param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )

  $base = $BaseUrl.TrimEnd('/')
  $rel = ($RelativePath -replace '\\', '/').TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($rel)) { return $base }
  return "$base/$rel"
}

function Get-RelativeArtifactPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,
    [Parameter(Mandatory = $true)]
    [string]$InstallerRoot
  )

  try {
    return [string][System.IO.Path]::GetRelativePath($InstallerRoot, $ArtifactPath)
  } catch {
    return [string]$ArtifactPath
  }
}

function Resolve-InstallerArtifactPath {
  param(
    [Parameter(Mandatory = $true)][string]$ArtifactName,
    [string]$FlavorId = '',
    [switch]$PreferInternal
  )

  $candidatePaths = @()
  if (-not [string]::IsNullOrWhiteSpace($FlavorId)) {
    if ($PreferInternal) {
      $candidatePaths += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
      $candidatePaths += @(Join-Path (Join-Path $installerDir $FlavorId) $ArtifactName)
    } else {
      $candidatePaths += @(Join-Path (Join-Path $installerDir $FlavorId) $ArtifactName)
      $candidatePaths += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
    }
  }

  if ($PreferInternal) {
    $candidatePaths += @(Join-Path $internalInstallerDir $ArtifactName)
    $candidatePaths += @(Join-Path $installerDir $ArtifactName)
  } else {
    $candidatePaths += @(Join-Path $installerDir $ArtifactName)
    $candidatePaths += @(Join-Path $internalInstallerDir $ArtifactName)
  }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  return ''
}

$artifactIndex = @{}
$artifacts = @()
$allArtifacts = @(
  [ordered]@{ name = 'EvaluaPro-release-manifest.json'; flavorId = ''; preferInternal = $false }
)
foreach ($flavor in $catalog.flavors) {
  $flavorId = [string]$flavor.flavorId
  $versionedHubName = Get-VersionedArtifactName -BaseName ([string]$flavor.installerHubExeName) -VersionTag $versionTag
  $allArtifacts += @(
    [ordered]@{ name = [string]$flavor.msiName; flavorId = $flavorId; preferInternal = $true },
    [ordered]@{ name = [string]$flavor.installerHubExeName; flavorId = $flavorId; preferInternal = $false },
    [ordered]@{ name = [string]$versionedHubName; flavorId = $flavorId; preferInternal = $false }
  )
}

foreach ($artifactDescriptor in $allArtifacts) {
  $name = [string]$artifactDescriptor.name
  if ([string]::IsNullOrWhiteSpace($name)) { continue }
  if ($artifactIndex.ContainsKey($name)) { continue }
  $artifactPath = Resolve-InstallerArtifactPath -ArtifactName $name -FlavorId ([string]$artifactDescriptor.flavorId) -PreferInternal:([bool]$artifactDescriptor.preferInternal)
  if ([string]::IsNullOrWhiteSpace([string]$artifactPath)) { continue }
  if (-not (Test-Path -LiteralPath $artifactPath)) { continue }
  $sha256 = Get-Sha256Hex -Path $artifactPath
  $crcPath = "$artifactPath.crc32"
  $crc32 = if (Test-Path -LiteralPath $crcPath) {
    ([regex]::Match((Get-Content -LiteralPath $crcPath -Raw), '[A-Fa-f0-9]{8}')).Value.ToLowerInvariant()
  } else {
    Get-Crc32Hex -Path $artifactPath
  }
  $relativePath = Get-RelativeArtifactPath -ArtifactPath $artifactPath -InstallerRoot $installerDir
  $entry = [ordered]@{
    name = $name
    location = if ($artifactPath.StartsWith($internalInstallerDir, [System.StringComparison]::OrdinalIgnoreCase)) { 'internal' } else { 'public' }
    path = ($relativePath -replace '\\', '/')
    sha256 = $sha256
    crc32 = $crc32
    signed = (Test-ArtifactSigned -Path $artifactPath)
  }
  $artifacts += $entry
  $artifactIndex[$name] = $entry
}

$flavors = @()
foreach ($flavor in $catalog.flavors) {
  $msiName = [string]$flavor.msiName
  $bundleName = [string]$flavor.bundleName
  $hubName = [string]$flavor.installerHubExeName
  $versionedHubName = Get-VersionedArtifactName -BaseName $hubName -VersionTag $versionTag
  $flavorId = [string]$flavor.flavorId
  $assetPath = ([System.IO.Path]::Combine($flavorId, $versionedHubName) -replace '\\', '/')
  $assetShaPath = "$assetPath.sha256"
  $publishedAssetPath = $versionedHubName
  $publishedAssetShaPath = "$versionedHubName.sha256"
  $msiPath = ([System.IO.Path]::Combine('_internal', $flavorId, $msiName) -replace '\\', '/')
  $msiShaPath = "$msiPath.sha256"
  $msiUrl = if ($ReleaseBaseUrl) { Join-UrlPath -BaseUrl $ReleaseBaseUrl -RelativePath $msiPath } else { '' }
  $msiShaUrl = if ($ReleaseBaseUrl) { Join-UrlPath -BaseUrl $ReleaseBaseUrl -RelativePath $msiShaPath } else { '' }
  $hubUrl = if ($ReleaseBaseUrl) { Join-UrlPath -BaseUrl $ReleaseBaseUrl -RelativePath $publishedAssetPath } else { '' }
  $hubShaUrl = if ($ReleaseBaseUrl) { Join-UrlPath -BaseUrl $ReleaseBaseUrl -RelativePath $publishedAssetShaPath } else { '' }

  $flavors += [ordered]@{
    flavorId = [string]$flavor.flavorId
    channel = $Channel
    assetName = $versionedHubName
    assetPath = $assetPath
    sha256AssetName = "$versionedHubName.sha256"
    sha256AssetPath = $assetShaPath
    msiName = $msiName
    msiPath = $msiPath
    msiSha256Name = "$msiName.sha256"
    msiSha256Path = $msiShaPath
    bundleName = $bundleName
    bundleUrl = ''
    bundleSha256Url = ''
    installerHubName = $versionedHubName
    installerHubVersionedName = $versionedHubName
    installerHubUrl = $hubUrl
    installerHubSha256Url = $hubShaUrl
    msiUrl = $msiUrl
    msiSha256Url = $msiShaUrl
    prerequisitesProfile = [string]$flavor.prerequisitesProfile
    deploymentTarget = if ($DeploymentTarget) { $DeploymentTarget } else { [string]$flavor.deploymentTarget }
    installViaHubOnly = $true
  }
}

$payload = [ordered]@{
  version = $Version
  channel = $Channel
  publishedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ')
  build = [ordered]@{
    version = $Version
    commit = $commit
  }
  artifacts = $artifacts
  flavors = $flavors
  deployment = [ordered]@{
    target = if ($DeploymentTarget) { $DeploymentTarget } else { 'multi-flavor-windows' }
  }
}

$dir = Split-Path -Parent $OutputPath
if (-not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

($payload | ConvertTo-Json -Depth 8) | Set-Content -Path $OutputPath -Encoding utf8
Write-Host "[installer-manifest] Generado en $OutputPath"
