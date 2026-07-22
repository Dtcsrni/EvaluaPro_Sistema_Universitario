Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Common.psm1') -DisableNameChecking

function Get-EvaluaProMachineFingerprintHash {
  $machineGuid = ''
  try {
    $machineGuid = [string](Get-ItemPropertyValue -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name 'MachineGuid')
  } catch {
    $machineGuid = [Environment]::MachineName
  }
  $base = "{0}|{1}|{2}" -f [Environment]::MachineName, [Environment]::OSVersion.VersionString, $machineGuid
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($base)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-EvaluaProLicenseSecurityRoot {
  param([string]$RootDir = '')
  if (-not $RootDir) {
    if ($env:EVALUAPRO_SECURITY_ROOT) {
      $RootDir = [string]$env:EVALUAPRO_SECURITY_ROOT
    } else {
      $RootDir = Join-Path $env:ProgramData 'EvaluaPro\security'
    }
  }
  if (-not (Test-Path $RootDir)) {
    New-Item -ItemType Directory -Path $RootDir -Force | Out-Null
  }
  return $RootDir
}

function New-RandomBytes {
  param([int]$Length = 32)
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return $bytes
}

function Import-DpapiProtectedDataType {
  if ('System.Security.Cryptography.ProtectedData' -as [type]) {
    return
  }

  foreach ($assemblyName in @('System.Security', 'System.Security.Cryptography.ProtectedData')) {
    try {
      Add-Type -AssemblyName $assemblyName -ErrorAction Stop
      if ('System.Security.Cryptography.ProtectedData' -as [type]) {
        return
      }
    } catch {
      continue
    }
  }

  throw 'DPAPI LocalMachine no disponible: falta System.Security.Cryptography.ProtectedData.'
}

function Protect-DpapiBytes {
  param(
    [byte[]]$Bytes,
    [byte[]]$Entropy
  )
  Import-DpapiProtectedDataType
  return [System.Security.Cryptography.ProtectedData]::Protect(
    $Bytes,
    $Entropy,
    [System.Security.Cryptography.DataProtectionScope]::LocalMachine
  )
}

function Unprotect-DpapiBytes {
  param(
    [byte[]]$Bytes,
    [byte[]]$Entropy
  )
  Import-DpapiProtectedDataType
  return [System.Security.Cryptography.ProtectedData]::Unprotect(
    $Bytes,
    $Entropy,
    [System.Security.Cryptography.DataProtectionScope]::LocalMachine
  )
}

function Get-OrCreate-EvaluaProSealKey {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $sealPath = Join-Path $root 'license.seal.key'
  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  if (Test-Path $sealPath) {
    $raw = Get-Content -Path $sealPath -Raw -Encoding utf8
    $cipher = [Convert]::FromBase64String($raw.Trim())
    return Unprotect-DpapiBytes -Bytes $cipher -Entropy $entropy
  }
  $sealKey = New-RandomBytes -Length 32
  $cipherOut = Protect-DpapiBytes -Bytes $sealKey -Entropy $entropy
  [IO.File]::WriteAllText($sealPath, [Convert]::ToBase64String($cipherOut), [System.Text.Encoding]::UTF8)
  return $sealKey
}

function Get-HmacSha256Hex {
  param(
    [byte[]]$Key,
    [string]$Data
  )
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  try {
    $hmac.Key = $Key
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Data)
    $hash = $hmac.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $hmac.Dispose()
  }
}

function Get-Sha256Hex {
  param([string]$Data)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Data)
    $hash = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function ConvertTo-Base32String {
  param([byte[]]$Bytes)
  $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  $bits = 0
  $value = 0
  $builder = New-Object System.Text.StringBuilder
  foreach ($b in $Bytes) {
    $value = (($value -shl 8) -bor $b)
    $bits += 8
    while ($bits -ge 5) {
      $index = ($value -shr ($bits - 5)) -band 31
      [void]$builder.Append($alphabet[$index])
      $bits -= 5
    }
  }
  if ($bits -gt 0) {
    $index = (($value -shl (5 - $bits)) -band 31)
    [void]$builder.Append($alphabet[$index])
  }
  return $builder.ToString()
}

