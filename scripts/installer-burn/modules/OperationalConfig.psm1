Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-InstallerHubBool {
  param([string]$Value)
  $raw = [string]$Value
  if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
  return @('1', 'true', 'yes', 'on') -contains $raw.Trim().ToLowerInvariant()
}

function New-GeneratedSecret {
  param([int]$Length = 48)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=')
  } finally {
    $rng.Dispose()
  }
}

function Get-InstallerHubConfigValue {
  param(
    [hashtable]$InputConfig,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [object]$DefaultValue = ''
  )

  if ($null -eq $InputConfig) {
    return $DefaultValue
  }

  if ($InputConfig.ContainsKey($Key)) {
    $value = $InputConfig[$Key]
    if ($null -ne $value) {
      return $value
    }
  }

  return $DefaultValue
}

function Normalize-OperationalConfig {
  param(
    [hashtable]$InputConfig
  )
  $cfg = [ordered]@{
    mongoUri = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'mongoUri' -DefaultValue 'mongodb://mongo_local:27017/evaluapro')
    jwtSecreto = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'jwtSecreto' -DefaultValue '')
    nodeEnv = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'nodeEnv' -DefaultValue 'production')
    puertoApi = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'puertoApi' -DefaultValue '4000')
    puertoPortal = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'puertoPortal' -DefaultValue '4518')
    corsOrigenes = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'corsOrigenes' -DefaultValue 'http://localhost:4173,http://127.0.0.1:4173')
    portalAlumnoUrl = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'portalAlumnoUrl' -DefaultValue '')
    portalAlumnoApiKey = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'portalAlumnoApiKey' -DefaultValue '')
    portalApiKey = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'portalApiKey' -DefaultValue '')
    passwordResetEnabled = ConvertTo-InstallerHubBool -Value ([string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'passwordResetEnabled' -DefaultValue '0'))
    passwordResetTokenMinutes = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'passwordResetTokenMinutes' -DefaultValue '30')
    passwordResetUrlBase = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'passwordResetUrlBase' -DefaultValue '')
    googleOauthClientId = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'googleOauthClientId' -DefaultValue '')
    googleClassroomClientId = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'googleClassroomClientId' -DefaultValue '')
    googleClassroomClientSecret = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'googleClassroomClientSecret' -DefaultValue '')
    googleClassroomRedirectUri = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'googleClassroomRedirectUri' -DefaultValue '')
    requireGoogleOAuth = ConvertTo-InstallerHubBool -Value ([string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'requireGoogleOAuth' -DefaultValue '0'))
    correoModuloActivo = ConvertTo-InstallerHubBool -Value ([string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'correoModuloActivo' -DefaultValue '0'))
    notificacionesWebhookUrl = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'notificacionesWebhookUrl' -DefaultValue '')
    notificacionesWebhookToken = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'notificacionesWebhookToken' -DefaultValue '')
    requireLicenseActivation = ConvertTo-InstallerHubBool -Value ([string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'requireLicenseActivation' -DefaultValue '0'))
    apiComercialBaseUrl = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'apiComercialBaseUrl' -DefaultValue '')
    tenantId = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'tenantId' -DefaultValue '')
    codigoActivacion = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'codigoActivacion' -DefaultValue '')
    licenciaAccountEmail = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'licenciaAccountEmail' -DefaultValue 'soporte@tu-institucion.mx')
    flavorId = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'flavorId' -DefaultValue 'docente-local')
    updateChannel = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateChannel' -DefaultValue 'stable')
    updateOwner = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateOwner' -DefaultValue 'Dtcsrni')
    updateRepo = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateRepo' -DefaultValue 'EvaluaPro_Sistema_Universitario')
    updateAssetName = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateAssetName' -DefaultValue 'EvaluaPro-InstallerHub-docente-local.exe')
    updateShaAssetName = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateShaAssetName' -DefaultValue 'EvaluaPro-InstallerHub-docente-local.exe.sha256')
    updateFeedUrl = [string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateFeedUrl' -DefaultValue '')
    updateRequireSha256 = ConvertTo-InstallerHubBool -Value ([string](Get-InstallerHubConfigValue -InputConfig $InputConfig -Key 'updateRequireSha256' -DefaultValue '1'))
  }
  if ([string]::IsNullOrWhiteSpace($cfg.jwtSecreto)) {
    $cfg.jwtSecreto = New-GeneratedSecret
  }
  $cfg.flavorId = $cfg.flavorId.Trim().ToLowerInvariant()
  $cfg['deferPortalIntegration'] = ([string]$cfg.flavorId -eq 'docente-local' -and [string]::IsNullOrWhiteSpace($cfg.portalAlumnoUrl))
  if ([string]::IsNullOrWhiteSpace($cfg.portalAlumnoApiKey) -and -not [string]::IsNullOrWhiteSpace($cfg.portalApiKey)) {
    $cfg.portalAlumnoApiKey = $cfg.portalApiKey
  } elseif ([string]::IsNullOrWhiteSpace($cfg.portalApiKey) -and -not [string]::IsNullOrWhiteSpace($cfg.portalAlumnoApiKey)) {
    $cfg.portalApiKey = $cfg.portalAlumnoApiKey
  } elseif ([string]::IsNullOrWhiteSpace($cfg.portalApiKey) -and [string]::IsNullOrWhiteSpace($cfg.portalAlumnoApiKey)) {
    $sharedPortalKey = New-GeneratedSecret -Length 36
    $cfg.portalApiKey = $sharedPortalKey
    $cfg.portalAlumnoApiKey = $sharedPortalKey
  }
  return $cfg
}

