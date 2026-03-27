param(
  [string]$Configuration = "Release",
  [string]$Version = "",
  [switch]$SkipStabilityChecks,
  [switch]$IncludeBundle,
  [string]$Flavor = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wix = Join-Path $root "packaging\wix"
$out = Join-Path $root "dist\installer"
$flavorCatalogPath = Join-Path $root 'config\installer-flavors.json'

function Invoke-CheckedStep {
  param(
    [int]$Index,
    [int]$Total,
    [string]$Title,
    [string]$Command
  )

  $pct = [Math]::Floor((($Index - 1) * 100) / [Math]::Max(1, $Total))
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status $Title -PercentComplete $pct
  Write-Host "[msi][step $Index/$Total] $Title"
  & cmd /c $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en paso '$Title' (exit=$LASTEXITCODE): $Command"
  }
}

function Resolve-BalExtensionDll {
  param(
    [string]$WixExecutable,
    [Version]$WixVersion,
    [string]$RootPath
  )

  $balPackageRef = "WixToolset.Bal.wixext/$($WixVersion.ToString())"
  & $WixExecutable extension add $balPackageRef | Out-Null

  $balDllCandidates = @(
    (Join-Path $RootPath ".wix\extensions\WixToolset.Bal.wixext\$($WixVersion.ToString())\wixext6\WixToolset.BootstrapperApplications.wixext.dll"),
    (Join-Path $RootPath ".wix\extensions\WixToolset.Bal.wixext\$($WixVersion.ToString())\wixext6\WixToolset.Bal.wixext.dll")
  )

  $balDll = $balDllCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $balDll) {
    throw "No se pudo resolver extensión BAL de WiX 6. Esperado paquete $balPackageRef en .wix/extensions."
  }

  return $balDll
}

