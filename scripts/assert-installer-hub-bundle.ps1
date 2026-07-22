# assert-installer-hub-bundle.ps1
#
# Responsabilidad: validar que el bundle Burn publico contiene una Bootstrapper Application vigente.
# Limites: inspecciona metadata del ejecutable externo y del BA embebido; no firma ni modifica artefactos.
param(
  [Parameter(Mandatory = $true)]
  [string]$BundlePath,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion,
  [string]$WixExecutable = 'wix'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-VersionPrefix {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [AllowEmptyString()]
    [string]$Actual,
    [Parameter(Mandatory = $true)]
    [string]$Expected
  )

  $escapedExpected = [Regex]::Escape($Expected)
  $versionPattern = "^{0}($|[.+-])" -f $escapedExpected
  if ([string]::IsNullOrWhiteSpace($Actual) -or -not ([Regex]::IsMatch($Actual, $versionPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase))) {
    throw "$Label invalida. Esperada=$Expected, Actual=$Actual"
  }
}

if (-not (Test-Path -LiteralPath $BundlePath)) {
  throw "No existe bundle Installer Hub: $BundlePath"
}

$resolvedBundlePath = (Resolve-Path -LiteralPath $BundlePath).Path
$bundleInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($resolvedBundlePath)
Assert-VersionPrefix -Label 'Bundle FileVersion' -Actual ([string]$bundleInfo.FileVersion) -Expected $ExpectedVersion
Assert-VersionPrefix -Label 'Bundle ProductVersion' -Actual ([string]$bundleInfo.ProductVersion) -Expected $ExpectedVersion

$extractRoot = Join-Path $env:TEMP ("evaluapro-bundle-guard-{0}" -f [Guid]::NewGuid().ToString('N'))
$outDir = Join-Path $extractRoot 'out'
$baDir = Join-Path $extractRoot 'ba'
try {
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  $extractProc = Start-Process -FilePath $WixExecutable -ArgumentList @('burn', 'extract', $resolvedBundlePath, '-out', $outDir, '-outba', $baDir) -Wait -NoNewWindow -PassThru
  if ([int]$extractProc.ExitCode -ne 0) {
    throw "No se pudo extraer bundle Burn para validar BA (exit=$($extractProc.ExitCode)): $resolvedBundlePath"
  }

  $baPath = Join-Path $baDir 'EvaluaPro.BurnBootstrapperApp.exe'
  if (-not (Test-Path -LiteralPath $baPath)) {
    throw "Bundle Burn no contiene EvaluaPro.BurnBootstrapperApp.exe: $resolvedBundlePath"
  }

  $baInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($baPath)
  Assert-VersionPrefix -Label 'Bootstrapper Application FileVersion' -Actual ([string]$baInfo.FileVersion) -Expected $ExpectedVersion
  Assert-VersionPrefix -Label 'Bootstrapper Application ProductVersion' -Actual ([string]$baInfo.ProductVersion) -Expected $ExpectedVersion

  Write-Host "[installer-guard] Bundle OK: $resolvedBundlePath"
  Write-Host "[installer-guard] Bundle FileVersion=$($bundleInfo.FileVersion) ProductVersion=$($bundleInfo.ProductVersion)"
  Write-Host "[installer-guard] BA FileVersion=$($baInfo.FileVersion) ProductVersion=$($baInfo.ProductVersion)"
} finally {
  if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
