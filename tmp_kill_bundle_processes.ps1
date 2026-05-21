Get-Process | Where-Object { $_.ProcessName -in @('EvaluaPro.BurnBootstrapperApp','EvaluaPro-InstallerHub-docente-local-v1.0.0') } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -match 'EvaluaPro|msiexec|Burn' } | Select-Object ProcessName,Id | ConvertTo-Json -Compress -Depth 4
