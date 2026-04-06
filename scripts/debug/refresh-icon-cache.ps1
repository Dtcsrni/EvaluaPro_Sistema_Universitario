# Rebuilds the Windows Explorer icon cache so freshly built installer icons
# show up without stale shell-cache artifacts.
param(
  [switch]$IncludeThumbCache,
  [switch]$NoRestartExplorer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Remove-CacheFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Patterns
  )

  $explorerCacheRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'
  if (-not (Test-Path -LiteralPath $explorerCacheRoot)) {
    throw "No existe carpeta de caché de Explorer: $explorerCacheRoot"
  }

  foreach ($pattern in $Patterns) {
    Get-ChildItem -Path $explorerCacheRoot -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }
}

$explorerProcesses = @(Get-Process -Name explorer -ErrorAction SilentlyContinue)
if ($explorerProcesses.Count -gt 0) {
  Write-Host '[icon-cache] Cerrando Explorer...'
  $explorerProcesses | Stop-Process -Force
  Start-Sleep -Milliseconds 1200
}

$patterns = @('iconcache*')
if ($IncludeThumbCache) {
  $patterns += 'thumbcache*'
}

Write-Host "[icon-cache] Eliminando patrones: $($patterns -join ', ')"
Remove-CacheFiles -Patterns $patterns

if (-not $NoRestartExplorer) {
  Write-Host '[icon-cache] Reiniciando Explorer...'
  Start-Process explorer.exe | Out-Null
}

Write-Host '[icon-cache] Caché reconstruida.'
