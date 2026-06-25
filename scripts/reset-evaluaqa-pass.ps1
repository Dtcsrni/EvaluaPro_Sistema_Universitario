# reset-evaluaqa-pass.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
    [string]$VMName = 'EvaluaPro-E2E-Win11',
    [string]$User = 'evaluaqa'
)

Write-Host "Solicitando credenciales de administrador de la VM '$VMName'..."
$cred = Get-Credential -Message 'Credenciales admin VM'

$new = Read-Host -AsSecureString -Prompt "Nueva contraseña para usuario $User"
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($new)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)

try {
    Invoke-Command -VMName $VMName -Credential $cred -ScriptBlock {
        param($plainArg, $userArg)
        $pass = ConvertTo-SecureString $plainArg -AsPlainText -Force
        Set-LocalUser -Name $userArg -Password $pass -ErrorAction Stop
        Write-Host "Password cambiado para $userArg"
    } -ArgumentList $plain, $User -ErrorAction Stop
    Write-Host 'Contraseña restablecida correctamente.'
} catch {
    Write-Error "Error al restablecer contraseña: $($_.Exception.Message)"
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Variable plain -ErrorAction SilentlyContinue
}
