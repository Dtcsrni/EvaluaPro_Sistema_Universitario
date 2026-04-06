Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-InstallerHubRootPath {
  param(
    [string]$RootPath = ''
  )

  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($RootPath)) {
    $candidates += $RootPath
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$env:EVALUAPRO_INSTALLER_ROOT)) {
    $candidates += [string]$env:EVALUAPRO_INSTALLER_ROOT
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$env:EVALUAPRO_INSTALLER_BUNDLE_ROOT)) {
    $candidates += [string]$env:EVALUAPRO_INSTALLER_BUNDLE_ROOT
  }

  $legacyRoot = ''
  try {
    $legacyRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
  } catch {
    $legacyRoot = ''
  }

  $candidates += @(
    $PSScriptRoot,
    (Split-Path -Parent $PSScriptRoot),
    $legacyRoot
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }

  foreach ($candidate in $candidates) {
    $resolved = ''
    try {
      $resolved = (Resolve-Path -LiteralPath $candidate).Path
    } catch {
      continue
    }

    if (Test-Path (Join-Path $resolved 'config\installer-flavors.json')) {
      return $resolved
    }
    if (Test-Path (Join-Path $resolved 'installer-flavors.json')) {
      return $resolved
    }
  }

  throw "No se pudo resolver raiz del Installer Hub desde '$PSScriptRoot'."
}

function Resolve-InstallerFlavorCatalogPath {
  param(
    [string]$RootPath = ''
  )

  $resolvedRoot = Resolve-InstallerHubRootPath -RootPath $RootPath
  $catalogCandidates = @(
    (Join-Path $resolvedRoot 'config\installer-flavors.json'),
    (Join-Path $resolvedRoot 'installer-flavors.json')
  )

  $catalogPath = $catalogCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $catalogPath) {
    throw "No existe catalogo de flavors en rutas esperadas: $($catalogCandidates -join ' | ')"
  }

  return $catalogPath
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-InstallerElevationScriptPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath
  )

  $resolvedScriptPath = $ScriptPath
  try {
    $resolvedScriptPath = (Resolve-Path -LiteralPath $ScriptPath).Path
  } catch {
    $resolvedScriptPath = $ScriptPath
  }

  $scriptDir = ''
  try {
    $scriptDir = Split-Path -Parent $resolvedScriptPath
  } catch {
    $scriptDir = ''
  }

  if ([string]::IsNullOrWhiteSpace($scriptDir) -or -not (Test-Path -LiteralPath $scriptDir)) {
    return $resolvedScriptPath
  }

  $forceStaging = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_FORCE_ELEVATION_STAGING).Trim().ToLowerInvariant()
  $isTempExtractionDir = $false
  try {
    if (-not [string]::IsNullOrWhiteSpace($env:TEMP)) {
      $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
      $scriptDirFull = [IO.Path]::GetFullPath($scriptDir).TrimEnd('\')
      $isTempExtractionDir = $scriptDirFull.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)
    }
  } catch {
    $isTempExtractionDir = $false
  }
  if (-not $forceStaging -and -not $isTempExtractionDir) {
    return $resolvedScriptPath
  }

  $stagingRoot = Join-Path $env:TEMP 'EvaluaProInstallerHub-Elevated'
  $sessionId = [Guid]::NewGuid().ToString('N')
  $stagingDir = Join-Path $stagingRoot $sessionId
  New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

  foreach ($item in (Get-ChildItem -LiteralPath $scriptDir -Force)) {
    $destination = Join-Path $stagingDir $item.Name
    if ($item.PSIsContainer) {
      Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force
    } else {
      Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
    }
  }

  $stagedScriptPath = Join-Path $stagingDir (Split-Path -Leaf $resolvedScriptPath)
  if (-not (Test-Path -LiteralPath $stagedScriptPath)) {
    throw "No se pudo preparar copia estable para elevacion UAC: $stagedScriptPath"
  }

  return $stagedScriptPath
}

function Ensure-ElevatedSession {
  param(
    [string]$ScriptPath,
    [string[]]$PassthroughArgs
  )

  if (Test-IsAdministrator) {
    return $true
  }

  $resolvedScriptPath = Resolve-InstallerElevationScriptPath -ScriptPath $ScriptPath

  $quotedArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $resolvedScriptPath))
  if ($PassthroughArgs) {
    foreach ($arg in $PassthroughArgs) {
      $quotedArgs += ('"{0}"' -f ($arg -replace '"', '\"'))
    }
  }

  try {
    $startInfo = @{
      FilePath = 'powershell.exe'
      Verb = 'RunAs'
      ArgumentList = ($quotedArgs -join ' ')
    }
    if (-not [string]::IsNullOrWhiteSpace($resolvedScriptPath)) {
      try {
        $workingDirectory = Split-Path -Parent $resolvedScriptPath
        if (-not [string]::IsNullOrWhiteSpace($workingDirectory) -and (Test-Path -LiteralPath $workingDirectory)) {
          $startInfo.WorkingDirectory = $workingDirectory
        }
      } catch {}
    }
    Start-Process @startInfo | Out-Null
  } catch {
    throw 'No se pudo solicitar elevacion UAC.'
  }

  return $false
}

function New-InstallerHubLogContext {
  param(
    [string]$RootPath = (Join-Path $env:ProgramData 'EvaluaPro\\installer-hub\\logs')
  )

  if (-not (Test-Path $RootPath)) {
    New-Item -ItemType Directory -Path $RootPath -Force | Out-Null
  }

  $sessionId = [Guid]::NewGuid().ToString('N')
  $filePath = Join-Path $RootPath ("installer-hub-{0}.log" -f $sessionId)

  return [pscustomobject]@{
    SessionId = $sessionId
    RootPath = $RootPath
    FilePath = $filePath
  }
}

