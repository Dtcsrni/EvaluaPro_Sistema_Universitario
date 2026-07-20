# sign-installer-artifacts.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$InstallerDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $InstallerDir) {
  $InstallerDir = Join-Path $root 'dist\\installer'
}
$internalInstallerDir = Join-Path $InstallerDir '_internal'

if (-not (Test-Path $InstallerDir)) {
  throw "No existe carpeta de instaladores: $InstallerDir"
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$catalogPath = Join-Path $root 'config\installer-flavors.json'
$catalog = Get-Content -Path $catalogPath -Raw -Encoding utf8 | ConvertFrom-Json

function Resolve-VersionTag {
  param([string]$RootPath)

  $pkgPath = Join-Path $RootPath 'package.json'
  if (-not (Test-Path -LiteralPath $pkgPath)) {
    return '0.0.0'
  }
  $pkg = Get-Content -Path $pkgPath -Raw -Encoding utf8 | ConvertFrom-Json
  $resolved = [string]$pkg.version
  if ([string]::IsNullOrWhiteSpace($resolved)) { $resolved = '0.0.0' }
  return (($resolved -replace '[^0-9A-Za-z\.-]', '-').Trim())
}
function Get-VersionedArtifactName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseName,
    [Parameter(Mandatory = $true)]
    [string]$VersionTag
  )

  $ext = [System.IO.Path]::GetExtension($BaseName)
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($BaseName)
  if ([string]::IsNullOrWhiteSpace($ext)) {
    return ("{0}-v{1}" -f $BaseName, $VersionTag)
  }
  return ("{0}-v{1}{2}" -f $stem, $VersionTag, $ext)
}

$certBase64 = [string]$env:EVALUAPRO_SIGN_CERT_BASE64
$certPassword = [string]$env:EVALUAPRO_SIGN_CERT_PASSWORD
$certThumbprint = [string]$env:EVALUAPRO_SIGN_CERT_THUMBPRINT
$timestampUrl = [string]$env:EVALUAPRO_SIGN_TIMESTAMP_URL
$localOnlySigning = $env:EVALUAPRO_SIGN_LOCAL_ONLY -match '^(1|true|yes|si)$'
if (-not $timestampUrl -and -not $localOnlySigning) {
  $timestampUrl = 'http://timestamp.digicert.com'
}

$markerPath = Join-Path $InstallerDir 'SIGNING-NOT-PRODUCTION.txt'

if (([string]::IsNullOrWhiteSpace($certBase64) -or [string]::IsNullOrWhiteSpace($certPassword)) -and [string]::IsNullOrWhiteSpace($certThumbprint)) {
  $marker = @(
    'NO_PRODUCTION_SIGNATURE',
    'Installer artifacts were generated without code-signing certificate.',
    ('GeneratedAt=' + (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssZ'))
  ) -join "`r`n"

  $marker | Set-Content -Path $markerPath -Encoding ascii
  Write-Host '[signing] Certificado ausente. Se marca build como NO PRODUCTIVA.'
  exit 0
}

function Find-SignTool {
  $candidates = @(
    (Join-Path $root 'dist\signing-internal\tools\bin\10.0.22621.0\x64\signtool.exe'),
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files\\Windows Kits\\10\\bin\\x64\\signtool.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $glob = Get-ChildItem -Path 'C:\\Program Files (x86)\\Windows Kits\\10\\bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($glob) { return $glob.FullName }

  return ''
}

function ConvertFrom-PossiblyWrappedBase64 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RawValue
  )

  $normalized = [string]$RawValue
  if ($normalized -match '^[A-Z0-9_]+=') {
    $normalized = $normalized.Substring($normalized.IndexOf('=') + 1)
  }

  $normalized = ($normalized -replace '\s', '').Trim()
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    throw 'Valor base64 vacio para certificado de firma.'
  }

  try {
    return [Convert]::FromBase64String($normalized)
  } catch {
    # Intento de compatibilidad base64url.
    $urlSafe = $normalized.Replace('-', '+').Replace('_', '/')
    $pad = $urlSafe.Length % 4
    if ($pad -ne 0) {
      $urlSafe = $urlSafe.PadRight($urlSafe.Length + (4 - $pad), '=')
    }
    return [Convert]::FromBase64String($urlSafe)
  }
}
function Resolve-InstallerArtifactPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactName,
    [string]$FlavorId = '',
    [switch]$PreferInternal
  )

  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($FlavorId)) {
    if ($PreferInternal) {
      $candidates += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
      $candidates += @(Join-Path (Join-Path $InstallerDir $FlavorId) $ArtifactName)
    } else {
      $candidates += @(Join-Path (Join-Path $InstallerDir $FlavorId) $ArtifactName)
      $candidates += @(Join-Path (Join-Path $internalInstallerDir $FlavorId) $ArtifactName)
    }
  }

  if ($PreferInternal) {
    $candidates += @(Join-Path $internalInstallerDir $ArtifactName)
    $candidates += @(Join-Path $InstallerDir $ArtifactName)
  } else {
    $candidates += @(Join-Path $InstallerDir $ArtifactName)
    $candidates += @(Join-Path $internalInstallerDir $ArtifactName)
  }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return ''
}

