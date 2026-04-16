Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-NodeMajorVersion {
  param([string]$VersionText)

  if ([string]::IsNullOrWhiteSpace($VersionText)) {
    return 0
  }

  try {
    $clean = [string]$VersionText
    $clean = $clean.Trim().TrimStart('v', 'V')
    if ($clean -match '^(?<major>\d+)') {
      $major = [int]$Matches['major']
      if ($major -ge 0) {
        return $major
      }
    }
    return 0
  } catch {
    return 0
  }
}

function Get-NodeMajorVersionFromExecutable {
  param([string]$ExecutablePath)

  if ([string]::IsNullOrWhiteSpace($ExecutablePath) -or -not (Test-Path -LiteralPath $ExecutablePath)) {
    return 0
  }

  try {
    $raw = (& $ExecutablePath -v 2>$null | Select-Object -First 1)
    return (ConvertTo-NodeMajorVersion -VersionText ([string]$raw))
  } catch {
    return 0
  }
}

function Get-NodeMajorVersionFromRegistry {
  $majors = @()

  $nodeKeys = @(
    'HKLM:\SOFTWARE\\Node.js',
    'HKLM:\SOFTWARE\\WOW6432Node\\Node.js',
    'HKCU:\SOFTWARE\\Node.js'
  )

  foreach ($key in $nodeKeys) {
    if (-not (Test-Path -LiteralPath $key)) {
      continue
    }

    try {
      $props = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
      if ($null -eq $props) {
        continue
      }

      $versionProp = $props.PSObject.Properties['Version']
      if ($versionProp -and -not [string]::IsNullOrWhiteSpace([string]$versionProp.Value)) {
        $majorFromVersion = ConvertTo-NodeMajorVersion -VersionText ([string]$versionProp.Value)
        if ($majorFromVersion -gt 0) {
          $majors += $majorFromVersion
        }
      }

      $installPathProp = $props.PSObject.Properties['InstallPath']
      if ($installPathProp -and -not [string]::IsNullOrWhiteSpace([string]$installPathProp.Value)) {
        $nodeExe = Join-Path ([string]$installPathProp.Value) 'node.exe'
        $majorFromExe = Get-NodeMajorVersionFromExecutable -ExecutablePath $nodeExe
        if ($majorFromExe -gt 0) {
          $majors += $majorFromExe
        }
      }
    } catch {
      continue
    }
  }

  $uninstallRoots = @(
    'HKLM:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )

  foreach ($root in $uninstallRoots) {
    try {
      $items = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
        Where-Object {
          $_.PSObject.Properties.Match('DisplayName').Count -gt 0 -and
          [string]$_.DisplayName -like 'Node.js*'
        }

      foreach ($item in $items) {
        $displayVersion = ''
        $displayVersionProp = $item.PSObject.Properties['DisplayVersion']
        if ($displayVersionProp) {
          $displayVersion = [string]$displayVersionProp.Value
        }

        $majorFromDisplayVersion = ConvertTo-NodeMajorVersion -VersionText $displayVersion
        if ($majorFromDisplayVersion -gt 0) {
          $majors += $majorFromDisplayVersion
        }

        $installLocation = ''
        $installLocationProp = $item.PSObject.Properties['InstallLocation']
        if ($installLocationProp) {
          $installLocation = [string]$installLocationProp.Value
        }
        if (-not [string]::IsNullOrWhiteSpace($installLocation)) {
          $nodeExe = Join-Path $installLocation 'node.exe'
          $majorFromExe = Get-NodeMajorVersionFromExecutable -ExecutablePath $nodeExe
          if ($majorFromExe -gt 0) {
            $majors += $majorFromExe
          }
        }
      }
    } catch {
      continue
    }
  }

  if (@($majors).Count -eq 0) {
    return 0
  }

  return [int]((@($majors) | Measure-Object -Maximum).Maximum)
}

function Get-NodeMajorVersion {
  $simulated = [string]$env:EVALUAPRO_INSTALLER_SIMULATE_NODE_MAJOR
  if (-not [string]::IsNullOrWhiteSpace($simulated)) {
    try {
      $simulatedMajor = [int]$simulated.Trim()
      if ($simulatedMajor -gt 0) {
        return $simulatedMajor
      }
    } catch {}
  }

  $majors = @()

  try {
    $raw = (& node -v 2>$null | Select-Object -First 1)
    $majorFromPath = ConvertTo-NodeMajorVersion -VersionText ([string]$raw)
    if ($majorFromPath -gt 0) {
      $majors += $majorFromPath
    }
  } catch {
    # Continua con fallback por ruta y registro para evitar falsos negativos por PATH.
  }

  $commonPaths = @(
    (Join-Path ([string]$env:ProgramFiles) 'nodejs\node.exe'),
    (Join-Path ([string]${env:ProgramFiles(x86)}) 'nodejs\\node.exe'),
    (Join-Path ([string]$env:LOCALAPPDATA) 'Programs\nodejs\node.exe')
  )

  foreach ($candidate in $commonPaths) {
    $majorFromExe = Get-NodeMajorVersionFromExecutable -ExecutablePath $candidate
    if ($majorFromExe -gt 0) {
      $majors += $majorFromExe
    }
  }

  $majorFromRegistry = Get-NodeMajorVersionFromRegistry
  if ($majorFromRegistry -gt 0) {
    $majors += $majorFromRegistry
  }

  if (@($majors).Count -eq 0) {
    return 0
  }

  return [int]((@($majors) | Measure-Object -Maximum).Maximum)
}

function Get-SimulatedWslNodeMajorVersion {
  $raw = [string]$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_MAJOR
  if ([string]::IsNullOrWhiteSpace($raw)) { return 0 }
  try {
    $major = [int]$raw.Trim()
    if ($major -lt 0) { return 0 }
    return $major
  } catch {
    return 0
  }
}

function Get-DockerRuntimePreference {
  $allowed = @('auto', 'wsl2-engine', 'desktop')
  $raw = [string]$env:EVALUAPRO_DOCKER_RUNTIME
  if ([string]::IsNullOrWhiteSpace($raw)) { return 'auto' }
  $normalized = $raw.Trim().ToLowerInvariant()
  if ($allowed -contains $normalized) { return $normalized }
  return 'auto'
}

function Get-SimulatedDockerRuntimeStatus {
  $raw = [string]$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }

  $mode = $raw.Trim().ToLowerInvariant()
  switch ($mode) {
    'desktop' {
      return [pscustomobject]@{
        preference = 'auto'
        mode = 'desktop'
        installed = $true
        ready = $true
        desktopInstalled = $true
        clientVersion = '29.2.1'
        serverVersion = '29.2.1'
        context = 'desktop-linux'
        wslAvailable = $true
        wslStatus = 'Distribucion predeterminada: docker-desktop'
        wslTable = '* docker-desktop Running 2'
        defaultDistro = 'docker-desktop'
        userDistros = @()
        wslDockerDistros = @()
        reason = 'ok (desktop)'
        manualActions = @()
      }
    }
    'wsl2-engine' {
      return [pscustomobject]@{
        preference = 'wsl2-engine'
        mode = 'wsl2-engine'
        installed = $true
        ready = $true
        desktopInstalled = $false
        clientVersion = '29.2.1'
        serverVersion = '29.2.1'
        context = 'default'
        wslAvailable = $true
        wslStatus = 'Distribucion predeterminada: Ubuntu'
        wslTable = '* Ubuntu Running 2'
        defaultDistro = 'Ubuntu'
        userDistros = @('Ubuntu')
        wslDockerDistros = @('Ubuntu')
        reason = 'ok (wsl2-engine)'
        manualActions = @()
      }
    }
    'wsl2-engine-daemon-down' {
      return [pscustomobject]@{
        preference = 'wsl2-engine'
        mode = 'wsl2-engine'
        installed = $true
        ready = $false
        desktopInstalled = $false
        clientVersion = '29.2.1'
        serverVersion = ''
        context = 'default'
        wslAvailable = $true
        wslStatus = 'Distribucion predeterminada: Ubuntu'
        wslTable = '* Ubuntu Running 2'
        defaultDistro = 'Ubuntu'
        userDistros = @('Ubuntu')
        wslDockerDistros = @('Ubuntu')
        reason = 'WSL2 con Docker Engine detectado, pero el daemon no responde desde el host actual.'
        manualActions = @(
          'Abre la distro WSL2 soportada y valida el daemon con `docker version`.',
          'Si necesitas compatibilidad inmediata en Windows, puedes usar Docker Desktop de forma opcional.'
        )
      }
    }
    'wsl2-bootstrap-required' {
      return [pscustomobject]@{
        preference = 'wsl2-engine'
        mode = 'wsl2-bootstrap-required'
        installed = $false
        ready = $false
        desktopInstalled = $false
        clientVersion = ''
        serverVersion = ''
        context = ''
        wslAvailable = $true
        wslStatus = 'Distribucion predeterminada: Ubuntu'
        wslTable = '* Ubuntu Stopped 2'
        defaultDistro = 'Ubuntu'
        userDistros = @('Ubuntu')
        wslDockerDistros = @()
        reason = 'WSL2 detectado sin Docker Engine provisionado en una distro de usuario.'
        manualActions = @(
          'Provisiona Docker Engine dentro de `wsl -d Ubuntu` y habilita el servicio Docker.',
          'Compatibilidad opcional: instala Docker Desktop si prefieres ese runtime.'
        )
      }
    }
    'missing' {
      return [pscustomobject]@{
        preference = 'auto'
        mode = 'missing'
        installed = $false
        ready = $false
        desktopInstalled = $false
        clientVersion = ''
        serverVersion = ''
        context = ''
        wslAvailable = $false
        wslStatus = ''
        wslTable = ''
        defaultDistro = ''
        userDistros = @()
        wslDockerDistros = @()
        reason = 'No se detecto WSL2 ni Docker Desktop.'
        manualActions = @(
          'Habilita WSL2 con `wsl --install -d Ubuntu` y provisiona Docker Engine dentro de la distro.',
          'Compatibilidad opcional: instala Docker Desktop si prefieres ese runtime.'
        )
      }
    }
    default {
      return $null
    }
  }
}

