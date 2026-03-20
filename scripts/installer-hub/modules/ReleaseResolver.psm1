Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking

function ConvertTo-SemverKey {
  param([string]$Version)

  $clean = [string]$Version
  $clean = $clean.Trim().TrimStart('v', 'V')
  $match = [Regex]::Match($clean, '^(?<maj>\d+)\.(?<min>\d+)\.(?<pat>\d+)(?<rest>.*)$')
  if (-not $match.Success) {
    return [pscustomobject]@{ valid = $false; major = 0; minor = 0; patch = 0; prerelease = $true }
  }

  $rest = [string]$match.Groups['rest'].Value
  return [pscustomobject]@{
    valid = $true
    major = [int]$match.Groups['maj'].Value
    minor = [int]$match.Groups['min'].Value
    patch = [int]$match.Groups['pat'].Value
    prerelease = ($rest -match '-')
  }
}

function Compare-Semver {
  param([string]$Left, [string]$Right)

  $a = ConvertTo-SemverKey -Version $Left
  $b = ConvertTo-SemverKey -Version $Right
  if (-not $a.valid -and -not $b.valid) { return 0 }
  if (-not $a.valid) { return -1 }
  if (-not $b.valid) { return 1 }

  if ($a.major -ne $b.major) { return [Math]::Sign($a.major - $b.major) }
  if ($a.minor -ne $b.minor) { return [Math]::Sign($a.minor - $b.minor) }
  if ($a.patch -ne $b.patch) { return [Math]::Sign($a.patch - $b.patch) }

  if ($a.prerelease -eq $b.prerelease) { return 0 }
  if (-not $a.prerelease -and $b.prerelease) { return 1 }
  return -1
}

function Get-LatestStableReleaseAssets {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Owner,
    [Parameter(Mandatory = $true)]
    [string]$Repo,
    [Parameter(Mandatory = $true)]
    [string]$FlavorId,
    [scriptblock]$OnLog
  )

  if ($OnLog) { & $OnLog 'info' "Consultando releases de GitHub: $Owner/$Repo" }

  $localMsiPath = [string]$env:EVALUAPRO_INSTALLER_RELEASE_MSI_PATH
  if (-not [string]::IsNullOrWhiteSpace($localMsiPath) -and (Test-Path -LiteralPath $localMsiPath)) {
    $localShaPath = [string]$env:EVALUAPRO_INSTALLER_RELEASE_SHA_PATH
    $localSha256 = [string]$env:EVALUAPRO_INSTALLER_RELEASE_SHA256
    $localTag = if ([string]::IsNullOrWhiteSpace([string]$env:EVALUAPRO_INSTALLER_RELEASE_TAG)) { '0.0.0-test' } else { [string]$env:EVALUAPRO_INSTALLER_RELEASE_TAG }
    $bundlePath = [string]$env:EVALUAPRO_INSTALLER_RELEASE_BUNDLE_PATH
    if ($OnLog) { & $OnLog 'ok' "Release local de prueba seleccionada: $localMsiPath" }
    return [pscustomobject]@{
      tag = $localTag
      publishedAt = (Get-Date).ToString('o')
      msiUrl = "file:///$($localMsiPath -replace '\\','/')"
      shaUrl = if ($localShaPath) { "file:///$($localShaPath -replace '\\','/')" } else { '' }
      bundleUrl = if ($bundlePath) { "file:///$($bundlePath -replace '\\','/')" } else { '' }
      releaseUrl = 'local-test-release'
      manifestUrl = 'local-test-manifest'
      manifest = [pscustomobject]@{}
      flavor = [pscustomobject]@{
        flavorId = $FlavorId
        msiUrl = $localMsiPath
        msiSha256Url = $localShaPath
        bundleUrl = $bundlePath
      }
      localMsiPath = $localMsiPath
      localShaPath = $localShaPath
      localSha256 = $localSha256
    }
  }

  $url = "https://api.github.com/repos/$Owner/$Repo/releases"
  $headers = @{ 'User-Agent' = 'EvaluaPro-InstallerHub'; 'Accept' = 'application/vnd.github+json' }
  $response = Invoke-InstallerHubWebRequest -Url $url -Method GET -Headers $headers -TimeoutSec 25 -RetryCount 2
  $releases = $response.Content | ConvertFrom-Json

  $candidates = @()
  foreach ($release in $releases) {
    if ($release.draft -or $release.prerelease) { continue }

    $tag = [string]$release.tag_name
    $sem = ConvertTo-SemverKey -Version $tag
    if (-not $sem.valid) { continue }

    $assets = @($release.assets)
    $manifestAsset = $assets | Where-Object { [string]$_.name -eq 'EvaluaPro-release-manifest.json' } | Select-Object -First 1
    if (-not $manifestAsset) { continue }

    try {
      $manifestResponse = Invoke-InstallerHubWebRequest -Url ([string]$manifestAsset.browser_download_url) -Method GET -Headers $headers -TimeoutSec 25 -RetryCount 2
      $manifest = $manifestResponse.Content | ConvertFrom-Json
      $flavor = @($manifest.flavors | Where-Object { [string]$_.flavorId -eq $FlavorId } | Select-Object -First 1)
      if ($flavor.Count -eq 0) { continue }
      $flavorItem = $flavor[0]

      $candidates += [pscustomobject]@{
        tag = $tag.TrimStart('v', 'V')
        publishedAt = [string]$release.published_at
        msiUrl = [string]$flavorItem.msiUrl
        shaUrl = [string]$flavorItem.msiSha256Url
        bundleUrl = if ($null -ne $flavorItem.bundleUrl) { [string]$flavorItem.bundleUrl } else { '' }
        releaseUrl = [string]$release.html_url
        manifestUrl = [string]$manifestAsset.browser_download_url
        manifest = $manifest
        flavor = $flavorItem
      }
    } catch {
      continue
    }
  }

  if ($candidates.Count -eq 0) {
    throw "No se encontro release estable con flavor $FlavorId y manifest multi-flavor valido."
  }

  $latest = $candidates[0]
  foreach ($candidate in $candidates) {
    if ((Compare-Semver -Left $candidate.tag -Right $latest.tag) -gt 0) {
      $latest = $candidate
    }
  }

  if ($OnLog) { & $OnLog 'ok' "Release estable seleccionada: v$($latest.tag)" }
  return $latest
}

