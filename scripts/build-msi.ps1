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
$internalOut = Join-Path $out '_internal'
$flavorCatalogPath = Join-Path $root 'config\installer-flavors.json'
$canonicalInstallerIconPath = Join-Path $root 'scripts\icons\installer-canonical.ico'

function Remove-StaleInstallerArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$InternalOutputDirectory
  )

  $legacyPatterns = @(
    'EvaluaPro-*-Setup.exe',
    'EvaluaPro-*-Setup.wixpdb',
    'installer-local-paths.json',
    '*.extracted.ico',
    '*.msi',
    '*.msi.sha256',
    '*.wixpdb'
  )

  foreach ($pattern in $legacyPatterns) {
    Get-ChildItem -Path $OutputDirectory -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }

  Get-ChildItem -Path $OutputDirectory -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'installer-hub-payload-*' -or $_.Name -eq 'burn-bootstrapper-app' -or $_.Name -eq '_internal' } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }

  if (Test-Path $InternalOutputDirectory) {
    Remove-Item -LiteralPath $InternalOutputDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Remove-OptionalInstallerArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
  )

  Get-ChildItem -Path $OutputDirectory -Filter '*.extracted.ico' -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
  }
}

function Write-InstallerLocalPathsManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object[]]$FlavorDefinitions,
    [Parameter(Mandatory = $true)]
    [string]$PublicOutputDirectory
  )

  $manifestPath = Join-Path $OutputDirectory 'installer-local-paths.json'
  $recommended = $FlavorDefinitions | Where-Object { [string]$_.flavorId -eq 'docente-local' } | Select-Object -First 1
  if (-not $recommended) {
    $recommended = $FlavorDefinitions | Select-Object -First 1
  }

  $payload = [ordered]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    outputDir = $OutputDirectory
    publicOutputDir = $PublicOutputDirectory
    recommendedFlavorId = if ($recommended) { [string]$recommended.flavorId } else { '' }
    recommendedHubExecutableName = if ($recommended) { [string]$recommended.bundleName } else { '' }
    recommendedHubExecutablePath = if ($recommended) { [string](Join-Path $PublicOutputDirectory ([string]$recommended.bundleName)) } else { '' }
    flavors = @($FlavorDefinitions | ForEach-Object {
      [ordered]@{
        flavorId = [string]$_.flavorId
        displayName = [string]$_.displayName
        executableName = [string]$_.bundleName
        executablePath = [string](Join-Path $PublicOutputDirectory ([string]$_.bundleName))
      }
    })
  }

  ($payload | ConvertTo-Json -Depth 6) | Set-Content -Path $manifestPath -Encoding utf8
}

function Get-IcoImageSizes {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  $bytes = [System.IO.File]::ReadAllBytes($IconPath)
  if ($bytes.Length -lt 6) {
    throw "Icono invalido (cabecera incompleta): $IconPath"
  }

  $reserved = [BitConverter]::ToUInt16($bytes, 0)
  $iconType = [BitConverter]::ToUInt16($bytes, 2)
  $entryCount = [BitConverter]::ToUInt16($bytes, 4)

  if ($reserved -ne 0 -or $iconType -ne 1 -or $entryCount -lt 1) {
    throw "Icono invalido (formato ICO no reconocido): $IconPath"
  }

  $sizes = New-Object 'System.Collections.Generic.HashSet[int]'
  for ($i = 0; $i -lt $entryCount; $i++) {
    $entryOffset = 6 + ($i * 16)
    if (($entryOffset + 15) -ge $bytes.Length) { break }

    $rawWidth = [int]$bytes[$entryOffset]
    $rawHeight = [int]$bytes[$entryOffset + 1]
    $width = if ($rawWidth -eq 0) { 256 } else { $rawWidth }
    $height = if ($rawHeight -eq 0) { 256 } else { $rawHeight }
    if ($width -eq $height) {
      [void]$sizes.Add($width)
    }
  }

  return @($sizes | Sort-Object)
}

function Assert-CanonicalInstallerIcon {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  if (-not (Test-Path $IconPath)) {
    throw "No existe icono canónico del installer: $IconPath"
  }

  $requiredSizes = @(16, 24, 32, 48, 64, 128, 256)
  $actualSizes = @(Get-IcoImageSizes -IconPath $IconPath)
  $missingSizes = @($requiredSizes | Where-Object { $actualSizes -notcontains $_ })
  if ($missingSizes.Count -gt 0) {
    throw "Icono canónico inválido. Faltan tamaños ICO requeridos: $($missingSizes -join ', '). Detectados: $($actualSizes -join ', ')"
  }

  Write-Host "[msi] Icono canónico validado: $IconPath (sizes: $($actualSizes -join ', '))"
}

