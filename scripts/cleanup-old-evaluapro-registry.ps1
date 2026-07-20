# cleanup-old-evaluapro-registry.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
[CmdletBinding()]
# Cleanup helper for old EvaluaPro uninstall registry entries.
# Backups HKLM/HKCU and removes only legacy EvaluaPro uninstall keys.
param(
  [string]$BackupDir = '',
  [switch]$WhatIf,
  [switch]$UninstallPackages,
  [switch]$SkipFilesystemCleanup,
  [ValidateRange(5, 120)]
  [int]$PackageTimeoutSec = 20,
  [ValidateRange(5, 60)]
  [int]$FilesystemTimeoutSec = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-SelfElevated {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath,
    [string[]]$Args
  )

  $argList = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"{0}"' -f $scriptPath)
  )
  foreach ($arg in $Args) {
    $argList += ('"{0}"' -f ($arg -replace '"', '\"'))
  }

  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($argList -join ' ') -PassThru -Wait
  if ($elevated.ExitCode -ne 0) {
    throw ("Proceso elevado terminó con código {0}." -f $elevated.ExitCode)
  }
}

function Get-OldEvaluaProUninstallKeys {
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )

  foreach ($root in $roots) {
    Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
      Where-Object {
        $_.PSObject.Properties.Match('DisplayName').Count -gt 0 -and
        ([string]$_.DisplayName -eq 'EvaluaPro' -or [string]$_.DisplayName -eq 'EvaluaPro Installer Hub')
      } |
      ForEach-Object {
        [pscustomobject]@{
          RegistryPath = $_.PSPath
          DisplayName = [string]$_.DisplayName
          DisplayVersion = [string]$_.DisplayVersion
        }
      }
  }
}

function Ensure-BackupDir {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    $Path = Join-Path $PSScriptRoot '..\tmp'
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }

  return (Resolve-Path -LiteralPath $Path).Path
}

function Remove-PathIfExists {
  param([string]$Path, [int]$TimeoutSec = 15)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $isDirectory = Test-Path -LiteralPath $Path -PathType Container
  $arguments = if ($isDirectory) {
    @('/c', 'rmdir', '/s', '/q', $Path)
  } else {
    @('/c', 'del', '/f', '/q', $Path)
  }
  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden
  if (-not $process.WaitForExit($TimeoutSec * 1000)) {
    & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
    Write-Warning ("Filesystem cleanup timeout-killed path={0}" -f $Path)
  }
}

function Get-EvaluaproCleanupPaths {
  $paths = New-Object 'System.Collections.Generic.List[string]'

  foreach ($candidate in @(
    'C:\Program Files\EvaluaPro',
    'C:\Program Files (x86)\EvaluaPro',
    'C:\ProgramData\EvaluaPro',
    (Join-Path $env:LOCALAPPDATA 'EvaluaPro'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'EvaluaPro'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'EvaluaPro - Hub.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'EvaluaPro - Prod.lnk'),
    'C:\Users\Public\Desktop\EvaluaPro - Dev.lnk',
    'C:\Users\Public\Desktop\EvaluaPro - Prod.lnk'
  )) {
    if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
      $paths.Add([string]$candidate) | Out-Null
    }
  }

  $packageCacheRoot = Join-Path $env:ProgramData 'Package Cache'
  $packageCacheRoots = @($packageCacheRoot, (Join-Path $env:LOCALAPPDATA 'Package Cache'))
  foreach ($cacheRoot in $packageCacheRoots) {
    if (Test-Path -LiteralPath $cacheRoot) {
      Get-ChildItem -LiteralPath $cacheRoot -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object {
          $_.FullName -like '*EvaluaPro*' -or $_.Name -like '*EvaluaPro*'
        } |
        ForEach-Object {
          $paths.Add($_.FullName) | Out-Null
        }
    }
  }

  return $paths | Sort-Object -Unique
}

if (-not (Test-IsAdministrator)) {
  $forwardArgs = @('-BackupDir', $BackupDir)
  if ($WhatIf) {
    $forwardArgs += '-WhatIf'
  }
  if ($UninstallPackages) {
    $forwardArgs += '-UninstallPackages'
    $forwardArgs += @('-PackageTimeoutSec', $PackageTimeoutSec)
  }
  if ($SkipFilesystemCleanup) {
    $forwardArgs += '-SkipFilesystemCleanup'
  }
  $forwardArgs += @('-FilesystemTimeoutSec', $FilesystemTimeoutSec)
  Start-SelfElevated -ScriptPath $PSCommandPath -Args $forwardArgs
  exit 0
}

function Get-OldEvaluaProInstallerProductKeys {
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData\*\Products\*\InstallProperties',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Installer\UserData\*\Products\*\InstallProperties',
    'HKCU:\SOFTWARE\Microsoft\Installer\Products\*'
  )
  $keys = @()
  foreach ($root in $roots) {
    foreach ($item in (Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
      $name = if ($item.PSObject.Properties.Match('DisplayName').Count -gt 0) { [string]$item.DisplayName } else { [string]$item.ProductName }
      if ($name -notmatch '(?i)EvaluaPro') { continue }
      $registryPath = [string]$item.PSPath
      if ($registryPath -match '(?i)\\InstallProperties$') {
        $registryPath = Split-Path $registryPath -Parent
      }
      $keys += [pscustomobject]@{ RegistryPath = $registryPath; DisplayName = $name }
    }
  }
  return @($keys | Sort-Object RegistryPath -Unique)
}

