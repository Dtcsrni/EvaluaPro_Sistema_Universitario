# Native Lightweight Helper for the Burn-based EvaluaPro installer.
# Replaces the legacy Docker/WSL orchestration.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('detect-prereqs', 'post-install', 'license-heartbeat', 'update', 'uninstall')]
  [string]$Mode,
  [string]$RequestPath = '',
  [string]$RequestJsonBase64 = '',
  [Parameter(Mandatory = $true)]
  [string]$ResponsePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:InstallerRootMutex = $null
$script:InstallerRootMutexOwned = $false
$script:InstallerRootPath = $null
$script:PendingPayloadTransaction = $false
$script:InstallerHubOperationId = $null
$script:InstallerRequestPayload = $null
$script:InstallerRequestJson = $null

# Forzar UTF-8 en todos los streams de PowerShell para evitar corrupción de
# caracteres especiales (tildes, eñes) en el JSON de respuesta.
# Necesario en PowerShell 5.1 (Windows PowerShell) que hereda el encoding de la consola.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding            = [System.Text.Encoding]::UTF8

$moduleRoots = @(
  (Join-Path $PSScriptRoot 'modules'),
  $PSScriptRoot
)
$operationalConfigModule = $null
$installerHubContractsModule = $null
$installerHubOperationModule = $null
$installerHubProcessesModule = $null
$installerHubTransactionModule = $null
$installerHubPayloadModule = $null
$installerHubVerificationModule = $null
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubContracts.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubContractsModule = $candidate; break }
}
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubOperation.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubOperationModule = $candidate; break }
}
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubProcesses.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubProcessesModule = $candidate; break }
}
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubTransaction.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubTransactionModule = $candidate; break }
}
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubPayload.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubPayloadModule = $candidate; break }
}
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'InstallerHubVerification.psm1'
  if (Test-Path -LiteralPath $candidate) { $installerHubVerificationModule = $candidate; break }
}
if (-not $installerHubContractsModule -or -not $installerHubOperationModule -or -not $installerHubProcessesModule -or -not $installerHubTransactionModule -or -not $installerHubPayloadModule -or -not $installerHubVerificationModule) {
  throw 'Payload incompleto: faltan módulos de contrato, operación, procesos, transacción, payload o verificación del Installer Hub.'
}
$script:InstallerHubModuleInstances = @{
  Contracts = Import-Module $installerHubContractsModule -DisableNameChecking -Force -PassThru
  Operation = Import-Module $installerHubOperationModule -DisableNameChecking -Force -PassThru
  Processes = Import-Module $installerHubProcessesModule -DisableNameChecking -Force -PassThru
  Transaction = Import-Module $installerHubTransactionModule -DisableNameChecking -Force -PassThru
  Payload = Import-Module $installerHubPayloadModule -DisableNameChecking -Force -PassThru
  Verification = Import-Module $installerHubVerificationModule -DisableNameChecking -Force -PassThru
}

function Invoke-InstallerHubModuleFunction {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('Contracts','Operation','Processes','Transaction','Payload','Verification')][string]$ModuleName,
    [Parameter(Mandatory = $true)][string]$FunctionName,
    [hashtable]$Parameters = @{}
  )

  $module = $script:InstallerHubModuleInstances[$ModuleName]
  if (-not $module) { throw "Módulo de Installer Hub no inicializado: $ModuleName" }
  return & $module { param($name, $boundParameters) & $name @boundParameters } $FunctionName $Parameters
}

foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'OperationalConfig.psm1'
  if (Test-Path -LiteralPath $candidate) {
    $operationalConfigModule = $candidate
    break
  }
}
if ($operationalConfigModule) {
  Import-Module $operationalConfigModule -DisableNameChecking -Force
}
$licenseSecurityModule = $null
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'LicenseClientSecurity.psm1'
  if (Test-Path -LiteralPath $candidate) {
    $licenseSecurityModule = $candidate
    break
  }
}
if ($licenseSecurityModule) {
  Import-Module $licenseSecurityModule -DisableNameChecking -Force
}

function Write-Response {
  param([hashtable]$Payload)
  $Payload['schemaVersion'] = 1
  if (-not $script:InstallerHubOperationId) { $script:InstallerHubOperationId = [guid]::NewGuid().ToString('D') }
  $Payload['operationId'] = $script:InstallerHubOperationId
  if (-not $Payload.ContainsKey('exitCode')) { $Payload['exitCode'] = if ($Payload['ok']) { 0 } else { 1 } }
  if (-not $Payload.ContainsKey('message')) { $Payload['message'] = '' }
  $json = Protect-EvaluaProDiagnosticText -Text ($Payload | ConvertTo-Json -Depth 10)
  Write-EvaluaProAtomicText -Path $ResponsePath -Content ($json + [Environment]::NewLine) -Encoding ([System.Text.UTF8Encoding]::new($false))
}

function Read-InstallerRequestPayload {
  if ($null -ne $script:InstallerRequestPayload) { return $script:InstallerRequestPayload }
  $requestJson = ''
  if (-not [string]::IsNullOrWhiteSpace($RequestJsonBase64)) {
    try {
      $requestBytes = [Convert]::FromBase64String($RequestJsonBase64)
      if ($requestBytes.Length -gt 16384) { throw 'El snapshot del handoff excede el límite seguro de 16 KiB.' }
      $requestJson = [Text.Encoding]::UTF8.GetString($requestBytes)
      [Array]::Clear($requestBytes, 0, $requestBytes.Length)
    } catch {
      throw "El snapshot inmutable del handoff es inválido: $($_.Exception.Message)"
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($RequestPath)) {
    $requestItem = Get-Item -LiteralPath $RequestPath -Force -ErrorAction Stop
    if (($requestItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'El archivo de solicitud es un enlace/reparse point y se rechaza.'
    }
    $requestJson = [IO.File]::ReadAllText($requestItem.FullName, [Text.Encoding]::UTF8)
    if ([Text.Encoding]::UTF8.GetByteCount($requestJson) -gt 16384) {
      throw 'La solicitud Installer Hub excede el límite seguro de 16 KiB.'
    }
  } else {
    throw 'Falta el contenido inmutable o la ruta del handoff Installer Hub.'
  }
  $script:InstallerRequestJson = $requestJson
  # Preserve the caller's correlation even when strict contract validation fails.
  # This lets the caller receive the actual validation error instead of masking it
  # as a response with a newly generated, unrelated operationId.
  try {
    $rawEnvelope = $requestJson | ConvertFrom-Json -ErrorAction Stop
    $candidateOperationId = [guid]::Empty
    if ([guid]::TryParse([string]$rawEnvelope.operationId, [ref]$candidateOperationId)) {
      $script:InstallerHubOperationId = $candidateOperationId.ToString('D')
    }
  } catch { }
  $request = Invoke-InstallerHubModuleFunction -ModuleName Contracts -FunctionName 'Read-EvaluaProInstallerRequest' -Parameters @{
    Path = $RequestPath
    JsonContent = $requestJson
    ExpectedCommand = $Mode
  }
  $script:InstallerHubOperationId = $request.OperationId
  $script:InstallerRequestPayload = $request.Payload
  return $request.Payload
}

function Write-HelperProgress {
  param(
    [Parameter(Mandatory = $true)][int]$Percent,
    [Parameter(Mandatory = $true)][string]$Status
  )

  $event = [ordered]@{
    Percent = [Math]::Max(0, [Math]::Min(100, $Percent))
    Status = $Status
  }
  # Progress is a side channel, not part of a function's return value. This
  # callback is passed to module operations, so pipeline output would be
  # collected with the result and could hide fields such as transactionPending.
  [Console]::Out.WriteLine("EVALUAPRO_PROGRESS:" + ($event | ConvertTo-Json -Compress))
}

function Invoke-ShortcutReconciliation {
  param(
    [Parameter(Mandatory = $true)][string]$PowerShellPath,
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [int]$TimeoutSeconds = 90
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $PowerShellPath
  $startInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '" -OutputDir accesos-directos -Force -SyncRepoOutput -SkipManifestUpdate -Port 4519'
  $startInfo.WorkingDirectory = $TargetDir
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  if (-not $process.Start()) { throw 'No se pudo iniciar la reconciliación de accesos directos.' }

  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try { $process.Kill() } catch {}
    $stopped = $false
    try { $stopped = $process.WaitForExit(5000) } catch {}
    $stdout = ''
    $stderr = ''
    if ($stopped) {
      $stdout = try { $stdoutTask.GetAwaiter().GetResult() } catch { '' }
      $stderr = try { $stderrTask.GetAwaiter().GetResult() } catch { '' }
    } else {
      $stderr = 'El proceso no terminó después de solicitar su cierre.'
    }
    return [pscustomobject]@{
      ExitCode = $null
      TimedOut = $true
      Stdout = [string]$stdout
      Stderr = [string]$stderr
    }
  }

  $process.WaitForExit()
  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    TimedOut = $false
    Stdout = [string]$stdoutTask.GetAwaiter().GetResult()
    Stderr = [string]$stderrTask.GetAwaiter().GetResult()
  }
}

function Get-RequestValue {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Request,
    [Parameter(Mandatory = $true)]
    [string[]]$Names,
    [object]$DefaultValue = $null
  )

  foreach ($name in $Names) {
    $property = $Request.PSObject.Properties.Match($name) | Select-Object -First 1
    if ($property -and $null -ne $property.Value -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      return $property.Value
    }
  }

  return $DefaultValue
}

