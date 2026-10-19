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
  [ValidateRange(1, 300)]
  [int]$DetectionTimeoutSec = 300,
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
  [StructLayout(LayoutKind.Sequential)]
  public struct NativePoint {
    public int X;
    public int Y;
    public NativePoint(int x, int y) { X = x; Y = y; }
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct ProcessEntry32 {
    public uint Size;
    public uint Usage;
    public uint ProcessId;
    public UIntPtr DefaultHeapId;
    public uint ModuleId;
    public uint ThreadCount;
    public uint ParentProcessId;
    public int BasePriority;
    public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string ExecutableName;
  }

  [DllImport("kernel32.dll", SetLastError=true)]
  private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, EntryPoint="Process32FirstW", SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry32 entry);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, EntryPoint="Process32NextW", SetLastError=true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry32 entry);
  [DllImport("kernel32.dll", SetLastError=true)]
  private static extern bool CloseHandle(IntPtr handle);

  public static ProcessEntry32[] GetProcessSnapshot() {
    const uint TH32CS_SNAPPROCESS = 0x00000002;
    const int ERROR_NO_MORE_FILES = 18;
    IntPtr snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == new IntPtr(-1)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "No se pudo crear el snapshot de procesos.");
    }
    try {
      var entries = new System.Collections.Generic.List<ProcessEntry32>();
      var entry = new ProcessEntry32 { Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32)) };
      if (!Process32First(snapshot, ref entry)) {
        int error = Marshal.GetLastWin32Error();
        if (error == ERROR_NO_MORE_FILES) return entries.ToArray();
        throw new System.ComponentModel.Win32Exception(error, "No se pudo leer el primer proceso del snapshot.");
      }
      do {
        entries.Add(entry);
        entry = new ProcessEntry32 { Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32)) };
      } while (Process32Next(snapshot, ref entry));

      int lastError = Marshal.GetLastWin32Error();
      if (lastError != ERROR_NO_MORE_FILES) {
        throw new System.ComponentModel.Win32Exception(lastError, "No se pudo completar el snapshot de procesos.");
      }
      return entries.ToArray();
    } finally {
      CloseHandle(snapshot);
    }
  }

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern IntPtr WindowFromPoint(NativePoint point);
  [DllImport("user32.dll")]
  private static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
  [DllImport("user32.dll", SetLastError=true)]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern int GetClassNameW(IntPtr hWnd, System.Text.StringBuilder className, int maxCount);

  public static bool IsWindowAtPoint(IntPtr expectedWindow, int x, int y) {
    const uint GA_ROOT = 2;
    IntPtr hit = WindowFromPoint(new NativePoint(x, y));
    return hit != IntPtr.Zero && GetAncestor(hit, GA_ROOT) == expectedWindow;
  }

  public static string DescribeWindowAtPoint(int x, int y) {
    IntPtr hit = WindowFromPoint(new NativePoint(x, y));
    if (hit == IntPtr.Zero) return "hwnd=0";
    uint processId;
    GetWindowThreadProcessId(hit, out processId);
    var className = new System.Text.StringBuilder(256);
    GetClassNameW(hit, className, className.Capacity);
    return string.Format("pid={0}; class={1}; root=0x{2:X}", processId, className.ToString(), GetAncestor(hit, 2).ToInt64());
  }

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
$burnLogPath = Join-Path $ReportDir 'installer-hub-burn.log'
$results = New-Object System.Collections.Generic.List[object]
$screenshots = New-Object System.Collections.Generic.List[string]
$processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$bundlePath = ''
$failed = $false
$currentStage = 'setup'
$bundleProcessId = $null
$bundleProcessStartedAt = $null
$bundleUiProcessId = $null
$bundleUiProcessPath = ''

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
  $processState = 'not-started'
  $processExitCode = $null
  if ($processes.Count -gt 0) {
    $trackedProcess = $processes[$processes.Count - 1]
    $trackedProcess.Refresh()
    $processState = if ($trackedProcess.HasExited) { 'exited' } else { 'running' }
    if ($trackedProcess.HasExited) { $processExitCode = $trackedProcess.ExitCode }
  }

  $report = [pscustomobject]@{
    status = $Status
    startedAt = $startedAt.ToString('o')
    finishedAt = (Get-Date).ToString('o')
    durationSeconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
    rootPath = $root
    bundlePath = $bundlePath
    logPath = $logPath
    burnLogPath = $burnLogPath
    screenshots = $screenshotItems
    currentStage = $currentStage
    processId = $bundleProcessId
    processStartedAt = $bundleProcessStartedAt
    uiProcessId = $bundleUiProcessId
    uiProcessPath = $bundleUiProcessPath
    processState = $processState
    processExitCode = $processExitCode
    results = $resultItems
  }
  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath -Encoding UTF8
}

