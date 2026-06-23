# ops-maintenance.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [ValidateSet('report','weekly','monthly')]
  [string]$Mode = 'report',
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [int]$LogsRetentionDays = 14,
  [int]$TestRetentionDays = 7
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Section {
  param([string]$Title)
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Remove-OldFiles {
  param(
    [Parameter(Mandatory)] [string]$BasePath,
    [Parameter(Mandatory)] [string[]]$Patterns,
    [Parameter(Mandatory)] [int]$OlderThanDays
  )

  if (-not (Test-Path -LiteralPath $BasePath)) {
    return [pscustomobject]@{ Path = $BasePath; Deleted = 0; Bytes = 0L }
  }

  $cutoff = (Get-Date).AddDays(-$OlderThanDays)
  $deletedCount = 0
  $deletedBytes = 0L

  foreach ($pattern in $Patterns) {
    $files = Get-ChildItem -LiteralPath $BasePath -Recurse -Force -File -Filter $pattern -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt $cutoff }

    foreach ($file in $files) {
      try {
        $deletedBytes += [int64]$file.Length
        Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop
        $deletedCount++
      }
      catch {
        Write-Warning "No se pudo eliminar: $($file.FullName) :: $($_.Exception.Message)"
      }
    }
  }

  return [pscustomobject]@{ Path = $BasePath; Deleted = $deletedCount; Bytes = $deletedBytes }
}

function Get-RamSnapshot {
  $os = Get-CimInstance Win32_OperatingSystem
  $total = [double]$os.TotalVisibleMemorySize * 1KB
  $free = [double]$os.FreePhysicalMemory * 1KB
  $used = $total - $free
  $usedPct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 2) } else { 0 }

  [pscustomobject]@{
    TotalGB = [math]::Round($total / 1GB, 2)
    UsedGB = [math]::Round($used / 1GB, 2)
    FreeGB = [math]::Round($free / 1GB, 2)
    UsedPct = $usedPct
  }
}

function Get-DriveSnapshot {
  Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $used = $_.Used
    $free = $_.Free
    $total = $used + $free
    $usedPct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 2) } else { 0 }

    [pscustomobject]@{
      Drive = $_.Name
      UsedGB = [math]::Round($used / 1GB, 2)
      FreeGB = [math]::Round($free / 1GB, 2)
      UsedPct = $usedPct
    }
  }
}

function Invoke-DockerCleanup {
  param([ValidateSet('weekly','monthly')] [string]$CleanupMode)

  Write-Section "Docker cleanup ($CleanupMode)"

  if ($CleanupMode -eq 'weekly') {
    docker system prune -f
    docker builder prune -a -f
    docker volume prune -f
    docker network prune -f
    return
  }

  docker compose down --volumes --remove-orphans
  docker system prune -a --volumes -f
  docker builder prune -a -f
}

function Write-SeparationStatus {
  param([string]$Root)

  Write-Section 'Aislamiento de datos (dev/prod/test)'

  $expectedPaths = @(
    (Join-Path $Root 'apps/backend/data/examenes_dev'),
    (Join-Path $Root 'apps/backend/data/examenes_prod'),
    (Join-Path $Root 'apps/backend/data/examenes_test')
  )

  foreach ($path in $expectedPaths) {
    $exists = Test-Path -LiteralPath $path
    $status = if ($exists) { 'OK' } else { 'MISSING' }
    Write-Host "$status :: $path"
  }
}

Push-Location $RepoRoot
try {
  Write-Section "Modo de mantenimiento: $Mode"
  Write-Host "RepoRoot=$RepoRoot"

  Write-Section 'Snapshot inicial'
  docker system df
  $ramBefore = Get-RamSnapshot
  Write-Host ("RAM total={0}GB usada={1}GB libre={2}GB uso={3}%" -f $ramBefore.TotalGB, $ramBefore.UsedGB, $ramBefore.FreeGB, $ramBefore.UsedPct)

  Get-DriveSnapshot | Sort-Object Drive | ForEach-Object {
    Write-Host ("Disco {0}: usado={1}GB libre={2}GB uso={3}%" -f $_.Drive, $_.UsedGB, $_.FreeGB, $_.UsedPct)
  }

  Write-SeparationStatus -Root $RepoRoot

  if ($Mode -ne 'report') {
    Write-Section 'Limpieza de archivos temporales locales'

    $cleanupTargets = @(
      @{ Path = (Join-Path $RepoRoot 'logs'); Patterns = @('*.log', '*.txt'); Days = $LogsRetentionDays },
      @{ Path = (Join-Path $RepoRoot 'test-results'); Patterns = @('*.*'); Days = $TestRetentionDays },
      @{ Path = (Join-Path $RepoRoot 'reports'); Patterns = @('*.tmp', '*.temp', '*.log'); Days = $TestRetentionDays }
    )

    $totalDeleted = 0
    $totalBytes = 0L

    foreach ($target in $cleanupTargets) {
      $result = Remove-OldFiles -BasePath $target.Path -Patterns $target.Patterns -OlderThanDays $target.Days
      $totalDeleted += $result.Deleted
      $totalBytes += $result.Bytes
      Write-Host ("Limpieza {0}: archivos={1}, bytes={2}" -f $result.Path, $result.Deleted, $result.Bytes)
    }

    Write-Host ("Total archivos eliminados={0}, espacio={1} MB" -f $totalDeleted, [math]::Round($totalBytes / 1MB, 2))

    Invoke-DockerCleanup -CleanupMode $Mode
  }

  Write-Section 'Snapshot final'
  docker system df
  $ramAfter = Get-RamSnapshot
  Write-Host ("RAM total={0}GB usada={1}GB libre={2}GB uso={3}%" -f $ramAfter.TotalGB, $ramAfter.UsedGB, $ramAfter.FreeGB, $ramAfter.UsedPct)
}
finally {
  Pop-Location
}
