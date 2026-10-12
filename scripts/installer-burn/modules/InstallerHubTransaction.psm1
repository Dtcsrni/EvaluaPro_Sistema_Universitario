Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:InstallerHubTransactionLockedRoot = $null

$operationModulePath = Join-Path $PSScriptRoot 'InstallerHubOperation.psm1'
if (-not (Test-Path -LiteralPath $operationModulePath -PathType Leaf)) {
  throw "Falta el módulo de estados requerido por la transacción: $operationModulePath"
}
Import-Module $operationModulePath -DisableNameChecking -Force

function Set-EvaluaProTransactionLockedRoot {
  param([AllowEmptyString()][string]$RootPath)
  $script:InstallerHubTransactionLockedRoot = if ([string]::IsNullOrWhiteSpace($RootPath)) { $null } else { [IO.Path]::GetFullPath($RootPath).TrimEnd('\') }
}

function Write-PayloadTransactionJournal {
  param([Parameter(Mandatory = $true)][string]$TransactionDir, [Parameter(Mandatory = $true)][object]$Journal)

  $journalPath = Join-Path $TransactionDir 'journal.json'
  $temporaryPath = Join-Path $TransactionDir ('journal.' + [Guid]::NewGuid().ToString('N') + '.tmp')
  $replaceBackup = $temporaryPath + '.bak'
  $json = $Journal | ConvertTo-Json -Depth 8
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
  $stream = [IO.File]::Open($temporaryPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally { $stream.Dispose() }
  try {
    if (Test-Path -LiteralPath $journalPath) {
      [IO.File]::Replace($temporaryPath, $journalPath, $replaceBackup, $true)
      if (Test-Path -LiteralPath $replaceBackup) { Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction Stop }
    } else {
      [IO.File]::Move($temporaryPath, $journalPath)
    }
  } finally {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $replaceBackup) { Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue }
  }
}

function Set-PayloadTransactionState {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][ValidateSet('configuring','verifying','recovery_required','recovering','recovered','committed')][string]$State
  )
  $transactionDir = Join-Path ([IO.Path]::GetFullPath($TargetDir).TrimEnd('\')) '.evaluapro-payload-transaction'
  $journalPath = Join-Path $transactionDir 'journal.json'
  if (-not (Test-Path -LiteralPath $journalPath)) { throw "No existe diario para transición de operación: $journalPath" }
  $journal = Get-Content -LiteralPath $journalPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
  $journal = Set-EvaluaProOperationState -Journal $journal -State $State
  Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
}

function Remove-PayloadEntrySafely {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
  } elseif ($item.PSIsContainer) {
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
  } else {
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
  }
}

function Recover-PayloadTransaction {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $root = [IO.Path]::GetFullPath($TargetDir).TrimEnd('\')
  $transactionDir = Join-Path $root '.evaluapro-payload-transaction'
  if (-not (Test-Path -LiteralPath $transactionDir)) { return }
  if ($script:InstallerHubTransactionLockedRoot -and -not $root.Equals($script:InstallerHubTransactionLockedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "La transacción no coincide con la raíz bloqueada: $root"
  }
  $transactionItem = Get-Item -LiteralPath $transactionDir -Force -ErrorAction Stop
  if (($transactionItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "La ruta de recuperación es un junction/symlink y se rechaza: $transactionDir"
  }

  $journalPath = Join-Path $transactionDir 'journal.json'
  if (-not (Test-Path -LiteralPath $journalPath)) {
    $backupDir = Join-Path $transactionDir 'backup'
    $backupEntries = if (Test-Path -LiteralPath $backupDir) { @(Get-ChildItem -LiteralPath $backupDir -Force -ErrorAction Stop) } else { @() }
    if ($backupEntries.Count -gt 0) { throw "Transacción de payload sin diario y con respaldo; se conserva para diagnóstico: $transactionDir" }
    Remove-Item -LiteralPath $transactionDir -Recurse -Force -ErrorAction Stop
    return
  }
  $journal = Get-Content -LiteralPath $journalPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
  if ([int]$journal.schemaVersion -ne 1 -or
      -not [string]$journal.root -or
      -not ([IO.Path]::GetFullPath([string]$journal.root).TrimEnd('\')).Equals($root, [StringComparison]::OrdinalIgnoreCase) -or
      [string]$journal.state -notin @('validated', 'promoting', 'configuring', 'verifying', 'recovery_required', 'recovering', 'recovered', 'committed') -or
      $null -eq $journal.entries) {
    throw "Diario de transacción inválido o ajeno a la raíz; se conserva: $journalPath"
  }
  if ([string]$journal.state -in @('committed', 'recovered')) {
    Remove-Item -LiteralPath $transactionDir -Recurse -Force -ErrorAction Stop
    return
  }
  if ([string]$journal.state -ne 'recovery_required') {
    $journal = Set-EvaluaProOperationState -Journal $journal -State 'recovery_required'
    Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
  }
  $journal = Set-EvaluaProOperationState -Journal $journal -State 'recovering'
  Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal

  $backupDir = Join-Path $transactionDir 'backup'
  $restoreEntries = @($journal.entries)
  [Array]::Reverse($restoreEntries)
  foreach ($entry in $restoreEntries) {
    $name = [string]$entry.name
    $dataRemovalAllowed = $false
    $dataRemovalProperty = $journal.PSObject.Properties['allowDataRemoval']
    if ($dataRemovalProperty) { $dataRemovalAllowed = [bool]$dataRemovalProperty.Value }
    if ([string]::IsNullOrWhiteSpace($name) -or $name -match '[\\/:]' -or $name -in @('.', '..', '.evaluapro-payload-transaction') -or ($name -eq 'data' -and -not $dataRemovalAllowed)) {
      throw "El diario contiene una entrada de payload no permitida; se conserva: $journalPath"
    }
    $destination = Join-Path $root $name
    $backup = Join-Path $backupDir $name
    $backupExists = Test-Path -LiteralPath $backup
    if ($backupExists -and [bool]$entry.snapshot) {
      Remove-PayloadEntrySafely -Path $destination
      Copy-Item -LiteralPath $backup -Destination $destination -Force -ErrorAction Stop
    } elseif ($backupExists) {
      Remove-PayloadEntrySafely -Path $destination
      Move-Item -LiteralPath $backup -Destination $destination -Force -ErrorAction Stop
    } elseif (-not [bool]$entry.existed -and (Test-Path -LiteralPath $destination)) {
      Remove-PayloadEntrySafely -Path $destination
    }
  }
  $journal = Set-EvaluaProOperationState -Journal $journal -State 'recovered'
  Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
  Remove-Item -LiteralPath $transactionDir -Recurse -Force -ErrorAction Stop
}

function Complete-PayloadTransaction {
  param([Parameter(Mandatory = $true)][string]$TargetDir)
  $transactionDir = Join-Path ([IO.Path]::GetFullPath($TargetDir).TrimEnd('\')) '.evaluapro-payload-transaction'
  if (-not (Test-Path -LiteralPath $transactionDir)) { return }
  $journalPath = Join-Path $transactionDir 'journal.json'
  $journal = Get-Content -LiteralPath $journalPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
  $journal = Set-EvaluaProOperationState -Journal $journal -State 'committed'
  Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
  Remove-Item -LiteralPath $transactionDir -Recurse -Force -ErrorAction Stop
}

Export-ModuleMember -Function @('Set-EvaluaProTransactionLockedRoot', 'Write-PayloadTransactionJournal', 'Set-PayloadTransactionState', 'Remove-PayloadEntrySafely', 'Recover-PayloadTransaction', 'Complete-PayloadTransaction')