function Test-DockerDesktopInstalled {
  $registryPaths = @(
    'HKLM:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop',
    'HKCU:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Docker Desktop'
  )

  foreach ($path in $registryPaths) {
    if (Test-Path $path) {
      return $true
    }
  }

  try {
    $ctx = (& docker context show 2>$null | Select-Object -First 1)
    if ([string]$ctx -eq 'desktop-linux') { return $true }
  } catch {}

  return $false
}

function Get-DockerClientVersion {
  try {
    $value = (& docker version --format '{{.Client.Version}}' 2>$null | Select-Object -First 1)
    if ($null -eq $value) { return '' }
    return [string]$value
  } catch {
    return ''
  }
}

function Get-DockerServerVersion {
  try {
    $value = (& docker version --format '{{.Server.Version}}' 2>$null | Select-Object -First 1)
    if ($null -eq $value) { return '' }
    return [string]$value
  } catch {
    return ''
  }
}

function Get-DockerContextName {
  try {
    $value = (& docker context show 2>$null | Select-Object -First 1)
    if ($null -eq $value) { return '' }
    return [string]$value
  } catch {
    return ''
  }
}

function Test-WslAvailable {
  try {
    $cmd = Get-Command wsl.exe -ErrorAction Stop
    return [bool]$cmd
  } catch {
    return $false
  }
}

