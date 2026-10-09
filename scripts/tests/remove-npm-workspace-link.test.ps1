$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\installer\Remove-NpmWorkspaceLink.ps1')

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("evaluapro-workspace-link-{0}" -f [guid]::NewGuid().ToString('N'))
$ordinaryDirectory = Join-Path $testRoot 'ordinary-directory'

try {
  Remove-NpmWorkspaceLink -LiteralPath (Join-Path $testRoot 'missing-link')

  New-Item -ItemType Directory -Path $ordinaryDirectory -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $ordinaryDirectory 'nested.txt') -Value 'remove-me'
  Remove-NpmWorkspaceLink -LiteralPath $ordinaryDirectory
  if ([System.IO.Directory]::Exists($ordinaryDirectory)) {
    throw 'La limpieza no retiró el directorio de workspace.'
  }
} finally {
  if ([System.IO.Directory]::Exists($testRoot)) {
    [System.IO.Directory]::Delete($testRoot, $true)
  }
}
