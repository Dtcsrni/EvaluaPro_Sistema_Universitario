# setup-qa-credenciales.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [switch]$NoPersist
)

function Set-UserEnvValue {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Value
  )

  Set-Item -Path "Env:$Name" -Value $Value
  if (-not $NoPersist) {
    [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
  }
}

function Read-SecretPlain {
  param([Parameter(Mandatory=$true)][string]$Prompt)

  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Write-Host 'Configurar credenciales QA (se guardan en variables de entorno de usuario).' -ForegroundColor Cyan
Write-Host 'Nota: las variables de entorno guardan texto plano en el contexto local.' -ForegroundColor Yellow

$docenteUser = Read-Host -Prompt 'Docente user (EVALUAPRO_QA_DOCENTE_USER)'
$docentePass = Read-SecretPlain -Prompt 'Docente pass (EVALUAPRO_QA_DOCENTE_PASS)'
$alumnoUser = Read-Host -Prompt 'Alumno user (EVALUAPRO_QA_ALUMNO_USER)'
$alumnoPass = Read-SecretPlain -Prompt 'Alumno pass (EVALUAPRO_QA_ALUMNO_PASS)'
$adminUser = Read-Host -Prompt 'Admin user (EVALUAPRO_QA_ADMIN_USER)'
$adminPass = Read-SecretPlain -Prompt 'Admin pass (EVALUAPRO_QA_ADMIN_PASS)'

Set-UserEnvValue -Name 'EVALUAPRO_QA_DOCENTE_USER' -Value $docenteUser
Set-UserEnvValue -Name 'EVALUAPRO_QA_DOCENTE_PASS' -Value $docentePass
Set-UserEnvValue -Name 'EVALUAPRO_QA_ALUMNO_USER' -Value $alumnoUser
Set-UserEnvValue -Name 'EVALUAPRO_QA_ALUMNO_PASS' -Value $alumnoPass
Set-UserEnvValue -Name 'EVALUAPRO_QA_ADMIN_USER' -Value $adminUser
Set-UserEnvValue -Name 'EVALUAPRO_QA_ADMIN_PASS' -Value $adminPass

Write-Host 'Variables configuradas.' -ForegroundColor Green
if ($NoPersist) {
  Write-Host 'Aviso: solo disponibles en la sesion actual (NoPersist).' -ForegroundColor Yellow
} else {
  Write-Host 'Aviso: se guardaron en el perfil del usuario. Reabre la terminal para verlas.' -ForegroundColor Yellow
}

Remove-Variable docentePass, alumnoPass, adminPass -ErrorAction SilentlyContinue
