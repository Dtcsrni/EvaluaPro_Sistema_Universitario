$bundle = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe'
$log = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\logs\bundle-repair-validate-v2.log'
Get-Process | Where-Object { $_.ProcessName -in @('EvaluaPro.BurnBootstrapperApp','EvaluaPro-InstallerHub-docente-local-v1.0.0','msiexec') } | Stop-Process -Force -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $bundle)) { throw "No existe bundle: $bundle" }
$proc = Start-Process -FilePath $bundle -ArgumentList @('/repair','/quiet','/log', $log) -PassThru -Wait
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
