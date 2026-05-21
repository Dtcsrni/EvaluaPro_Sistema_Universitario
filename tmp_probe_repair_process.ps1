Get-Process | Where-Object { $_.ProcessName -match 'EvaluaPro|msiexec|setup|Burn' } | Select-Object ProcessName,Id,MainWindowTitle,Responding | ConvertTo-Json -Compress -Depth 4