function Get-EvaluaProStepUpConfigPath {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  return (Join-Path $root 'stepup.config.json')
}

function Get-EvaluaProStepUpSessionPath {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  return (Join-Path $root 'stepup.session.json')
}

function Save-EvaluaProProtectedEnvelope {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [hashtable]$Payload,
    [string]$RootDir = ''
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $payloadJson = $Payload | ConvertTo-Json -Depth 12 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $mac = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  $envelope = [ordered]@{
    payloadJson = $payloadJson
    payload = $Payload
    mac = $mac
  }
  [IO.File]::WriteAllText($Path, ($envelope | ConvertTo-Json -Depth 12), [System.Text.Encoding]::UTF8)
  return $Path
}

function Read-EvaluaProProtectedEnvelope {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$RootDir = ''
  )
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $raw = Get-Content -Path $Path -Raw -Encoding utf8 | ConvertFrom-Json
  $payloadJson = if ($null -ne $raw.PSObject.Properties['payloadJson']) {
    [string]$raw.payloadJson
  } else {
    $raw.payload | ConvertTo-Json -Depth 12 -Compress
  }
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $calc = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  if ($calc -ne [string]$raw.mac) {
    throw "Envelope alterado (MAC invalido): $Path"
  }
  return ($payloadJson | ConvertFrom-Json)
}

function New-EvaluaProRecoveryCode {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  $bytes = New-RandomBytes -Length 12
  $chars = New-Object System.Collections.Generic.List[string]
  foreach ($b in $bytes) {
    $chars.Add([string]$alphabet[$b % $alphabet.Length])
  }
  return ('EP-{0}-{1}-{2}' -f (($chars[0..3] -join '')), (($chars[4..7] -join '')), (($chars[8..11] -join '')))
}

function Get-EvaluaProProtectedSecretBytes {
  param([string]$RootDir = '')
  $payload = Read-EvaluaProProtectedEnvelope -Path (Get-EvaluaProStepUpConfigPath -RootDir $RootDir) -RootDir $RootDir
  if (-not $payload) {
    throw 'No existe configuracion de step-up.'
  }
  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  $cipher = [Convert]::FromBase64String([string]$payload.totp.secretCiphertext)
  return Unprotect-DpapiBytes -Bytes $cipher -Entropy $entropy
}

function Get-EvaluaProCurrentTotpCode {
  param(
    [string]$RootDir = '',
    [datetime]$Now = (Get-Date)
  )
  $secret = Get-EvaluaProProtectedSecretBytes -RootDir $RootDir
  $epoch = [DateTimeOffset]::new($Now.ToUniversalTime())
  $counter = [int64][Math]::Floor($epoch.ToUnixTimeSeconds() / 30)
  $counterBytes = [BitConverter]::GetBytes($counter)
  if ([BitConverter]::IsLittleEndian) {
    [Array]::Reverse($counterBytes)
  }
  $hmac = New-Object System.Security.Cryptography.HMACSHA1
  try {
    $hmac.Key = $secret
    $hash = $hmac.ComputeHash($counterBytes)
  } finally {
    $hmac.Dispose()
  }
  $offset = $hash[$hash.Length - 1] -band 0x0f
  $binary = (($hash[$offset] -band 0x7f) -shl 24) -bor (($hash[$offset + 1] -band 0xff) -shl 16) -bor (($hash[$offset + 2] -band 0xff) -shl 8) -bor ($hash[$offset + 3] -band 0xff)
  $otp = $binary % 1000000
  return $otp.ToString('D6')
}

function Test-EvaluaProTotpCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Code,
    [string]$RootDir = ''
  )
  $normalized = ([string]$Code).Trim()
  foreach ($offset in @(-1, 0, 1)) {
    $candidate = Get-EvaluaProCurrentTotpCode -RootDir $RootDir -Now ((Get-Date).AddSeconds(30 * $offset))
    if ($candidate -eq $normalized) {
      return $true
    }
  }
  return $false
}

