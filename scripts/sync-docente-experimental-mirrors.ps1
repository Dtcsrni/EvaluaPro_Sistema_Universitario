# sync-docente-experimental-mirrors.ps1
#
# Flujo de publicación del flavor docente experimental.
# La instalación local es la autoridad operativa; el build y los demás
# directorios estáticos son espejos verificables de ella.

[CmdletBinding()]
param(
    [ValidateSet('publish', 'mirror', 'verify')]
    [string]$Mode = 'publish',
    [string]$RepoRoot = '',
    [string]$LocalRoot = '',
    [switch]$SkipBackup
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# $PSScriptRoot no está disponible de forma fiable al evaluar valores por
# defecto del bloque param cuando el script se invoca a través de npm.
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($LocalRoot)) {
    $LocalRoot = Join-Path $env:LOCALAPPDATA 'EvaluaPro'
}

function Get-FullPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Get-RelativePathCompat([string]$BasePath, [string]$FilePath) {
    $baseUri = New-Object System.Uri(($BasePath.TrimEnd('\') + '\'))
    $fileUri = New-Object System.Uri($FilePath)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace('\', '/')
}

function Get-RelativeFileMap([string]$Root) {
    $normalizedRoot = Get-FullPath $Root
    $map = @{}
    if (-not (Test-Path -LiteralPath $normalizedRoot -PathType Container)) {
        return $map
    }
    Get-ChildItem -LiteralPath $normalizedRoot -File -Recurse | ForEach-Object {
        $relative = Get-RelativePathCompat $normalizedRoot $_.FullName
        $map[$relative] = $_.FullName
    }
    return $map
}

function Get-FileSha256([string]$Path) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        return ([System.BitConverter]::ToString($sha256.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
    }
}

function Get-TreeSha256([string]$Root) {
    $map = Get-RelativeFileMap $Root
    $lines = foreach ($relative in ($map.Keys | Sort-Object)) {
        $hash = Get-FileSha256 $map[$relative]
        "$hash  $relative"
    }
    $payload = [string]::Join("`n", $lines)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $digest = $sha256.ComputeHash($bytes)
    } finally {
        $sha256.Dispose()
    }
    return ([System.BitConverter]::ToString($digest) -replace '-', '').ToLowerInvariant()
}

function Assert-Directory([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Label no existe: $Path"
    }
}

function Copy-TreeExact([string]$Source, [string]$Target) {
    $sourceMap = Get-RelativeFileMap $Source
    New-Item -ItemType Directory -Path $Target -Force | Out-Null
    $targetMap = Get-RelativeFileMap $Target

    foreach ($relative in ($targetMap.Keys | Where-Object { -not $sourceMap.ContainsKey($_) })) {
        Remove-Item -LiteralPath $targetMap[$relative] -Force
    }
    foreach ($relative in ($sourceMap.Keys | Sort-Object)) {
        $destination = Join-Path $Target ($relative.Replace('/', '\'))
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $sourceMap[$relative] -Destination $destination -Force
    }
    Get-ChildItem -LiteralPath $Target -Directory -Recurse | Sort-Object FullName -Descending | ForEach-Object {
        if (-not (Get-ChildItem -LiteralPath $_.FullName -Force)) {
            Remove-Item -LiteralPath $_.FullName -Force
        }
    }
}

function Acquire-SyncLock([string]$Root) {
    $lockPath = Join-Path $Root '.docente-experimental-sync.lock'
    try {
        $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("pid=$PID`nstarted=$([DateTime]::UtcNow.ToString('O'))`n")
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
        return [pscustomobject]@{ Path = $lockPath; Stream = $stream }
    } catch [System.IO.IOException] {
        throw "Ya existe otra sincronización experimental en ejecución: $lockPath"
    }
}

function Release-SyncLock($Lock) {
    if ($null -eq $Lock) { return }
    try { $Lock.Stream.Dispose() } catch {}
    Remove-Item -LiteralPath $Lock.Path -Force -ErrorAction SilentlyContinue
}

$repo = Get-FullPath $RepoRoot
$local = Get-FullPath $LocalRoot
$expectedLocal = Get-FullPath (Join-Path $env:LOCALAPPDATA 'EvaluaPro')
if ($local -ne $expectedLocal) {
    throw "Por seguridad, LocalRoot debe ser la instalación local de EvaluaPro: $expectedLocal"
}

$buildMirror = Join-Path $repo 'apps\frontend\dist-docente'
$installedPrimary = Join-Path $local 'apps\frontend\dist-docente'
$installedSecondary = Join-Path $local 'frontend-dist-docente'
$manifestPath = Join-Path $local 'logs\experimental-mirror-manifest.json'

New-Item -ItemType Directory -Path $local -Force | Out-Null
$lock = $null
$backupPath = $null
try {
    $lock = Acquire-SyncLock $local

    if ($Mode -eq 'publish') {
        Assert-Directory $buildMirror 'Build experimental docente'
        if (-not (Test-Path -LiteralPath (Join-Path $buildMirror 'index.html') -PathType Leaf)) {
            throw "El build experimental no contiene index.html: $buildMirror"
        }
        if (-not (Test-Path -LiteralPath $installedPrimary -PathType Container)) {
            New-Item -ItemType Directory -Path $installedPrimary -Force | Out-Null
        }
        Copy-TreeExact $buildMirror $installedPrimary
    } else {
        Assert-Directory $installedPrimary 'Instalación local experimental'
        if (-not (Test-Path -LiteralPath (Join-Path $installedPrimary 'index.html') -PathType Leaf)) {
            throw "La instalación local experimental no contiene index.html: $installedPrimary"
        }
    }

    $operationalSource = $installedPrimary
    if ($Mode -ne 'verify') {
        if (-not $SkipBackup) {
            $backupPath = Join-Path $local ('backups\experimental-mirrors-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
            New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
            foreach ($entry in @(
                [pscustomobject]@{ Path = $installedPrimary; Name = 'local-primary' },
                [pscustomobject]@{ Path = $installedSecondary; Name = 'local-secondary' },
                [pscustomobject]@{ Path = $buildMirror; Name = 'build-mirror' }
            )) {
                if (Test-Path -LiteralPath $entry.Path -PathType Container) {
                    $destination = Join-Path $backupPath $entry.Name
                    New-Item -ItemType Directory -Path $destination -Force | Out-Null
                    Get-ChildItem -LiteralPath $entry.Path -Force | Copy-Item -Destination $destination -Recurse -Force
                }
            }
        }

        # La autoridad operativa local se replica al build y al espejo alterno.
        Copy-TreeExact $operationalSource $buildMirror
        Copy-TreeExact $operationalSource $installedSecondary
    }

    $sourceHash = Get-TreeSha256 $operationalSource
    $buildHash = Get-TreeSha256 $buildMirror
    $secondaryHash = Get-TreeSha256 $installedSecondary
    $consistent = ($sourceHash -eq $buildHash) -and ($sourceHash -eq $secondaryHash)
    if (-not $consistent) {
        throw "Los espejos no coinciden con la instalación local experimental. local=$sourceHash build=$buildHash secondary=$secondaryHash"
    }

    $manifest = [ordered]@{
        mode = $Mode
        operationalAuthority = $operationalSource
        mirrors = @($buildMirror, $installedSecondary)
        sha256Tree = $sourceHash
        files = (Get-RelativeFileMap $operationalSource).Count
        generatedAtUtc = [DateTime]::UtcNow.ToString('O')
        backup = $backupPath
    }
    if ($Mode -ne 'verify') {
        New-Item -ItemType Directory -Path (Split-Path -Parent $manifestPath) -Force | Out-Null
        $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    }
    $manifest | ConvertTo-Json -Compress -Depth 4
} finally {
    Release-SyncLock $lock
}