function Assert-BundleIconCompatible {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  if (-not (Test-Path $IconPath)) {
    throw "No existe icono de bundle: $IconPath"
  }

  $sizes = @(Get-IcoImageSizes -IconPath $IconPath)
  if ($sizes.Count -lt 1) {
    throw "Icono de bundle inválido (sin tamaños detectables): $IconPath"
  }

  Write-Host "[msi] Icono de bundle validado: $IconPath (sizes: $($sizes -join ', '))"
}

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

function Resolve-DotNetExecutable {
  $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
  if ($dotnetCmd) {
    return $dotnetCmd.Source
  }

  $candidates = @(
    "$env:ProgramFiles\dotnet\dotnet.exe",
    "${env:ProgramFiles(x86)}\dotnet\dotnet.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $candidateList = @($candidates)
  if ($candidateList.Count -gt 0) {
    return $candidateList[0]
  }

  throw 'No se encontro dotnet.exe. Instala .NET SDK 8 para compilar la Bootstrapper Application.'
}

function Publish-BurnBootstrapperApp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DotNetExecutable,
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [string]$ConfigurationName = 'Release'
  )

  if (-not (Test-Path $ProjectPath)) {
    throw "No existe proyecto de Bootstrapper Application: $ProjectPath"
  }

  if (Test-Path $OutputDirectory) {
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  & $DotNetExecutable publish $ProjectPath -c $ConfigurationName -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $OutputDirectory | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw 'Fallo publish de la Bootstrapper Application Burn.'
  }

  $exePath = Join-Path $OutputDirectory 'EvaluaPro.BurnBootstrapperApp.exe'
  if (-not (Test-Path $exePath)) {
    throw "No se genero el ejecutable de la Bootstrapper Application: $exePath"
  }

  return $exePath
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

function New-ScopedFlavorCatalog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceCatalogPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object]$FlavorDefinition
  )

  $sourceCatalog = Get-Content -Path $SourceCatalogPath -Raw -Encoding utf8 | ConvertFrom-Json
  $flavorId = [string]$FlavorDefinition.flavorId

  $scoped = [ordered]@{
    version = if ($null -ne $sourceCatalog.version) { [int]$sourceCatalog.version } else { 1 }
    defaultFlavorId = $flavorId
    flavors = @($FlavorDefinition)
  }

  $scopedDir = Join-Path $OutputDirectory 'bundle-input'
  New-Item -ItemType Directory -Path $scopedDir -Force | Out-Null
  $scopedPath = Join-Path $scopedDir ("installer-flavors.{0}.json" -f $flavorId)
  ($scoped | ConvertTo-Json -Depth 10) | Set-Content -Path $scopedPath -Encoding utf8
  return $scopedPath
}

function New-FlavorBundleIcon {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object]$FlavorDefinition
  )

  $flavorId = [string]$FlavorDefinition.flavorId
  $iconScript = Join-Path $RootPath 'scripts\icons\generate-installer-flavor-icon.ps1'
  if (-not (Test-Path -LiteralPath $iconScript)) {
    throw "No existe script de icono por flavor: $iconScript"
  }

  $iconsOutDir = Join-Path $OutputDirectory 'bundle-input\icons'
  New-Item -ItemType Directory -Path $iconsOutDir -Force | Out-Null
  $iconPath = Join-Path $iconsOutDir ("installer-icon.{0}.ico" -f $flavorId)

  & powershell -NoProfile -ExecutionPolicy Bypass -File $iconScript -FlavorId $flavorId -OutputPath $iconPath | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo generar icono por flavor para '$flavorId'."
  }

  Assert-BundleIconCompatible -IconPath $iconPath
  return $iconPath
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
  throw "No se encontró CLI de WiX (wix.exe). Instala WiX Toolset v6.0.x estable y agrega 'wix' al PATH."
}

$wixVersionRaw = (& $wixExe --version 2>$null | Select-Object -First 1)
if (-not $wixVersionRaw) {
  throw "No se pudo leer la versión de WiX. Verifica instalación de WiX Toolset v6.0.x estable."
}

$wixVersionText = [string]$wixVersionRaw
$wixVersionMatch = [Regex]::Match($wixVersionText, '\d+(\.\d+){1,3}')
if (-not $wixVersionMatch.Success) {
  throw "No se pudo interpretar la versión de WiX desde: $wixVersionText"
}

$wixVersion = [Version]$wixVersionMatch.Value
if ($wixVersion.Major -lt 6) {
  throw "WiX detectado: $wixVersion. Se requiere WiX Toolset v6.0.x estable."
}

if (($wixVersion.Major -eq 6) -and ($wixVersion.Minor -gt 0)) {
  throw "WiX detectado: $wixVersion. Este pipeline está fijado a WiX 6.0.x para estabilidad del Burn icon handling."
}

if (-not (Test-Path $out)) {
  New-Item -ItemType Directory -Path $out | Out-Null
}

