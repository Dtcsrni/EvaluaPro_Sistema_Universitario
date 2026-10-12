# Unified Windows launcher broker for EvaluaPro.
# Orchestrates dashboard bootstrap, local platform start, shortcuts, Hub and splash state.
param(
  [ValidateSet('open-dashboard', 'restart-stack', 'stop-all', 'repair', 'uninstall', 'open-hub', 'verify-installation')]
  [string]$Action = 'open-dashboard',
  [ValidateSet('dev', 'prod', 'auto')]
  [string]$Mode = 'auto',
  [ValidateRange(1, 65535)]
  [int]$Port = 4519,
  [string]$RunId = '',
  [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Normalizar puerto: si se recibe 4000 (API) o 4173 (Web), normalizar a 4519 (Dashboard control plane)
if ($Port -eq 4000 -or $Port -eq 4173) {
  $Port = 4519
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $root 'logs'
$logFile = Join-Path $logDir 'launcher-broker.log'
$dashboardLauncher = Join-Path $root 'scripts\launcher-dashboard.ps1'
$hubManifestPath = Join-Path $root 'dist\installer\installer-local-paths.json'
$hubManifestPathInternal = Join-Path $root 'dist\installer\_internal\installer-local-paths.json'
$manifestScript = Join-Path $root 'scripts\generate-installation-manifest.ps1'
$updateConfigPath = Join-Path $root 'config\update-config.json'
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-BrokerLog([string]$message) {
  try {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -LiteralPath $logFile -Value "[$ts] $message"
  } catch {}
}

function Get-EffectiveRunId {
  if (-not [string]::IsNullOrWhiteSpace($RunId)) { return $RunId.Trim() }
  return ("broker-" + [guid]::NewGuid().ToString('N'))
}

$script:RunIdEffective = Get-EffectiveRunId
$script:BootstrapPath = Join-Path $logDir ("bootstrap-state-{0}.json" -f ($script:RunIdEffective -replace '[^a-zA-Z0-9_-]', ''))

function Set-BootstrapState {
  param(
    [string]$State,
    [string]$Message,
    [string]$DesiredMode = '',
    [hashtable]$Meta = @{}
  )

  $payload = [ordered]@{
    runId = $script:RunIdEffective
    action = $Action
    state = $State
    message = $Message
    desiredMode = $DesiredMode
    port = $Port
    timestamp = (Get-Date).ToString('o')
    meta = $Meta
  }
  try {
    [IO.File]::WriteAllText($script:BootstrapPath, ($payload | ConvertTo-Json -Depth 8), [Text.Encoding]::UTF8)
  } catch {}
}

function Resolve-PowerShellExecutable {
  $candidates = @(
    (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'),
    'powershell.exe',
    'pwsh.exe'
  )
  foreach ($candidate in $candidates) {
    try {
      if ([IO.Path]::IsPathRooted($candidate)) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      } else {
        $null = Get-Command $candidate -ErrorAction Stop
        return $candidate
      }
    } catch {}
  }
  throw 'No se encontro ejecutable de PowerShell.'
}

function ConvertTo-NativeArgumentString {
  param([string[]]$Arguments)
  return ((@($Arguments) | ForEach-Object {
    $arg = [string]$_
    if ($arg -match '[\s"]') {
      '"' + ($arg -replace '"', '\"') + '"'
    } else {
      $arg
    }
  }) -join ' ')
}

function Get-LockPort {
  $lockPath = Join-Path $logDir 'dashboard.lock.json'
  try {
    if (-not (Test-Path -LiteralPath $lockPath)) { return $null }
    $raw = Get-Content -LiteralPath $lockPath -Raw
    if (-not $raw) { return $null }
    $parsed = $raw | ConvertFrom-Json
    $candidate = if ($null -ne $parsed.port) { [int]$parsed.port } else { 0 }
    if ($candidate -ge 1 -and $candidate -le 65535) {
      if (Test-DashboardPortResponsive $candidate) { return $candidate }
      # El dashboard publica el lock al entrar a listen. Una comprobación HTTP
      # concurrente puede ocurrir antes de que Node atienda la primera petición;
      # no borrar un lock que todavía pertenece a un proceso vivo.
      $ownerPid = if ($null -ne $parsed.pid) { [int]$parsed.pid } else { 0 }
      if (Test-DashboardProcessAlive $ownerPid) {
        Write-BrokerLog("Dashboard todavía inicia en puerto $candidate (pid=$ownerPid); se conserva el lock.")
        return $candidate
      }
      Write-BrokerLog("Lockfile stale: dashboard no responde en puerto $candidate.")
      try { Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue } catch {}
    }
  } catch {
    Write-BrokerLog("No se pudo leer lockfile: $($_.Exception.Message)")
  }
  return $null
}

function Test-DashboardProcessAlive([int]$processId) {
  if ($processId -le 0) { return $false }
  try {
    $process = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId={0}" -f $processId) -ErrorAction Stop
    if (-not $process) { return $false }
    $commandLine = [string]$process.CommandLine
    if ([string]::IsNullOrWhiteSpace($commandLine)) { return $true }
    return ($commandLine -match 'launcher-dashboard\.(mjs|ps1)')
  } catch {
    # Si CIM no permite leer la línea de comandos, la existencia del PID basta
    # para evitar borrar un lock válido durante el arranque.
    try {
      Get-Process -Id $processId -ErrorAction Stop | Out-Null
      return $true
    } catch {
      return $false
    }
  }
}

function Get-ApiBase([int]$requestedPort) {
  $effectivePort = $requestedPort
  $lockPort = Get-LockPort
  if ($lockPort) { $effectivePort = $lockPort }
  return "http://127.0.0.1:$effectivePort"
}

function Invoke-JsonGet([string]$url, [int]$timeoutSec = 3) {
  Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $timeoutSec
}

function Test-DashboardPortResponsive([int]$candidatePort) {
  if ($candidatePort -lt 1 -or $candidatePort -gt 65535) { return $false }
  try {
    $status = Invoke-JsonGet "http://127.0.0.1:$candidatePort/api/status" 2
    return ($null -ne $status)
  } catch {
    return $false
  }
}

function Stop-StaleDashboardOnPort([int]$candidatePort) {
  if ($candidatePort -lt 1 -or $candidatePort -gt 65535) { return }
  # Nunca tocar los puertos de la API ni de la Web estática
  if ($candidatePort -eq 4000 -or $candidatePort -eq 4173) { return }
  if (Test-DashboardPortResponsive $candidatePort) { return }

  try {
    $listeners = @(Get-NetTCPConnection -LocalPort $candidatePort -State Listen -ErrorAction SilentlyContinue)
  } catch {
    $listeners = @()
  }

  foreach ($listener in $listeners) {
    # PowerShell reserva $PID; usar otro nombre evita que el broker falle al
    # limpiar listeners huérfanos antes de abrir el dashboard.
    $processId = [int]$listener.OwningProcess
    if ($processId -le 0 -or $processId -eq $PID) { continue }
    try {
      $process = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $processId) -ErrorAction SilentlyContinue
      if (-not $process) { continue }
      $commandLine = [string]$process.CommandLine
      if ($commandLine -and $commandLine -notmatch 'launcher-dashboard\.(mjs|ps1)') { continue }
      Write-BrokerLog("Cerrando dashboard no responsivo en puerto $candidatePort (pid=$processId).")
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    } catch {
      Write-BrokerLog("No se pudo cerrar listener no responsivo en puerto $candidatePort (pid=$processId): $($_.Exception.Message)")
    }
  }
}

function Clear-StaleDashboardListeners([int]$requestedPort) {
  $ports = @($requestedPort)
  for ($offset = 0; $offset -lt 20; $offset += 1) {
    $ports += (4519 + $offset)
  }
  foreach ($port in @($ports | Select-Object -Unique)) {
    Stop-StaleDashboardOnPort ([int]$port)
  }
}

function Invoke-JsonPost([string]$url, [hashtable]$body, [int]$timeoutSec = 10) {
  $json = $body | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body $json -TimeoutSec $timeoutSec
}

function Wait-DashboardReady([int]$requestedPort, [int]$timeoutMs = 45000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(2000, $timeoutMs))
  do {
    $base = Get-ApiBase $requestedPort
    try {
      $status = Invoke-JsonGet "$base/api/status" 2
      return [pscustomobject]@{
        base = $base
        status = $status
      }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Ensure-DashboardRunning([string]$bootstrapMode, [int]$requestedPort) {
  Set-BootstrapState -State 'booting_dashboard' -Message 'Inicializando control plane local.' -DesiredMode $bootstrapMode
  # Post-install puede haber iniciado dashboard en segundo plano. Darle una
  # ventana de arranque antes de tratar lock/listener como obsoleto evita dos
  # instancias concurrentes y falsos timeouts en equipos lentos.
  $ready = Wait-DashboardReady -requestedPort $requestedPort -timeoutMs 30000
  if ($ready) { return $ready }
  if (-not (Test-Path -LiteralPath $dashboardLauncher)) {
    throw "No se encontro launcher del dashboard: $dashboardLauncher"
  }
  Clear-StaleDashboardListeners -requestedPort $requestedPort
  $psExe = Resolve-PowerShellExecutable
  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-STA',
    '-File', $dashboardLauncher,
    '-Mode', $bootstrapMode,
    '-Port', [string]$requestedPort,
    '-NoOpen'
  )
  Write-BrokerLog("Iniciando dashboard (mode=$bootstrapMode, port=$requestedPort, runId=$script:RunIdEffective).")
  Start-Process -FilePath $psExe -ArgumentList (ConvertTo-NativeArgumentString -Arguments $args) -WindowStyle Hidden | Out-Null
  $ready = Wait-DashboardReady -requestedPort $requestedPort -timeoutMs 90000
  if (-not $ready) {
    throw 'Dashboard no respondio en el tiempo esperado.'
  }
  return $ready
}

function Resolve-DesiredMode([string]$modeRequested, $status) {
  if ($modeRequested -eq 'dev' -or $modeRequested -eq 'prod') { return $modeRequested }
  try {
    $running = @($status.running)
    if ($running -contains 'prod') { return 'prod' }
    if ($running -contains 'dev') { return 'dev' }
  } catch {}
  return 'prod'
}

function Test-ServiceOk($health, [string]$key) {
  try {
    return [bool]$health.services.$key.ok
  } catch {
    return $false
  }
}

function Test-RequiresLocalPortal {
  try {
    if (Test-Path -LiteralPath $updateConfigPath) {
      $raw = Get-Content -LiteralPath $updateConfigPath -Raw -Encoding utf8
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $cfg = $raw | ConvertFrom-Json
        $flavorId = [string]$cfg.flavorId
        if (-not [string]::IsNullOrWhiteSpace($flavorId)) {
          return ($flavorId.Trim().ToLowerInvariant() -ne 'docente-local')
        }
      }
    }
  } catch {}
  return $false
}

function Wait-DesiredHealth([string]$base, [string]$desiredMode, [int]$timeoutMs = 150000) {
  $deadline = (Get-Date).AddMilliseconds([Math]::Max(5000, $timeoutMs))
  $requireLocalPortal = Test-RequiresLocalPortal
  $portalStarted = $false
  do {
    try {
      $health = Invoke-JsonGet "$base/api/health" 4
      $apiOk = Test-ServiceOk -health $health -key 'apiDocente'
      $webOk = if ($desiredMode -eq 'dev') {
        Test-ServiceOk -health $health -key 'webDocenteDev'
      } else {
        Test-ServiceOk -health $health -key 'webDocenteProd'
      }
      $portalOk = if ($requireLocalPortal) { Test-ServiceOk -health $health -key 'apiPortal' } else { $true }
      if ($apiOk -and $webOk) {
        return [pscustomobject]@{
          ok = $true
          degraded = ($requireLocalPortal -and (-not $portalOk))
          health = $health
        }
      }
      if ($requireLocalPortal -and -not $portalStarted) {
        Set-BootstrapState -State 'booting_portal' -Message 'Sincronizando portal y servicios paralelos.' -DesiredMode $desiredMode -Meta @{ base = $base }
        $portalStarted = $true
      }
    } catch {}
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $deadline)

  $health = $null
  try { $health = Invoke-JsonGet "$base/api/health" 4 } catch {}
  return [pscustomobject]@{
    ok = $false
    degraded = $true
    health = $health
  }
}

function Ensure-StackReady([string]$base, [string]$desiredMode, [int]$timeoutMs = 150000) {
  Set-BootstrapState -State 'booting_platform' -Message ("Levantando plataforma {0}." -f $desiredMode.ToUpperInvariant()) -DesiredMode $desiredMode -Meta @{ base = $base }
  try {
    $null = Invoke-JsonPost "$base/api/lifecycle/policy" @{ desiredMode = $desiredMode } 8
  } catch {}
  $null = Invoke-JsonPost "$base/api/start" @{ task = $desiredMode } 8
  if (Test-RequiresLocalPortal) {
    try { $null = Invoke-JsonPost "$base/api/start" @{ task = 'portal' } 8 } catch {}
  }
  return Wait-DesiredHealth -base $base -desiredMode $desiredMode -timeoutMs $timeoutMs
}

function Open-Url([string]$url) {
  if ($NoOpen) { return }
  # Lanzar como ventana de aplicación nativa dedicada sin forzar perfil nuevo para evitar pantallas de bienvenida de extensiones
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:LOCALAPPDATA}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      try {
        Start-Process -FilePath $candidate -ArgumentList @("--app=$url", "--window-size=1280,820") | Out-Null
        return
      } catch {}
    }
  }
  Start-Process $url | Out-Null
}

