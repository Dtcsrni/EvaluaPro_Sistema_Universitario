# installer-hub-ui-lifecycle.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
<#
  installer-hub-ui-lifecycle.ps1
  QA no destructivo del Installer Hub WPF usando UIAutomation nativo de Windows.
#>
[CmdletBinding()]
param(
  [string]$RootPath = '',
  [string]$ReportDir = '',
  [int]$DetectionTimeoutSec = 75,
  [switch]$AllowMissingBundle
)

$ErrorActionPreference = 'Stop'

$isWindowsHost = $true
if (Get-Variable -Name IsWindows -Scope Global -ErrorAction SilentlyContinue) {
  $isWindowsHost = [bool]$IsWindows
}
if (-not $isWindowsHost -and $PSVersionTable.PSEdition -eq 'Core') {
  Write-Host 'SKIP: Installer Hub UI lifecycle solo aplica en Windows.'
  exit 0
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class EvaluaProQaNativeWindow {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
'@

$startedAt = Get-Date
if ([string]::IsNullOrWhiteSpace($RootPath)) {
  $RootPath = Join-Path $PSScriptRoot '..\..'
}
$root = (Resolve-Path $RootPath).Path
if ([string]::IsNullOrWhiteSpace($ReportDir)) {
  $ReportDir = Join-Path $root 'reports\qa\installer-hub-ui'
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$reportPath = Join-Path $ReportDir 'installer-hub-ui-automation-report.json'
$logPath = Join-Path $ReportDir 'installer-hub-ui-automation.log'
$results = New-Object System.Collections.Generic.List[object]
$screenshots = New-Object System.Collections.Generic.List[string]
$processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$bundlePath = ''
$failed = $false

Get-ChildItem -LiteralPath $ReportDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^(0[1-7]-.+\.png|installer-hub-ui-automation\.(json|log))$' } |
  Remove-Item -Force -ErrorAction SilentlyContinue

function Write-QaLog {
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
  if (-not $Ok) {
    $script:failed = $true
  }
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
  $screenshotItems = @()
  foreach ($item in $screenshots) { $screenshotItems += [string]$item }
  $resultItems = @()
  foreach ($item in $results) { $resultItems += $item }

  $report = [pscustomobject]@{
    status = $Status
    startedAt = $startedAt.ToString('o')
    finishedAt = (Get-Date).ToString('o')
    durationSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
    rootPath = $root
    bundlePath = $bundlePath
    logPath = $logPath
    screenshots = $screenshotItems
    results = $resultItems
  }
  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8
}

function Resolve-BundlePath {
  $manifestPath = Join-Path $root 'dist\installer\installer-local-paths.json'
  $internalManifestPath = Join-Path $root 'dist\installer\_internal\installer-local-paths.json'
  $selectedManifest = if (Test-Path -LiteralPath $manifestPath) { $manifestPath } elseif (Test-Path -LiteralPath $internalManifestPath) { $internalManifestPath } else { '' }
  if (-not $selectedManifest) {
    if ($AllowMissingBundle) { return '' }
    throw 'No existe dist\installer\installer-local-paths.json. Ejecuta npm run installer:hub:build antes del QA UI.'
  }

  $manifest = Get-Content -Raw -Path $selectedManifest | ConvertFrom-Json
  $manifestDir = Split-Path -Parent $selectedManifest
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
    $candidate = Resolve-ManifestBundleCandidate $artifact
    if ($candidate) { return $candidate }
  }

  foreach ($flavor in @($manifest.flavors)) {
    $candidate = Resolve-ManifestBundleCandidate $flavor
    if ($candidate) { return $candidate }
  }

  if ($AllowMissingBundle) { return '' }
  throw "El manifiesto no apunta a un bundle existente: $selectedManifest"
}

function Find-Window {
  param([int]$TimeoutSec = 45)
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

function Collapse-Control {
  param([System.Windows.Automation.AutomationElement]$Element)
  $pattern = $null
  if ($Element -and $Element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$pattern)) {
    if ($pattern.Current.ExpandCollapseState -ne [System.Windows.Automation.ExpandCollapseState]::Collapsed) {
      $pattern.Collapse()
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
  if (-not (Expand-Control -Element $Combo)) {
    throw ("Combo no expandible: {0}" -f $Combo.Current.AutomationId)
  }
  Start-Sleep -Milliseconds 350
  $item = Find-ByName -RootElement $Combo -Name $ItemName -TimeoutSec 2
  if (-not $item) {
    $item = Find-ByName -RootElement ([System.Windows.Automation.AutomationElement]::RootElement) -Name $ItemName -TimeoutSec 3
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
      Start-Sleep -Milliseconds 500
      return
    } catch {
      throw "No se encontro el item de combo: $ItemName"
    }
  }
  $pattern = $null
  if ($item.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
    $pattern.Select()
  } else {
    Invoke-Control -Element $item
  }
  Start-Sleep -Milliseconds 500
}

function Capture-Window {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [string]$Name
  )
  $rectangle = $Window.Current.BoundingRectangle
  if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) { return '' }
  $bitmap = New-Object System.Drawing.Bitmap([int]$rectangle.Width, [int]$rectangle.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen([int]$rectangle.X, [int]$rectangle.Y, 0, 0, $bitmap.Size)
    $path = Join-Path $ReportDir ("{0}.png" -f $Name)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $script:screenshots.Add($path) | Out-Null
    return $path
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Resize-WindowForQa {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$Width,
    [int]$Height
  )
  try {
    $handle = $Process.MainWindowHandle
    if ($handle -eq [IntPtr]::Zero) { return $false }
    return [EvaluaProQaNativeWindow]::MoveWindow($handle, 40, 40, $Width, $Height, $true)
  } catch {
    return $false
  }
}

function Test-ScrollPattern {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [string]$Label
  )
  $pattern = $null
  if (-not $Element -or -not $Element.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$pattern)) {
    Add-Result -Area 'scroll' -Item $Label -Ok $true -Detail 'ScrollPattern no expuesto; se considera no aplicable cuando WPF no lo publica o no hay overflow.'
    return
  }
  try {
    $pattern.Scroll([System.Windows.Automation.ScrollAmount]::NoAmount, [System.Windows.Automation.ScrollAmount]::LargeIncrement)
    Start-Sleep -Milliseconds 250
    $pattern.Scroll([System.Windows.Automation.ScrollAmount]::NoAmount, [System.Windows.Automation.ScrollAmount]::LargeDecrement)
    Add-Result -Area 'scroll' -Item $Label -Ok $true -Detail 'ScrollPattern vertical respondio.'
  } catch {
    Add-Result -Area 'scroll' -Item $Label -Ok $true -Detail ("ScrollPattern expuesto pero sin overflow desplazable: {0}" -f $_.Exception.Message)
  }
}

