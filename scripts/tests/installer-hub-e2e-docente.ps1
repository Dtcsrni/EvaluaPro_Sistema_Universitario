<#
  installer-hub-e2e-docente.ps1
  Validacion real end-to-end del Installer Hub docente-local en VM desechable.

  IMPORTANTE: este script ejecuta install/repair/uninstall reales. No usar en la
  estacion principal. Requiere -IUnderstandThisMutatesVm para iniciar.
#>
[CmdletBinding()]
param(
  [string]$RootPath = '',
  [string]$ReportDir = '',
  [string]$InstallDir = '',
  [string]$ExpectedSnapshotName = 'pre-evaluapro-installer-e2e',
  [int]$Port = 4519,
  [switch]$IUnderstandThisMutatesVm,
  [switch]$AllowExistingInstall,
  [switch]$SkipSnapshotCheck
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

if (-not $IUnderstandThisMutatesVm) {
  throw 'Bloqueado: este E2E modifica la VM. Reejecuta con -IUnderstandThisMutatesVm en una VM limpia.'
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
}
'@

$startedAt = Get-Date
if ([string]::IsNullOrWhiteSpace($RootPath)) {
  $RootPath = Join-Path $PSScriptRoot '..\..'
}
$root = (Resolve-Path $RootPath).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($ReportDir)) {
  $ReportDir = Join-Path $root ("reports\qa\installer-hub-e2e-docente\{0}" -f $stamp)
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$screenshotsDir = Join-Path $ReportDir 'screenshots'
$dockerDir = Join-Path $ReportDir 'docker'
$logsDir = Join-Path $ReportDir 'logs'
$hashesDir = Join-Path $ReportDir 'hashes'
$manifestDir = Join-Path $ReportDir 'manifest'
$processesDir = Join-Path $ReportDir 'processes'
foreach ($dir in @($screenshotsDir, $dockerDir, $logsDir, $hashesDir, $manifestDir, $processesDir)) {
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
    Where-Object { $_.ProcessName -like 'EvaluaPro*' -or $_.ProcessName -like '*docker*' -or $_.ProcessName -like '*wsl*' } |
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
  $targetDir = if ($Name -match '^processes-') { $processesDir } elseif ($Name -match 'docker|health') { $dockerDir } elseif ($Name -match 'manifest|config') { $manifestDir } else { $ReportDir }
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

function Assert-Hash {
  param([string]$ExePath)
  $shaPath = "$ExePath.sha256"
  if (-not (Test-Path -LiteralPath $shaPath)) {
    throw "No existe SHA256 junto al bundle: $shaPath"
  }
  $expectedText = Get-Content -Path $shaPath -Raw
  $expected = ([regex]::Match($expectedText, '[A-Fa-f0-9]{64}')).Value.ToLowerInvariant()
  if (-not $expected) { throw "SHA256 esperado invalido: $shaPath" }
  $actual = (Get-FileHash -LiteralPath $ExePath -Algorithm SHA256).Hash.ToLowerInvariant()
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

function Assert-SnapshotContext {
  if ($SkipSnapshotCheck) {
    Add-Result -Area 'preflight' -Item 'snapshot' -Ok $true -Detail 'Omitido por -SkipSnapshotCheck.'
    return
  }

  $checkpointName = $env:EVALUAPRO_E2E_VM_SNAPSHOT
  if ([string]::IsNullOrWhiteSpace($checkpointName)) {
    Add-Result -Area 'preflight' -Item 'snapshot' -Ok $false -Detail 'Define EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e o usa -SkipSnapshotCheck.'
    throw 'No se confirmo snapshot de VM limpia.'
  }

  $ok = $checkpointName.Trim() -eq $ExpectedSnapshotName
  Add-Result -Area 'preflight' -Item 'snapshot' -Ok $ok -Detail "EVALUAPRO_E2E_VM_SNAPSHOT=$checkpointName"
  if (-not $ok) { throw "Snapshot esperado '$ExpectedSnapshotName' no confirmado." }
}

function Find-Window {
  param([int]$TimeoutSec = 60)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    'EvaluaPro Installer Hub'
  )
  do {
    $window = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst(
      [System.Windows.Automation.TreeScope]::Children,
      $condition
    )
    if ($window) { return $window }
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
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    $AutomationId
  )
  do {
    $element = $RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($element) { return $element }
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
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $condition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Name
  )
  do {
    $element = $RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($element) { return $element }
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

    $next = Find-ById -RootElement $RootElement -AutomationId 'NextButton' -TimeoutSec 1
    if ($next -and $next.Current.IsEnabled) { return $RootElement }

    $detect = Find-ById -RootElement $RootElement -AutomationId 'DetectButton' -TimeoutSec 1
    if ($detect -and $detect.Current.IsEnabled) { return $RootElement }

    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  throw "La deteccion de prerequisitos no volvio a estado estable antes de $TimeoutSec segundos."
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
  if (-not $Window) { return '' }
  $rectangle = $Window.Current.BoundingRectangle
  if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) { return '' }
  $bitmap = New-Object System.Drawing.Bitmap([int]$rectangle.Width, [int]$rectangle.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen([int]$rectangle.X, [int]$rectangle.Y, 0, 0, $bitmap.Size)
    $path = Join-Path $screenshotsDir ("{0}.png" -f $Name)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $script:screenshots.Add($path) | Out-Null
    return $path
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
  do {
    Start-Sleep -Seconds 3
    $text = Get-WindowTextSnapshot -Window $Window
    if ($text -match '(?i)(fall[oó]|error|no pudo|failed)') {
      return [pscustomobject]@{ ok = $false; text = $text }
    }
    if ($Mode -eq 'install' -and $text -match '(?i)(instalaci[oó]n completada|listo para usarse|configuraci[oó]n final)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    if ($Mode -eq 'repair' -and $text -match '(?i)(reparaci[oó]n completada|qued[oó] reparado)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
    if ($Mode -eq 'uninstall' -and $text -match '(?i)(desinstalaci[oó]n completada|qued[oó] desinstalado|producto ya no aparece)') {
      return [pscustomobject]@{ ok = $true; text = $text }
    }
  } while ((Get-Date) -lt $deadline)
  return [pscustomobject]@{ ok = $false; text = (Get-WindowTextSnapshot -Window $Window); timeout = $true }
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
  $process = if ($arguments) {
    Start-Process -FilePath $bundlePath -ArgumentList $arguments -PassThru -WindowStyle Normal
  } else {
    Start-Process -FilePath $bundlePath -PassThru -WindowStyle Normal
  }
  $processes.Add($process) | Out-Null
  Write-E2ELog "Installer Hub iniciado mode=$Mode pid=$($process.Id)"
  $window = Find-Window -TimeoutSec 90
  if (-not $window) { throw "No aparecio Installer Hub para mode=$Mode" }
  Capture-Window -Window $window -Name ("wpf-{0}-01-splash-deteccion" -f $Mode) | Out-Null
  $window = Wait-DetectionIdle -RootElement $window -TimeoutSec 240
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

  $detectButton = Find-ById -RootElement $window -AutomationId 'DetectButton' -TimeoutSec 5
  if ($detectButton -and $detectButton.Current.IsEnabled) {
    Invoke-Control -Element $detectButton
    $window = Wait-DetectionIdle -RootElement $window -TimeoutSec 240
    if (-not $window) { throw "Installer Hub desaparecio durante deteccion manual mode=$Mode" }
  }

  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton) {
    $nextButton = Wait-ControlEnabled -RootElement $window -AutomationId 'NextButton' -TimeoutSec 180
    Invoke-Control -Element $nextButton
    Start-Sleep -Seconds 1
    $window = Find-Window -TimeoutSec 10
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
  Capture-Window -Window $window -Name ("wpf-{0}-05-ejecutar-980x700" -f $Mode) | Out-Null
  $state = Wait-InstallerStableState -Window $window -Mode $Mode -TimeoutMinutes 45
  $textPath = Join-Path $ReportDir ("{0}-window-text.txt" -f $Mode)
  [string]$state.text | Set-Content -Path $textPath -Encoding UTF8
  $artifacts.Add($textPath) | Out-Null
  Capture-Window -Window $window -Name ("wpf-{0}-06-resultado" -f $Mode) | Out-Null
  Add-Result -Area $Mode -Item 'final-state' -Ok ([bool]$state.ok) -Detail $(if ($state.timeout) { 'timeout esperando estado final' } else { 'estado final detectado' })
  if (-not $state.ok) { throw "Installer Hub no completo correctamente mode=$Mode" }

  $closeButton = Find-ById -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 8
  if ($closeButton) { Invoke-Control -Element $closeButton }
  Start-Sleep -Seconds 4
  if (-not $process.HasExited) {
    try { $process.CloseMainWindow() | Out-Null } catch {}
  }
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

function Invoke-InstalledBroker {
  param(
    [string]$Action,
    [string]$RunId
  )
  $broker = Join-Path $installedRoot 'scripts\launcher-broker.ps1'
  if (-not (Test-Path -LiteralPath $broker)) { throw "No existe broker instalado: $broker" }
  $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $broker, '-Action', $Action, '-Mode', 'prod', '-Port', [string]$Port, '-RunId', $RunId, '-NoOpen')
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
  Add-Result -Area 'broker' -Item $Action -Ok ($proc.ExitCode -eq 0) -Detail "exit=$($proc.ExitCode) runId=$RunId"
  if ($proc.ExitCode -ne 0) { throw "Broker fallo action=$Action exit=$($proc.ExitCode)" }
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
  Copy-ArtifactIfExists -Path $stdout -Name ("{0}.stdout.log" -f $Name) | Out-Null
  Copy-ArtifactIfExists -Path $stderr -Name ("{0}.stderr.log" -f $Name) | Out-Null
  Add-Result -Area 'docker' -Item $Name -Ok ($process.ExitCode -eq 0) -Detail "exit=$($process.ExitCode)"
  if ($process.ExitCode -ne 0) { throw "Comando fallo: $Name exit=$($process.ExitCode)" }
}

function Invoke-DockerStableStack {
  # Contrato operativo: docker compose --profile prod up --build -d mongo_local api_docente_prod web_docente_prod
  Invoke-CaptureCommand -Name 'docker-compose-prod-up' -FilePath 'docker' -ArgumentList @('compose', '--profile', 'prod', 'up', '--build', '-d', 'mongo_local', 'api_docente_prod', 'web_docente_prod') -TimeoutSec 1200
}

function Export-DockerEvidence {
  $psJsonPath = Join-Path $dockerDir 'docker-ps.json'
  $inspectPath = Join-Path $dockerDir 'docker-inspect.json'
  $healthPath = Join-Path $dockerDir 'healthchecks.json'
  $logsOutDir = Join-Path $dockerDir 'docker-logs'
  New-Item -ItemType Directory -Force -Path $logsOutDir | Out-Null

  try {
    & docker compose --profile prod ps --format json | Set-Content -Path $psJsonPath -Encoding UTF8
    $artifacts.Add($psJsonPath) | Out-Null
  } catch {}

  $containerIds = @()
  try {
    $containerIds = @(& docker compose --profile prod ps -q mongo_local api_docente_prod web_docente_prod | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  } catch {}

  if ($containerIds.Count -gt 0) {
    try {
    & docker inspect $containerIds | Set-Content -Path $inspectPath -Encoding UTF8
      $artifacts.Add($inspectPath) | Out-Null
      $inspect = Get-Content -Raw -Path $inspectPath | ConvertFrom-Json
      $health = foreach ($item in @($inspect)) {
        [pscustomobject]@{
          name = ([string]$item.Name).TrimStart('/')
          id = [string]$item.Id
          state = [string]$item.State.Status
          health = [string]$item.State.Health.Status
        }
      }
      $health | ConvertTo-Json -Depth 8 | Set-Content -Path $healthPath -Encoding UTF8
      $artifacts.Add($healthPath) | Out-Null
    } catch {}
  }

  foreach ($service in @('mongo_local', 'api_docente_prod', 'web_docente_prod')) {
    try {
      $logPathService = Join-Path $logsOutDir ("{0}.log" -f $service)
      & docker compose --profile prod logs --no-color --tail 300 $service | Set-Content -Path $logPathService -Encoding UTF8
      $artifacts.Add($logPathService) | Out-Null
    } catch {}
  }
}

function Assert-DockerStable {
  $required = @('mongo_local', 'api_docente_prod', 'web_docente_prod')
  $ids = @(& docker compose --profile prod ps -q $required | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  Add-Result -Area 'docker' -Item 'container-count' -Ok ($ids.Count -ge 3) -Detail "count=$($ids.Count)"
  if ($ids.Count -lt 3) { throw 'Docker stack prod incompleto.' }

  $inspect = & docker inspect $ids | ConvertFrom-Json
  foreach ($container in @($inspect)) {
    $name = ([string]$container.Name).TrimStart('/')
    $running = [string]$container.State.Status -eq 'running'
    $healthy = if ($container.State.Health) { [string]$container.State.Health.Status -eq 'healthy' } else { $running }
    Add-Result -Area 'docker' -Item $name -Ok ($running -and $healthy) -Detail "state=$($container.State.Status) health=$($container.State.Health.Status)"
    if (-not ($running -and $healthy)) { throw "Contenedor no estable: $name" }
  }

  try {
    $api = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/salud' -TimeoutSec 10
    Add-Result -Area 'docker' -Item 'api-salud' -Ok $true -Detail ($api | ConvertTo-Json -Compress)
  } catch {
    Add-Result -Area 'docker' -Item 'api-salud' -Ok $false -Detail $_.Exception.Message
    throw
  }

  try {
    $web = Invoke-WebRequest -Uri 'http://127.0.0.1:4173' -UseBasicParsing -TimeoutSec 10
    Add-Result -Area 'docker' -Item 'web-docente' -Ok ($web.StatusCode -eq 200) -Detail "status=$($web.StatusCode)"
  } catch {
    Add-Result -Area 'docker' -Item 'web-docente' -Ok $false -Detail $_.Exception.Message
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
    Invoke-CaptureCommand -Name ("playwright-{0}" -f $Name) -FilePath 'npx.cmd' -ArgumentList $args -TimeoutSec 90
    if (Test-Path -LiteralPath $target) {
      $screenshots.Add($target) | Out-Null
      Add-Result -Area 'screenshots' -Item $Name -Ok $true -Detail $Url
      return $target
    }
  } catch {
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail $_.Exception.Message
  }
  return ''
}

function Capture-DashboardScreenshots {
  param([string]$BaseUrl)
  if ([string]::IsNullOrWhiteSpace($BaseUrl)) { return }
  Capture-UrlWithPlaywright -Url $BaseUrl -Name 'dashboard-status-1280x820' -Width 1280 -Height 820 | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-1280x820' -Width 1280 -Height 820 | Out-Null
  Capture-UrlWithPlaywright -Url 'http://127.0.0.1:4173' -Name 'web-docente-980x700' -Width 980 -Height 700 | Out-Null
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
    'Este tutorial se genera desde la evidencia real de VM. Muestra el flujo completo install, repair, Docker stable, dashboard y uninstall.',
    '',
    '## 1. Preparar',
    '- Confirmar flavor `docente-local`, modo y ruta.',
    '- Mantener configuracion avanzada colapsada salvo soporte.',
    '',
    '## 2. Revisar',
    '- Ejecutar prerequisitos.',
    '- Continuar solo si el Hub queda listo o documenta remediacion/reinicio.',
    '',
    '## 3. Ejecutar',
    '- Instalar, reparar o desinstalar desde el boton primario.',
    '- No cerrar la ventana mientras exista operacion busy.',
    '',
    '## 4. Estado estable Docker',
    '- `mongo_local`, `api_docente_prod` y `web_docente_prod` deben estar `running` y `healthy`.',
    '- API: `http://127.0.0.1:4000/api/salud` debe responder 200.',
    '- Web docente: `http://127.0.0.1:4173` debe responder 200.',
    '- Dashboard: `/api/status` debe estar `healthy` o `degraded`, nunca `failed`.',
    '',
    '## 5. Evidencia',
    '- Reporte JSON: `report.json`.',
    '- Docker: `docker/`.',
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
  Assert-SnapshotContext

  $bundlePath = Resolve-BundlePath
  Assert-Hash -ExePath $bundlePath
  Copy-ArtifactIfExists -Path $bundlePath -Name (Split-Path -Leaf $bundlePath) | Out-Null
  Copy-ArtifactIfExists -Path "$bundlePath.sha256" | Out-Null
  Copy-ArtifactIfExists -Path (Join-Path (Split-Path -Parent $bundlePath) 'SHASUMS256.txt') | Out-Null
  Copy-ArtifactIfExists -Path (Join-Path $root 'dist\installer\EvaluaPro-release-manifest.json') | Out-Null

  if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path ${env:ProgramFiles} 'EvaluaPro'
  }
  $installedRoot = $InstallDir

  $existing = @(Get-EvaluaProUninstallEntries)
  Export-JsonArtifact -Name 'preflight-uninstall-entries.json' -Data $existing | Out-Null
  Add-Result -Area 'preflight' -Item 'existing-install' -Ok ($AllowExistingInstall -or $existing.Count -eq 0) -Detail ("entries={0}" -f $existing.Count)
  if (-not $AllowExistingInstall -and $existing.Count -gt 0) {
    throw 'La VM no esta limpia: ya existe una instalacion EvaluaPro.'
  }

  $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($installedRoot).Substring(0, 1))
  Add-Result -Area 'preflight' -Item 'free-space' -Ok ($drive.Free -gt 8GB) -Detail ("freeGB={0:n2}" -f ($drive.Free / 1GB))
  Add-Result -Area 'preflight' -Item 'powershell' -Ok ($PSVersionTable.PSVersion.Major -ge 5) -Detail ([string]$PSVersionTable.PSVersion)

  Invoke-InstallerHubMode -Mode 'install' | Out-Null
  Test-InstalledState -Phase 'post-install'

  Invoke-InstalledBroker -Action 'verify-installation' -RunId ('e2e-verify-' + [guid]::NewGuid().ToString('N'))
  $openRunId = 'e2e-open-' + [guid]::NewGuid().ToString('N')
  Invoke-InstalledBroker -Action 'open-dashboard' -RunId $openRunId
  $state = Wait-BootstrapState -RunId $openRunId -AcceptedStates @('healthy', 'degraded') -TimeoutSec 240
  Export-JsonArtifact -Name 'dashboard-bootstrap-state.json' -Data $state | Out-Null
  Add-Result -Area 'dashboard' -Item 'bootstrap-state' -Ok ([string]$state.state -ne 'failed') -Detail ([string]$state.state)
  $dashboardBase = [string]$state.meta.base
  if (-not [string]::IsNullOrWhiteSpace($dashboardBase)) {
    try {
      $dashboardStatus = Invoke-RestMethod -Uri "$dashboardBase/api/status" -TimeoutSec 10
      Export-JsonArtifact -Name 'dashboard-status.json' -Data $dashboardStatus | Out-Null
      Add-Result -Area 'dashboard' -Item 'api-status' -Ok ($null -ne $dashboardStatus -and [string]$dashboardStatus.lifecycle.state -ne 'failed') -Detail $dashboardBase
    } catch {
      Add-Result -Area 'dashboard' -Item 'api-status' -Ok $false -Detail $_.Exception.Message
      throw
    }
  }

  Invoke-DockerStableStack
  Assert-DockerStable
  Export-DockerEvidence
  Capture-DashboardScreenshots -BaseUrl $dashboardBase

  Invoke-InstallerHubMode -Mode 'repair' | Out-Null
  Test-InstalledState -Phase 'post-repair'

  Invoke-InstallerHubMode -Mode 'uninstall' | Out-Null
  $remainingEntries = @(Get-EvaluaProUninstallEntries)
  Export-JsonArtifact -Name 'post-uninstall-entries.json' -Data $remainingEntries | Out-Null
  Add-Result -Area 'post-uninstall' -Item 'uninstall-registry' -Ok ($remainingEntries.Count -eq 0) -Detail ("entries={0}" -f $remainingEntries.Count)
  Add-Result -Area 'post-uninstall' -Item 'install-dir-removed' -Ok (-not (Test-Path -LiteralPath $installedRoot)) -Detail $installedRoot
  Assert-NoActiveEvaluaProAfterUninstall

  Export-InstallerLogs
  Export-JsonArtifact -Name 'processes-after.json' -Data (Get-ProcessSnapshot) | Out-Null
  $orphanProcesses = @(Get-Process | Where-Object { $_.ProcessName -like 'EvaluaPro-InstallerHub*' -or $_.ProcessName -eq 'EvaluaPro.BurnBootstrapperApp' })
  Add-Result -Area 'post-uninstall' -Item 'orphan-processes' -Ok ($orphanProcesses.Count -eq 0) -Detail ("count={0}" -f $orphanProcesses.Count)
  Write-TutorialMarkdown

  Save-Report -Status $(if ($failed) { 'failed' } else { 'passed' })
  if ($failed) { throw "E2E Installer Hub docente fallo. Reporte: $reportPath" }
  Write-E2ELog "E2E Installer Hub docente OK. Reporte: $reportPath"
}
catch {
  Add-Result -Area 'runner' -Item 'fatal' -Ok $false -Detail ("{0}`n{1}" -f $_.Exception.ToString(), $_.ScriptStackTrace)
  Export-DockerEvidence
  Export-InstallerLogs
  Export-JsonArtifact -Name 'processes-error.json' -Data (Get-ProcessSnapshot) | Out-Null
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