function Save-EvaluaProSecureLicenseToken {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [Parameter(Mandatory = $true)]
    [string]$TenantId,
    [string]$RootDir = '',
    [hashtable]$Meta
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  $tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($Token)
  $tokenCipher = Protect-DpapiBytes -Bytes $tokenBytes -Entropy $entropy
  $tokenHash = Get-HmacSha256Hex -Key ([System.Text.Encoding]::UTF8.GetBytes($fingerprint)) -Data $Token

  $payload = [ordered]@{
    version = 1
    tenantId = [string]$TenantId
    fingerprintHash = $fingerprint
    tokenCiphertext = [Convert]::ToBase64String($tokenCipher)
    tokenHash = $tokenHash
    createdAt = (Get-Date).ToString('o')
    meta = if ($Meta) { $Meta } else { @{} }
  }
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $mac = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson

  $envelope = [ordered]@{
    payload = $payload
    mac = $mac
  }
  $outPath = Join-Path $root 'license.secure.json'
  [IO.File]::WriteAllText($outPath, ($envelope | ConvertTo-Json -Depth 10), [System.Text.Encoding]::UTF8)
  return $outPath
}

function Get-EvaluaProSecureLicenseToken {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $path = Join-Path $root 'license.secure.json'
  if (-not (Test-Path $path)) {
    throw "No existe licencia segura: $path"
  }
  $json = Get-Content -Path $path -Raw -Encoding utf8 | ConvertFrom-Json
  $payload = $json.payload
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $calc = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  if ($calc -ne [string]$json.mac) {
    throw 'Envelope de licencia alterado (MAC invalido).'
  }

  $fingerprintNow = Get-EvaluaProMachineFingerprintHash
  if ([string]$payload.fingerprintHash -ne $fingerprintNow) {
    throw 'La licencia segura no pertenece a este equipo.'
  }

  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprintNow)
  $cipher = [Convert]::FromBase64String([string]$payload.tokenCiphertext)
  $plain = Unprotect-DpapiBytes -Bytes $cipher -Entropy $entropy
  return [System.Text.Encoding]::UTF8.GetString($plain)
}

function Register-EvaluaProIntegrityBaseline {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,
    [string]$RootDir = ''
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $items = @()
  foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { continue }
    $items += [ordered]@{
      path = [string]$p
      sha256 = Get-InstallerHubFileSha256 -Path $p
      size = [int64](Get-Item -LiteralPath $p).Length
    }
  }
  $payload = [ordered]@{
    version = 1
    createdAt = (Get-Date).ToString('o')
    items = $items
  }
  $payloadJson = $payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $mac = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  $baseline = [ordered]@{
    payload = $payload
    mac = $mac
  }
  $baselinePath = Join-Path $root 'integridad.baseline.json'
  [IO.File]::WriteAllText($baselinePath, ($baseline | ConvertTo-Json -Depth 10), [System.Text.Encoding]::UTF8)
  return $baselinePath
}

function Test-EvaluaProIntegrityBaseline {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $baselinePath = Join-Path $root 'integridad.baseline.json'
  if (-not (Test-Path $baselinePath)) {
    return [pscustomobject]@{ ok = $false; error = 'No existe baseline de integridad.'; cambios = @() }
  }
  $raw = Get-Content -Path $baselinePath -Raw -Encoding utf8 | ConvertFrom-Json
  $payloadJson = $raw.payload | ConvertTo-Json -Depth 8 -Compress
  $sealKey = Get-OrCreate-EvaluaProSealKey -RootDir $root
  $calc = Get-HmacSha256Hex -Key $sealKey -Data $payloadJson
  if ($calc -ne [string]$raw.mac) {
    return [pscustomobject]@{ ok = $false; error = 'Baseline alterado (MAC invalido).'; cambios = @() }
  }

  $changes = @()
  foreach ($item in @($raw.payload.items)) {
    $p = [string]$item.path
    if (-not (Test-Path $p)) {
      $changes += "Falta archivo: $p"
      continue
    }
    $shaNow = Get-InstallerHubFileSha256 -Path $p
    if ($shaNow -ne [string]$item.sha256) {
      $changes += "SHA distinto: $p"
    }
  }
  return [pscustomobject]@{
    ok = ($changes.Count -eq 0)
    error = if ($changes.Count -gt 0) { 'Se detectaron cambios de integridad.' } else { '' }
    cambios = $changes
  }
}