function Test-OperationalConfig {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [hashtable]$Config
  )
  if ($Mode -eq 'uninstall') {
    return [pscustomobject]@{ ok = $true; errors = @() }
  }

  $errors = @()
  $envAllowed = @('development', 'test', 'production')
  if (-not ($envAllowed -contains [string]$Config.nodeEnv)) {
    $errors += "nodeEnv invalido: '$($Config.nodeEnv)'. Valores permitidos: development|test|production."
  }
  foreach ($portSpec in @(
    @{ key = 'puertoApi'; min = 1; max = 65535 },
    @{ key = 'puertoPortal'; min = 1; max = 65535 }
  )) {
    $raw = [string]$Config[$portSpec.key]
    $n = 0
    if (-not [int]::TryParse($raw, [ref]$n) -or $n -lt $portSpec.min -or $n -gt $portSpec.max) {
      $errors += "Puerto invalido para $($portSpec.key): '$raw'"
    }
  }

  $requiredKeys = @('mongoUri', 'jwtSecreto', 'corsOrigenes')
  if (-not $Config.deferPortalIntegration) {
    $requiredKeys += @('portalAlumnoUrl', 'portalAlumnoApiKey', 'portalApiKey')
  }
  foreach ($key in $requiredKeys) {
    if ([string]::IsNullOrWhiteSpace([string]$Config[$key])) {
      $errors += "Falta configuracion operativa obligatoria: $key"
    }
  }

  if ([string]$Config.corsOrigenes -match '^\s*\*\s*$') {
    $errors += 'CORS no puede ser "*" para operacion productiva.'
  }

  if ($Config.correoModuloActivo) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.notificacionesWebhookUrl)) {
      $errors += 'Correo activo requiere notificacionesWebhookUrl.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.notificacionesWebhookToken)) {
      $errors += 'Correo activo requiere notificacionesWebhookToken.'
    }
  }

  if ($Config.requireGoogleOAuth) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleOauthClientId)) {
      $errors += 'Google OAuth requerido: falta googleOauthClientId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomClientId)) {
      $errors += 'Google OAuth requerido: falta googleClassroomClientId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomClientSecret)) {
      $errors += 'Google OAuth requerido: falta googleClassroomClientSecret.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.googleClassroomRedirectUri)) {
      $errors += 'Google OAuth requerido: falta googleClassroomRedirectUri.'
    }
  }

  if ($Config.passwordResetEnabled) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.passwordResetUrlBase)) {
      $errors += 'Recuperacion de contrasena activa: falta passwordResetUrlBase.'
    }
  }

  if ($Config.requireLicenseActivation) {
    if ([string]::IsNullOrWhiteSpace([string]$Config.apiComercialBaseUrl)) {
      $errors += 'Activacion de licencia requerida: falta apiComercialBaseUrl.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.tenantId)) {
      $errors += 'Activacion de licencia requerida: falta tenantId.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.codigoActivacion)) {
      $errors += 'Activacion de licencia requerida: falta codigoActivacion.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$Config.licenciaAccountEmail)) {
      $errors += 'Activacion de licencia requerida: falta licenciaAccountEmail (correo del titular).'
    } elseif ([string]$Config.licenciaAccountEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
      $errors += 'Activacion de licencia requerida: licenciaAccountEmail no es valido.'
    }
  }

  if ([string]::IsNullOrWhiteSpace([string]$Config.updateChannel)) {
    $errors += 'Falta updateChannel para actualizaciones automaticas.'
  }
  if ([string]::IsNullOrWhiteSpace([string]$Config.flavorId)) {
    $errors += 'Falta flavorId para actualizaciones automaticas.'
  }
  if ([string]::IsNullOrWhiteSpace([string]$Config.updateOwner)) {
    $errors += 'Falta updateOwner para actualizaciones automaticas.'
  }
  if ([string]::IsNullOrWhiteSpace([string]$Config.updateRepo)) {
    $errors += 'Falta updateRepo para actualizaciones automaticas.'
  }

  return [pscustomobject]@{
    ok = ($errors.Count -eq 0)
    errors = $errors
  }
}

