Get-Process dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process wix -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$cache = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\.wix\extensions\WixToolset.Bal.wixext\6.0.2'
if (Test-Path -LiteralPath $cache) {
  Remove-Item -LiteralPath $cache -Recurse -Force -ErrorAction SilentlyContinue
}
[pscustomobject]@{ cacheExists = [bool](Test-Path -LiteralPath $cache) } | ConvertTo-Json -Compress
