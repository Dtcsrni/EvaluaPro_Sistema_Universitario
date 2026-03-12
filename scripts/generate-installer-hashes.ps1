param(
  [string]$InstallerDir = '',
  [string]$Version = '',
  [string]$Channel = 'stable',
  [string]$ReleaseBaseUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $InstallerDir) {
  $InstallerDir = Join-Path $root 'dist\installer'
}

$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json -Depth 8

foreach ($flavor in $catalog.flavors) {
  foreach ($artifactName in @([string]$flavor.msiName, [string]$flavor.bundleName, [string]$flavor.installerHubExeName)) {
    $artifactPath = Join-Path $InstallerDir $artifactName
    if (-not (Test-Path $artifactPath)) { continue }
    $hash = (Get-FileHash -Path $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $hashPath = Join-Path $InstallerDir ($artifactName + '.sha256')
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
