<#
  scripts/safe-enable-wsl2.ps1
  Script helper seguro para habilitar WSL2/VirtualMachinePlatform en Host o VM.
  Requisitos: run as Administrator cuando haga cambios; soporta DryRun y -Force.
#>

param(
  [ValidateSet('Host','VM','Auto')]
  [string]$Target = 'Auto',
  [switch]$DryRun,
  [switch]$Force
)

function Log-Op($message) {
  $dir = Join-Path $PSScriptRoot '..\reports\ops'
  New-Item -Path $dir -ItemType Directory -Force | Out-Null
  $path = Join-Path $dir ("safe-enable-wsl2-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  "$((Get-Date).ToString('o')) - $message" | Out-File -FilePath $path -Encoding UTF8
  Write-Host $message
}

function Is-Running-InVM {
  # heurístico: si existe Hyper-V feature y Get-VM fail, assume VM; preferir parámetro explícito
  try { $bios = Get-WmiObject Win32_BIOS -ErrorAction Stop; $serial = $bios.SerialNumber } catch { $serial = '' }
  if ($serial -and $serial -match 'vmbox|vmware|virtual') { return $true }
  return $false
}

if ($Target -eq 'Auto') {
  $inVm = Is-Running-InVM
  $Target = if ($inVm) { 'VM' } else { 'Host' }
}

Log-Op "Operación iniciada. Target=$Target DryRun=$DryRun Force=$Force User=$env:USERNAME"

Write-Host "ADVERTENCIA: Este comando puede requerir reinicio del $Target."
Write-Host "Procesos con mayor CPU (top 8):"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 Id,ProcessName,CPU | Format-Table

if (-not $Force) {
  Write-Host "Escribe CONFIRM para proceder o presiona Ctrl+C para abortar:" -ForegroundColor Yellow
  $input = Read-Host
  if ($input -ne 'CONFIRM') { Log-Op 'Operación cancelada por usuario.'; Write-Host 'Cancelado.'; exit 1 }
}

if ($DryRun) { Log-Op 'DryRun: ninguna acción será aplicada.'; Write-Host 'DryRun completado. No se aplicaron cambios.'; exit 0 }

if ($Target -eq 'Host') {
  # crear checkpoint de todas las VMs relevantes es responsabilidad del operador; solo registramos
  Log-Op 'Ejecutando habilitación de WSL2 en HOST.'
  try {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction Stop
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction Stop
    Log-Op 'Habilitadas features WSL/VirtualMachinePlatform (reboot requerido).'
    Write-Host 'Features aplicadas. Reinicia el sistema para completar.'
  } catch {
    Log-Op "Error al aplicar features: $($_.Exception.Message)"
    throw
  }
} else {
  Log-Op 'Ejecutando habilitación de WSL2 en VM (dentro de la VM se ejecuta).'
  try {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction Stop
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction Stop
    Log-Op 'Features aplicadas en VM (reboot requerido).'
    Write-Host 'Features aplicadas en VM. Reinicia la VM para completar.'
  } catch {
    Log-Op "Error al aplicar features en VM: $($_.Exception.Message)"
    throw
  }
}
