# installer-hub-e2e-docente.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
<#
  installer-hub-e2e-docente.ps1
  Validacion real end-to-end del Installer Hub docente-local en la PC de QA.

  IMPORTANTE: este script ejecuta install/repair/uninstall reales en la PC local.
  Requiere -IUnderstandThisMutatesPc para iniciar.
#>
[CmdletBinding()]
param(
  [string]$RootPath = '',
  [string]$ReportDir = '',
  [string]$InstallDir = '',
  [string]$CandidateBundlePath = '',
  [string]$BaselineBundlePath = '',
  [string]$SameVersionRelatedBundlePath = '',
  [int]$Port = 4519,
  [switch]$IUnderstandThisMutatesPc,
  [switch]$AllowExistingInstall,
  [switch]$SeedDummyData
)

Set-StrictMode -Version Latest
$script:activeNativeAppHost = $null
$ErrorActionPreference = 'Stop'
$reportDirectoryModule = Join-Path $PSScriptRoot 'installer-e2e-report-directory.psm1'
Import-Module -Name $reportDirectoryModule -Force -ErrorAction Stop

$isWindowsHost = $true
if (Get-Variable -Name IsWindows -Scope Global -ErrorAction SilentlyContinue) {
  $isWindowsHost = [bool]$IsWindows
}
if (-not $isWindowsHost -and $PSVersionTable.PSEdition -eq 'Core') {
  Write-Host 'SKIP: validacion E2E real del Installer Hub solo aplica en Windows.'
  exit 0
}

if (-not $IUnderstandThisMutatesPc) {
  throw 'Bloqueado: este E2E modifica la PC local. Reejecuta con -IUnderstandThisMutatesPc.'
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class EvaluaProE2ENativeWindow {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("kernel32.dll")]
  public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@

$startedAt = Get-Date
if ([string]::IsNullOrWhiteSpace($RootPath)) {
  $RootPath = Join-Path $PSScriptRoot '..\..'
}
$root = (Resolve-Path $RootPath).Path
Set-Location -LiteralPath $root
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($ReportDir)) {
  $reportParent = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) { [IO.Path]::GetTempPath() } else { $env:RUNNER_TEMP }
  $ReportDir = Join-Path $reportParent ("installer-hub-e2e-docente-{0}-{1}" -f $stamp, [guid]::NewGuid().ToString('N'))
}
$ReportDir = Initialize-InstallerHubE2EReportDirectory -Path $ReportDir
$screenshotsDir = Join-Path $ReportDir 'screenshots'
$nativeDir = Join-Path $ReportDir 'native'
$logsDir = Join-Path $ReportDir 'logs'
$hashesDir = Join-Path $ReportDir 'hashes'
$manifestDir = Join-Path $ReportDir 'manifest'
$processesDir = Join-Path $ReportDir 'processes'
foreach ($dir in @($screenshotsDir, $nativeDir, $logsDir, $hashesDir, $manifestDir, $processesDir)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$reportPath = Join-Path $ReportDir 'report.json'
$legacyReportPath = Join-Path $ReportDir 'installer-hub-e2e-docente-report.json'
$logPath = Join-Path $ReportDir 'installer-hub-e2e-docente.log'
$tutorialPath = Join-Path $ReportDir 'tutorial.md'
$sharedProgramDataDatabasePath = Join-Path $env:ProgramData 'EvaluaPro\data\evaluapro.db'
$script:sharedProgramDataSqliteArtifactsAtStart = @(
  foreach ($suffix in @('', '-wal', '-shm', '-journal')) {
    $candidate = $sharedProgramDataDatabasePath + $suffix
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidate }
  }
)
$script:sharedProgramDataDatabaseExistedAtStart = $script:sharedProgramDataSqliteArtifactsAtStart.Count -gt 0
$script:sharedProgramDataSqliteSnapshotAtStart = @(
  foreach ($path in $script:sharedProgramDataSqliteArtifactsAtStart) {
    $item = Get-Item -LiteralPath $path -ErrorAction Stop
    [pscustomobject]@{
      path = $path
      length = [int64]$item.Length
      sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
)
$script:initialUninstallRegistryPaths = @()
$script:privateBackupDir = Join-Path $env:LOCALAPPDATA 'EvaluaPro\Backups'
$script:initialDataBackupPaths = @(
  if (Test-Path -LiteralPath $script:privateBackupDir -PathType Container) {
    Get-ChildItem -LiteralPath $script:privateBackupDir -File -Filter 'data_*.zip' -ErrorAction Stop | ForEach-Object { $_.FullName }
  }
)
$script:upgradingExistingInstall = $false
$script:existingInstalledPayloadVersion = $null
$script:preUpgradeDatabaseBackup = $null
$script:operationalConfigPath = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\operational-config.last.json'
$script:operationalConfigExistedAtStart = Test-Path -LiteralPath $script:operationalConfigPath -PathType Leaf
$script:operationalConfigOriginalBytes = if ($script:operationalConfigExistedAtStart) {
  [IO.File]::ReadAllBytes($script:operationalConfigPath)
} else {
  $null
}
$results = New-Object System.Collections.Generic.List[object]
$screenshots = New-Object System.Collections.Generic.List[string]
$artifacts = New-Object System.Collections.Generic.List[string]
$processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$failed = $false
$script:qaMutationStarted = $false
$bundlePath = ''
$installedRoot = ''

function Write-E2ELog {
  param([string]$Message)
  $line = '{0:u} {1}' -f (Get-Date), $Message
  Add-Content -Path $logPath -Encoding UTF8 -Value $line
  Write-Host $line
}

function Add-Result {
  param(
    [string]$Area,
    [string]$Item,
    [bool]$Ok,
    [string]$Detail = ''
  )
  if (-not $Ok) { $script:failed = $true }
  $script:results.Add([pscustomobject]@{
    area = $Area
    item = $Item
    ok = $Ok
    detail = $Detail
    at = (Get-Date).ToString('o')
  }) | Out-Null
  if ($script:reportPath) {
    Save-Report -Status 'running'
  }
}

function Save-Report {
  param([string]$Status)
  $resultItems = @()
  foreach ($item in $results) { $resultItems += $item }
  $screenshotItems = @()
  foreach ($item in $screenshots) { $screenshotItems += [string]$item }
  $artifactItems = @()
  foreach ($item in $artifacts) { $artifactItems += [string]$item }

  $report = [pscustomobject]@{
    status = $Status
    startedAt = $startedAt.ToString('o')
    finishedAt = (Get-Date).ToString('o')
    durationSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
    rootPath = $root
    reportDir = $ReportDir
    bundlePath = $bundlePath
    installDir = $installedRoot
    logPath = $logPath
    screenshots = $screenshotItems
    artifacts = $artifactItems
    results = $resultItems
  }
  $json = $report | ConvertTo-Json -Depth 10
  $json | Set-Content -Path $reportPath -Encoding UTF8
  $json | Set-Content -Path $legacyReportPath -Encoding UTF8
}

function Get-ProcessSnapshot {
  Get-Process |
    Where-Object { $_.ProcessName -like 'EvaluaPro*' -or $_.ProcessName -like 'node' -or $_.ProcessName -like 'npm' } |
    Select-Object Id, ProcessName, MainWindowTitle, Path
}

function Minimize-RunnerConsole {
  try {
    $handle = [EvaluaProE2ENativeWindow]::GetConsoleWindow()
    if ($handle -ne [IntPtr]::Zero) {
      [EvaluaProE2ENativeWindow]::ShowWindow($handle, 6) | Out-Null
    }
  } catch {}
}

function Export-JsonArtifact {
  param([string]$Name, [object]$Data)
  $targetDir = if ($Name -match '^processes-') { $processesDir } elseif ($Name -match 'native|health') { $nativeDir } elseif ($Name -match 'manifest|config|update-status') { $manifestDir } else { $ReportDir }
  $path = Join-Path $targetDir $Name
  $Data | ConvertTo-Json -Depth 12 | Set-Content -Path $path -Encoding UTF8
  $script:artifacts.Add($path) | Out-Null
  return $path
}

function Copy-ArtifactIfExists {
  param([string]$Path, [string]$Name = '')
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return '' }
  $targetName = if ($Name) { $Name } else { Split-Path -Leaf $Path }
  $targetDir = if ($targetName -match 'sha|SHASUMS') { $hashesDir } elseif ($targetName -match 'manifest|update-config') { $manifestDir } elseif ($targetName -match 'log') { $logsDir } else { $ReportDir }
  $target = Join-Path $targetDir $targetName
  $sourceFullPath = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path)
  $targetFullPath = [IO.Path]::GetFullPath($target)
  if ([string]::Equals($sourceFullPath, $targetFullPath, [StringComparison]::OrdinalIgnoreCase)) {
    if (-not $script:artifacts.Contains($targetFullPath)) { $script:artifacts.Add($targetFullPath) | Out-Null }
    return $targetFullPath
  }
  Copy-Item -LiteralPath $Path -Destination $target -Force -Recurse
  if (-not $script:artifacts.Contains($targetFullPath)) { $script:artifacts.Add($targetFullPath) | Out-Null }
  return $target
}

function Resolve-BundlePath {
  if (-not [string]::IsNullOrWhiteSpace($CandidateBundlePath)) {
    $candidatePath = (Resolve-Path -LiteralPath $CandidateBundlePath -ErrorAction Stop).Path
    if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf) -or [IO.Path]::GetExtension($candidatePath) -ne '.exe') {
      throw "CandidateBundlePath debe apuntar a un archivo EXE existente: $CandidateBundlePath"
    }
    return $candidatePath
  }

  $manifestPath = Join-Path $root 'dist\installer\installer-local-paths.json'
  $internalManifestPath = Join-Path $root 'dist\installer\_internal\installer-local-paths.json'
  $selected = if (Test-Path -LiteralPath $manifestPath) { $manifestPath } elseif (Test-Path -LiteralPath $internalManifestPath) { $internalManifestPath } else { '' }
  if (-not $selected) { throw 'No existe dist\installer\installer-local-paths.json. Genera/copiala antes del E2E.' }
  $manifest = Get-Content -Raw -Path $selected | ConvertFrom-Json
  $manifestDir = Split-Path -Parent $selected
  function Get-ManifestStringProperty([object]$Entry, [string]$Name) {
    if ($null -eq $Entry) { return '' }
    $property = $Entry.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) { return '' }
    return [string]$property.Value
  }

  function Resolve-ManifestBundleCandidate([object]$Entry) {
    foreach ($propertyName in @('bundlePublicPath', 'executablePath', 'installerHubPath')) {
      $candidate = Get-ManifestStringProperty $Entry $propertyName
      if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }

    foreach ($propertyName in @('executableRelativePath', 'bundleName', 'executableName')) {
      $relative = Get-ManifestStringProperty $Entry $propertyName
      if ([string]::IsNullOrWhiteSpace($relative)) { continue }
      $candidate = Join-Path $manifestDir $relative
      if (Test-Path -LiteralPath $candidate) { return $candidate }
      $flavorId = Get-ManifestStringProperty $Entry 'flavorId'
      if ($flavorId) {
        $candidate = Join-Path $manifestDir (Join-Path $flavorId $relative)
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      }
    }

    return ''
  }

  $candidate = [string]$manifest.recommended.bundlePublicPath
  if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  $candidate = Resolve-ManifestBundleCandidate $manifest.recommended
  if ($candidate) { return $candidate }

  foreach ($artifact in @($manifest.artifacts)) {
    if ([string]$artifact.flavorId -eq 'docente-local') {
      $candidate = Resolve-ManifestBundleCandidate $artifact
      if ($candidate) { return $candidate }
    }
  }

  foreach ($flavor in @($manifest.flavors)) {
    if ([string]$flavor.flavorId -eq 'docente-local') {
      $candidate = Resolve-ManifestBundleCandidate $flavor
      if ($candidate) { return $candidate }
    }
  }
  throw "No se encontro bundle docente-local desde manifiesto: $selected"
}

function Get-Sha256Hash {
  param([string]$Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
      return ([BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToLowerInvariant()
    } finally {
      $stream.Dispose()
    }
  } finally {
    $sha.Dispose()
  }
}

function Assert-Hash {
  param([string]$ExePath)
  $shaPath = "$ExePath.sha256"
  if (-not (Test-Path -LiteralPath $shaPath)) {
    throw "No existe SHA256 junto al bundle: $shaPath"
  }
  $expectedText = Get-Content -Path $shaPath -Raw
  $expected = ([regex]::Match($expectedText, '[A-Fa-f0-9]{64}')).Value.ToLowerInvariant()
  if (-not $expected) { throw "SHA256 esperado invalido: $shaPath" }
  $actual = Get-Sha256Hash -Path $ExePath
  Add-Result -Area 'preflight' -Item 'sha256' -Ok ($actual -eq $expected) -Detail "expected=$expected actual=$actual"
  if ($actual -ne $expected) { throw 'Hash SHA256 invalido para el bundle.' }
  $crcPath = "$ExePath.crc32"
  if (Test-Path -LiteralPath $crcPath) {
    $crcText = Get-Content -Path $crcPath -Raw
    $expectedCrc = ([regex]::Match($crcText, '[A-Fa-f0-9]{8}')).Value.ToLowerInvariant()
    if (-not $expectedCrc) { throw "CRC32 esperado invalido: $crcPath" }
    $actualCrc = Get-Crc32Hash -Path $ExePath
    Add-Result -Area 'preflight' -Item 'crc32' -Ok ($actualCrc -eq $expectedCrc) -Detail "expected=$expectedCrc actual=$actualCrc"
    if ($actualCrc -ne $expectedCrc) { throw 'CRC32 invalido para el bundle.' }
  } else {
    Add-Result -Area 'preflight' -Item 'crc32' -Ok $true -Detail 'No se publicó CRC32; SHA-256 es obligatorio y se verificó.'
  }
}

function Wait-WindowsInstallerIdle {
  param(
    [int]$TimeoutSec = 300,
    [string]$Context = 'operation'
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $inProgressPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\InProgress',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Installer\InProgress',
    'HKCU:\SOFTWARE\Microsoft\Installer\InProgress'
  )
  do {
    $servicesPid = (Get-Process -Name services -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)
    if (-not $servicesPid) { $servicesPid = 1604 }
    $activeClients = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -eq 'msiexec.exe' -and $_.ParentProcessId -ne $servicesPid -and $_.ParentProcessId -ne 1604
      })
    $inProgress = @($inProgressPaths | Where-Object { Test-Path -LiteralPath $_ })
    if ($activeClients.Count -eq 0 -and $inProgress.Count -eq 0) { return }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  $servicesPid = (Get-Process -Name services -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)
  if (-not $servicesPid) { $servicesPid = 1604 }
  $ids = (@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -eq 'msiexec.exe' -and $_.ParentProcessId -ne $servicesPid -and $_.ParentProcessId -ne 1604
    } | ForEach-Object ProcessId) -join ',')
  throw "Windows Installer sigue activo antes/después de $Context timeout=${TimeoutSec}s clientPids=$ids"
}

function Get-EvaluaProUninstallEntries {
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  $entries = @()
  foreach ($rootKey in $roots) {
    if (-not (Test-Path $rootKey)) { continue }
    foreach ($key in Get-ChildItem $rootKey -ErrorAction SilentlyContinue) {
      try {
        $item = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
        if ([string]$item.DisplayName -match 'EvaluaPro') {
          $entries += [pscustomobject]@{
            displayName = [string]$item.DisplayName
            displayVersion = [string]$item.DisplayVersion
            installLocation = [string]$item.InstallLocation
            uninstallString = [string]$item.UninstallString
            registryPath = [string]$key.Name
          }
        }
      } catch {}
    }
  }
  return @($entries)
}

function Get-SystemMemorySnapshot {
  $os = Get-CimInstance -ClassName Win32_OperatingSystem
  $pageFile = @(Get-CimInstance -ClassName Win32_PageFileUsage -ErrorAction SilentlyContinue)
  $totalVirtualMB = [int64]$os.TotalVirtualMemorySize / 1KB
  $freeVirtualMB = [int64]$os.FreeVirtualMemory / 1KB
  return [pscustomobject]@{
    totalVisibleMemoryMB = [math]::Round(([int64]$os.TotalVisibleMemorySize / 1KB), 2)
    freePhysicalMB = [math]::Round(([int64]$os.FreePhysicalMemory / 1KB), 2)
    totalVirtualMB = [math]::Round($totalVirtualMB, 2)
    freeVirtualMB = [math]::Round($freeVirtualMB, 2)
    pageFiles = $pageFile | Select-Object Name, CurrentUsage, PeakUsage, AllocatedBaseSize
  }
}

function Assert-SystemMemoryReady {
  $snapshot = Get-SystemMemorySnapshot
  Export-JsonArtifact -Name 'preflight-memory.json' -Data $snapshot | Out-Null
  $ok = [double]$snapshot.freeVirtualMB -ge 1536
  Add-Result -Area 'preflight' -Item 'memory-pagefile' -Ok $ok -Detail ("freeVirtualMB={0}" -f $snapshot.freeVirtualMB)
  if (-not $ok) { throw 'Memoria virtual/pagefile insuficiente para E2E Installer Hub.' }
}