function Get-SelectedFlavors {
  param(
    [string]$CatalogPath,
    [string]$RequestedFlavor
  )

  if (-not (Test-Path $CatalogPath)) {
    throw "No existe catalogo de flavors: $CatalogPath"
  }

  $catalog = Get-Content -Path $CatalogPath -Raw -Encoding utf8 | ConvertFrom-Json
  $flavors = @($catalog.flavors)
  $requested = [string]$RequestedFlavor
  if ([string]::IsNullOrWhiteSpace($requested) -or $requested -eq 'all') { return $flavors }

  $requestedIds = @($requested.Split(',') | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  if ($requestedIds.Count -eq 0) { return $flavors }

  return @($flavors | Where-Object { $requestedIds -contains [string]$_.flavorId })
}

if (-not (Test-Path $wix)) {
  throw "No existe carpeta WiX en $wix"
}

$wixExe = $null
$wixCmd = Get-Command wix -ErrorAction SilentlyContinue
if ($wixCmd) {
  $wixExe = $wixCmd.Source
} else {
  $wixCandidates = @(
    "$env:ProgramFiles\WiX Toolset v6.0\bin\wix.exe",
    "${env:ProgramFiles(x86)}\WiX Toolset v6.0\bin\wix.exe",
    "$env:ProgramFiles\WiX Toolset v6.0\bin\wix.cmd",
    "${env:ProgramFiles(x86)}\WiX Toolset v6.0\bin\wix.cmd"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $wixCandidateList = @($wixCandidates)
  if ($wixCandidateList.Count -gt 0) {
    $wixExe = $wixCandidateList[0]
  }
}

if (-not $wixExe) {
  throw "No se encontró CLI de WiX (wix.exe). Instala WiX Toolset v6+ estable y agrega 'wix' al PATH."
}

$wixVersionRaw = (& $wixExe --version 2>$null | Select-Object -First 1)
if (-not $wixVersionRaw) {
  throw "No se pudo leer la versión de WiX. Verifica instalación de WiX Toolset v6+ estable."
}

$wixVersionText = [string]$wixVersionRaw
$wixVersionMatch = [Regex]::Match($wixVersionText, '\d+(\.\d+){1,3}')
if (-not $wixVersionMatch.Success) {
  throw "No se pudo interpretar la versión de WiX desde: $wixVersionText"
}

$wixVersion = [Version]$wixVersionMatch.Value
if ($wixVersion.Major -lt 6) {
  throw "WiX detectado: $wixVersion. Se requiere WiX Toolset v6+ estable."
}

if (-not (Test-Path $out)) {
  New-Item -ItemType Directory -Path $out | Out-Null
}

$product = Join-Path $wix "Product.wxs"
$bundle = Join-Path $wix "Bundle.wxs"
$fragmentFiles = @(
  (Join-Path $wix "Fragments\AppFiles.wxs"),
  (Join-Path $wix "Fragments\Shortcuts.wxs"),
  (Join-Path $wix "Fragments\Cleanup.wxs")
)

$checks = @()
if (-not $SkipStabilityChecks) {
  $checks = @(
    @{ Title = "Lint"; Cmd = "npm run lint" },
    @{ Title = "Typecheck"; Cmd = "npm run typecheck" },
    @{ Title = "Tests backend CI"; Cmd = "npm run test:backend:ci" },
    @{ Title = "Tests portal CI"; Cmd = "npm run test:portal:ci" },
    @{ Title = "Tests frontend CI"; Cmd = "npm run test:frontend:ci" },
    @{ Title = "Clean architecture check"; Cmd = "npm run qa:clean-architecture:check" },
    @{ Title = "Pipeline contract check"; Cmd = "npm run pipeline:contract:check" }
  )
}

$buildBundle = $IncludeBundle -or ($env:EVALUAPRO_BUILD_BUNDLE -match '^(1|true|yes|si)$')
$selectedFlavors = @(Get-SelectedFlavors -CatalogPath $flavorCatalogPath -RequestedFlavor $Flavor)
if ($selectedFlavors.Count -eq 0) {
  throw "No se resolvieron flavors para '$Flavor'."
}

$stepsPerFlavor = if ($buildBundle) { 2 } else { 1 }
$totalSteps = $checks.Count + ($selectedFlavors.Count * $stepsPerFlavor)
$idx = 1

foreach ($check in $checks) {
  Invoke-CheckedStep -Index $idx -Total $totalSteps -Title $check.Title -Command $check.Cmd
  $idx += 1
}

$balExtDll = $null
if ($buildBundle) {
  $balExtDll = Resolve-BalExtensionDll -WixExecutable $wixExe -WixVersion $wixVersion -RootPath $root
}

foreach ($flavorDef in $selectedFlavors) {
  $flavorId = [string]$flavorDef.flavorId
  $productName = [string]$flavorDef.productName
  $msiName = [string]$flavorDef.msiName
  $bundleName = [string]$flavorDef.bundleName
  $upgradeCode = [string]$flavorDef.upgradeCode
  $bundleUpgradeCode = [string]$flavorDef.bundleUpgradeCode

  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar MSI $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
  Write-Host "[msi][step $idx/$totalSteps] Compilar MSI $flavorId"
  $productArgs = @(
    "build", $product
  ) + $fragmentFiles + @(
    "-arch", "x64",
    "-d", "SourceRoot=$root",
    "-d", "FlavorId=$flavorId",
    "-d", "ProductName=$productName",
    "-d", "UpgradeCode=$upgradeCode",
    "-d", "BundleName=$bundleName",
    "-o", (Join-Path $out $msiName)
  )
  if ($Version) { $productArgs += @("-d", "Version=$Version") }
  & $wixExe @productArgs
  if ($LASTEXITCODE -ne 0) { throw "Falló build de Product.wxs para $flavorId" }
  $idx += 1

  if ($buildBundle) {
    Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar bundle $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
    Write-Host "[msi][step $idx/$totalSteps] Compilar bundle $flavorId"
    $bundleArgs = @(
      "build", $bundle,
      "-arch", "x64",
      "-ext", $balExtDll,
      "-d", "SourceRoot=$root",
      "-d", "FlavorId=$flavorId",
      "-d", "ProductName=$productName",
      "-d", "UpgradeCode=$upgradeCode",
      "-d", "BundleUpgradeCode=$bundleUpgradeCode",
      "-d", "BundleName=$bundleName",
      "-d", "MsiName=$msiName",
      "-o", (Join-Path $out $bundleName)
    )
    if ($Version) { $bundleArgs += @("-d", "Version=$Version") }
    & $wixExe @bundleArgs
    if ($LASTEXITCODE -ne 0) { throw "Falló build de Bundle.wxs para $flavorId" }
    $idx += 1
  }
}

if (-not $buildBundle) {
  Write-Host "[msi] Bundle EXE omitido por defecto (migración Burn WiX v6 en progreso). Usa -IncludeBundle o EVALUAPRO_BUILD_BUNDLE=1 para intentarlo."
}

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
Write-Host "[msi] Artefactos generados en $out para flavors: $($selectedFlavors.flavorId -join ', ')"
