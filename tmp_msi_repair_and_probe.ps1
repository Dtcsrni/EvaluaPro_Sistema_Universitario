$msi = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\dist\installer\_internal\docente-local\EvaluaPro-docente-local.msi'
$log = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\logs\msi-repair-validate.log'
if (-not (Test-Path -LiteralPath $msi)) { throw "No existe msi: $msi" }
$proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/fa', $msi, '/qn', '/L*v', $log) -PassThru -Wait
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'
$installRoot = 'C:\Program Files\EvaluaPro'
$wsh = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path $desktop 'EvaluaPro - Prod.lnk'),
  (Join-Path $desktop 'EvaluaPro - Hub.lnk'),
  (Join-Path $start 'EvaluaPro - Prod.lnk'),
  (Join-Path $start 'EvaluaPro - Hub.lnk')
)
$items = foreach ($path in $targets) {
  $entry = [ordered]@{ path=$path; exists=[bool](Test-Path -LiteralPath $path); icon=''; target=''; arguments='' }
  if ($entry.exists) {
    $s = $wsh.CreateShortcut($path)
    $entry.icon = [string]$s.IconLocation
    $entry.target = [string]$s.TargetPath
    $entry.arguments = [string]$s.Arguments
  }
  [pscustomobject]$entry
}
[pscustomobject]@{
  exitCode = [int]$proc.ExitCode
  logPath = $log
  installRootExists = [bool](Test-Path -LiteralPath $installRoot)
  installScriptSha = if (Test-Path -LiteralPath (Join-Path $installRoot 'scripts\create-shortcuts.ps1')) { (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $installRoot 'scripts\create-shortcuts.ps1')).Hash } else { '' }
  shortcuts = $items
} | ConvertTo-Json -Compress -Depth 6
