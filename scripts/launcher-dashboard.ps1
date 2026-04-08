# Wrapper that launches the Node dashboard with optional flags.
# Keeps UI logic in JavaScript for portability.
param(
  [ValidateSet('dev','prod','none')]
  [string]$Mode = 'dev',
  [int]$Port = 0,
  [switch]$NoOpen,
  [switch]$Verbose
)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$embeddedNode = Join-Path $root 'runtime\node\node.exe'
$node = if (Test-Path -LiteralPath $embeddedNode) { $embeddedNode } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) {
  Write-Host 'Runtime Node embebido no disponible y Node global no encontrado.'
  exit 1
}

# Compose arguments for the dashboard server.
$args = @("$root\scripts\launcher-dashboard.mjs", '--mode', $Mode)
if ($Port -gt 0) { $args += @('--port', $Port) }
if ($NoOpen) { $args += '--no-open' }
if ($Verbose) { $args += '--verbose' }

& $node @args
exit $LASTEXITCODE
