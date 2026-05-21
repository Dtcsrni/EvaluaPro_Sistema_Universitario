Get-Process | Where-Object { $_.ProcessName -match 'wix|dotnet|msbuild|EvaluaPro|msiexec' } | Select-Object ProcessName,Id,MainWindowTitle,Responding | ConvertTo-Json -Compress -Depth 4