function Find-WixTool {
  $cmd = Get-Command 'wix.exe' -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidate = Join-Path $root '.wix\wix.exe'
  if (Test-Path -LiteralPath $candidate) { return $candidate }

  return ''
}

function Invoke-SignTool {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetPath,
    [string]$PfxPath = '',
    [string]$PfxPassword = '',
    [string]$Thumbprint = '',
    [string]$TimestampUrl = ''
  )

  $timestampArgs = @()
  if (-not [string]::IsNullOrWhiteSpace($TimestampUrl)) { $timestampArgs = @('/tr', $TimestampUrl, '/td', 'SHA256') }
  if (-not [string]::IsNullOrWhiteSpace($PfxPath)) {
    & $signtool sign /fd SHA256 /f $PfxPath /p $PfxPassword @timestampArgs $TargetPath
  } elseif (-not [string]::IsNullOrWhiteSpace($Thumbprint)) {
    & $signtool sign /fd SHA256 /sha1 $Thumbprint @timestampArgs $TargetPath
  } else {
    throw 'No se configuro PFX ni thumbprint para firmar.'
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo firma de $TargetPath (exit=$LASTEXITCODE)."
  }
}

function Test-AlreadySignedValid {
  param([Parameter(Mandatory = $true)][string]$TargetPath)

  try {
    $signature = Get-AuthenticodeSignature -FilePath $TargetPath -ErrorAction Stop
    return $signature.Status -eq 'Valid'
  } catch {
    # Algunos hosts Windows PowerShell no pueden cargar el módulo de firma
    # por colisión de TypeData; signtool seguirá siendo la fuente de verdad.
    return $false
  }
}

function Test-IsBurnBundle {
  param([Parameter(Mandatory = $true)][string]$TargetPath)

  $fileName = [System.IO.Path]::GetFileName($TargetPath)
  return ($fileName -match '^EvaluaPro-InstallerHub-.+\.exe$')
}