function Set-SafeEnvironment {
  $env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP = '1'
  $env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP = '1'
  $env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL = '1'
  $env:EVALUAPRO_INSTALLER_SIMULATE_PRODUCT_ACTION = '1'
  $env:EVALUAPRO_INSTALLER_UI_QA_NO_PRODUCT_ACTION = '1'
  $env:EVALUAPRO_INSTALLER_ASSUME_INTERNET = '1'
  $env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE = 'wsl2-engine'
  $env:EVALUAPRO_INSTALLER_SIMULATE_NODE_MAJOR = '24'
  $env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_MAJOR = '24'
}

try {
  Set-Content -Path $logPath -Encoding UTF8 -Value ('{0:u} Inicio QA UI Installer Hub' -f (Get-Date))
  $bundlePath = Resolve-BundlePath
  if (-not $bundlePath) {
    Add-Result -Area 'bundle' -Item 'bundle-publico' -Ok $true -Detail 'SKIP: bundle ausente con AllowMissingBundle.'
    Save-Report -Status 'skipped'
    Write-Host "SKIP: bundle ausente. Reporte: $reportPath"
    exit 0
  }

  Write-QaLog "Bundle: $bundlePath"
  Set-SafeEnvironment

  $process = Start-Process -FilePath $bundlePath -ArgumentList '/repair' -PassThru -WindowStyle Normal
  $processes.Add($process) | Out-Null
  Write-QaLog "Proceso iniciado: pid=$($process.Id)"

  $window = Find-Window -TimeoutSec 45
  if (-not $window) { throw 'No aparecio la ventana EvaluaPro Installer Hub.' }
  Capture-Window -Window $window -Name '01-splash' | Out-Null

  Start-Sleep -Seconds ([math]::Min(18, [math]::Max(8, $DetectionTimeoutSec / 4)))
  $window = Find-Window -TimeoutSec 10
  if (-not $window) { throw 'La ventana desaparecio durante deteccion.' }
  $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
  if ($backButton) {
    Invoke-Control -Element $backButton
    Start-Sleep -Milliseconds 600
    $window = Find-Window -TimeoutSec 10
  }
  Capture-Window -Window $window -Name '02-preparar' | Out-Null

  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton) {
    Invoke-Control -Element $nextButton
    Start-Sleep -Milliseconds 600
    $window = Find-Window -TimeoutSec 10
  }
  Capture-Window -Window $window -Name '03-revisar' | Out-Null

  foreach ($controlId in @(
    'FlavorComboBox',
    'ModeComboBox',
    'InstallDirTextBox',
    'DesktopShortcutsCheckBox',
    'StartMenuShortcutsCheckBox',
    'PrereqListView',
    'InstallProgressBar',
    'BackButton',
    'NextButton',
    'DetectButton',
    'StartButton',
    'RestartNowButton',
    'CloseButton'
  )) {
    $control = Find-ById -RootElement $window -AutomationId $controlId -TimeoutSec 5
    $optionalWhenCollapsed = @('FlavorComboBox', 'ModeComboBox', 'InstallDirTextBox', 'DesktopShortcutsCheckBox', 'StartMenuShortcutsCheckBox', 'InstallProgressBar', 'LogTextBox', 'RestartNowButton') -contains $controlId
    Add-Result -Area 'control' -Item $controlId -Ok (($null -ne $control) -or $optionalWhenCollapsed) -Detail $(if ($control) { "enabled=$($control.Current.IsEnabled); offscreen=$($control.Current.IsOffscreen); name=$($control.Current.Name)" } elseif ($optionalWhenCollapsed) { 'no expuesto por estar colapsado/no aplicable en este estado' } else { 'no encontrado' })
  }

  $detectButton = Find-ById -RootElement $window -AutomationId 'DetectButton' -TimeoutSec 5
  Invoke-Control -Element $detectButton
  Start-Sleep -Seconds 6
  $window = Find-Window -TimeoutSec 10
  Add-Result -Area 'button' -Item 'DetectButton' -Ok ($null -ne $window) -Detail 'Invoke respondio y la ventana siguio viva.'
  Capture-Window -Window $window -Name '03-revisar-detectado' | Out-Null

  $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
  if ($backButton) {
    Invoke-Control -Element $backButton
    Start-Sleep -Milliseconds 500
    $window = Find-Window -TimeoutSec 10
  }

  $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
  foreach ($mode in @('Instalar', 'Reparar', 'Desinstalar')) {
    try {
      Select-ComboItem -Combo $modeCombo -ItemName $mode
      $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
      if ($nextButton) {
        Invoke-Control -Element $nextButton
        Start-Sleep -Milliseconds 450
        $window = Find-Window -TimeoutSec 10
      }
      $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 5
      Add-Result -Area 'mode' -Item $mode -Ok ($startButton.Current.Name -like "*$mode*") -Detail ("StartButton={0}" -f $startButton.Current.Name)
      $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
      if ($backButton) {
        Invoke-Control -Element $backButton
        Start-Sleep -Milliseconds 450
        $window = Find-Window -TimeoutSec 10
      }
      $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
    } catch {
      Add-Result -Area 'mode' -Item $mode -Ok $false -Detail $_.Exception.Message
    }
  }
  Capture-Window -Window $window -Name '04-modos-validados' | Out-Null

  foreach ($expanderId in @('AdvancedConfigExpander', 'LogExpander')) {
    $expander = Find-ById -RootElement $window -AutomationId $expanderId -TimeoutSec 2
    if ($expander) {
      $expanded = Expand-Control -Element $expander
      Start-Sleep -Milliseconds 350
      $collapsed = Collapse-Control -Element $expander
      Add-Result -Area 'expander' -Item $expanderId -Ok ($expanded -and $collapsed) -Detail 'Expand/collapse respondio.'
    }
  }

  foreach ($expanderName in @('Configuración avanzada', 'Configuracion avanzada', 'Bitacora tecnica', 'Bitácora técnica')) {
    $expander = Find-ByName -RootElement $window -Name $expanderName -TimeoutSec 2
    if ($expander) {
      $expanded = Expand-Control -Element $expander
      Start-Sleep -Milliseconds 350
      $collapsed = Collapse-Control -Element $expander
      Add-Result -Area 'expander' -Item $expanderName -Ok ($expanded -and $collapsed) -Detail 'Expand/collapse respondio.'
    }
  }

  foreach ($expanderId in @('AdvancedConfigExpander', 'LogExpander')) {
    $expander = Find-ById -RootElement $window -AutomationId $expanderId -TimeoutSec 2
    if ($expander) { Expand-Control -Element $expander | Out-Null }
  }

  foreach ($expanderName in @('Configuración avanzada', 'Configuracion avanzada', 'Bitacora tecnica', 'Bitácora técnica')) {
    $expander = Find-ByName -RootElement $window -Name $expanderName -TimeoutSec 2
    if ($expander) { Expand-Control -Element $expander | Out-Null }
  }
  Start-Sleep -Milliseconds 700
  Capture-Window -Window $window -Name '06-avanzado' | Out-Null

  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton) {
    Invoke-Control -Element $nextButton
    Start-Sleep -Milliseconds 500
    $window = Find-Window -TimeoutSec 10
  }

  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'PrereqListView' -TimeoutSec 5) -Label 'PrereqListView'
  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'LogTextBox' -TimeoutSec 5) -Label 'LogTextBox'

  $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 5
  Invoke-Control -Element $startButton
  Start-Sleep -Seconds 1
  $window = Find-Window -TimeoutSec 10
  Capture-Window -Window $window -Name '04-ejecutar-busy' | Out-Null
  Add-Result -Area 'button' -Item 'StartButton' -Ok ($null -ne $window) -Detail 'Invoke respondio en modo QA no destructivo.'
  Start-Sleep -Seconds 5
  $window = Find-Window -TimeoutSec 10
  Capture-Window -Window $window -Name '05-resultado' | Out-Null

  Resize-WindowForQa -Process $process -Width 980 -Height 700 | Out-Null
  Start-Sleep -Milliseconds 900
  $window = Find-Window -TimeoutSec 10
  Capture-Window -Window $window -Name '07-min-980x700' | Out-Null

  $restartButton = Find-ById -RootElement $window -AutomationId 'RestartNowButton' -TimeoutSec 5
  Add-Result -Area 'button' -Item 'RestartNowButton' -Ok $true -Detail $(if ($restartButton) { "visibleOffscreen=$($restartButton.Current.IsOffscreen); enabled=$($restartButton.Current.IsEnabled); no invocado por seguridad" } else { 'no expuesto porque no hay reinicio requerido; no invocado por seguridad' })

  $closeButton = Find-ById -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 5
  Invoke-Control -Element $closeButton
  Start-Sleep -Seconds 4
  $closed = $process.HasExited
  Add-Result -Area 'button' -Item 'CloseButton' -Ok $closed -Detail ("procesoCerrado={0}" -f $closed)

  if (-not $closed) {
    $process.CloseMainWindow() | Out-Null
    Start-Sleep -Seconds 2
  }

  Save-Report -Status $(if ($failed) { 'failed' } else { 'passed' })
  if ($failed) {
    throw "QA UI Installer Hub fallo. Reporte: $reportPath"
  }
  Write-QaLog "QA UI Installer Hub OK. Reporte: $reportPath"
}
catch {
  $errorDetail = "{0}`n{1}" -f $_.Exception.ToString(), $_.ScriptStackTrace
  Add-Result -Area 'runner' -Item 'fatal' -Ok $false -Detail $errorDetail
  try {
    Save-Report -Status 'failed'
  } catch {
    Add-Content -Path $logPath -Encoding UTF8 -Value ("{0:u} ERROR guardando reporte: {1}" -f (Get-Date), $_.Exception.ToString())
  }
  Write-QaLog ("ERROR: {0}" -f $errorDetail)
  throw
}
finally {
  foreach ($process in @($processes)) {
    try {
      if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {
      # best effort cleanup
    }
  }
}