function Set-OrReplaceEnvLine {
  param(
    [hashtable]$Map,
    [string]$Key,
    [string]$Value
  )
  $Map[$Key] = [string]$Value
}

function Read-EnvMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $lines = Get-Content -Path $Path -Encoding utf8
  foreach ($line in $lines) {
    $trim = [string]$line
    if ([string]::IsNullOrWhiteSpace($trim)) { continue }
    if ($trim.TrimStart().StartsWith('#')) { continue }
    $idx = $trim.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $trim.Substring(0, $idx).Trim()
    $value = $trim.Substring($idx + 1)
    $map[$key] = $value
  }
  return $map
}

function Write-EnvMap {
  param(
    [string]$Path,
    [hashtable]$Map
  )
  $keys = @($Map.Keys) | Sort-Object
  $content = @()
  foreach ($k in $keys) {
    $content += ('{0}={1}' -f $k, [string]$Map[$k])
  }
  [IO.File]::WriteAllText($Path, ($content -join [Environment]::NewLine) + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
}

function Read-JsonMap {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @{} }
  try {
    $raw = Get-Content -Path $Path -Encoding utf8 -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
    $parsed = $raw | ConvertFrom-Json
    if ($null -eq $parsed) { return @{} }
    return $parsed
  } catch {
    return @{}
  }
}

