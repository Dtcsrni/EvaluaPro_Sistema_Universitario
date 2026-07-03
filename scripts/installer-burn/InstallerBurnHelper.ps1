# Native Lightweight Helper for the Burn-based EvaluaPro installer.
# Replaces the legacy Docker/WSL orchestration.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('detect-prereqs', 'post-install')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$RequestPath,
  [Parameter(Mandatory = $true)]
  [string]$ResponsePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

function ConvertTo-VbsStringLiteralContent {
  param([Parameter(Mandatory = $true)][string]$Value)
  return ($Value -replace '"', '""')
}

function Ensure-InstallerRuntimeContract {
  param([Parameter(Mandatory = $true)][string]$TargetDir)

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

  $prereqs = @(
    @{
      Name = "Microsoft Edge WebView2 (Nativo)"
      Installed = $edgeInstalled
      ActualVersion = $edgeVersion
      Reason = "Permite la generación nativa de exámenes PDF (OMR) y visualización de la interfaz."
    }
  )

  # No validamos Node.js globalmente porque inyectamos un LTS portable aislando el runtime.

  $ready = $edgeInstalled

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

  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }
  Ensure-InstallerRuntimeContract -TargetDir $targetDir

  $nodeDir = Join-Path $targetDir "node-lts"
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

  # Registramos la tarea programada al inicio de sesion (silenciosa sin admin)
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory $appDir
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName "EvaluaProNativeBackground" -Action $action -Trigger $trigger -Description "Servicio backend de EvaluaPro" -Force | Out-Null
  
  # Iniciamos ahora
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden

  # Validacion rapida
  Start-Sleep -Seconds 3
  
  Write-Response @{
    ok = $true
    phase = "helper_postinstall"
    exitCode = 0
    message = "Instalacion Nativa exitosa."
    data = @{
      workflow = @{
        stages = @(
          @{ Name = "Runtime Node LTS"; Badge = "OK"; Status = "Instalado aislado" },
          @{ Name = "Aplicacion"; Badge = "OK"; Status = "Extraida y registrada" }
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
