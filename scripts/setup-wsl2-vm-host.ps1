# setup-wsl2-vm-host.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
    [string]$VMName = 'EVALPRO-E2E'
)

Write-Output "Starting host-side VM setup for VM: $VMName"

# Check Hyper-V commands availability
if (-not (Get-Command Get-VM -ErrorAction SilentlyContinue)) {
    Write-Error 'Hyper-V PowerShell module not available in this session.'
    exit 2
}

try {
    Write-Output "Exposing virtualization extensions for $VMName..."
    Set-VMProcessor -VMName $VMName -ExposeVirtualizationExtensions $true -ErrorAction Stop
    Write-Output 'Done.'
} catch {
    Write-Error "Failed to set VM processor: $_"
    exit 3
}

try {
    $snapName = 'pre-wsl2-setup'
    Write-Output "Creating checkpoint '$snapName' for $VMName..."
    Checkpoint-VM -VMName $VMName -SnapshotName $snapName -ErrorAction Stop
    Write-Output 'Checkpoint created.'
} catch {
    Write-Error "Failed to create checkpoint: $_"
    exit 4
}

try {
    Write-Output "Starting VM $VMName..."
    Start-VM -Name $VMName -ErrorAction Stop
    Write-Output 'VM started.'
} catch {
    Write-Error "Failed to start VM: $_"
    exit 5
}

Write-Output 'Host-side VM setup completed successfully.'
