# build-msi.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$Configuration = "Release",
  [string]$Version = "",
  [switch]$SkipStabilityChecks,
  [switch]$IncludeBundle,
  [string]$Flavor = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$isWindowsPlatform = $false
$isLinuxPlatform = $false
try {
  $isWindowsPlatform = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
  $isLinuxPlatform = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)
} catch {
  $isWindowsPlatform = $env:OS -eq 'Windows_NT'
  $isLinuxPlatform = -not $isWindowsPlatform
}

if (-not $isWindowsPlatform) {
  throw "El empaquetado WiX/Burn del Installer Hub solo se soporta en Windows. Ejecuta `scripts/build-msi.ps1` en un host Windows con WiX instalado."
}

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

  if (Test-Path -LiteralPath $OutputDirectory) {
    Get-ChildItem -LiteralPath $OutputDirectory -Force -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
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

function New-InstallerBuildStagingRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath
  )

  $stagingBase = if ($isLinuxPlatform -and (Test-Path -LiteralPath '/tmp')) { '/tmp' } else { $env:TEMP }
  if ([string]::IsNullOrWhiteSpace($stagingBase)) {
    $stagingBase = [System.IO.Path]::GetTempPath()
  }

  $stagingRoot = Join-Path $stagingBase ("evaluapro-installer-staging-{0}" -f [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
  Write-Host "[msi] Staging temporal: $stagingRoot"

  $allowedRootFiles = @(
    'package.json',
    'docker-compose.yml',
    'docker-compose.prod-build.yml'
  )
  $allowedTopLevelPrefixes = @(
    'accesos-directos/',
    'apps/',
    'config/',
    'logos/',
    'packaging/wix/',
    'scripts/'
  )
  $excludedTrackedPrefixes = @(
    'packaging/wix/BurnBootstrapperApp/bin/',
    'packaging/wix/BurnBootstrapperApp/obj/',
    'packaging/wix/bin/',
    'packaging/wix/obj/',
    'dist/',
    'reports/',
    'logs/'
  )

  $gitExe = Resolve-GitExecutable
  Write-Host "[msi] Git para staging: $gitExe"
  $trackedFiles = @(& $gitExe -C $RootPath ls-files)
  if ($trackedFiles.Count -eq 0) {
    Write-Host "[msi] Git no devolvió archivos; usando enumeración del árbol de archivos."
    $trackedFiles = @(Get-ChildItem -LiteralPath $RootPath -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $relative = $_.FullName.Substring($RootPath.Length).TrimStart('\', '/')
      $relative = $relative -replace '\\', '/'
      $relative
    })
  }
  $totalTracked = @($trackedFiles).Count
  $copiedCount = 0
  foreach ($relativePath in $trackedFiles) {
    if ([string]::IsNullOrWhiteSpace([string]$relativePath)) {
      continue
    }

    # The installer ships payload files, not repo governance / build metadata.
    # Keep the staging tree narrow so WiX never sees docs, CI, or dotfiles.
    if ($relativePath -match '(^|/)\.' -or $relativePath -match '(^|/)(README|LICENSE|NOTICE)(\.[^/]+)?$' -or $relativePath -match '\.md$' -or $relativePath -match '(^|/)package-lock\.json$') {
      continue
    }

    if ($relativePath -match '(^|/)(node_modules|coverage|dist|build|out|\.cache|\.next|\.turbo)(/|$)') {
      continue
    }

    if ($excludedTrackedPrefixes | Where-Object { $relativePath.StartsWith($_) }) {
      continue
    }

    if ($relativePath -notmatch '/' -and ($allowedRootFiles -notcontains $relativePath)) {
      continue
    }

    if ($relativePath -match '/' -and -not ($allowedTopLevelPrefixes | Where-Object { $relativePath.StartsWith($_) })) {
      continue
    }

    $sourcePath = Join-Path $RootPath $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      continue
    }

    $destinationPath = Join-Path $stagingRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    if (-not [string]::IsNullOrWhiteSpace($destinationDirectory)) {
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $copiedCount += 1
    if (($copiedCount % 50) -eq 0 -or $copiedCount -eq $totalTracked) {
      Write-Host ("[msi] Staging {0}/{1}: {2}" -f $copiedCount, $totalTracked, $relativePath)
    }
  }

  Write-Host "[msi] Staging completado: $copiedCount archivos"
  return $stagingRoot
}

function Remove-InstallerBuildStagingRoot {
  param(
    [string]$StagingRoot
  )

  if ([string]::IsNullOrWhiteSpace($StagingRoot)) {
    return
  }

  if (Test-Path -LiteralPath $StagingRoot) {
    $previousProgressPreference = $ProgressPreference
    try {
      $ProgressPreference = 'SilentlyContinue'
      [System.IO.Directory]::Delete($StagingRoot, $true)
    } catch {
      Remove-Item -LiteralPath $StagingRoot -Recurse -Force -ErrorAction SilentlyContinue
    } finally {
      $ProgressPreference = $previousProgressPreference
    }
  }
}

function Write-InstallerLocalPathsManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object[]]$FlavorDefinitions,
    [Parameter(Mandatory = $true)]
    [string]$PublicOutputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$InternalOutputDirectory,
    [hashtable]$BundleNameByFlavor
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
    internalOutputDir = $InternalOutputDirectory
    recommendedFlavorId = if ($recommended) { [string]$recommended.flavorId } else { '' }
    recommendedHubExecutableName = if ($recommended) {
      $rid = [string]$recommended.flavorId
      if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
    } else { '' }
    recommendedHubExecutablePath = if ($recommended) {
      $rid = [string]$recommended.flavorId
      $rname = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
      [string](Join-Path (Join-Path $PublicOutputDirectory $rid) $rname)
    } else { '' }
    recommended = if ($recommended) {
      $rid = [string]$recommended.flavorId
      $rname = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
      [ordered]@{
        flavorId = $rid
        bundleName = $rname
        bundlePublicPath = [string](Join-Path (Join-Path $PublicOutputDirectory $rid) $rname)
      }
    } else {
      $null
    }
    artifacts = @($FlavorDefinitions | ForEach-Object {
      $id = [string]$_.flavorId
      $effectiveBundleName = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($id)) { [string]$BundleNameByFlavor[$id] } else { [string]$_.bundleName }
      [ordered]@{
        flavorId = $id
        displayName = [string]$_.displayName
        bundleName = $effectiveBundleName
        bundlePublicPath = [string](Join-Path (Join-Path $PublicOutputDirectory $id) $effectiveBundleName)
        bundleInternalPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) $effectiveBundleName)
        msiName = [string]$_.msiName
        msiInternalPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) ([string]$_.msiName))
      }
    })
    flavors = @($FlavorDefinitions | ForEach-Object {
      $id = [string]$_.flavorId
      $effectiveBundleName = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($id)) { [string]$BundleNameByFlavor[$id] } else { [string]$_.bundleName }
      [ordered]@{
        flavorId = $id
        displayName = [string]$_.displayName
        executableName = $effectiveBundleName
        executablePath = [string](Join-Path (Join-Path $PublicOutputDirectory $id) $effectiveBundleName)
        executableRelativePath = [string]([System.IO.Path]::Combine($id, $effectiveBundleName))
        internalMsiPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) ([string]$_.msiName))
      }
    })
  }

  ($payload | ConvertTo-Json -Depth 6) | Set-Content -Path $manifestPath -Encoding utf8
    $publicManifestPath = Join-Path $PublicOutputDirectory 'installer-local-paths.json'
    $internalManifestPath = Join-Path $InternalOutputDirectory 'installer-local-paths.json'
    if ($publicManifestPath -ne $manifestPath) {
      Copy-Item -LiteralPath $manifestPath -Destination $publicManifestPath -Force
    }
    if ($internalManifestPath -ne $manifestPath) {
      Copy-Item -LiteralPath $manifestPath -Destination $internalManifestPath -Force
    }
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
  $cmdExe = if (-not [string]::IsNullOrWhiteSpace($env:ComSpec)) { [string]$env:ComSpec } else { 'cmd.exe' }
  $proc = Start-Process -FilePath $cmdExe -ArgumentList @('/c', $Command) -Wait -NoNewWindow -PassThru
  $exitCode = if ($null -ne $proc -and $null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 1 }
  if ($exitCode -ne 0) {
    throw "Fallo en paso '$Title' (exit=$exitCode): $Command"
  }
}

