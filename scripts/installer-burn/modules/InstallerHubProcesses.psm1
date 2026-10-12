Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-EvaluaProOwnedNodeProcessIds {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $targetRoot = [IO.Path]::GetFullPath($TargetDir).TrimEnd('\')
  $runtimeNode = [IO.Path]::GetFullPath((Join-Path $targetRoot 'runtime\node\node.exe'))
  $rootArgumentPattern = '(?i)(?:^|\s)"?' + [Regex]::Escape($targetRoot.TrimEnd('\') + '\') + '[^"\s][^"]*'
  $processes = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop)
  $owned = @()

  foreach ($process in $processes) {
    $commandLine = [string]$process.CommandLine
    $executablePath = [string]$process.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($commandLine) -or [string]::IsNullOrWhiteSpace($executablePath) -or -not $process.ProcessId) {
      throw "No se pudo verificar la identidad del proceso node.exe PID=$($process.ProcessId); se cancela la mutación fail-closed."
    }
    $runtimeOwned = $false
    try { $runtimeOwned = [IO.Path]::GetFullPath($executablePath).Equals($runtimeNode, [StringComparison]::OrdinalIgnoreCase) } catch {}
    $commandOwned = [Regex]::IsMatch($commandLine, $rootArgumentPattern)
    if ($runtimeOwned -and $commandOwned -and $process.ProcessId) { $owned += [int]$process.ProcessId }
  }
  return @($owned | Select-Object -Unique)
}

function Stop-EvaluaProOwnedNodeProcesses {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $ownedIds = @(Get-EvaluaProOwnedNodeProcessIds -TargetDir $TargetDir)
  foreach ($processId in $ownedIds) {
    $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
    if ($null -eq $process) { continue }
    $currentOwnedIds = @(Get-EvaluaProOwnedNodeProcessIds -TargetDir $TargetDir)
    if ($currentOwnedIds -notcontains $processId) {
      throw "La identidad del proceso cambió antes de detener PID=$processId; se cancela la operación."
    }
    Stop-Process -Id $processId -Force -ErrorAction Stop
  }
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds(15)
  do {
    $remainingIds = @((Get-EvaluaProOwnedNodeProcessIds -TargetDir $TargetDir) | Where-Object { $ownedIds -contains $_ })
    if ($remainingIds.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
  } while ([DateTimeOffset]::UtcNow -lt $deadline)
  return [ordered]@{ requested = $ownedIds; remaining = $remainingIds; ok = $remainingIds.Count -eq 0 }
}

Export-ModuleMember -Function @('Get-EvaluaProOwnedNodeProcessIds', 'Stop-EvaluaProOwnedNodeProcesses')