function Invoke-EvaluaProLicenseActivationSecure {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$TenantId,
    [Parameter(Mandatory = $true)]
    [string]$CodigoActivacion,
    [Parameter(Mandatory = $true)]
    [string]$VersionInstalada,
    [string]$RootDir = ''
  )
  $simulateActivation = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_LICENSE_ACTIVATION_SIMULATE).Trim().ToLowerInvariant()
  if ($simulateActivation) {
    $token = 'header.payload.signature'
    $savePath = Save-EvaluaProSecureLicenseToken -Token $token -TenantId $TenantId -RootDir $RootDir -Meta @{
      canalRelease = 'simulated'
      expiraEn = '2099-12-31T23:59:59.000Z'
      graciaOfflineDias = 30
      simulated = $true
    }
    return [pscustomobject]@{
      ok = $true
      securePath = $savePath
      expiraEn = '2099-12-31T23:59:59.000Z'
      canalRelease = 'simulated'
      simulated = $true
    }
  }

  $uri = ('{0}/api/comercial-publico/licencias/activar' -f $ApiBaseUrl.TrimEnd('/'))
  $payload = @{
    tenantId = $TenantId
    codigoActivacion = $CodigoActivacion
    huella = Get-EvaluaProMachineFingerprintHash
    host = [Environment]::MachineName
    versionInstalada = $VersionInstalada
  }
  $resp = Invoke-RestMethod -Uri $uri -Method POST -Body ($payload | ConvertTo-Json -Depth 6) -ContentType 'application/json'
  $token = [string]$resp.licencia.tokenLicencia
  if (-not $token -or $token.Split('.').Count -ne 3) {
    throw 'Respuesta de activacion invalida: token de licencia ausente.'
  }
  $savePath = Save-EvaluaProSecureLicenseToken -Token $token -TenantId $TenantId -RootDir $RootDir -Meta @{
    canalRelease = [string]$resp.licencia.canalRelease
    expiraEn = [string]$resp.licencia.expiraEn
    graciaOfflineDias = [int]$resp.licencia.graciaOfflineDias
  }
  return [pscustomobject]@{
    ok = $true
    securePath = $savePath
    expiraEn = [string]$resp.licencia.expiraEn
    canalRelease = [string]$resp.licencia.canalRelease
  }
}

function Initialize-EvaluaProPortableAdminLicense {
  param(
    [string]$RootDir = '',
    [string]$HolderName = 'I.S.C. Erick Renato Vega Ceron'
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $scriptPath = [string]$env:EVALUAPRO_PORTABLE_LICENSE_SCRIPT
  if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $scriptPath = Join-Path $repoRoot 'scripts\comercial\portable-license.mjs'
  }
  if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "No existe script de licencia portable: $scriptPath"
  }
  $outPath = Join-Path $root 'portable-license.epl'
  $json = & node $scriptPath init-admin --root $root --holder $HolderName --out $outPath
  if (-not $json) {
    throw 'No se pudo inicializar licencia portable.'
  }
  return ($json | ConvertFrom-Json)
}

function Test-EvaluaProPortableAdminLicense {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $scriptPath = [string]$env:EVALUAPRO_PORTABLE_LICENSE_SCRIPT
  if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $scriptPath = Join-Path $repoRoot 'scripts\comercial\portable-license.mjs'
  }
  $licensePath = Join-Path $root 'portable-license.epl'
  $publicKeysPath = Join-Path $root 'portable-license-public-keys.json'
  if (-not (Test-Path -LiteralPath $licensePath)) {
    return [pscustomobject]@{ ok = $false; state = 'missing'; path = $licensePath }
  }
  if (-not (Test-Path -LiteralPath $publicKeysPath)) {
    return [pscustomobject]@{ ok = $false; state = 'missing_keyring'; path = $publicKeysPath }
  }
  try {
    $json = & node $scriptPath verify --license $licensePath --public-keys $publicKeysPath
    return ($json | ConvertFrom-Json)
  } catch {
    return [pscustomobject]@{ ok = $false; state = 'invalid'; error = $_.Exception.Message; path = $licensePath }
  }
}

