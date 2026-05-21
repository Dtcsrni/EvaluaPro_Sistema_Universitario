<#
  serena-mcp.ps1
  Arranca Serena MCP en Windows desde PATH o desde uv tool home.
#>
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$ErrorActionPreference = 'Stop'

$serena = Get-Command serena.exe, serena -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty Source

if (-not $serena) {
  $fallback = Join-Path $HOME '.local\bin\serena.exe'
  if (Test-Path -LiteralPath $fallback) {
    $serena = $fallback
  }
}

if (-not $serena) {
  throw "No se encontro Serena en PATH ni en $HOME\.local\bin\serena.exe."
}

& $serena @Arguments
exit $LASTEXITCODE
