param([switch]$UninstallAfter = $true)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $root

Write-Host "1. Localizando el release (instalador)..."
$exePath = "dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.1.0.exe"
if (-not (Test-Path $exePath)) {
    Write-Host "Ejecutable no encontrado. Compilando el hub..."
    npm run installer:hub:build
}

Write-Host "2. Instalando el release (simulando descarga e instalación silenciosa)..."
$process = Start-Process -FilePath $exePath -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
if ($process.ExitCode -ne 0) {
    Write-Warning "El instalador terminó con código $($process.ExitCode). Podría requerir reinicio o ya estar instalado."
}

Write-Host "3. Esperando que el acceso directo / backend inicie (Docker Engine / WSL)..."
Start-Sleep -Seconds 20

Write-Host "4. Dando click en el acceso directo (Simulado: Ejecutar la aplicación)..."
# The desktop shortcut points to the app URL or the tray app.
# By hitting the app via Playwright, we simulate the browser opening the shortcut.
Write-Host "5. Ejecutando la suite de Playwright para registrar, cargar materias y alumnos..."
$pwProcess = Start-Process -FilePath "npx.cmd" -ArgumentList "playwright", "test", "tests/gui-responsive/ciclo-completo.spec.ts", "--config=tests/gui-responsive/playwright.ciclo.config.cjs" -NoNewWindow -Wait -PassThru

if ($pwProcess.ExitCode -eq 0) {
    Write-Host "¡Ciclo de uso directo completo validado con ÉXITO!" -ForegroundColor Green
} else {
    Write-Host "Hubo un fallo en el ciclo GUI E2E. El test de Playwright necesita ser corregido o mejorado." -ForegroundColor Red
}

if ($UninstallAfter) {
    Write-Host "6. Desinstalando para limpiar el entorno..."
    Start-Process -FilePath $exePath -ArgumentList "/uninstall", "/quiet", "/norestart" -Wait | Out-Null
}

exit $pwProcess.ExitCode
