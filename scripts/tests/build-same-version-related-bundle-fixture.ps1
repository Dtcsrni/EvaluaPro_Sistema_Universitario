[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$CandidateBundlePath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$FixtureVersion = '',
  [string]$EnvironmentVariableName = 'SAME_VERSION_RELATED_BUNDLE_PATH',
  [string]$RootPath = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RootPath)) { $RootPath = Join-Path $PSScriptRoot '..\..' }
$root = (Resolve-Path -LiteralPath $RootPath -ErrorAction Stop).Path
$candidatePath = (Resolve-Path -LiteralPath $CandidateBundlePath -ErrorAction Stop).Path
$candidate = Get-Item -LiteralPath $candidatePath -ErrorAction Stop
$candidateVersion = $null
if (-not [version]::TryParse([string]$candidate.VersionInfo.ProductVersion, [ref]$candidateVersion)) {
  throw "No se pudo leer la versión del bundle candidato: $($candidate.VersionInfo.ProductVersion)"
}
$requestedFixtureVersion = $FixtureVersion
$fixtureVersion = $candidateVersion
if (-not [string]::IsNullOrWhiteSpace($requestedFixtureVersion)) {
  if (-not [version]::TryParse($requestedFixtureVersion, [ref]$fixtureVersion)) {
    throw "La versión del bundle fixture no es válida: $requestedFixtureVersion"
  }
  if ($fixtureVersion -ge $candidateVersion) {
    throw "El fixture previo debe ser menor que el candidato: fixture=$fixtureVersion candidate=$candidateVersion"
  }
}
if ($EnvironmentVariableName -notmatch '^[A-Z][A-Z0-9_]*$') {
  throw "Nombre de variable de entorno inválido: $EnvironmentVariableName"
}
$comSpec = [Environment]::GetEnvironmentVariable('ComSpec')
if ([string]::IsNullOrWhiteSpace($comSpec) -or -not (Test-Path -LiteralPath $comSpec -PathType Leaf)) {
  throw 'Windows ComSpec no está disponible para el paquete inerte del fixture.'
}
$catalog = Get-Content -LiteralPath (Join-Path $root 'config\installer-flavors.json') -Raw -Encoding utf8 | ConvertFrom-Json
$flavor = @($catalog.flavors | Where-Object { [string]$_.flavorId -eq 'docente-local' })
if ($flavor.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string]$flavor[0].bundleUpgradeCode)) {
  throw 'No se pudo resolver un único BundleUpgradeCode de docente-local.'
}

$output = [IO.Path]::GetFullPath($OutputPath)
$outputParent = Split-Path -Parent $output
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
  New-Item -ItemType Directory -Path $outputParent -Force | Out-Null
}
if (Test-Path -LiteralPath $output -PathType Leaf) { throw "El destino del fixture ya existe; use una ruta única: $output" }
$wixCommand = Get-Command wix -ErrorAction Stop
$wixPath = $wixCommand.Source
$extensionRoot = Join-Path ([IO.Path]::GetTempPath()) ('evalupro-wix-bal-fixture-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $extensionRoot -Force | Out-Null
$previousLocation = Get-Location
try {
  Set-Location -LiteralPath $extensionRoot
  & $wixPath extension add 'WixToolset.Bal.wixext/7.0.0'
  if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar WiX BAL para el fixture (exit=$LASTEXITCODE)." }
  $extensionDir = Join-Path $extensionRoot '.wix\extensions\WixToolset.Bal.wixext\7.0.0'
  $balExtension = Get-ChildItem -LiteralPath $extensionDir -Recurse -Filter 'WixToolset.BootstrapperApplications.wixext.dll' -File | Select-Object -First 1
  if (-not $balExtension) { throw 'No se encontró la extensión BAL de WiX 7 para compilar el fixture.' }
  & $wixPath build (Join-Path $root 'packaging\wix\tests\SameVersionRelatedBundleFixture.wxs') `
    -arch x64 `
    -ext $balExtension.FullName `
    -d "Version=$fixtureVersion" `
    -d "BundleUpgradeCode=$($flavor[0].bundleUpgradeCode)" `
    -d "FixtureExePath=$comSpec" `
    -o $output
  if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar el fixture Burn (exit=$LASTEXITCODE)." }
} finally {
  Set-Location -LiteralPath $previousLocation
}

$fixture = Get-Item -LiteralPath $output -ErrorAction Stop
$actualFixtureVersion = $null
if (-not [version]::TryParse([string]$fixture.VersionInfo.ProductVersion, [ref]$actualFixtureVersion) -or $actualFixtureVersion -ne $fixtureVersion) {
  throw "El fixture no quedó con la versión solicitada: expected=$fixtureVersion actual=$($fixture.VersionInfo.ProductVersion)"
}
$fixtureHash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Fixture Burn listo: version=$actualFixtureVersion candidate=$candidateVersion; bundleUpgradeCode=$($flavor[0].bundleUpgradeCode); bytes=$($fixture.Length); sha256=$fixtureHash"
if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
  [IO.File]::AppendAllText($env:GITHUB_ENV, "$EnvironmentVariableName=$output`n", [Text.UTF8Encoding]::new($false))
}
