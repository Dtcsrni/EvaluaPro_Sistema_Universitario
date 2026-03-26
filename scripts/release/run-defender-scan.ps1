param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath,
  [string]$ReportPath = 'dist/installer/antivirus-scan-report.txt'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $TargetPath)) {
  throw "No se encontro objetivo para antivirus: $TargetPath"
}

$resolvedTarget = (Resolve-Path -LiteralPath $TargetPath).Path
$resolvedReport = [System.IO.Path]::GetFullPath($ReportPath)
$reportDir = Split-Path -Parent $resolvedReport
if (-not (Test-Path -LiteralPath $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$warnings = New-Object System.Collections.Generic.List[string]
$scannerPath = ''
$scanMethod = ''
$scanExitCode = 0
$result = 'clean'
$mpCmdRunLogPath = Join-Path $env:TEMP 'MpCmdRun.log'

function Get-MpCmdRunPath {
  $candidatePaths = @(
    "$env:ProgramFiles\Windows Defender\MpCmdRun.exe",
    "$env:ProgramFiles\Microsoft Defender\MpCmdRun.exe"
  )
  $wildcards = @(
    "$env:ProgramData\Microsoft\Windows Defender\Platform\*\MpCmdRun.exe"
  )

  foreach ($pattern in $wildcards) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) { $candidatePaths += $found.FullName }
  }

  return ($candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1)
}

function Find-ThreatsForTarget {
  param([string]$PathToMatch)
  $detections = @()
  if (-not (Get-Command Get-MpThreatDetection -ErrorAction SilentlyContinue)) {
    return $detections
  }

  $all = Get-MpThreatDetection -ErrorAction SilentlyContinue
  if (-not $all) { return $detections }

  $pattern = [regex]::Escape($PathToMatch)
  foreach ($item in $all) {
    $resources = @()
    if ($item.PSObject.Properties.Match('Resources').Count -gt 0 -and $item.Resources) {
      $resources = @($item.Resources)
    }
    $joined = ($resources -join ' ')
    if ($joined -match $pattern) {
      $detections += $item
    }
  }
  return $detections
}

if (Get-Command Update-MpSignature -ErrorAction SilentlyContinue) {
  try {
    Update-MpSignature -ErrorAction Stop | Out-Null
  } catch {
    $warnings.Add("signature_update_failed=$($_.Exception.Message)")
  }
}

if (Get-Command Start-MpScan -ErrorAction SilentlyContinue) {
  try {
    Start-MpScan -ScanType CustomScan -ScanPath $resolvedTarget -ErrorAction Stop | Out-Null
    $scanMethod = 'Start-MpScan'
    $scanExitCode = 0
  } catch {
    $warnings.Add("start_mpscan_failed=$($_.Exception.Message)")
  }
}

if (-not $scanMethod) {
  $scannerPath = Get-MpCmdRunPath
  if (-not $scannerPath) {
    throw 'No se encontro un escaner de Microsoft Defender disponible (Start-MpScan/MpCmdRun).'
  }

  $scanMethod = 'MpCmdRun'
  & $scannerPath -Scan -ScanType 3 -File $resolvedTarget
  $scanExitCode = $LASTEXITCODE
}

if ($scanExitCode -ne 0) {
  $detections = Find-ThreatsForTarget -PathToMatch $resolvedTarget
  if (@($detections).Count -gt 0) {
    throw "Microsoft Defender reporto detecciones para el instalador (exitCode=$scanExitCode)."
  }

  if ($scanExitCode -eq 2) {
    $result = 'clean_with_scan_warning'
    $warnings.Add('mpcmdrun_exit_2_detected_without_target_threats=true')
    if (Test-Path -LiteralPath $mpCmdRunLogPath) {
      $warnings.Add("mpcmdrun_log=$mpCmdRunLogPath")
    }
  } else {
    throw "Antivirus no pudo validar el archivo (exit code: $scanExitCode)."
  }
}

@(
  'scanner=Microsoft Defender',
  "scannerPath=$scannerPath",
  "scanMethod=$scanMethod",
  "target=$resolvedTarget",
  "result=$result",
  "scanExitCode=$scanExitCode",
  ("warnings=" + (($warnings -join ' | ').Trim())),
  "timestampUtc=$([DateTime]::UtcNow.ToString('o'))"
) | Set-Content -Path $resolvedReport -Encoding utf8

Write-Host "Defender scan finalizado: result=$result method=$scanMethod exitCode=$scanExitCode"
