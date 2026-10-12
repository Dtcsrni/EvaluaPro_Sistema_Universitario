Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:InstallerHubSensitiveValues = @()
$script:InstallerHubRequestSchema = $null

function Get-InstallerHubRequestSchema {
  if ($script:InstallerHubRequestSchema) { return $script:InstallerHubRequestSchema }
  $schemaPath = Join-Path $PSScriptRoot 'request-envelope-v1.schema.json'
  if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    $schemaPath = Join-Path $PSScriptRoot '..\..\..\contracts\installer-hub\request-envelope-v1.schema.json'
  }
  if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    throw 'No se encontró el contrato canónico request-envelope-v1.schema.json.'
  }
  $script:InstallerHubRequestSchema = Get-Content -LiteralPath $schemaPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
  return $script:InstallerHubRequestSchema
}

function ConvertTo-InstallerHubUtcDateTimeOffset {
  param([Parameter(Mandatory = $true)][object]$Value)

  if ($Value -is [DateTimeOffset]) { return $Value.ToUniversalTime() }
  if ($Value -is [DateTime]) { return ([DateTimeOffset]::new($Value)).ToUniversalTime() }
  return [DateTimeOffset]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AllowWhiteSpaces).ToUniversalTime()
}

function Protect-EvaluaProDiagnosticText {
  param([AllowNull()][string]$Text)
  if ($null -eq $Text) { return '' }
  foreach ($secret in $script:InstallerHubSensitiveValues) {
    if (-not [string]::IsNullOrEmpty($secret)) { $Text = $Text.Replace($secret, '[REDACTED]') }
  }
  return $Text
}

