$repoRoot = 'C:\Users\evega\EvaluaPro_Sistema_Universitario'
$installRoot = 'C:\Program Files\EvaluaPro'
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'
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
  installCreateShortcutsSha = if (Test-Path -LiteralPath (Join-Path $installRoot 'scripts\create-shortcuts.ps1')) { (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $installRoot 'scripts\create-shortcuts.ps1')).Hash } else { '' }
  installManifestSha = if (Test-Path -LiteralPath (Join-Path $installRoot 'scripts\generate-installation-manifest.ps1')) { (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $installRoot 'scripts\generate-installation-manifest.ps1')).Hash } else { '' }
  shortcuts = $items
} | ConvertTo-Json -Compress -Depth 6
