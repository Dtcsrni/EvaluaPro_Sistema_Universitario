$repoRoot = 'C:\Users\evega\EvaluaPro_Sistema_Universitario'
$installRoot = 'C:\Program Files\EvaluaPro'
$files = @('scripts\create-shortcuts.ps1','scripts\generate-installation-manifest.ps1')
$result = foreach ($rel in $files) {
  $repo = Join-Path $repoRoot $rel
  $inst = Join-Path $installRoot $rel
  [pscustomobject]@{
    relativePath = $rel
    repoExists = [bool](Test-Path -LiteralPath $repo)
    installExists = [bool](Test-Path -LiteralPath $inst)
    repoSha = if (Test-Path -LiteralPath $repo) { (Get-FileHash -Algorithm SHA256 -LiteralPath $repo).Hash } else { '' }
    installSha = if (Test-Path -LiteralPath $inst) { (Get-FileHash -Algorithm SHA256 -LiteralPath $inst).Hash } else { '' }
  }
}
$result | ConvertTo-Json -Compress -Depth 4
