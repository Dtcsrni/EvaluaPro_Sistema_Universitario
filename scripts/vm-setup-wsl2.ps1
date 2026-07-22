# vm-setup-wsl2.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
Write-Output 'VM-side WSL2 + Docker Desktop setup script started.'

# Ensure running as Administrator
If (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Este script debe ejecutarse en la VM como Administrador.'
    exit 1
}

Write-Output 'Enabling WSL and VirtualMachinePlatform features...'
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction Stop
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction Stop

Write-Output 'Restarting the VM to apply feature changes...'
Restart-Computer
# The rest of the script should be run after restart manually or via scheduled task.

# Post-restart instructions (to run manually after reboot as Admin):
# 1) Open PowerShell as Admin and run:
#    wsl --set-default-version 2
#    wsl --install -d Ubuntu
# 2) After Ubuntu installs and you configure the distro, download and install Docker Desktop:
#    Invoke-WebRequest -OutFile DockerDesktopInstaller.exe "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
#    Start-Process -FilePath .\DockerDesktopInstaller.exe -Wait
# 3) In Docker Desktop UI: Settings -> General -> enable 'Use the WSL 2 based engine'
#    Resources -> WSL Integration -> enable for 'Ubuntu'
# 4) Verify with:
#    wsl -l -v
#    docker info

Write-Output 'vm-setup-wsl2.ps1 created. Please reconnect to the VM and continue with the post-restart steps as described in the script comments.'