function Test-InstallerHubPrivateAcl {
  param([Parameter(Mandatory = $true)][string]$Path)

  $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
  $untrustedSids = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545')
  $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor
    [Security.AccessControl.FileSystemRights]::Modify -bor
    [Security.AccessControl.FileSystemRights]::FullControl -bor
    [Security.AccessControl.FileSystemRights]::CreateFiles -bor
    [Security.AccessControl.FileSystemRights]::CreateDirectories -bor
    [Security.AccessControl.FileSystemRights]::Delete -bor
    [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [Security.AccessControl.FileSystemRights]::TakeOwnership
  foreach ($rule in $acl.Access) {
    if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
    try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { continue }
    if ($sid -in $untrustedSids -and ($rule.FileSystemRights -band $writeRights) -ne 0) {
      throw "El ACL del handoff permite escritura a una identidad local no confiable: $Path ($sid)."
    }
  }
}

function Initialize-InstallerHubProtectedDataType {
  if ('System.Security.Cryptography.ProtectedData' -as [type]) { return }
  foreach ($assemblyName in @('System.Security', 'System.Security.Cryptography.ProtectedData')) {
    try {
      Add-Type -AssemblyName $assemblyName -ErrorAction Stop
      if ('System.Security.Cryptography.ProtectedData' -as [type]) { return }
    } catch { }
  }
  throw 'La API DPAPI no está disponible en este host de PowerShell.'
}

function Read-EvaluaProInstallerRequest {
  param(
    [string]$Path = '',
    [AllowEmptyString()][string]$JsonContent = '',
    [Parameter(Mandatory = $true)][string]$ExpectedCommand
  )

  $item = $null
  if (-not [string]::IsNullOrWhiteSpace($Path)) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'El archivo de solicitud es un enlace/reparse point y se rechaza.'
    }
    if ([string]::IsNullOrEmpty($JsonContent)) {
      $JsonContent = [IO.File]::ReadAllText($item.FullName, [Text.Encoding]::UTF8)
    }
  } elseif ([string]::IsNullOrWhiteSpace($JsonContent)) {
    throw 'La validación de la solicitud requiere una ruta o un snapshot JSON inmutable.'
  }
  if ([Text.Encoding]::UTF8.GetByteCount($JsonContent) -gt 16384) {
    throw 'La solicitud Installer Hub excede el límite seguro de 16 KiB.'
  }
  $envelope = $JsonContent | ConvertFrom-Json -ErrorAction Stop
  if ($null -eq $envelope.PSObject.Properties['schemaVersion']) {
    if ($ExpectedCommand -ne 'detect-prereqs') {
      throw 'El adaptador legado solo admite detección sin efectos; mutaciones requieren el protocolo versionado.'
    }
    return [pscustomobject]@{
      OperationId = [guid]::NewGuid().ToString('D')
      SchemaVersion = 0
      Payload = $envelope
    }
  }

  $schema = Get-InstallerHubRequestSchema
  $allowed = @($schema.properties.PSObject.Properties | ForEach-Object { $_.Name })
  $actual = @($envelope.PSObject.Properties | ForEach-Object { $_.Name })
  $unknown = @($actual | Where-Object { $_ -notin $allowed })
  if ($unknown.Count -gt 0) { throw "La solicitud contiene campos no permitidos: $($unknown -join ', ')." }
  if ([int]$envelope.schemaVersion -ne [int]$schema.properties.schemaVersion.const) { throw "Versión de protocolo de Installer Hub no soportada: $($envelope.schemaVersion)." }
  foreach ($requiredProperty in $schema.required) {
    if ($null -eq $envelope.PSObject.Properties[[string]$requiredProperty]) { throw "Falta un campo obligatorio del contrato Installer Hub: $requiredProperty." }
  }
  $supportedCommands = @($schema.properties.command.enum | ForEach-Object { [string]$_ })
  if ([string]$envelope.command -notin $supportedCommands) { throw "Comando de Installer Hub no soportado: $($envelope.command)." }
  $protectedSecretsValue = ''
  $protectedSecretsProperty = $envelope.PSObject.Properties['protectedSecrets']
  if ($protectedSecretsProperty) { $protectedSecretsValue = [string]$protectedSecretsProperty.Value }
  if ($ExpectedCommand -in @('post-install', 'update', 'uninstall') -or -not [string]::IsNullOrWhiteSpace($protectedSecretsValue)) {
    if ($item) {
      Test-InstallerHubPrivateAcl -Path $item.DirectoryName
      Test-InstallerHubPrivateAcl -Path $Path
    }
  }
  $parsedOperationId = [guid]::Empty
  if (-not [guid]::TryParse([string]$envelope.operationId, [ref]$parsedOperationId)) { throw 'La correlación de solicitud no es un UUID válido.' }
  if (-not [string]::Equals([string]$envelope.command, $ExpectedCommand, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'El comando de la solicitud no coincide con el comando del helper.'
  }
  $issued = ConvertTo-InstallerHubUtcDateTimeOffset -Value $envelope.issuedAtUtc
  $expires = ConvertTo-InstallerHubUtcDateTimeOffset -Value $envelope.expiresAtUtc
  $now = [DateTimeOffset]::UtcNow
  $issuedUtc = $issued.UtcDateTime
  $expiresUtc = $expires.UtcDateTime
  $nowUtc = $now.UtcDateTime
  $issuedTooFarAhead = $issuedUtc.Ticks -gt $nowUtc.AddMinutes(2).Ticks
  $requestExpired = $expiresUtc.Ticks -le $nowUtc.Ticks
  $requestWindowTooLong = $expiresUtc.Subtract($issuedUtc).TotalMinutes -gt 30
  if ($issuedTooFarAhead -or $requestExpired -or $requestWindowTooLong) {
    throw 'La solicitud venció o su ventana temporal no es válida.'
  }
  if ($null -eq $envelope.payload -or $envelope.payload -isnot [pscustomobject]) { throw 'El payload de la solicitud debe ser un objeto JSON.' }

  $payload = $envelope.payload
  if (-not [string]::IsNullOrWhiteSpace($protectedSecretsValue)) {
    try {
      Initialize-InstallerHubProtectedDataType
      $cipher = [Convert]::FromBase64String($protectedSecretsValue)
      $plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
      $secretMap = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json -ErrorAction Stop
    } catch {
      throw 'No se pudieron descifrar los secretos protegidos del handoff.'
    }
    if ($null -eq $payload.PSObject.Properties['config']) { $payload | Add-Member -NotePropertyName config -NotePropertyValue ([pscustomobject]@{}) }
    $allowedSecrets = @('portalAlumnoApiKey', 'portalApiKey', 'codigoActivacion')
    foreach ($property in $secretMap.PSObject.Properties) {
      if ($property.Name -notin $allowedSecrets) { throw "Secreto no permitido en el handoff: $($property.Name)." }
      $payload.config | Add-Member -NotePropertyName $property.Name -NotePropertyValue ([string]$property.Value) -Force
      if (-not [string]::IsNullOrEmpty([string]$property.Value)) { $script:InstallerHubSensitiveValues += [string]$property.Value }
    }
    [Array]::Clear($plain, 0, $plain.Length)
    [Array]::Clear($cipher, 0, $cipher.Length)
  }

  return [pscustomobject]@{
    OperationId = [string]$envelope.operationId
    SchemaVersion = [int]$envelope.schemaVersion
    Payload = $payload
  }
}

function Write-EvaluaProAtomicText {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content,
    [System.Text.Encoding]$Encoding = [System.Text.UTF8Encoding]::new($false)
  )

  $fullPath = [IO.Path]::GetFullPath($Path)
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop | Out-Null
  }
  $temporary = Join-Path $parent ('.' + [IO.Path]::GetFileName($fullPath) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
  $replaceBackup = $temporary + '.bak'
  $bytes = $Encoding.GetBytes($Content)
  $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  try {
    if (Test-Path -LiteralPath $fullPath) {
      [IO.File]::Replace($temporary, $fullPath, $replaceBackup, $true)
      if (Test-Path -LiteralPath $replaceBackup) { Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction Stop }
    }
    else { [IO.File]::Move($temporary, $fullPath) }
  } finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $replaceBackup) { Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue }
  }
}

Export-ModuleMember -Function @('Read-EvaluaProInstallerRequest', 'Write-EvaluaProAtomicText', 'Protect-EvaluaProDiagnosticText')
