Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-ElevatedSession {
  param(
    [string]$ScriptPath,
    [string[]]$PassthroughArgs
  )

  if (Test-IsAdministrator) {
    return $true
  }

  $quotedArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $ScriptPath))
  if ($PassthroughArgs) {
    foreach ($arg in $PassthroughArgs) {
      $quotedArgs += ('"{0}"' -f ($arg -replace '"', '\"'))
    }
  }

  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($quotedArgs -join ' ') | Out-Null
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
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
  )

  $catalogPath = Join-Path $RootPath 'config\installer-flavors.json'
  if (-not (Test-Path $catalogPath)) {
    throw "No existe catalogo de flavors: $catalogPath"
  }

  $raw = Get-Content -Path $catalogPath -Raw -Encoding utf8
  $json = $raw | ConvertFrom-Json
  if (-not $json.flavors -or @($json.flavors).Count -eq 0) {
    throw 'El catalogo de flavors no define entries.'
  }

  return [pscustomobject]@{
    version = [int]($json.version ?? 1)
    defaultFlavorId = [string]($json.defaultFlavorId ?? '')
    flavors = @($json.flavors)
  }
}

function Get-InstallerFlavorDefinition {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FlavorId,
    [string]$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
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
