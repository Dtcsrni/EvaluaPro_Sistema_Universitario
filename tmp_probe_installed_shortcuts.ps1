$installRoot = 'C:\Program Files\EvaluaPro'
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EvaluaPro'
$targets = @(
  (Join-Path $desktop 'EvaluaPro - Prod.lnk'),
  (Join-Path $desktop 'EvaluaPro - Hub.lnk'),
  (Join-Path $start 'EvaluaPro - Prod.lnk'),
  (Join-Path $start 'EvaluaPro - Hub.lnk')
)
$wsh = New-Object -ComObject WScript.Shell
$result = [ordered]@{
  installRootExists = [bool](Test-Path -LiteralPath $installRoot)
  packageJsonExists = [bool](Test-Path -LiteralPath (Join-Path $installRoot 'package.json'))
  iconsDirExists = [bool](Test-Path -LiteralPath (Join-Path $installRoot 'scripts\icons'))
  shortcuts = @()
}
foreach ($path in $targets) {
  $item = [ordered]@{ path=$path; exists=[bool](Test-Path -LiteralPath $path); icon=''; target=''; arguments='' }
  if ($item.exists) {
    $s = $wsh.CreateShortcut($path)
    $item.icon = [string]$s.IconLocation
    $item.target = [string]$s.TargetPath
    $item.arguments = [string]$s.Arguments
  }
  $result.shortcuts += [pscustomobject]$item
}
$result | ConvertTo-Json -Compress -Depth 6
