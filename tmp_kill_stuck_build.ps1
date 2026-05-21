Get-Process dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process wix -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