function Get-WslStatusText {
  if (-not (Test-WslAvailable)) { return '' }
  try {
    $raw = (& wsl.exe --status 2>$null | Out-String)
    return ([string]$raw).Replace([string][char]0, '').Trim()
  } catch {
    return ''
  }
}

function Get-WslDistroTable {
  if (-not (Test-WslAvailable)) { return '' }
  try {
    $raw = (& wsl.exe -l -v 2>$null | Out-String)
    return ([string]$raw).Replace([string][char]0, '').Trim()
  } catch {
    return ''
  }
}

function Get-WslDistroNamesQuiet {
  if (-not (Test-WslAvailable)) { return @() }

  try {
    $raw = (& wsl.exe -l -q 2>$null | Out-String)
    $names = @()
    foreach ($line in ($raw -split "`r?`n")) {
      $clean = [string]$line
      $clean = $clean.Replace([string][char]0, '').Trim()
      if (-not $clean) { continue }
      if ($clean -in @('docker-desktop', 'docker-desktop-data')) { continue }
      $names += $clean
    }
    return @($names | Select-Object -Unique)
  } catch {
    return @()
  }
}

function Get-DefaultWslDistroName {
  $status = Get-WslStatusText
  if ($status -match '(?im)^\s*(Distribuci[oó]n predeterminada|Default Distribution)\s*:\s*(.+?)\s*$') {
    return [string]$Matches[2].Trim()
  }

  $table = Get-WslDistroTable
  foreach ($line in ($table -split "`r?`n")) {
    $clean = [string]$line
    $clean = $clean.Replace([string][char]0, '').TrimEnd()
    if ($clean.StartsWith('*')) {
      $normalized = $clean.TrimStart('*').Trim()
      if ($normalized -match '^(?<name>.+?)\s{2,}.+\s+\d+\s*$') {
        return [string]$Matches['name'].Trim()
      }
    }
  }

  return ''
}