function Get-TargetInstallDir {
  param([Parameter(Mandatory = $true)][object]$Request)
  return [string](Get-RequestValue -Request $Request -Names @('TargetDir', 'targetDir', 'InstallDir', 'installDir') -DefaultValue 'C:\Program Files\EvaluaPro')
}

function Assert-InstallerHubTreeHasNoReparsePoints {
  param([Parameter(Mandatory = $true)][string]$Path)

  $root = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (($root.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Se rechazó una raíz de datos con reparse point: $Path"
  }
  $pending = New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
  if ($root -is [IO.DirectoryInfo]) { $pending.Push($root) }
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($child in $directory.GetFileSystemInfos()) {
      if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Se rechazó un enlace/reparse point dentro del árbol de datos: $($child.FullName)"
      }
      if ($child -is [IO.DirectoryInfo]) { $pending.Push($child) }
    }
  }
}

function Enter-InstallerRootLock {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $root = Invoke-InstallerHubModuleFunction -ModuleName Operation -FunctionName 'Assert-EvaluaProInstallPath' -Parameters @{ Path = $TargetDir }
  if (Test-Path -LiteralPath $root -PathType Leaf) {
    throw "La ruta de instalación apunta a un archivo: $root"
  }
  if (-not (Test-Path -LiteralPath $root)) {
    New-Item -ItemType Directory -Path $root -Force -ErrorAction Stop | Out-Null
  }
  $rootItem = Get-Item -LiteralPath $root -Force -ErrorAction Stop
  if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "La raíz de instalación no puede ser un junction/symlink: $root"
  }

  $hash = [Security.Cryptography.SHA256]::Create()
  try {
    $rootBytes = [Text.Encoding]::Unicode.GetBytes($root.ToUpperInvariant())
    $rootHash = ([BitConverter]::ToString($hash.ComputeHash($rootBytes)) -replace '-', '').ToLowerInvariant()
  } finally { $hash.Dispose() }
  $mutexName = 'Global\EvaluaProInstallerRoot-' + $rootHash
  $createdNew = $false
  $script:InstallerRootMutex = [Threading.Mutex]::new($false, $mutexName, [ref]$createdNew)
  try {
    $script:InstallerRootMutexOwned = $script:InstallerRootMutex.WaitOne([TimeSpan]::FromMinutes(2))
  } catch [Threading.AbandonedMutexException] {
    $script:InstallerRootMutexOwned = $true
  }
  if (-not $script:InstallerRootMutexOwned) {
    $script:InstallerRootMutex.Dispose()
    $script:InstallerRootMutex = $null
    throw "Otra operación del Installer Hub mantiene el lock de '$root' después de 120 segundos."
  }
  $script:InstallerRootPath = $root
  Set-EvaluaProTransactionLockedRoot -RootPath $root
}

function Exit-InstallerRootLock {
  if ($script:InstallerRootMutex) {
    if ($script:InstallerRootMutexOwned) { $script:InstallerRootMutex.ReleaseMutex() }
    $script:InstallerRootMutex.Dispose()
    $script:InstallerRootMutex = $null
    $script:InstallerRootMutexOwned = $false
    $script:InstallerRootPath = $null
    Set-EvaluaProTransactionLockedRoot -RootPath ''
  }
}

function Resolve-NativePayloadZip {
  param([Parameter(Mandatory = $true)][string]$TargetDir)
  return Invoke-InstallerHubModuleFunction -ModuleName Payload -FunctionName 'Resolve-EvaluaProNativePayloadZip' -Parameters @{ TargetDir = $TargetDir }
}

function Expand-NativePayload {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$PayloadZip
  )

  $result = Invoke-InstallerHubModuleFunction -ModuleName Payload -FunctionName 'Invoke-EvaluaProPayloadPromotion' -Parameters @{
    TargetDir = $TargetDir
    PayloadZip = $PayloadZip
    LockedRoot = $script:InstallerRootPath
    OperationId = $script:InstallerHubOperationId
    OnProgress = { param($percent, $status) Write-HelperProgress -Percent $percent -Status $status }
  }
  $requiredResultFields = @('ok', 'transactionPending', 'root', 'transactionId', 'version')
  if ($null -eq $result -or $result -is [array]) {
    throw 'El módulo de payload devolvió una respuesta sin objeto único; se detiene la operación antes de configurar el runtime.'
  }
  foreach ($field in $requiredResultFields) {
    if ($null -eq $result.PSObject.Properties[$field]) {
      throw "El módulo de payload devolvió un resultado fuera del contrato; falta '$field'."
    }
  }
  if (-not [bool]$result.ok -or -not [bool]$result.transactionPending) {
    throw 'El módulo de payload no confirmó una transacción pendiente válida; se detiene la operación antes de configurar el runtime.'
  }
  $resultRoot = [IO.Path]::GetFullPath([string]$result.root).TrimEnd('\')
  if (-not $resultRoot.Equals($script:InstallerRootPath, [StringComparison]::OrdinalIgnoreCase) -or
      [string]$result.transactionId -notmatch '^[0-9a-fA-F]{32}$' -or
      [string]::IsNullOrWhiteSpace([string]$result.version)) {
    throw 'El módulo de payload devolvió una identidad de transacción incompleta o ajena a la raíz bloqueada.'
  }
  $script:PendingPayloadTransaction = $true
  Write-Host 'Payload nativo validado y expandido en la raíz de instalación.'
}

function Wait-NativeDashboardReady {
  param([int]$Port = 4519, [int]$TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, $TimeoutSeconds))
  do {
    try {
      $response = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/api/status" -f $Port) -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Get-RequestConfigValue {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Request,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [string]$DefaultValue = ''
  )

  $config = $null
  $property = $Request.PSObject.Properties.Match('config') | Select-Object -First 1
  if ($property) { $config = $property.Value }
  if ($null -eq $config) { return $DefaultValue }
  $configProperty = $config.PSObject.Properties.Match($Name) | Select-Object -First 1
  if ($configProperty -and $null -ne $configProperty.Value -and -not [string]::IsNullOrWhiteSpace([string]$configProperty.Value)) {
    return [string]$configProperty.Value
  }
  return $DefaultValue
}

function ConvertTo-InstallerHashtable {
  param([object]$Value)

  if ($null -eq $Value) { return @{} }
  if ($Value -is [hashtable]) { return $Value }

  $map = @{}
  foreach ($property in $Value.PSObject.Properties) {
    $map[$property.Name] = $property.Value
  }
  return $map
}

function Get-RequestConfigMap {
  param([object]$Request)

  if ($null -eq $Request) { return @{} }
  $match = $Request.PSObject.Properties.Match('config')
  if ($match.Count -eq 0 -or $null -eq $match[0].Value) { return @{} }
  return ConvertTo-InstallerHashtable -Value $match[0].Value
}

function ConvertTo-VbsStringLiteralContent {
  param([Parameter(Mandatory = $true)][string]$Value)
  return ($Value -replace '"', '""')
}

function New-InstallerSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes)
}

function Set-InstallerEnvValue {
  param(
    [System.Collections.IDictionary]$Map,
    [string]$Key,
    [string]$Value
  )
  $Map[$Key] = [string]$Value
}

function Read-InstallerEnvMap {
  param([string]$Path)
  $map = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    $index = $line.IndexOf('=')
    if ($index -le 0) { continue }
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1)
    if (-not [string]::IsNullOrWhiteSpace($key)) {
      $map[$key] = $value
    }
  }
  return $map
}

function Write-InstallerEnvMap {
  param(
    [string]$Path,
    [System.Collections.IDictionary]$Map
  )
  $lines = @()
  foreach ($key in $Map.Keys) {
    $lines += ("{0}={1}" -f $key, $Map[$key])
  }
  Write-EvaluaProAtomicText -Path $Path -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding ([Text.UTF8Encoding]::new($false))
}

function Get-InstalledPackageVersion {
  param([string]$TargetDir)
  try {
    $packagePath = Join-Path $TargetDir 'package.json'
    if (-not (Test-Path -LiteralPath $packagePath)) { return '1.1.1' }
    $raw = Get-Content -LiteralPath $packagePath -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($raw)) { return '1.1.1' }
    $package = $raw | ConvertFrom-Json
    $version = [string]$package.version
    if ([string]::IsNullOrWhiteSpace($version)) { return '1.1.1' }
    return $version.Trim()
  } catch {
    return '1.1.1'
  }
}