function Resolve-HubExecutablePath {
  # 1. Manifiestos locales conocidos
  $manifestCandidates = @(
    $hubManifestPath,
    $hubManifestPathInternal,
    (Join-Path $root 'config\installer-local-paths.json'),
    (Join-Path $root 'installer\installer-local-paths.json')
  )
  foreach ($mPath in $manifestCandidates) {
    if (Test-Path -LiteralPath $mPath) {
      try {
        $raw = Get-Content -LiteralPath $mPath -Raw
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
          $manifest = $raw | ConvertFrom-Json
          $candidate = [string]$manifest.recommendedHubExecutablePath
          if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
          }
          if ($manifest.recommended -and $manifest.recommended.bundlePublicPath -and (Test-Path -LiteralPath $manifest.recommended.bundlePublicPath)) {
            return [string]$manifest.recommended.bundlePublicPath
          }
          if ($manifest.artifacts) {
            foreach ($art in @($manifest.artifacts)) {
              if ($art.bundlePublicPath -and (Test-Path -LiteralPath $art.bundlePublicPath)) {
                return [string]$art.bundlePublicPath
              }
            }
          }
        }
      } catch {}
    }
  }

  # 2. Registro de Windows (BundleCachePath / ModifyPath de WiX Burn registrado)
  try {
    $regEntries = @(Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'EvaluaPro' })
    foreach ($entry in $regEntries) {
      if ($entry.BundleCachePath -and (Test-Path -LiteralPath $entry.BundleCachePath)) {
        return [string]$entry.BundleCachePath
      }
      if ($entry.ModifyPath -match '"([^"]+EvaluaPro[^"]+\.exe)"') {
        $p = $matches[1]
        if (Test-Path -LiteralPath $p) { return $p }
      }
    }
  } catch {}

  # 3. Directorio de Package Cache de Windows
  $cacheDirs = @(
    (Join-Path $env:LOCALAPPDATA 'Package Cache'),
    (Join-Path $env:ProgramData 'Package Cache')
  )
  foreach ($cd in $cacheDirs) {
    if (Test-Path -LiteralPath $cd) {
      try {
        $found = Get-ChildItem -Path $cd -Filter "EvaluaPro*.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path -LiteralPath $found.FullName)) {
          return $found.FullName
        }
      } catch {}
    }
  }

  # 4. Rutas de desarrollo y compilación local
  $devCandidates = @(
    (Join-Path $root 'packaging\wix\BurnBootstrapperApp\bin\Release\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe'),
    (Join-Path $root 'packaging\wix\BurnBootstrapperApp\bin\Debug\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe')
  )
  foreach ($dc in $devCandidates) {
    if (Test-Path -LiteralPath $dc) { return $dc }
  }

  return $null
}

