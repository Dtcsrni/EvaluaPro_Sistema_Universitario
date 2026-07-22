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
npm run build:docente

Write-Host "Copiando estaticos del frontend..." -ForegroundColor Yellow
Copy-Item -Path "dist-docente\*" -Destination $FrontendDistDir -Recurse -Force

# 3. Compilar Backend
Write-Host "Compilando Backend..." -ForegroundColor Yellow
Set-Location (Join-Path $RepoRoot "apps/backend")
npm run build

Write-Host "Preparando payload del backend..." -ForegroundColor Yellow
# Copiar transpilaos
Copy-Item -Path "dist\*" -Destination $BackendDistDir -Recurse -Force
# Copiar configuraciones y esquemas necesarios
Copy-Item -Path "package.json", "package-lock.json" -Destination $BackendDistDir
Copy-Item -Path "prisma" -Destination $BackendDistDir -Recurse

# 4. Instalar dependencias de Produccion en el payload
Write-Host "Instalando dependencias de produccion nativas en dist-native..." -ForegroundColor Yellow
Set-Location $BackendDistDir
# Instalar dependencias ignorando dev y ejecutando prisma generate para Windows
npm ci --omit=dev --ignore-scripts
npx prisma generate

# 5. Empaquetar
Write-Host "Generando paquete .zip ($ZipOutFile)..." -ForegroundColor Yellow
Set-Location $RepoRoot
Compress-Archive -Path "dist-native\*" -DestinationPath $ZipOutFile -Force

Write-Host "Empaquetado completado exitosamente. El payload nativo esta listo para el Hub." -ForegroundColor Green