function Write-InstallerRuntimeEnv {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][object]$Request
  )

  $envPath = Join-Path $TargetDir '.env'
  $envMap = Read-InstallerEnvMap -Path $envPath
  $existingJwt = if ($envMap.Contains('JWT_SECRETO')) { [string]$envMap['JWT_SECRETO'] } else { '' }
  $jwt = Get-RequestConfigValue -Request $Request -Name 'jwtSecreto' -DefaultValue $existingJwt
  if ([string]::IsNullOrWhiteSpace($jwt)) { $jwt = New-InstallerSecret }
  $existingBackupSecret = if ($envMap.Contains('EVALUAPRO_BACKUP_CIFRADO_SECRETO')) { [string]$envMap['EVALUAPRO_BACKUP_CIFRADO_SECRETO'] } else { '' }
  $backupSecret = Get-RequestConfigValue -Request $Request -Name 'backupCifradoSecreto' -DefaultValue $existingBackupSecret

  Set-InstallerEnvValue -Map $envMap -Key 'JWT_SECRETO' -Value $jwt
  Set-InstallerEnvValue -Map $envMap -Key 'EVALUAPRO_BACKUP_CIFRADO_SECRETO' -Value $backupSecret
  $flavorId = [string](Get-RequestConfigValue -Request $Request -Name 'flavorId' -DefaultValue 'docente-local')
  $localAppData = [string]$env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
  $targetFullPath = [IO.Path]::GetFullPath($TargetDir).TrimEnd('\')
  $qaRootPrefix = (Join-Path $localAppData 'EvaluaPro-QA-Isolated-').TrimEnd('\')
  $isQaInstall = $targetFullPath.StartsWith($qaRootPrefix, [StringComparison]::OrdinalIgnoreCase)
  $programDataRoot = [string]$env:ProgramData
  if ([string]::IsNullOrWhiteSpace($programDataRoot)) { $programDataRoot = 'C:\ProgramData' }
  $localDataRoot = if ($flavorId.Trim().ToLowerInvariant() -eq 'docente-local') {
    if ($isQaInstall) {
      $targetFullPath
    } else {
      Join-Path $programDataRoot 'EvaluaPro'
    }
  } else {
    Join-Path $localAppData 'EvaluaPro'
  }
  $localDataDir = Join-Path $localDataRoot 'data'
  if (-not (Test-Path -LiteralPath $localDataDir)) { New-Item -ItemType Directory -Path $localDataDir -Force | Out-Null }
  $localDatabaseUrl = 'file:' + (($localDataDir -replace '\\', '/') + '/evaluapro.db')
  $requestedDatabaseUrl = [string](Get-RequestConfigValue -Request $Request -Name 'databaseUrl' -DefaultValue $localDatabaseUrl)
  if ($isQaInstall) { $requestedDatabaseUrl = $localDatabaseUrl }
  Set-InstallerEnvValue -Map $envMap -Key 'DATABASE_URL' -Value $requestedDatabaseUrl
  Set-InstallerEnvValue -Map $envMap -Key 'BACKEND_DATABASE_URL' -Value $requestedDatabaseUrl
  Set-InstallerEnvValue -Map $envMap -Key 'NODE_ENV' -Value (Get-RequestConfigValue -Request $Request -Name 'nodeEnv' -DefaultValue 'production')
  Set-InstallerEnvValue -Map $envMap -Key 'PUERTO_API' -Value (Get-RequestConfigValue -Request $Request -Name 'puertoApi' -DefaultValue '4000')
  Set-InstallerEnvValue -Map $envMap -Key 'PUERTO_PORTAL' -Value (Get-RequestConfigValue -Request $Request -Name 'puertoPortal' -DefaultValue '4518')
  Set-InstallerEnvValue -Map $envMap -Key 'CORS_ORIGENES' -Value (Get-RequestConfigValue -Request $Request -Name 'corsOrigenes' -DefaultValue 'http://localhost:4173,http://127.0.0.1:4173')
  Set-InstallerEnvValue -Map $envMap -Key 'EVALUAPRO_FLAVOR' -Value (Get-RequestConfigValue -Request $Request -Name 'flavorId' -DefaultValue 'docente-local')
  Set-InstallerEnvValue -Map $envMap -Key 'BACKEND_DATA_DIR_DEV' -Value './apps/backend/data/examenes_dev'
  Set-InstallerEnvValue -Map $envMap -Key 'BACKEND_DATA_DIR_PROD' -Value './apps/backend/data/examenes_prod'
  Write-InstallerEnvMap -Path $envPath -Map $envMap
  $writtenEnv = Read-InstallerEnvMap -Path $envPath
  if ($flavorId.Trim().ToLowerInvariant() -eq 'docente-local') {
    $expectedDatabaseUrl = $requestedDatabaseUrl
    if ([string]$writtenEnv['DATABASE_URL'] -ne $expectedDatabaseUrl -or [string]$writtenEnv['BACKEND_DATABASE_URL'] -ne $expectedDatabaseUrl) {
      throw "La configuracion SQLite docente no persistio la ruta efectiva: esperada=$expectedDatabaseUrl"
    }
  }
}

function Assert-InstallerRuntimeEnv {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

  $envPath = Join-Path $TargetDir '.env'
  $envMap = Read-InstallerEnvMap -Path $envPath
  $required = @(
    'DATABASE_URL',
    'BACKEND_DATABASE_URL',
    'JWT_SECRETO',
    'NODE_ENV',
    'PUERTO_API',
    'CORS_ORIGENES'
  )
  $missing = @()
  foreach ($key in $required) {
    if (-not $envMap.Contains($key) -or [string]::IsNullOrWhiteSpace([string]$envMap[$key])) {
      $missing += $key
    }
  }
  if ($missing.Count -gt 0) {
    throw "Contrato runtime incompleto en .env. Faltan: $($missing -join ', ')"
  }
  if (Get-Command Test-InstallerOAuthEnv -ErrorAction SilentlyContinue) {
    $oauthValidation = Test-InstallerOAuthEnv -EnvMap $envMap
    if (-not $oauthValidation.ok) {
      throw "Contrato Google OAuth incompleto o invalido en .env. $($oauthValidation.errors -join ' | ')"
    }
  } else {
    throw 'Contrato runtime incompleto: no se pudo cargar el validador de Google OAuth.'
  }
  return $envPath
}

function Ensure-InstallerRuntimeContract {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][object]$Request
  )

  $requiredDirs = @(
    (Join-Path $TargetDir 'apps\backend\data\examenes_dev'),
    (Join-Path $TargetDir 'apps\backend\data\examenes_prod'),
    (Join-Path $TargetDir 'apps\backend\data\examenes_test'),
    (Join-Path $TargetDir 'logs'),
    (Join-Path $TargetDir 'runtime\node')
  )

  foreach ($dir in $requiredDirs) {
    if (-not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
  }

  $nodeTarget = Join-Path $TargetDir 'runtime\node\node.exe'
  if (-not (Test-Path -LiteralPath $nodeTarget)) {
    $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if ($nodeCommand -and (Test-Path -LiteralPath $nodeCommand.Source)) {
      Copy-Item -LiteralPath $nodeCommand.Source -Destination $nodeTarget -Force
    }
  }

  Write-InstallerRuntimeEnv -TargetDir $TargetDir -Request $Request
}

