Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'PrereqDetector.psm1') -DisableNameChecking

function Resolve-PrereqExpectedSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite,
    [scriptblock]$OnLog
  )

  $inline = [string]$Prerequisite.sha256
  if ($inline -match '^[a-fA-F0-9]{64}$') {
    return $inline.ToLowerInvariant()
  }

  $shaUrl = [string]$Prerequisite.sha256Url
  if (-not $shaUrl) {
    throw "No se encontro sha256 ni sha256Url para prerequisito $($Prerequisite.name)."
  }

  if ($OnLog) { & $OnLog 'info' "Resolviendo SHA256 remoto para $($Prerequisite.name)..." }

  $response = Invoke-InstallerHubWebRequest -Url $shaUrl -Method GET -TimeoutSec 30 -RetryCount 2
  $pattern = [string]$Prerequisite.sha256Pattern
  $expected = Resolve-InstallerHubSha256FromText -Text $response.Content -Pattern $pattern
  if (-not $expected) {
    throw "No se pudo resolver SHA256 desde sha256Url para $($Prerequisite.name)."
  }

  return $expected
}

function Install-PrerequisitePackage {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite,
    [Parameter(Mandatory = $true)]
    [string]$DownloadRoot,
    [scriptblock]$OnLog
  )

  if (-not (Test-Path $DownloadRoot)) {
    New-Item -ItemType Directory -Path $DownloadRoot -Force | Out-Null
  }

  $name = [string]$Prerequisite.name
  $downloadUrl = [string]$Prerequisite.downloadUrl
  if (-not $downloadUrl) {
    throw "downloadUrl vacia para prerequisito $name"
  }

  $fileName = [System.IO.Path]::GetFileName(([uri]$downloadUrl).AbsolutePath)
  if (-not $fileName) {
    $fileName = ("{0}.bin" -f ($name -replace '[^a-zA-Z0-9\-_.]', '-'))
  }

  $localPath = Join-Path $DownloadRoot $fileName
  $expected = Resolve-PrereqExpectedSha256 -Prerequisite $Prerequisite -OnLog $OnLog

  if ($OnLog) { & $OnLog 'info' "Descargando prerequisito: $name" }
  Invoke-InstallerHubDownloadFile -Url $downloadUrl -Destination $localPath -RetryCount 2

  $actual = Get-InstallerHubFileSha256 -Path $localPath
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $localPath -Force -ErrorAction SilentlyContinue
    throw "SHA256 invalido para prerequisito $name"
  }

  $args = [string]$Prerequisite.silentArgs
  if (-not $args) {
    throw "silentArgs vacio para prerequisito $name"
  }

  if ($OnLog) { & $OnLog 'info' "Ejecutando instalacion silenciosa de $name..." }
  $exitCode = Invoke-InstallerHubProcess -FilePath $localPath -Arguments $args -TimeoutSec 3600
  if ($exitCode -ne 0) {
    throw "Instalacion de $name fallo con codigo $exitCode"
  }

  if ($OnLog) { & $OnLog 'ok' "Prerequisito instalado: $name" }

  return [pscustomobject]@{
    name = $name
    filePath = $localPath
    sha256 = $actual
    exitCode = $exitCode
  }
}

function Invoke-PrerequisiteInstallationFlow {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Manifest,
    [Parameter(Mandatory = $true)]
    [string]$DownloadRoot,
    [scriptblock]$OnLog
  )

  $results = @()
  $statuses = @()

  foreach ($item in $Manifest.prerequisites) {
    $status = Test-PrerequisiteStatus -Prerequisite $item
    $statuses += $status
  }

  $missing = @($statuses | Where-Object { -not $_.installed })
  if ($missing.Count -eq 0) {
    if ($OnLog) { & $OnLog 'ok' 'No hay prerequisitos faltantes.' }
    return [pscustomobject]@{
      ok = $true
      statuses = $statuses
      installed = @()
      missing = @()
    }
  }

  foreach ($item in $Manifest.prerequisites) {
    $state = @($statuses | Where-Object { $_.name -eq $item.name } | Select-Object -First 1)[0]
    if ($state.installed) { continue }

    $result = Install-PrerequisitePackage -Prerequisite $item -DownloadRoot $DownloadRoot -OnLog $OnLog
    $results += $result

    $after = Test-PrerequisiteStatus -Prerequisite $item
    if (-not $after.installed) {
      throw "Prerequisito $($item.name) sigue sin cumplir tras instalacion."
    }
  }

  $finalStatuses = @()
  foreach ($item in $Manifest.prerequisites) {
    $finalStatuses += (Test-PrerequisiteStatus -Prerequisite $item)
  }

  return [pscustomobject]@{
    ok = $true
    statuses = $finalStatuses
    installed = $results
    missing = @($finalStatuses | Where-Object { -not $_.installed })
  }
}

Export-ModuleMember -Function @(
  'Invoke-PrerequisiteInstallationFlow'
)
