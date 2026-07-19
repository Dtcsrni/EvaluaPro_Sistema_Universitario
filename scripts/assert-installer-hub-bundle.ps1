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

function ConvertTo-DotNetNumericVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$VersionTag
  )

  $match = [Regex]::Match($VersionTag, '^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?')
  if (-not $match.Success) {
    throw "La version esperada no contiene un prefijo numerico compatible con .NET: $VersionTag"
  }
  $parts = @(
    [int64]$match.Groups[1].Value,
    $(if ($match.Groups[2].Success) { [int64]$match.Groups[2].Value } else { 0 }),
    $(if ($match.Groups[3].Success) { [int64]$match.Groups[3].Value } else { 0 }),
    $(if ($match.Groups[4].Success) { [int64]$match.Groups[4].Value } else { 0 })
  )
  if ($parts | Where-Object { $_ -gt 65535 }) {
    throw "La version esperada excede el limite numerico de .NET: $VersionTag"
  }
  return ($parts -join '.')
}

function Assert-NumericVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [AllowEmptyString()]
    [string]$Actual,
    [Parameter(Mandatory = $true)]
    [string]$Expected
  )

  if ([string]::IsNullOrWhiteSpace($Actual) -or $Actual -notlike "$Expected*") {
    throw "$Label numerica invalida. Esperada=$Expected, Actual=$Actual"
  }
}

if (-not (Test-Path -LiteralPath $BundlePath)) {
  throw "No existe bundle Installer Hub: $BundlePath"
}

$resolvedBundlePath = (Resolve-Path -LiteralPath $BundlePath).Path
$expectedNumericVersion = ConvertTo-DotNetNumericVersion -VersionTag $ExpectedVersion
$bundleInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($resolvedBundlePath)
Assert-NumericVersion -Label 'Bundle FileVersion' -Actual ([string]$bundleInfo.FileVersion) -Expected $expectedNumericVersion
Assert-NumericVersion -Label 'Bundle ProductVersion' -Actual ([string]$bundleInfo.ProductVersion) -Expected $expectedNumericVersion

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
  Assert-NumericVersion -Label 'Bootstrapper Application FileVersion' -Actual ([string]$baInfo.FileVersion) -Expected $expectedNumericVersion
  Assert-VersionPrefix -Label 'Bootstrapper Application ProductVersion' -Actual ([string]$baInfo.ProductVersion) -Expected $ExpectedVersion

  Write-Host "[installer-guard] Bundle OK: $resolvedBundlePath"
  Write-Host "[installer-guard] Bundle FileVersion=$($bundleInfo.FileVersion) ProductVersion=$($bundleInfo.ProductVersion)"
  Write-Host "[installer-guard] BA FileVersion=$($baInfo.FileVersion) ProductVersion=$($baInfo.ProductVersion)"
} finally {
  if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