function Resolve-LatestStableHubExecutablePath([string]$CurrentHubPath) {
  if ([string]::IsNullOrWhiteSpace($CurrentHubPath) -or -not (Test-Path -LiteralPath $CurrentHubPath -PathType Leaf)) { return $CurrentHubPath }
  $partialPath = ''
  try {
    $config = Get-Content -LiteralPath $updateConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$config.channel -ne 'stable' -or [string]$config.flavorId -ne 'docente-local' -or -not [bool]$config.autoCheckEnabled) { return $CurrentHubPath }
    $owner = [string]$config.owner
    $repo = [string]$config.repo
    if ($owner -ne 'Dtcsrni' -or $repo -ne 'EvaluaPro_Sistema_Universitario') { throw 'Repositorio de actualizacion no permitido.' }

    Add-Type -AssemblyName System.Windows.Forms
    $headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'EvaluaPro-InstallerHub' }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/releases/latest" -Headers $headers -Method Get -TimeoutSec 20
    if ($release.draft -or $release.prerelease) { throw 'La API devolvio una release no estable.' }
    $tag = [string]$release.tag_name
    if ($tag -notmatch '^v?(\d+\.\d+\.\d+)$') { throw "Tag estable invalido: $tag" }
    $latestVersion = [version]$matches[1]
    $releaseUri = [Uri][string]$release.html_url
    if ($releaseUri.Scheme -ne 'https' -or $releaseUri.Host -ne 'github.com' -or $releaseUri.AbsolutePath -ne "/$owner/$repo/releases/tag/$tag") {
      throw 'La URL de la release no pertenece al repositorio oficial.'
    }

    $currentVersion = $null
    $currentProductVersion = [string](Get-Item -LiteralPath $CurrentHubPath).VersionInfo.ProductVersion
    if ($currentProductVersion -match '(\d+\.\d+\.\d+)') { $currentVersion = [version]$matches[1] }
    if ($null -eq $currentVersion) {
      $package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
      if ([string]$package.version -notmatch '^\d+\.\d+\.\d+$') { throw 'La version instalada no se pudo validar.' }
      $currentVersion = [version]$package.version
    }
    if ($latestVersion -le $currentVersion) { return $CurrentHubPath }

    $configuredAssetName = [string]$config.assetName
    $configuredChecksumName = [string]$config.sha256AssetName
    if ($configuredAssetName -cne 'EvaluaPro-InstallerHub-docente-local.exe' -or $configuredChecksumName -cne "$configuredAssetName.sha256") { throw 'La configuración base de assets no corresponde al flavor docente-local.' }
    $assetName = "EvaluaPro-InstallerHub-docente-local-v$($latestVersion.ToString()).exe"
    $checksumName = "$assetName.sha256"
    $installerAsset = @($release.assets) | Where-Object { [string]$_.name -ceq $assetName } | Select-Object -First 1
    $checksumAsset = @($release.assets) | Where-Object { [string]$_.name -ceq $checksumName } | Select-Object -First 1
    foreach ($asset in @($installerAsset, $checksumAsset)) {
      $assetUri = [Uri][string]$asset.browser_download_url
      if ($asset.name -notin @($assetName, $checksumName) -or $assetUri.Scheme -ne 'https' -or $assetUri.Host -ne 'github.com' -or $assetUri.AbsolutePath -notlike "/$owner/$repo/releases/download/$tag/*") {
        throw 'La release no incluye assets oficiales compatibles.'
      }
    }

    $updateDir = Join-Path (Join-Path $env:LOCALAPPDATA 'EvaluaPro\updates') $latestVersion.ToString()
    if (-not (Test-Path -LiteralPath $updateDir)) { New-Item -ItemType Directory -Path $updateDir -Force | Out-Null }
    $targetPath = Join-Path $updateDir $assetName
    $partialPath = "$targetPath.partial"
    $checksumResponse = Invoke-WebRequest -Uri ([string]$checksumAsset.browser_download_url) -Headers $headers -Method Get -TimeoutSec 30 -UseBasicParsing
    $checksumFinalHost = [string]$checksumResponse.BaseResponse.ResponseUri.Host
    if ($checksumFinalHost -notin @('github.com', 'release-assets.githubusercontent.com')) { throw 'El checksum redirigio a un host no permitido.' }
    $checksumText = [string]$checksumResponse.Content
    if ($checksumText -notmatch '(?im)^\s*([a-f0-9]{64})(?:\s+[* ].*)?\s*$') { throw 'El checksum de la release está mal formado.' }
    $expectedHash = $matches[1].ToLowerInvariant()
    $cachedHash = if (Test-Path -LiteralPath $targetPath) { (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
    $currentSignature = Get-AuthenticodeSignature -LiteralPath $CurrentHubPath
    if ($cachedHash -eq $expectedHash) {
      $cachedProductVersion = [string](Get-Item -LiteralPath $targetPath).VersionInfo.ProductVersion
      $cachedVersion = $null
      if ($cachedProductVersion -match '(\d+\.\d+\.\d+)') { $cachedVersion = [version]$matches[1] }
      $cachedSignature = Get-AuthenticodeSignature -LiteralPath $targetPath
      if ($cachedVersion -eq $latestVersion -and $currentSignature.Status -eq 'Valid' -and $cachedSignature.Status -eq 'Valid' -and
          $currentSignature.SignerCertificate.Thumbprint -eq $cachedSignature.SignerCertificate.Thumbprint) {
        return $targetPath
      }
    }

    $answer = [System.Windows.Forms.MessageBox]::Show(
      "Se encontró EvaluaPro v$($latestVersion.ToString()). Se descargará y verificará el Installer Hub firmado; después podrás revisar y confirmar la actualización. ¿Continuar?",
      'EvaluaPro · Actualización disponible',
      [System.Windows.Forms.MessageBoxButtons]::YesNo,
      [System.Windows.Forms.MessageBoxIcon]::Question
    )
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return $CurrentHubPath }

    if ($currentSignature.Status -ne 'Valid') { throw 'Windows no validó la firma del Installer Hub instalado.' }
    Invoke-WebRequest -Uri ([string]$installerAsset.browser_download_url) -Headers $headers -Method Get -TimeoutSec 600 -UseBasicParsing -OutFile $partialPath
    $actualHash = (Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw 'La suma SHA-256 del Installer Hub no coincide.' }
    $newProductVersion = [string](Get-Item -LiteralPath $partialPath).VersionInfo.ProductVersion
    if ($newProductVersion -notmatch '(\d+\.\d+\.\d+)' -or [version]$matches[1] -ne $latestVersion) { throw 'La version del ejecutable no coincide con el tag estable.' }
    $newSignature = Get-AuthenticodeSignature -LiteralPath $partialPath
    if ($newSignature.Status -ne 'Valid' -or $currentSignature.SignerCertificate.Thumbprint -ne $newSignature.SignerCertificate.Thumbprint) {
      throw 'Windows no validó la firma del mismo editor en el Installer Hub descargado.'
    }
    Move-Item -LiteralPath $partialPath -Destination $targetPath -Force
    return $targetPath
  } catch {
    Write-BrokerLog("No se pudo actualizar Installer Hub automáticamente: $($_.Exception.Message)")
    try {
      [System.Windows.Forms.MessageBox]::Show(
        'No se pudo verificar la actualización del Hub. La instalación no se modificó; se abrirá el Hub actual.',
        'EvaluaPro · No se pudo actualizar el Hub',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
      ) | Out-Null
    } catch { Write-BrokerLog('No se pudo mostrar el aviso; se abrirá el Hub instalado.') }
    return $CurrentHubPath
  } finally {
    if ($partialPath -and (Test-Path -LiteralPath $partialPath)) {
      try { Remove-Item -LiteralPath $partialPath -Force } catch {}
    }
  }
}