function Get-PreferredWslBootstrapDistro {
  $defaultDistro = Get-DefaultWslDistroName
  if ($defaultDistro -and $defaultDistro -notin @('docker-desktop', 'docker-desktop-data')) {
    return [string]$defaultDistro
  }

  $userDistros = @(Get-UserWslDistros)
  if ($userDistros.Count -gt 0) {
    return [string]$userDistros[0]
  }

  $envDistro = [string]$env:EVALUAPRO_INSTALLER_WSL_DISTRO
  if (-not [string]::IsNullOrWhiteSpace($envDistro)) {
    return $envDistro.Trim()
  }

  return 'Ubuntu'
}

function Get-UserWslDistros {
  $quietNames = @(Get-WslDistroNamesQuiet)
  if ($quietNames.Count -gt 0) {
    return $quietNames
  }

  $table = Get-WslDistroTable
  $distros = @()

  foreach ($line in ($table -split "`r?`n")) {
    $clean = [string]$line
    $clean = $clean.Replace([string][char]0, '').Trim()
    if (-not $clean) { continue }
    if ($clean -match '^(NAME|NOMBRE)\s+(STATE|ESTADO)\s+(VERSION|VERSI[OÓ]N)\s*$') { continue }
    $normalized = $clean.TrimStart('*').Trim()
    if ($normalized -match '^(?<name>.+?)\s{2,}.+\s+\d+\s*$') {
      $name = [string]$Matches['name'].Trim()
      if ($name -in @('docker-desktop', 'docker-desktop-data')) { continue }
      $distros += $name
    }
  }

  return @($distros | Select-Object -Unique)
}

function Invoke-WslShellCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Distro,
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  if (-not (Test-WslAvailable)) { return '' }

  try {
    $output = (& wsl.exe -d $Distro -- sh -lc $Command 2>$null | Out-String)
    return ([string]$output).Replace([string][char]0, '').Trim()
  } catch {
    return ''
  }
}

function Get-WslNodeMajorVersion {
  $simulated = Get-SimulatedWslNodeMajorVersion
  if ($simulated -gt 0) {
    return $simulated
  }

  $distro = Get-PreferredWslBootstrapDistro
  if ([string]::IsNullOrWhiteSpace($distro)) { return 0 }

  $raw = Invoke-WslShellCommand -Distro $distro -Command 'node -v'
  if (-not $raw) { return 0 }

  try {
    $clean = [string]$raw
    $clean = $clean.Trim().TrimStart('v', 'V')
    $major = [int]($clean.Split('.')[0])
    if ($major -lt 0) { return 0 }
    return $major
  } catch {
    return 0
  }
}

function Get-WslDockerRuntimeDistros {
  $result = @()
  foreach ($distro in (Get-UserWslDistros)) {
    $probe = Invoke-WslShellCommand -Distro $distro -Command 'command -v docker >/dev/null 2>&1 && echo docker-ok'
    if ([string]$probe -eq 'docker-ok') {
      $result += $distro
    }
  }
  return @($result | Select-Object -Unique)
}

function Test-WslDockerDaemonReady {
  param(
    [string[]]$Distros
  )

  $checked = if ($Distros) { @($Distros) } else { @(Get-WslDockerRuntimeDistros) }
  foreach ($distro in $checked) {
    $probe = Invoke-WslShellCommand -Distro $distro -Command 'docker version --format "{{.Server.Version}}" 2>/dev/null'
    if (-not [string]::IsNullOrWhiteSpace($probe)) {
      return [pscustomobject]@{
        ready = $true
        distro = [string]$distro
        serverVersion = [string]$probe
      }
    }
  }

  return [pscustomobject]@{
    ready = $false
    distro = ''
    serverVersion = ''
  }
}

