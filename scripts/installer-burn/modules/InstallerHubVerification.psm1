Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-EvaluaProNativeRuntime {
  param([Parameter(Mandatory = $true)][string]$InstallDir)

  $root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
  $required = @(
    'scripts\start-docente-native.mjs',
    'scripts\launcher-dashboard.mjs',
    'scripts\generate-installation-manifest.ps1',
    'scripts\prepare-docente-sqlite.mjs',
    'apps\backend\dist\prisma\schema.sql',
    'runtime\node\node.exe'
  )
  foreach ($relativePath in $required) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Payload docente incompleto: falta $relativePath" }
  }

  $nodeExe = Join-Path $root 'runtime\node\node.exe'
  $nodeVersionOutput = @(& $nodeExe --version 2>&1)
  $nodeExitCode = $LASTEXITCODE
  $nodeVersion = if ($nodeVersionOutput.Count -gt 0) { [string]$nodeVersionOutput[0].ToString().Trim() } else { '' }
  if ($nodeExitCode -ne 0 -or $nodeVersion -notmatch '^v24\.\d+\.\d+$') {
    throw "Runtime Node docente inválido: se esperaba Node.js 24.x y se detectó '$nodeVersion' (exit=$nodeExitCode)."
  }
  return [pscustomobject]@{ nodePath = $nodeExe; nodeVersion = $nodeVersion; root = $root }
}

function Test-EvaluaProInstallationManifest {
  param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$ExpectedRoot,
    [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$ExpectedPort,
    [Parameter(Mandatory = $true)][string]$ExpectedNodeVersion
  )

  $manifestItem = Get-Item -LiteralPath $ManifestPath -Force -ErrorAction Stop
  if (($manifestItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'El manifiesto de instalación es un enlace/reparse point y se rechaza.' }
  $manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  foreach ($path in @('app', 'installation', 'runtime', 'criticalFiles')) {
    if ($null -eq $manifest.PSObject.Properties[$path]) { throw "El manifiesto no cumple su contrato; falta '$path'." }
  }
  $actualRoot = [IO.Path]::GetFullPath([string]$manifest.installation.root).TrimEnd('\')
  $expectedRootFull = [IO.Path]::GetFullPath($ExpectedRoot).TrimEnd('\')
  if (-not $actualRoot.Equals($expectedRootFull, [StringComparison]::OrdinalIgnoreCase)) { throw 'El manifiesto corresponde a otra raíz de instalación.' }
  if (-not [bool]$manifest.installation.installed) { throw 'El manifiesto no confirma que el paquete de aplicación esté instalado.' }
  if ([int]$manifest.installation.port -ne $ExpectedPort) { throw 'El manifiesto declara un puerto distinto al solicitado.' }
  if ([string]::IsNullOrWhiteSpace([string]$manifest.installation.flavor)) { throw 'El manifiesto no declara flavor de instalación.' }
  if (-not [bool]$manifest.runtime.embeddedNode.present -or [string]$manifest.runtime.embeddedNode.version -ne $ExpectedNodeVersion) {
    throw 'La identidad/version del runtime embebido en el manifiesto no coincide con el runtime validado.'
  }
  $appVersion = [string]$manifest.app.version
  if ([string]::IsNullOrWhiteSpace($appVersion) -or @($manifest.criticalFiles).Count -eq 0) { throw 'El manifiesto no contiene versión de aplicación o archivos críticos.' }
  foreach ($entry in @($manifest.criticalFiles)) {
    if ([string]::IsNullOrWhiteSpace([string]$entry.path) -or $null -eq $entry.PSObject.Properties['exists']) {
      throw 'El manifiesto contiene una entrada crítica incompleta.'
    }
    if ([bool]$entry.exists -and [string]$entry.sha256 -notmatch '^[a-f0-9]{64}$') { throw "El hash crítico no es válido: $($entry.path)" }
  }
  return $manifest
}

function Invoke-EvaluaProInstallationManifestVerification {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$PowerShellPath,
    [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port,
    [Parameter(Mandatory = $true)][string]$ExpectedNodeVersion
  )

  $root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
  $generator = Join-Path $root 'scripts\generate-installation-manifest.ps1'
  if (-not (Test-Path -LiteralPath $generator -PathType Leaf)) { throw "No existe el generador crítico del manifiesto de instalación: $generator" }
  $manifestPath = Join-Path $root 'logs\installation.manifest.json'
  $output = @(& $PowerShellPath -NoProfile -ExecutionPolicy Bypass -File $generator -InstallDir $root -Port $Port 2>&1)
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    $detail = (@($output | Select-Object -Last 8) -join ' ').Trim()
    throw "No se pudo generar el manifiesto de instalación requerido (exit=$exitCode). $detail"
  }
  return Test-EvaluaProInstallationManifest -ManifestPath $manifestPath -ExpectedRoot $root -ExpectedPort $Port -ExpectedNodeVersion $ExpectedNodeVersion
}

Export-ModuleMember -Function @('Assert-EvaluaProNativeRuntime', 'Test-EvaluaProInstallationManifest', 'Invoke-EvaluaProInstallationManifestVerification')