function Invoke-BurnAwareBundleSigning {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,
    [string]$PfxPath = '',
    [string]$PfxPassword = '',
    [string]$Thumbprint = '',
    [string]$TimestampUrl = ''
  )

  if (-not $wixtool) {
    throw 'No se encontro wix.exe para firma Burn-aware del bundle.'
  }

  $workDir = Join-Path $env:TEMP ('evaluapro-burn-sign-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $workDir -Force | Out-Null

  try {
    $enginePath = Join-Path $workDir 'engine.exe'
    $signedEnginePath = Join-Path $workDir 'engine.signed.exe'
    $finalBundlePath = Join-Path $workDir ([System.IO.Path]::GetFileName($BundlePath))

    & $wixtool burn detach $BundlePath -engine $enginePath
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo detach Burn de $BundlePath (exit=$LASTEXITCODE)."
    }

    Copy-Item -LiteralPath $enginePath -Destination $signedEnginePath -Force
    Invoke-SignTool -TargetPath $signedEnginePath -PfxPath $PfxPath -PfxPassword $PfxPassword -Thumbprint $Thumbprint -TimestampUrl $TimestampUrl

    & $wixtool burn reattach $BundlePath -engine $signedEnginePath -o $finalBundlePath
    if ($LASTEXITCODE -ne 0) {
      throw "Fallo reattach Burn de $BundlePath (exit=$LASTEXITCODE)."
    }

    Invoke-SignTool -TargetPath $finalBundlePath -PfxPath $PfxPath -PfxPassword $PfxPassword -Thumbprint $Thumbprint -TimestampUrl $TimestampUrl
    Remove-Item -LiteralPath $BundlePath -Force
    Move-Item -LiteralPath $finalBundlePath -Destination $BundlePath -Force
  } finally {
    if (Test-Path -LiteralPath $workDir) {
      Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

$signtool = Find-SignTool
if (-not $signtool) {
  throw 'No se encontro signtool.exe para firmar artefactos.'
}
$wixtool = Find-WixTool

$pfxPath = ''
try {
  if (-not [string]::IsNullOrWhiteSpace($certBase64)) {
    $pfxPath = Join-Path $env:TEMP ('evaluapro-sign-' + [Guid]::NewGuid().ToString('N') + '.pfx')
    [IO.File]::WriteAllBytes($pfxPath, (ConvertFrom-PossiblyWrappedBase64 -RawValue $certBase64))
  }
  $versionTag = Resolve-VersionTag -RootPath $root

  $targets = @()
  foreach ($flavor in $catalog.flavors) {
    $flavorId = [string]$flavor.flavorId
    $versionedBundleName = Get-VersionedArtifactName -BaseName ([string]$flavor.bundleName) -VersionTag $versionTag
    $versionedHubName = Get-VersionedArtifactName -BaseName ([string]$flavor.installerHubExeName) -VersionTag $versionTag
    foreach ($artifact in @(
      @{ name = [string]$flavor.msiName; preferInternal = $true },
      @{ name = [string]$versionedBundleName; preferInternal = $false },
      @{ name = [string]$versionedHubName; preferInternal = $false }
    )) {
      $artifactName = [string]$artifact.name
      $resolved = Resolve-InstallerArtifactPath -ArtifactName $artifactName -FlavorId $flavorId -PreferInternal:([bool]$artifact.preferInternal)
      if ($resolved) { $targets += $resolved }
    }
  }
  $targets = @($targets | Select-Object -Unique | Where-Object { Test-Path $_ })

  if ($targets.Count -eq 0) {
    throw 'No hay artefactos para firmar.'
  }

  foreach ($target in $targets) {
    if (Test-AlreadySignedValid -TargetPath $target) {
      Write-Host "[signing] Ya firmado y valido; se omite $target"
      continue
    }

    Write-Host "[signing] Firmando $target"
    if (Test-IsBurnBundle -TargetPath $target) {
      Invoke-BurnAwareBundleSigning -BundlePath $target -PfxPath $pfxPath -PfxPassword $certPassword -Thumbprint $certThumbprint -TimestampUrl $timestampUrl
    } else {
      Invoke-SignTool -TargetPath $target -PfxPath $pfxPath -PfxPassword $certPassword -Thumbprint $certThumbprint -TimestampUrl $timestampUrl
    }
  }

  if (Test-Path $markerPath) {
    Remove-Item -LiteralPath $markerPath -Force
  }

  $hashScript = Join-Path $root 'scripts\generate-installer-hashes.ps1'
  $hashProcess = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $hashScript,
    '-InstallerDir',
    $InstallerDir
  ) -NoNewWindow -Wait -PassThru
  if ($hashProcess.ExitCode -ne 0) {
    throw "Fallo regeneracion de hashes/manifest post-firma (exit=$($hashProcess.ExitCode))."
  }

  Write-Host '[signing] Firma completada con timestamp.'
} finally {
  if (-not [string]::IsNullOrWhiteSpace($pfxPath) -and (Test-Path $pfxPath)) {
    Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue
  }
}