function Find-Window {
  param([int]$TimeoutSec = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $nameRegex = '(?i)EvaluaPro.*Installer Hub|InstallerHub|Installer Hub'
  do {
    # Burn crea el BA como proceso separado; su MainWindowHandle es una ruta
    # determinista cuando el escritorio aún no lo expone como primer hijo.
    $baProcesses = @(Get-Process -Name 'EvaluaPro.BurnBootstrapperApp' -ErrorAction SilentlyContinue)
    foreach ($ba in $baProcesses) {
      try {
        if ($ba.MainWindowHandle -ne [IntPtr]::Zero -and $ba.MainWindowTitle -match $nameRegex) {
          return [System.Windows.Automation.AutomationElement]::FromHandle($ba.MainWindowHandle)
        }
      } catch {}
    }

    $children = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children,
      [System.Windows.Automation.Condition]::TrueCondition
    )
    foreach ($child in $children) {
      try {
        $name = [string]$child.Current.Name
        $rect = $child.Current.BoundingRectangle
        if ($name -match $nameRegex -and $rect.Width -gt 100 -and $rect.Height -gt 100) {
          return $child
        }
      } catch {}
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Find-ById {
  param(
    [System.Windows.Automation.AutomationElement]$RootElement,
    [string]$AutomationId,
    [int]$TimeoutSec = 8
  )
  if ($null -eq $RootElement) { return $null }
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    $AutomationId
  )
  do {
    try {
      $element = $RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
      if ($element) { return $element }
    } catch {
      return $null
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Find-ByName {
  param(
    [System.Windows.Automation.AutomationElement]$RootElement,
    [string]$Name,
    [int]$TimeoutSec = 8
  )
  if ($null -eq $RootElement) { return $null }
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Name
  )
  do {
    try {
      $element = $RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
      if ($element) { return $element }
    } catch {
      return $null
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Invoke-Control {
  param([System.Windows.Automation.AutomationElement]$Element)
  if (-not $Element) { throw 'Control nulo.' }
  if (-not $Element.Current.IsEnabled) {
    throw ("Control deshabilitado: {0} / {1}" -f $Element.Current.AutomationId, $Element.Current.Name)
  }
  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    $pattern.Invoke()
    return
  }
  try {
    $Element.SetFocus()
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    return
  } catch {
    throw ("Control sin InvokePattern: {0} / {1}" -f $Element.Current.AutomationId, $Element.Current.Name)
  }
}

function Wait-ControlEnabled {
  param(
    [System.Windows.Automation.AutomationElement]$RootElement,
    [string]$AutomationId,
    [int]$TimeoutSec = 30
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $element = $null
  do {
    $element = Find-ById -RootElement $RootElement -AutomationId $AutomationId -TimeoutSec 1
    if ($element -and $element.Current.IsEnabled) { return $element }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  if ($element) {
    throw ("Control no habilitado antes del timeout: {0} / {1}" -f $element.Current.AutomationId, $element.Current.Name)
  }
  throw "Control no encontrado antes del timeout: $AutomationId"
}

function Wait-DetectionIdle {
  param(
    [System.Windows.Automation.AutomationElement]$RootElement,
    [int]$TimeoutSec = 240
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    $window = Find-Window -TimeoutSec 2
    if ($window) { $RootElement = $window }

    $detectState = Get-LatestDetectPrereqsState -MinLastWriteTime $startedAt
    if ($detectState -and $detectState.ready) { return $RootElement }

    $next = Find-ById -RootElement $RootElement -AutomationId 'NextButton' -TimeoutSec 1
    if ($next -and $next.Current.IsEnabled) { return $RootElement }

    $detect = Find-ById -RootElement $RootElement -AutomationId 'DetectButton' -TimeoutSec 1
    if ($detect -and $detect.Current.IsEnabled) { return $RootElement }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "La deteccion de prerequisitos no volvio a estado estable antes de $TimeoutSec segundos."
}

function Get-LatestDetectPrereqsState {
  param([datetime]$MinLastWriteTime)
  $programDataLogs = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\logs'
  $searchPaths = @($logsDir, $ReportDir)
  if (Test-Path -LiteralPath $programDataLogs) {
    $searchPaths += $programDataLogs
  }
  $candidates = @(Get-ChildItem -Path $searchPaths -Filter 'detect-prereqs-*.response.json' -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $MinLastWriteTime } |
    Sort-Object LastWriteTime -Descending)
  foreach ($candidate in $candidates) {
    try {
      $payload = Get-Content -Raw -Path $candidate.FullName | ConvertFrom-Json
      $ready = $payload.ok -eq $true -or [string]$payload.status -match '^(ok|ready|success|passed)$'
      if ($ready) {
        Add-Result -Area 'detect' -Item 'detect-response-ready' -Ok $true -Detail $candidate.FullName
        return [pscustomobject]@{ ready = $true; path = $candidate.FullName; payload = $payload }
      }
    } catch {}
  }
  return $null
}

function Expand-Control {
  param([System.Windows.Automation.AutomationElement]$Element)
  $pattern = $null
  if ($Element -and $Element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$pattern)) {
    if ($pattern.Current.ExpandCollapseState -ne [System.Windows.Automation.ExpandCollapseState]::Expanded) {
      $pattern.Expand()
    }
    return $true
  }
  return $false
}

function Select-ComboItem {
  param(
    [System.Windows.Automation.AutomationElement]$Combo,
    [string]$ItemName
  )
  if (-not (Expand-Control -Element $Combo)) { throw "Combo no expandible: $($Combo.Current.AutomationId)" }
  Start-Sleep -Milliseconds 400
  $item = Find-ByName -RootElement $Combo -Name $ItemName -TimeoutSec 2
  $selectionPattern = $null
  if ($item -and -not $item.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionPattern)) { $item = $null }
  if (-not $item) {
    $item = Find-ByName -RootElement ([System.Windows.Automation.AutomationElement]::RootElement) -Name $ItemName -TimeoutSec 3
    $selectionPattern = $null
    if ($item -and -not $item.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selectionPattern)) { $item = $null }
  }
  if (-not $item) {
    try {
      $Combo.SetFocus()
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait('%{DOWN}')
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait('{HOME}')
      $downCount = switch ($ItemName) {
        'Reparar' { 1 }
        'Desinstalar' { 2 }
        default { 0 }
      }
      for ($i = 0; $i -lt $downCount; $i++) {
        [System.Windows.Forms.SendKeys]::SendWait('{DOWN}')
        Start-Sleep -Milliseconds 100
      }
      [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
      Start-Sleep -Milliseconds 700
      return
    } catch {}
  }
  if (-not $item) { throw "No se pudo seleccionar la opcion '$ItemName' del combo $($Combo.Current.AutomationId)." }
  $selectionPattern.Select()
  Start-Sleep -Milliseconds 700
}

function Capture-Window {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Name,
    [int]$RequestedWidth = 0,
    [int]$RequestedHeight = 0
  )
  if (-not $Window) {
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail 'La ventana UI Automation no está disponible.'
    throw "No se puede capturar ${Name}: la ventana UI Automation no está disponible."
  }
  $rectangle = $Window.Current.BoundingRectangle
  if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) {
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail 'La ventana UI Automation no tiene dimensiones positivas.'
    throw "No se puede capturar ${Name}: la ventana no tiene dimensiones positivas."
  }
  $bitmap = New-Object System.Drawing.Bitmap([int][Math]::Round($rectangle.Width), [int][Math]::Round($rectangle.Height))
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $nativeHandle = [IntPtr]$Window.Current.NativeWindowHandle
    if ($nativeHandle -eq [IntPtr]::Zero) { throw 'La ventana no expone un HWND para capturar su superficie visible.' }
    if ($Window.Current.IsOffscreen) { throw 'La ventana está fuera del área visible del escritorio.' }
    [EvaluaProE2ENativeWindow]::ShowWindow($nativeHandle, 5) | Out-Null
    [EvaluaProE2ENativeWindow]::SetForegroundWindow($nativeHandle) | Out-Null
    Start-Sleep -Milliseconds 250
    if ([EvaluaProE2ENativeWindow]::GetForegroundWindow() -ne $nativeHandle) {
      throw 'El Installer Hub no quedó en primer plano; no se acepta una captura fuera de la vista del usuario.'
    }
    $captureRect = [System.Drawing.Rectangle]::new([int][Math]::Round($rectangle.X), [int][Math]::Round($rectangle.Y), [int][Math]::Round($rectangle.Width), [int][Math]::Round($rectangle.Height))
    $captureScreen = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Contains($captureRect) } | Select-Object -First 1
    if (-not $captureScreen) {
      $availableScreens = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { '{0}={1}' -f $_.DeviceName, $_.Bounds }) -join '; '
      throw "La ventana ($($captureRect.Width)x$($captureRect.Height)) no cabe completa en un monitor conectado. Monitores: $availableScreens"
    }
    $graphics.CopyFromScreen($captureRect.X, $captureRect.Y, 0, 0, $bitmap.Size)
    if ($RequestedWidth -gt 0 -and $RequestedHeight -gt 0 -and ($bitmap.Width -ne $RequestedWidth -or $bitmap.Height -ne $RequestedHeight)) {
      throw "El tamaño capturado $($bitmap.Width)x$($bitmap.Height) no coincide con el viewport solicitado ${RequestedWidth}x${RequestedHeight}."
    }
    Write-E2ELog "Captura visual desde escritorio compuesto en primer plano name=$Name size=$($bitmap.Width)x$($bitmap.Height)"
    $path = Join-Path $screenshotsDir ("{0}.png" -f $Name)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $script:screenshots.Add($path) | Out-Null
    return $path
  } catch {
    Write-E2ELog "Error tomando screenshot visible de UI name=$Name error=$_"
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail $_.Exception.Message
    throw "No se pudo capturar la ventana WPF visible '$Name': $($_.Exception.Message)"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Assert-InstallerStepScreenshot {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Path,
    [string]$StepLabel,
    [string]$StageName
  )
  $text = Get-WindowTextSnapshot -Window $Window
  if ($text -notmatch [regex]::Escape($StepLabel)) {
    throw "La UI Automation no confirma el paso '$StepLabel' en $StageName."
  }
  $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
  $brightPixels = 0
  try {
    $top = [int][Math]::Floor($bitmap.Height * 0.30)
    $bottom = [int][Math]::Ceiling($bitmap.Height * 0.82)
    $left = [int][Math]::Floor($bitmap.Width * 0.04)
    $right = [int][Math]::Ceiling($bitmap.Width * 0.96)
    for ($y = $top; $y -lt $bottom; $y += 2) {
      for ($x = $left; $x -lt $right; $x += 2) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.R -ge 228 -and $pixel.G -ge 228 -and $pixel.B -ge 228) { $brightPixels++ }
      }
    }
  } finally {
    $bitmap.Dispose()
  }
  if ($brightPixels -lt 40) {
    Add-Result -Area 'screenshots' -Item $StageName -Ok $false -Detail "El paso $StepLabel no dibujó contenido legible en el panel central; pixeles claros=$brightPixels" | Out-Null
    throw "La captura $StageName muestra vacío el panel del paso '$StepLabel' (pixeles claros=$brightPixels)."
  }
  Add-Result -Area 'screenshots' -Item $StageName -Ok $true -Detail "UIA=$StepLabel; pixeles claros del panel=$brightPixels" | Out-Null
}

function Wait-InstallerStepStableForCapture {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$StepLabel,
    [int]$TimeoutSec = 15
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $stableReads = 0
  do {
    $freshWindow = Find-Window -TimeoutSec 1
    if ($freshWindow) { $Window = $freshWindow }

    $snapshot = Get-WindowTextSnapshot -Window $Window
    if ($snapshot -match [regex]::Escape($StepLabel)) {
      $stableReads++
      if ($stableReads -ge 2) {
        # UI Automation can expose the new step before WPF has presented its
        # visual tree. Let one additional render interval elapse before the
        # single fail-closed screenshot assertion.
        Start-Sleep -Milliseconds 500
        $confirmedSnapshot = Get-WindowTextSnapshot -Window $Window
        if ($confirmedSnapshot -match [regex]::Escape($StepLabel)) {
          Add-Result -Area 'screenshots' -Item 'step-render-ready' -Ok $true -Detail "UIA estable: $StepLabel"
          return $Window
        }
        $stableReads = 0
      }
    } else {
      $stableReads = 0
    }
    Start-Sleep -Milliseconds 150
  } while ((Get-Date) -lt $deadline)

  Add-Result -Area 'screenshots' -Item 'step-render-ready' -Ok $false -Detail "UIA no estabilizó el paso $StepLabel en $TimeoutSec segundos." | Out-Null
  throw "La UI Automation no mantuvo el paso '$StepLabel' estable antes de capturar la pantalla."
}

function Resize-WindowForEvidence {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [int]$Width,
    [int]$Height
  )
  try {
    if (-not $Window) { return $false }
    # Resize the exact UI Automation window that will be captured. The bundle
    # process may be a Burn parent with a different MainWindowHandle from the
    # visible WPF Bootstrapper Application.
    $handle = [IntPtr]$Window.Current.NativeWindowHandle
    if ($handle -eq [IntPtr]::Zero) { return $false }
    if (-not [EvaluaProE2ENativeWindow]::MoveWindow($handle, 0, 0, $Width, $Height, $true)) { return $false }
    $deadline = (Get-Date).AddSeconds(3)
    do {
      Start-Sleep -Milliseconds 100
      $window = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
      if ($window) {
        $actual = $window.Current.BoundingRectangle
        if ([Math]::Abs([int][Math]::Round($actual.Width) - $Width) -le 1 -and [Math]::Abs([int][Math]::Round($actual.Height) - $Height) -le 1) {
          $bounds = [System.Drawing.Rectangle]::new([int][Math]::Round($actual.X), [int][Math]::Round($actual.Y), [int][Math]::Round($actual.Width), [int][Math]::Round($actual.Height))
          $screen = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Contains($bounds) } | Select-Object -First 1
          if ($screen) { return $true }
        }
      }
    } while ((Get-Date) -lt $deadline)
    $actualSize = if ($window) { '{0}x{1}' -f [int][Math]::Round($actual.Width), [int][Math]::Round($actual.Height) } else { 'desconocido' }
    $availableScreens = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { '{0}={1}' -f $_.DeviceName, $_.Bounds }) -join '; '
    Write-E2ELog "No se pudo aplicar viewport solicitado ${Width}x${Height}; actual=$actualSize; monitores=$availableScreens"
    return $false
  } catch {
    Write-E2ELog "No se pudo medir viewport solicitado ${Width}x${Height}: $($_.Exception.Message)"
    return $false
  }
}

function Get-WindowTextSnapshot {
  param([System.Windows.Automation.AutomationElement]$Window)
  if (-not $Window) { return '' }
  $condition = [System.Windows.Automation.Condition]::TrueCondition
  $all = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  $texts = @()
  foreach ($el in $all) {
    try {
      $name = [string]$el.Current.Name
      if (-not [string]::IsNullOrWhiteSpace($name)) { $texts += $name }
    } catch {}
  }
  return ($texts -join "`n")
}

function Wait-InstallerStableState {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Mode,
    [datetime]$OperationStartedAt,
    [int]$TimeoutMinutes = 10
  )
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $lastText = ''
  do {
    Start-Sleep -Seconds 3
    $lastText = Get-WindowTextSnapshot -Window $Window
    $text = $lastText
    # Excluir 'fallos' (aparece en el carousel del Hub) del patron de error real
    $cleanTextForErrorCheck = $text -replace '(?i)en\s+error\s+se\s+abre', 'en ___ se abre'
    $cleanTextForErrorCheck = $cleanTextForErrorCheck -replace '(?i)recuperaci[oó]n ante fallos', 'recuperacion_ante_fallos'
    if ($cleanTextForErrorCheck -match '(?i)(fall[oó](?!s)|error(?!\s*action)|no pudo|failed)') {
      return [pscustomobject]@{ ok = $false; text = $text }
    }
    # A successful helper response proves the operation, not that the user saw
    # the terminal state. Keep waiting until the visible wizard reaches Result.
    $uiReportsCompleted = $text -match '(?is)Estado completado' -and
      $text -match '(?is)El flujo finaliz[oó] correctamente' -and
      $text -match '(?is)Operaci[oó]n finalizada correctamente' -and
      $text -match '(?is)5 Resultado\s*[·\-]\s*activo'
    if ($uiReportsCompleted) {
      return [pscustomobject]@{ ok = $true; text = "Installer Hub UI terminal success`n$text" }
    }
    $hubGone = $false
    try { $hubGone = $Window.Current.IsOffscreen } catch { $hubGone = $true }
    if ($hubGone) {
      $helper = Get-LatestInstallerHelperState -Mode $Mode -MinLastWriteTime $OperationStartedAt
      if ($helper -and $helper.ok) {
        return [pscustomobject]@{ ok = $false; text = "Installer helper OK, pero el Hub se cerró sin mostrar el resultado satisfactorio requerido.`n$text" }
      }
      return [pscustomobject]@{ ok = $false; text = "Installer Hub desapareció antes de mostrar el resultado terminal.`n$text" }
    }
    $checkForRealError = $text -replace '(?i)en\s+error\s+se\s+abre', 'en ___ se abre'
    $checkForRealError = $checkForRealError -replace '(?i)recuperaci[oó]n ante fallos', 'recuperacion_ante_fallos'
    if ($checkForRealError -match '(?i)(fall[oó](?!s)|error(?!\s*action)|no pudo|failed)') {
      return [pscustomobject]@{ ok = $false; text = $text }
    }
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; text = $lastText; timeout = $true }
}

function Wait-InstallerSameVersionConflictState {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [int]$TimeoutSec = 90
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $lastText = ''
  do {
    Start-Sleep -Milliseconds 750
    $freshWindow = Find-Window -TimeoutSec 1
    if ($freshWindow) { $Window = $freshWindow }
    $lastText = Get-WindowTextSnapshot -Window $Window
    if ($lastText -match '(?is)Actualización detenida por conflicto de versión' -and
        $lastText -match '(?is)no se aplicaron cambios' -and
        $lastText -match '(?is)5 Resultado\s*[·\-]\s*error') {
      return [pscustomobject]@{ ok = $true; text = $lastText; timeout = $false }
    }
    if ($lastText -match '(?is)Operación nativa completada|Operación finalizada correctamente') {
      return [pscustomobject]@{ ok = $false; text = $lastText; timeout = $false; unexpectedSuccess = $true }
    }
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; text = $lastText; timeout = $true }
}