function Test-WslDockerRuntimeInstalled {
  return ((@(Get-WslDockerRuntimeDistros)).Count -gt 0)
}

function Get-DockerRuntimeStatus {
  $simulated = Get-SimulatedDockerRuntimeStatus
  if ($null -ne $simulated) {
    return $simulated
  }

  $preference = Get-DockerRuntimePreference
  $clientVersion = Get-DockerClientVersion
  $serverVersion = Get-DockerServerVersion
  $context = Get-DockerContextName
  $desktopInstalled = Test-DockerDesktopInstalled
  $wslAvailable = Test-WslAvailable
  $wslStatus = if ($wslAvailable) { Get-WslStatusText } else { '' }
  $wslTable = if ($wslAvailable) { Get-WslDistroTable } else { '' }
  $defaultDistro = if ($wslAvailable) { Get-DefaultWslDistroName } else { '' }
  $userDistros = if ($wslAvailable) { @(Get-UserWslDistros) } else { @() }
  $wslDockerDistros = if ($wslAvailable) { @(Get-WslDockerRuntimeDistros) } else { @() }
  $wslDockerInstalled = ((@($wslDockerDistros)).Count -gt 0)
  $wslDaemon = if ($wslDockerInstalled) { Test-WslDockerDaemonReady -Distros $wslDockerDistros } else { [pscustomobject]@{ ready = $false; distro = ''; serverVersion = '' } }
  $daemonAvailable = (-not [string]::IsNullOrWhiteSpace($serverVersion)) -or [bool]$wslDaemon.ready
  $installed = ($desktopInstalled -or $wslDockerInstalled)
  $manualActions = @()
  $mode = 'missing'
  $reason = 'No se detecto un runtime Docker compatible.'

  if ($daemonAvailable) {
    if ([bool]$wslDaemon.ready -or $wslDockerInstalled -or $preference -eq 'wsl2-engine') {
      $mode = 'wsl2-engine'
    } elseif ($context -eq 'desktop-linux' -or ($preference -eq 'desktop' -and $desktopInstalled)) {
      $mode = 'desktop'
    } elseif ($desktopInstalled) {
      $mode = 'desktop'
    } else {
      $mode = 'compatible'
    }
    $reason = "ok ($mode)"
  } elseif ($wslDockerInstalled) {
    $mode = 'wsl2-engine'
    $reason = 'WSL2 con Docker Engine detectado, pero el daemon no responde desde el host actual.'
    $manualActions += 'Abre la distro WSL2 soportada y valida el daemon con `docker version`.'
    $manualActions += 'Si necesitas compatibilidad inmediata en Windows, puedes usar Docker Desktop de forma opcional.'
  } elseif ($desktopInstalled) {
    $mode = 'desktop'
    $reason = 'Docker Desktop detectado, pero el daemon no responde.'
    $manualActions += 'Inicia Docker Desktop o cambia `EVALUAPRO_DOCKER_RUNTIME=wsl2-engine` si usaras WSL2 + Docker Engine.'
  } elseif ((@($userDistros)).Count -gt 0) {
    $mode = 'wsl2-bootstrap-required'
    $reason = 'WSL2 detectado sin Docker Engine provisionado en una distro de usuario.'
    $bootstrapDistro = if ($defaultDistro -and $defaultDistro -notin @('docker-desktop', 'docker-desktop-data')) { $defaultDistro } else { $userDistros[0] }
    $manualActions += "Provisiona Docker Engine dentro de `wsl -d $bootstrapDistro` y habilita el servicio Docker."
    $manualActions += "Compatibilidad opcional: instala Docker Desktop si prefieres ese runtime."
  } elseif ($wslAvailable) {
    $mode = 'wsl2-bootstrap-required'
    $reason = 'WSL2 detectado sin una distro de usuario lista para Docker Engine.'
    $manualActions += 'Instala una distro soportada con `wsl --install -d Ubuntu` y luego provisiona Docker Engine dentro de ella.'
    $manualActions += 'Compatibilidad opcional: instala Docker Desktop si prefieres ese runtime.'
  } else {
    $mode = 'missing'
    $reason = 'No se detecto WSL2 ni Docker Desktop.'
    $manualActions += 'Habilita WSL2 con `wsl --install -d Ubuntu` y provisiona Docker Engine dentro de la distro.'
    $manualActions += 'Compatibilidad opcional: instala Docker Desktop si prefieres ese runtime.'
  }

  return [pscustomobject]@{
    preference = $preference
    mode = $mode
    installed = $installed
    ready = $daemonAvailable
    desktopInstalled = $desktopInstalled
    clientVersion = $clientVersion
    serverVersion = $serverVersion
    context = $context
    wslAvailable = $wslAvailable
    wslStatus = $wslStatus
    wslTable = $wslTable
    defaultDistro = $defaultDistro
    userDistros = $userDistros
    wslDockerDistros = $wslDockerDistros
    reason = $reason
    manualActions = $manualActions
    wslDaemonReady = [bool]$wslDaemon.ready
    wslDaemonDistro = [string]$wslDaemon.distro
    wslDaemonVersion = [string]$wslDaemon.serverVersion
  }
}

