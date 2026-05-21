Get-Process | Where-Object { $_.ProcessName -match 'EvaluaPro|Burn|msiexec' } | Stop-Process -Force -ErrorAction SilentlyContinue
$target = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\dist\installer\docente-local\EvaluaPro-InstallerHub-docente-local-v1.0.0.exe'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue }
[pscustomobject]@{ exists = [bool](Test-Path -LiteralPath $target) } | ConvertTo-Json -Compress
