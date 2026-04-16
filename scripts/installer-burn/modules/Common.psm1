Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:InstallerHubLastProcessResult = $null

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
    $legacyRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
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

    if (Test-Path (Join-Path (Join-Path $resolved 'config') 'installer-flavors.json')) {
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
    (Join-Path (Join-Path $resolvedRoot 'config') 'installer-flavors.json'),
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
    $tempRootCandidate = [string]$env:TEMP
    if ([string]::IsNullOrWhiteSpace($tempRootCandidate)) {
      $tempRootCandidate = [IO.Path]::GetTempPath()
    }

    if (-not [string]::IsNullOrWhiteSpace($tempRootCandidate)) {
      $tempRoot = [IO.Path]::GetFullPath($tempRootCandidate).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
      $scriptDirFull = [IO.Path]::GetFullPath($scriptDir).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
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

function Start-ElevatedSession {
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
    [string]$RootPath = (Join-Path (Join-Path (Join-Path $env:ProgramData 'EvaluaPro') 'installer-hub') 'logs')
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
    [int]$RetryDelayMs = 1000,
    [scriptblock]$OnProgress
  )

  $attempt = 0
  $lastError = $null

  while ($attempt -le $RetryCount) {
    try {
      $attempt += 1
      Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 0 -Status ("Conectando descarga: {0}" -f $Url)
      Invoke-StreamingFileDownload -Url $Url -Destination $Destination -OnProgress $OnProgress
      Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 100 -Status ("Descarga completada: {0}" -f (Split-Path -Leaf $Destination))
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

function Get-InstallerHubSha256EntriesFromText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $entries = @()
  $lines = $Text -split "`r?`n"
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if (-not $trim) { continue }
    $match = [Regex]::Match($trim, '^(?<sha>[a-fA-F0-9]{64})\s+\*?(?<file>.+)$')
    if (-not $match.Success) { continue }
    $entries += [pscustomobject]@{
      sha256 = $match.Groups['sha'].Value.ToLowerInvariant()
      fileName = $match.Groups['file'].Value.Trim()
      line = $trim
    }
  }

  return @($entries)
}

function Resolve-InstallerHubPackageFromShasums {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [string]$PreferredPattern = '',
    [string]$FallbackRegex = ''
  )

  $entries = @(Get-InstallerHubSha256EntriesFromText -Text $Text)
  if ($entries.Count -eq 0) {
    return $null
  }

  if (-not [string]::IsNullOrWhiteSpace($PreferredPattern)) {
    foreach ($entry in $entries) {
      if ([string]$entry.fileName -match [Regex]::Escape($PreferredPattern)) {
        return [pscustomobject]@{
          sha256 = [string]$entry.sha256
          fileName = [string]$entry.fileName
          matchedBy = 'preferred-pattern'
          matchedPattern = [string]$PreferredPattern
          line = [string]$entry.line
        }
      }
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($FallbackRegex)) {
    $fallback = @($entries | Where-Object { [string]$_.fileName -match $FallbackRegex })
    if ($fallback.Count -gt 0) {
      $ranked = @($fallback | ForEach-Object {
        $version = [version]'0.0.0'
        $fileName = [string]$_.fileName
        $versionMatch = [Regex]::Match($fileName, 'node-v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)-')
        if ($versionMatch.Success) {
          $version = [version]::new(
            [int]$versionMatch.Groups['major'].Value,
            [int]$versionMatch.Groups['minor'].Value,
            [int]$versionMatch.Groups['patch'].Value
          )
        }
        [pscustomobject]@{
          version = $version
          fileName = $fileName
          sha256 = [string]$_.sha256
          line = [string]$_.line
        }
      } | Sort-Object -Property @{ Expression = 'version'; Descending = $true }, @{ Expression = 'fileName'; Descending = $false })

      if ($ranked.Count -gt 0) {
        $selected = $ranked[0]
        return [pscustomobject]@{
          sha256 = [string]$selected.sha256
          fileName = [string]$selected.fileName
          matchedBy = 'fallback-regex'
          matchedPattern = [string]$FallbackRegex
          line = [string]$selected.line
        }
      }
    }
  }

  return $null
}

function Resolve-InstallerHubSha256FromText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [string]$Pattern
  )

  $resolved = Resolve-InstallerHubPackageFromShasums -Text $Text -PreferredPattern ([string]$Pattern)
  if ($resolved -and $resolved.sha256) {
    return [string]$resolved.sha256
  }

  if ([string]::IsNullOrWhiteSpace([string]$Pattern)) {
    $entries = @(Get-InstallerHubSha256EntriesFromText -Text $Text)
    if ($entries.Count -gt 0) {
      return [string]$entries[0].sha256
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
    [string]$WorkingDirectory = '',
    [scriptblock]$OnProgress
  )

  $isMsi = ([string]::Equals([System.IO.Path]::GetExtension([string]$FilePath), '.msi', [StringComparison]::OrdinalIgnoreCase))
  $processFilePath = $FilePath
  $processArguments = [string]$Arguments
  $msiLogPath = ''

  if ($isMsi) {
    $logRoot = Join-Path (Join-Path (Join-Path $env:ProgramData 'EvaluaPro') 'installer-hub') 'logs'
    if ([string]::IsNullOrWhiteSpace([string]$logRoot)) {
      $logRoot = [string]$env:TEMP
    }
    if (-not (Test-Path -LiteralPath $logRoot)) {
      New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    }

    $safeName = ([System.IO.Path]::GetFileNameWithoutExtension([string]$FilePath) -replace '[^a-zA-Z0-9_.-]', '-')
    $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $msiLogPath = Join-Path $logRoot ("msi-{0}-{1}.log" -f $safeName, $timestamp)

    $processFilePath = 'msiexec.exe'
    $processArguments = ('/i "{0}" {1} /L*v "{2}"' -f [string]$FilePath, [string]$Arguments, [string]$msiLogPath).Trim()
  }

  $startInfo = @{
    FilePath = $processFilePath
    ArgumentList = $processArguments
    Wait = $true
    PassThru = $true
    WindowStyle = 'Hidden'
  }

  if ($isMsi -and -not (Test-IsAdministrator)) {
    $startInfo.Verb = 'RunAs'
  }
  if ($WorkingDirectory) {
    $startInfo.WorkingDirectory = $WorkingDirectory
  }

  Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'install' -Percent 5 -Status ("Iniciando instalacion: {0}" -f (Split-Path -Leaf $FilePath))

  try {
    $proc = Start-Process @startInfo
  } catch {
    $script:InstallerHubLastProcessResult = [pscustomobject]@{
      filePath = [string]$FilePath
      processFilePath = [string]$processFilePath
      arguments = [string]$processArguments
      isMsi = [bool]$isMsi
      msiLogPath = [string]$msiLogPath
      exitCode = -1
      error = [string]$_.Exception.Message
    }
    throw
  }
  $startedAt = Get-Date
  while (-not $proc.WaitForExit(1000)) {
    $elapsed = (Get-Date) - $startedAt
    $progressRatio = [Math]::Min(1.0, ($elapsed.TotalSeconds / [Math]::Max(1, $TimeoutSec)))
    $percent = 10 + [int][Math]::Round($progressRatio * 80)
    Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'install' -Percent $percent -Status ("Instalacion en curso: {0}" -f (Split-Path -Leaf $FilePath))
    if ($elapsed.TotalSeconds -ge $TimeoutSec) {
      try { $proc.Kill() } catch {}
      throw "Proceso excedio timeout (${TimeoutSec}s): $FilePath $Arguments"
    }
  }

  Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'install' -Percent 100 -Status ("Instalacion terminada: {0}" -f (Split-Path -Leaf $FilePath))

  $script:InstallerHubLastProcessResult = [pscustomobject]@{
    filePath = [string]$FilePath
    processFilePath = [string]$processFilePath
    arguments = [string]$processArguments
    isMsi = [bool]$isMsi
    msiLogPath = [string]$msiLogPath
    exitCode = [int]$proc.ExitCode
    error = ''
  }

  return [int]$proc.ExitCode
}

function Get-InstallerHubLastProcessResult {
  return $script:InstallerHubLastProcessResult
}

function Invoke-InstallerHubProgressCallback {
  param(
    [scriptblock]$OnProgress,
    [string]$Activity,
    [int]$Percent,
    [string]$Status,
    [hashtable]$Meta
  )

  if (-not $OnProgress) {
    return
  }

  $safePercent = [Math]::Min(100, [Math]::Max(0, $Percent))
  & $OnProgress $Activity $safePercent $Status $Meta
}

function Invoke-StreamingFileDownload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [scriptblock]$OnProgress
  )

  $destinationDir = Split-Path -Parent $Destination
  if ($destinationDir -and -not (Test-Path -LiteralPath $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }

  $httpError = $null
  try {
    try {
      Add-Type -AssemblyName 'System.Net.Http' -ErrorAction Stop
    } catch {}

    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromMinutes(3)

    try {
      $response = $client.GetAsync($Url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
      $response.EnsureSuccessStatusCode()

      $contentLength = $response.Content.Headers.ContentLength
      $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
      $fileStream = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)

      try {
        $buffer = New-Object byte[] 65536
        $totalRead = 0L
        $lastPercent = -1
        while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
          $fileStream.Write($buffer, 0, $read)
          $totalRead += $read
          if ($contentLength -gt 0) {
            $percent = [int][Math]::Floor(($totalRead / [double]$contentLength) * 100)
            if ($percent -ne $lastPercent) {
              $lastPercent = $percent
              Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent $percent -Status ("Descargando {0} ({1}%)" -f (Split-Path -Leaf $Destination), $percent) -Meta @{
                bytesReceived = $totalRead
                totalBytes = [int64]$contentLength
              }
            }
          } elseif ($totalRead -eq $read) {
            Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 50 -Status ("Descargando {0}" -f (Split-Path -Leaf $Destination)) -Meta @{
              bytesReceived = $totalRead
              totalBytes = 0
            }
          }
        }
      } finally {
        $fileStream.Dispose()
        $stream.Dispose()
        $response.Dispose()
      }

      return
    } finally {
      $client.Dispose()
      $handler.Dispose()
    }
  } catch {
    $httpError = $_.Exception.Message
  }

  try {
    if (Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue) {
      Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 15 -Status ("Descarga por BITS: {0}" -f (Split-Path -Leaf $Destination))
      Start-BitsTransfer -Source $Url -Destination $Destination -TransferPolicy Always -ErrorAction Stop
      Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 100 -Status ("Descarga completada por BITS: {0}" -f (Split-Path -Leaf $Destination))
      return
    }
  } catch {
    $httpError = if ([string]::IsNullOrWhiteSpace($httpError)) { $_.Exception.Message } else { "$httpError | BITS: $($_.Exception.Message)" }
  }

  try {
    Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 20 -Status ("Descarga por Invoke-WebRequest: {0}" -f (Split-Path -Leaf $Destination))
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 180 -ErrorAction Stop
    Invoke-InstallerHubProgressCallback -OnProgress $OnProgress -Activity 'download' -Percent 100 -Status ("Descarga completada: {0}" -f (Split-Path -Leaf $Destination))
    return
  } catch {
    $fallbackError = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace($httpError)) {
      throw "Descarga fallida por HTTP fallback: $fallbackError"
    }

    throw "Descarga fallida por todos los metodos. HttpClient='$httpError'. Invoke-WebRequest='$fallbackError'."
  }
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
  'Start-ElevatedSession',
  'New-InstallerHubLogContext',
  'Write-InstallerHubLog',
  'Invoke-InstallerHubWebRequest',
  'Invoke-InstallerHubDownloadFile',
  'Get-InstallerHubFileSha256',
  'Get-InstallerHubSha256EntriesFromText',
  'Resolve-InstallerHubPackageFromShasums',
  'Resolve-InstallerHubSha256FromText',
  'Test-InstallerHubInternet',
  'Invoke-InstallerHubProcess',
  'Get-InstallerHubLastProcessResult',
  'Invoke-InstallerHubProgressCallback',
  'Get-InstallerFlavorCatalog',
  'Get-InstallerFlavorDefinition'
)
