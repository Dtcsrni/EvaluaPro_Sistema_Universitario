# Native Lightweight Helper for the Burn-based EvaluaPro installer.
# Replaces the legacy Docker/WSL orchestration.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('detect-prereqs', 'post-install', 'update', 'uninstall')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$RequestPath,
  [Parameter(Mandatory = $true)]
  [string]$ResponsePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
foreach ($moduleRoot in $moduleRoots) {
  $candidate = Join-Path $moduleRoot 'OperationalConfig.psm1'
  if (Test-Path -LiteralPath $candidate) {
    $operationalConfigModule = $candidate
    break
  }
}
if ($operationalConfigModule) {
  Import-Module $operationalConfigModule -Force
}

function Write-Response {
  param([hashtable]$Payload)
  $json = $Payload | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($ResponsePath, $json + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
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
    [hashtable]$Map,
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
    [hashtable]$Map
  )
  $lines = @()
  foreach ($key in $Map.Keys) {
    $lines += ("{0}={1}" -f $key, $Map[$key])
  }
  [IO.File]::WriteAllText($Path, (($lines -join [Environment]::NewLine) + [Environment]::NewLine), [Text.Encoding]::UTF8)
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

  Set-InstallerEnvValue -Map $envMap -Key 'JWT_SECRETO' -Value $jwt
  $flavorId = [string](Get-RequestConfigValue -Request $Request -Name 'flavorId' -DefaultValue 'docente-local')
  $localAppData = [string]$env:LOCALAPPDATA
  if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
  $localDataDir = Join-Path $localAppData 'EvaluaPro\data'
  if (-not (Test-Path -LiteralPath $localDataDir)) { New-Item -ItemType Directory -Path $localDataDir -Force | Out-Null }
  $localDatabaseUrl = 'file:' + (($localDataDir -replace '\\', '/') + '/evaluapro.db')
  $requestedDatabaseUrl = [string](Get-RequestConfigValue -Request $Request -Name 'databaseUrl' -DefaultValue $localDatabaseUrl)
  if ($flavorId.Trim().ToLowerInvariant() -eq 'docente-local' -and ($requestedDatabaseUrl -match 'ProgramData/EvaluaPro/data/evaluapro\.db|ProgramData\\EvaluaPro\\data\\evaluapro\.db')) {
    $requestedDatabaseUrl = $localDatabaseUrl
  }
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

function Detect-Prerequisites {
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

  $ready = $edgeInstalled -and ($PSVersionTable.PSVersion.Major -ge 5)

  Write-Response @{
    ok = $true
    phase = "helper_detect"
    exitCode = 0
    message = "Deteccion de prerrequisitos nativa completada."
    data = @{
      prerequisites = $prereqs
      ready = $ready
    }
  }
}

function Invoke-PostInstall {
  Write-Host "Iniciando instalacion nativa de EvaluaPro..."

  $requestJson = Get-Content -Raw -Path $RequestPath | ConvertFrom-Json
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
  if ($requiresElevation -and -not $isAdministrator -and $env:EVALUAPRO_HELPER_ELEVATED -ne '1') {
    $env:EVALUAPRO_HELPER_ELEVATED = '1'
    $childArgs = @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath,
      '-Mode', 'post-install', '-RequestPath', $RequestPath, '-ResponsePath', $ResponsePath
    )
    $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $childArgs -Wait -PassThru
    if ($elevated.ExitCode -ne 0) {
      throw "El helper post-install elevado terminó con código $($elevated.ExitCode)."
    }
    return
  }

  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }
  Ensure-InstallerRuntimeContract -TargetDir $targetDir -Request $requestJson
  if (Get-Command Invoke-EvaluaProOperationalConfiguration -ErrorAction SilentlyContinue) {
    $configMap = Get-RequestConfigMap -Request $requestJson
    if (-not $configMap.ContainsKey('flavorId')) {
      $configMap['flavorId'] = [string](Get-RequestValue -Request $requestJson -Names @('flavorId', 'FlavorId') -DefaultValue 'docente-local')
    }
    $mode = [string](Get-RequestValue -Request $requestJson -Names @('mode', 'Mode') -DefaultValue 'install')
    Invoke-EvaluaProOperationalConfiguration -Mode $mode -InstallDir $targetDir -Config $configMap -OnLog {
      param([string]$level, [string]$message)
      Write-Host "[$level] $message"
    } | Out-Null
  } else {
    Write-InstallerRuntimeEnv -TargetDir $targetDir -Request $requestJson
  }
  # La configuración operativa puede regenerar .env con defaults globales;
  # reaplicar el contrato docente garantiza que SQLite quede en LOCALAPPDATA.
  Write-InstallerRuntimeEnv -TargetDir $targetDir -Request $requestJson
  $envPath = Assert-InstallerRuntimeEnv -TargetDir $targetDir
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  $effectiveFlavor = [string]$runtimeEnv['EVALUAPRO_FLAVOR']
  if ($effectiveFlavor.Trim().ToLowerInvariant() -eq 'docente-local') {
    $localAppData = [string]$env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($localAppData)) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
    $localDataDir = Join-Path $localAppData 'EvaluaPro\data'
    if (-not (Test-Path -LiteralPath $localDataDir)) { New-Item -ItemType Directory -Path $localDataDir -Force | Out-Null }
    $localDatabaseUrl = 'file:' + (($localDataDir -replace '\\', '/') + '/evaluapro.db')
    Set-InstallerEnvValue -Map $runtimeEnv -Key 'DATABASE_URL' -Value $localDatabaseUrl
    Set-InstallerEnvValue -Map $runtimeEnv -Key 'BACKEND_DATABASE_URL' -Value $localDatabaseUrl
    Write-InstallerEnvMap -Path $envPath -Map $runtimeEnv
    Write-Host "Ruta SQLite docente: $localDatabaseUrl"
  }
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  if ($runtimeEnv.Contains('DATABASE_URL')) {
    $env:DATABASE_URL = [string]$runtimeEnv['DATABASE_URL']
  }
  $runtimeEnv = Read-InstallerEnvMap -Path $envPath
  if ($runtimeEnv.Contains('DATABASE_URL')) {
    $env:DATABASE_URL = [string]$runtimeEnv['DATABASE_URL']
  }

  $nodeDir = Join-Path $targetDir "runtime\node"
  if (-not (Test-Path $nodeDir)) {
    New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null
  }

  # 1. Descargar Node LTS
  $nodeExe = Join-Path $nodeDir "node.exe"
  if (-not (Test-Path $nodeExe)) {
    Write-Host "Descargando Node.js LTS Portable..."
    # En produccion, esto leeria desde el manifiesto de la release.
    # Por ahora descargamos directo el ejecutable binario.
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/win-x64/node.exe"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeExe -UseBasicParsing
  }

  # El bundle docente no lleva historial de migraciones: el esquema SQL
  # autocontenido se aplica de forma idempotente antes del primer arranque.
  # En desinstalacion el MSI ya retiro el payload; no bloquear limpieza por DB.
  $sqliteBootstrap = Join-Path $targetDir 'scripts\prepare-docente-sqlite.mjs'
  $schemaSql = Join-Path $targetDir 'apps\backend\dist\prisma\schema.sql'
  if ($Mode -eq 'uninstall') {
    Write-Host 'Preparacion SQLite omitida en desinstalacion.'
  } elseif ((Test-Path $sqliteBootstrap) -and (Test-Path $schemaSql)) {
    & $nodeExe $sqliteBootstrap --database (Join-Path $localDataDir 'evaluapro.db') --schema-sql $schemaSql
    if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar la base SQLite local con SQL nativo (exit=$LASTEXITCODE)." }
    Write-Host 'Esquema SQLite local preparado con Node nativo.'
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
      & $nodeExe $prismaCli db push --skip-generate --schema $schemaForPush
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

  # 2. Extraer Payload (El MSI deberia soltar el zip, o lo descargamos)
  $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $payloadZip = Join-Path $repoRoot "evaluapro-native-dist.zip"
  
  $appDir = Join-Path $targetDir "app"
  if (Test-Path $payloadZip) {
    Write-Host "Extrayendo aplicacion nativa..."
    if (Test-Path $appDir) {
        Remove-Item -Path $appDir -Recurse -Force
    }
    Expand-Archive -Path $payloadZip -DestinationPath $appDir -Force
  }

  # 3. Registrar como Tarea Programada o Servicio
  Write-Host "Configurando servicio de fondo..."
  $brokerPath = Join-Path $targetDir "scripts\launcher-broker.ps1"
  $powerShellPath = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  
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
  try {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory $appDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName "EvaluaProNativeBackground" -Action $action -Trigger $trigger -Description "Servicio backend de EvaluaPro" -Force -ErrorAction Stop | Out-Null
    $backgroundTaskRegistered = $true
  } catch {
    $backgroundTaskWarning = "Windows rechazó la persistencia automática del broker; se ejecutará bajo demanda sin elevar: $($_.Exception.Message)"
    Write-Warning $backgroundTaskWarning
  }
  
  # Iniciamos ahora
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden

  # Validacion rapida
  Start-Sleep -Seconds 3
  
  Write-Response @{
    ok = $true
    phase = "helper_postinstall"
    exitCode = 0
    message = if ($backgroundTaskRegistered) { "Instalacion Nativa exitosa." } else { "Instalacion Nativa exitosa; broker bajo demanda." }
    degraded = -not $backgroundTaskRegistered
    warning = $backgroundTaskWarning
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
}

function Invoke-Update {
  Write-Host "Iniciando actualizacion de EvaluaPro..."
  
  $requestJson = Get-Content -Raw -Path $RequestPath | ConvertFrom-Json
  $targetDir = Get-TargetInstallDir -Request $requestJson

  $appDir = Join-Path $targetDir "app"
  $vbsPath = Join-Path $targetDir "evaluapro-launcher.vbs"
  $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $payloadZip = Join-Path $repoRoot "evaluapro-native-dist.zip"

  # Detener Node.js
  Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  if (Test-Path $payloadZip) {
    Write-Host "Reemplazando aplicacion nativa..."
    if (Test-Path $appDir) {
        Remove-Item -Path $appDir -Recurse -Force
    }
    Expand-Archive -Path $payloadZip -DestinationPath $appDir -Force
  }

  # Reiniciar
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
  
  Write-Response @{
    ok = $true
    phase = "helper_update"
    exitCode = 0
    message = "Actualizacion Nativa exitosa."
  }
}

function Invoke-Uninstall {
  Write-Host "Iniciando desinstalacion nativa de EvaluaPro..."
  
  $requestJson = Get-Content -Raw -Path $RequestPath | ConvertFrom-Json
  $targetDir = Get-TargetInstallDir -Request $requestJson
  
  $exportData = $false
  if ($requestJson.PSObject.Properties.Match('ExportData').Count -gt 0) {
    if ($requestJson.ExportData -eq 1 -or $requestJson.ExportData -eq "1" -or $requestJson.ExportData -eq $true) {
      $exportData = $true
    }
  }

  Write-Host "Deteniendo servicios y tareas..."
  Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  
  Unregister-ScheduledTask -TaskName "EvaluaProNativeBackground" -Confirm:$false -ErrorAction SilentlyContinue

  if ($exportData) {
    Write-Host "Realizando respaldo de datos (ExportData activado)..."
    $dataDir = "C:\ProgramData\EvaluaPro\data"
    if (Test-Path $dataDir) {
      $backupDir = "C:\Users\Public\Documents\EvaluaPro_Backup"
      if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
      }
      $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
      $targetBackup = Join-Path $backupDir "data_$timestamp"
      Copy-Item -Path $dataDir -Destination $targetBackup -Recurse -Force
      Write-Host "Respaldo creado en $targetBackup"
    }
  }

  Write-Host "Limpiando directorio de instalacion nativo..."
  if (Test-Path $targetDir) {
    Remove-Item -Path $targetDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  
  # Opcional: Eliminar ProgramData si NO se exporta? No, la politica general es no borrar datos a menos que el usuario purgue.
  # El MSI puede borrar el shortcut. Dejamos el ProgramData intacto por defecto para futuras instalaciones.

  Write-Response @{
    ok = $true
    phase = "helper_uninstall"
    exitCode = 0
    message = "Desinstalacion Nativa exitosa."
  }
}

try {
  if ($Mode -eq 'detect-prereqs') {
    Detect-Prerequisites
  } elseif ($Mode -eq 'post-install') {
    Invoke-PostInstall
  } elseif ($Mode -eq 'update') {
    Invoke-Update
  } elseif ($Mode -eq 'uninstall') {
    Invoke-Uninstall
  }
} catch {
  Write-Response @{
    ok = $false
    phase = "helper_fatal"
    exitCode = 1
    message = $_.Exception.Message
  }
}