function Download-VerifiedMsiPackage {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Release,
    [Parameter(Mandatory = $true)]
    [string]$DestinationDir,
    [string]$MsiFileName = '',
    [scriptblock]$OnLog
  )

  if (-not $MsiFileName) {
    try {
      $MsiFileName = [System.IO.Path]::GetFileName(([uri]$Release.msiUrl).AbsolutePath)
    } catch {
      $MsiFileName = 'EvaluaPro-installer.msi'
    }
  }

  if (-not (Test-Path $DestinationDir)) {
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
  }

  if ($Release.PSObject.Properties.Match('localMsiPath').Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$Release.localMsiPath)) {
    $sourceMsi = [string]$Release.localMsiPath
    if (-not (Test-Path -LiteralPath $sourceMsi)) {
      throw "No existe MSI local de prueba: $sourceMsi"
    }

    $expected = ''
    if ($Release.PSObject.Properties.Match('localSha256').Count -gt 0) {
      $expected = [string]$Release.localSha256
    }
    if ([string]::IsNullOrWhiteSpace($expected) -and $Release.PSObject.Properties.Match('localShaPath').Count -gt 0) {
      $localShaPath = [string]$Release.localShaPath
      if ($localShaPath -and (Test-Path -LiteralPath $localShaPath)) {
        $expected = Resolve-InstallerHubSha256FromText -Text (Get-Content -Path $localShaPath -Raw -Encoding utf8) -Pattern ([System.IO.Path]::GetFileName($sourceMsi))
      }
    }
    if ([string]::IsNullOrWhiteSpace($expected)) {
      $expected = Get-InstallerHubFileSha256 -Path $sourceMsi
    }

    $msiPath = Join-Path $DestinationDir $MsiFileName
    Copy-Item -LiteralPath $sourceMsi -Destination $msiPath -Force
    $actual = Get-InstallerHubFileSha256 -Path $msiPath
    if ($actual -ne $expected) {
      Remove-Item -LiteralPath $msiPath -Force -ErrorAction SilentlyContinue
      throw 'SHA256 del MSI local de prueba no coincide.'
    }
    if ($OnLog) { & $OnLog 'ok' 'MSI local de prueba copiado y verificado con SHA256.' }
    return [pscustomobject]@{
      msiPath = $msiPath
      expectedSha256 = $expected
      actualSha256 = $actual
      release = $Release
    }
  }

  $msiPath = Join-Path $DestinationDir $MsiFileName
  $shaPath = Join-Path $DestinationDir ($MsiFileName + '.sha256')

  if ($OnLog) { & $OnLog 'info' 'Descargando MSI de release estable...' }
  Invoke-InstallerHubDownloadFile -Url $Release.msiUrl -Destination $msiPath -RetryCount 2

  if ($OnLog) { & $OnLog 'info' 'Descargando hash SHA256 de MSI...' }
  Invoke-InstallerHubDownloadFile -Url $Release.shaUrl -Destination $shaPath -RetryCount 2

  $expectedText = Get-Content -Path $shaPath -Raw -Encoding utf8
  $expected = Resolve-InstallerHubSha256FromText -Text $expectedText -Pattern $MsiFileName
  if (-not $expected) {
    throw "No se pudo resolver SHA256 esperado para $MsiFileName."
  }

  $actual = Get-InstallerHubFileSha256 -Path $msiPath
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $msiPath -Force -ErrorAction SilentlyContinue
    throw 'SHA256 del MSI no coincide con release estable.'
  }

  if ($OnLog) { & $OnLog 'ok' 'MSI descargado y verificado con SHA256.' }

  return [pscustomobject]@{
    msiPath = $msiPath
    expectedSha256 = $expected
    actualSha256 = $actual
    release = $Release
  }
}

Export-ModuleMember -Function @(
  'Get-LatestStableReleaseAssets',
  'Download-VerifiedMsiPackage'
)