function Invoke-RegisteredEvaluaProUninstall {
  param(
    [int]$TimeoutSec
  )

  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $seen = @{}
  $results = New-Object 'System.Collections.Generic.List[object]'
  $entries = @(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue |
    Where-Object { [string]$_.DisplayName -eq 'EvaluaPro' -or [string]$_.DisplayName -eq 'EvaluaPro Installer Hub' })

  foreach ($entry in $entries) {
    $command = if ($entry.QuietUninstallString) { [string]$entry.QuietUninstallString } else { [string]$entry.UninstallString }
    if ([string]::IsNullOrWhiteSpace($command)) { continue }

    if ($command -match '(?i)msiexec(?:\.exe)?\s+/i\s*\{([^}]+)\}') {
      $file = 'msiexec.exe'
      $arguments = "/x {$($Matches[1])} /qn /norestart"
    } elseif ($command -match '^\s*"([^"]+\.exe)"\s*(.*)$') {
      $file = $Matches[1]
      $arguments = (($Matches[2] + ' /uninstall /quiet /norestart').Trim())
    } else {
      $results.Add([pscustomobject]@{ displayName = [string]$entry.DisplayName; result = 'unsupported-command'; command = $command })
      continue
    }

    $key = "$file|$arguments"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $started = Get-Date
    $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru -WindowStyle Hidden -ErrorAction SilentlyContinue
    if (-not $process) {
      $results.Add([pscustomobject]@{ displayName = [string]$entry.DisplayName; result = 'start-failed'; command = "$file $arguments" })
      continue
    }

    $finished = $process.WaitForExit($TimeoutSec * 1000)
    if (-not $finished) {
      & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
      $results.Add([pscustomobject]@{ displayName = [string]$entry.DisplayName; result = 'timeout-killed'; pid = $process.Id; elapsedSec = [math]::Round(((Get-Date) - $started).TotalSeconds, 1); command = "$file $arguments" })
    } else {
      $results.Add([pscustomobject]@{ displayName = [string]$entry.DisplayName; result = [int]$process.ExitCode; pid = $process.Id; elapsedSec = [math]::Round(((Get-Date) - $started).TotalSeconds, 1); command = "$file $arguments" })
    }
  }

  return @($results)
}

$backupRoot = Ensure-BackupDir -Path $BackupDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFileHklm = Join-Path $backupRoot ("evaluapro-uninstall-registry-backup-hklm-{0}.reg" -f $timestamp)
$backupFileHkcu = Join-Path $backupRoot ("evaluapro-uninstall-registry-backup-hkcu-{0}.reg" -f $timestamp)
$installerKeys = @(Get-OldEvaluaProInstallerProductKeys)

if ($UninstallPackages -and -not $WhatIf) {
  $uninstallResults = @(Invoke-RegisteredEvaluaProUninstall -TimeoutSec $PackageTimeoutSec)
  $uninstallReport = Join-Path $backupRoot ("evaluapro-uninstall-results-{0}.json" -f $timestamp)
  $uninstallResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $uninstallReport -Encoding UTF8
  Write-Host ("Uninstall results: {0}" -f $uninstallReport)
}

$keys = @(Get-OldEvaluaProUninstallKeys)
if ($keys.Count -gt 0) {
  Write-Host ("Backup HKLM: {0}" -f $backupFileHklm)
  Write-Host ("Backup HKCU: {0}" -f $backupFileHkcu)
  cmd.exe /c ('reg export "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" "{0}" /y' -f $backupFileHklm) | Out-Null
  cmd.exe /c ('reg export "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" "{0}" /y' -f $backupFileHkcu) | Out-Null

  foreach ($key in $keys) {
    Write-Host ("Delete: {0} [{1}]" -f $key.DisplayName, $key.RegistryPath)
    if (-not $WhatIf) {
      Remove-Item -LiteralPath $key.RegistryPath -Recurse -Force
    }
  }
} else {
  Write-Host 'No hay claves viejas de EvaluaPro; se continúa con limpieza de restos.'
}

if ($installerKeys.Count -gt 0) {
  Write-Host ("Installer UserData/Product keys stale: {0}" -f $installerKeys.Count)
  if (-not $WhatIf) {
    foreach ($key in $installerKeys) {
      Write-Host ("Delete Installer product: {0} [{1}]" -f $key.DisplayName, $key.RegistryPath)
      Remove-Item -LiteralPath $key.RegistryPath -Recurse -Force
    }
  }
}

if (-not $SkipFilesystemCleanup) {
  Write-Host 'Cleaning filesystem traces...'
  foreach ($path in (Get-EvaluaproCleanupPaths)) {
    Write-Host ("Remove: {0}" -f $path)
    if (-not $WhatIf) {
      Remove-PathIfExists -Path $path -TimeoutSec $FilesystemTimeoutSec
    }
  }
} else {
  Write-Host 'Filesystem cleanup skipped by explicit bounded-cleanup mode.'
}

$remaining = @(Get-OldEvaluaProUninstallKeys)
if ($remaining.Count -gt 0) {
  Write-Error ("Quedan claves viejas: {0}" -f ($remaining.RegistryPath -join ', '))
}
$remainingInstaller = @(Get-OldEvaluaProInstallerProductKeys)
if ($remainingInstaller.Count -gt 0) {
  Write-Error ("Quedan claves Installer viejas: {0}" -f ($remainingInstaller.RegistryPath -join ', '))
}

Write-Host 'OK: claves viejas eliminadas.'
