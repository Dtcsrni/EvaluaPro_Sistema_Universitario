<#
.SYNOPSIS
    Compila y empaqueta EvaluaPro (Monolito Docente) en un archivo .zip nativo 
    para la arquitectura sin Docker/WSL.

.DESCRIPTION
    1. Compila el backend (Node.js/Express) y frontend (React/Vite).
    2. Consolida los archivos en una carpeta temporal `dist-native`.
    3. Instala únicamente las dependencias de producción y pre-compila Prisma/Sharp para Windows.
    4. Comprime el resultado en un paquete `evaluapro-native-dist.zip` listo para el Hub.
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$DistNativeDir = Join-Path $RepoRoot "dist-native"
$BackendDistDir = Join-Path $DistNativeDir "backend"
$FrontendDistDir = Join-Path $DistNativeDir "frontend"
$ZipOutFile = Join-Path $RepoRoot "evaluapro-native-dist.zip"

Write-Host "Iniciando compilacion nativa de EvaluaPro..." -ForegroundColor Cyan

function Stop-ProcessTree {
    param([Parameter(Mandatory = $true)][int]$ProcessId)
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue)
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Invoke-BoundedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
        [Parameter(Mandatory = $true)][string]$Stage
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.Arguments = (($ArgumentList | ForEach-Object {
        $value = [string]$_
        if ($value -match '[\s"]') { '"' + ($value -replace '"', '\\"') + '"' } else { $value }
    }) -join ' ')
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    try {
        Write-Host "[$Stage] iniciado (timeout=${TimeoutSeconds}s)" -ForegroundColor DarkCyan
        if (-not $process.Start()) { throw "No se pudo iniciar $FilePath" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $pid = $process.Id
            Stop-ProcessTree -ProcessId $pid
            throw "Etapa '$Stage' excedio ${TimeoutSeconds}s; se termino su arbol de procesos (pid=$pid)."
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        if ($stdout) { Write-Host $stdout.TrimEnd() }
        if ($stderr) { Write-Host $stderr.TrimEnd() -ForegroundColor DarkYellow }
        if ($process.ExitCode -ne 0) {
            throw "Etapa '$Stage' fallo con exit=$($process.ExitCode)."
        }
        Write-Host "[$Stage] completado" -ForegroundColor DarkGreen
    } finally {
        $process.Dispose()
    }
}

$npmCommand = if ($env:OS -eq 'Windows_NT') {
    $resolvedNpm = Get-Command npm.cmd -ErrorAction Stop
    [string]$resolvedNpm.Source
} else { 'npm' }

# 1. Limpiar directorio previo
if (Test-Path $DistNativeDir) {
    Remove-Item -Path $DistNativeDir -Recurse -Force
}
if (Test-Path $ZipOutFile) {
    Remove-Item -Path $ZipOutFile -Force
}

New-Item -ItemType Directory -Path $BackendDistDir | Out-Null
New-Item -ItemType Directory -Path $FrontendDistDir | Out-Null

# 2. Compilar Frontend
Write-Host "Compilando Frontend (Perfil Docente)..." -ForegroundColor Yellow
Set-Location (Join-Path $RepoRoot "apps/frontend")
# Forzamos que las peticiones vayan al puerto 4000 local del servidor Node
$env:VITE_API_BASE_URL = "http://localhost:4000/api"
Invoke-BoundedCommand -FilePath $npmCommand -ArgumentList @('run', 'build:docente') -WorkingDirectory (Get-Location).Path -TimeoutSeconds 300 -Stage 'frontend-build'

Write-Host "Copiando estaticos del frontend..." -ForegroundColor Yellow
Copy-Item -Path "dist-docente\*" -Destination $FrontendDistDir -Recurse -Force

# 3. Compilar Backend
Write-Host "Compilando Backend..." -ForegroundColor Yellow
Set-Location (Join-Path $RepoRoot "apps/backend")
Invoke-BoundedCommand -FilePath $npmCommand -ArgumentList @('run', 'build') -WorkingDirectory (Get-Location).Path -TimeoutSeconds 300 -Stage 'backend-build'

Write-Host "Preparando payload del backend..." -ForegroundColor Yellow
# Copiar transpilaos
Copy-Item -Path "dist\*" -Destination $BackendDistDir -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $BackendDistDir "modulos\modulo_analiticas\plantillas") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $RepoRoot "apps\backend\src\modulos\modulo_analiticas\plantillas\LIBRO_CALIFICACIONES_PRODUCCION_BASE_SANITIZADA.xlsx") -Destination (Join-Path $BackendDistDir "modulos\modulo_analiticas\plantillas") -Force
# Copiar configuraciones y esquemas necesarios
Copy-Item -Path "package.json", "package-lock.json" -Destination $BackendDistDir
Copy-Item -Path "prisma" -Destination $BackendDistDir -Recurse

# 4. Instalar dependencias de Produccion en el payload
Write-Host "Instalando dependencias de produccion nativas en dist-native..." -ForegroundColor Yellow
Set-Location $BackendDistDir
# Instalar dependencias ignorando dev y ejecutando prisma generate para Windows
Invoke-BoundedCommand -FilePath $npmCommand -ArgumentList @('ci', '--omit=dev', '--ignore-scripts') -WorkingDirectory (Get-Location).Path -TimeoutSeconds 600 -Stage 'native-dependencies'
Invoke-BoundedCommand -FilePath $npmCommand -ArgumentList @('exec', '--', 'prisma', 'generate') -WorkingDirectory (Get-Location).Path -TimeoutSeconds 180 -Stage 'native-prisma-generate'

# 5. Empaquetar
Write-Host "Generando paquete .zip ($ZipOutFile)..." -ForegroundColor Yellow
Set-Location $RepoRoot
Compress-Archive -Path "dist-native\*" -DestinationPath $ZipOutFile -Force

Write-Host "Empaquetado completado exitosamente. El payload nativo esta listo para el Hub." -ForegroundColor Green
