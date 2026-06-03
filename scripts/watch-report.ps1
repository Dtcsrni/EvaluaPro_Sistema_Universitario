$path = 'v:\Software\EvaluaPro\reports\qa\installer-hub-e2e-docente'
if (-not (Test-Path $path)) { Write-Output 'PATH_MISSING'; exit 1 }
$fsw = New-Object System.IO.FileSystemWatcher $path, 'report.json'
$fsw.IncludeSubdirectories = $true
$fsw.EnableRaisingEvents = $true
Register-ObjectEvent $fsw Created -Action {
    Write-Output ("NEW_REPORT:" + $Event.SourceEventArgs.FullPath)
} | Out-Null
Write-Output 'WATCHER_RUNNING'
while ($true) { Start-Sleep -Seconds 3600 }