function Initialize-EvaluaProAdminStepUp {
  param(
    [string]$RootDir = '',
    [string]$HolderName = 'I.S.C. Erick Renato Vega Ceron'
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $configPath = Get-EvaluaProStepUpConfigPath -RootDir $root
  if (Test-Path -LiteralPath $configPath) {
    $status = Get-EvaluaProStepUpStatus -RootDir $root
    return [pscustomobject]@{
      ok = $true
      state = 'existing'
      configPath = $configPath
      methods = @($status.stepUpMethods)
      recoveryCodesRemaining = [int]$status.recoveryCodesRemaining
      holderName = $HolderName
    }
  }

  $fingerprint = Get-EvaluaProMachineFingerprintHash
  $entropy = [System.Text.Encoding]::UTF8.GetBytes($fingerprint)
  $secretBytes = New-RandomBytes -Length 20
  $secretBase32 = ConvertTo-Base32String -Bytes $secretBytes
  $secretCipher = Protect-DpapiBytes -Bytes $secretBytes -Entropy $entropy
  $createdAt = (Get-Date).ToString('o')
  $recoveryCodes = @()
  $recoveryEntries = @()
  for ($i = 0; $i -lt 8; $i++) {
    $code = New-EvaluaProRecoveryCode
    $recoveryCodes += $code
    $recoveryEntries += [ordered]@{
      hash = Get-Sha256Hex -Data $code
      usedAt = ''
    }
  }

  $payload = [ordered]@{
    version = 1
    createdAt = $createdAt
    methods = @('totp', 'recovery_code')
    sessionTtlMinutes = 30
    totp = [ordered]@{
      issuer = 'EvaluaPro'
      accountName = [string]$HolderName
      secretCiphertext = [Convert]::ToBase64String($secretCipher)
      secretPreview = if ($secretBase32.Length -ge 8) { '{0}...{1}' -f $secretBase32.Substring(0, 4), $secretBase32.Substring($secretBase32.Length - 4) } else { $secretBase32 }
      digits = 6
      period = 30
      algorithm = 'SHA1'
      lastRotatedAt = $createdAt
    }
    recovery = [ordered]@{
      codes = $recoveryEntries
      remaining = $recoveryEntries.Count
    }
  }

  Save-EvaluaProProtectedEnvelope -Path $configPath -Payload $payload -RootDir $root | Out-Null
  $otpauthUri = 'otpauth://totp/{0}?secret={1}&issuer={2}&algorithm=SHA1&digits=6&period=30' -f `
    [uri]::EscapeDataString("EvaluaPro:$HolderName"), `
    $secretBase32, `
    [uri]::EscapeDataString('EvaluaPro')
  return [pscustomobject]@{
    ok = $true
    state = 'created'
    configPath = $configPath
    methods = @('totp', 'recovery_code')
    holderName = $HolderName
    recoveryCodes = $recoveryCodes
    recoveryCodesRemaining = $recoveryEntries.Count
    otpauthUri = $otpauthUri
  }
}

function Get-EvaluaProStepUpStatus {
  param([string]$RootDir = '')
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $portable = Test-EvaluaProPortableAdminLicense -RootDir $root
  $configPath = Get-EvaluaProStepUpConfigPath -RootDir $root
  $sessionPath = Get-EvaluaProStepUpSessionPath -RootDir $root
  $config = $null
  $session = $null
  try { $config = Read-EvaluaProProtectedEnvelope -Path $configPath -RootDir $root } catch {}
  try { $session = Read-EvaluaProProtectedEnvelope -Path $sessionPath -RootDir $root } catch {}

  $now = Get-Date
  $active = $false
  if ($session -and $session.expiresAt) {
    try {
      $active = ([datetime]$session.expiresAt) -gt $now
    } catch {
      $active = $false
    }
  }
  $recoveryRemaining = 0
  if ($config -and $config.recovery -and $config.recovery.codes) {
    $recoveryRemaining = @($config.recovery.codes | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.hash) -and [string]::IsNullOrWhiteSpace([string]$_.usedAt) }).Count
  }
  $methods = @()
  if ($config -and $config.methods) {
    $methods = @($config.methods)
  }
  return [pscustomobject]@{
    ok = $true
    licenseValid = [bool]$portable.ok
    portableState = if ($null -ne $portable.PSObject.Properties['state']) { [string]$portable.state } else { if ([bool]$portable.ok) { 'valid' } else { 'unknown' } }
    configured = [bool]($null -ne $config)
    active = $active
    required = ([bool]$portable.ok -and -not $active)
    stepUpMethods = $methods
    recoveryCodesRemaining = $recoveryRemaining
    lastStepUpAt = if ($session) { [string]$session.lastStepUpAt } else { '' }
    expiresAt = if ($session) { [string]$session.expiresAt } else { '' }
    sessionMethod = if ($session) { [string]$session.method } else { '' }
    configPath = $configPath
    sessionPath = $sessionPath
  }
}

function Invoke-EvaluaProStepUp {
  param(
    [string]$RootDir = '',
    [string]$TotpCode = '',
    [string]$RecoveryCode = ''
  )
  $root = Get-EvaluaProLicenseSecurityRoot -RootDir $RootDir
  $configPath = Get-EvaluaProStepUpConfigPath -RootDir $root
  $sessionPath = Get-EvaluaProStepUpSessionPath -RootDir $root
  $config = Read-EvaluaProProtectedEnvelope -Path $configPath -RootDir $root
  if (-not $config) {
    throw 'No existe configuracion step-up.'
  }

  $method = ''
  if (-not [string]::IsNullOrWhiteSpace($TotpCode)) {
    if (-not (Test-EvaluaProTotpCode -RootDir $root -Code $TotpCode)) {
      throw 'Codigo TOTP invalido.'
    }
    $method = 'totp'
  } elseif (-not [string]::IsNullOrWhiteSpace($RecoveryCode)) {
    $hash = Get-Sha256Hex -Data ([string]$RecoveryCode).Trim().ToUpperInvariant()
    $matched = $false
    foreach ($item in @($config.recovery.codes)) {
      if ([string]$item.hash -eq $hash -and [string]::IsNullOrWhiteSpace([string]$item.usedAt)) {
        $item.usedAt = (Get-Date).ToString('o')
        $matched = $true
        break
      }
    }
    if (-not $matched) {
      throw 'Recovery code invalido o ya utilizado.'
    }
    $config.recovery.remaining = @($config.recovery.codes | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.usedAt) }).Count
    Save-EvaluaProProtectedEnvelope -Path $configPath -Payload ([hashtable]$config) -RootDir $root | Out-Null
    $method = 'recovery_code'
  } else {
    throw 'Se requiere TotpCode o RecoveryCode.'
  }

  $grantedAt = Get-Date
  $sessionTtlMinutes = 30
  if ($null -ne $config -and $config.PSObject.Properties['sessionTtlMinutes']) {
    $rawSessionTtl = [string]$config.sessionTtlMinutes
    if (-not [string]::IsNullOrWhiteSpace($rawSessionTtl)) {
      try {
        $sessionTtlMinutes = [double]$rawSessionTtl
      } catch {
        $sessionTtlMinutes = 30
      }
    }
  }
  $expiresAt = $grantedAt.AddMinutes($sessionTtlMinutes)
  $session = [ordered]@{
    version = 1
    grantedAt = $grantedAt.ToString('o')
    expiresAt = $expiresAt.ToString('o')
    lastStepUpAt = $grantedAt.ToString('o')
    method = $method
  }
  Save-EvaluaProProtectedEnvelope -Path $sessionPath -Payload $session -RootDir $root | Out-Null
  return (Get-EvaluaProStepUpStatus -RootDir $root)
}

Export-ModuleMember -Function @(
  'Get-EvaluaProMachineFingerprintHash',
  'Get-EvaluaProLicenseSecurityRoot',
  'Save-EvaluaProSecureLicenseToken',
  'Get-EvaluaProSecureLicenseToken',
  'Register-EvaluaProIntegrityBaseline',
  'Test-EvaluaProIntegrityBaseline',
  'Invoke-EvaluaProLicenseActivationSecure',
  'Initialize-EvaluaProPortableAdminLicense',
  'Test-EvaluaProPortableAdminLicense',
  'Initialize-EvaluaProAdminStepUp',
  'Get-EvaluaProStepUpStatus',
  'Invoke-EvaluaProStepUp',
  'Get-EvaluaProCurrentTotpCode'
)