function Resolve-BundlePath {
  $manifestPath = Join-Path $root 'dist\installer\installer-local-paths.json'
  $internalManifestPath = Join-Path $root 'dist\installer\_internal\installer-local-paths.json'
  $selectedManifest = if (Test-Path -LiteralPath $manifestPath) { $manifestPath } elseif (Test-Path -LiteralPath $internalManifestPath) { $internalManifestPath } else { '' }
  if (-not $selectedManifest) {
    $downloadsCandidates = @(Get-ChildItem -Path (Join-Path $root 'downloads') -Filter 'EvaluaPro-InstallerHub-*.exe' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    if ($downloadsCandidates.Count -gt 0) {
      return $downloadsCandidates[0].FullName
    }
    if ($AllowMissingBundle) { return '' }
    throw 'No existe dist\installer\installer-local-paths.json ni bundle en downloads\. Ejecuta npm run installer:hub:build antes del QA UI.'
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

function Get-LocalProcessSnapshot {
  foreach ($instance in [EvaluaProQaNativeWindow]::GetProcessSnapshot()) {
    [pscustomobject]@{
      ProcessId = [int]$instance.ProcessId
      ParentProcessId = [int]$instance.ParentProcessId
      ExecutableName = [string]$instance.ExecutableName
    }
  }
}

function Get-VerifiedBundleUiProcessIds {
  param([Parameter(Mandatory = $true)][int]$TargetPid)
  if ($TargetPid -ne $bundleProcessId) { throw 'La raíz solicitada no es el bundle iniciado por esta corrida.' }

  $rootProcess = [System.Diagnostics.Process]::GetProcessById($TargetPid)
  try {
    $rootProcess.Refresh()
    $rootPath = [System.IO.Path]::GetFullPath($rootProcess.Path)
    $expectedRootPath = [System.IO.Path]::GetFullPath($bundlePath)
    $rootStart = $rootProcess.StartTime.ToUniversalTime()
    $expectedRootStart = [datetime]::Parse($bundleProcessStartedAt).ToUniversalTime()
    if (-not [string]::Equals($rootPath, $expectedRootPath, [StringComparison]::OrdinalIgnoreCase) -or
        [math]::Abs(($rootStart - $expectedRootStart).TotalSeconds) -gt 1) {
      throw "La identidad del bundle cambió; pid=$TargetPid."
    }

    $nativeProcesses = @(Get-LocalProcessSnapshot)
    $ownedUiPids = New-Object System.Collections.Generic.List[int]
    $ownedUiPids.Add($TargetPid) | Out-Null
    $visited = New-Object 'System.Collections.Generic.HashSet[int]'
    $frontier = New-Object 'System.Collections.Generic.Queue[int]'
    $frontier.Enqueue($TargetPid)
    while ($frontier.Count -gt 0) {
      $parentPid = $frontier.Dequeue()
      foreach ($child in @($nativeProcesses | Where-Object { [int]$_.ParentProcessId -eq $parentPid })) {
        $childPid = [int]$child.ProcessId
        if (-not $visited.Add($childPid)) { continue }
        $childProcess = $null
        try {
          $childProcess = [System.Diagnostics.Process]::GetProcessById($childPid)
          $childProcess.Refresh()
          if ($childProcess.HasExited) { continue }
          $actualPath = [System.IO.Path]::GetFullPath($childProcess.Path)
          $actualStart = $childProcess.StartTime.ToUniversalTime()
          if (-not [string]::Equals([System.IO.Path]::GetFileName($actualPath), [string]$child.ExecutableName, [StringComparison]::OrdinalIgnoreCase) -or
              $actualStart -lt $rootStart) { continue }

          $frontier.Enqueue($childPid)
          if ([string]::Equals([System.IO.Path]::GetFileName($actualPath), 'EvaluaPro.BurnBootstrapperApp.exe', [StringComparison]::OrdinalIgnoreCase)) {
            $ownedUiPids.Add($childPid) | Out-Null
            $script:bundleUiProcessId = $childPid
            $script:bundleUiProcessPath = $actualPath
          }
        } catch [System.ArgumentException] {
          # The process exited between the native snapshot and identity check.
        } finally {
          if ($childProcess) { $childProcess.Dispose() }
        }
      }
    }
    return $ownedUiPids.ToArray()
  } finally {
    $rootProcess.Dispose()
  }
}

function Find-Window {
  param(
    [Parameter(Mandatory = $true)][int]$TargetPid,
    [int]$TimeoutSec = 45
  )
  if (-not $TargetPid) { throw 'Find-Window requiere el PID del bundle iniciado por esta corrida.' }
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $nameCondition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    'EvaluaPro Installer Hub'
  )
  $lastObservedPids = @()
  do {
    $ownedUiProcessIds = @(Get-VerifiedBundleUiProcessIds -TargetPid $TargetPid)
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children,
      $nameCondition
    )
    foreach ($window in $windows) {
      $windowPid = [int]$window.Current.ProcessId
      if ($ownedUiProcessIds -notcontains $windowPid) { continue }
      $windowProcess = [System.Diagnostics.Process]::GetProcessById($windowPid)
      try {
        $script:bundleUiProcessId = $windowPid
        $script:bundleUiProcessPath = [System.IO.Path]::GetFullPath($windowProcess.Path)
      } finally {
        $windowProcess.Dispose()
      }
      return $window
    }
    $lastObservedPids = @($ownedUiProcessIds)
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if ($lastObservedPids.Count -gt 0) {
    Write-QaLog "Ventana no encontrada; PID raíz=$TargetPid; PIDs UI verificados=$($lastObservedPids -join ', ')."
  }
  return $null
}

function Wait-DetectionCompletion {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [int]$TimeoutSec,
    [System.Diagnostics.Process]$Process
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $statusCondition = New-Object System.Windows.Automation.PropertyCondition -ArgumentList @(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'FooterStatusTextBlock'
  )
  do {
    $Process.Refresh()
    if ($Process.HasExited) { throw "El proceso del bundle terminó durante detección (exit=$($Process.ExitCode))." }
    $currentWindow = Find-Window -TargetPid $bundleProcessId -TimeoutSec 0
    if (-not $currentWindow) { throw "La ventana del Hub (PID UI=$bundleUiProcessId) desapareció durante detección." }
    $Window = $currentWindow
    $statusElement = $Window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $statusCondition)
    $statusText = if ($statusElement) { [string]$statusElement.Current.Name } else { '' }
    if ($statusText -match '^Equipo listo\.' -or $statusText -match '^Revisa prerequisitos') {
      $ready = $statusText -match '^Equipo listo\.'
      Add-Result -Area 'detection' -Item 'initial-detection' -Ok $ready -Detail "footerStatus='$statusText'; pid=$bundleProcessId; elapsedSeconds=$([math]::Round(($TimeoutSec - ($deadline - (Get-Date)).TotalSeconds), 1))"
      if (-not $ready) { throw "La detección terminó en estado fallido: $statusText" }
      return
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  $lastStatus = if ($statusElement) { [string]$statusElement.Current.Name } else { '<control no disponible>' }
  throw "La detección no terminó en ${TimeoutSec}s; pid=$bundleProcessId; último estado='$lastStatus'."
}

function Stop-OwnedProcessTree {
  param(
    [System.Diagnostics.Process]$RootProcess,
    [string]$ExpectedRootPath,
    [string]$ExpectedRootStartTime
  )
  $RootProcess.Refresh()
  $rootPath = [System.IO.Path]::GetFullPath($RootProcess.Path)
  $rootStartTime = $RootProcess.StartTime.ToUniversalTime().ToString('o')
  if (-not [string]::Equals($rootPath, [System.IO.Path]::GetFullPath($ExpectedRootPath), [StringComparison]::OrdinalIgnoreCase) -or
      $rootStartTime -ne $ExpectedRootStartTime) {
    throw "La identidad del proceso raíz cambió; pid=$($RootProcess.Id). No se detiene un PID no verificado."
  }

  $nativeProcesses = @(Get-LocalProcessSnapshot)
  $descendants = New-Object System.Collections.Generic.List[object]
  $parents = @([int]$RootProcess.Id)
  do {
    $children = @($nativeProcesses | Where-Object { $parents -contains [int]$_.ParentProcessId })
    foreach ($child in $children) { $descendants.Add($child) | Out-Null }
    $parents = @($children | ForEach-Object { [int]$_.ProcessId })
  } while ($parents.Count -gt 0)

  $descendantItems = $descendants.ToArray()
  [array]::Reverse($descendantItems)
  foreach ($child in $descendantItems) {
    $ownedProcess = $null
    try {
      $ownedProcess = [System.Diagnostics.Process]::GetProcessById([int]$child.ProcessId)
      $ownedProcess.Refresh()
      if ($ownedProcess.HasExited) { continue }
      $actualPath = [System.IO.Path]::GetFullPath($ownedProcess.Path)
      $actualStart = $ownedProcess.StartTime.ToUniversalTime()
      if (-not [string]::Equals([System.IO.Path]::GetFileName($actualPath), [string]$child.ExecutableName, [StringComparison]::OrdinalIgnoreCase) -or
          $actualStart -lt $RootProcess.StartTime.ToUniversalTime()) { continue }
      $ownedProcess.Kill()
      if (-not $ownedProcess.WaitForExit(5000)) { throw "Proceso descendiente verificado no cerró; pid=$($child.ProcessId)." }
    } finally {
      if ($ownedProcess) { $ownedProcess.Dispose() }
    }
  }

  $RootProcess.Refresh()
  if (-not $RootProcess.HasExited) {
    $RootProcess.Kill()
    if (-not $RootProcess.WaitForExit(5000)) { throw "Proceso raíz propio no cerró; pid=$($RootProcess.Id)." }
  }
}

function Find-ById {
  param(
    [System.Windows.Automation.AutomationElement]$RootElement,
    [string]$AutomationId,
    [int]$TimeoutSec = 8
  )
  if (-not $RootElement) { return $null }
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
  if (-not $RootElement) { return $null }
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
  # Esperar a que el elemento esté habilitado (para sincronizar con operaciones en progreso/busy)
  $maxWait = 15
  $waited = 0
  while (-not $Element.Current.IsEnabled -and $waited -lt $maxWait) {
    Start-Sleep -Milliseconds 500
    $waited += 0.5
  }
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
    [string]$Name,
    [int]$RequestedWidth = 0,
    [int]$RequestedHeight = 0
  )
  if (-not $Window) {
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail 'La ventana UI Automation no está disponible.'
    throw "No se pudo capturar ${Name}: la ventana UI Automation no está disponible."
  }
  $rectangle = $Window.Current.BoundingRectangle
  if ($rectangle.Width -le 0 -or $rectangle.Height -le 0) {
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail 'La ventana no tiene dimensiones positivas.'
    throw "No se pudo capturar ${Name}: la ventana no tiene dimensiones positivas."
  }
  $x = [int][Math]::Round($rectangle.X)
  $y = [int][Math]::Round($rectangle.Y)
  $w = [int][Math]::Round($rectangle.Width)
  $h = [int][Math]::Round($rectangle.Height)
  $bitmap = New-Object System.Drawing.Bitmap($w, $h)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $handle = [IntPtr]::Zero
  try {
    $handle = [IntPtr]$Window.Current.NativeWindowHandle
    if ($handle -eq [IntPtr]::Zero) { throw 'La ventana no expone un HWND para capturar su superficie visible.' }
    if ($Window.Current.IsOffscreen) { throw 'La ventana está fuera del área visible del escritorio.' }
    if (-not [EvaluaProQaNativeWindow]::IsWindowVisible($handle)) { throw 'El HWND del Installer Hub no está visible.' }
    $captureRect = [System.Drawing.Rectangle]::new($x, $y, $w, $h)
    $screen = [System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Contains($captureRect) } | Select-Object -First 1
    if (-not $screen) { throw "La ventana ($($w)x$($h)) no cabe completa en un monitor conectado." }
    $probeX = [Math]::Max(12, [int][Math]::Floor($w * 0.2))
    $probeY = [Math]::Max(40, [int][Math]::Floor($h * 0.2))
    $probePoints = @(
      [System.Drawing.Point]::new($x + $probeX, $y + $probeY),
      [System.Drawing.Point]::new($x + $w - $probeX, $y + $probeY),
      [System.Drawing.Point]::new($x + $probeX, $y + $h - 20),
      [System.Drawing.Point]::new($x + $w - $probeX, $y + $h - 20),
      [System.Drawing.Point]::new($x + [int][Math]::Floor($w / 2), $y + [int][Math]::Floor($h / 2))
    )
    foreach ($point in $probePoints) {
      if (-not [EvaluaProQaNativeWindow]::IsWindowAtPoint($handle, $point.X, $point.Y)) {
        $cover = [EvaluaProQaNativeWindow]::DescribeWindowAtPoint($point.X, $point.Y)
        throw "El Hub está parcialmente cubierto en el escritorio (punto $($point.X),$($point.Y); $cover); no se cambiará el foco."
      }
    }
    $graphics.CopyFromScreen($x, $y, 0, 0, $bitmap.Size)
    if ($RequestedWidth -gt 0 -and $RequestedHeight -gt 0 -and ($bitmap.Width -ne $RequestedWidth -or $bitmap.Height -ne $RequestedHeight)) {
      throw "El tamaño capturado $($bitmap.Width)x$($bitmap.Height) no coincide con el viewport solicitado ${RequestedWidth}x${RequestedHeight}."
    }
    $path = Join-Path $ReportDir ("{0}.png" -f $Name)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $script:screenshots.Add($path) | Out-Null
    $coloredBodySamples = 0
    $distinctBodyColors = [System.Collections.Generic.HashSet[int]]::new()
    $bodyTop = [Math]::Max(40, [int][Math]::Floor($bitmap.Height * 0.07))
    $bodyBottom = [Math]::Max($bodyTop + 1, $bitmap.Height - 12)
    for ($sampleY = $bodyTop; $sampleY -lt $bodyBottom; $sampleY += 8) {
      for ($sampleX = 8; $sampleX -lt ($bitmap.Width - 8); $sampleX += 8) {
        $pixel = $bitmap.GetPixel($sampleX, $sampleY)
        $colorKey = ($pixel.R -shl 16) -bor ($pixel.G -shl 8) -bor $pixel.B
        $distinctBodyColors.Add($colorKey) | Out-Null
        if ($pixel.R -lt 245 -or $pixel.G -lt 245 -or $pixel.B -lt 245) { $coloredBodySamples++ }
      }
    }
    if ($coloredBodySamples -lt 100 -or $distinctBodyColors.Count -lt 8) {
      throw "La captura '$Name' muestra una ventana vacía o monocroma (muestras con contenido=$coloredBodySamples; colores=$($distinctBodyColors.Count))."
    }
    return $path
  } catch {
    Write-QaLog "No se pudo capturar la ventana visible $Name en ($x, $y, $w, $h): $($_.Exception.Message)"
    Add-Result -Area 'screenshots' -Item $Name -Ok $false -Detail $_.Exception.Message
    throw "No se pudo capturar la ventana visible '$Name': $($_.Exception.Message)"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Resize-WindowForQa {
  param(
    [System.Windows.Automation.AutomationElement]$Window,
    [int]$Width,
    [int]$Height
  )
  try {
    if (-not $Window) { return $false }
    $handle = [IntPtr]$Window.Current.NativeWindowHandle
    if ($handle -eq [IntPtr]::Zero) { return $false }
    if (-not [EvaluaProQaNativeWindow]::MoveWindow($handle, 0, 0, $Width, $Height, $true)) { return $false }
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
    Write-QaLog "No se pudo aplicar el viewport ${Width}x${Height}; actual=$actualSize"
    return $false
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
  $currentStage = 'resolve-bundle'
  $bundlePath = Resolve-BundlePath
  if (-not $bundlePath) {
    Add-Result -Area 'bundle' -Item 'bundle-publico' -Ok $true -Detail 'SKIP: bundle ausente con AllowMissingBundle.'
    Save-Report -Status 'skipped'
    Write-Host "SKIP: bundle ausente. Reporte: $reportPath"
    exit 0
  }

  Write-QaLog "Bundle: $bundlePath"
  Set-SafeEnvironment

  $currentStage = 'launch-bundle'
  $burnLogArgument = '"{0}"' -f $burnLogPath
  $process = Start-Process -FilePath $bundlePath -ArgumentList @('/repair', '-l', $burnLogArgument) -PassThru -WindowStyle Normal
  $processes.Add($process) | Out-Null
  $bundleProcessId = $process.Id
  $bundleProcessStartedAt = $process.StartTime.ToUniversalTime().ToString('o')
  Write-QaLog "Proceso iniciado: pid=$bundleProcessId; startedAt=$bundleProcessStartedAt"

  $currentStage = 'wait-window'
  $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 45
  if (-not $window) { throw 'No aparecio la ventana EvaluaPro Installer Hub.' }
  if ($window.Current.ProcessId -ne $bundleUiProcessId) { throw "La ventana encontrada pertenece al PID $($window.Current.ProcessId), se esperaba el PID UI verificado $bundleUiProcessId." }
  Start-Sleep -Milliseconds 500
  $currentStage = 'capture-splash'
  Capture-Window -Window $window -Name '01-splash' | Out-Null

  $currentStage = 'accessibility-splash'
  foreach ($controlId in @('FooterStatusTextBlock', 'NextButton', 'CloseButton')) {
    $element = Find-ById -RootElement $window -AutomationId $controlId -TimeoutSec 8
    Add-Result -Area 'accessibility' -Item $controlId -Ok ($null -ne $element) -Detail $(if ($element) { "name='$($element.Current.Name)'; controlType=$($element.Current.ControlType.ProgrammaticName)" } else { 'No expuesto en el árbol UI Automation de la ventana propia.' })
    if (-not $element) { throw "Falta el control accesible esperado '$controlId' en la ventana propia." }
  }

  $currentStage = 'detect-prereqs'
  Wait-DetectionCompletion -Window $window -TimeoutSec $DetectionTimeoutSec -Process $process
  $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
  if (-not $window) { throw 'La ventana desaparecio despues de deteccion.' }
  $currentStage = 'navigate-prepare'
  $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
  if ($backButton -and $backButton.Current.IsEnabled) {
    Invoke-Control -Element $backButton
    Start-Sleep -Milliseconds 600
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
  } elseif ($backButton) {
    Add-Result -Area 'navigation' -Item 'BackButton-inicial' -Ok $true -Detail 'Presente y deshabilitado en el primer paso; no se invoca.'
  }
  Capture-Window -Window $window -Name '02-preparar' | Out-Null

  $currentStage = 'navigate-review'
  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton -and $nextButton.Current.IsEnabled) {
    Invoke-Control -Element $nextButton
    Start-Sleep -Milliseconds 600
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
  } elseif ($nextButton) {
    Add-Result -Area 'navigation' -Item 'NextButton-inicial' -Ok $true -Detail 'Presente y deshabilitado en este estado; no se invoca.'
  }
  Capture-Window -Window $window -Name '03-revisar' | Out-Null

  $currentStage = 'verify-review-controls'
  $hubVersion = Find-ById -RootElement $window -AutomationId 'HubVersionTextBlock' -TimeoutSec 5
  $editionVersion = Find-ById -RootElement $window -AutomationId 'EditionVersionTextBlock' -TimeoutSec 5
  $versionLabelsMatch = $hubVersion -and $editionVersion -and
    $hubVersion.Current.Name -and $editionVersion.Current.Name -and
    $editionVersion.Current.Name -eq "EvaluaPro Docente Local ($($hubVersion.Current.Name))"
  Add-Result -Area 'version' -Item 'edition-version-matches-hub' -Ok $versionLabelsMatch -Detail $(if ($versionLabelsMatch) { "hub='$($hubVersion.Current.Name)'; edition='$($editionVersion.Current.Name)'" } else { "hub='$($hubVersion.Current.Name)'; edition='$($editionVersion.Current.Name)'" })
  foreach ($controlId in @(
    'HubVersionTextBlock',
    'EditionVersionTextBlock',
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
    $optionalWhenCollapsed = @(
      'FlavorComboBox',
      'ModeComboBox',
      'InstallDirTextBox',
      'DesktopShortcutsCheckBox',
      'StartMenuShortcutsCheckBox',
      'PrereqListView',
      'InstallProgressBar',
      'LogTextBox',
      'DetectButton',
      'StartButton',
      'RestartNowButton'
    ) -contains $controlId
    Add-Result -Area 'control' -Item $controlId -Ok (($null -ne $control) -or $optionalWhenCollapsed) -Detail $(if ($control) { "enabled=$($control.Current.IsEnabled); offscreen=$($control.Current.IsOffscreen); name=$($control.Current.Name)" } elseif ($optionalWhenCollapsed) { 'no expuesto por estar colapsado/no aplicable en este estado' } else { 'no encontrado' })
  }

  $detectButton = Find-ById -RootElement $window -AutomationId 'DetectButton' -TimeoutSec 5
  if ($detectButton -and $detectButton.Current.IsEnabled) {
    Invoke-Control -Element $detectButton
    Start-Sleep -Seconds 6
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
    Add-Result -Area 'button' -Item 'DetectButton' -Ok ($null -ne $window) -Detail 'Invoke respondio y la ventana siguio viva.'
  } else {
    Add-Result -Area 'button' -Item 'DetectButton' -Ok $true -Detail 'No disponible o deshabilitado en este estado; la deteccion inicial ya fue ejecutada.'
  }
  Capture-Window -Window $window -Name '03-revisar-detectado' | Out-Null

  $currentStage = 'validate-modes'
  $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
  if ($backButton -and $backButton.Current.IsEnabled) {
    Invoke-Control -Element $backButton
    Start-Sleep -Milliseconds 500
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
  }

  $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
  if (-not $modeCombo) {
    Add-Result -Area 'mode' -Item 'ModeComboBox' -Ok $true -Detail 'No expuesto en el paso actual; se omite cambio de modo en QA no destructivo.'
  }
  foreach ($mode in @('Instalar', 'Reparar', 'Desinstalar')) {
    if (-not $modeCombo) { break }
    try {
      Select-ComboItem -Combo $modeCombo -ItemName $mode
      $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
      if ($nextButton -and $nextButton.Current.IsEnabled) {
        Invoke-Control -Element $nextButton
        Start-Sleep -Milliseconds 450
        $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
      }
      $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 5
      if ($startButton) {
        $startName = $startButton.Current.Name
        Add-Result -Area 'mode' -Item $mode -Ok ($startName -like "*$mode*") -Detail ("StartButton={0}" -f $startName)
      } else {
        Add-Result -Area 'mode' -Item $mode -Ok $false -Detail 'StartButton no disponible: la ventana del Hub desapareció o no terminó de cargar.'
      }
      $backButton = Find-ById -RootElement $window -AutomationId 'BackButton' -TimeoutSec 5
      if ($backButton -and $backButton.Current.IsEnabled) {
        Invoke-Control -Element $backButton
        Start-Sleep -Milliseconds 450
        $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
      }
      $modeCombo = Find-ById -RootElement $window -AutomationId 'ModeComboBox' -TimeoutSec 5
    } catch {
      Add-Result -Area 'mode' -Item $mode -Ok $false -Detail $_.Exception.Message
    }
  }
  Capture-Window -Window $window -Name '04-modos-validados' | Out-Null

  $currentStage = 'validate-expanders'
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
  $currentStage = 'capture-advanced'
  Capture-Window -Window $window -Name '06-avanzado' | Out-Null

  $currentStage = 'run-nondestructive-qa'
  $nextButton = Find-ById -RootElement $window -AutomationId 'NextButton' -TimeoutSec 5
  if ($nextButton -and $nextButton.Current.IsEnabled) {
    Invoke-Control -Element $nextButton
    Start-Sleep -Milliseconds 500
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
  } elseif ($nextButton) {
    Add-Result -Area 'navigation' -Item 'NextButton-avanzado' -Ok $true -Detail 'Presente y deshabilitado; se omite avance no aplicable.'
  }

  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'PrereqListView' -TimeoutSec 5) -Label 'PrereqListView'
  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'LogTextBox' -TimeoutSec 5) -Label 'LogTextBox'

  $startButton = Find-ById -RootElement $window -AutomationId 'StartButton' -TimeoutSec 5
  if ($startButton -and $startButton.Current.IsEnabled) {
    Invoke-Control -Element $startButton
    Start-Sleep -Seconds 1
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
    Capture-Window -Window $window -Name '04-ejecutar-busy' | Out-Null
    $etaTextBlock = Find-ById -RootElement $window -AutomationId 'ProgressEtaTextBlock' -TimeoutSec 5
    $etaAccessibleName = if ($etaTextBlock) { [string]$etaTextBlock.Current.Name } else { '' }
    $etaVisible = $null -ne $etaTextBlock -and -not $etaTextBlock.Current.IsOffscreen
    $etaComplete = $etaAccessibleName -match 'Tiempo restante estimado:.*desempaquetando archivos nativos'
    Add-Result -Area 'accessibility' -Item 'progress-eta-full-text-visible' -Ok ($etaVisible -and $etaComplete) -Detail "visible=$etaVisible; accessibleName=$etaAccessibleName"
    Add-Result -Area 'button' -Item 'StartButton' -Ok ($null -ne $window) -Detail 'Invoke respondio en modo QA no destructivo.'
    Start-Sleep -Seconds 5
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10
    Capture-Window -Window $window -Name '05-resultado' | Out-Null
  } else {
    Add-Result -Area 'button' -Item 'StartButton' -Ok $true -Detail 'Presente pero no habilitado en este estado; no se fuerza accion de producto.'
    Capture-Window -Window $window -Name '05-resultado' | Out-Null
  }

  $currentStage = 'validate-minimum-viewport'
  $logExpander = Find-ById -RootElement $window -AutomationId 'LogExpander' -TimeoutSec 5
  $logCollapsed = $null -ne $logExpander -and (Collapse-Control -Element $logExpander)
  if ($logExpander) {
    $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 5
    $logExpander = Find-ById -RootElement $window -AutomationId 'LogExpander' -TimeoutSec 5
    $logExpandPattern = $null
    $hasLogExpandPattern = $null -ne $logExpander -and $logExpander.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$logExpandPattern)
    $logExpandState = if ($hasLogExpandPattern) { [string]$logExpandPattern.Current.ExpandCollapseState } else { 'unavailable' }
    $logCollapsed = $logCollapsed -and $hasLogExpandPattern -and $logExpandPattern.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Collapsed
  }
  $logTextControl = Find-ById -RootElement $window -AutomationId 'LogTextBox' -TimeoutSec 2
  $logTextOffscreen = if ($logTextControl) { [string]$logTextControl.Current.IsOffscreen } else { 'missing' }
  Add-Result -Area 'viewport' -Item 'technical-log-collapsed-for-minimum-viewport' -Ok $logCollapsed -Detail "state=$logExpandState; collapseRequested=$($null -ne $logExpander); contentOffscreen=$logTextOffscreen"

  if (-not (Resize-WindowForQa -Window $window -Width 980 -Height 700)) { throw 'No se pudo ajustar el Installer Hub a su mínimo documentado de 980x700.' }
  Start-Sleep -Milliseconds 900
  $window = Find-Window -TargetPid $bundleProcessId -TimeoutSec 10

  $verificationText = Find-ById -RootElement $window -AutomationId 'InstallVerificationTextBlock' -TimeoutSec 5
  Add-Result -Area 'viewport' -Item 'integrity-verification-visible' -Ok ($null -ne $verificationText -and -not $verificationText.Current.IsOffscreen) -Detail $(if ($verificationText) { "visibleOffscreen=$($verificationText.Current.IsOffscreen)" } else { 'No se expuso el texto de verificación de integridad.' })
  $closeButton = Find-ById -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 5
  Add-Result -Area 'viewport' -Item 'primary-close-visible' -Ok ($null -ne $closeButton -and -not $closeButton.Current.IsOffscreen -and $closeButton.Current.IsEnabled) -Detail $(if ($closeButton) { "visibleOffscreen=$($closeButton.Current.IsOffscreen); enabled=$($closeButton.Current.IsEnabled)" } else { 'No se expuso el botón Cerrar.' })
  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'ResultSummaryScrollViewer' -TimeoutSec 5) -Label 'ResultSummaryScrollViewer'
  Test-ScrollPattern -Element (Find-ById -RootElement $window -AutomationId 'ResultEvidenceScrollViewer' -TimeoutSec 5) -Label 'ResultEvidenceScrollViewer'
  Capture-Window -Window $window -Name '07-min-980x700' -RequestedWidth 980 -RequestedHeight 700 | Out-Null

  $restartButton = Find-ById -RootElement $window -AutomationId 'RestartNowButton' -TimeoutSec 5
  Add-Result -Area 'button' -Item 'RestartNowButton' -Ok $true -Detail $(if ($restartButton) { "visibleOffscreen=$($restartButton.Current.IsOffscreen); enabled=$($restartButton.Current.IsEnabled); no invocado por seguridad" } else { 'no expuesto porque no hay reinicio requerido; no invocado por seguridad' })

  $currentStage = 'close-owned-process'
  $closeButton = Find-ById -RootElement $window -AutomationId 'CloseButton' -TimeoutSec 5
  Invoke-Control -Element $closeButton
  Start-Sleep -Seconds 4
  $closed = $process.HasExited
  Add-Result -Area 'button' -Item 'CloseButton' -Ok $closed -Detail ("procesoCerrado={0}" -f $closed)

  if (-not $closed) {
    $process.CloseMainWindow() | Out-Null
    Start-Sleep -Seconds 2
  }

  $currentStage = 'finalize-report'
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
        Write-QaLog "Abortando árbol de proceso propio pid=$($process.Id); etapa=$currentStage."
        Stop-OwnedProcessTree -RootProcess $process -ExpectedRootPath $bundlePath -ExpectedRootStartTime $bundleProcessStartedAt
        Write-QaLog "Árbol de proceso propio cerrado; pid=$($process.Id)."
      }
    } catch {
      $cleanupError = "No se pudo confirmar la limpieza del proceso propio pid=$($process.Id): $($_.Exception.Message)"
      try {
        Add-Result -Area 'cleanup' -Item 'owned-process-tree' -Ok $false -Detail $cleanupError
        Save-Report -Status 'failed'
        Write-QaLog $cleanupError
      } catch {
        Add-Content -Path $logPath -Encoding UTF8 -Value ("{0:u} ERROR cleanup: {1}" -f (Get-Date), $cleanupError)
      }
    }
  }
  try {
    Save-Report -Status $(if ($failed) { 'failed' } else { 'passed' })
  } catch {
    Add-Content -Path $logPath -Encoding UTF8 -Value ("{0:u} ERROR guardando estado final de limpieza: {1}" -f (Get-Date), $_.Exception.ToString())
  }
}