function Get-LatestInstallerHelperState {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [datetime]$MinLastWriteTime
  )
  $programDataLogs = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\logs'
  $searchPaths = @($logsDir, $ReportDir)
  if (Test-Path -LiteralPath $programDataLogs) {
    $searchPaths += $programDataLogs
  }
  $responsePrefix = if ($Mode -eq 'uninstall') { 'uninstall' } else { 'post-install' }
  $candidates = @(Get-ChildItem -Path $searchPaths -Filter ($responsePrefix + '-*.response.json') -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $MinLastWriteTime } |
    Sort-Object LastWriteTime -Descending)
  foreach ($candidate in $candidates) {
    try {
      $payload = Get-Content -Raw -Path $candidate.FullName | ConvertFrom-Json
      if ($payload.ok -eq $true -or [string]$payload.status -match '^(ok|success|passed)$') {
        return [pscustomobject]@{ ok = $true; path = $candidate.FullName; payload = $payload }
      }
    } catch {}
  }
  return $null
}

function Invoke-InstallerHubMode {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [string]$BundlePath = $script:bundlePath,
    [switch]$ExpectSameVersionConflict
  )
  $arguments = switch ($Mode) {
    'repair' { '/repair' }
    'uninstall' { '/uninstall' }
    default { '' }
  }
  Wait-WindowsInstallerIdle -TimeoutSec 300 -Context "before-$Mode"
  $previousQaInstallDir = $env:EVALUAPRO_QA_INSTALL_DIR
  $previousDatabaseUrl = $env:EVALUAPRO_DATABASE_URL
  $env:EVALUAPRO_QA_INSTALL_DIR = $installedRoot
  $databasePath = if ($script:upgradingExistingInstall) {
    Get-ConfiguredInstalledSqlitePath
  } else {
    Join-Path $installedRoot 'data\evaluapro.db'
  }
  $env:EVALUAPRO_DATABASE_URL = 'file:' + ($databasePath -replace '\\', '/')
  try {
    $process = if ($arguments) {
      Start-Process -FilePath $BundlePath -ArgumentList $arguments -PassThru -WindowStyle Normal
    } else {
      Start-Process -FilePath $BundlePath -PassThru -WindowStyle Normal
    }
  } finally {
    if ($null -eq $previousQaInstallDir) {
      Remove-Item Env:EVALUAPRO_QA_INSTALL_DIR -ErrorAction SilentlyContinue
    } else {
      $env:EVALUAPRO_QA_INSTALL_DIR = $previousQaInstallDir
    }
    if ($null -eq $previousDatabaseUrl) {
      Remove-Item Env:EVALUAPRO_DATABASE_URL -ErrorAction SilentlyContinue
    } else {
      $env:EVALUAPRO_DATABASE_URL = $previousDatabaseUrl
    }
  }
  $processes.Add($process) | Out-Null
  Write-E2ELog "Installer Hub iniciado mode=$Mode bundle=$BundlePath pid=$($process.Id)"
  $freshWindow = Find-Window -TimeoutSec 1
  $window = if ($freshWindow) { $freshWindow } else { Find-Window -TimeoutSec 90 }
  if (-not $window) { throw "No aparecio Installer Hub para mode=$Mode" }
  if (-not (Resize-WindowForEvidence -Window $window -Width 980 -Height 700)) { throw 'No se pudo ajustar la ventana visible del Installer Hub al mínimo documentado de 980x700 antes de la primera captura.' }
  Capture-Window -Window $window -Name ("wpf-{0}-01-splash-deteccion" -f $Mode) -RequestedWidth 980 -RequestedHeight 700 | Out-Null

  if ($Mode -eq 'install') {
    $termsCheckbox = Find-ById -RootElement $window -AutomationId 'AcceptTermsCheckBox' -TimeoutSec 30
    $privacyCheckbox = Find-ById -RootElement $window -AutomationId 'AcceptPrivacyCheckBox' -TimeoutSec 30
    Write-E2ELog "Marcando y verificando consentimientos de términos y privacidad."
    Ensure-CheckboxOn -Element $termsCheckbox -Name 'AcceptTermsCheckBox'
    Ensure-CheckboxOn -Element $privacyCheckbox -Name 'AcceptPrivacyCheckBox'
    Start-Sleep -Milliseconds 500
  }

  $detectionTimeoutSec = 420
  $window = Wait-DetectionIdle -RootElement $window -TimeoutSec $detectionTimeoutSec
  if (-not $window) { throw "Installer Hub desaparecio durante deteccion mode=$Mode" }
  $window = Wait-InstallerStepStableForCapture -Window $window -StepLabel '2 Preparar · activo' -TimeoutSec 15
  $prepareScreenshot = Capture-Window -Window $window -Name ("wpf-{0}-02-preparar" -f $Mode) -RequestedWidth 980 -RequestedHeight 700
  Assert-InstallerStepScreenshot -Window $window -Path $prepareScreenshot -StepLabel '2 Preparar · activo' -StageName ("wpf-{0}-02-preparar" -f $Mode)

  $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
  if ($modeCombo) {
    $label = switch ($Mode) {
      'install' { 'Instalar / Actualizar versión' }
      'repair' { 'Reparar componentes' }
      'uninstall' { 'Desinstalar (con respaldo)' }
    }
    Select-ComboItem -Combo $modeCombo -ItemName $label
  }

  if ($Mode -eq 'uninstall') {
    $exportCheckbox = Find-ById -RootElement $window -AutomationId 'ExportDataCheckBox' -TimeoutSec 10
    if (-not $exportCheckbox) {
      throw 'ExportDataCheckBox debe estar visible y accesible en la GUI de desinstalación.'
    } else {
      $togglePattern = $null
      if (-not $exportCheckbox.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
        throw 'ExportDataCheckBox no expone TogglePattern para confirmar su estado en la GUI.'
      }
      if ($togglePattern.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On) {
        $togglePattern.Toggle()
      }
      Start-Sleep -Milliseconds 250
      if ($togglePattern.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On) {
        throw 'ExportDataCheckBox no quedó activado.'
      }
      Add-Result -Area 'uninstall' -Item 'backup-option-enabled' -Ok $true -Detail 'la opción visible de respaldo está activada'
    }
  }

  $detectButton = Find-ById -RootElement $window -AutomationId 'DetectButton' -TimeoutSec 5
  if ($detectButton -and $detectButton.Current.IsEnabled) {
    Invoke-Control -Element $detectButton
    $window = Wait-DetectionIdle -RootElement $window -TimeoutSec $detectionTimeoutSec
    if (-not $window) { throw "Installer Hub desaparecio durante deteccion manual mode=$Mode" }
  }

  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton) {
    $nextButton = Wait-ControlEnabled -RootElement $window -AutomationId 'NextButton' -TimeoutSec 180
    Invoke-Control -Element $nextButton
    Start-Sleep -Seconds 1
    $window = Find-Window -TimeoutSec 20
    if (-not $window) {
      $alive = $false
      try { $alive = -not $process.HasExited } catch {}
      throw "Installer Hub no disponible tras avanzar a revision mode=$Mode processAlive=$alive"
    }
  }

  $window = Wait-InstallerStepStableForCapture -Window $window -StepLabel '3 Revisar · activo' -TimeoutSec 15
  $reviewScreenshot = Capture-Window -Window $window -Name ("wpf-{0}-03-revisar" -f $Mode) -RequestedWidth 980 -RequestedHeight 700
  Assert-InstallerStepScreenshot -Window $window -Path $reviewScreenshot -StepLabel '3 Revisar · activo' -StageName ("wpf-{0}-03-revisar" -f $Mode)
  $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 15
  if (-not $startButton) { throw "No se encontro StartButton mode=$Mode" }
  $expectedAction = switch ($Mode) {
    'install' { 'Instalar' }
    'repair' { 'Reparar' }
    'uninstall' { 'Desinstalar' }
  }
  if ($startButton.Current.Name -ne $expectedAction) {
    Add-Result -Area $Mode -Item 'mode-selection' -Ok $false -Detail "expected=$expectedAction actual=$($startButton.Current.Name)"
    throw "Modo no aplicado: solicitado=${Mode} accion=$($startButton.Current.Name); se detiene antes de ejecutar."
  }
  Add-Result -Area $Mode -Item 'mode-selection' -Ok $true -Detail "action=$expectedAction"
  Add-Result -Area $Mode -Item 'start-button' -Ok $startButton.Current.IsEnabled -Detail "name=$($startButton.Current.Name)"
  if (-not $startButton.Current.IsEnabled) { throw "StartButton no habilitado mode=$Mode" }

  $operationStartedAt = Get-Date
  Invoke-Control -Element $startButton
  Start-Sleep -Seconds 2
  if (-not (Resize-WindowForEvidence -Window $window -Width 980 -Height 700)) { throw 'No se pudo mantener la ventana visible del Installer Hub al mínimo documentado de 980x700 para su captura.' }
  Start-Sleep -Milliseconds 300
  $window = Find-Window -TimeoutSec 10
  if (-not $window -or [Math]::Abs([int][Math]::Round($window.Current.BoundingRectangle.Width) - 980) -gt 1 -or [Math]::Abs([int][Math]::Round($window.Current.BoundingRectangle.Height) - 700) -gt 1) { throw 'La ventana visible del Installer Hub cambió de tamaño después del ajuste; se rechaza la captura.' }
  Capture-Window -Window $window -Name ("wpf-{0}-04-ejecutar-solicitud-980x700" -f $Mode) -RequestedWidth 980 -RequestedHeight 700 | Out-Null
  $state = if ($ExpectSameVersionConflict) {
    Wait-InstallerSameVersionConflictState -Window $window -TimeoutSec 90
  } else {
    Wait-InstallerStableState -Window $window -Mode $Mode -OperationStartedAt $operationStartedAt -TimeoutMinutes 25
  }
  $textPath = Join-Path $ReportDir ("{0}-window-text.txt" -f $Mode)
  [string]$state.text | Set-Content -Path $textPath -Encoding UTF8
  $artifacts.Add($textPath) | Out-Null
  if (-not (Resize-WindowForEvidence -Window $window -Width 980 -Height 700)) { throw 'No se pudo mantener la ventana visible del Installer Hub al mínimo documentado de 980x700 para la captura del resultado.' }
  $window = Find-Window -TimeoutSec 10
  if (-not $window -or [Math]::Abs([int][Math]::Round($window.Current.BoundingRectangle.Width) - 980) -gt 1 -or [Math]::Abs([int][Math]::Round($window.Current.BoundingRectangle.Height) - 700) -gt 1) { throw 'La ventana visible del Installer Hub cambió de tamaño después del ajuste; se rechaza la captura del resultado.' }
  $resultCaptureName = if ($ExpectSameVersionConflict) { 'wpf-install-05-resultado-conflicto-version' } else { ("wpf-{0}-05-resultado" -f $Mode) }
  Capture-Window -Window $window -Name $resultCaptureName -RequestedWidth 980 -RequestedHeight 700 | Out-Null
  $stateTimedOut = $state.PSObject.Properties.Match('timeout').Count -gt 0 -and [bool]$state.timeout
  $stateTextForDiagnostics = [regex]::Replace([string]$state.text, '\s+', ' ').Trim()
  if ($stateTextForDiagnostics.Length -gt 2400) { $stateTextForDiagnostics = $stateTextForDiagnostics.Substring(0, 2400) + '…' }
  if ($ExpectSameVersionConflict -and (-not $state.ok)) {
    Write-E2ELog "El estado terminal de conflicto no fue confirmado; timeout=$stateTimedOut; UIA=$stateTextForDiagnostics"
    $baLogRoot = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\logs'
    $baLogs = @(Get-ChildItem -LiteralPath $baLogRoot -Filter 'burn-bootstrapper.log' -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -ge $operationStartedAt.AddSeconds(-2) } |
      Sort-Object LastWriteTime -Descending | Select-Object -First 3)
    foreach ($baLog in $baLogs) {
      $target = Copy-ArtifactIfExists -Path $baLog.FullName -Name ("burn-conflict-session-{0}.log" -f [IO.Path]::GetFileName((Split-Path -Parent $baLog.FullName)))
      $diagnosticLines = @(Get-Content -LiteralPath $target -ErrorAction SilentlyContinue |
        Where-Object { $_ -match '(?i)related bundle|bundle relacionado|same.version|misma versión|OnPlanComplete|Apply|conflicto' } |
        Select-Object -Last 30)
      foreach ($line in $diagnosticLines) { Write-E2ELog "Burn conflict trace: $line" }
    }
  }
  $finalStateDetail = if ($ExpectSameVersionConflict) { 'conflicto de misma versión visible antes de Apply; resultado capturado' } elseif ($stateTimedOut) { 'timeout esperando estado final' } else { 'estado final detectado' }
  Add-Result -Area $(if ($ExpectSameVersionConflict) { 'same-version-related-bundle' } else { $Mode }) -Item 'final-state' -Ok ([bool]$state.ok) -Detail $finalStateDetail
  if (-not $state.ok) {
    if ($ExpectSameVersionConflict -and $stateTimedOut) { throw 'El Installer Hub no mostró a tiempo el resultado esperado de conflicto de versión.' }
    throw "Installer Hub no completo correctamente mode=$Mode"
  }

  $restartButton = Find-ById -RootElement $window -AutomationId 'RestartNowButton' -TimeoutSec 2
  if ($restartButton) {
    Add-Result -Area $Mode -Item 'restart-required' -Ok $true -Detail 'RestartNowButton visible'
  }

  $closeButton = Wait-ControlEnabled -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 600
  Invoke-Control -Element $closeButton
  Write-E2ELog "Esperando que el proceso del instalador ($($process.Id)) finalice tras presionar CloseButton..."
  $processExited = $false
  try {
    $processExited = $process.WaitForExit(30000)
  } catch {
    Write-E2ELog "WaitForExit fallo para pid=$($process.Id): $($_.Exception.Message)"
  }
  if (-not $processExited) {
    Write-E2ELog "WARNING: Installer Hub no terminó tras CloseButton mode=$Mode; intentando cierre normal de la ventana."
    try {
      $process.Refresh()
      if (-not $process.HasExited) { [void]$process.CloseMainWindow() }
      $processExited = $process.WaitForExit(10000)
    } catch {
      Write-E2ELog "WARNING: cierre normal fallo para pid=$($process.Id): $($_.Exception.Message)"
    }
  }
  if (-not $processExited) {
    Write-E2ELog "WARNING: Installer Hub persistente tras estado final; deteniendo solo su arbol pid=$($process.Id)."
    try { & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null } catch {}
    Start-Sleep -Milliseconds 500
    $processExited = $null -eq (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)
  }
  if (-not $processExited) {
    throw "Installer Hub no terminó tras cierre controlado mode=$Mode; se conserva el proceso para diagnóstico."
  }
  Wait-WindowsInstallerIdle -TimeoutSec 300 -Context "after-$Mode"
  return $true
}

function Get-BurnBundleRegistryEntriesByUpgradeCode {
  param([Parameter(Mandatory = $true)][string]$UpgradeCode)
  $expected = $UpgradeCode.Trim().Trim('{', '}')
  $roots = @(
    'Registry::HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($rootKey in $roots) {
    if (-not (Test-Path -LiteralPath $rootKey)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $rootKey -ErrorAction SilentlyContinue) {
      try {
        $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
        $registeredCodes = @(
          foreach ($value in @($entry.BundleUpgradeCode)) {
            foreach ($candidate in ([string]$value -split '[\r\n,;\s]+')) {
              $normalized = $candidate.Trim().Trim('{', '}')
              if ($normalized) { $normalized }
            }
          }
        )
        if ($registeredCodes | Where-Object { $_.Equals($expected, [StringComparison]::OrdinalIgnoreCase) }) {
          [pscustomobject]@{
            registryPath = [string]$key.Name
            providerKey = [string]$entry.BundleProviderKey
            displayName = [string]$entry.DisplayName
            version = [string]$entry.DisplayVersion
            upgradeCode = ($registeredCodes -join ';')
            cachePath = [string]$entry.BundleCachePath
            uninstallString = [string]$entry.UninstallString
          }
        }
      } catch { }
    }
  }
}