function Get-InstalledInstanceInventory {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [string]$RequestedFlavorId = 'docente-local'
  )

  # Solo inventario de lectura: esta función nunca invoca uninstall ni elimina
  # rutas. La limpieza de remanentes requiere una acción explícita posterior.
  $localAppData = [string]$env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
  $programFiles = [string]$env:ProgramFiles
  if ([string]::IsNullOrWhiteSpace($programFiles)) { $programFiles = 'C:\Program Files' }
  $programData = [string]$env:ProgramData
  if ([string]::IsNullOrWhiteSpace($programData)) { $programData = 'C:\ProgramData' }

  $candidateRoots = @(
    $TargetDir,
    (Join-Path $localAppData 'EvaluaPro'),
    (Join-Path $programFiles 'EvaluaPro')
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
    try { [IO.Path]::GetFullPath($_).TrimEnd('\') } catch { $null }
  } | Where-Object { $_ } | Select-Object -Unique

  $instances = @()
  $seenDataOnlyRoots = @{}
  $targetFullPath = try { [IO.Path]::GetFullPath($TargetDir).TrimEnd('\') } catch { $TargetDir.TrimEnd('\') }
  $knownLocalRoot = try { [IO.Path]::GetFullPath((Join-Path $localAppData 'EvaluaPro')).TrimEnd('\') } catch { Join-Path $localAppData 'EvaluaPro' }
  $knownProgramFilesRoot = try { [IO.Path]::GetFullPath((Join-Path $programFiles 'EvaluaPro')).TrimEnd('\') } catch { Join-Path $programFiles 'EvaluaPro' }
  foreach ($root in $candidateRoots) {
    $manifestPath = Join-Path $root 'logs\installation.manifest.json'
    $packagePath = Join-Path $root 'package.json'
    $envPath = Join-Path $root '.env'
    $payloadPresent = (Test-Path -LiteralPath (Join-Path $root 'runtime\node\node.exe')) -or
      (Test-Path -LiteralPath (Join-Path $root 'apps\backend\dist\index.js')) -or
      (Test-Path -LiteralPath (Join-Path $root 'scripts\start-docente-native.mjs'))
    $manifestPresent = Test-Path -LiteralPath $manifestPath
    $dataRoot = Join-Path $programData 'EvaluaPro\data'
    if ($root.StartsWith((Join-Path $localAppData 'EvaluaPro'), [StringComparison]::OrdinalIgnoreCase)) {
      $dataRoot = Join-Path $localAppData 'EvaluaPro\data'
    }
    $dataPresent = Test-Path -LiteralPath $dataRoot
    $isKnownDefaultRoot = $root.Equals($knownLocalRoot, [StringComparison]::OrdinalIgnoreCase) -or
      $root.Equals($knownProgramFilesRoot, [StringComparison]::OrdinalIgnoreCase)
    if ($root.Equals($targetFullPath, [StringComparison]::OrdinalIgnoreCase) -and
      -not $isKnownDefaultRoot -and -not $manifestPresent -and -not $payloadPresent -and -not (Test-Path -LiteralPath $envPath)) {
      $dataPresent = $false
    }
    if ($dataPresent -and -not $manifestPresent -and -not $payloadPresent) {
      if ($seenDataOnlyRoots.ContainsKey($dataRoot)) { continue }
      $seenDataOnlyRoots[$dataRoot] = $true
    }
    $packageVersion = ''
    if (Test-Path -LiteralPath $packagePath) {
      try {
        $package = Get-Content -LiteralPath $packagePath -Raw -Encoding utf8 | ConvertFrom-Json
        $packageVersion = [string]$package.version
      } catch {}
    }
    $manifestVersion = ''
    if ($manifestPresent) {
      try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
        if ($manifest.version) { $manifestVersion = [string]$manifest.version }
        elseif ($manifest.appVersion) { $manifestVersion = [string]$manifest.appVersion }
        elseif ($manifest.packageVersion) { $manifestVersion = [string]$manifest.packageVersion }
      } catch {}
    }
    $flavorId = ''
    if (Test-Path -LiteralPath $envPath) {
      try { $flavorId = [string]((Read-InstallerEnvMap -Path $envPath)['EVALUAPRO_FLAVOR']) } catch {}
    }
    if (-not $manifestPresent -and -not $payloadPresent -and -not $dataPresent) { continue }

    $state = 'repairable'
    if ($dataPresent -and -not $manifestPresent -and -not $payloadPresent) { $state = 'orphaned' }
    elseif (-not $manifestPresent -or -not $payloadPresent) { $state = 'legacy' }
    $flavorConflict = -not [string]::IsNullOrWhiteSpace($flavorId) -and
      -not [string]::IsNullOrWhiteSpace($RequestedFlavorId) -and
      -not $flavorId.Equals($RequestedFlavorId, [StringComparison]::OrdinalIgnoreCase)
    if ($flavorConflict) { $state = 'conflict' }

    $instances += [ordered]@{
      installDir = $root
      dataDir = $dataRoot
      flavorId = if ($flavorId) { $flavorId } else { 'unknown' }
      version = if ($packageVersion) { $packageVersion } else { $manifestVersion }
      manifestPresent = $manifestPresent
      payloadPresent = $payloadPresent
      dataPresent = $dataPresent
      state = $state
      readOnlyInventory = $true
      preserveDataByDefault = $true
      cleanupRequiresExplicitConfirmation = $true
    }
  }

  $conflict = @($instances | Where-Object { $_.state -eq 'conflict' }).Count -gt 0
  $recommendedMode = if ($conflict) { 'repair' } elseif (@($instances).Count -gt 0) { 'repair' } else { 'install' }
  return [ordered]@{
    requestedFlavorId = $RequestedFlavorId
    instances = @($instances)
    state = if ($conflict) { 'conflict' } elseif (@($instances | Where-Object { $_.state -eq 'orphaned' }).Count -gt 0) { 'orphaned' } elseif (@($instances).Count -gt 0) { 'repairable' } else { 'unknown' }
    recommendedMode = $recommendedMode
    preserveDataByDefault = $true
    cleanupRequiresExplicitConfirmation = $true
  }
}

function Detect-Prerequisites {
  $requestJson = Read-InstallerRequestPayload
  $requestedFlavorId = [string](Get-RequestValue -Request $requestJson -Names @('flavorId', 'FlavorId') -DefaultValue 'docente-local')
  $targetDir = Get-TargetInstallDir -Request $requestJson
  $instanceInventory = Get-InstalledInstanceInventory -TargetDir $targetDir -RequestedFlavorId $requestedFlavorId
  # Verificar WebView2 (Microsoft Edge nativo)
  $edgeInstalled = $false
  $edgeVersion = "No detectado"
  
  $edgeKeys = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )
  foreach ($key in $edgeKeys) {
    if (Test-Path $key) {
        $val = Get-ItemProperty -Path $key -Name "pv" -ErrorAction SilentlyContinue
        if ($val -and $val.pv) {
            $edgeInstalled = $true
            $edgeVersion = $val.pv
            break
        }
    }
  }

  $generationWord = 'generaci' + [char]0x00F3 + 'n'
  $examsWord = 'ex' + [char]0x00E1 + 'menes'
  $visualizationWord = 'visualizaci' + [char]0x00F3 + 'n'
  $installationWord = 'instalaci' + [char]0x00F3 + 'n'
  $verificationWord = 'verificaci' + [char]0x00F3 + 'n'
  $configurationWord = 'configuraci' + [char]0x00F3 + 'n'
  $diagnosticWord = 'diagn' + [char]0x00F3 + 'stico'
  $operationWord = 'operaci' + [char]0x00F3 + 'n'

  $prereqs = @(
    @{
      Name = "Microsoft Edge WebView2 (Nativo)"
      Installed = $edgeInstalled
      ActualVersion = $edgeVersion
      Reason = "Permite la $generationWord nativa de $examsWord PDF (OMR) y $visualizationWord de la interfaz."
    },
    @{
      Name = "Node.js portable (incluido)"
      Installed = $true
      ActualVersion = "Se provisiona en runtime\node durante la $installationWord"
      Reason = "El Hub instala un runtime aislado; no requiere Node.js global ni modifica el entorno del usuario."
    },
    @{
      Name = "Windows PowerShell 5+"
      Installed = $PSVersionTable.PSVersion.Major -ge 5
      ActualVersion = [string]$PSVersionTable.PSVersion
      Reason = "Ejecuta $verificationWord, $configurationWord y $diagnosticWord local del Hub."
    },
    @{
      Name = "Espacio libre para instalacion"
      Installed = $true
      ActualVersion = "Validado por Burn/MSI antes de ejecutar"
      Reason = "El instalador valida espacio y detiene la $operationWord antes de dejar una $installationWord incompleta."
    }
  )

  $ready = $edgeInstalled -and ($PSVersionTable.PSVersion.Major -ge 5) -and $instanceInventory.state -ne 'conflict'
  $issues = @()
  $autoRemediateRequested = ConvertTo-InstallerHubBool -Value ([string](Get-RequestValue -Request $requestJson -Names @('autoRemediate') -DefaultValue '0'))
  if ($autoRemediateRequested -and -not $ready) {
    Write-Response @{
      ok = $false
      phase = 'prerequisites_remediation_unavailable'
      exitCode = 10
      message = 'La remediación automática nativa no está disponible para los requisitos pendientes. Instala Microsoft Edge WebView2 Runtime y vuelve a ejecutar EvaluaPro.'
      data = @{ prerequisites = $prereqs; ready = $false; lifecycle = $instanceInventory }
    }
    return
  }
  if ($instanceInventory.state -eq 'conflict') {
    $issues += 'Existe una instancia de otro flavor o con raíces/puertos en conflicto; requiere reparación o limpieza explícita.'
  }

  Write-Response @{
    ok = $true
    phase = "helper_detect"
    exitCode = 0
    message = "Deteccion de prerrequisitos nativa completada."
    data = @{
      prerequisites = $prereqs
      ready = $ready
      installation = if (@($instanceInventory.instances).Count -gt 0) { $instanceInventory.instances[0] } else { @{ Installed = $false; InstallLocation = $targetDir } }
      lifecycle = $instanceInventory
      system = @{ issues = $issues }
    }
  }
}

function Invoke-PostInstall {
  Write-Host "Iniciando instalacion nativa de EvaluaPro..."

  $powerShellPath = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"

  $requestJson = Read-InstallerRequestPayload
  $targetDir = Get-TargetInstallDir -Request $requestJson
  $targetRoot = [IO.Path]::GetFullPath($targetDir).TrimEnd('\')
  $protectedRoots = @(
    [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles),
    [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86),
    [Environment]::GetFolderPath([Environment+SpecialFolder]::Windows)
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
    [IO.Path]::GetFullPath($_).TrimEnd('\')
  }
  $requiresElevation = @($protectedRoots | Where-Object {
    $targetRoot.StartsWith($_, [StringComparison]::OrdinalIgnoreCase)
  }).Count -gt 0

  # Burn mantiene la BA en el contexto del usuario mientras eleva el MSI.
  # Solo elevamos si la ruta final está protegida por Windows.
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  $isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($requiresElevation -and -not $isAdministrator) {
    $requestBytes = [Text.Encoding]::UTF8.GetBytes([string]$script:InstallerRequestJson)
    $requestSnapshot = [Convert]::ToBase64String($requestBytes)
    [Array]::Clear($requestBytes, 0, $requestBytes.Length)
    $childArgs = @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath,
      '-Mode', 'post-install', '-RequestJsonBase64', $requestSnapshot, '-ResponsePath', $ResponsePath
    )
    $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $childArgs -Wait -PassThru
    if ($elevated.ExitCode -ne 0) {
      throw "El helper post-install elevado terminó con código $($elevated.ExitCode)."
    }
    return
  }

  # -Mode identifies the helper command (`post-install`); the lifecycle action
  # is carried by the request generated by Burn (`install` or `repair`).
  $installMode = [string](Get-RequestValue -Request $requestJson -Names @('mode', 'Mode') -DefaultValue 'install')
  if ($installMode.Trim().ToLowerInvariant() -in @('install', 'repair')) {
    Enter-InstallerRootLock -TargetDir $targetDir
    Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @{ TargetDir = $targetDir }
    Write-HelperProgress -Percent 4 -Status 'Deteniendo procesos propios antes de aplicar el payload.'
    $processStop = Invoke-InstallerHubModuleFunction -ModuleName Processes -FunctionName 'Stop-EvaluaProOwnedNodeProcesses' -Parameters @{ TargetDir = $targetDir }
    if (-not $processStop.ok) {
      throw "No se pudieron detener todos los procesos Node de esta instalación antes de aplicar el payload: $($processStop.remaining -join ', ')"
    }
    if ($processStop.requested.Count -gt 0) {
      Write-Host "Procesos Node propios detenidos antes de aplicar el payload: $($processStop.requested -join ', ')"
    }
  }
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }
  Write-HelperProgress -Percent 5 -Status 'Expandiendo y validando el payload antes de modificar configuración.'
  $payloadZip = Resolve-NativePayloadZip -TargetDir $targetDir
  Expand-NativePayload -TargetDir $targetDir -PayloadZip $payloadZip
  Write-HelperProgress -Percent 18 -Status 'Payload validado y preparado bajo transacción recuperable.'

  Write-HelperProgress -Percent 5 -Status 'Validando el contrato de runtime.'
  Ensure-InstallerRuntimeContract -TargetDir $targetDir -Request $requestJson
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @{ TargetDir = $targetDir; State = 'configuring' }
  Write-HelperProgress -Percent 12 -Status 'Configurando el perfil operativo.'
  if (Get-Command Invoke-EvaluaProOperationalConfiguration -ErrorAction SilentlyContinue) {
    $configMap = Get-RequestConfigMap -Request $requestJson
    if (-not $configMap.ContainsKey('flavorId')) {
      $configMap['flavorId'] = [string](Get-RequestValue -Request $requestJson -Names @('flavorId', 'FlavorId') -DefaultValue 'docente-local')
    }
    $mode = $installMode
    Invoke-EvaluaProOperationalConfiguration -Mode $mode -InstallDir $targetDir -Config $configMap -OnLog {
      param([string]$level, [string]$message)
      Write-Host "[$level] $message"
    } | Out-Null
  } else {
    Write-InstallerRuntimeEnv -TargetDir $targetDir -Request $requestJson
  }
  # La configuración operativa puede regenerar .env con defaults globales;
  # reaplicar el contrato docente conserva la ruta SQLite efectiva del request.
  Write-InstallerRuntimeEnv -TargetDir $targetDir -Request $requestJson
  $envPath = Assert-InstallerRuntimeEnv -TargetDir $targetDir
  Write-HelperProgress -Percent 25 -Status 'Perfil operativo validado.'
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  $effectiveFlavor = [string]$runtimeEnv['EVALUAPRO_FLAVOR']
  if ($effectiveFlavor.Trim().ToLowerInvariant() -eq 'docente-local') {
    $localAppData = [string]$env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
    $qaRootPrefix = (Join-Path $localAppData 'EvaluaPro-QA-Isolated-').TrimEnd('\')
    $programDataRoot = [string]$env:ProgramData
    if ([string]::IsNullOrWhiteSpace($programDataRoot)) { $programDataRoot = 'C:\ProgramData' }
    $targetFullPath = [IO.Path]::GetFullPath($targetDir).TrimEnd('\')
    $localDataRoot = if ($targetFullPath.StartsWith($qaRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      $targetFullPath
    } else {
      Join-Path $programDataRoot 'EvaluaPro'
    }
    $localDataDir = Join-Path $localDataRoot 'data'
    if (-not (Test-Path -LiteralPath $localDataDir)) { New-Item -ItemType Directory -Path $localDataDir -Force | Out-Null }
    $defaultDatabaseUrl = 'file:' + (($localDataDir -replace '\\', '/') + '/evaluapro.db')
    $effectiveDatabaseUrl = [string]$runtimeEnv['DATABASE_URL']
    if ($targetFullPath.StartsWith($qaRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      # Una configuración operativa puede traer el default compartido de ProgramData;
      # en QA la URL efectiva debe seguir la raíz aislada donde se prepara SQLite.
      $effectiveDatabaseUrl = $defaultDatabaseUrl
    }
    if ([string]::IsNullOrWhiteSpace($effectiveDatabaseUrl)) { $effectiveDatabaseUrl = $defaultDatabaseUrl }
    Set-InstallerEnvValue -Map $runtimeEnv -Key 'DATABASE_URL' -Value $effectiveDatabaseUrl
    Set-InstallerEnvValue -Map $runtimeEnv -Key 'BACKEND_DATABASE_URL' -Value $effectiveDatabaseUrl
    Write-InstallerEnvMap -Path $envPath -Map $runtimeEnv
    Write-Host "Ruta SQLite docente: $effectiveDatabaseUrl"
  }
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  if ($runtimeEnv.Contains('DATABASE_URL')) {
    $env:DATABASE_URL = [string]$runtimeEnv['DATABASE_URL']
  }
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  if ($runtimeEnv.Contains('DATABASE_URL')) {
    $env:DATABASE_URL = [string]$runtimeEnv['DATABASE_URL']
  }

  # Última barrera: conserva la ruta efectiva ya validada; no cambia una base
  # existente durante un update ni la mueve implícitamente entre raíces.
  if ($effectiveFlavor.Trim().ToLowerInvariant() -eq 'docente-local') {
    $runtimeEnv = Read-InstallerEnvMap -Path $envPath
    $finalDatabaseUrl = [string]$runtimeEnv['DATABASE_URL']
    if ([string]::IsNullOrWhiteSpace($finalDatabaseUrl)) {
      $finalDatabaseUrl = 'file:' + ((Join-Path $programDataRoot 'EvaluaPro\data\evaluapro.db') -replace '\\', '/')
      Set-InstallerEnvValue -Map $runtimeEnv -Key 'DATABASE_URL' -Value $finalDatabaseUrl
      Set-InstallerEnvValue -Map $runtimeEnv -Key 'BACKEND_DATABASE_URL' -Value $finalDatabaseUrl
    }
    Write-InstallerEnvMap -Path $envPath -Map $runtimeEnv
    $env:DATABASE_URL = $finalDatabaseUrl
    $env:BACKEND_DATABASE_URL = $finalDatabaseUrl
    Write-Host "Ruta SQLite docente final: $finalDatabaseUrl"
  }

  $requiresLicense = ConvertTo-InstallerHubBool -Value ([string](Get-RequestValue -Request $requestJson -Names @('RequireLicenseActivation', 'requireLicenseActivation') -DefaultValue '0'))
  $licenseState = $null
  $licenseWarning = $null
  if ($requiresLicense) {
    if (-not (Get-Command Invoke-EvaluaProLicenseActivationSecure -ErrorAction SilentlyContinue)) {
      throw 'Payload incompleto: no existe modulo de seguridad de licencia.'
    }
    $licenseApi = [string](Get-RequestValue -Request $requestJson -Names @('LicenseApiBaseUrl', 'apiComercialBaseUrl') -DefaultValue '')
    $tenantId = [string](Get-RequestValue -Request $requestJson -Names @('TenantId', 'tenantId') -DefaultValue '')
    $activationCode = [string](Get-RequestValue -Request $requestJson -Names @('ActivationCode', 'codigoActivacion') -DefaultValue '')
    $securityRoot = Get-EvaluaProLicenseSecurityRoot
    $existingLicenseState = Get-EvaluaProCommercialLicenseState -RootDir $securityRoot
    try {
      if ([string]::IsNullOrWhiteSpace($licenseApi) -or [string]::IsNullOrWhiteSpace($tenantId) -or [string]::IsNullOrWhiteSpace($activationCode)) {
        throw 'Activacion comercial incompleta: se requieren API, tenantId y codigoActivacion.'
      }
      Invoke-EvaluaProLicenseActivationSecure `
        -ApiBaseUrl $licenseApi `
        -TenantId $tenantId `
        -CodigoActivacion $activationCode `
        -VersionInstalada ([string](Get-RequestValue -Request $requestJson -Names @('Version', 'version') -DefaultValue '0.0.0')) `
        -RootDir $securityRoot | Out-Null
      $licenseState = Get-EvaluaProCommercialLicenseState -RootDir $securityRoot
    } catch {
      if ($existingLicenseState.ok -and @('activa', 'gracia') -contains [string]$existingLicenseState.state) {
        $licenseState = $existingLicenseState
        $licenseWarning = "No se pudo validar online; se conserva la licencia local en estado $($existingLicenseState.state)."
        Write-Warning $licenseWarning
      } else {
        throw
      }
    }
    if (-not $licenseState.ok -or $licenseState.state -eq 'comunitaria') {
      throw "La licencia comercial no quedo activa: $($licenseState.warning)"
    }
    Write-Host "Licencia comercial activada; vence $($licenseState.expiraEn)."

    $heartbeatConfigPath = Join-Path $securityRoot 'heartbeat-config.json'
    $heartbeatConfig = [ordered]@{
      apiBaseUrl = $licenseApi
      tenantId = $tenantId
      version = [string](Get-RequestValue -Request $requestJson -Names @('Version', 'version') -DefaultValue '0.0.0')
      securityRoot = $securityRoot
    }
    [IO.File]::WriteAllText($heartbeatConfigPath, ($heartbeatConfig | ConvertTo-Json -Depth 4), [Text.Encoding]::UTF8)
    $heartbeatTaskName = 'EvaluaProCommercialLicenseHeartbeat'
    try {
      $heartbeatResponse = Join-Path $securityRoot 'heartbeat-response.json'
      $heartbeatArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode license-heartbeat -RequestPath `"$heartbeatConfigPath`" -ResponsePath `"$heartbeatResponse`""
      $heartbeatAction = New-ScheduledTaskAction -Execute $powerShellPath -Argument $heartbeatArgs -WorkingDirectory $targetDir
      $heartbeatTriggers = @(
        (New-ScheduledTaskTrigger -AtLogOn),
        (New-ScheduledTaskTrigger -Daily -At '01:30')
      )
      Register-ScheduledTask -TaskName $heartbeatTaskName -Action $heartbeatAction -Trigger $heartbeatTriggers -Description 'Heartbeat de licencia comercial de EvaluaPro' -Force -ErrorAction Stop | Out-Null
      Write-Host "Heartbeat comercial programado: $heartbeatTaskName"
    } catch {
      Write-Warning "No se pudo registrar el heartbeat comercial; se conserva el grace period local: $($_.Exception.Message)"
    }
  }

  # El runtime se valida desde el payload ya promovido; el diario conserva el estado
  # anterior hasta que el manifiesto y los servicios completen sus verificaciones.
  $runtimeCheck = Invoke-InstallerHubModuleFunction -ModuleName Verification -FunctionName 'Assert-EvaluaProNativeRuntime' -Parameters @{ InstallDir = $targetDir }
  $nodeExe = [string]$runtimeCheck.nodePath
  $nodeVersion = [string]$runtimeCheck.nodeVersion
  Write-HelperProgress -Percent 63 -Status "Runtime Node $nodeVersion validado."

  # El bundle docente no lleva historial de migraciones: el esquema SQL
  # autocontenido se aplica de forma idempotente antes del primer arranque.
  # En desinstalacion el MSI ya retiro el payload; no bloquear limpieza por DB.
  $sqliteBootstrap = Join-Path $targetDir 'scripts\prepare-docente-sqlite.mjs'
  $schemaSql = Join-Path $targetDir 'apps\backend\dist\prisma\schema.sql'
  if ($Mode -eq 'uninstall') {
    Write-Host 'Preparacion SQLite omitida en desinstalacion.'
  } elseif ((Test-Path $sqliteBootstrap) -and (Test-Path $schemaSql)) {
    Write-HelperProgress -Percent 66 -Status 'Preparando la base de datos SQLite.'
    & $nodeExe $sqliteBootstrap --database (Join-Path $localDataDir 'evaluapro.db') --schema-sql $schemaSql
    if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar la base SQLite local con SQL nativo (exit=$LASTEXITCODE)." }
    Write-Host 'Esquema SQLite local preparado con Node nativo.'
    Write-HelperProgress -Percent 76 -Status 'Base de datos SQLite preparada.'
  } else {
    throw 'Payload docente incompleto: no existe bootstrap SQLite o esquema SQL.'
  }

  <#
  # Fallback Prisma conservado para bundles antiguos; nuevos bundles usan SQL nativo.
  # El bloque queda deshabilitado hasta retirar compatibilidad con versiones previas.
  $prismaCli = Join-Path $targetDir 'apps\backend\dist\node_modules\prisma\build\index.js'
  $prismaSchema = Join-Path $targetDir 'apps\backend\dist\prisma\schema.prisma'
  if ($Mode -eq 'uninstall') {
    Write-Host 'Preparacion SQLite omitida en desinstalacion.'
  } elseif ((Test-Path $prismaCli) -and (Test-Path $prismaSchema)) {
    $schemaForPush = Join-Path $targetDir 'logs\docente-schema-push.prisma'
    try {
      $schemaText = [IO.File]::ReadAllText($prismaSchema)
      $effectiveDatabaseUrl = [string]$env:DATABASE_URL
      if ($effectiveFlavor.Trim().ToLowerInvariant() -eq 'docente-local') {
        $effectiveDatabaseUrl = 'file:' + ((Join-Path $localDataDir 'evaluapro.db') -replace '\\', '/')
        $schemaText = [Regex]::Replace($schemaText, 'url\s*=\s*env\("DATABASE_URL"\)', ('url = "' + $effectiveDatabaseUrl + '"'))
      }
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      [IO.File]::WriteAllText($schemaForPush, $schemaText, $utf8NoBom)
      $env:DATABASE_URL = $effectiveDatabaseUrl
      & $nodeExe $prismaCli db push --schema $schemaForPush
      if ($LASTEXITCODE -ne 0) {
        throw "No se pudo preparar la base SQLite local con Prisma (exit=$LASTEXITCODE)."
      }
    } finally {
      Remove-Item -LiteralPath $schemaForPush -Force -ErrorAction SilentlyContinue
    }
    Write-Host 'Esquema SQLite local preparado.'
  } else {
    throw 'Payload docente incompleto: no existe Prisma CLI o schema para preparar SQLite.'
  }
  #>

  # 3. Registrar como Tarea Programada o Servicio
  Write-Host "Configurando servicio de fondo..."
  $brokerPath = Join-Path $targetDir "scripts\launcher-broker.ps1"
  
  # Creamos un launcher vbs silencioso
  $vbsPath = Join-Path $targetDir "evaluapro-launcher.vbs"
  $launcherCommand = "`"$powerShellPath`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$brokerPath`" -Action open-dashboard -Mode prod -NoOpen"
  $vbsCommand = ConvertTo-VbsStringLiteralContent -Value $launcherCommand
  $vbsContent = "Set WshShell = CreateObject(`"WScript.Shell`")`nWshShell.Run `"$vbsCommand`", 0, False"
  Set-Content -Path $vbsPath -Value $vbsContent

  # La persistencia por tarea no debe convertir una instalación de usuario en UAC obligatorio.
  # Si Windows rechaza el registro, el broker de sesión sigue siendo utilizable y se informa como degradación.
  $backgroundTaskRegistered = $false
  $backgroundTaskWarning = $null
  Write-HelperProgress -Percent 80 -Status 'Configurando el inicio del broker.'
  try {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory $targetDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName "EvaluaProNativeBackground" -Action $action -Trigger $trigger -Description "Servicio backend de EvaluaPro" -Force -ErrorAction Stop | Out-Null
    $backgroundTaskRegistered = $true
  } catch {
    $backgroundTaskWarning = "Windows rechazó la persistencia automática del broker; se ejecutará bajo demanda sin elevar: $($_.Exception.Message)"
    Write-Warning $backgroundTaskWarning
  }
  Write-HelperProgress -Percent 84 -Status 'Broker configurado.'
  
  # El primer arranque queda bajo demanda del broker. Iniciar aquí una segunda
  # instancia en el puerto fijo 4519 compite con el broker del Hub cuando el
  # usuario abre la aplicación inmediatamente después de instalar.
  Write-Host 'Dashboard nativo preparado; se iniciará bajo demanda por el broker.'

  # Los accesos directos mejoran el primer uso, pero no son requisito para que
  # la aplicación instalada funcione ni para que el updater la detecte.
  # Ejecutamos la reconciliación como paso degradable para que un error de
  # PowerShell/COM en el perfil del usuario no desinstale un MSI válido.
  $shortcutWarnings = New-Object System.Collections.Generic.List[string]
  $shortcutScript = Join-Path $targetDir 'scripts\create-shortcuts.ps1'
  $shortcutReportPath = Join-Path $targetDir 'logs\shortcut-reconciliation.json'
  Write-HelperProgress -Percent 87 -Status 'Configurando accesos directos.'
  if (-not (Test-Path -LiteralPath $shortcutScript)) {
    $shortcutWarnings.Add("No existe create-shortcuts.ps1 en $targetDir; se conserva el acceso creado por MSI.") | Out-Null
  } else {
    Remove-Item -LiteralPath $shortcutReportPath -Force -ErrorAction SilentlyContinue
    try {
      $shortcutResult = Invoke-ShortcutReconciliation -PowerShellPath $powerShellPath -ScriptPath $shortcutScript -TargetDir $targetDir -TimeoutSeconds 90
      if ($shortcutResult.TimedOut) {
        $shortcutWarnings.Add('La reconciliación de accesos directos excedió 90 segundos; se conserva la instalación y se omite esta mejora opcional.') | Out-Null
        foreach ($line in @($shortcutResult.Stdout, $shortcutResult.Stderr) -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 4) {
          Write-Host ("Diagnóstico de accesos directos: " + ([string]$line).Substring(0, [Math]::Min(240, ([string]$line).Length)))
        }
      } elseif ($shortcutResult.ExitCode -ne 0) {
        $shortcutWarnings.Add("La reconciliación de accesos directos terminó con exit=$($shortcutResult.ExitCode); se conserva la instalación.") | Out-Null
        foreach ($line in @($shortcutResult.Stdout, $shortcutResult.Stderr) -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 4) {
          Write-Host ("Diagnóstico de accesos directos: " + ([string]$line).Substring(0, [Math]::Min(240, ([string]$line).Length)))
        }
      }
    } catch {
      $shortcutWarnings.Add("No se pudo reconciliar los accesos directos: $($_.Exception.Message); se conserva la instalación.") | Out-Null
    }
  }

  if (Test-Path -LiteralPath $shortcutReportPath) {
    try {
      $shortcutReport = Get-Content -LiteralPath $shortcutReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
      if ([string]$shortcutReport.state -ne 'ok') {
        $shortcutWarnings.Add('La reconciliación de accesos directos reportó errores; el acceso puede abrirse desde el menú de inicio de Windows.') | Out-Null
      }
    } catch {
      $shortcutWarnings.Add("No se pudo leer shortcut-reconciliation.json: $($_.Exception.Message)") | Out-Null
    }
  } else {
    $shortcutWarnings.Add('No se generó shortcut-reconciliation.json; se conserva el acceso creado por MSI.') | Out-Null
    try {
      $fallbackShortcutReport = [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToString('o')
        root = $targetDir
        flavorId = $effectiveFlavor
        state = 'degraded'
        entries = @()
        errors = @($shortcutWarnings.ToArray())
      }
      $fallbackShortcutReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $shortcutReportPath -Encoding UTF8
    } catch {
      $shortcutWarnings.Add("No se pudo guardar el diagnóstico de accesos directos: $($_.Exception.Message)") | Out-Null
    }
  }

  foreach ($shortcutWarning in ($shortcutWarnings | Select-Object -Unique)) {
    Write-Warning $shortcutWarning
  }
  Write-HelperProgress -Percent 92 -Status 'Accesos directos procesados.'

  # El manifiesto habilita dashboard/updater y es crítico. Debe poder generarse
  # independientemente de los accesos directos, incluso cuando su reconciliación
  # quedó degradada.
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @{ TargetDir = $targetDir; State = 'verifying' }
  Write-HelperProgress -Percent 95 -Status 'Generando el manifiesto de instalación y actualización.'
  $null = Invoke-EvaluaProInstallationManifestVerification `
    -InstallDir $targetDir `
    -PowerShellPath $powerShellPath `
    -Port 4519 `
    -ExpectedNodeVersion $nodeVersion
  Complete-PayloadTransaction -TargetDir $targetDir
  $script:PendingPayloadTransaction = $false
  Write-HelperProgress -Percent 98 -Status 'Manifiesto de actualización validado.'

  # Validacion rapida
  Start-Sleep -Seconds 3
  
  Write-Response @{
    ok = $true
    phase = "helper_postinstall"
    exitCode = 0
    message = if ($shortcutWarnings.Count -gt 0) { "Instalacion funcional; accesos directos degradados. Abre EvaluaPro.exe desde la carpeta de instalación." } elseif ($backgroundTaskRegistered) { "Instalacion Nativa exitosa." } else { "Instalacion Nativa exitosa; broker bajo demanda." }
    degraded = (-not $backgroundTaskRegistered) -or ($shortcutWarnings.Count -gt 0)
      warnings = @(@($licenseWarning, $backgroundTaskWarning) + @($shortcutWarnings.ToArray()) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
      license = $licenseState
    data = @{
      envPath = $envPath
      workflow = @{
        stages = @(
          @{ Name = "Runtime Node LTS"; Badge = "OK"; Status = "Instalado aislado" },
          @{ Name = "Aplicacion"; Badge = "OK"; Status = "Extraida y registrada" },
          @{ Name = "Broker de fondo"; Badge = if ($backgroundTaskRegistered) { "OK" } else { "INFO" }; Status = if ($backgroundTaskRegistered) { "Tarea de sesión registrada" } else { "Disponible bajo demanda; no requiere UAC" } }
        )
      }
    }
  }
  Write-HelperProgress -Percent 100 -Status 'Instalación finalizada.'
}

function Invoke-Update {
  Write-Host "Iniciando actualizacion de EvaluaPro..."
  
  $requestJson = Read-InstallerRequestPayload
  $targetDir = Get-TargetInstallDir -Request $requestJson
  Enter-InstallerRootLock -TargetDir $targetDir
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @{ TargetDir = $targetDir }

  $vbsPath = Join-Path $targetDir "evaluapro-launcher.vbs"
  $payloadZip = Resolve-NativePayloadZip -TargetDir $targetDir

  # Detener únicamente node.exe cuyo command line o runtime pertenece a esta
  # instalación; nunca detener Node de otra aplicación del usuario.
  $processStop = Invoke-InstallerHubModuleFunction -ModuleName Processes -FunctionName 'Stop-EvaluaProOwnedNodeProcesses' -Parameters @{ TargetDir = $targetDir }
  if (-not $processStop.ok) {
    throw "No se pudieron detener todos los procesos Node propiedad de EvaluaPro: $($processStop.remaining -join ', ')"
  }

  Expand-NativePayload -TargetDir $targetDir -PayloadZip $payloadZip

  $runtimeCheck = Invoke-InstallerHubModuleFunction -ModuleName Verification -FunctionName 'Assert-EvaluaProNativeRuntime' -Parameters @{ InstallDir = $targetDir }
  $nodeVersion = [string]$runtimeCheck.nodeVersion
  $powerShellPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @{ TargetDir = $targetDir; State = 'verifying' }
  $null = Invoke-EvaluaProInstallationManifestVerification `
    -InstallDir $targetDir `
    -PowerShellPath $powerShellPath `
    -Port 4519 `
    -ExpectedNodeVersion $nodeVersion
  Complete-PayloadTransaction -TargetDir $targetDir
  $script:PendingPayloadTransaction = $false

  # Reiniciar
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
  
  Write-Response @{
    ok = $true
    phase = "helper_update"
    exitCode = 0
    message = "Actualizacion Nativa exitosa."
    data = @{ ownedNodeProcesses = $processStop.requested }
  }
}

function Invoke-Uninstall {
  Write-Host "Iniciando desinstalacion nativa de EvaluaPro..."
  
  $requestJson = Read-InstallerRequestPayload
  $targetDir = Get-TargetInstallDir -Request $requestJson
  Enter-InstallerRootLock -TargetDir $targetDir
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @{ TargetDir = $targetDir }
  
  $exportData = ConvertTo-InstallerHubBool -Value ([string](Get-RequestValue -Request $requestJson -Names @('ExportData', 'exportData') -DefaultValue '0'))
  $dataDir = [IO.Path]::GetFullPath([string](Get-RequestValue -Request $requestJson -Names @('DataDir', 'dataDir') -DefaultValue (Join-Path $targetDir 'data')))
  $localDataDir = [IO.Path]::GetFullPath((Join-Path $targetDir 'data'))
  if (-not $dataDir.Equals($localDataDir, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La desinstalación solo puede gestionar data dentro de la raíz de esta instalación; los datos externos quedan intactos.'
  }
  $allowLocalDataRemoval = $false
  $targetBackup = $null

  Write-Host "Deteniendo servicios y tareas de la instancia..."
  $processStop = Invoke-InstallerHubModuleFunction -ModuleName Processes -FunctionName 'Stop-EvaluaProOwnedNodeProcesses' -Parameters @{ TargetDir = $targetDir }
  if (-not $processStop.ok) {
    throw "No se pudieron detener todos los procesos Node propiedad de EvaluaPro: $($processStop.remaining -join ', ')"
  }
  
  Unregister-ScheduledTask -TaskName "EvaluaProNativeBackground" -Confirm:$false -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName "EvaluaProCommercialLicenseHeartbeat" -Confirm:$false -ErrorAction SilentlyContinue

  if ($exportData) {
    Write-Host "Realizando respaldo de datos (ExportData activado)..."
    if (Test-Path -LiteralPath $dataDir -PathType Container) {
      Assert-InstallerHubTreeHasNoReparsePoints -Path $dataDir
      $dataEntries = @(Get-ChildItem -LiteralPath $dataDir -Force -ErrorAction Stop)
      if ($dataEntries.Count -eq 0) {
        Write-Warning 'El directorio de datos está vacío; no se creó respaldo y se conservará.'
      } else {
      $localAppData = [string]$env:LOCALAPPDATA
      if ([string]::IsNullOrWhiteSpace($localAppData)) { throw 'No existe LocalAppData para guardar un respaldo privado de EvaluaPro.' }
      $backupDir = Join-Path $localAppData 'EvaluaPro\Backups'
      $backupSecurity = New-Object System.Security.AccessControl.DirectorySecurity
      $backupSecurity.SetAccessRuleProtection($true, $false)
      $backupIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
      $backupSids = @($backupIdentity.User, [Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::LocalSystemSid, $null), [Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null))
      foreach ($sid in $backupSids) {
        if ($sid) { $backupSecurity.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, [Security.AccessControl.FileSystemRights]::FullControl, ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit), [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)) }
      }
      [IO.Directory]::CreateDirectory($backupDir, $backupSecurity) | Out-Null
      (Get-Item -LiteralPath $backupDir -Force).SetAccessControl($backupSecurity)
      Assert-InstallerHubTreeHasNoReparsePoints -Path $backupDir
      $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
      $targetBackup = Join-Path $backupDir ("data_{0}_{1}.zip" -f $timestamp, ([guid]::NewGuid().ToString('N')))
      $backupStage = Join-Path $backupDir (".stage-" + [Guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $backupStage -Force | Out-Null
      try {
        foreach ($dataEntry in $dataEntries) {
          Copy-Item -LiteralPath $dataEntry.FullName -Destination (Join-Path $backupStage $dataEntry.Name) -Recurse -Force -ErrorAction Stop
        }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($backupStage, $targetBackup, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        if (-not (Test-Path -LiteralPath $targetBackup -PathType Leaf) -or (Get-Item -LiteralPath $targetBackup).Length -le 0) { throw 'El respaldo de datos está vacío o incompleto.' }
        $archive = [System.IO.Compression.ZipFile]::OpenRead($targetBackup)
        try { if ($archive.Entries.Count -eq 0) { throw 'El respaldo ZIP no contiene archivos.' } } finally { $archive.Dispose() }
        $allowLocalDataRemoval = $dataDir.Equals($localDataDir, [StringComparison]::OrdinalIgnoreCase)
      } catch {
        if (Test-Path -LiteralPath $targetBackup) { Remove-Item -LiteralPath $targetBackup -Force -ErrorAction SilentlyContinue }
        throw
      } finally {
        Remove-Item -LiteralPath $backupStage -Recurse -Force -ErrorAction SilentlyContinue
      }
      Write-Host "Respaldo creado en $targetBackup"
      }
    }
  }

  Write-Host 'Retirando archivos de la aplicación con una transacción recuperable.'
  $transactionDir = Join-Path ([IO.Path]::GetFullPath($targetDir).TrimEnd('\')) '.evaluapro-payload-transaction'
  if (Test-Path -LiteralPath $transactionDir) { Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @{ TargetDir = $targetDir } }
  New-Item -ItemType Directory -Path (Join-Path $transactionDir 'backup') -Force -ErrorAction Stop | Out-Null
  $uninstallEntries = @(Get-ChildItem -LiteralPath $targetDir -Force -ErrorAction Stop | Where-Object {
    $_.Name -ne '.evaluapro-payload-transaction' -and ($allowLocalDataRemoval -or $_.Name -ne 'data')
  } | ForEach-Object { [ordered]@{ name = [string]$_.Name; existed = $true; snapshot = $false } })
  foreach ($entry in $uninstallEntries) {
    Assert-InstallerHubTreeHasNoReparsePoints -Path (Join-Path $targetDir ([string]$entry.name))
  }
  $uninstallJournal = [ordered]@{
    schemaVersion = 1
    root = [IO.Path]::GetFullPath($targetDir).TrimEnd('\')
    state = 'validated'
    operationId = $script:InstallerHubOperationId
    transactionId = [guid]::NewGuid().ToString('N')
    allowDataRemoval = [bool]$allowLocalDataRemoval
    entries = $uninstallEntries
  }
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Write-PayloadTransactionJournal' -Parameters @{ TransactionDir = $transactionDir; Journal = $uninstallJournal }
  $uninstallJournal = Invoke-InstallerHubModuleFunction -ModuleName Operation -FunctionName 'Set-EvaluaProOperationState' -Parameters @{ Journal = $uninstallJournal; State = 'promoting' }
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Write-PayloadTransactionJournal' -Parameters @{ TransactionDir = $transactionDir; Journal = $uninstallJournal }
  $script:PendingPayloadTransaction = $true
  foreach ($entry in $uninstallEntries) {
    Move-Item -LiteralPath (Join-Path $targetDir ([string]$entry.name)) -Destination (Join-Path (Join-Path $transactionDir 'backup') ([string]$entry.name)) -Force -ErrorAction Stop
  }
  Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Set-PayloadTransactionState' -Parameters @{ TargetDir = $targetDir; State = 'verifying' }
  Complete-PayloadTransaction -TargetDir $targetDir
  $script:PendingPayloadTransaction = $false
  if (@(Get-ChildItem -LiteralPath $targetDir -Force -ErrorAction Stop).Count -eq 0) {
    Remove-Item -LiteralPath $targetDir -Force -ErrorAction Stop
  }

  Write-Response @{
    ok = $true
    phase = "helper_uninstall"
    exitCode = 0
    message = "Desinstalacion Nativa exitosa."
    data = @{ ownedNodeProcesses = $processStop.requested; dataPreservedByDefault = -not $allowLocalDataRemoval; preservedDataDir = if (-not $allowLocalDataRemoval -and (Test-Path -LiteralPath (Join-Path $targetDir 'data'))) { Join-Path $targetDir 'data' } else { $null }; exportedBackup = if ($exportData) { $targetBackup } else { $null } }
  }
}

function Invoke-LicenseHeartbeat {
  $config = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$config.apiBaseUrl) -or [string]::IsNullOrWhiteSpace([string]$config.tenantId) -or [string]::IsNullOrWhiteSpace([string]$config.securityRoot)) {
    throw 'Configuracion de heartbeat incompleta.'
  }
  $state = Get-EvaluaProCommercialLicenseState -RootDir ([string]$config.securityRoot)
  if (-not $state.ok -or [string]$state.state -eq 'comunitaria') {
    Write-Response @{ ok = $true; phase = 'license_heartbeat'; skipped = $true; state = $state.state }
    return
  }
  try {
    $result = Invoke-EvaluaProLicenseHeartbeatSecure -ApiBaseUrl ([string]$config.apiBaseUrl) -TenantId ([string]$config.tenantId) -VersionInstalada ([string]$config.version) -RootDir ([string]$config.securityRoot)
    Write-Response @{ ok = $true; phase = 'license_heartbeat'; online = $true; state = $result.localState.state }
  } catch {
    $fallback = Get-EvaluaProCommercialLicenseState -RootDir ([string]$config.securityRoot)
    Write-Response @{ ok = $fallback.ok; phase = 'license_heartbeat'; online = $false; state = $fallback.state; message = $_.Exception.Message }
  }
}

function Invoke-RollbackOnFailure {
  param([string]$TargetDirectory)
  if ([string]::IsNullOrWhiteSpace($TargetDirectory) -or -not (Test-Path -LiteralPath $TargetDirectory)) { return }
  $manifest = Join-Path $TargetDirectory 'logs\installation.manifest.json'
  if (-not (Test-Path -LiteralPath $manifest)) {
    Write-Host "Realizando rollback automático: retirando residuos de instalación incompleta en $TargetDirectory..."
    Get-ChildItem -LiteralPath $TargetDirectory -Exclude 'data' -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

try {
  if ($Mode -ne 'license-heartbeat') { $null = Read-InstallerRequestPayload }
  if ($Mode -eq 'detect-prereqs') {
    Detect-Prerequisites
  } elseif ($Mode -eq 'post-install') {
    Invoke-PostInstall
  } elseif ($Mode -eq 'license-heartbeat') {
    Invoke-LicenseHeartbeat
  } elseif ($Mode -eq 'update') {
    Invoke-Update
  } elseif ($Mode -eq 'uninstall') {
    Invoke-Uninstall
  }
} catch {
  $failureMessage = $_.Exception.Message
  if ($script:PendingPayloadTransaction -and $script:InstallerRootPath) {
    try {
      Invoke-InstallerHubModuleFunction -ModuleName Transaction -FunctionName 'Recover-PayloadTransaction' -Parameters @{ TargetDir = $script:InstallerRootPath }
      $script:PendingPayloadTransaction = $false
    } catch {
      $failureMessage += " | Rollback pendiente preservado en $(Join-Path $script:InstallerRootPath '.evaluapro-payload-transaction'): $($_.Exception.Message)"
    }
  }
  if ($Mode -eq 'post-install') {
    try {
      $req = $script:InstallerRequestPayload
      $tDir = if ($req) { Get-TargetInstallDir -Request $req } else { $null }
      $installMode = if ($req) { [string](Get-RequestValue -Request $req -Names @('mode', 'Mode') -DefaultValue '') } else { '' }
      $transactionEvidenceExists = $tDir -and (Test-Path -LiteralPath (Join-Path $tDir '.evaluapro-payload-transaction'))
      if ($tDir -and $installMode.Trim().ToLowerInvariant() -eq 'install' -and -not $transactionEvidenceExists -and -not $script:PendingPayloadTransaction) {
        Invoke-RollbackOnFailure -TargetDirectory $tDir
      }
    } catch { }
  }
  Write-Response @{
    ok = $false
    phase = "helper_fatal"
    exitCode = 1
    message = $failureMessage
  }
} finally {
  Exit-InstallerRootLock
}
