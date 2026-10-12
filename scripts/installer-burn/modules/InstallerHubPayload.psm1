Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$operationModulePath = Join-Path $PSScriptRoot 'InstallerHubOperation.psm1'
$transactionModulePath = Join-Path $PSScriptRoot 'InstallerHubTransaction.psm1'
foreach ($modulePath in @($operationModulePath, $transactionModulePath)) {
  if (-not (Test-Path -LiteralPath $modulePath -PathType Leaf)) {
    throw "Falta una dependencia del módulo de payload: $modulePath"
  }
}
Import-Module $operationModulePath -DisableNameChecking
Import-Module $transactionModulePath -DisableNameChecking

function Resolve-EvaluaProNativePayloadZip {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $root = Assert-EvaluaProInstallPath -Path $TargetDir
  $payload = Join-Path $root 'evaluapro-native-dist.zip'
  if (-not (Test-Path -LiteralPath $payload -PathType Leaf)) {
    throw "No existe el payload instalado por el MSI: $payload"
  }
  $item = Get-Item -LiteralPath $payload -Force -ErrorAction Stop
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'El payload MSI es un enlace/reparse point y se rechaza.'
  }
  return $payload
}

function Assert-EvaluaProPayloadArchive {
  param(
    [Parameter(Mandatory = $true)][string]$PayloadZip,
    [Parameter(Mandatory = $true)][string]$ExpectedPath
  )

  $item = Get-Item -LiteralPath $PayloadZip -Force -ErrorAction Stop
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "El archivo de payload no es un archivo regular: $PayloadZip"
  }
  $actualPath = [IO.Path]::GetFullPath($item.FullName)
  $expectedFullPath = [IO.Path]::GetFullPath($ExpectedPath)
  if (-not $actualPath.Equals($expectedFullPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La transacción solo admite el payload registrado por el MSI para esa raíz.'
  }
}