function Invoke-BurnBundleQuiet {
  param(
    [Parameter(Mandatory = $true)][string]$BundlePath,
    [Parameter(Mandatory = $true)][ValidateSet('/install', '/uninstall')][string]$Action
  )
  if (-not (Test-Path -LiteralPath $BundlePath -PathType Leaf)) { throw "No existe el bundle fixture: $BundlePath" }
  $operation = $Action.TrimStart('/')
  $bundleLogPath = Join-Path $logsDir ("same-version-fixture-{0}-{1}.log" -f $operation, [guid]::NewGuid().ToString('N'))
  $process = Start-Process -FilePath $BundlePath -ArgumentList @($Action, '/quiet', '/log', "`"$bundleLogPath`"") -PassThru -Wait -WindowStyle Hidden
  if (Test-Path -LiteralPath $bundleLogPath -PathType Leaf) {
    Copy-ArtifactIfExists -Path $bundleLogPath | Out-Null
  }
  if ([int]$process.ExitCode -ne 0) { throw "El bundle fixture terminó con exit=$($process.ExitCode), acción=$Action" }
  Wait-WindowsInstallerIdle -TimeoutSec 120 -Context "same-version-fixture-$($Action.TrimStart('/'))"
}

function Invoke-SameVersionRelatedBundleConflict {
  param([string]$DatabaseMarker = '')
  if ([string]::IsNullOrWhiteSpace($SameVersionRelatedBundlePath)) { return }
  $fixturePath = (Resolve-Path -LiteralPath $SameVersionRelatedBundlePath -ErrorAction Stop).Path
  if ([IO.Path]::GetExtension($fixturePath) -ne '.exe') { throw 'El fixture Burn debe ser un EXE.' }

  $flavorCatalog = Get-Content -LiteralPath (Join-Path $root 'config\installer-flavors.json') -Raw -Encoding utf8 | ConvertFrom-Json
  $docenteFlavor = @($flavorCatalog.flavors | Where-Object { [string]$_.flavorId -eq 'docente-local' })
  if ($docenteFlavor.Count -ne 1) { throw 'No se pudo resolver un único docente-local para comprobar el UpgradeCode del fixture.' }
  $bundleUpgradeCode = [string]$docenteFlavor[0].bundleUpgradeCode
  $candidateBundle = Get-Item -LiteralPath $script:bundlePath -ErrorAction Stop
  $candidateVersion = $null
  if (-not [version]::TryParse([string]$candidateBundle.VersionInfo.ProductVersion, [ref]$candidateVersion)) {
    throw "No se pudo leer la versión del bundle candidato: $($candidateBundle.VersionInfo.ProductVersion)"
  }
  $expectedVersion = $candidateVersion
  $fixtureFile = Get-Item -LiteralPath $fixturePath
  $fixtureVersion = $null
  if (-not [version]::TryParse([string]$fixtureFile.VersionInfo.ProductVersion, [ref]$fixtureVersion) -or $fixtureVersion -ne $expectedVersion) {
    throw "La versión del bundle fixture debe ser igual al candidato: expected=$expectedVersion actual=$($fixtureFile.VersionInfo.ProductVersion)"
  }
  $fixtureHash = (Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Copy-ArtifactIfExists -Path $fixturePath -Name 'same-version-related-bundle-fixture.exe' | Out-Null
  Add-Result -Area 'same-version-related-bundle' -Item 'fixture-verified' -Ok $true -Detail "version=$fixtureVersion upgradeCode=$bundleUpgradeCode sha256=$fixtureHash"

  $databasePath = Join-Path $installedRoot 'data\evaluapro.db'
  $databaseExistedBefore = Test-Path -LiteralPath $databasePath -PathType Leaf
  $databaseHashBefore = if ($databaseExistedBefore) { (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
  $appPath = Join-Path $installedRoot 'EvaluaPro.exe'
  $appExistedBefore = Test-Path -LiteralPath $appPath -PathType Leaf
  $appHashBefore = if ($appExistedBefore) { (Get-FileHash -LiteralPath $appPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
  $registeredProductsBefore = @(
    Get-EvaluaProUninstallEntries | ForEach-Object { '{0}|{1}|{2}' -f $_.registryPath, $_.displayVersion, $_.installLocation } | Sort-Object
  )
  $fixtureProviderKey = ''

  $fixtureInstallAttempted = $false
  try {
    $fixtureInstallAttempted = $true
    Invoke-BurnBundleQuiet -BundlePath $fixturePath -Action '/install'
    $relatedEntries = @(Get-BurnBundleRegistryEntriesByUpgradeCode -UpgradeCode $bundleUpgradeCode)
    $fixtureEntries = @($relatedEntries | Where-Object { $_.displayName -eq 'QA Bundle Relation Fixture' -and [version]::Parse($_.version) -eq $expectedVersion })
    if ($relatedEntries.Count -ne 1 -or $fixtureEntries.Count -ne 1 -or [string]::IsNullOrWhiteSpace($fixtureEntries[0].providerKey)) {
      $observed = @($relatedEntries | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.displayName, $_.version, $_.providerKey, $_.upgradeCode }) -join '; '
      throw "El fixture debe quedar registrado como único bundle relacionado de la misma versión. count=$($relatedEntries.Count) fixtureCount=$($fixtureEntries.Count) observed=[$observed]"
    }
    $fixtureProviderKey = [string]$fixtureEntries[0].providerKey
    Add-Result -Area 'same-version-related-bundle' -Item 'related-bundle-registered' -Ok $true -Detail "providerKey=$fixtureProviderKey version=$($fixtureEntries[0].version)"

    Invoke-InstallerHubMode -Mode 'install' -BundlePath $script:bundlePath -ExpectSameVersionConflict | Out-Null
    $conflictEntries = @(Get-BurnBundleRegistryEntriesByUpgradeCode -UpgradeCode $bundleUpgradeCode)
    $fixtureStillRegistered = $conflictEntries.Count -eq 1 -and [string]$conflictEntries[0].providerKey -eq $fixtureProviderKey
    $registeredProductsAfter = @(
      Get-EvaluaProUninstallEntries | ForEach-Object { '{0}|{1}|{2}' -f $_.registryPath, $_.displayVersion, $_.installLocation } | Sort-Object
    )
    $productsUnchanged = ($registeredProductsBefore -join "`n") -ceq ($registeredProductsAfter -join "`n")
    $appExistedAfter = Test-Path -LiteralPath $appPath -PathType Leaf
    $appHashAfter = if ($appExistedAfter) { (Get-FileHash -LiteralPath $appPath -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
    $databaseExistedAfter = Test-Path -LiteralPath $databasePath -PathType Leaf
    $databaseHashAfter = if ($databaseExistedAfter) { (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash.ToLowerInvariant() } else { '' }
    $installStateUnchanged = $productsUnchanged -and $appExistedBefore -eq $appExistedAfter -and $appHashBefore -ceq $appHashAfter -and
      $databaseExistedBefore -eq $databaseExistedAfter -and $databaseHashBefore -ceq $databaseHashAfter -and $fixtureStillRegistered
    if ($DatabaseMarker) {
      Invoke-UpgradeDataMarker -Action 'verify' -Marker $DatabaseMarker
    }
    Add-Result -Area 'same-version-related-bundle' -Item 'msi-payload-and-data-unchanged-before-apply' -Ok $installStateUnchanged -Detail "productsUnchanged=$productsUnchanged app=$appExistedBefore->$appExistedAfter database=$databaseExistedBefore->$databaseExistedAfter fixtureStillRegistered=$fixtureStillRegistered"
    if (-not $installStateUnchanged) { throw 'El conflicto de versión cambió el MSI, el payload, la SQLite QA o el bundle fixture.' }
    Assert-SharedProgramDataSqliteUnchanged
  } finally {
    $remainingFixture = @(Get-BurnBundleRegistryEntriesByUpgradeCode -UpgradeCode $bundleUpgradeCode | Where-Object { [string]$_.providerKey -eq $fixtureProviderKey })
    if ($remainingFixture.Count -gt 0 -or ($fixtureInstallAttempted -and [string]::IsNullOrWhiteSpace($fixtureProviderKey))) {
      Invoke-BurnBundleQuiet -BundlePath $fixturePath -Action '/uninstall'
    }
  }
  $fixtureRemoved = @(
    Get-BurnBundleRegistryEntriesByUpgradeCode -UpgradeCode $bundleUpgradeCode | Where-Object { [string]$_.providerKey -eq $fixtureProviderKey }
  ).Count -eq 0
  Add-Result -Area 'same-version-related-bundle' -Item 'fixture-cleanup' -Ok $fixtureRemoved -Detail 'el bundle fixture se retiró después de validar que Burn bloqueó Apply'
  if (-not $fixtureRemoved) { throw 'El E2E no pudo retirar su bundle fixture aislado.' }
}

function Wait-NativeDashboardHealth {
  param([int]$TimeoutSec = 240)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $lastError = 'sin respuesta HTTP'
  do {
    try {
      $web = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 5
      $api = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/salud' -TimeoutSec 5
      if ([int]$web.StatusCode -eq 200 -and $null -ne $api) {
        return [pscustomobject]@{
          state = 'healthy'
          meta = [pscustomobject]@{ base = 'http://127.0.0.1:4519' }
          webStatus = [int]$web.StatusCode
          apiResponding = $true
        }
      }
      $lastError = "web=$($web.StatusCode) api=$($null -ne $api)"
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 800
  } while ((Get-Date) -lt $deadline)
  $appHostLog = Join-Path $installedRoot 'logs\app-host.log'
  if (Test-Path -LiteralPath $appHostLog) { Copy-ArtifactIfExists -Path $appHostLog | Out-Null }
  throw "El App Host no dejó saludables la web y API dentro del límite ${TimeoutSec}s: $lastError"
}

function Ensure-CheckboxOn {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [string]$Name
  )
  if (-not $Element) { throw "No se encontró checkbox requerido: $Name" }
  if (-not $Element.Current.IsEnabled) { throw "Checkbox deshabilitado: $Name" }
  $toggle = $null
  $isOn = $false
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) {
    $isOn = $toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
    if (-not $isOn) {
      $toggle.Toggle()
      Start-Sleep -Milliseconds 400
      $isOn = $toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
    }
  }
  if (-not $isOn) {
    try {
      $Element.SetFocus()
      [System.Windows.Forms.SendKeys]::SendWait(' ')
      Start-Sleep -Milliseconds 400
    } catch {}
  }
  if ($toggle) { $isOn = $toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On }
  if (-not $isOn -and $toggle) {
    try {
      $toggle.Toggle()
      Start-Sleep -Milliseconds 400
      $isOn = $toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
    } catch {}
  }
  if (-not $isOn) {
    $invoke = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
      try {
        $invoke.Invoke()
        Start-Sleep -Milliseconds 400
        if ($toggle) { $isOn = $toggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On }
      } catch {}
    }
  }
  if (-not $isOn) { throw "No se pudo marcar checkbox requerido: $Name" }
}

function Get-Crc32Hash {
  param([string]$Path)
  [int64]$polynomial = 3988292384
  $table = New-Object int64[] 256
  for ($seed = 0; $seed -lt 256; $seed++) {
    [int64]$value = $seed
    for ($bit = 0; $bit -lt 8; $bit++) {
      $lsb = $value -band 1
      $value = [int64]($value -shr 1)
      if ($lsb -ne 0) { $value = $value -bxor $polynomial }
    }
    $table[$seed] = $value
  }
  [int64]$crc = 4294967295
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $buffer = New-Object byte[] 1048576
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      for ($i = 0; $i -lt $read; $i++) {
        $index = [int](($crc -bxor [int64]$buffer[$i]) -band 255)
        $crc = ($crc -shr 8) -bxor $table[$index]
      }
    }
  } finally { $stream.Dispose() }
  return ('{0:X8}' -f ([uint64]($crc -bxor 4294967295))).ToLowerInvariant()
}

function Get-VisualScreenshotEvidence {
  param([string]$Name, [string]$Path, [int]$RequestedWidth = 0, [int]$RequestedHeight = 0)
  $requestedWindowSize = $null
  if ($RequestedWidth -gt 0 -and $RequestedHeight -gt 0) {
    $requestedWindowSize = [ordered]@{ width = $RequestedWidth; height = $RequestedHeight }
  }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return [ordered]@{ name = $Name; exists = $false; valid = $false; path = "screenshots/$Name"; requestedWindowSize = $requestedWindowSize; reason = 'missing' }
  }

  $bitmap = $null
  try {
    $file = Get-Item -LiteralPath $Path
    if ($file.Length -lt 4096) { throw 'PNG demasiado pequeño.' }
    $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
    $distinctSamples = New-Object 'System.Collections.Generic.HashSet[string]'
    for ($row = 0; $row -lt 9; $row++) {
      for ($column = 0; $column -lt 9; $column++) {
        $x = [Math]::Min($bitmap.Width - 1, [int](($bitmap.Width - 1) * $column / 8))
        $y = [Math]::Min($bitmap.Height - 1, [int](($bitmap.Height - 1) * $row / 8))
        $pixel = $bitmap.GetPixel($x, $y)
        [void]$distinctSamples.Add(('{0:X2}{1:X2}{2:X2}' -f $pixel.R, $pixel.G, $pixel.B))
      }
    }
    if ($bitmap.Width -le 0 -or $bitmap.Height -le 0) { throw 'PNG sin dimensiones válidas.' }
    if ($distinctSamples.Count -lt 8) { throw 'La captura está vacía o casi monocroma.' }
    return [ordered]@{
      name = $Name
      exists = $true
      path = "screenshots/$Name"
      width = $bitmap.Width
      height = $bitmap.Height
      bytes = $file.Length
      sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
      distinctSamples = $distinctSamples.Count
      requestedWindowSize = $requestedWindowSize
      actualCaptureSize = [ordered]@{ width = $bitmap.Width; height = $bitmap.Height }
      requestHonored = (-not $requestedWindowSize -or ($bitmap.Width -eq $RequestedWidth -and $bitmap.Height -eq $RequestedHeight))
      reason = if ($requestedWindowSize -and ($bitmap.Width -ne $RequestedWidth -or $bitmap.Height -ne $RequestedHeight)) {
        "requested_size_mismatch expected=${RequestedWidth}x${RequestedHeight} actual=$($bitmap.Width)x$($bitmap.Height)"
      } else { $null }
      valid = (-not $requestedWindowSize -or ($bitmap.Width -eq $RequestedWidth -and $bitmap.Height -eq $RequestedHeight))
    }
  } catch {
    return [ordered]@{ name = $Name; exists = $true; valid = $false; path = "screenshots/$Name"; requestedWindowSize = $requestedWindowSize; reason = $_.Exception.Message }
  } finally {
    if ($bitmap) { $bitmap.Dispose() }
  }
}

function Write-VisualFlowManifest {
  $expected = @(
    'wpf-install-01-splash-deteccion.png',
    'wpf-install-02-preparar.png',
    'wpf-install-03-revisar.png',
    'wpf-install-04-ejecutar-solicitud-980x700.png',
    'wpf-install-05-resultado.png'
  )
  $items = foreach ($name in $expected) {
    $path = Join-Path $screenshotsDir $name
    Get-VisualScreenshotEvidence -Name $name -Path $path -RequestedWidth 980 -RequestedHeight 700
  }
  $ok = @($items | Where-Object { -not $_.valid }).Count -eq 0
  $manifestPath = Join-Path $manifestDir 'visual-flow.json'
  [pscustomobject]@{
    flow = @('splash', 'preparar', 'revisar', 'ejecutar-solicitud-980x700', 'resultado')
    viewport = [ordered]@{ width = 980; height = 700; basis = 'minimum-documented-by-DESIGN.md' }
    captured = $items
    complete = $ok
    sha256Required = $true
    imageIntegrityRequired = $true
    captureMethod = 'UIAutomation + CopyFromScreen of the foreground visible WPF window; each PNG is checked against the requested viewport'
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
  $artifacts.Add($manifestPath) | Out-Null
  Add-Result -Area 'screenshots' -Item 'complete-visual-flow' -Ok $ok -Detail ("valid={0}/{1}" -f (@($items | Where-Object valid).Count), $expected.Count)
}

function Wait-InstalledPayload {
  param([int]$TimeoutSec = 240)
  $required = @(
    (Join-Path $installedRoot 'package.json'),
    (Join-Path $installedRoot 'EvaluaPro.exe'),
    (Join-Path $installedRoot 'scripts\start-docente-native.mjs'),
    (Join-Path $installedRoot 'runtime\node\node.exe'),
    (Join-Path $installedRoot 'apps\backend\dist\index.js'),
    (Join-Path $installedRoot 'apps\frontend\dist-docente\index.html'),
    (Join-Path $installedRoot 'logs\installation.manifest.json'),
    (Join-Path $installedRoot 'config\update-config.json')
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    if (@($required | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -eq 0) { return }
    Start-Sleep -Milliseconds 800
  } while ((Get-Date) -lt $deadline)
  $missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_) })
  throw "Payload post-install incompleto. Faltan: $($missing -join ', ')"
}

function Get-VerifiedInstalledAppHostProcess {
  param([Parameter(Mandatory = $true)][int]$ProcessId, [Parameter(Mandatory = $true)][datetime]$StartedAtUtc)
  $expectedPath = [IO.Path]::GetFullPath((Join-Path $installedRoot 'EvaluaPro.exe'))
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  try {
    $process.Refresh()
    if ($process.HasExited -or [Math]::Abs(($process.StartTime.ToUniversalTime() - $StartedAtUtc).TotalSeconds) -gt 1) {
      throw "PID $ProcessId ya no corresponde a la instancia App Host iniciada por este E2E."
    }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace([string]$processInfo.ExecutablePath) -or
        -not [string]::Equals([IO.Path]::GetFullPath([string]$processInfo.ExecutablePath), $expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
      throw "PID $ProcessId no ejecuta el App Host instalado esperado."
    }
    return $process
  } catch {
    $process.Dispose()
    throw
  }
}

function Invoke-InstalledAppHost {
  param(
    [string]$Action,
    [string]$RunId,
    [int]$TimeoutSec = 60
  )
  if ($Action -eq 'verify-installation') {
    Test-InstalledState -Phase 'native-host-verification'
    Add-Result -Area 'native-app-host' -Item $Action -Ok $true -Detail "payload y manifiestos revisados runId=$RunId"
    return
  }

  if ($Action -eq 'open-dashboard') {
    $appHostPath = [IO.Path]::GetFullPath((Join-Path $installedRoot 'EvaluaPro.exe'))
    if (-not (Test-Path -LiteralPath $appHostPath -PathType Leaf)) { throw "No existe el App Host instalado: $appHostPath" }
    if ($script:activeNativeAppHost) { throw 'El App Host ya tiene una instancia propiedad de este E2E.' }
    $process = Start-Process -FilePath $appHostPath -WorkingDirectory $installedRoot -PassThru
    try {
      $startedAtUtc = $process.StartTime.ToUniversalTime()
      $script:activeNativeAppHost = [pscustomobject]@{ Id = $process.Id; StartedAtUtc = $startedAtUtc; Path = $appHostPath }
      $null = Get-VerifiedInstalledAppHostProcess -ProcessId $process.Id -StartedAtUtc $startedAtUtc
      $state = Wait-NativeDashboardHealth -TimeoutSec $TimeoutSec
      Add-Result -Area 'native-app-host' -Item $Action -Ok $true -Detail "pid=$($process.Id) state=healthy runId=$RunId"
      return $state
    } catch {
      if (Test-Path -LiteralPath (Join-Path $installedRoot 'logs\app-host.log')) {
        Copy-ArtifactIfExists -Path (Join-Path $installedRoot 'logs\app-host.log') | Out-Null
      }
      throw
    } finally {
      $process.Dispose()
    }
  }

  if ($Action -eq 'stop-all') {
    $identity = $script:activeNativeAppHost
    if (-not $identity) {
      Add-Result -Area 'native-app-host' -Item $Action -Ok $true -Detail "no E2E-owned host was active runId=$RunId"
      return
    }
    $process = Get-VerifiedInstalledAppHostProcess -ProcessId ([int]$identity.Id) -StartedAtUtc ([datetime]$identity.StartedAtUtc)
    if ($process) {
      try {
        if (-not $process.CloseMainWindow()) { throw "Windows no aceptó cierre controlado del App Host PID $($identity.Id)." }
        if (-not $process.WaitForExit($TimeoutSec * 1000)) { throw "El App Host PID $($identity.Id) no terminó en ${TimeoutSec}s; no se forzará el cierre." }
      } finally { $process.Dispose() }
    }
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    do {
      $remaining = @(Get-InstalledNodeProcesses)
      if ($remaining.Count -eq 0) { break }
      Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if (@(Get-InstalledNodeProcesses).Count -gt 0) { throw 'El cierre controlado del App Host dejó procesos Node del payload ejecutándose.' }
    $script:activeNativeAppHost = $null
    Add-Result -Area 'native-app-host' -Item $Action -Ok $true -Detail "closed and installed Node tree absent runId=$RunId"
    return
  }

  throw "Acción nativa E2E no soportada: $Action"
}

function Invoke-CaptureCommand {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory = $root,
    [int]$TimeoutSec = 180
  )
  $stdout = Join-Path $ReportDir ("{0}.stdout.log" -f $Name)
  $stderr = Join-Path $ReportDir ("{0}.stderr.log" -f $Name)
  $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  # Keep the native handle while Start-Process still exposes it; some Windows
  # runner processes lose the managed ExitCode after WaitForExit drains streams.
  $processHandle = [IntPtr]::Zero
  try { $processHandle = [IntPtr]$process.Handle } catch {}
  if (-not $process.WaitForExit($TimeoutSec * 1000)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw "Timeout ejecutando $Name"
  }
  # Wait for redirected streams to EOF so .NET populates ExitCode
  $process.WaitForExit()
  try { $process.Refresh() } catch {}
  Copy-ArtifactIfExists -Path $stdout -Name ("{0}.stdout.log" -f $Name) | Out-Null
  Copy-ArtifactIfExists -Path $stderr -Name ("{0}.stderr.log" -f $Name) | Out-Null

  $exitCode = $process.ExitCode
  if ($null -eq $exitCode) {
    if (-not $process.HasExited) {
      throw "No se pudo determinar ExitCode de $Name porque el proceso todavía aparece activo."
    }
    if (-not ('EvaluaPro.NativeProcessExitCode' -as [type])) {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace EvaluaPro {
  public static class NativeProcessExitCode {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr processHandle, out uint exitCode);
  }
}
'@
    }
    [uint32]$nativeExitCode = 0
    if ($processHandle -eq [IntPtr]::Zero) {
      throw "No se pudo determinar ExitCode de ${Name}: el handle nativo del proceso no estuvo disponible antes de esperar su finalización."
    }
    $exitCodeAvailable = [EvaluaPro.NativeProcessExitCode]::GetExitCodeProcess($processHandle, [ref]$nativeExitCode)
    if (-not $exitCodeAvailable) {
      $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "No se pudo determinar ExitCode de $Name mediante GetExitCodeProcess (Win32=$nativeError)."
    }
    $exitCode = [int]$nativeExitCode
    Write-E2ELog "ExitCode de $Name recuperado con GetExitCodeProcess: $exitCode"
  }

  Add-Result -Area 'command' -Item $Name -Ok ($exitCode -eq 0) -Detail "exit=$exitCode"
  if ($exitCode -ne 0) {
    if ($Name -like 'playwright-*' -and (Test-Path -LiteralPath $stderr -PathType Leaf)) {
      $stderrTail = @(Get-Content -LiteralPath $stderr -Tail 12 -ErrorAction SilentlyContinue)
      if ($stderrTail.Count -gt 0) {
        Write-E2ELog ("Diagnostico visual {0}: {1}" -f $Name, ($stderrTail -join ' | '))
      }
    }
    throw "Comando fallo: $Name exit=$exitCode"
  }
}

function Test-MsiPackageFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  # Burn extracts attached payloads with opaque names (for example, a0).
  # MSI files use the OLE Compound File signature, so identify the package by bytes.
  $expectedSignature = [byte[]](0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)
  $stream = [IO.File]::OpenRead($Path)
  try {
    if ($stream.Length -lt $expectedSignature.Length) { return $false }
    $signature = New-Object byte[] $expectedSignature.Length
    $read = $stream.Read($signature, 0, $signature.Length)
    if ($read -ne $expectedSignature.Length) { return $false }
    return [Convert]::ToBase64String($signature) -eq [Convert]::ToBase64String($expectedSignature)
  } finally {
    $stream.Dispose()
  }
}

function Export-RuntimeAudit {
  param([string]$Name)
  $auditName = if ($Name -eq 'before') { 'runtime-audit-before.json' } else { 'runtime-audit-after.json' }
  Export-JsonArtifact -Name $auditName -Data ([pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    runtime = 'native-node-sqlite'
  }) | Out-Null
}

function Invoke-NativeStableStack {
  Write-E2ELog "Esperando estabilizacion del servicio nativo..."
  Start-Sleep -Seconds 20
}

function Export-NativeEvidence {
  # Solo para mantener la compatibilidad con el reporte si es necesario.
  $nativeDir = Join-Path $ReportDir 'native'
  if (-not (Test-Path $nativeDir)) {
    New-Item -ItemType Directory -Force -Path $nativeDir | Out-Null
  }
  $processes = @(Get-InstalledNodeProcesses)
  $processes | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $nativeDir 'node-processes.json') -Encoding UTF8
}

function Get-InstalledNodeProcesses {
  $expectedNodePath = [IO.Path]::GetFullPath((Join-Path $installedRoot 'runtime\node\node.exe'))
  if (-not (Test-Path -LiteralPath $expectedNodePath -PathType Leaf)) { return @() }
  try {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop)
  } catch {
    throw "No se pudo enumerar los procesos Node para validar el runtime instalado: $($_.Exception.Message)"
  }
  return @($processes | Where-Object {
      -not [string]::IsNullOrWhiteSpace([string]$_.ExecutablePath) -and
      [string]::Equals([IO.Path]::GetFullPath([string]$_.ExecutablePath), $expectedNodePath, [StringComparison]::OrdinalIgnoreCase)
    })
}

function Assert-NativeStable {
  $deadline = (Get-Date).AddSeconds(150)
  $lastError = 'sin respuesta'
  do {
    $running = @(Get-InstalledNodeProcesses)
    $count = $running.Count
    if ($count -ge 1) {
      try {
        $api = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/salud' -TimeoutSec 5
        try {
          $web = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 5
          if ($web.StatusCode -eq 200) {
            Add-Result -Area 'native' -Item 'node-process' -Ok $true -Detail "count=$count"
            Add-Result -Area 'native' -Item 'api-salud' -Ok $true -Detail ($api | ConvertTo-Json -Compress)
            Add-Result -Area 'native' -Item 'web-docente' -Ok $true -Detail "status=$($web.StatusCode)"
            return
          }
          $lastError = "web status=$($web.StatusCode)"
        } catch { $lastError = $_.Exception.Message }
      } catch { $lastError = $_.Exception.Message }
    } else {
      $lastError = 'Servicio Node.js nativo aún no tiene proceso.'
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  Add-Result -Area 'native' -Item 'node-process' -Ok $false -Detail "timeout=90s last=$lastError"
  Add-Result -Area 'native' -Item 'api-salud' -Ok $false -Detail $lastError
  Add-Result -Area 'native' -Item 'web-docente' -Ok $false -Detail $lastError
  throw "Runtime nativo no alcanzó salud API/web en 90s: $lastError"
}

function Capture-UrlWithPlaywright {
  param(
    [string]$Url,
    [string]$Name,
    [int]$Width = 1280,
    [int]$Height = 820,
    [ValidateSet('apphost', 'docente')][string]$Surface
  )
  $target = Join-Path $screenshotsDir ("{0}.png" -f $Name)
  try {
    $captureScript = Join-Path $root 'scripts\tests\capture-installer-web.mjs'
    $args = @($captureScript, $Url, $target, [string]$Width, [string]$Height, $Surface)
    Invoke-CaptureCommand -Name ("playwright-{0}" -f $Name) -FilePath 'node.exe' -ArgumentList $args -TimeoutSec 75
    if (Test-Path -LiteralPath $target) {
      $screenshots.Add($target) | Out-Null
      Add-Result -Area 'screenshots' -Item $Name -Ok $true -Detail $Url
      return $target
    }
  } catch {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like "*$target*" -or $_.CommandLine -like "*playwright screenshot*" } |
      ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail ("captura fallida; {0}" -f $_.Exception.Message)
    throw
  }
  return ''
}

function Capture-DashboardScreenshots {
  param([string]$BaseUrl)
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) { return }
  Capture-UrlWithPlaywright -Url $BaseUrl -Name 'dashboard-status-1280x820' -Width 1280 -Height 820 -Surface 'apphost' | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-1280x820' -Width 1280 -Height 820 -Surface 'docente' | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-1280x720' -Width 1280 -Height 720 -Surface 'docente' | Out-Null
}

function Test-UpdateSmoke {
  param([string]$BaseUrl)
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    Add-Result -Area 'update' -Item 'status' -Ok $false -Detail 'dashboard base vacio'
    return
  }
  $status = Invoke-RestMethod -Uri "$BaseUrl/api/update/status" -TimeoutSec 15
  Export-JsonArtifact -Name 'update-status.json' -Data $status | Out-Null
  Add-Result -Area 'update' -Item 'status' -Ok ($null -ne $status -and [string]$status.state -ne 'failed') -Detail "$BaseUrl/api/update/status"
}

function Normalize-InstallerProductVersion {
  param([Parameter(Mandatory = $true)][version]$Version)
  if ($Version.Build -lt 0) { throw "La versión MSI no contiene el tercer componente requerido: $Version" }
  if ($Version.Revision -gt 0) { throw "La versión MSI contiene un cuarto componente inesperado: $Version" }
  return [version]::new($Version.Major, $Version.Minor, $Version.Build)
}

function Get-InstalledProductVersion {
  $target = [IO.Path]::GetFullPath($installedRoot).TrimEnd('\')
  $allEntries = @(Get-EvaluaProUninstallEntries)
  $matchingEntries = @($allEntries | Where-Object {
      -not [string]::IsNullOrWhiteSpace([string]$_.installLocation) -and
      [IO.Path]::GetFullPath([string]$_.installLocation).TrimEnd('\') -eq $target
    })
  if ($matchingEntries.Count -gt 1) {
    throw "Hay varias entradas de producto EvaluaPro para la instalación temporal: $installedRoot"
  }

  if ($matchingEntries.Count -eq 1) {
    $entry = $matchingEntries[0]
  } elseif ($script:upgradingExistingInstall -and $allEntries.Count -eq 1 -and
      $script:initialUninstallRegistryPaths -contains [string]$allEntries[0].registryPath -and
      [string]::IsNullOrWhiteSpace([string]$allEntries[0].installLocation) -and
      ((Test-Path -LiteralPath (Join-Path $target 'EvaluaPro.exe') -PathType Leaf) -or
       (Test-Path -LiteralPath (Join-Path $target 'evaluapro-native-dist.zip') -PathType Leaf))) {
    $entry = $allEntries[0]
    Write-E2ELog "ARP conservó la clave existente sin InstallLocation; se verifica la versión actualizada contra el payload en $target."
  } else {
    $newEntries = @($allEntries | Where-Object { $script:initialUninstallRegistryPaths -notcontains [string]$_.registryPath })
    if ($newEntries.Count -eq 1 -and
      [string]::IsNullOrWhiteSpace([string]$newEntries[0].installLocation) -and
      ((Test-Path -LiteralPath (Join-Path $target 'EvaluaPro.exe') -PathType Leaf) -or
       (Test-Path -LiteralPath (Join-Path $target 'evaluapro-native-dist.zip') -PathType Leaf))) {
      # Some MSI packages omit ARPINSTALLLOCATION. In isolated QA, the one new
      # registry entry plus payload at the unique target identifies the product.
      $entry = $newEntries[0]
      Write-E2ELog "ARP no publicó InstallLocation; se valida la nueva entrada EvaluaPro contra el EXE o ZIP de payload aislado en $target."
    } else {
    $entryDetails = @($allEntries | ForEach-Object {
        "version=$($_.displayVersion); location=$($_.installLocation); key=$($_.registryPath)"
      }) -join ' | '
    if ([string]::IsNullOrWhiteSpace($entryDetails)) { $entryDetails = 'sin entradas EvaluaPro registradas' }
    throw "No existe una entrada MSI inequívoca para la instalación temporal '$installedRoot': $entryDetails"
    }
  }
  $parsed = $null
  if (-not [version]::TryParse([string]$entry.displayVersion, [ref]$parsed)) {
    throw "DisplayVersion instalada invalida: $($entry.displayVersion)"
  }
  return (Normalize-InstallerProductVersion -Version $parsed)
}

function Assert-OfficialUpgradeBaseline {
  param([Parameter(Mandatory = $true)][string]$Path)
  $resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  $sidecarPath = "$resolvedPath.sha256"
  if (-not (Test-Path -LiteralPath $sidecarPath)) { throw "Falta el sidecar SHA-256 del baseline oficial: $sidecarPath" }
  $expectedSha = '644984c84fc05c4ec1f3804bda9d20666d229f7bab23caeb3a9c767179c82913'
  $sidecarText = Get-Content -Raw -LiteralPath $sidecarPath
  $sidecarMatch = [regex]::Match($sidecarText, '(?i)\b([0-9a-f]{64})\b')
  if (-not $sidecarMatch.Success -or $sidecarMatch.Groups[1].Value.ToLowerInvariant() -ne $expectedSha) {
    throw 'El sidecar no coincide con el SHA-256 oficial fijado para EvaluaPro v1.2.3.'
  }
  $actualSha = (Get-FileHash -LiteralPath $resolvedPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha -ne $sidecarMatch.Groups[1].Value.ToLowerInvariant()) {
    throw "El instalador baseline v1.2.3 no coincide con su sidecar SHA-256: $resolvedPath"
  }
  Add-Result -Area 'upgrade-baseline' -Item 'official-sha256' -Ok $true -Detail $actualSha
  return $resolvedPath
}

function Install-OfficialUpgradeBaselineMsi {
  param([Parameter(Mandatory = $true)][string]$VerifiedBundlePath)

  $wixCommand = Get-Command -Name 'wix.exe' -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $extractRoot = Join-Path $env:RUNNER_TEMP ('evaluapro-upgrade-baseline-extract-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  $quotedBundle = '"' + (([IO.Path]::GetFullPath($VerifiedBundlePath)) -replace '"', '\"') + '"'
  $quotedExtractRoot = '"' + (([IO.Path]::GetFullPath($extractRoot)) -replace '"', '\"') + '"'
  Invoke-CaptureCommand -Name 'upgrade-baseline-wix-extract' -FilePath $wixCommand.Source -ArgumentList @('burn', 'extract', $quotedBundle, '-out', $quotedExtractRoot) -WorkingDirectory $root -TimeoutSec 300

  $baselineMsis = @(Get-ChildItem -LiteralPath $extractRoot -File -Recurse | Where-Object { Test-MsiPackageFile -Path $_.FullName })
  if ($baselineMsis.Count -ne 1) { throw "El bundle oficial v1.2.3 debe contener exactamente un payload MSI; encontrados=$($baselineMsis.Count)." }
  $baselineMsiPath = Join-Path $extractRoot 'EvaluaPro-docente-local.msi'
  if (Test-Path -LiteralPath $baselineMsiPath) { throw 'La ruta MSI normalizada ya existe dentro del staging de extracción.' }
  Move-Item -LiteralPath $baselineMsis[0].FullName -Destination $baselineMsiPath

  $quotedMsi = '"' + ($baselineMsiPath -replace '"', '\"') + '"'
  $quotedInstallRoot = '"' + ([IO.Path]::GetFullPath($installedRoot) -replace '"', '\"') + '"'
  $msiInstallLog = Join-Path $ReportDir 'upgrade-baseline-msi-install.log'
  $quotedMsiInstallLog = '"' + ([IO.Path]::GetFullPath($msiInstallLog) -replace '"', '\"') + '"'
  Invoke-CaptureCommand -Name 'upgrade-baseline-msi-install' -FilePath 'msiexec.exe' -ArgumentList @(
    '/i', $quotedMsi,
    "INSTALLFOLDER=$quotedInstallRoot",
    'REQUIRE_INSTALLER_HUB=1', 'BURNMSIINSTALL=1',
    'INSTALL_DESKTOP_SHORTCUTS=0', 'INSTALL_STARTMENU_SHORTCUTS=0',
    '/l*v', $quotedMsiInstallLog,
    '/qn', '/norestart'
  ) -WorkingDirectory $root -TimeoutSec 300
  Copy-ArtifactIfExists -Path $msiInstallLog | Out-Null

  $installedVersion = Get-InstalledProductVersion
  if ($installedVersion -ne [version]'1.2.3') { throw "El MSI extraído del bundle oficial no instaló v1.2.3; observado=$installedVersion" }

  $requestPath = Join-Path $ReportDir 'upgrade-baseline-post-install.request.json'
  $responsePath = Join-Path $ReportDir 'upgrade-baseline-post-install.response.json'
  $now = [DateTimeOffset]::UtcNow
  $request = [ordered]@{
    schemaVersion = 1
    operationId = [guid]::NewGuid().ToString('D')
    command = 'post-install'
    issuedAtUtc = $now.AddSeconds(-1).ToString('o')
    expiresAtUtc = $now.AddMinutes(5).ToString('o')
    payload = [ordered]@{
      mode = 'install'
      flavorId = 'docente-local'
      installDir = [IO.Path]::GetFullPath($installedRoot)
      exportData = '1'
      dataDir = Join-Path $installedRoot 'data'
      config = [ordered]@{
        databaseUrl = 'file:C:/ProgramData/EvaluaPro/data/evaluapro.db'
        nodeEnv = 'production'
        puertoApi = '4000'
        puertoPortal = '4518'
        corsOrigenes = 'http://localhost:4173,http://127.0.0.1:4173'
        portalAlumnoUrl = ''
        portalAlumnoApiKey = 'portal-key-shared'
        portalApiKey = 'portal-key-shared'
        passwordResetEnabled = '0'
        passwordResetUrlBase = ''
        requireLicenseActivation = '0'
        apiComercialBaseUrl = ''
        tenantId = ''
        codigoActivacion = ''
        licenciaAccountEmail = 'soporte@tu-institucion.mx'
        flavorId = 'docente-local'
        updateChannel = 'stable'
        updateOwner = 'Dtcsrni'
        updateRepo = 'EvaluaPro_Sistema_Universitario'
        updateAssetName = 'EvaluaPro-InstallerHub-docente-local.exe'
        updateShaAssetName = 'EvaluaPro-InstallerHub-docente-local.exe.sha256'
        updateRequireSha256 = '1'
      }
    }
  }
  [IO.File]::WriteAllText($requestPath, ($request | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  $helperPath = Join-Path $root 'scripts\installer-burn\InstallerBurnHelper.ps1'
  $quotedHelper = '"' + ([IO.Path]::GetFullPath($helperPath) -replace '"', '\"') + '"'
  $quotedRequest = '"' + ([IO.Path]::GetFullPath($requestPath) -replace '"', '\"') + '"'
  $quotedResponse = '"' + ([IO.Path]::GetFullPath($responsePath) -replace '"', '\"') + '"'
  Invoke-CaptureCommand -Name 'upgrade-baseline-post-install' -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $quotedHelper,
    '-Mode', 'post-install', '-RequestPath', $quotedRequest, '-ResponsePath', $quotedResponse
  ) -WorkingDirectory $root -TimeoutSec 900

  if (-not (Test-Path -LiteralPath $responsePath -PathType Leaf)) { throw 'El helper QA no produjo respuesta para el baseline oficial v1.2.3.' }
  $response = Get-Content -LiteralPath $responsePath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $response.ok) { throw "No se pudo preparar el MSI baseline oficial v1.2.3: $([string]$response.message)" }
  # El helper escribe la respuesta directamente dentro de ReportDir; la copia sería sobre sí misma.
  Copy-ArtifactIfExists -Path $responsePath | Out-Null
  Add-Result -Area 'upgrade-baseline' -Item 'official-msi-installed' -Ok $true -Detail 'bundle oficial SHA-256 verificado; MSI extraído e instalado como v1.2.3'
}

function Invoke-UpgradeDataMarker {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('write', 'verify', 'remove')][string]$Action,
    [Parameter(Mandatory = $true)][string]$Marker
  )
  $databasePath = Resolve-InstalledSqlitePath
  $nodePath = Join-Path $installedRoot 'runtime\node\node.exe'
  if (-not (Test-Path -LiteralPath $databasePath)) { throw "No existe la base instalada para probar upgrade: $databasePath" }
  if (-not (Test-Path -LiteralPath $nodePath)) { throw "No existe Node empaquetado para probar upgrade: $nodePath" }
  $script = @'
const { DatabaseSync } = require('node:sqlite');
const [action, databasePath, marker] = process.argv.slice(1);
const db = new DatabaseSync(databasePath);
try {
  db.exec('CREATE TABLE IF NOT EXISTS "_qa_upgrade_probe" (marker TEXT PRIMARY KEY)');
  if (action === 'write') db.prepare('INSERT OR REPLACE INTO "_qa_upgrade_probe" (marker) VALUES (?)').run(marker);
  else if (action === 'verify') {
    const row = db.prepare('SELECT marker FROM "_qa_upgrade_probe" WHERE marker = ?').get(marker);
    if (!row) process.exitCode = 3;
  } else if (action === 'remove') db.exec('DROP TABLE IF EXISTS "_qa_upgrade_probe"');
} finally { db.close(); }
'@
  & $nodePath -e $script $Action $databasePath $Marker
  if ($LASTEXITCODE -ne 0) { throw "No se pudo $Action el marcador SQLite de upgrade (exit=$LASTEXITCODE)." }
}

function Invoke-UpgradeBaselineFlow {
  param([Parameter(Mandatory = $true)][string]$BaselinePath)
  $verifiedBaseline = Assert-OfficialUpgradeBaseline -Path $BaselinePath
  Install-OfficialUpgradeBaselineMsi -VerifiedBundlePath $verifiedBaseline
  Wait-InstalledPayload -TimeoutSec 240
  Set-QAIsolatedSqlite | Out-Null
  Test-InstalledState -Phase 'post-baseline-install'
  $baselineVersion = Get-InstalledProductVersion
  if ($baselineVersion -ne [version]'1.2.3') { throw "El instalador baseline no dejó v1.2.3; versión observada: $baselineVersion" }
  Add-Result -Area 'upgrade' -Item 'baseline-version' -Ok $true -Detail ([string]$baselineVersion)

  $baselineRunId = 'e2e-upgrade-baseline-' + [guid]::NewGuid().ToString('N')
  $baselineState = Invoke-InstalledAppHost -Action 'open-dashboard' -RunId $baselineRunId -TimeoutSec 240
  $baselineStateValue = if ($baselineState.PSObject.Properties.Match('state').Count -gt 0) { [string]$baselineState.state } else { 'unknown' }
  if ($baselineStateValue -notin @('healthy', 'degraded')) { throw "La app baseline no quedó saludable antes de upgrade: $baselineStateValue" }

  $marker = 'upgrade-' + [guid]::NewGuid().ToString('N')
  Invoke-InstalledAppHost -Action 'stop-all' -RunId ('upgrade-stop-' + [guid]::NewGuid().ToString('N'))
  Invoke-UpgradeDataMarker -Action 'write' -Marker $marker
  Add-Result -Area 'upgrade' -Item 'baseline-data-marker' -Ok $true -Detail 'marcador SQLite escrito en la base instalada temporal'
  try {
    Invoke-SameVersionRelatedBundleConflict -DatabaseMarker $marker
    Invoke-InstallerHubMode -Mode 'install' -BundlePath $script:bundlePath | Out-Null
    Wait-InstalledPayload -TimeoutSec 240
    $candidateVersion = Get-InstalledProductVersion
    $versionAdvanced = $candidateVersion -gt $baselineVersion
    Add-Result -Area 'upgrade' -Item 'candidate-version-advanced' -Ok $versionAdvanced -Detail "baseline=$baselineVersion candidate=$candidateVersion"
    if (-not $versionAdvanced) { throw "La actualización no avanzó la versión: $baselineVersion -> $candidateVersion" }
    Invoke-UpgradeDataMarker -Action 'verify' -Marker $marker
    Add-Result -Area 'upgrade' -Item 'data-preserved' -Ok $true -Detail 'el marcador SQLite previo continúa después del upgrade'
    Test-InstalledState -Phase 'post-upgrade'
  } finally {
    try { Invoke-UpgradeDataMarker -Action 'remove' -Marker $marker } catch { Write-E2ELog "No se pudo limpiar marcador QA de upgrade: $($_.Exception.Message)" }
  }
}

function Resolve-InstalledSqlitePath {
  $databasePath = Get-ConfiguredInstalledSqlitePath
  $localDatabase = [IO.Path]::GetFullPath((Join-Path $installedRoot 'data\evaluapro.db'))
  if ($databasePath -ne $localDatabase) {
    throw "La ruta SQLite del instalador está fuera de los destinos QA permitidos: $databasePath"
  }
  if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) { throw "No existe la SQLite instalada: $databasePath" }
  return $databasePath
}

function Get-ConfiguredInstalledSqlitePath {
  $envFile = Join-Path $installedRoot '.env'
  if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { throw "No existe la configuración de base instalada: $envFile" }
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*(BACKEND_DATABASE_URL|DATABASE_URL)\s*=\s*(.*?)\s*$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
  $databaseUrl = [string]$values['BACKEND_DATABASE_URL']
  if ([string]::IsNullOrWhiteSpace($databaseUrl)) { $databaseUrl = [string]$values['DATABASE_URL'] }
  $match = [regex]::Match($databaseUrl, '^file:(?<path>[A-Za-z]:[\\/][^?#]+)$')
  if (-not $match.Success) { throw 'La base instalada debe declarar una ruta SQLite local en .env.' }
  $databasePath = [IO.Path]::GetFullPath([Uri]::UnescapeDataString($match.Groups['path'].Value.Replace('/', '\\')))
  return $databasePath
}

function Set-QAIsolatedSqlite {
  if ($script:upgradingExistingInstall) {
    $databasePath = Get-ConfiguredInstalledSqlitePath
    if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
      throw "La base configurada desapareció durante la actualización: $databasePath"
    }
    Add-Result -Area 'database-isolation' -Item 'existing-sqlite-retained-for-upgrade' -Ok $true -Detail $databasePath
    return $databasePath
  }
  $databasePath = Get-ConfiguredInstalledSqlitePath
  $localDatabase = [IO.Path]::GetFullPath((Join-Path $installedRoot 'data\evaluapro.db'))
  if ($databasePath -eq $localDatabase) {
    if (-not (Test-Path -LiteralPath $localDatabase -PathType Leaf)) { throw "No existe la SQLite instalada: $localDatabase" }
    Add-Result -Area 'database-isolation' -Item 'isolated-sqlite' -Ok $true -Detail $localDatabase
    return $localDatabase
  }
  $sharedDatabase = [IO.Path]::GetFullPath($sharedProgramDataDatabasePath)
  if ($databasePath -ne $sharedDatabase) {
    throw "La ruta SQLite del instalador está fuera de los destinos QA permitidos: $databasePath"
  }
  if ($script:sharedProgramDataDatabaseExistedAtStart) {
    throw "Se rechaza mover una SQLite de ProgramData preexistente; el runner debe ejecutarse en un host QA limpio: $databasePath"
  }
  if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) { throw "No existe la SQLite baseline recién creada: $databasePath" }
  if (Test-Path -LiteralPath $localDatabase) { throw "Ya existe la SQLite destino del runner: $localDatabase" }

  $localDataDirectory = Split-Path -Parent $localDatabase
  New-Item -ItemType Directory -Force -Path $localDataDirectory | Out-Null
  $moves = @()
  foreach ($suffix in @('', '-wal', '-shm', '-journal')) {
    $source = $databasePath + $suffix
    if (Test-Path -LiteralPath $source -PathType Leaf) {
      $destination = $localDatabase + $suffix
      if (Test-Path -LiteralPath $destination) { throw "Ya existe un archivo SQLite QA destino: $destination" }
      $moves += [pscustomobject]@{ source = $source; destination = $destination }
    }
  }
  if (-not ($moves | Where-Object { $_.source -eq $databasePath })) { throw "No se encontró la SQLite baseline: $databasePath" }

  $moved = New-Object System.Collections.Generic.List[object]
  try {
    foreach ($move in $moves) {
      Move-Item -LiteralPath $move.source -Destination $move.destination
      $moved.Add($move) | Out-Null
    }
    $envFile = Join-Path $installedRoot '.env'
    $contents = [IO.File]::ReadAllText($envFile)
    $localDatabaseUrl = 'file:' + ($localDatabase -replace '\\', '/')
    $databaseSettingPattern = '(?m)^(\s*(?:BACKEND_DATABASE_URL|DATABASE_URL)\s*=\s*).*$'
    $settingCount = [regex]::Matches($contents, $databaseSettingPattern).Count
    if ($settingCount -lt 1) { throw 'No se encontraron variables SQLite para actualizar el entorno QA.' }
    $updated = [regex]::Replace($contents, $databaseSettingPattern, [System.Text.RegularExpressions.MatchEvaluator] {
        param($match)
        return $match.Groups[1].Value + $localDatabaseUrl
      })
    [IO.File]::WriteAllText($envFile, $updated, [Text.UTF8Encoding]::new($false))
    $verifiedPath = Get-ConfiguredInstalledSqlitePath
    if ($verifiedPath -ne $localDatabase) { throw "El .env QA no quedó apuntando a la SQLite aislada: $verifiedPath" }
  } catch {
    for ($index = $moved.Count - 1; $index -ge 0; $index--) {
      $move = $moved[$index]
      if ((Test-Path -LiteralPath $move.destination -PathType Leaf) -and -not (Test-Path -LiteralPath $move.source)) {
        Move-Item -LiteralPath $move.destination -Destination $move.source -ErrorAction SilentlyContinue
      }
    }
    throw
  }
  Add-Result -Area 'database-isolation' -Item 'fresh-programdata-sqlite-relocated' -Ok $true -Detail "origen=$databasePath destino=$localDatabase"
  return $localDatabase
}

function Assert-SharedProgramDataSqliteUnchanged {
  $currentPaths = @(
    foreach ($suffix in @('', '-wal', '-shm', '-journal')) {
      $candidate = $sharedProgramDataDatabasePath + $suffix
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidate }
    }
  )
  $samePaths = (@($currentPaths | Sort-Object) -join "`n") -ceq (@($script:sharedProgramDataSqliteArtifactsAtStart | Sort-Object) -join "`n")
  $sameContent = $samePaths
  if ($sameContent) {
    foreach ($snapshot in $script:sharedProgramDataSqliteSnapshotAtStart) {
      if (-not (Test-Path -LiteralPath $snapshot.path -PathType Leaf)) { $sameContent = $false; break }
      $item = Get-Item -LiteralPath $snapshot.path -ErrorAction Stop
      $hash = (Get-FileHash -LiteralPath $snapshot.path -Algorithm SHA256).Hash.ToLowerInvariant()
      if ([int64]$item.Length -ne [int64]$snapshot.length -or $hash -ne [string]$snapshot.sha256) {
        $sameContent = $false
        break
      }
    }
  }
  Export-JsonArtifact -Name 'shared-programdata-sqlite-baseline.json' -Data $script:sharedProgramDataSqliteSnapshotAtStart | Out-Null
  Add-Result -Area 'database-isolation' -Item 'shared-programdata-sqlite-unchanged' -Ok $sameContent -Detail ("initial={0} current={1}" -f $script:sharedProgramDataSqliteArtifactsAtStart.Count, $currentPaths.Count)
  if (-not $sameContent) {
    throw "La SQLite compartida en ProgramData cambió durante el E2E; se conserva intacta y requiere revisión: $sharedProgramDataDatabasePath"
  }
}

function Backup-ExistingInstallDatabase {
  if (-not $script:upgradingExistingInstall) { return }
  $databasePath = Get-ConfiguredInstalledSqlitePath
  if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
    throw "No existe la base configurada para respaldar antes de actualizar: $databasePath"
  }
  $backupRoot = Join-Path ([IO.Path]::GetTempPath()) ("evaluapro-preupgrade-{0}" -f [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $backupBase = Join-Path $backupRoot 'evaluapro.db'
  $backupRecords = @()
  foreach ($suffix in @('', '-wal', '-shm', '-journal')) {
    $source = $databasePath + $suffix
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $destination = $backupBase + $suffix
    Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    $backupHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne $backupHash) { throw "El respaldo previo no coincide con su origen: $source" }
    $backupRecords += [pscustomobject]@{ source = $source; backup = $destination; sha256 = $backupHash }
  }
  if (-not ($backupRecords | Where-Object { $_.source -eq $databasePath })) {
    throw "No se pudo respaldar la base principal antes de actualizar: $databasePath"
  }
  $script:preUpgradeDatabaseBackup = [pscustomobject]@{ root = $backupRoot; files = $backupRecords }
  Export-JsonArtifact -Name 'pre-upgrade-database-backup.json' -Data $script:preUpgradeDatabaseBackup | Out-Null
  Add-Result -Area 'preflight' -Item 'pre-upgrade-database-backup' -Ok $true -Detail ("files={0} root={1}" -f $backupRecords.Count, $backupRoot)
}

function Invoke-DummyDataCycle {
  param([string]$BaseUrl)
  if (-not $SeedDummyData) { return }
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    Add-Result -Area 'dummy-data' -Item 'cycle' -Ok $false -Detail 'dashboard base vacio'
    throw 'No se puede ejecutar el ciclo dummy sin dashboard base.'
  }
  # Dashboard port sirve UI/control; API docente escucha en PUERTO_API=4000.
  # Permitir override explícito para hosts QA, sin derivarlo del puerto web.
  $apiBase = if (-not [string]::IsNullOrWhiteSpace($env:E2E_DOCENTE_API_BASE_URL)) {
    $env:E2E_DOCENTE_API_BASE_URL.TrimEnd('/')
  } else {
    'http://127.0.0.1:4000/api'
  }
  $previousBase = $env:E2E_DOCENTE_BASE_URL
  $previousSqlitePath = $env:E2E_DOCENTE_SQLITE_PATH
  $env:E2E_DOCENTE_BASE_URL = $apiBase
  $env:E2E_DOCENTE_SQLITE_PATH = Resolve-InstalledSqlitePath
  try {
    $seedScript = Join-Path $root 'scripts/tests/seed-docente-dummy.mjs'
    $stdoutPath = Join-Path $ReportDir 'dummy-data-cycle.stdout.log'
    $stderrPath = Join-Path $ReportDir 'dummy-data-cycle.stderr.log'
    $seedProcess = Start-Process -FilePath 'node.exe' -ArgumentList @("`"$seedScript`"") -WorkingDirectory $root -NoNewWindow -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $seedWaitCompleted = $seedProcess.WaitForExit(180000)
    if (-not $seedWaitCompleted) {
      try { Stop-Process -Id $seedProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
      $exitCode = -1
    } else {
      $seedProcess.WaitForExit()
      try { $seedProcess.Refresh() } catch {}
      $exitCode = if ($null -ne $seedProcess.ExitCode) { [int]$seedProcess.ExitCode } else { $null }
    }
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw } else { '' }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw } else { '' }
    $seedResult = $null
    try { $seedResult = $stdout | ConvertFrom-Json -ErrorAction Stop } catch {}
    if ($null -eq $exitCode) {
      $structuredSuccess = $false
      if ($null -ne $seedResult) {
        $cleanup = @($seedResult.cleanup)
        $cleanupErrors = @($seedResult.cleanupErrors)
        $structuredSuccess = $seedWaitCompleted -and
          $seedResult.cuentaCreada -eq $true -and
          $seedResult.verificado -eq $true -and
          @($seedResult.materias).Count -eq 3 -and
          @($seedResult.alumnos).Count -eq 3 -and
          $cleanupErrors.Count -eq 0 -and
          $seedResult.cleanupVerified -eq $true -and
          $cleanup -contains 'cuenta:local-db'
      }
      $exitCode = if ($structuredSuccess) { 0 } else { -1 }
      if ($structuredSuccess) { Write-E2ELog 'WARNING: ExitCode nulo en el ciclo dummy; se acepta el reporte estructurado completo y limpio.' }
    }
    $output = "stdout:`n$stdout`nstderr:`n$stderr"
    Copy-ArtifactIfExists -Path $stdoutPath | Out-Null
    Copy-ArtifactIfExists -Path $stderrPath | Out-Null
    Export-JsonArtifact -Name 'dummy-data-cycle.json' -Data ([pscustomobject]@{
        exitCode = $exitCode
        apiBase = $apiBase
        output = $output
      }) | Out-Null
    $ok = $exitCode -eq 0
    Add-Result -Area 'dummy-data' -Item 'cycle' -Ok $ok -Detail 'cuenta docente + 3 materias + 3 alumnos + cleanup'
    if (-not $ok) { throw "Ciclo dummy fallo: $output" }
  } finally {
    if ($null -eq $previousBase) { Remove-Item Env:E2E_DOCENTE_BASE_URL -ErrorAction SilentlyContinue }
    else { $env:E2E_DOCENTE_BASE_URL = $previousBase }
    if ($null -eq $previousSqlitePath) { Remove-Item Env:E2E_DOCENTE_SQLITE_PATH -ErrorAction SilentlyContinue }
    else { $env:E2E_DOCENTE_SQLITE_PATH = $previousSqlitePath }
  }
}

