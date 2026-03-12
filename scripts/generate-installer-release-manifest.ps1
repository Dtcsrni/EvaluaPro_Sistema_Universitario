param(
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$OutputPath = '',
  [string]$DeploymentTarget = '',
  [string]$ReleaseBaseUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Version) {
  $pkgPath = Join-Path $root 'package.json'
  $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}

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
$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 8
$unsignedMarker = Join-Path $installerDir 'SIGNING-NOT-PRODUCTION.txt'
$isSigned = -not (Test-Path $unsignedMarker)

$artifactIndex = @{}
$artifacts = @()
$allArtifactNames = @('EvaluaPro-release-manifest.json')
foreach ($flavor in $catalog.flavors) {
  $allArtifactNames += @([string]$flavor.msiName, [string]$flavor.bundleName, [string]$flavor.installerHubExeName)
}

foreach ($name in ($allArtifactNames | Select-Object -Unique)) {
  $artifactPath = Join-Path $installerDir $name
  if (-not (Test-Path $artifactPath)) { continue }
  $sha256 = (Get-FileHash -Path $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $entry = [ordered]@{
    name = $name
    sha256 = $sha256
    signed = $isSigned
  }
  $artifacts += $entry
  $artifactIndex[$name] = $entry
}

$flavors = @()
foreach ($flavor in $catalog.flavors) {
  $msiName = [string]$flavor.msiName
  $bundleName = [string]$flavor.bundleName
  $hubName = [string]$flavor.installerHubExeName
  $msiUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$msiName" } else { '' }
  $msiShaUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$msiName.sha256" } else { '' }
  $bundleUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$bundleName" } else { '' }
  $bundleShaUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$bundleName.sha256" } else { '' }
  $hubUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$hubName" } else { '' }
  $hubShaUrl = if ($ReleaseBaseUrl) { "$ReleaseBaseUrl/$hubName.sha256" } else { '' }

  $flavors += [ordered]@{
    flavorId = [string]$flavor.flavorId
    channel = $Channel
    assetName = $bundleName
    sha256AssetName = "$bundleName.sha256"
    msiName = $msiName
    msiSha256Name = "$msiName.sha256"
    bundleUrl = $bundleUrl
    bundleSha256Url = $bundleShaUrl
    installerHubName = $hubName
    installerHubUrl = $hubUrl
    installerHubSha256Url = $hubShaUrl
    msiUrl = $msiUrl
    msiSha256Url = $msiShaUrl
    prerequisitesProfile = [string]$flavor.prerequisitesProfile
    deploymentTarget = if ($DeploymentTarget) { $DeploymentTarget } else { [string]$flavor.deploymentTarget }
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
