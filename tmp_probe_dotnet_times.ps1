Get-Process dotnet -ErrorAction SilentlyContinue | Select-Object Id,StartTime,CPU,ProcessName | ConvertTo-Json -Compress -Depth 4