function Test-DockerRuntimeInstalled {
  $status = Get-DockerRuntimeStatus
  return [bool]$status.installed
}

function Get-EvaluaProInstallationInfo {
  $roots = @(
    'HKLM:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKCU:\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
  )

  foreach ($root in $roots) {
    $items = Get-ItemProperty -Path $root -ErrorAction SilentlyContinue |
      Where-Object {
        $_.PSObject.Properties.Match('DisplayName').Count -gt 0 -and
        [string]$_.DisplayName -like 'EvaluaPro*'
      }

    foreach ($item in $items) {
      $uninstallString = [string]$item.UninstallString
      $productCode = ''
      if ($uninstallString -match '(\{[A-Fa-f0-9\-]{36}\})') {
        $productCode = $Matches[1]
      }
      $installLocationProp = $item.PSObject.Properties['InstallLocation']
      $installLocation = if ($installLocationProp) { [string]$installLocationProp.Value } else { '' }

      return [pscustomobject]@{
        Installed = $true
        DisplayName = [string]$item.DisplayName
        DisplayVersion = [string]$item.DisplayVersion
        InstallLocation = $installLocation
        ProductCode = $productCode
        UninstallString = $uninstallString
      }
    }
  }

  return [pscustomobject]@{
    Installed = $false
    DisplayName = ''
    DisplayVersion = ''
    InstallLocation = ''
    ProductCode = ''
    UninstallString = ''
  }
}

function Get-EvaluaProInstallationHealth {
  param([string]$InstallDir = '')

  $allowUnregistered = @('1', 'true', 'yes', 'on') -contains ([string]$env:EVALUAPRO_INSTALLER_ALLOW_UNREGISTERED).Trim().ToLowerInvariant()

  $info = Get-EvaluaProInstallationInfo
  $installLocationProp = $info.PSObject.Properties['InstallLocation']
  $installLocation = if ($installLocationProp -and $installLocationProp.Value) { [string]$installLocationProp.Value } else { '' }
  $effectiveDir = if ($InstallDir) { $InstallDir } elseif ($installLocation) { $installLocation } else { '' }
  if (-not $info.Installed -and -not $effectiveDir) {
    return [pscustomobject]@{
      state = 'ausente'
      issues = @('No hay instalacion registrada.')
      installDir = ''
    }
  }

  if (-not $effectiveDir) {
    return [pscustomobject]@{
      state = 'incompleta'
      issues = @('Existe registro de instalacion pero sin ruta valida.')
      installDir = ''
    }
  }

  $issues = @()
  $required = @(
    (Join-Path $effectiveDir 'package.json'),
    (Join-Path $effectiveDir 'scripts\launcher-broker.ps1'),
    (Join-Path $effectiveDir 'scripts\launcher-tray-hidden.vbs'),
    (Join-Path $effectiveDir 'scripts\launcher-broker.ps1'),
    (Join-Path $effectiveDir 'scripts\shortcut-op-hidden.vbs'),
    (Join-Path $effectiveDir 'logs\installation.manifest.json')
  )
  foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
      $issues += "Falta archivo crítico: $file"
    }
  }

  if (-not $info.Installed -and -not $allowUnregistered) {
    return [pscustomobject]@{
      state = if ($issues.Count -gt 0) { 'dañada' } else { 'degradada' }
      issues = @('La ruta parece contener EvaluaPro, pero no existe registro MSI.') + $issues
      installDir = $effectiveDir
    }
  }

  $state = if ($issues.Count -eq 0) { 'ok' } elseif ($issues.Count -le 2) { 'degradada' } else { 'dañada' }
  return [pscustomobject]@{
    state = $state
    issues = $issues
    installDir = $effectiveDir
  }
}

