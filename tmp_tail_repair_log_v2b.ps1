$path = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\logs\bundle-repair-validate-v2.log'
if (Test-Path -LiteralPath $path) { Get-Content -LiteralPath $path -Tail 60 }
