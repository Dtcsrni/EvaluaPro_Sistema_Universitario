# install-maintenance-tasks.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$WeeklyDay = 'Sunday',
  [string]$WeeklyTime = '03:00',
  [string]$MonthlyTime = '04:00'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$maintenanceScript = Join-Path $PSScriptRoot 'ops-maintenance.ps1'
if (-not (Test-Path -LiteralPath $maintenanceScript)) {
  throw "No existe script de mantenimiento: $maintenanceScript"
}

$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
if ($null -ne $pwshCmd) {
  $pwsh = $pwshCmd.Source
}
else {
  $pwsh = (Get-Command powershell -ErrorAction Stop).Source
}

$weeklyTaskName = 'EvaluaPro-Mantenimiento-Semanal'
$monthlyTaskName = 'EvaluaPro-Mantenimiento-Mensual'

$weeklyArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$maintenanceScript`" -Mode weekly -RepoRoot `"$RepoRoot`""
$monthlyArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$maintenanceScript`" -Mode monthly -RepoRoot `"$RepoRoot`""

$weeklyAction = New-ScheduledTaskAction -Execute $pwsh -Argument $weeklyArgs
$monthlyAction = New-ScheduledTaskAction -Execute $pwsh -Argument $monthlyArgs

$weeklyTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $WeeklyDay -At $WeeklyTime
$monthlyTrigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 4 -DaysOfWeek Sunday -At $MonthlyTime

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $weeklyTaskName -Action $weeklyAction -Trigger $weeklyTrigger -Principal $principal -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName $monthlyTaskName -Action $monthlyAction -Trigger $monthlyTrigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Tarea registrada: $weeklyTaskName ($WeeklyDay $WeeklyTime)"
Write-Host "Tarea registrada: $monthlyTaskName (cada 4 semanas, domingo $MonthlyTime)"
Write-Host 'Para validar: Get-ScheduledTask -TaskName "EvaluaPro-Mantenimiento-*"'
