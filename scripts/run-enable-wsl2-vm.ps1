# run-enable-wsl2-vm.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param()

$vm = 'EvaluaPro-E2E-Win11'
Write-Host "Iniciando flujo seguro para VM: $vm"
$cred = Get-Credential -Message 'Credenciales admin VM'

try {
  Write-Host 'Creando checkpoint snapshot: pre-wsl2-setup'
  Checkpoint-VM -Name $vm -SnapshotName 'pre-wsl2-setup' -ErrorAction Stop
  Write-Host 'Checkpoint creado.'
} catch {
  Write-Host "Aviso: No se pudo crear checkpoint o ya existe: $($_.Exception.Message)"
}

try {
  Write-Host 'Ejecutando habilitacion WSL2 dentro de la VM...'
  Invoke-Command -VMName $vm -Credential $cred -ScriptBlock {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction Stop
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction Stop
    Write-Host 'Features habilitadas dentro de la VM (no se reinicio).'
  } -ErrorAction Stop
  Write-Host 'Habilitacion aplicada correctamente en la VM.'
} catch {
  Write-Host "Error aplicando features en la VM: $($_.Exception.Message)"
  exit 2
}

Write-Host 'LISTO: reinicia la VM manualmente dentro de Hyper-V o con Restart-VM para completar la instalacion.'