function Resolve-InstallerMode {
  param(
    [ValidateSet('auto', 'install', 'repair', 'uninstall')]
    [string]$RequestedMode,
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Installation
  )

  if ($RequestedMode -ne 'auto') {
    return $RequestedMode
  }

  if ($Installation.Installed) {
    return 'repair'
  }

  return 'install'
}

function Get-SystemRequirementReport {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InstallPath,
    [int]$MinDiskGb = 6,
    [bool]$InternetOk = $false
  )

  $os = Get-CimInstance -ClassName Win32_OperatingSystem
  $osVersion = [Version]::new(($os.Version.Split('.') | Select-Object -First 4) -join '.')
  $isWindows10Plus = $osVersion.Major -ge 10
  $is64 = [Environment]::Is64BitOperatingSystem

  $targetRoot = [System.IO.Path]::GetPathRoot($InstallPath)
  if (-not $targetRoot) {
    $targetRoot = [System.IO.Path]::GetPathRoot($env:SystemDrive)
  }

  $drive = Get-PSDrive -Name ($targetRoot.TrimEnd('\').TrimEnd(':')) -ErrorAction SilentlyContinue
  $freeBytes = if ($drive) { [double]$drive.Free } else { 0 }
  $freeGb = [math]::Round(($freeBytes / 1GB), 2)
  $diskOk = $freeGb -ge $MinDiskGb

  $nodeMajor = Get-NodeMajorVersion
  $runtime = Get-DockerRuntimeStatus
  $dockerOk = [bool]$runtime.installed

  $issues = @()
  if (-not $isWindows10Plus) { $issues += 'Se requiere Windows 10/11 o superior.' }
  if (-not $is64) { $issues += 'Se requiere arquitectura x64.' }
  if (-not $diskOk) { $issues += "Espacio insuficiente en $targetRoot (libre: ${freeGb}GB, minimo: ${MinDiskGb}GB)." }
  if (-not $InternetOk) { $issues += 'No se detecta conectividad a Internet.' }

  return [pscustomobject]@{
    OsCaption = [string]$os.Caption
    OsVersion = [string]$os.Version
    IsWindows10Plus = $isWindows10Plus
    Is64Bit = $is64
    DiskFreeGb = $freeGb
    DiskOk = $diskOk
    InternetOk = $InternetOk
    NodeMajor = $nodeMajor
    DockerOk = $dockerOk
    DockerRuntimeMode = [string]$runtime.mode
    DockerContext = [string]$runtime.context
    DockerDaemonReady = [bool]$runtime.ready
    DockerRuntimeMissing = (-not $dockerOk)
    DockerReason = [string]$runtime.reason
    Issues = $issues
    IsReadyForFlow = ($issues.Count -eq 0)
  }
}

function Read-PrereqManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
  )

  if (-not (Test-Path $ManifestPath)) {
    throw "No existe manifiesto de prerequisitos: $ManifestPath"
  }

  $raw = Get-Content -Path $ManifestPath -Raw
  $json = $raw | ConvertFrom-Json
  $list = @($json.prerequisites)
  $profiles = @($json.profiles)

  if ($list.Count -eq 0) {
    throw 'El manifiesto de prerequisitos esta vacio.'
  }

  return [pscustomobject]@{
    version = [string]$json.version
    defaultProfile = if ($null -ne $json.defaultProfile) { [string]$json.defaultProfile } else { '' }
    profiles = $profiles
    prerequisites = $list
  }
}