Remove-StaleInstallerArtifacts -OutputDirectory $out -InternalOutputDirectory $internalOut
Remove-OptionalInstallerArtifacts -OutputDirectory $out

New-Item -ItemType Directory -Path $out -Force | Out-Null
New-Item -ItemType Directory -Path $internalOut -Force | Out-Null
Assert-CanonicalInstallerIcon -IconPath $canonicalInstallerIconPath

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
$preBundleSteps = if ($buildBundle) { 1 } else { 0 }
$totalSteps = $checks.Count + $preBundleSteps + ($selectedFlavors.Count * $stepsPerFlavor)
$idx = 1

foreach ($check in $checks) {
  Invoke-CheckedStep -Index $idx -Total $totalSteps -Title $check.Title -Command $check.Cmd
  $idx += 1
}

$balExtDll = $null
$bootstrapperAppExe = $null
if ($buildBundle) {
  $balExtDll = Resolve-BalExtensionDll -WixExecutable $wixExe -WixVersion $wixVersion -RootPath $root
  $dotnetExe = Resolve-DotNetExecutable
  $bootstrapperProject = Join-Path $root 'packaging\wix\BurnBootstrapperApp\EvaluaPro.BurnBootstrapperApp.csproj'
  $bootstrapperOut = Join-Path $internalOut 'burn-bootstrapper-app'
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Publicar Bootstrapper Application Burn" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
  Write-Host "[msi][step $idx/$totalSteps] Publicar Bootstrapper Application Burn"
  $bootstrapperAppExe = Publish-BurnBootstrapperApp -DotNetExecutable $dotnetExe -ProjectPath $bootstrapperProject -OutputDirectory $bootstrapperOut -ConfigurationName $Configuration
  $idx += 1
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
    "-o", (Join-Path $internalOut $msiName)
  )
  if ($Version) { $productArgs += @("-d", "Version=$Version") }
  & $wixExe @productArgs
  if ($LASTEXITCODE -ne 0) { throw "Falló build de Product.wxs para $flavorId" }
  $idx += 1

  if ($buildBundle) {
    $scopedFlavorCatalogPath = New-ScopedFlavorCatalog -SourceCatalogPath $flavorCatalogPath -OutputDirectory $internalOut -FlavorDefinition $flavorDef
    $flavorBundleIconPath = New-FlavorBundleIcon -RootPath $root -OutputDirectory $internalOut -FlavorDefinition $flavorDef
    Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar bundle $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
    Write-Host "[msi][step $idx/$totalSteps] Compilar bundle $flavorId"
    $bundleArgs = @(
      "build", $bundle,
      "-arch", "x64",
      "-ext", $balExtDll,
      "-bindpath", (Split-Path -Parent $bootstrapperAppExe),
      "-bindpath", (Join-Path $root 'scripts\installer-burn'),
      "-bindpath", (Join-Path $root 'config'),
      "-bindpath", (Join-Path $root 'scripts\comercial'),
      "-bindpath", (Join-Path $root 'scripts\installer-burn\modules'),
      "-d", "SourceRoot=$root",
      "-d", "FlavorId=$flavorId",
      "-d", "ProductName=$productName",
      "-d", "UpgradeCode=$upgradeCode",
      "-d", "BundleUpgradeCode=$bundleUpgradeCode",
      "-d", "BundleName=$bundleName",
      "-d", "MsiName=$msiName",
      "-d", "MsiSourcePath=$([string](Join-Path $internalOut $msiName))",
      "-d", "FlavorCatalogPath=$scopedFlavorCatalogPath",
      "-d", "BundleIconPath=$flavorBundleIconPath",
      "-o", (Join-Path $out $bundleName)
    )
    if ($Version) { $bundleArgs += @("-d", "Version=$Version") }
    & $wixExe @bundleArgs
    if ($LASTEXITCODE -ne 0) { throw "Falló build de Bundle.wxs para $flavorId" }
    $bundleWixPdb = Join-Path $out ([System.IO.Path]::GetFileNameWithoutExtension($bundleName) + '.wixpdb')
    if (Test-Path $bundleWixPdb) {
      Move-Item -LiteralPath $bundleWixPdb -Destination (Join-Path $internalOut (Split-Path -Leaf $bundleWixPdb)) -Force
    }
    $idx += 1
  }
}

if (-not $buildBundle) {
  Write-Host "[msi] Bundle EXE omitido por defecto (migración Burn WiX v6 en progreso). Usa -IncludeBundle o EVALUAPRO_BUILD_BUNDLE=1 para intentarlo."
}

if ($buildBundle) {
  Write-InstallerLocalPathsManifest -OutputDirectory $internalOut -PublicOutputDirectory $out -FlavorDefinitions $selectedFlavors
}

Remove-OptionalInstallerArtifacts -OutputDirectory $out

Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
Write-Host "[msi] Artefactos generados en $out para flavors: $($selectedFlavors.flavorId -join ', ')"