function Invoke-EvaluaProPayloadPromotion {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$PayloadZip,
    [Parameter(Mandatory = $true)][string]$LockedRoot,
    [string]$OperationId = '',
    [scriptblock]$OnProgress,
    [scriptblock]$OnBeforePromoteEntry
  )

  $root = Assert-EvaluaProInstallPath -Path $TargetDir
  $canonicalLockRoot = [IO.Path]::GetFullPath($LockedRoot).TrimEnd('\')
  if (-not $root.Equals($canonicalLockRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "La raíz objetivo cambió después de adquirir el lock: $root"
  }
  Assert-EvaluaProPayloadArchive -PayloadZip $PayloadZip -ExpectedPath (Join-Path $root 'evaluapro-native-dist.zip')

  $payloadStage = Join-Path $root ('.payload-stage-' + [Guid]::NewGuid().ToString('N'))
  $transactionOwned = $false
  try {
    New-Item -ItemType Directory -Path $payloadStage -ErrorAction Stop | Out-Null
    $tar = Get-Command -Name 'tar.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($OnProgress) { & $OnProgress 34 'Extrayendo archivos del payload nativo.' }
    if ($tar) {
      $extractOutput = @(& $tar.Source -xf $PayloadZip -C $payloadStage 2>&1)
      $extractExitCode = $LASTEXITCODE
      if ($extractExitCode -ne 0) {
        $extractDetail = (@($extractOutput | Select-Object -Last 8) -join ' ').Trim()
        throw "No se pudo extraer el payload nativo con tar.exe (exit=$extractExitCode). $extractDetail"
      }
    } else {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::ExtractToDirectory($PayloadZip, $payloadStage)
    }

    if ($OnProgress) { & $OnProgress 52 'Validando los archivos esenciales del payload.' }
    $requiredPayloadFiles = @(
      'apps\backend\dist\index.js',
      'apps\backend\dist\prisma\schema.sql',
      'apps\backend\package.json',
      'runtime\node\node.exe',
      'scripts\start-docente-native.mjs',
      'scripts\runtime-env.mjs'
    )
    $backendPackagePath = Join-Path $payloadStage 'apps\backend\package.json'
    try {
      $backendPackage = Get-Content -LiteralPath $backendPackagePath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
      $payloadVersion = [version]::Parse([string]$backendPackage.version)
    } catch {
      throw "No se pudo identificar una versión válida en apps\backend\package.json del payload: $($_.Exception.Message)"
    }
    # La rama 1.2.4 agregó estas migraciones; se conserva compatibilidad con el MSI oficial 1.2.3.
    if ($payloadVersion -ge [version]'1.2.4') {
      $requiredPayloadFiles += @(
        'scripts\migrate-calificacion-origen-inferida-sqlite.mjs',
        'scripts\migrate-preferencias-retencion-parcial-sqlite.mjs',
        'scripts\migrate-resultados-extra-externos-sqlite.mjs'
      )
    }
    foreach ($relativePath in $requiredPayloadFiles) {
      if (-not (Test-Path -LiteralPath (Join-Path $payloadStage $relativePath) -PathType Leaf)) {
        throw "Payload nativo incompleto: falta $relativePath"
      }
    }

    $stagedEntries = @(Get-ChildItem -LiteralPath $payloadStage -Force -ErrorAction Stop)
    $managedNames = @($stagedEntries | ForEach-Object { [string]$_.Name })
    foreach ($name in $managedNames) {
      if ($name -in @('data', '.env', '.evaluapro-payload-transaction') -or $name -match '[\\/:]' -or $name -in @('.', '..')) {
        throw "El payload incluye una raíz protegida o inválida: $name"
      }
    }
    foreach ($item in @(Get-ChildItem -LiteralPath $payloadStage -Recurse -Force -ErrorAction Stop)) {
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "El payload contiene un enlace/reparse point no permitido: $($item.FullName)"
      }
    }

    $transactionDir = Join-Path $root '.evaluapro-payload-transaction'
    if (Test-Path -LiteralPath $transactionDir) { Recover-PayloadTransaction -TargetDir $root }
    New-Item -ItemType Directory -Path (Join-Path $transactionDir 'backup') -Force -ErrorAction Stop | Out-Null
    $entries = @($managedNames | ForEach-Object {
      [ordered]@{ name = [string]$_; existed = (Test-Path -LiteralPath (Join-Path $root ([string]$_))); snapshot = $false }
    })
    $envPath = Join-Path $root '.env'
    $entries += [ordered]@{ name = '.env'; existed = (Test-Path -LiteralPath $envPath); snapshot = $true }
    $journal = [ordered]@{
      schemaVersion = 1
      root = $root
      state = 'validated'
      operationId = $OperationId
      transactionId = [Guid]::NewGuid().ToString('N')
      entries = $entries
    }
    Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
    $journal = Set-EvaluaProOperationState -Journal $journal -State 'promoting'
    Write-PayloadTransactionJournal -TransactionDir $transactionDir -Journal $journal
    $transactionOwned = $true

    foreach ($entry in $entries) {
      $name = [string]$entry.name
      $destination = Join-Path $root $name
      $backup = Join-Path (Join-Path $transactionDir 'backup') $name
      if ([bool]$entry.snapshot) {
        if ([bool]$entry.existed) {
          $backupTemporary = $backup + '.tmp'
          Copy-Item -LiteralPath $destination -Destination $backupTemporary -Force -ErrorAction Stop
          Move-Item -LiteralPath $backupTemporary -Destination $backup -Force -ErrorAction Stop
        }
        continue
      }
      if ([bool]$entry.existed -and (Test-Path -LiteralPath $destination)) {
        Move-Item -LiteralPath $destination -Destination $backup -ErrorAction Stop
      }
      if ($OnBeforePromoteEntry) { & $OnBeforePromoteEntry $name }
      $stagedEntry = Join-Path $payloadStage $name
      if (-not (Test-Path -LiteralPath $stagedEntry)) {
        throw "La entrada validada desapareció del staging: $name"
      }
      Move-Item -LiteralPath $stagedEntry -Destination $destination -ErrorAction Stop
    }
    return [pscustomobject]@{ ok = $true; transactionPending = $true; root = $root; transactionId = $journal.transactionId; version = [string]$backendPackage.version }
  } catch {
    if ($transactionOwned) {
      $promotionError = $_.Exception.Message
      try {
        Recover-PayloadTransaction -TargetDir $root
      } catch {
        throw "Falló la promoción del payload y también su rollback. Transacción preservada en $(Join-Path $root '.evaluapro-payload-transaction'). Error de promoción: $promotionError. Error de rollback: $($_.Exception.Message)"
      }
    }
    throw
  } finally {
    if (Test-Path -LiteralPath $payloadStage) {
      Remove-Item -LiteralPath $payloadStage -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

Export-ModuleMember -Function @('Resolve-EvaluaProNativePayloadZip', 'Invoke-EvaluaProPayloadPromotion')