function Resolve-PrereqProfile {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Manifest,
    [string]$ProfileId = ''
  )

  $effectiveProfileId = [string]$ProfileId
  if ([string]::IsNullOrWhiteSpace($effectiveProfileId)) {
    $effectiveProfileId = if ($null -ne $Manifest.defaultProfile) { [string]$Manifest.defaultProfile } else { '' }
  }

  if ([string]::IsNullOrWhiteSpace($effectiveProfileId)) {
    return $Manifest
  }

  $profile = @($Manifest.profiles | Where-Object { [string]$_.profileId -eq $effectiveProfileId } | Select-Object -First 1)
  if ($profile.Count -eq 0) {
    throw "Perfil de prerequisitos no soportado: $effectiveProfileId"
  }

  $names = @($profile[0].prerequisites)
  $selected = @($Manifest.prerequisites | Where-Object { $names -contains [string]$_.name })
  if ($selected.Count -eq 0) {
    throw "Perfil $effectiveProfileId no resolvio prerequisitos."
  }

  return [pscustomobject]@{
    version = [string]$Manifest.version
    defaultProfile = $effectiveProfileId
    profiles = @($profile[0])
    prerequisites = $selected
  }
}

function Test-PrerequisiteStatus {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Prerequisite
  )

  $rule = $Prerequisite.detectRule
  $type = [string]$rule.type

  switch ($type) {
    'node_major' {
      $actual = Get-NodeMajorVersion
      $required = [int]$rule.minMajor
      $reason = ''
      if ($actual -ge $required) {
        $reason = 'ok'
      } elseif ($actual -le 0) {
        $reason = "Node no detectado o no ejecutable. Requerido: ${required}.x"
      } else {
        $reason = "Node detectado: ${actual}.x. Requerido: ${required}.x"
      }
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = ($actual -ge $required)
        actualVersion = if ($actual -gt 0) { "${actual}.x" } else { '' }
        reason = $reason
      }
    }
    'node_major_wsl' {
      $actual = Get-WslNodeMajorVersion
      $required = [int]$rule.minMajor
      $distro = Get-PreferredWslBootstrapDistro
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = ($actual -ge $required)
        actualVersion = if ($actual -gt 0) { "${actual}.x" } else { '' }
        reason = if ($actual -ge $required) { "ok ($distro)" } else { "Node WSL detectado en ${distro}: ${actual}.x. Requerido: ${required}.x" }
      }
    }
    'docker_runtime_windows' {
      $status = Get-DockerRuntimeStatus
      $runtimeReady = ([bool]$status.installed -and [bool]$status.ready -and [string]$status.mode -eq 'wsl2-engine')
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = $runtimeReady
        actualVersion = if ($status.serverVersion) { [string]$status.serverVersion } elseif ($status.clientVersion) { [string]$status.clientVersion } else { '' }
        reason = [string]$status.reason
      }
    }
    'docker_desktop' {
      $ok = Test-DockerDesktopInstalled
      return [pscustomobject]@{
        name = [string]$Prerequisite.name
        installed = $ok
        actualVersion = ''
        reason = if ($ok) { 'ok' } else { 'Docker Desktop no detectado.' }
      }
    }
    default {
      throw "detectRule.type no soportado: $type"
    }
  }
}

Export-ModuleMember -Function @(
  'Get-NodeMajorVersion',
  'Get-DockerRuntimePreference',
  'Test-DockerDesktopInstalled',
  'Get-DockerClientVersion',
  'Get-DockerServerVersion',
  'Get-DockerContextName',
  'Test-WslAvailable',
  'Get-WslStatusText',
  'Get-WslDistroTable',
  'Get-DefaultWslDistroName',
  'Get-PreferredWslBootstrapDistro',
  'Get-UserWslDistros',
  'Get-WslNodeMajorVersion',
  'Get-WslDockerRuntimeDistros',
  'Test-WslDockerDaemonReady',
  'Test-WslDockerRuntimeInstalled',
  'Get-DockerRuntimeStatus',
  'Test-DockerRuntimeInstalled',
  'Get-EvaluaProInstallationInfo',
  'Get-EvaluaProInstallationHealth',
  'Resolve-InstallerMode',
  'Get-SystemRequirementReport',
  'Read-PrereqManifest',
  'Resolve-PrereqProfile',
  'Test-PrerequisiteStatus'
)
