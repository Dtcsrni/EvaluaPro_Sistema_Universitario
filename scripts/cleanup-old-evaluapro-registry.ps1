[CmdletBinding()]
# Cleanup helper for old EvaluaPro uninstall registry entries.
# Backups HKLM/HKCU and removes only legacy EvaluaPro uninstall keys.
param(
  [string]$BackupDir = '',
  [switch]$WhatIf
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

  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList ($argList -join ' ')
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
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
}

function Get-EvaluaproCleanupPaths {
  $paths = New-Object 'System.Collections.Generic.List[string]'

  foreach ($candidate in @(
    'C:\Program Files\EvaluaPro',
    'C:\ProgramData\EvaluaPro',
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'),
    (Join-Path [Environment]::GetFolderPath('Programs') 'EvaluaPro'),
    (Join-Path [Environment]::GetFolderPath('Desktop') 'EvaluaPro - Hub.lnk'),
    (Join-Path [Environment]::GetFolderPath('Desktop') 'EvaluaPro - Prod.lnk'),
    'C:\Users\Public\Desktop\EvaluaPro - Dev.lnk',
    'C:\Users\Public\Desktop\EvaluaPro - Prod.lnk'
  )) {
    if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
      $paths.Add([string]$candidate) | Out-Null
    }
  }

  $packageCacheRoot = Join-Path $env:ProgramData 'Package Cache'
  if (Test-Path -LiteralPath $packageCacheRoot) {
    Get-ChildItem -LiteralPath $packageCacheRoot -Force -Recurse -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -like '*EvaluaPro*' -or $_.Name -like '*EvaluaPro*'
      } |
      ForEach-Object {
        $paths.Add($_.FullName) | Out-Null
      }
  }

  return $paths | Sort-Object -Unique
}

if (-not (Test-IsAdministrator)) {
  $forwardArgs = @('-BackupDir', $BackupDir)
  if ($WhatIf) {
    $forwardArgs += '-WhatIf'
  }
  Start-SelfElevated -ScriptPath $PSCommandPath -Args $forwardArgs
  exit 0
}

$backupRoot = Ensure-BackupDir -Path $BackupDir
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFileHklm = Join-Path $backupRoot ("evaluapro-uninstall-registry-backup-hklm-{0}.reg" -f $timestamp)
$backupFileHkcu = Join-Path $backupRoot ("evaluapro-uninstall-registry-backup-hkcu-{0}.reg" -f $timestamp)

$keys = @(Get-OldEvaluaProUninstallKeys)
if ($keys.Count -eq 0) {
  Write-Host 'No hay claves viejas de EvaluaPro para borrar.'
  exit 0
}

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

Write-Host 'Cleaning filesystem traces...'
foreach ($path in (Get-EvaluaproCleanupPaths)) {
  Write-Host ("Remove: {0}" -f $path)
  if (-not $WhatIf) {
    Remove-PathIfExists -Path $path
  }
}

$remaining = @(Get-OldEvaluaProUninstallKeys)
if ($remaining.Count -gt 0) {
  Write-Error ("Quedan claves viejas: {0}" -f ($remaining.RegistryPath -join ', '))
}

Write-Host 'OK: claves viejas eliminadas.'