function Write-JsonFile {
  param(
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [object]$Data
  )
  $json = $Data | ConvertTo-Json -Depth 12
  [IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
}

function Invoke-EvaluaProOperationalConfiguration {
  param(
    [ValidateSet('install', 'repair', 'uninstall')]
    [string]$Mode,
    [Parameter(Mandatory = $true)]
    [string]$InstallDir,
    [Parameter(Mandatory = $true)]
    [hashtable]$Config,
    [scriptblock]$OnLog
  )
  $normalized = Normalize-OperationalConfig -InputConfig $Config
  $validation = Test-OperationalConfig -Mode $Mode -Config $normalized
  if (-not $validation.ok) {
    $joined = ($validation.errors -join ' | ')
    throw "Configuracion operativa invalida: $joined"
  }
  if ($Mode -eq 'uninstall') {
    if ($OnLog) { & $OnLog 'info' 'Configuracion operativa omitida en desinstalacion.' }
    return [pscustomobject]@{ ok = $true; envPath = ''; profilePath = '' }
  }

  if (-not (Test-Path $InstallDir)) {
    throw "No existe carpeta de instalacion para escribir .env: $InstallDir"
  }

  $envPath = Join-Path $InstallDir '.env'
  $envMap = Read-EnvMap -Path $envPath
  Set-OrReplaceEnvLine -Map $envMap -Key 'MONGODB_URI' -Value $normalized.mongoUri
  Set-OrReplaceEnvLine -Map $envMap -Key 'JWT_SECRETO' -Value $normalized.jwtSecreto
  Set-OrReplaceEnvLine -Map $envMap -Key 'NODE_ENV' -Value $normalized.nodeEnv
  Set-OrReplaceEnvLine -Map $envMap -Key 'PUERTO_API' -Value $normalized.puertoApi
  Set-OrReplaceEnvLine -Map $envMap -Key 'PUERTO_PORTAL' -Value $normalized.puertoPortal
  Set-OrReplaceEnvLine -Map $envMap -Key 'CORS_ORIGENES' -Value $normalized.corsOrigenes
  Set-OrReplaceEnvLine -Map $envMap -Key 'EVALUAPRO_FLAVOR' -Value $normalized.flavorId
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_SYNC_REQUIRED' -Value ($(if ($normalized.deferPortalIntegration) { '0' } else { '1' }))
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_ALUMNO_URL' -Value $normalized.portalAlumnoUrl
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_ALUMNO_API_KEY' -Value $normalized.portalAlumnoApiKey
  Set-OrReplaceEnvLine -Map $envMap -Key 'PORTAL_API_KEY' -Value $normalized.portalApiKey
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_ENABLED' -Value ($(if ($normalized.passwordResetEnabled) { '1' } else { '0' }))
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_TOKEN_MINUTES' -Value $normalized.passwordResetTokenMinutes
  Set-OrReplaceEnvLine -Map $envMap -Key 'PASSWORD_RESET_URL_BASE' -Value $normalized.passwordResetUrlBase
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_OAUTH_CLIENT_ID' -Value $normalized.googleOauthClientId
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_CLIENT_ID' -Value $normalized.googleClassroomClientId
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_CLIENT_SECRET' -Value $normalized.googleClassroomClientSecret
  Set-OrReplaceEnvLine -Map $envMap -Key 'GOOGLE_CLASSROOM_REDIRECT_URI' -Value $normalized.googleClassroomRedirectUri
  Set-OrReplaceEnvLine -Map $envMap -Key 'REQUIRE_GOOGLE_OAUTH' -Value ($(if ($normalized.requireGoogleOAuth) { '1' } else { '0' }))
  Set-OrReplaceEnvLine -Map $envMap -Key 'LICENCIA_ACCOUNT_EMAIL' -Value $normalized.licenciaAccountEmail
  Set-OrReplaceEnvLine -Map $envMap -Key 'CORREO_MODULO_ACTIVO' -Value ($(if ($normalized.correoModuloActivo) { '1' } else { '0' }))

  if ($normalized.correoModuloActivo) {
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_URL' -Value $normalized.notificacionesWebhookUrl
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_TOKEN' -Value $normalized.notificacionesWebhookToken
  } else {
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_URL' -Value ''
    Set-OrReplaceEnvLine -Map $envMap -Key 'NOTIFICACIONES_WEBHOOK_TOKEN' -Value ''
  }

  Write-EnvMap -Path $envPath -Map $envMap

  $updateConfigPath = Join-Path $InstallDir 'config\update-config.json'
  $updateConfigDir = Split-Path -Parent $updateConfigPath
  if (-not [string]::IsNullOrWhiteSpace($updateConfigDir)) {
    New-Item -ItemType Directory -Force -Path $updateConfigDir | Out-Null
  }
  $updateCfg = Read-JsonMap -Path $updateConfigPath
  if ($updateCfg -isnot [hashtable] -and $updateCfg -isnot [pscustomobject]) {
    $updateCfg = @{}
  }
  $syncPreflight = $null
  try { $syncPreflight = $updateCfg.syncPreflight } catch { $syncPreflight = $null }
  if ($null -eq $syncPreflight) {
    $syncPreflight = [ordered]@{
      enabled = $true
      baseUrl = 'http://127.0.0.1:4000/api/sincronizaciones'
      tokenEnv = 'EVALUAPRO_SYNC_BEARER'
      exportPayload = @{}
      pushPayload = @{}
      pullPayload = @{}
    }
  }

  $newUpdateCfg = [ordered]@{
    owner = $normalized.updateOwner
    repo = $normalized.updateRepo
    flavorId = $normalized.flavorId
    channel = $normalized.updateChannel
    assetName = $normalized.updateAssetName
    sha256AssetName = $normalized.updateShaAssetName
    requireSha256 = [bool]$normalized.updateRequireSha256
    checkIntervalMs = 900000
    syncPreflight = $syncPreflight
  }
  if (-not [string]::IsNullOrWhiteSpace($normalized.updateFeedUrl)) {
    $newUpdateCfg.feedUrl = $normalized.updateFeedUrl
  }
  Write-JsonFile -Path $updateConfigPath -Data $newUpdateCfg

  $programDataRoot = Join-Path $env:ProgramData 'EvaluaPro\installer-hub'
  if (-not (Test-Path $programDataRoot)) {
    New-Item -ItemType Directory -Path $programDataRoot -Force | Out-Null
  }
  $profilePath = Join-Path $programDataRoot 'operational-config.last.json'
  $profile = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    mode = $Mode
    installDir = $InstallDir
    config = [ordered]@{
      mongoUri = $normalized.mongoUri
      jwtSecretoSet = -not [string]::IsNullOrWhiteSpace($normalized.jwtSecreto)
      corsOrigenes = $normalized.corsOrigenes
      portalAlumnoUrl = $normalized.portalAlumnoUrl
      portalIntegrationDeferred = [bool]$normalized.deferPortalIntegration
      portalAlumnoApiKeySet = -not [string]::IsNullOrWhiteSpace($normalized.portalAlumnoApiKey)
      portalApiKeySet = -not [string]::IsNullOrWhiteSpace($normalized.portalApiKey)
      passwordResetEnabled = [bool]$normalized.passwordResetEnabled
      passwordResetTokenMinutes = $normalized.passwordResetTokenMinutes
      passwordResetUrlBase = $normalized.passwordResetUrlBase
      googleOauthClientIdSet = -not [string]::IsNullOrWhiteSpace($normalized.googleOauthClientId)
      googleClassroomClientIdSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomClientId)
      googleClassroomClientSecretSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomClientSecret)
      googleClassroomRedirectUriSet = -not [string]::IsNullOrWhiteSpace($normalized.googleClassroomRedirectUri)
      requireGoogleOAuth = [bool]$normalized.requireGoogleOAuth
      correoModuloActivo = [bool]$normalized.correoModuloActivo
      notificacionesWebhookUrl = $normalized.notificacionesWebhookUrl
      notificacionesWebhookTokenSet = -not [string]::IsNullOrWhiteSpace($normalized.notificacionesWebhookToken)
      requireLicenseActivation = [bool]$normalized.requireLicenseActivation
      apiComercialBaseUrl = $normalized.apiComercialBaseUrl
      tenantId = $normalized.tenantId
      codigoActivacionSet = -not [string]::IsNullOrWhiteSpace($normalized.codigoActivacion)
      licenciaAccountEmail = $normalized.licenciaAccountEmail
      flavorId = $normalized.flavorId
      nodeEnv = $normalized.nodeEnv
      puertoApi = $normalized.puertoApi
      puertoPortal = $normalized.puertoPortal
      updateChannel = $normalized.updateChannel
      updateOwner = $normalized.updateOwner
      updateRepo = $normalized.updateRepo
      updateAssetName = $normalized.updateAssetName
      updateShaAssetName = $normalized.updateShaAssetName
      updateFeedUrl = $normalized.updateFeedUrl
      updateRequireSha256 = [bool]$normalized.updateRequireSha256
    }
  }
  [IO.File]::WriteAllText($profilePath, ($profile | ConvertTo-Json -Depth 8), [System.Text.Encoding]::UTF8)

  if ($OnLog) {
    & $OnLog 'ok' "Configuracion operativa aplicada en .env: $envPath"
    & $OnLog 'info' "Perfil operativo persistido: $profilePath"
  }

  return [pscustomobject]@{
    ok = $true
    envPath = $envPath
    profilePath = $profilePath
  }
}

Export-ModuleMember -Function @(
  'Invoke-EvaluaProOperationalConfiguration',
  'Normalize-OperationalConfig',
  'Test-OperationalConfig'
)
