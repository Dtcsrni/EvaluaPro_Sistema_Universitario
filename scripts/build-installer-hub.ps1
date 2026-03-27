param(
  [string]$OutputDir = '',
  [string]$Flavor = 'all',
  [switch]$UnifiedHub,
  [switch]$IncludeFlavorInstallers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $OutputDir) {
  $OutputDir = Join-Path $root 'dist\installer'
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$catalogPath = Join-Path $root 'config\installer-flavors.json'
if (-not (Test-Path $catalogPath)) {
  throw "No existe catalogo de flavors: $catalogPath"
}
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json
$flavors = @($catalog.flavors)
$requested = [string]$Flavor
if (-not [string]::IsNullOrWhiteSpace($requested) -and $requested -ne 'all') {
  $requestedIds = @($requested.Split(',') | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  $flavors = @($flavors | Where-Object { $requestedIds -contains [string]$_.flavorId })
}
if ($flavors.Count -eq 0) {
  throw "No se resolvieron flavors para '$Flavor'."
}

$sourceScript = Join-Path $root 'scripts\installer-hub\InstallerHub.ps1'
if (-not (Test-Path $sourceScript)) {
  throw "No existe script fuente: $sourceScript"
}

$moduleFiles = Get-ChildItem -Path (Join-Path $root 'scripts\installer-hub\modules') -Filter '*.psm1' -File
$prereqManifest = Join-Path $root 'config\installer-prereqs.manifest.json'
$flavorCatalogFile = Join-Path $root 'config\installer-flavors.json'
if (-not (Test-Path $prereqManifest)) {
  throw "No existe manifiesto prerequisitos: $prereqManifest"
}

$iexpress = Get-Command iexpress.exe -ErrorAction SilentlyContinue
if (-not $iexpress) {
  throw 'No se encontro iexpress.exe en el sistema.'
}

$builtArtifacts = @()

if ($UnifiedHub) {
  $payloadRoot = Join-Path $OutputDir 'installer-hub-payload-unified'
  if (Test-Path $payloadRoot) {
    Remove-Item -LiteralPath $payloadRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

  Copy-Item -Path $sourceScript -Destination (Join-Path $payloadRoot 'installer-hub.ps1') -Force
  foreach ($module in $moduleFiles) {
    Copy-Item -Path $module.FullName -Destination (Join-Path $payloadRoot $module.Name) -Force
  }
  Copy-Item -Path $prereqManifest -Destination (Join-Path $payloadRoot 'installer-prereqs.manifest.json') -Force
  Copy-Item -Path $flavorCatalogFile -Destination (Join-Path $payloadRoot 'installer-flavors.json') -Force

  $defaultsPath = Join-Path $root 'config\installer-hub.defaults.json'
  if (Test-Path -LiteralPath $defaultsPath) {
    Copy-Item -Path $defaultsPath -Destination (Join-Path $payloadRoot 'installer-hub.defaults.json') -Force
  }

  if ($IncludeFlavorInstallers) {
    foreach ($flavorDef in $flavors) {
      $msiName = [string]$flavorDef.msiName
      $msiPath = Join-Path $OutputDir $msiName
      $shaPath = Join-Path $OutputDir ($msiName + '.sha256')
      if (-not (Test-Path -LiteralPath $msiPath)) {
        throw "No existe MSI para payload unificado: $msiPath"
      }
      if (-not (Test-Path -LiteralPath $shaPath)) {
        throw "No existe SHA256 para payload unificado: $shaPath"
      }
      Copy-Item -Path $msiPath -Destination (Join-Path $payloadRoot $msiName) -Force
      Copy-Item -Path $shaPath -Destination (Join-Path $payloadRoot ($msiName + '.sha256')) -Force
    }
  }

  $payloadFiles = Get-ChildItem -Path $payloadRoot -File | Sort-Object Name
  if ($payloadFiles.Count -eq 0) {
    throw "No hay archivos para empaquetar en Installer Hub unificado."
  }

  $strings = @()
  $sourceEntries = @()
  $idx = 0
  foreach ($file in $payloadFiles) {
    $key = "FILE$idx"
    $strings += "$key=$($file.Name)"
    $sourceEntries += "%$key%="
    $idx += 1
  }

  $targetName = 'EvaluaPro-InstallerHub.exe'
  $targetPath = Join-Path $OutputDir $targetName
  $sedPath = Join-Path $OutputDir 'installer-hub-unified.sed'

  $sedContent = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$targetPath
FriendlyName=EvaluaPro Installer Hub
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File installer-hub.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$payloadRoot\
[SourceFiles0]
$($sourceEntries -join "`r`n")
[Strings]
$($strings -join "`r`n")
"@

  $sedContent | Set-Content -Path $sedPath -Encoding ascii

  Write-Host "[installer-hub] Compilando EXE unificado con IExpress..."
  $proc = Start-Process -FilePath $iexpress.Source -ArgumentList @('/N', '/Q', $sedPath) -PassThru -Wait
  if ([int]$proc.ExitCode -ne 0) {
    throw "IExpress fallo con codigo $($proc.ExitCode) para hub unificado"
  }
  if (-not (Test-Path $targetPath)) {
    throw "No se genero artefacto esperado: $targetPath"
  }

  $builtArtifacts += [pscustomobject]@{
    flavorId = 'unified'
    displayName = 'Installer Hub Unificado'
    executableName = $targetName
    executablePath = $targetPath
  }

  Write-Host "[installer-hub] Artefacto unificado generado: $targetPath"
} else {
  foreach ($flavorDef in $flavors) {
    $flavorId = [string]$flavorDef.flavorId
    $targetName = [string]$flavorDef.installerHubExeName
    $payloadRoot = Join-Path $OutputDir ("installer-hub-payload-" + $flavorId)
    if (Test-Path $payloadRoot) {
      Remove-Item -LiteralPath $payloadRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

    Copy-Item -Path $sourceScript -Destination (Join-Path $payloadRoot 'installer-hub.ps1') -Force
    foreach ($module in $moduleFiles) {
      Copy-Item -Path $module.FullName -Destination (Join-Path $payloadRoot $module.Name) -Force
    }
    Copy-Item -Path $prereqManifest -Destination (Join-Path $payloadRoot 'installer-prereqs.manifest.json') -Force
    Copy-Item -Path $flavorCatalogFile -Destination (Join-Path $payloadRoot 'installer-flavors.json') -Force
    (@{ flavorId = $flavorId } | ConvertTo-Json -Depth 4) | Set-Content -Path (Join-Path $payloadRoot 'installer-hub.defaults.json') -Encoding utf8

    $payloadFiles = Get-ChildItem -Path $payloadRoot -File | Sort-Object Name
    if ($payloadFiles.Count -eq 0) {
      throw "No hay archivos para empaquetar en Installer Hub ($flavorId)."
    }

    $strings = @()
    $sourceEntries = @()
    $idx = 0
    foreach ($file in $payloadFiles) {
      $key = "FILE$idx"
      $strings += "$key=$($file.Name)"
      $sourceEntries += "%$key%="
      $idx += 1
    }

    $targetPath = Join-Path $OutputDir $targetName
    $sedPath = Join-Path $OutputDir ("installer-hub-$flavorId.sed")

    $sedContent = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$targetPath
FriendlyName=EvaluaPro Installer Hub $flavorId
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File installer-hub.ps1
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$payloadRoot\
[SourceFiles0]
$($sourceEntries -join "`r`n")
[Strings]
$($strings -join "`r`n")
"@

    $sedContent | Set-Content -Path $sedPath -Encoding ascii

    Write-Host "[installer-hub] Compilando EXE con IExpress para $flavorId..."
    $proc = Start-Process -FilePath $iexpress.Source -ArgumentList @('/N', '/Q', $sedPath) -PassThru -Wait
    if ([int]$proc.ExitCode -ne 0) {
      throw "IExpress fallo con codigo $($proc.ExitCode) para $flavorId"
    }

    if (-not (Test-Path $targetPath)) {
      throw "No se genero artefacto esperado: $targetPath"
    }

    $builtArtifacts += [pscustomobject]@{
      flavorId = $flavorId
      displayName = [string]$flavorDef.displayName
      executableName = $targetName
      executablePath = $targetPath
    }

    Write-Host "[installer-hub] Artefacto generado: $targetPath"
  }
}

$defaultsPath = Join-Path $root 'config\installer-hub.defaults.json'
$recommendedFlavorId = ''
if (Test-Path -LiteralPath $defaultsPath) {
  try {
    $defaults = Get-Content -Path $defaultsPath -Raw -Encoding utf8 | ConvertFrom-Json
    $recommendedFlavorId = [string]$defaults.flavorId
  } catch {
    $recommendedFlavorId = ''
  }
}
if (-not $recommendedFlavorId) {
  $recommendedFlavorId = [string]$catalog.defaultFlavorId
}

$recommendedArtifact = $builtArtifacts | Where-Object { [string]$_.flavorId -eq $recommendedFlavorId } | Select-Object -First 1
if (-not $recommendedArtifact) {
  $recommendedArtifact = $builtArtifacts | Select-Object -First 1
}
$localManifestPath = Join-Path $OutputDir 'installer-local-paths.json'
$localManifest = [ordered]@{
  generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
  outputDir = $OutputDir
  recommendedFlavorId = $recommendedFlavorId
  recommendedHubExecutableName = if ($recommendedArtifact) { [string]$recommendedArtifact.executableName } else { '' }
  recommendedHubExecutablePath = if ($recommendedArtifact) { [string]$recommendedArtifact.executablePath } else { '' }
  flavors = @($builtArtifacts | ForEach-Object {
    [ordered]@{
      flavorId = [string]$_.flavorId
      displayName = [string]$_.displayName
      executableName = [string]$_.executableName
      executablePath = [string]$_.executablePath
    }
  })
}
($localManifest | ConvertTo-Json -Depth 6) | Set-Content -Path $localManifestPath -Encoding utf8

if ($recommendedArtifact) {
  Write-Host "[installer-hub] Ejecutable recomendado para este equipo: $($recommendedArtifact.executablePath)"
}
Write-Host "[installer-hub] Manifiesto local generado: $localManifestPath"