function Write-InstallerHubLog {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Context,
    [Parameter(Mandatory = $true)]
    [string]$Level,
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [hashtable]$Meta
  )

  $payload = [ordered]@{
    timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    level = $Level
    message = $Message
  }
  if ($Meta) {
    $payload.meta = $Meta
  }

  $line = ($payload | ConvertTo-Json -Depth 6 -Compress)
  Add-Content -Path $Context.FilePath -Value $line -Encoding utf8
}

function Invoke-InstallerHubWebRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [ValidateSet('GET', 'HEAD')]
    [string]$Method = 'GET',
    [int]$TimeoutSec = 25,
    [int]$RetryCount = 2,
    [int]$RetryDelayMs = 800,
    [hashtable]$Headers
  )

  $attempt = 0
  $lastError = $null

  while ($attempt -le $RetryCount) {
    try {
      $attempt += 1
      return Invoke-WebRequest -Uri $Url -Method $Method -TimeoutSec $TimeoutSec -UseBasicParsing -Headers $Headers
    } catch {
      $lastError = $_
      if ($attempt -gt $RetryCount) { break }
      Start-Sleep -Milliseconds $RetryDelayMs
    }
  }

  throw ("Fallo HTTP tras reintentos: {0}" -f ($lastError.Exception.Message))
}

function Invoke-InstallerHubDownloadFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [int]$RetryCount = 2,
    [int]$RetryDelayMs = 1000
  )

  $attempt = 0
  $lastError = $null

  while ($attempt -le $RetryCount) {
    try {
      $attempt += 1
      Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 180
      return
    } catch {
      $lastError = $_
      if (Test-Path $Destination) {
        Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
      }
      if ($attempt -gt $RetryCount) { break }
      Start-Sleep -Milliseconds $RetryDelayMs
    }
  }

  throw ("No se pudo descargar archivo: {0}" -f ($lastError.Exception.Message))
}

function Get-InstallerHubFileSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    throw "Archivo no encontrado para hash: $Path"
  }
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha.ComputeHash($stream)
      return ([BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Resolve-InstallerHubSha256FromText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [string]$Pattern
  )

  $lines = $Text -split "`r?`n"
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if (-not $trim) { continue }
    if ($Pattern -and ($trim -notmatch [Regex]::Escape($Pattern))) { continue }
    $match = [Regex]::Match($trim, '(?<sha>[a-fA-F0-9]{64})')
    if ($match.Success) {
      return $match.Groups['sha'].Value.ToLowerInvariant()
    }
  }

  return ''
}

function Test-InstallerHubInternet {
  param(
    [string]$ProbeUrl = 'https://api.github.com'
  )

  if (@('1', 'true', 'yes', 'on') -contains [string]$env:EVALUAPRO_INSTALLER_ASSUME_INTERNET) {
    return $true
  }

  try {
    $headers = @{ 'User-Agent' = 'EvaluaPro-InstallerHub' }
    Invoke-InstallerHubWebRequest -Url $ProbeUrl -Method HEAD -Headers $headers -TimeoutSec 12 -RetryCount 1 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Invoke-InstallerHubProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(Mandatory = $true)]
    [string]$Arguments,
    [int]$TimeoutSec = 1800,
    [string]$WorkingDirectory = ''
  )

  $startInfo = @{
    FilePath = $FilePath
    ArgumentList = $Arguments
    Wait = $true
    PassThru = $true
    WindowStyle = 'Hidden'
  }
  if ($WorkingDirectory) {
    $startInfo.WorkingDirectory = $WorkingDirectory
  }

  $proc = Start-Process @startInfo
  if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
    try { $proc.Kill() } catch {}
    throw "Proceso excedio timeout (${TimeoutSec}s): $FilePath $Arguments"
  }

  return [int]$proc.ExitCode
}

function Get-InstallerFlavorCatalog {
  param(
    [string]$RootPath = ''
  )

  $catalogPath = Resolve-InstallerFlavorCatalogPath -RootPath $RootPath

  $raw = Get-Content -Path $catalogPath -Raw -Encoding utf8
  $json = $raw | ConvertFrom-Json
  if (-not $json.flavors -or @($json.flavors).Count -eq 0) {
    throw 'El catalogo de flavors no define entries.'
  }

  return [pscustomobject]@{
    version = if ($null -ne $json.version) { [int]$json.version } else { 1 }
    defaultFlavorId = if ($null -ne $json.defaultFlavorId) { [string]$json.defaultFlavorId } else { '' }
    flavors = @($json.flavors)
  }
}

function Get-InstallerFlavorDefinition {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FlavorId,
    [string]$RootPath = ''
  )

  $catalog = Get-InstallerFlavorCatalog -RootPath $RootPath
  $normalized = [string]$FlavorId
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    $normalized = [string]$catalog.defaultFlavorId
  }

  $match = @($catalog.flavors | Where-Object { [string]$_.flavorId -eq $normalized } | Select-Object -First 1)
  if ($match.Count -eq 0) {
    throw "Flavor no soportado: $normalized"
  }

  return $match[0]
}

Export-ModuleMember -Function @(
  'Test-IsAdministrator',
  'Resolve-InstallerElevationScriptPath',
  'Ensure-ElevatedSession',
  'New-InstallerHubLogContext',
  'Write-InstallerHubLog',
  'Invoke-InstallerHubWebRequest',
  'Invoke-InstallerHubDownloadFile',
  'Get-InstallerHubFileSha256',
  'Resolve-InstallerHubSha256FromText',
  'Test-InstallerHubInternet',
  'Invoke-InstallerHubProcess',
  'Get-InstallerFlavorCatalog',
  'Get-InstallerFlavorDefinition'
)
