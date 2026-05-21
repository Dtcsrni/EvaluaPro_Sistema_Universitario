$path = 'C:\Users\evega\EvaluaPro_Sistema_Universitario\logs\bundle-repair-validate.log'
if (Test-Path -LiteralPath $path) {
  Get-Content -LiteralPath $path -Tail 80
}
