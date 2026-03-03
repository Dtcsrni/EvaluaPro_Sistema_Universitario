[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$GoogleOauthClientId,
  [Parameter(Mandatory = $true)]
  [string]$GoogleClassroomClientId,
  [Parameter(Mandatory = $true)]
  [string]$GoogleClassroomClientSecret,
  [string]$GoogleClassroomRedirectUri = 'http://localhost:4000/api/integraciones/classroom/oauth/callback',
  [string]$EnvPath = '',
  [switch]$DisableRequireGoogleOAuth,
  [switch]$RegenerateClassroomTokenKey,
  [switch]$AlsoSetViteGoogleClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-DefaultEnvPath {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  return Join-Path $repoRoot '.env'
}

function New-ClassroomCipherKeyBase64 {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Test-ClassroomCipherKeyBase64 {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  try {
    $raw = [Convert]::FromBase64String($Value)
    return $raw.Length -eq 32
  } catch {
    return $false
  }
}

function Upsert-EnvLine {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $indices = @()
  for ($i = 0; $i -lt $script:lines.Count; $i += 1) {
    $line = [string]$script:lines[$i]
    if ($line.TrimStart().StartsWith('#')) { continue }
    if ($line -match ('^\s*' + [Regex]::Escape($Key) + '=')) {
      $indices += $i
    }
  }

  $newLine = "$Key=$Value"
  if ($indices.Count -eq 0) {
    $script:lines.Add($newLine) | Out-Null
    return
  }

  $first = [int]$indices[0]
  $script:lines[$first] = $newLine

  if ($indices.Count -gt 1) {
    for ($j = $indices.Count - 1; $j -ge 1; $j -= 1) {
      $script:lines.RemoveAt([int]$indices[$j])
    }
  }
}

if ([string]::IsNullOrWhiteSpace($EnvPath)) {
  $EnvPath = Resolve-DefaultEnvPath
}

$envDir = Split-Path -Parent $EnvPath
if (-not [string]::IsNullOrWhiteSpace($envDir) -and -not (Test-Path $envDir)) {
  New-Item -ItemType Directory -Path $envDir -Force | Out-Null
}

$lines = New-Object 'System.Collections.Generic.List[string]'
if (Test-Path $EnvPath) {
  foreach ($line in (Get-Content -Path $EnvPath -Encoding utf8)) {
    $lines.Add([string]$line) | Out-Null
  }
}

$classroomTokenKey = ''
$existingKeyLine = $lines | Where-Object { $_ -match '^\s*CLASSROOM_TOKEN_CIPHER_KEY=' } | Select-Object -First 1
if ($existingKeyLine) {
  $classroomTokenKey = [string]($existingKeyLine -replace '^\s*CLASSROOM_TOKEN_CIPHER_KEY=', '')
}

$mustGenerate = $RegenerateClassroomTokenKey -or -not (Test-ClassroomCipherKeyBase64 -Value $classroomTokenKey)
if ($mustGenerate) {
  $classroomTokenKey = New-ClassroomCipherKeyBase64
}

Upsert-EnvLine -Key 'GOOGLE_OAUTH_CLIENT_ID' -Value $GoogleOauthClientId
Upsert-EnvLine -Key 'GOOGLE_CLASSROOM_CLIENT_ID' -Value $GoogleClassroomClientId
Upsert-EnvLine -Key 'GOOGLE_CLASSROOM_CLIENT_SECRET' -Value $GoogleClassroomClientSecret
Upsert-EnvLine -Key 'GOOGLE_CLASSROOM_REDIRECT_URI' -Value $GoogleClassroomRedirectUri
Upsert-EnvLine -Key 'CLASSROOM_TOKEN_CIPHER_KEY' -Value $classroomTokenKey
Upsert-EnvLine -Key 'REQUIRE_GOOGLE_OAUTH' -Value ($(if ($DisableRequireGoogleOAuth) { '0' } else { '1' }))

if ($AlsoSetViteGoogleClientId) {
  Upsert-EnvLine -Key 'VITE_GOOGLE_CLIENT_ID' -Value $GoogleOauthClientId
}

[System.IO.File]::WriteAllText($EnvPath, ($lines -join [Environment]::NewLine) + [Environment]::NewLine, [System.Text.Encoding]::UTF8)

Write-Host "OK: OAuth/Classroom configurado en: $EnvPath"
Write-Host "- REQUIRE_GOOGLE_OAUTH=$($(if ($DisableRequireGoogleOAuth) { '0' } else { '1' }))"
Write-Host "- CLASSROOM_TOKEN_CIPHER_KEY=$($(if ($mustGenerate) { 'generada/renovada' } else { 'existente valida' }))"
if ($AlsoSetViteGoogleClientId) {
  Write-Host '- VITE_GOOGLE_CLIENT_ID actualizado'
}