function Open-Hub {
  $hubExecutablePath = Resolve-HubExecutablePath
  if ($hubExecutablePath) { $hubExecutablePath = Resolve-LatestStableHubExecutablePath -CurrentHubPath $hubExecutablePath }
  if ($hubExecutablePath) {
    Write-BrokerLog("Abriendo Hub empaquetado: $hubExecutablePath")
    Start-Process -FilePath $hubExecutablePath -WorkingDirectory (Split-Path -Path $hubExecutablePath -Parent) | Out-Null
  } else {
    Write-BrokerLog("No se encontro binario externo de Hub; abriendo seccion de gestion en la aplicacion.")
    Open-Url "http://127.0.0.1:4173/#/cuenta"
  }
}

function Invoke-ManifestRefresh {
  if (-not (Test-Path -LiteralPath $manifestScript)) { return $null }
  $psExe = Resolve-PowerShellExecutable
  $args = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $manifestScript,
    '-Port', [string]$Port
  )
  try {
    & $psExe @args | Out-Null
  } catch {
    Write-BrokerLog("No se pudo refrescar manifiesto: $($_.Exception.Message)")
  }
}

try {
  Write-BrokerLog("Broker start action=$Action mode=$Mode port=$Port runId=$script:RunIdEffective")
  $bootstrapMode = if ($Mode -eq 'auto') { 'prod' } else { $Mode }

  switch ($Action) {
    'open-hub' {
      Set-BootstrapState -State 'booting_dashboard' -Message 'Abriendo Installer Hub.' -DesiredMode $bootstrapMode
      Open-Hub
      Set-BootstrapState -State 'healthy' -Message 'Installer Hub abierto.' -DesiredMode $bootstrapMode
      return
    }
    'verify-installation' {
      Set-BootstrapState -State 'booting_dashboard' -Message 'Verificando instalacion local.' -DesiredMode $bootstrapMode
      Invoke-ManifestRefresh
      Set-BootstrapState -State 'healthy' -Message 'Verificacion completada.' -DesiredMode $bootstrapMode
      return
    }
  }

  # REQ-030: En flavor docente-local, el Dashboard UI no debe ser accesible para docentes finales.
  # Se redirige a la Web Docente nativa (http://127.0.0.1:4173/) a menos que esté en modo depuración/admin.
  $isDocenteFlavor = (-not (Test-RequiresLocalPortal))
  $isAdminDebug = ($env:EVALUAPRO_DEBUG -eq '1')
  $openTargetUrl = if ($isDocenteFlavor -and -not $isAdminDebug) {
    Write-BrokerLog("Flavor docente-local detectado: redirigiendo apertura a Web Docente (http://127.0.0.1:4173/). UI Dashboard restringida a depuración administrativa.")
    "http://127.0.0.1:4173/"
  } else {
    "http://127.0.0.1:$Port/"
  }

  $ready = Ensure-DashboardRunning -bootstrapMode $bootstrapMode -requestedPort $Port
  $base = [string]$ready.base
  $status = $ready.status
  $desiredMode = Resolve-DesiredMode -modeRequested $Mode -status $status

  switch ($Action) {
    'open-dashboard' {
      $result = Ensure-StackReady -base $base -desiredMode $desiredMode -timeoutMs 150000
      $finalReady = Wait-DashboardReady -requestedPort $Port -timeoutMs 15000
      if ($result.ok) {
        Set-BootstrapState -State 'healthy' -Message 'Plataforma docente lista.' -DesiredMode $desiredMode -Meta @{ degraded = [bool]$result.degraded; base = $base; webUrl = "http://127.0.0.1:4173/" }
        if (-not $NoOpen) { Open-Url $openTargetUrl }
      } else {
        Set-BootstrapState -State 'degraded' -Message 'Dashboard activo, pero la plataforma no alcanzo salud completa.' -DesiredMode $desiredMode -Meta @{ base = $base; webUrl = "http://127.0.0.1:4173/" }
        if (-not $NoOpen) { Open-Url $openTargetUrl }
      }
    }
    'restart-stack' {
      Set-BootstrapState -State 'booting_platform' -Message 'Reiniciando plataforma local.' -DesiredMode $desiredMode
      $null = Invoke-JsonPost "$base/api/restart" @{ task = 'stack' } 8
      $result = Ensure-StackReady -base $base -desiredMode $desiredMode -timeoutMs 150000
      Invoke-ManifestRefresh
      if (-not $result.ok) {
        throw 'Plataforma reiniciada pero no saludable.'
      }
      Set-BootstrapState -State 'healthy' -Message 'Plataforma reiniciada y saludable.' -DesiredMode $desiredMode -Meta @{ base = $base }
      Open-Url "$base/"
    }
    'stop-all' {
      Set-BootstrapState -State 'booting_platform' -Message 'Deteniendo tareas activas.' -DesiredMode $desiredMode
      $latest = Invoke-JsonGet "$base/api/status" 4
      foreach ($task in @($latest.running)) {
        try { $null = Invoke-JsonPost "$base/api/stop" @{ task = [string]$task } 8 } catch {}
      }
      Invoke-ManifestRefresh
      Set-BootstrapState -State 'healthy' -Message 'Tareas detenidas.' -DesiredMode $desiredMode -Meta @{ base = $base }
      Open-Url "$base/"
    }
    'repair' {
      Set-BootstrapState -State 'booting_platform' -Message 'Ejecutando reparacion controlada.' -DesiredMode $desiredMode
      $run = Invoke-JsonPost "$base/api/repair/run" @{} 12
      $runIdRepair = if ($null -ne $run.runId) { [string]$run.runId } else { '' }
      $deadline = (Get-Date).AddMinutes(4)
      $state = 'running'
      while ((Get-Date) -lt $deadline -and $state -eq 'running') {
        Start-Sleep -Milliseconds 1500
        $progress = Invoke-JsonGet "$base/api/repair/progress" 4
        $state = if ($null -ne $progress.state) { [string]$progress.state } else { '' }
      }
      Invoke-ManifestRefresh
      if ($state -ne 'ok') {
        throw "Repair no termino correctamente (state=$state, runId=$runIdRepair)."
      }
      Set-BootstrapState -State 'healthy' -Message 'Repair completado.' -DesiredMode $desiredMode -Meta @{ base = $base; repairRunId = $runIdRepair }
      Open-Url "$base/"
    }
    'uninstall' {
      Set-BootstrapState -State 'booting_stack' -Message 'Iniciando desinstalacion guiada.' -DesiredMode $desiredMode
      $run = Invoke-JsonPost "$base/api/lifecycle/uninstall" @{} 12
      Invoke-ManifestRefresh
      $detail = if ($null -ne $run.detail) { [string]$run.detail } else { '' }
      if ($null -ne $run.ok -and -not [bool]$run.ok) {
        throw "No se pudo iniciar desinstalacion (detail=$detail)."
      }
      Set-BootstrapState -State 'healthy' -Message 'Desinstalacion iniciada.' -DesiredMode $desiredMode -Meta @{ base = $base; detail = $detail }
    }
  }
} catch {
  $message = $_.Exception.Message
  Write-BrokerLog("Broker failed: $message")
  Set-BootstrapState -State 'failed' -Message $message -DesiredMode $Mode
  [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
  if (-not $NoOpen) {
    [System.Windows.Forms.MessageBox]::Show(
      "EvaluaPro no pudo completar '$Action'.`n$message",
      'EvaluaPro - Launcher Broker',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  }
  exit 1
}

exit 0