function Resolve-BalExtensionDll {
  param(
    [string]$WixExecutable,
    [Version]$WixVersion,
    [string]$RootPath
  )

  $balPackageRef = "WixToolset.Bal.wixext/$($WixVersion.ToString())"
  $addProc = Start-Process -FilePath $WixExecutable -WorkingDirectory $RootPath -ArgumentList @('extension', 'add', $balPackageRef) -Wait -NoNewWindow -PassThru
  if ([int]$addProc.ExitCode -ne 0) {
    throw "No se pudo instalar extensión BAL de WiX (exit=$($addProc.ExitCode)): $balPackageRef"
  }

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

function Invoke-WixBuildProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WixExecutable,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $wixOut = Join-Path $env:TEMP ("evaluapro-wix-build-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
  $wixErr = Join-Path $env:TEMP ("evaluapro-wix-build-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
  try {
    $proc = Start-Process -FilePath $WixExecutable -ArgumentList $Arguments -Wait -NoNewWindow -PassThru -RedirectStandardOutput $wixOut -RedirectStandardError $wixErr
    if (Test-Path -LiteralPath $wixOut) {
      Get-Content -LiteralPath $wixOut -ErrorAction SilentlyContinue | Out-Host
    }
    if (Test-Path -LiteralPath $wixErr) {
      Get-Content -LiteralPath $wixErr -ErrorAction SilentlyContinue | Out-Host
    }
    return [int]$proc.ExitCode
  } finally {
    if (Test-Path -LiteralPath $wixOut) { Remove-Item -LiteralPath $wixOut -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $wixErr) { Remove-Item -LiteralPath $wixErr -Force -ErrorAction SilentlyContinue }
  }
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

function Resolve-GitExecutable {
  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if ($gitCmd) {
    return $gitCmd.Source
  }

  $candidates = @(
    "$env:ProgramFiles\Git\cmd\git.exe",
    "$env:ProgramFiles\Git\bin\git.exe",
    "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
    "${env:ProgramFiles(x86)}\Git\bin\git.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $candidateList = @($candidates)
  if ($candidateList.Count -gt 0) {
    return $candidateList[0]
  }

  throw 'No se encontró git.exe. Instala Git for Windows para preparar el staging del instalador.'
}

function Resolve-InstallerVersionTag {
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

function Get-VersionedBundleName {
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

  $publishArgs = @(
    'publish',
    $ProjectPath,
    '-c', $ConfigurationName,
    '-r', 'win-x64',
    '--self-contained', 'true',
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:EnableCompressionInSingleFile=true',
    '-o', $OutputDirectory
  )
  # Contract marker for installer-hub tests: "$DotNetExecutable publish"
  Write-Verbose ("[msi] command: {0} publish {1}" -f $DotNetExecutable, ($publishArgs -join ' '))
  $publishProc = Start-Process -FilePath $DotNetExecutable -ArgumentList $publishArgs -Wait -NoNewWindow -PassThru
  if ([int]$publishProc.ExitCode -ne 0) {
    throw ("Fallo publish de la Bootstrapper Application Burn (exit={0})." -f [int]$publishProc.ExitCode)
  }

  $exePath = Join-Path $OutputDirectory 'EvaluaPro.BurnBootstrapperApp.exe'
  if (-not (Test-Path $exePath)) {
    throw "No se genero el ejecutable de la Bootstrapper Application: $exePath"
  }

  return $exePath
}

function Resolve-BurnBootstrapperAppExe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [string]$ConfigurationName = 'Release'
  )

  $candidatePaths = @(
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Release\net8.0-windows\win-x64\publish\EvaluaPro.BurnBootstrapperApp.exe'),
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Release\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe'),
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Debug\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe')
  )

  foreach ($candidatePath in $candidatePaths) {
    if (Test-Path -LiteralPath $candidatePath) {
      Write-Host "[msi] Reutilizando Bootstrapper Application Burn ya publicada: $candidatePath"
      return $candidatePath
    }
  }

  $dotnetExe = Resolve-DotNetExecutable
  $bootstrapperProject = Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\EvaluaPro.BurnBootstrapperApp.csproj'
  $bootstrapperOut = Join-Path $RootPath 'dist\installer\_internal\burn-bootstrapper-app'
  return (Publish-BurnBootstrapperApp -DotNetExecutable $dotnetExe -ProjectPath $bootstrapperProject -OutputDirectory $bootstrapperOut -ConfigurationName $ConfigurationName)
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
    [object]$FlavorDefinition,
    [string]$EffectiveBundleName = ''
  )

  $sourceCatalog = Get-Content -Path $SourceCatalogPath -Raw -Encoding utf8 | ConvertFrom-Json
  $flavorId = [string]$FlavorDefinition.flavorId

  $effectiveFlavor = $FlavorDefinition.PSObject.Copy()
  if (-not [string]::IsNullOrWhiteSpace($EffectiveBundleName)) {
    $effectiveFlavor.bundleName = $EffectiveBundleName
    $effectiveFlavor.installerHubExeName = $EffectiveBundleName
  }

  $scoped = [ordered]@{
    version = if ($null -ne $sourceCatalog.version) { [int]$sourceCatalog.version } else { 1 }
    defaultFlavorId = $flavorId
    flavors = @($effectiveFlavor)
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

  $iconProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $iconScript, '-FlavorId', $flavorId, '-OutputPath', $iconPath) -Wait -NoNewWindow -PassThru
  $iconExit = [int]$iconProc.ExitCode
  if ($iconExit -ne 0) {
    throw "No se pudo generar icono por flavor para '$flavorId'."
  }

  Assert-BundleIconCompatible -IconPath $iconPath
  return $iconPath
}

function Invoke-InstallerHashesGeneration {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [string]$RequestedVersion = ''
  )

  $hashScript = Join-Path $RootPath 'scripts\generate-installer-hashes.ps1'
  if (-not (Test-Path -LiteralPath $hashScript)) {
    throw "No existe script de hashes del installer: $hashScript"
  }

  $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hashScript)
  if (-not [string]::IsNullOrWhiteSpace($RequestedVersion)) {
    $args += @('-Version', $RequestedVersion)
  }

  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Wait -NoNewWindow -PassThru
  $exitCode = if ($null -ne $proc -and $null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 1 }
  if ($exitCode -ne 0) {
    throw "No se pudieron generar hashes del installer (exit=$exitCode)."
  }
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

$wixVersionStdOut = Join-Path $env:TEMP ("evaluapro-wix-version-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
$wixVersionStdErr = Join-Path $env:TEMP ("evaluapro-wix-version-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
$wixVersionRaw = ''
try {
  $versionProc = Start-Process -FilePath $wixExe -ArgumentList @('--version') -Wait -NoNewWindow -PassThru -RedirectStandardOutput $wixVersionStdOut -RedirectStandardError $wixVersionStdErr
  if ([int]$versionProc.ExitCode -ne 0) {
    throw "No se pudo ejecutar WiX --version (exit=$($versionProc.ExitCode))."
  }
  $wixVersionOutput = ''
  if (Test-Path -LiteralPath $wixVersionStdOut) {
    $wixVersionOutput = Get-Content -LiteralPath $wixVersionStdOut -Raw -ErrorAction SilentlyContinue
  }
  if ([string]::IsNullOrWhiteSpace([string]$wixVersionOutput) -and (Test-Path -LiteralPath $wixVersionStdErr)) {
    $wixVersionOutput = Get-Content -LiteralPath $wixVersionStdErr -Raw -ErrorAction SilentlyContinue
  }
  $wixVersionRaw = @([string]$wixVersionOutput -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
} finally {
  if (Test-Path -LiteralPath $wixVersionStdOut) { Remove-Item -LiteralPath $wixVersionStdOut -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $wixVersionStdErr) { Remove-Item -LiteralPath $wixVersionStdErr -Force -ErrorAction SilentlyContinue }
}
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
$effectiveVersionTag = Resolve-InstallerVersionTag -RootPath $root -RequestedVersion $Version
$effectiveBundleNamesByFlavor = @{}

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
$buildRoot = $null
try {
  $buildRoot = New-InstallerBuildStagingRoot -RootPath $root

if ($buildBundle) {
  Write-Host "[msi] Resolviendo extension BAL de WiX..."
  $balExtDll = Resolve-BalExtensionDll -WixExecutable $wixExe -WixVersion $wixVersion -RootPath $buildRoot
  Write-Host "[msi] Extension BAL resuelta: $balExtDll"
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Publicar Bootstrapper Application Burn" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
  Write-Host "[msi][step $idx/$totalSteps] Publicar Bootstrapper Application Burn"
  $bootstrapperAppExe = Resolve-BurnBootstrapperAppExe -RootPath $root -ConfigurationName $Configuration
  Write-Host "[msi] Bootstrapper Application Burn resuelta: $bootstrapperAppExe"
  $idx += 1
}

  foreach ($flavorDef in $selectedFlavors) {
    $flavorId = [string]$flavorDef.flavorId
    $productName = [string]$flavorDef.productName
    $installFolderName = if ($flavorDef.PSObject.Properties.Name -contains 'installFolderName') { [string]$flavorDef.installFolderName } else { $productName }
    $msiName = [string]$flavorDef.msiName
    $bundleNameLegacy = [string]$flavorDef.bundleName
    $bundleName = Get-VersionedBundleName -BaseName $bundleNameLegacy -VersionTag $effectiveVersionTag
    $effectiveBundleNamesByFlavor[$flavorId] = $bundleName
    $upgradeCode = [string]$flavorDef.upgradeCode
    $bundleUpgradeCode = [string]$flavorDef.bundleUpgradeCode
    $publicFlavorOut = Join-Path $out $flavorId
    $internalFlavorOut = Join-Path $internalOut $flavorId
    New-Item -ItemType Directory -Path $publicFlavorOut -Force | Out-Null
    New-Item -ItemType Directory -Path $internalFlavorOut -Force | Out-Null

    Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar MSI $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
    Write-Host "[msi][step $idx/$totalSteps] Compilar MSI $flavorId"
    $productArgs = @(
      "build", $product
    ) + $fragmentFiles + @(
      "-arch", "x64",
      "-d", "SourceRoot=$buildRoot",
      "-d", "FlavorId=$flavorId",
      "-d", ("ProductName=`"{0}`"" -f $productName),
      "-d", ("InstallFolderName=`"{0}`"" -f $installFolderName),
      "-d", "UpgradeCode=$upgradeCode",
      "-d", "BundleName=$bundleName",
      "-o", (Join-Path $internalFlavorOut $msiName)
    )
    if ($Version) { $productArgs += @("-d", "Version=$Version") }
    $productExit = Invoke-WixBuildProcess -WixExecutable $wixExe -Arguments $productArgs
    if ($productExit -ne 0) { throw "Falló build de Product.wxs para $flavorId (exit=$productExit)" }
    $productOut = Join-Path $internalFlavorOut $msiName
    if (-not (Test-Path -LiteralPath $productOut)) {
      throw "Build de Product.wxs para $flavorId no genero MSI esperado: $productOut"
    }
    $idx += 1

    if ($buildBundle) {
      $scopedFlavorCatalogPath = New-ScopedFlavorCatalog -SourceCatalogPath $flavorCatalogPath -OutputDirectory $internalFlavorOut -FlavorDefinition $flavorDef -EffectiveBundleName $bundleName
      $flavorBundleIconPath = New-FlavorBundleIcon -RootPath $buildRoot -OutputDirectory $internalFlavorOut -FlavorDefinition $flavorDef
      Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar bundle $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
      Write-Host "[msi][step $idx/$totalSteps] Compilar bundle $flavorId"
      $bundleArgs = @(
        "build", $bundle,
        "-arch", "x64",
        "-ext", $balExtDll,
        "-bindpath", (Split-Path -Parent $bootstrapperAppExe),
        "-bindpath", (Join-Path $buildRoot 'scripts\installer-burn'),
        "-bindpath", (Join-Path $buildRoot 'config'),
        "-bindpath", (Join-Path $buildRoot 'scripts\comercial'),
        "-bindpath", (Join-Path $buildRoot 'scripts\installer-burn\modules'),
        "-d", "SourceRoot=$buildRoot",
        "-d", "FlavorId=$flavorId",
        "-d", ("ProductName=`"{0}`"" -f $productName),
        "-d", ("InstallFolderName=`"{0}`"" -f $installFolderName),
        "-d", "UpgradeCode=$upgradeCode",
        "-d", "BundleUpgradeCode=$bundleUpgradeCode",
        "-d", "BundleName=$bundleName",
        "-d", "MsiName=$msiName",
        "-d", "MsiSourcePath=$([string](Join-Path $internalFlavorOut $msiName))",
        "-d", "FlavorCatalogPath=$scopedFlavorCatalogPath",
        "-d", "BundleIconPath=$flavorBundleIconPath",
        "-o", (Join-Path $publicFlavorOut $bundleName)
      )
      if ($Version) { $bundleArgs += @("-d", "Version=$Version") }
      $bundleExit = Invoke-WixBuildProcess -WixExecutable $wixExe -Arguments $bundleArgs
      if ($bundleExit -ne 0) { throw "Falló build de Bundle.wxs para $flavorId (exit=$bundleExit)" }
      $bundleOut = Join-Path $publicFlavorOut $bundleName
      if (-not (Test-Path -LiteralPath $bundleOut)) {
        throw "Build de Bundle.wxs para $flavorId no genero bundle esperado: $bundleOut"
      }
      $bundleWixPdb = Join-Path $publicFlavorOut ([System.IO.Path]::GetFileNameWithoutExtension($bundleName) + '.wixpdb')
      if (Test-Path $bundleWixPdb) {
        Move-Item -LiteralPath $bundleWixPdb -Destination (Join-Path $internalFlavorOut (Split-Path -Leaf $bundleWixPdb)) -Force
      }
      $idx += 1
    }
  }

  if (-not $buildBundle) {
    Write-Host "[msi] Bundle EXE omitido por defecto (migración Burn WiX v6 en progreso). Usa -IncludeBundle o EVALUAPRO_BUILD_BUNDLE=1 para intentarlo."
  }

  if ($buildBundle) {
    Write-InstallerLocalPathsManifest -OutputDirectory $out -PublicOutputDirectory $out -InternalOutputDirectory $internalOut -FlavorDefinitions $selectedFlavors -BundleNameByFlavor $effectiveBundleNamesByFlavor
    Write-InstallerLocalPathsManifest -OutputDirectory $internalOut -PublicOutputDirectory $out -InternalOutputDirectory $internalOut -FlavorDefinitions $selectedFlavors -BundleNameByFlavor $effectiveBundleNamesByFlavor
  }

  Remove-OptionalInstallerArtifacts -OutputDirectory $out
  Invoke-InstallerHashesGeneration -RootPath $root -RequestedVersion $Version

  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
  Write-Host "[msi] Artefactos generados en $out para flavors: $($selectedFlavors.flavorId -join ', ')"
} finally {
  Remove-InstallerBuildStagingRoot -StagingRoot $buildRoot
}