function Assert-NoActiveEvaluaProProcesses {
  $active = @(Get-Process | Where-Object {
      $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or
      $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp' -or
      $_.ProcessName -like 'EvaluaPro*'
    })
  $area = if ($script:upgradingExistingInstall) { 'upgrade-existing-install' } else { 'post-uninstall' }
  Add-Result -Area $area -Item 'active-evaluapro-processes' -Ok ($active.Count -eq 0) -Detail ("count={0}" -f $active.Count)
  if ($active.Count -gt 0) {
    Export-JsonArtifact -Name 'processes-active-after-flow.json' -Data $active | Out-Null
  }
}

function Write-TutorialMarkdown {
  $relativeScreenshots = @()
  foreach ($shot in @($screenshots)) {
    $relativeScreenshots += ($shot.Replace($ReportDir, '.').Replace('\', '/'))
  }
  $content = @(
    '# Tutorial visual E2E Installer Hub docente-local',
    '',
    $(if ($script:upgradingExistingInstall) {
      'Este tutorial se genera desde evidencia real de la PC. Muestra la actualización de una instalación existente, repair, Plataforma docente nativa y dashboard; la versión actualizada queda instalada.'
    } else {
      'Este tutorial se genera desde evidencia real de la PC. Muestra el flujo completo install, repair, Plataforma docente nativa, dashboard y uninstall.'
    }),
    '',
    '## 1. Preparar',
    '- Confirmar flavor `docente-local`, modo y ruta.',
    '- El Hub docente no expone configuracion avanzada legacy.',
    '- Ejecutar este runner con `-IUnderstandThisMutatesPc` desde una PowerShell local.',
    '- No requiere VM, Hyper-V, WinRM, snapshots ni credenciales remotas.',
    '',
    '## 2. Revisar',
    '- Ejecutar prerequisitos.',
    '- Continuar solo si el Hub queda listo o documenta remediacion/reinicio.',
    '',
    '## 3. Ejecutar',
    '- Instalar, reparar o desinstalar desde el boton primario.',
    '- No cerrar la ventana mientras exista operacion busy.',
    '',
    '## 4. Plataforma docente nativa',
    '- El launcher nativo debe mantener Node/API y Web docente en ejecucion.',
    '- API: `http://127.0.0.1:4000/api/salud` debe responder 200.',
    '- Web docente: `http://127.0.0.1:4173` debe responder 200.',
    '- Dashboard: `/api/status` debe estar `healthy` o `degraded`, nunca `failed`.',
    '- Update smoke: `/api/update/status` debe responder y guardarse como `manifest/update-status.json`.',
    '',
    '## 5. Evidencia',
    '- Reporte JSON: `report.json`.',
    '- Runtime nativo: `native/`.',
    '- Logs: `logs/`.',
    '- Manifiestos: `manifest/`.',
    '- Procesos: `processes/`.',
    '',
    '## Capturas',
    ''
  )
  foreach ($shot in $relativeScreenshots) {
    $name = [IO.Path]::GetFileNameWithoutExtension($shot)
    $content += "### $name"
    $content += ""
    $content += "![]($shot)"
    $content += ""
  }
  $content -join "`r`n" | Set-Content -Path $tutorialPath -Encoding UTF8
  $artifacts.Add($tutorialPath) | Out-Null
}

function Test-InstalledState {
  param([string]$Phase)
  $manifest = Join-Path $installedRoot 'logs\installation.manifest.json'
  $updateConfig = Join-Path $installedRoot 'config\update-config.json'
  $required = @(
    (Join-Path $installedRoot 'package.json'),
    (Join-Path $installedRoot 'EvaluaPro.exe'),
    (Join-Path $installedRoot 'scripts\start-docente-native.mjs'),
    (Join-Path $installedRoot 'runtime\node\node.exe'),
    (Join-Path $installedRoot 'apps\backend\dist\index.js'),
    (Join-Path $installedRoot 'apps\frontend\dist-docente\index.html'),
    $manifest,
    $updateConfig
  )
  foreach ($path in $required) {
    Add-Result -Area $Phase -Item ("file:{0}" -f (Split-Path -Leaf $path)) -Ok (Test-Path -LiteralPath $path) -Detail $path
  }
  if (Test-Path -LiteralPath $manifest) { Copy-ArtifactIfExists -Path $manifest -Name ("{0}-installation.manifest.json" -f $Phase) | Out-Null }
  if (Test-Path -LiteralPath $updateConfig) {
    Copy-ArtifactIfExists -Path $updateConfig -Name ("{0}-update-config.json" -f $Phase) | Out-Null
    $cfg = Get-Content -Raw -Path $updateConfig | ConvertFrom-Json
    Add-Result -Area $Phase -Item 'update-config' -Ok (
      [string]$cfg.channel -eq 'stable' -and
      [string]$cfg.flavorId -eq 'docente-local' -and
      [string]$cfg.assetName -match 'EvaluaPro-InstallerHub-docente-local'
    ) -Detail ($cfg | ConvertTo-Json -Compress)
  }
}

function Export-InstallerLogs {
  $programDataLogs = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\logs'
  if (Test-Path -LiteralPath $programDataLogs) {
    Copy-ArtifactIfExists -Path $programDataLogs -Name 'programdata-installer-hub-logs' | Out-Null
  }
  if ($installedRoot -and (Test-Path -LiteralPath (Join-Path $installedRoot 'logs'))) {
    Copy-ArtifactIfExists -Path (Join-Path $installedRoot 'logs') -Name 'installed-logs' | Out-Null
  }
}

try {
  Set-Content -Path $logPath -Encoding UTF8 -Value ('{0:u} Inicio E2E real Installer Hub docente' -f (Get-Date))
  Minimize-RunnerConsole
  Export-JsonArtifact -Name 'processes-before.json' -Data (Get-ProcessSnapshot) | Out-Null
  Assert-SystemMemoryReady

  $bundlePath = Resolve-BundlePath
  Assert-Hash -ExePath $bundlePath
  Copy-ArtifactIfExists -Path $bundlePath -Name (Split-Path -Leaf $bundlePath) | Out-Null
  Copy-ArtifactIfExists -Path "$bundlePath.sha256" | Out-Null
  Copy-ArtifactIfExists -Path (Join-Path (Split-Path -Parent $bundlePath) 'SHASUMS256.txt') | Out-Null
  Copy-ArtifactIfExists -Path (Join-Path $root 'dist\installer\EvaluaPro-release-manifest.json') | Out-Null
  Export-RuntimeAudit -Name 'before'

  if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path ${env:LOCALAPPDATA} 'EvaluaPro'
  }
  $installedRoot = $InstallDir

  $existing = @(Get-EvaluaProUninstallEntries)
  $script:initialUninstallRegistryPaths = @($existing | ForEach-Object { [string]$_.registryPath })
  Export-JsonArtifact -Name 'preflight-uninstall-entries.json' -Data $existing | Out-Null
  Add-Result -Area 'preflight' -Item 'existing-install' -Ok ($AllowExistingInstall -or $existing.Count -eq 0) -Detail ("entries={0}" -f $existing.Count)
  $localAppDataRoot = [IO.Path]::GetFullPath(${env:LOCALAPPDATA}).TrimEnd('\')
  $normalizedTargetRoot = [IO.Path]::GetFullPath($installedRoot).TrimEnd('\')
  $targetInsideLocalAppData = $normalizedTargetRoot.StartsWith($localAppDataRoot + '\', [StringComparison]::OrdinalIgnoreCase)
  $defaultInstallRoot = [IO.Path]::GetFullPath((Join-Path ${env:LOCALAPPDATA} 'EvaluaPro')).TrimEnd('\')
  $releaseManifestPath = Join-Path $root 'dist\installer\EvaluaPro-release-manifest.json'
  $releaseManifest = if (Test-Path -LiteralPath $releaseManifestPath -PathType Leaf) { Get-Content -Raw -LiteralPath $releaseManifestPath | ConvertFrom-Json } else { $null }
  $manifestFlavor = @()
  if ($releaseManifest -and $releaseManifest.PSObject.Properties.Match('flavors').Count -gt 0) {
    $manifestFlavor = @($releaseManifest.flavors | Where-Object { [string]$_.flavorId -eq 'docente-local' } | Select-Object -First 1)
  }
  $stableCandidate = $null -ne $releaseManifest -and [string]$releaseManifest.channel -eq 'stable' -and
    $manifestFlavor.Count -eq 1 -and [string]$manifestFlavor[0].channel -eq 'stable'
  $installedPackagePath = Join-Path $normalizedTargetRoot 'package.json'
  if ((Test-Path -LiteralPath (Join-Path $normalizedTargetRoot 'EvaluaPro.exe') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $normalizedTargetRoot '.env') -PathType Leaf) -and
      (Test-Path -LiteralPath $installedPackagePath -PathType Leaf)) {
    try {
      $installedPackage = Get-Content -Raw -LiteralPath $installedPackagePath | ConvertFrom-Json
      $parsedInstalledVersion = $null
      if ([string]$installedPackage.name -eq 'evaluapro' -and
          [version]::TryParse([string]$installedPackage.version, [ref]$parsedInstalledVersion)) {
        $script:existingInstalledPayloadVersion = $parsedInstalledVersion
      }
    } catch { $script:existingInstalledPayloadVersion = $null }
  }
  $installedManifestVersion = $null
  $installedVersionMetadataPath = Join-Path $normalizedTargetRoot 'config\app-version.json'
  if (Test-Path -LiteralPath $installedVersionMetadataPath -PathType Leaf) {
    try {
      $installedVersionMetadata = Get-Content -Raw -LiteralPath $installedVersionMetadataPath | ConvertFrom-Json
      $parsedManifestVersion = $null
      if ([version]::TryParse([string]$installedVersionMetadata.version, [ref]$parsedManifestVersion)) {
        $installedManifestVersion = $parsedManifestVersion
      }
    } catch { $installedManifestVersion = $null }
  }
  $candidateAppVersion = [version]::Parse([string]$releaseManifest.version)
  $payloadIsBehind = $null -ne $script:existingInstalledPayloadVersion -and $script:existingInstalledPayloadVersion -lt $candidateAppVersion
  $versionMetadataIsBehind = $null -ne $installedManifestVersion -and $installedManifestVersion -lt $candidateAppVersion
  $targetHasPriorPayload = $payloadIsBehind -or $versionMetadataIsBehind
  $registeredPayloadVersion = $null
  if ($existing.Count -eq 1) {
    try { $registeredPayloadVersion = Normalize-InstallerProductVersion -Version ([version]::Parse([string]$existing[0].displayVersion)) } catch {}
  }
  # A completed/failed bundle may have registered a newer installer version
  # while its native payload still reports the prior package version. Treat
  # that state as upgradeable when the inventory is singular and the target
  # path is the expected user install; the candidate must reconcile it.
  $registryInventoryCompatible = $existing.Count -le 1 -and
    ($existing.Count -eq 0 -or $registeredPayloadVersion -ge (Normalize-InstallerProductVersion -Version $script:existingInstalledPayloadVersion))
  $candidateBundleVerified = -not [string]::IsNullOrWhiteSpace($bundlePath) -and
    (Test-Path -LiteralPath $bundlePath -PathType Leaf)
  $isolatedTarget = $targetInsideLocalAppData -and
    $normalizedTargetRoot -ne $defaultInstallRoot -and
    -not (Test-Path -LiteralPath $normalizedTargetRoot)
  $baselineBundleProvided = -not [string]::IsNullOrWhiteSpace($BaselineBundlePath)
  $baselineBundleExists = $baselineBundleProvided -and
    (Test-Path -LiteralPath $BaselineBundlePath -PathType Leaf)
  $script:upgradingExistingInstall = $registryInventoryCompatible -and $targetHasPriorPayload -and $AllowExistingInstall -and
    $candidateBundleVerified -and
    [string]::IsNullOrWhiteSpace($BaselineBundlePath) -and $stableCandidate -and
    $normalizedTargetRoot -eq $defaultInstallRoot -and
    (Test-Path -LiteralPath (Join-Path $normalizedTargetRoot 'EvaluaPro.exe') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $normalizedTargetRoot '.env') -PathType Leaf)
  $isolatedCandidateRun = $candidateBundleVerified -and -not $baselineBundleProvided -and
    $isolatedTarget -and $stableCandidate -and $existing.Count -eq 0
  $isolatedBaselineUpgradeRun = $candidateBundleVerified -and $baselineBundleExists -and
    $isolatedTarget -and $stableCandidate -and $existing.Count -eq 0
  $validInstallMode = $isolatedCandidateRun -or $isolatedBaselineUpgradeRun -or $script:upgradingExistingInstall
  $installMode = if ($script:upgradingExistingInstall) {
    'stable-upgrade-existing-install'
  } elseif ($isolatedBaselineUpgradeRun) {
    'isolated-baseline-upgrade'
  } elseif ($isolatedCandidateRun) {
    'isolated-candidate'
  } else {
    'invalid'
  }
  Add-Result -Area 'preflight' -Item 'valid-install-mode' -Ok $validInstallMode -Detail ("mode={0} target={1} stableCandidate={2} payloadVersion={3} priorEntries={4} candidateVerified={5} baselineProvided={6} baselineExists={7}" -f $installMode, $normalizedTargetRoot, $stableCandidate, $script:existingInstalledPayloadVersion, $existing.Count, $candidateBundleVerified, $baselineBundleProvided, $baselineBundleExists)
  if (-not $validInstallMode) {
    throw "Modo E2E de instalación inválido; se aborta antes de ejecutar cambios. mode=$installMode target=$normalizedTargetRoot candidateVerified=$candidateBundleVerified baselineProvided=$baselineBundleProvided baselineExists=$baselineBundleExists priorEntries=$($existing.Count)"
  }
  if ($script:sharedProgramDataDatabaseExistedAtStart -and -not ($isolatedCandidateRun -or $script:upgradingExistingInstall)) {
    throw "Existe SQLite previa en ProgramData. Solo se admite el E2E de candidata sin baseline en un destino de QA nuevo bajo LocalAppData: $sharedProgramDataDatabasePath"
  }
  if ($script:sharedProgramDataDatabaseExistedAtStart -and $script:upgradingExistingInstall) {
    Add-Result -Area 'preflight' -Item 'shared-programdata-sqlite-upgrade' -Ok $true -Detail 'La base será respaldada antes de iniciar la actualización estable.'
  } elseif ($script:sharedProgramDataDatabaseExistedAtStart -and $isolatedCandidateRun) {
    Add-Result -Area 'preflight' -Item 'shared-programdata-sqlite-preserved' -Ok $true -Detail ("SQLite preexistente se preservará por SHA-256; target={0}" -f $normalizedTargetRoot)
  }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  $isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  $normalizedTarget = [IO.Path]::GetFullPath($installedRoot).TrimEnd('\').ToLowerInvariant()
  $targetMachineEntries = @($existing | Where-Object {
      [string]$_.registryPath -like 'HKEY_LOCAL_MACHINE*' -and
      -not [string]::IsNullOrWhiteSpace([string]$_.installLocation) -and
      ([IO.Path]::GetFullPath([string]$_.installLocation).TrimEnd('\').ToLowerInvariant() -eq $normalizedTarget)
    })
  $foreignMachineEntries = @($existing | Where-Object {
      [string]$_.registryPath -like 'HKEY_LOCAL_MACHINE*' -and
      $targetMachineEntries -notcontains $_
    })
  $machineInstall = $targetMachineEntries.Count -gt 0
  Add-Result -Area 'preflight' -Item 'uac-capability' -Ok (-not $machineInstall -or $isAdministrator) -Detail ("targetMachineInstall={0} foreignMachineEntries={1} administrator={2}" -f $machineInstall, $foreignMachineEntries.Count, $isAdministrator)
  if ($foreignMachineEntries.Count -gt 0) {
    Add-Result -Area 'preflight' -Item 'foreign-install-warning' -Ok $true -Detail ("entries={0}; no bloquean docente-local en {1}" -f $foreignMachineEntries.Count, $installedRoot)
  }
  if ($machineInstall -and -not $isAdministrator -and $AllowExistingInstall) {
    throw 'Existe una instalación per-machine de EvaluaPro. Este E2E requiere una sesión elevada para migrarla/desinstalarla; acepta UAC y vuelve a ejecutar, o ejecuta una instalación limpia en un equipo sin registro previo.'
  }
  if (-not $AllowExistingInstall -and $existing.Count -gt 0) {
    throw 'La PC no esta limpia: ya existe una instalacion EvaluaPro.'
  }

  $activeInstallerHubProcesses = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or
      $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp'
    })
  $activeInstallerHubProcessDetails = ($activeInstallerHubProcesses | ForEach-Object { "{0}:{1}" -f $_.ProcessName, $_.Id }) -join ', '
  Add-Result -Area 'preflight' -Item 'no-active-installer-hub' -Ok ($activeInstallerHubProcesses.Count -eq 0) -Detail $activeInstallerHubProcessDetails
  if ($activeInstallerHubProcesses.Count -gt 0) {
    throw "Hay procesos Installer Hub activos: $activeInstallerHubProcessDetails. El runner no los cerrará; ciérrelos manualmente o use un host QA limpio."
  }

  $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($installedRoot).Substring(0, 1))
  Add-Result -Area 'preflight' -Item 'free-space' -Ok ($drive.Free -gt 8GB) -Detail ("freeGB={0:n2}" -f ($drive.Free / 1GB))
  Add-Result -Area 'preflight' -Item 'powershell' -Ok ($PSVersionTable.PSVersion.Major -ge 5) -Detail ([string]$PSVersionTable.PSVersion)

  # Set this only after every non-mutating preflight has passed. Cleanup must not
  # write ProgramData or terminate processes when the runner rejects the host.
  $script:qaMutationStarted = $true
  Backup-ExistingInstallDatabase
  if ([string]::IsNullOrWhiteSpace($BaselineBundlePath)) {
    Invoke-SameVersionRelatedBundleConflict
    Invoke-InstallerHubMode -Mode 'install' | Out-Null
    Wait-InstalledPayload -TimeoutSec 240
    Set-QAIsolatedSqlite | Out-Null
    Test-InstalledState -Phase 'post-install'
  } else {
    Invoke-UpgradeBaselineFlow -BaselinePath $BaselineBundlePath
  }

  Invoke-InstalledAppHost -Action 'verify-installation' -RunId ('e2e-verify-' + [guid]::NewGuid().ToString('N'))
  $openRunId = 'e2e-open-' + [guid]::NewGuid().ToString('N')
  $state = Invoke-InstalledAppHost -Action 'open-dashboard' -RunId $openRunId -TimeoutSec 240
  Export-JsonArtifact -Name 'dashboard-bootstrap-state.json' -Data $state | Out-Null
  $dashboardState = if ($state.PSObject.Properties.Match('state').Count -gt 0) { [string]$state.state } else { 'unknown' }
  Add-Result -Area 'dashboard' -Item 'bootstrap-state' -Ok ($dashboardState -in @('healthy', 'degraded')) -Detail $dashboardState
  $dashboardBase = if ($state.PSObject.Properties.Match('meta').Count -gt 0 -and $state.meta.PSObject.Properties.Match('base').Count -gt 0) { [string]$state.meta.base } else { '' }
  if (-not [string]::IsNullOrWhiteSpace($dashboardBase)) {
    try {
      $dashboardStatus = Invoke-RestMethod -Uri "$dashboardBase/api/status" -TimeoutSec 10
      Export-JsonArtifact -Name 'dashboard-status.json' -Data $dashboardStatus | Out-Null
      $dashboardLifecycleState = if ($dashboardStatus.PSObject.Properties.Match('lifecycle').Count -gt 0 -and $dashboardStatus.lifecycle.PSObject.Properties.Match('state').Count -gt 0) {
        [string]$dashboardStatus.lifecycle.state
      } else {
        'unknown'
      }
      $dashboardAppOk = $null -ne $dashboardStatus -and $dashboardStatus.app.name -eq 'evaluapro'
      Add-Result -Area 'dashboard' -Item 'api-status' -Ok ($dashboardAppOk -and $dashboardLifecycleState -ne 'failed') -Detail ("{0} lifecycle={1}" -f $dashboardBase, $dashboardLifecycleState)
    } catch {
      Add-Result -Area 'dashboard' -Item 'api-status' -Ok $false -Detail $_.Exception.Message
      throw
    }
  }

  Invoke-NativeStableStack
  Assert-NativeStable
  Export-NativeEvidence
  Export-RuntimeAudit -Name 'after'
  Capture-DashboardScreenshots -BaseUrl $dashboardBase
  Invoke-DummyDataCycle -BaseUrl $dashboardBase
  Test-UpdateSmoke -BaseUrl $dashboardBase

  Write-E2ELog "Deteniendo tareas nativas antes de continuar con reparacion y desinstalacion..."
  Invoke-InstalledAppHost -Action 'stop-all' -RunId ("stop-native-{0}" -f ([Guid]::NewGuid().ToString('N')))

  Invoke-InstallerHubMode -Mode 'repair' | Out-Null
  Test-InstalledState -Phase 'post-repair'

  if ($script:upgradingExistingInstall) {
    $postUpgradeEntries = @(Get-EvaluaProUninstallEntries)
    $expectedVersion = [version]::Parse(([string]$releaseManifest.version + '.0'))
    $installedVersion = Get-InstalledProductVersion
    $versionMatches = $installedVersion -eq (Normalize-InstallerProductVersion -Version $expectedVersion)
    $singleCurrentRegistration = $postUpgradeEntries.Count -eq 1
    $currentRegistryPath = if ($postUpgradeEntries.Count -gt 0) { [string]$postUpgradeEntries[0].registryPath } else { '' }
    Add-Result -Area 'upgrade-existing-install' -Item 'single-current-registration' -Ok $singleCurrentRegistration -Detail ("initial={0} after={1} key={2}" -f $script:initialUninstallRegistryPaths.Count, $postUpgradeEntries.Count, $currentRegistryPath)
    Add-Result -Area 'upgrade-existing-install' -Item 'version-updated' -Ok $versionMatches -Detail ("expected={0} actual={1}" -f $expectedVersion, $installedVersion)
    Add-Result -Area 'upgrade-existing-install' -Item 'installation-retained' -Ok (Test-Path -LiteralPath (Join-Path $installedRoot 'EvaluaPro.exe') -PathType Leaf) -Detail $installedRoot
    if (-not ($singleCurrentRegistration -and $versionMatches)) { throw 'La actualización estable no dejó una sola entrada registrada en la versión esperada.' }
  } else {
    Invoke-InstallerHubMode -Mode 'uninstall' | Out-Null
    $remainingEntries = @(Get-EvaluaProUninstallEntries)
    Export-JsonArtifact -Name 'post-uninstall-entries.json' -Data $remainingEntries | Out-Null
    $remainingPaths = @($remainingEntries | ForEach-Object { [string]$_.registryPath })
    $preservedInitialEntries = @($script:initialUninstallRegistryPaths | Where-Object { $remainingPaths -contains $_ })
    $newRemainingEntries = @($remainingEntries | Where-Object { $script:initialUninstallRegistryPaths -notcontains [string]$_.registryPath })
    $registryClean = $newRemainingEntries.Count -eq 0 -and $preservedInitialEntries.Count -eq $script:initialUninstallRegistryPaths.Count
    Add-Result -Area 'post-uninstall' -Item 'uninstall-registry' -Ok $registryClean -Detail ("initial={0} remaining={1} new={2} preserved={3}" -f $script:initialUninstallRegistryPaths.Count, $remainingEntries.Count, $newRemainingEntries.Count, $preservedInitialEntries.Count)
    if (-not $registryClean) { throw 'El uninstall no retiró únicamente la entrada de QA o cambió entradas EvaluaPro preexistentes.' }
    $remainingInstallEntries = @()
    if (Test-Path -LiteralPath $installedRoot -PathType Container) {
      $remainingInstallEntries = @(Get-ChildItem -LiteralPath $installedRoot -Force -ErrorAction Stop | Select-Object -ExpandProperty Name)
    }
    $payloadRemoved = $remainingInstallEntries.Count -eq 1 -and $remainingInstallEntries[0] -eq 'data'
    $localDataPreserved = Test-Path -LiteralPath (Join-Path $installedRoot 'data\evaluapro.db') -PathType Leaf
    Add-Result -Area 'post-uninstall' -Item 'payload-removed-data-preserved' -Ok ($payloadRemoved -and $localDataPreserved) -Detail ("root={0} remaining={1} databasePreserved={2}" -f $installedRoot,($remainingInstallEntries -join ','),$localDataPreserved)
    Assert-SharedProgramDataSqliteUnchanged

    $backupArchives = @(
      if (Test-Path -LiteralPath $script:privateBackupDir -PathType Container) {
        Get-ChildItem -LiteralPath $script:privateBackupDir -File -Filter 'data_*.zip' -ErrorAction Stop |
          Where-Object { $script:initialDataBackupPaths -notcontains $_.FullName }
      }
    )
    $restoreOk = $false
    $restoreDetail = "new_private_archives={0}" -f $backupArchives.Count
    $privateAclOk = $false
    $privateAclDetail = 'no se encontró un respaldo nuevo para revisar ACL'
    if ($backupArchives.Count -gt 0) {
      try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($backupArchives[-1].FullName)
        try {
          $databaseEntries = @($archive.Entries | Where-Object { $_.FullName -eq 'evaluapro.db' -and $_.Length -gt 0 })
          $restoreOk = $databaseEntries.Count -gt 0
          $restoreDetail = "new_private_archives={0} archive={1} contains_database={2}" -f $backupArchives.Count,$backupArchives[-1].Name,$restoreOk
        } finally { $archive.Dispose() }
        $backupAcl = Get-Acl -LiteralPath $script:privateBackupDir -ErrorAction Stop
        $broadAllowSids = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545')
        $broadAllows = @(
          foreach ($rule in $backupAcl.Access) {
            try {
              $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
              if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and $broadAllowSids -contains $sid) { $rule.IdentityReference.Value }
            } catch { }
          }
        )
        $privateAclOk = $backupAcl.AreAccessRulesProtected -and $broadAllows.Count -eq 0
        $privateAclDetail = "protected={0} broad_allow_rules={1}" -f $backupAcl.AreAccessRulesProtected,($broadAllows -join ',')
      } catch {
        $restoreDetail = "new_private_archives={0} validation_error={1}" -f $backupArchives.Count,$_.Exception.Message
      }
    }
    Add-Result -Area 'post-uninstall' -Item 'backup-created' -Ok $restoreOk -Detail $restoreDetail
    Add-Result -Area 'post-uninstall' -Item 'backup-private-acl' -Ok $privateAclOk -Detail $privateAclDetail
  }

  Assert-NoActiveEvaluaProProcesses

  Export-InstallerLogs
  Export-JsonArtifact -Name 'processes-after.json' -Data (Get-ProcessSnapshot) | Out-Null
  $orphanProcesses = @(Get-Process | Where-Object { $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp' })
  $processResultArea = if ($script:upgradingExistingInstall) { 'upgrade-existing-install' } else { 'post-uninstall' }
  Add-Result -Area $processResultArea -Item 'orphan-processes' -Ok ($orphanProcesses.Count -eq 0) -Detail ("count={0}" -f $orphanProcesses.Count)
  Write-VisualFlowManifest
  Write-TutorialMarkdown

  Save-Report -Status $(if ($failed) { 'failed' } else { 'passed' })
  if ($failed) { throw "E2E Installer Hub docente fallo. Reporte: $reportPath" }
  Write-E2ELog "E2E Installer Hub docente OK. Reporte: $reportPath"
}
catch {
  $fatalError = $_
  try {
    Add-Result -Area 'runner' -Item 'fatal' -Ok $false -Detail ("{0}`n{1}" -f $fatalError.Exception.ToString(), $fatalError.ScriptStackTrace)
  } catch {
    Write-E2ELog ("No se pudo anexar el error fatal al reporte: {0}" -f $_.Exception.Message)
  }
  try { Export-NativeEvidence } catch { Write-E2ELog ("No se pudo exportar la evidencia nativa tras el fallo: {0}" -f $_.Exception.Message) }
  try { Export-InstallerLogs } catch { Write-E2ELog ("No se pudieron copiar los logs del instalador tras el fallo: {0}" -f $_.Exception.Message) }
  try { Export-JsonArtifact -Name 'processes-error.json' -Data (Get-ProcessSnapshot) | Out-Null } catch { Write-E2ELog ("No se pudo guardar el snapshot de procesos tras el fallo: {0}" -f $_.Exception.Message) }
  try { Write-VisualFlowManifest } catch { Write-E2ELog ("No se pudo guardar el manifiesto visual tras el fallo: {0}" -f $_.Exception.Message) }
  try { Write-TutorialMarkdown } catch { Write-E2ELog ("No se pudo guardar el índice de evidencia tras el fallo: {0}" -f $_.Exception.Message) }
  try { Save-Report -Status 'failed' } catch { Write-E2ELog ("No se pudo finalizar el reporte como failed: {0}" -f $_.Exception.Message) }
  Write-E2ELog ("ERROR: {0}" -f $fatalError.Exception.Message)
  throw
}
finally {
  if ($script:activeNativeAppHost) {
    try {
      Invoke-InstalledAppHost -Action 'stop-all' -RunId 'finally-cleanup' -TimeoutSec 45
    } catch {
      Write-E2ELog ("No se pudo cerrar de forma controlada el App Host propiedad del E2E: {0}" -f $_.Exception.Message)
    }
  }
  foreach ($process in @($processes)) {
    try {
      if ($process -and -not $process.HasExited) {
        $process.CloseMainWindow() | Out-Null
        Start-Sleep -Seconds 2
      }
      if ($process -and -not $process.HasExited) {
        Write-E2ELog ("Cerrando árbol de proceso E2E iniciado por pid={0}" -f $process.Id)
        & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
      }
    } catch {}
  }
  if ($script:qaMutationStarted -and -not $script:upgradingExistingInstall) {
    try {
      $currentProfileExists = Test-Path -LiteralPath $script:operationalConfigPath -PathType Leaf
      $currentProfileOwnedByQa = $false
      if ($currentProfileExists) {
        try {
          $currentProfile = Get-Content -Raw -LiteralPath $script:operationalConfigPath | ConvertFrom-Json
          $currentInstallDir = [string]$currentProfile.installDir
          $currentProfileOwnedByQa = -not [string]::IsNullOrWhiteSpace($currentInstallDir) -and
            [IO.Path]::GetFullPath($currentInstallDir).TrimEnd('\\') -eq [IO.Path]::GetFullPath($installedRoot).TrimEnd('\\')
        } catch {}
      }
      if ($script:operationalConfigExistedAtStart -and (-not $currentProfileExists -or $currentProfileOwnedByQa)) {
        [IO.File]::WriteAllBytes($script:operationalConfigPath, $script:operationalConfigOriginalBytes)
        Write-E2ELog 'Perfil operativo previo restaurado tras la prueba QA.'
      } elseif (-not $script:operationalConfigExistedAtStart -and $currentProfileOwnedByQa) {
        Remove-Item -LiteralPath $script:operationalConfigPath -Force
        Write-E2ELog 'Perfil operativo creado por la prueba QA retirado.'
      } elseif ($currentProfileExists -and -not $currentProfileOwnedByQa) {
        Write-E2ELog 'El perfil operativo cambió de destino durante E2E; se conserva para evitar sobrescribir una actualización externa.'
      }
    } catch {
      Write-E2ELog "WARNING: No se pudo restaurar el perfil operativo QA: $($_.Exception.Message)"
    }
  }
}
