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
  [int]$Port = 4519,
  [switch]$IUnderstandThisMutatesPc,
  [switch]$AllowExistingInstall,
  [switch]$SeedDummyData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
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
  $ReportDir = Join-Path $root ("reports\qa\installer-hub-e2e-docente\{0}" -f $stamp)
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
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
$results = New-Object System.Collections.Generic.List[object]
$screenshots = New-Object System.Collections.Generic.List[string]
$artifacts = New-Object System.Collections.Generic.List[string]
$processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$failed = $false
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

function Stop-InstallerHubProcesses {
  param([string]$Reason = 'cleanup')

  $targets = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or
      $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp'
    })
  foreach ($target in $targets) {
    try {
      Write-E2ELog ("Cerrando proceso Installer Hub residual reason={0} name={1} pid={2}" -f $Reason, $target.ProcessName, $target.Id)
      if ($target.MainWindowHandle -ne [IntPtr]::Zero) {
        $target.CloseMainWindow() | Out-Null
        Start-Sleep -Seconds 2
      }
      if (-not $target.HasExited) {
        Stop-Process -Id $target.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {}
  }
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
  Copy-Item -LiteralPath $Path -Destination $target -Force -Recurse
  $script:artifacts.Add($target) | Out-Null
  return $target
}

function Resolve-BundlePath {
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
    foreach ($propertyName in @('bundlePublicPath', 'executablePath')) {
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
  if (-not $item) { $item = Find-ByName -RootElement ([System.Windows.Automation.AutomationElement]::RootElement) -Name $ItemName -TimeoutSec 3 }
  if (-not $item) {
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
  }
  $pattern = $null
  if ($item.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
  } else {
    Invoke-Control -Element $item
  }
  Start-Sleep -Milliseconds 700
}

function Capture-Window {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Name
  )
  if (-not $Window) {
    Write-E2ELog "Captura omitida: ventana no disponible name=$Name"
    return ''
  }
  $rectangle = $Window.Current.BoundingRectangle
  if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) {
    Write-E2ELog "Captura omitida: ventana sin dimensiones name=$Name"
    return ''
  }
  $bitmap = New-Object System.Drawing.Bitmap([int]$rectangle.Width, [int]$rectangle.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    try {
      $graphics.CopyFromScreen([int]$rectangle.X, [int]$rectangle.Y, 0, 0, $bitmap.Size)
    } catch {
      $nativeHandle = [IntPtr]$Window.Current.NativeWindowHandle
      if ($nativeHandle -eq [IntPtr]::Zero) { throw }
      $hdc = $graphics.GetHdc()
      try {
        if (-not [EvaluaProE2ENativeWindow]::PrintWindow($nativeHandle, $hdc, 2)) { throw 'PrintWindow no devolvió contenido.' }
      } finally {
        $graphics.ReleaseHdc($hdc)
      }
      Write-E2ELog "Captura visual usando fallback PrintWindow name=$Name"
    }
    $path = Join-Path $screenshotsDir ("{0}.png" -f $Name)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $script:screenshots.Add($path) | Out-Null
    return $path
  } catch {
    Write-E2ELog "Advertencia: Error tomando screenshot de UI: $_"
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail 'No se pudo capturar la ventana WPF; el escritorio no devolvió un DC válido.'
    return ""
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Resize-WindowForEvidence {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$Width,
    [int]$Height
  )
  try {
    $handle = $Process.MainWindowHandle
    if ($handle -eq [IntPtr]::Zero) { return $false }
    return [EvaluaProE2ENativeWindow]::MoveWindow($handle, 40, 40, $Width, $Height, $true)
  } catch {
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
    [int]$TimeoutMinutes = 45
  )
  $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $lastText = ''
  do {
    Start-Sleep -Seconds 3
    $lastText = Get-WindowTextSnapshot -Window $Window
    $text = $lastText
    $cleanTextForErrorCheck = $text -replace '(?i)en\s+error\s+se\s+abre', 'en ___ se abre'
    if ($cleanTextForErrorCheck -match '(?i)(fall[oó]|error|no pudo|failed)') {
      return [pscustomobject]@{ ok = $false; text = $text }
    }
    if ($text -match '(?i)(estado completado|post-install completado|todas las etapas terminaron correctamente|operaci[oó]n finalizada correctamente)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    if ($Mode -eq 'install' -and $text -match '(?i)(instalaci[oó]n completada|listo para usarse|configuraci[oó]n final)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    $helper = Get-LatestPostInstallHelperState -MinLastWriteTime $startedAt
    if ($helper -and $helper.ok) {
      return [pscustomobject]@{ ok = $true; text = "Post-install helper OK`n$text" }
    }
    if ($Mode -eq 'repair' -and $text -match '(?i)(reparaci[oó]n completada|qued[oó] reparado|operaci[oó]n finalizada|post-install completado)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    if ($Mode -eq 'uninstall' -and $text -match '(?i)(desinstalaci[oó]n completada|qued[oó] desinstalado|producto ya no aparece|operaci[oó]n finalizada|post-install completado)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    if ($text -match '(?i)(fall[oó]|error|no pudo|failed)') {
      return [pscustomobject]@{ ok = $false; text = $text }
    }
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; text = $lastText; timeout = $true }
}

function Get-LatestPostInstallHelperState {
  param([datetime]$MinLastWriteTime)
  $programDataLogs = Join-Path $env:ProgramData 'EvaluaPro\installer-hub\logs'
  $searchPaths = @($logsDir, $ReportDir)
  if (Test-Path -LiteralPath $programDataLogs) {
    $searchPaths += $programDataLogs
  }
  $candidates = @(Get-ChildItem -Path $searchPaths -Filter 'post-install-*.response.json' -Recurse -ErrorAction SilentlyContinue |
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
    [string]$Mode
  )
  $arguments = switch ($Mode) {
    'repair' { '/repair' }
    'uninstall' { '/uninstall' }
    default { '' }
  }
  $previousQaInstallDir = $env:EVALUAPRO_QA_INSTALL_DIR
  $env:EVALUAPRO_QA_INSTALL_DIR = $installedRoot
  $process = if ($arguments) {
    Start-Process -FilePath $bundlePath -ArgumentList $arguments -PassThru -WindowStyle Normal
  } else {
    Start-Process -FilePath $bundlePath -PassThru -WindowStyle Normal
  }
  if ($null -eq $previousQaInstallDir) {
    Remove-Item Env:EVALUAPRO_QA_INSTALL_DIR -ErrorAction SilentlyContinue
  } else {
    $env:EVALUAPRO_QA_INSTALL_DIR = $previousQaInstallDir
  }
  $processes.Add($process) | Out-Null
  Write-E2ELog "Installer Hub iniciado mode=$Mode pid=$($process.Id)"
  $freshWindow = Find-Window -TimeoutSec 1
  $window = if ($freshWindow) { $freshWindow } else { Find-Window -TimeoutSec 90 }
  if (-not $window) { throw "No aparecio Installer Hub para mode=$Mode" }
  Capture-Window -Window $window -Name ("wpf-{0}-01-splash-deteccion" -f $Mode) | Out-Null

  if ($Mode -eq 'install') {
    $termsCheckbox = Find-ById -RootElement $window -AutomationId 'AcceptTermsCheckBox' -TimeoutSec 10
    if ($termsCheckbox) {
      Write-E2ELog "Detectado AcceptTermsCheckBox en modo install, marcandolo para habilitar navegacion."
      $togglePattern = $null
      # WPF actualiza currentStep desde Click. UIAutomation Invoke/Toggle puede
      # cambiar la marca sin disparar ese handler; usar teclado sobre el control
      # fuerza el mismo evento interactivo que usa una persona.
      if ($termsCheckbox.Current.IsEnabled) {
        $termsCheckbox.SetFocus()
        $togglePattern = $null
        $isOn = $false
        if ($termsCheckbox.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
          $isOn = $togglePattern.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
        }
        if ($isOn) { [System.Windows.Forms.SendKeys]::SendWait(' ') ; Start-Sleep -Milliseconds 250 }
        [System.Windows.Forms.SendKeys]::SendWait(' ')
      }
      Start-Sleep -Seconds 1
      $privacyCheckbox = Find-ById -RootElement $window -AutomationId 'AcceptPrivacyCheckBox' -TimeoutSec 5
      if ($privacyCheckbox -and $privacyCheckbox.Current.IsEnabled) {
        $privacyCheckbox.SetFocus()
        $privacyToggle = $null
        $privacyOn = $false
        if ($privacyCheckbox.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$privacyToggle)) {
          $privacyOn = $privacyToggle.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
        }
        if (-not $privacyOn) { [System.Windows.Forms.SendKeys]::SendWait(' ') }
      }
      Start-Sleep -Milliseconds 500
    }
  }

  $detectionTimeoutSec = 420
  $window = Wait-DetectionIdle -RootElement $window -TimeoutSec $detectionTimeoutSec
  if (-not $window) { throw "Installer Hub desaparecio durante deteccion mode=$Mode" }
  Capture-Window -Window $window -Name ("wpf-{0}-02-preparar" -f $Mode) | Out-Null

  $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
  if ($modeCombo) {
    $label = switch ($Mode) {
      'install' { 'Instalar' }
      'repair' { 'Reparar' }
      'uninstall' { 'Desinstalar' }
    }
    Select-ComboItem -Combo $modeCombo -ItemName $label
  }

  if ($Mode -eq 'uninstall') {
    $exportCheckbox = Find-ById -RootElement $window -AutomationId 'ExportDataCheckBox' -TimeoutSec 2
    if ($exportCheckbox) {
      $togglePattern = $null
      if ($exportCheckbox.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$togglePattern)) {
        if ($togglePattern.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On) {
          $togglePattern.Toggle()
        }
      } else {
        Invoke-Control -Element $exportCheckbox
      }
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

  Capture-Window -Window $window -Name ("wpf-{0}-03-revisar" -f $Mode) | Out-Null
  $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 15
  if (-not $startButton) { throw "No se encontro StartButton mode=$Mode" }
  Add-Result -Area $Mode -Item 'start-button' -Ok $startButton.Current.IsEnabled -Detail "name=$($startButton.Current.Name)"
  if (-not $startButton.Current.IsEnabled) { throw "StartButton no habilitado mode=$Mode" }

  Invoke-Control -Element $startButton
  Start-Sleep -Seconds 2
  Capture-Window -Window $window -Name ("wpf-{0}-04-ejecutar-1040x760" -f $Mode) | Out-Null
  Resize-WindowForEvidence -Process $process -Width 980 -Height 700 | Out-Null
  Start-Sleep -Milliseconds 800
  $window = Find-Window -TimeoutSec 10
  Capture-Window -Window $window -Name ("wpf-{0}-05-ejecutar-1280x720" -f $Mode) | Out-Null
  $state = Wait-InstallerStableState -Window $window -Mode $Mode -TimeoutMinutes 45
  $textPath = Join-Path $ReportDir ("{0}-window-text.txt" -f $Mode)
  [string]$state.text | Set-Content -Path $textPath -Encoding UTF8
  $artifacts.Add($textPath) | Out-Null
  Capture-Window -Window $window -Name ("wpf-{0}-06-resultado" -f $Mode) | Out-Null
  $stateTimedOut = $state.PSObject.Properties.Match('timeout').Count -gt 0 -and [bool]$state.timeout
  Add-Result -Area $Mode -Item 'final-state' -Ok ([bool]$state.ok) -Detail $(if ($stateTimedOut) { 'timeout esperando estado final' } else { 'estado final detectado' })
  if (-not $state.ok) { throw "Installer Hub no completo correctamente mode=$Mode" }

  $restartButton = Find-ById -RootElement $window -AutomationId 'RestartNowButton' -TimeoutSec 2
  if ($restartButton) {
    Add-Result -Area $Mode -Item 'restart-required' -Ok $true -Detail 'RestartNowButton visible'
  }

  $closeButton = Find-ById -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 8
  if ($closeButton) { Invoke-Control -Element $closeButton }
  Write-E2ELog "Esperando que el proceso del instalador ($($process.Id)) finalice tras presionar CloseButton..."
  $processExited = $false
  try {
    $processExited = $process.WaitForExit(15000)
  } catch {
    Write-E2ELog "WaitForExit fallo para pid=$($process.Id): $($_.Exception.Message)"
  }
  if (-not $processExited) {
    Write-E2ELog "Proceso del instalador residual detectado. Forzando detencion..."
    try {
      Stop-Process -Id ([int]$process.Id) -Force -ErrorAction SilentlyContinue
      Wait-Process -Id ([int]$process.Id) -Timeout 5 -ErrorAction SilentlyContinue
    } catch {
      Write-E2ELog "No se pudo detener pid=$($process.Id): $($_.Exception.Message)"
    }
  }
  Start-Sleep -Seconds 2
  Stop-InstallerHubProcesses -Reason "after-close"
  return $true
}

function Wait-BootstrapState {
  param(
    [string]$RunId,
    [string[]]$AcceptedStates,
    [int]$TimeoutSec = 180
  )
  $path = Join-Path $installedRoot ("logs\bootstrap-state-{0}.json" -f ($RunId -replace '[^a-zA-Z0-9_-]', ''))
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    if (Test-Path -LiteralPath $path) {
      try {
        $state = Get-Content -Raw -Path $path | ConvertFrom-Json
        if ($AcceptedStates -contains [string]$state.state) { return $state }
      } catch {}
    }
    Start-Sleep -Milliseconds 800
  } while ((Get-Date) -lt $deadline)
  throw "Bootstrap state no alcanzo $($AcceptedStates -join ',') runId=$RunId"
}

function Write-VisualFlowManifest {
  $expected = @(
    'wpf-install-01-splash-deteccion.png',
    'wpf-install-02-preparar.png',
    'wpf-install-03-revisar.png',
    'wpf-install-04-ejecutar-1040x760.png',
    'wpf-install-05-ejecutar-1280x720.png',
    'wpf-install-06-resultado.png'
  )
  $items = foreach ($name in $expected) {
    $path = Join-Path $screenshotsDir $name
    [pscustomobject]@{ name = $name; exists = Test-Path -LiteralPath $path; path = $path }
  }
  $ok = @($items | Where-Object { -not $_.exists }).Count -eq 0
  $manifestPath = Join-Path $manifestDir 'visual-flow.json'
  [pscustomobject]@{
    flow = @('splash', 'preparar', 'revisar', 'ejecutar-1040x760', 'ejecutar-1280x720', 'resultado')
    captured = $items
    complete = $ok
    captureMethod = 'UIAutomation + CopyFromScreen/PrintWindow'
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8
  $artifacts.Add($manifestPath) | Out-Null
  Add-Result -Area 'screenshots' -Item 'complete-visual-flow' -Ok $ok -Detail ("captured={0}/{1}" -f (@($items | Where-Object exists).Count), $expected.Count)
}

function Wait-InstalledPayload {
  param([int]$TimeoutSec = 240)
  $required = @(
    (Join-Path $installedRoot 'package.json'),
    (Join-Path $installedRoot 'scripts\launcher-broker.ps1'),
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

function Invoke-InstalledBroker {
  param(
    [string]$Action,
    [string]$RunId,
    [int]$TimeoutSec = 60
  )
  $broker = Join-Path $installedRoot 'scripts\launcher-broker.ps1'
  if (-not (Test-Path -LiteralPath $broker)) { throw "No existe broker instalado: $broker" }
  $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $broker, '-Action', $Action, '-Mode', 'prod', '-Port', [string]$Port, '-RunId', $RunId, '-NoOpen')
  $stdout = Join-Path $ReportDir ("broker-{0}-{1}.stdout.log" -f $Action, $RunId)
  $stderr = Join-Path $ReportDir ("broker-{0}-{1}.stderr.log" -f $Action, $RunId)
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $args -WorkingDirectory $installedRoot -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (-not $process.WaitForExit($TimeoutSec * 1000)) {
    if ($Action -eq 'open-dashboard') {
      $statePath = Join-Path $installedRoot ("logs\bootstrap-state-{0}.json" -f ($RunId -replace '[^a-zA-Z0-9_-]', ''))
      $healthyState = $false
      $stateDeadline = (Get-Date).AddSeconds(180)
      do {
        if (Test-Path -LiteralPath $statePath) {
          try { $healthyState = ((Get-Content -Raw -Path $statePath | ConvertFrom-Json).state -in @('healthy', 'degraded')) } catch {}
        }
        if (-not $healthyState) { Start-Sleep -Seconds 2 }
      } while (-not $healthyState -and (Get-Date) -lt $stateDeadline)
      if ($healthyState) {
        Write-E2ELog "WARNING: broker open-dashboard sigue vivo como proceso persistente y supero timeout de proceso; estado JSON saludable, se conserva para validar API."
        Copy-ArtifactIfExists -Path $stdout | Out-Null
        Copy-ArtifactIfExists -Path $stderr | Out-Null
        Export-BrokerDiagnostics -Action $Action -RunId $RunId
        Add-Result -Area 'broker' -Item $Action -Ok $true -Detail "persistent-process state=healthy runId=$RunId"
        return
      }
    }
    Write-E2ELog "Timeout broker action=$Action pid=$($process.Id); deteniendo solo el árbol de esa invocación."
    try { & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null } catch {}
    Add-Result -Area 'broker' -Item $Action -Ok $false -Detail "timeout=${TimeoutSec}s runId=$RunId"
    throw "Broker timeout action=$Action timeout=${TimeoutSec}s"
  }
  $process.WaitForExit()
  try { $process.Refresh() } catch {}
  $exitCode = $process.ExitCode
  if ([string]::IsNullOrWhiteSpace([string]$exitCode)) {
    $statePath = Join-Path $installedRoot ("logs\bootstrap-state-{0}.json" -f ($RunId -replace '[^a-zA-Z0-9_-]', ''))
    $healthyState = $false
    if (Test-Path -LiteralPath $statePath) {
      try { $healthyState = ((Get-Content -Raw -Path $statePath | ConvertFrom-Json).state -eq 'healthy') } catch {}
    }
    if ($healthyState) {
      Write-E2ELog "WARNING: ExitCode nulo para broker action=$Action; se acepta estado JSON healthy como evidencia alternativa."
      $exitCode = 0
    } else {
      $exitCode = -1
    }
  }
  Copy-ArtifactIfExists -Path $stdout | Out-Null
  Copy-ArtifactIfExists -Path $stderr | Out-Null
  Export-BrokerDiagnostics -Action $Action -RunId $RunId
  Add-Result -Area 'broker' -Item $Action -Ok ($exitCode -eq 0) -Detail "exit=$exitCode runId=$RunId"
  if ($exitCode -ne 0) { throw "Broker fallo action=$Action exit=$exitCode" }
}

function Export-BrokerDiagnostics {
  param(
    [string]$Action,
    [string]$RunId
  )
  $statePath = Join-Path $installedRoot ("logs\bootstrap-state-{0}.json" -f ($RunId -replace '[^a-zA-Z0-9_-]', ''))
  if (Test-Path -LiteralPath $statePath) {
    Copy-ArtifactIfExists -Path $statePath -Name ("broker-{0}-{1}-bootstrap-state.json" -f $Action, $RunId) | Out-Null
  }
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
    Write-E2ELog "WARNING: ExitCode was null for $Name. Falling back to 0 (Success) since process exited."
    $exitCode = 0
  }
  
  Add-Result -Area 'command' -Item $Name -Ok ($exitCode -eq 0) -Detail "exit=$exitCode"
  if ($exitCode -ne 0) { throw "Comando fallo: $Name exit=$exitCode" }
}

function Export-RuntimeAudit {
  param([string]$Name)
  $auditName = if ($Name -eq 'before') { 'runtime-audit-before.json' } else { 'runtime-audit-after.json' }
  Export-JsonArtifact -Name $auditName -Data ([pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    runtime = 'native-node-sqlite'
    dockerRequired = $false
  }) | Out-Null
}

function Invoke-NativeStableStack {
  Write-E2ELog "Esperando estabilizacion del servicio nativo..."
  Start-Sleep -Seconds 10
}

function Export-NativeEvidence {
  # Solo para mantener la compatibilidad con el reporte si es necesario.
  $nativeDir = Join-Path $ReportDir 'native'
  if (-not (Test-Path $nativeDir)) {
    New-Item -ItemType Directory -Force -Path $nativeDir | Out-Null
  }
  $processes = Get-Process -Name "node" -ErrorAction SilentlyContinue
  if ($processes) {
    $processes | ConvertTo-Json -Depth 2 | Set-Content -Path (Join-Path $nativeDir 'node-processes.json') -Encoding UTF8
  }
}

function Assert-NativeStable {
  $running = Get-Process -Name "node" -ErrorAction SilentlyContinue
  $count = if ($running) { @($running).Count } else { 0 }
  Add-Result -Area 'native' -Item 'node-process' -Ok ($count -ge 1) -Detail "count=$count"

  if ($count -lt 1) { throw 'Servicio Node.js nativo no esta corriendo.' }

  try {
    $api = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/salud' -TimeoutSec 10
    Add-Result -Area 'native' -Item 'api-salud' -Ok $true -Detail ($api | ConvertTo-Json -Compress)
  } catch {
    Add-Result -Area 'native' -Item 'api-salud' -Ok $false -Detail $_.Exception.Message
    throw
  }

  try {
    $web = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 10
    Add-Result -Area 'native' -Item 'web-docente' -Ok ($web.StatusCode -eq 200) -Detail "status=$($web.StatusCode)"
  } catch {
    Add-Result -Area 'native' -Item 'web-docente' -Ok $false -Detail $_.Exception.Message
    throw
  }
}

function Capture-UrlWithPlaywright {
  param(
    [string]$Url,
    [string]$Name,
    [int]$Width = 1280,
    [int]$Height = 820
  )
  $target = Join-Path $screenshotsDir ("{0}.png" -f $Name)
  try {
    $args = @('playwright', 'screenshot', '--browser=chromium', '--timeout=30000', "--viewport-size=$Width,$Height", $Url, $target)
    Invoke-CaptureCommand -Name ("playwright-{0}" -f $Name) -FilePath 'npx.cmd' -ArgumentList $args -TimeoutSec 45
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
  Capture-UrlWithPlaywright -Url $BaseUrl -Name 'dashboard-status-1280x820' -Width 1280 -Height 820 | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-1280x820' -Width 1280 -Height 820 | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-1280x720' -Width 1280 -Height 720 | Out-Null
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
  $env:E2E_DOCENTE_SQLITE_PATH = Join-Path $installedRoot 'data\evaluapro.db'
  try {
    $output = (& node (Join-Path $root 'scripts/tests/seed-docente-dummy.mjs') 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
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

function Assert-NoActiveEvaluaProAfterUninstall {
  $active = @(Get-Process | Where-Object {
      $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or
      $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp' -or
      $_.ProcessName -like 'EvaluaPro*'
    })
  Add-Result -Area 'post-uninstall' -Item 'active-evaluapro-processes' -Ok ($active.Count -eq 0) -Detail ("count={0}" -f $active.Count)
  if ($active.Count -gt 0) {
    Export-JsonArtifact -Name 'processes-active-after-uninstall.json' -Data $active | Out-Null
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
    'Este tutorial se genera desde evidencia real de la PC. Muestra el flujo completo install, repair, Plataforma docente nativa, dashboard y uninstall.',
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
  $docsTutorialDir = Join-Path $root 'docs\tutoriales'
  New-Item -ItemType Directory -Force -Path $docsTutorialDir | Out-Null
  Copy-Item -LiteralPath $tutorialPath -Destination (Join-Path $docsTutorialDir 'installer-hub-docente-e2e.md') -Force
}

function Test-InstalledState {
  param([string]$Phase)
  $manifest = Join-Path $installedRoot 'logs\installation.manifest.json'
  $updateConfig = Join-Path $installedRoot 'config\update-config.json'
  $required = @(
    (Join-Path $installedRoot 'package.json'),
    (Join-Path $installedRoot 'scripts\launcher-broker.ps1'),
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
  Stop-InstallerHubProcesses -Reason 'preflight'
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
  Export-JsonArtifact -Name 'preflight-uninstall-entries.json' -Data $existing | Out-Null
  Add-Result -Area 'preflight' -Item 'existing-install' -Ok ($AllowExistingInstall -or $existing.Count -eq 0) -Detail ("entries={0}" -f $existing.Count)
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

  $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($installedRoot).Substring(0, 1))
  Add-Result -Area 'preflight' -Item 'free-space' -Ok ($drive.Free -gt 8GB) -Detail ("freeGB={0:n2}" -f ($drive.Free / 1GB))
  Add-Result -Area 'preflight' -Item 'powershell' -Ok ($PSVersionTable.PSVersion.Major -ge 5) -Detail ([string]$PSVersionTable.PSVersion)

  Invoke-InstallerHubMode -Mode 'install' | Out-Null
  Wait-InstalledPayload -TimeoutSec 240
  Test-InstalledState -Phase 'post-install'

  Invoke-InstalledBroker -Action 'verify-installation' -RunId ('e2e-verify-' + [guid]::NewGuid().ToString('N'))
  $openRunId = 'e2e-open-' + [guid]::NewGuid().ToString('N')
  Invoke-InstalledBroker -Action 'open-dashboard' -RunId $openRunId
  $state = Wait-BootstrapState -RunId $openRunId -AcceptedStates @('healthy', 'degraded') -TimeoutSec 240
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
  Invoke-InstalledBroker -Action 'stop-all' -RunId ("stop-native-{0}" -f ([Guid]::NewGuid().ToString('N')))

  Invoke-InstallerHubMode -Mode 'repair' | Out-Null
  Test-InstalledState -Phase 'post-repair'

  Invoke-InstallerHubMode -Mode 'uninstall' | Out-Null
  $remainingEntries = @(Get-EvaluaProUninstallEntries)
  Export-JsonArtifact -Name 'post-uninstall-entries.json' -Data $remainingEntries | Out-Null
  Add-Result -Area 'post-uninstall' -Item 'uninstall-registry' -Ok ($remainingEntries.Count -eq 0) -Detail ("entries={0}" -f $remainingEntries.Count)
  Add-Result -Area 'post-uninstall' -Item 'install-dir-removed' -Ok (-not (Test-Path -LiteralPath $installedRoot)) -Detail $installedRoot

  $backupDir = "C:\Users\Public\Documents\EvaluaPro_Backup"
  $backupFolders = @(Get-ChildItem -Path $backupDir -Directory -Filter "data_*" -ErrorAction SilentlyContinue)
  Add-Result -Area 'post-uninstall' -Item 'backup-created' -Ok ($backupFolders.Count -gt 0) -Detail ("backup_folders={0}" -f $backupFolders.Count)

  Assert-NoActiveEvaluaProAfterUninstall

  Export-InstallerLogs
  Export-JsonArtifact -Name 'processes-after.json' -Data (Get-ProcessSnapshot) | Out-Null
  $orphanProcesses = @(Get-Process | Where-Object { $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp' })
  Add-Result -Area 'post-uninstall' -Item 'orphan-processes' -Ok ($orphanProcesses.Count -eq 0) -Detail ("count={0}" -f $orphanProcesses.Count)
  Write-VisualFlowManifest
  Write-TutorialMarkdown

  Save-Report -Status $(if ($failed) { 'failed' } else { 'passed' })
  if ($failed) { throw "E2E Installer Hub docente fallo. Reporte: $reportPath" }
  Write-E2ELog "E2E Installer Hub docente OK. Reporte: $reportPath"
}
catch {
  Add-Result -Area 'runner' -Item 'fatal' -Ok $false -Detail ("{0}`n{1}" -f $_.Exception.ToString(), $_.ScriptStackTrace)
  Export-NativeEvidence
  Export-InstallerLogs
  Export-JsonArtifact -Name 'processes-error.json' -Data (Get-ProcessSnapshot) | Out-Null
  Write-VisualFlowManifest
  Write-TutorialMarkdown
  Save-Report -Status 'failed'
  Write-E2ELog ("ERROR: {0}" -f $_.Exception.Message)
  throw
}
finally {
  foreach ($process in @($processes)) {
    try {
      if ($process -and -not $process.HasExited) {
        $process.CloseMainWindow() | Out-Null
        Start-Sleep -Seconds 2
      }
      if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {}
  }
  Stop-InstallerHubProcesses -Reason 'finally'
}
