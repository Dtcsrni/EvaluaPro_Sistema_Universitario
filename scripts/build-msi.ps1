# build-msi.ps1
#
# Responsabilidad: Modulo interno del sistema.
# Limites: Mantener contrato y comportamiento observable del modulo.
param(
  [string]$Configuration = "Release",
  [string]$Version = "",
  [switch]$SkipStabilityChecks,
  [switch]$IncludeBundle,
  [switch]$IsolateBundleIdentity,
  [string]$Flavor = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$isWindowsPlatform = $false
$isLinuxPlatform = $false
try {
  $isWindowsPlatform = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
  $isLinuxPlatform = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Linux)
} catch {
  $isWindowsPlatform = $env:OS -eq 'Windows_NT'
  $isLinuxPlatform = -not $isWindowsPlatform
}

if (-not $isWindowsPlatform) {
  throw "El empaquetado WiX/Burn del Installer Hub solo se soporta en Windows. Ejecuta `scripts/build-msi.ps1` en un host Windows con WiX instalado."
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot 'installer\Remove-NpmWorkspaceLink.ps1')
$wix = Join-Path $root "packaging\wix"
$out = Join-Path $root "dist\installer"
$internalOut = Join-Path $out '_internal'
$flavorCatalogPath = Join-Path $root 'config\installer-flavors.json'
$canonicalInstallerIconPath = Join-Path $root 'scripts\icons\installer-canonical.ico'

function Remove-StaleInstallerArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$InternalOutputDirectory
  )

  if (Test-Path -LiteralPath $OutputDirectory) {
    Get-ChildItem -LiteralPath $OutputDirectory -Force -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Remove-OptionalInstallerArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
  )

  Get-ChildItem -Path $OutputDirectory -Filter '*.extracted.ico' -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
  }
}

function New-InstallerBuildStagingRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath
  )

  $stagingBase = if ($isLinuxPlatform -and (Test-Path -LiteralPath '/tmp')) { '/tmp' } else { $env:TEMP }
  if ([string]::IsNullOrWhiteSpace($stagingBase)) {
    $stagingBase = [System.IO.Path]::GetTempPath()
  }

  $stagingRoot = Join-Path $stagingBase ("evaluapro-installer-staging-{0}" -f [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
  Write-Host "[msi] Staging temporal: $stagingRoot"

  $allowedRootFiles = @(
    'package.json',
    'docker-compose.yml',
    'docker-compose.prod-build.yml'
  )
  $allowedTopLevelPrefixes = @(
    'accesos-directos/',
    'apps/',
    'config/',
    'contracts/installer-hub/',
    'logos/',
    'packaging/wix/',
    'runtime/',
    'scripts/'
  )
  $excludedTrackedPrefixes = @(
    'packaging/wix/BurnBootstrapperApp/bin/',
    'packaging/wix/BurnBootstrapperApp/obj/',
    'packaging/wix/bin/',
    'packaging/wix/obj/',
    'dist/',
    'reports/',
    'logs/'
  )

  $gitExe = Resolve-GitExecutable
  Write-Host "[msi] Git para staging: $gitExe"
  $trackedFiles = @(Get-TrackedFilesWithTimeout -GitExecutable $gitExe -RootPath $RootPath)
  if ($trackedFiles.Count -eq 0) {
    Write-Host "[msi] Git no devolvió archivos; usando fallback acotado con rg."
    $rgCommand = Get-Command rg.exe -ErrorAction SilentlyContinue
    $rgExe = if ($null -ne $rgCommand) { $rgCommand.Path } else { $null }
    if (-not [string]::IsNullOrWhiteSpace($rgExe)) {
      $fallbackArgs = @(
        '--files', '--hidden', '--no-ignore-vcs',
        '-g', '!.git/**', '-g', '!**/node_modules/**', '-g', '!**/dist/**', '-g', '!**/dist-*/**',
        '-g', '!**/bin/**', '-g', '!**/obj/**', '-g', '!**/.vitest-reports/**',
        '-g', '!**/reports/**',
        '-g', '!**/build/**', '-g', '!**/out/**', '-g', '!**/coverage/**',
        '-g', '!**/.cache/**', '-g', '!**/.next/**', '-g', '!**/.turbo/**',
        $RootPath
      )
      $trackedFiles = @(& $rgExe @fallbackArgs 2>$null | ForEach-Object {
        $path = ([string]$_).Trim()
        if ($path.StartsWith($RootPath, [StringComparison]::OrdinalIgnoreCase)) {
          $path.Substring($RootPath.Length).TrimStart('\', '/') -replace '\\', '/'
        } else {
          $path -replace '\\', '/'
        }
      })
    } else {
      Write-Warning "rg no está disponible; usando enumeración recursiva lenta como último fallback."
      $trackedFiles = @(Get-ChildItem -LiteralPath $RootPath -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $relative = $_.FullName.Substring($RootPath.Length).TrimStart('\', '/')
        $relative -replace '\\', '/'
      })
    }
  }
  $totalTracked = @($trackedFiles).Count
  $copiedCount = 0
  foreach ($relativePath in $trackedFiles) {
    if ([string]::IsNullOrWhiteSpace([string]$relativePath)) {
      continue
    }

    # The installer ships payload files, not repo governance / build metadata.
    # Keep the staging tree narrow so WiX never sees docs, CI, or dotfiles.
    if ($relativePath -match '(^|/)\.' -or $relativePath -match '(^|/)(README|LICENSE|NOTICE)(\.[^/]+)?$' -or $relativePath -match '\.md$' -or $relativePath -match '(^|/)package-lock\.json$') {
      continue
    }

    if ($relativePath -match '(^|/)(node_modules|coverage|dist|build|out|\.cache|\.next|\.turbo)(/|$)') {
      continue
    }

    # Los .lnk son artefactos generados y contienen rutas absolutas de la
    # máquina que los creó. El helper post-install los regenera dentro de la
    # instalación, por lo que nunca deben viajar en el payload.
    if ($relativePath -match '^accesos-directos/[^/]+\.lnk$') {
      continue
    }

    # El flavor docente ejecuta artefactos compilados. No propagar al staging
    # código fuente, pruebas, reportes ni datos de prueba que WiX no debe cosechar.
    if ($relativePath -match '^apps/[^/]+/(src|tests|reports)/' -or
        $relativePath -match '^apps/backend/data/' -or
        $relativePath -match '^scripts/tests/') {
      continue
    }

    if ($excludedTrackedPrefixes | Where-Object { $relativePath.StartsWith($_) }) {
      continue
    }

    if ($relativePath -notmatch '/' -and ($allowedRootFiles -notcontains $relativePath)) {
      continue
    }

    if ($relativePath -match '/' -and -not ($allowedTopLevelPrefixes | Where-Object { $relativePath.StartsWith($_) })) {
      continue
    }

    $sourcePath = Join-Path $RootPath $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      continue
    }

    $destinationPath = Join-Path $stagingRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    if (-not [string]::IsNullOrWhiteSpace($destinationDirectory)) {
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $copiedCount += 1
    if (($copiedCount % 50) -eq 0 -or $copiedCount -eq $totalTracked) {
      Write-Host ("[msi] Staging {0}/{1}: {2}" -f $copiedCount, $totalTracked, $relativePath)
    }
  }

  Write-Host "[msi] Staging completado: $copiedCount archivos"

  # Guardrail: never package the obsolete direct JSON property access that
  # caused published bundles to diverge from the current Burn helper.
  $stagedBurnHelper = Join-Path $stagingRoot 'scripts/installer-burn/InstallerBurnHelper.ps1'
  if (-not (Test-Path -LiteralPath $stagedBurnHelper)) {
    throw "No se encontró InstallerBurnHelper.ps1 en el staging del instalador."
  }
  $stagedBurnSource = Get-Content -LiteralPath $stagedBurnHelper -Raw -Encoding utf8
  if ($stagedBurnSource -match '\$requestJson\.TargetDir') {
    throw "El staging contiene acceso obsoleto a requestJson.TargetDir; se cancela el empaquetado."
  }
  if ($stagedBurnSource -notmatch 'Get-RequestValue\s+-Request\s+\$Request') {
    throw "El staging no contiene el getter seguro del target de instalación; se cancela el empaquetado."
  }

  return $stagingRoot
}

function Get-TrackedFilesWithTimeout {
  param(
    [Parameter(Mandatory = $true)]
    [string]$GitExecutable,
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [int]$TimeoutSeconds = 30
  )

  $stdoutPath = Join-Path $env:TEMP ("evaluapro-git-files-{0}.out" -f [Guid]::NewGuid().ToString('N'))
  $stderrPath = Join-Path $env:TEMP ("evaluapro-git-files-{0}.err" -f [Guid]::NewGuid().ToString('N'))
  try {
    # Include new, non-ignored files so a local build from a working tree cannot
    # silently omit newly added modules before they are committed.
    $proc = Start-Process -FilePath $GitExecutable -ArgumentList @('-C', $RootPath, 'ls-files', '--cached', '--others', '--exclude-standard') -NoNewWindow -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
      Start-Process -FilePath taskkill.exe -ArgumentList @('/PID', [string]$proc.Id, '/T', '/F') -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
      Write-Warning "Git ls-files excedió ${TimeoutSeconds}s; se usará fallback de enumeración acotada."
      return @()
    }
    # Flush the process handle after the timed wait before reading ExitCode.
    $proc.WaitForExit()
    $proc.Refresh()
    $gitExitCode = if ($proc.HasExited) { $proc.ExitCode } else { $null }
    if ($null -eq $gitExitCode) {
      $gitStdErrText = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue } else { '' }
      $gitStdOutFiles = if (Test-Path -LiteralPath $stdoutPath) { @(Get-Content -LiteralPath $stdoutPath -Encoding utf8 -ErrorAction SilentlyContinue) } else { @() }
      if ([string]::IsNullOrWhiteSpace([string]$gitStdErrText) -and $gitStdOutFiles.Count -gt 0) {
        Write-Warning 'Git ls-files no expuso ExitCode; se acepta stdout no vacío sin errores.'
        return $gitStdOutFiles
      }
      Write-Warning 'Git ls-files no expuso ExitCode ni una lista verificable; se usará fallback de enumeración acotada.'
      return @()
    }
    if ($gitExitCode -ne 0) {
      Write-Warning "Git ls-files terminó con exit=$gitExitCode; se usará fallback de enumeración acotada."
      return @()
    }
    return @(Get-Content -LiteralPath $stdoutPath -Encoding utf8 -ErrorAction SilentlyContinue)
  } finally {
    Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Remove-InstallerBuildStagingRoot {
  param(
    [string]$StagingRoot
  )

  if ([string]::IsNullOrWhiteSpace($StagingRoot)) {
    return
  }

  if (Test-Path -LiteralPath $StagingRoot) {
    $previousProgressPreference = $ProgressPreference
    try {
      $ProgressPreference = 'SilentlyContinue'
      [System.IO.Directory]::Delete($StagingRoot, $true)
    } catch {
      Remove-Item -LiteralPath $StagingRoot -Recurse -Force -ErrorAction SilentlyContinue
    } finally {
      $ProgressPreference = $previousProgressPreference
    }
  }
}

function Add-DocenteNativeCompiledPayload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [Parameter(Mandatory = $true)]
    [string]$StagingRoot
  )

  Write-Host '[msi] Compilando payload nativo docente-local (Node + SQLite; sin VM/Mongo).'
  Push-Location $RootPath
  try {
    $frontendSource = Join-Path $RootPath 'apps/frontend/dist-docente'
    $backendSource = Join-Path $RootPath 'apps/backend/dist'
    $npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }
    # No inferir frescura por la presencia de archivos: dist puede pertenecer a
    # otro SHA y producir un instalador que no corresponda con las fuentes.
    & $npmCommand -C 'apps/frontend' run 'build:docente'
    if ($LASTEXITCODE -ne 0) { throw "Falló build docente del frontend (exit=$LASTEXITCODE)." }
    & $npmCommand -C 'apps/backend' run 'build'
    if ($LASTEXITCODE -ne 0) { throw "Falló build del backend nativo (exit=$LASTEXITCODE)." }
    if (-not (Test-Path (Join-Path $frontendSource 'index.html'))) {
      throw "El build docente no generó $frontendSource/index.html."
    }
    if (-not (Test-Path (Join-Path $backendSource 'index.js'))) {
      throw "El build backend no generó $backendSource/index.js."
    }

    $frontendTarget = Join-Path $StagingRoot 'apps/frontend/dist-docente'
    $backendTarget = Join-Path $StagingRoot 'apps/backend/dist'
    $bundleVerifierSource = Join-Path $RootPath 'scripts/verify-docente-bundle.mjs'
    if (-not (Test-Path -LiteralPath $bundleVerifierSource)) {
      throw "Falta la verificación del bundle docente: $bundleVerifierSource"
    }
    $staticServerSource = Join-Path $RootPath 'scripts/serve-docente-static.mjs'
    $bundleGuardSource = Join-Path $RootPath 'scripts/docente-bundle-guard.mjs'
    if (-not (Test-Path $staticServerSource)) {
      throw "Falta el servidor estatico nativo docente: $staticServerSource"
    }
    if (-not (Test-Path $bundleGuardSource)) {
      throw "Falta la guardia del bundle docente: $bundleGuardSource"
    }
    $staticServerTarget = Join-Path $StagingRoot 'scripts/serve-docente-static.mjs'
    $bundleGuardTarget = Join-Path $StagingRoot 'scripts/docente-bundle-guard.mjs'
    New-Item -ItemType Directory -Path (Split-Path $staticServerTarget -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $staticServerSource -Destination $staticServerTarget -Force
    Copy-Item -LiteralPath $bundleGuardSource -Destination $bundleGuardTarget -Force

    $embeddedNodeSource = Join-Path $RootPath 'runtime/node/node.exe'
    if (-not (Test-Path -LiteralPath $embeddedNodeSource)) {
      $hostNode = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
      if ([string]::IsNullOrWhiteSpace($hostNode)) { throw 'No se encontró Node.js para incluir el runtime embebido docente.' }
      $nodeVersionText = (& $hostNode --version 2>$null | Select-Object -First 1).Trim()
      $nodeMajorMatch = [Regex]::Match($nodeVersionText, '^v?(\d+)')
      if (-not $nodeMajorMatch.Success -or [int]$nodeMajorMatch.Groups[1].Value -lt 24) {
        throw "Node.js 24+ requerido para el runtime embebido docente; detectado: $nodeVersionText"
      }
      $embeddedNodeSource = $hostNode
    }
    $embeddedNodeTarget = Join-Path $StagingRoot 'runtime/node/node.exe'
    New-Item -ItemType Directory -Path (Split-Path $embeddedNodeTarget -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $embeddedNodeSource -Destination $embeddedNodeTarget -Force
    Write-Host "[msi] Node.js embebido docente incluido: $embeddedNodeSource"
    foreach ($nativeScript in @('start-docente-native.mjs', 'launcher-dashboard.mjs', 'runtime-env.mjs', 'migrate-examen-lote-artefactos-pdf-sqlite.mjs', 'migrate-calificacion-origen-inferida-sqlite.mjs', 'migrate-preferencias-retencion-parcial-sqlite.mjs', 'migrate-resultados-extra-externos-sqlite.mjs')) {
      $nativeScriptSource = Join-Path $RootPath (Join-Path 'scripts' $nativeScript)
      if (-not (Test-Path $nativeScriptSource)) { throw "Falta script nativo requerido: $nativeScriptSource" }
      Copy-Item -LiteralPath $nativeScriptSource -Destination (Join-Path $StagingRoot (Join-Path 'scripts' $nativeScript)) -Force
    }
    $helperSource = Join-Path $RootPath 'scripts/installer-burn/InstallerBurnHelper.ps1'
    if (-not (Test-Path $helperSource)) { throw "Falta helper nativo requerido: $helperSource" }
    $helperTarget = Join-Path $StagingRoot 'scripts/installer-burn/InstallerBurnHelper.ps1'
    New-Item -ItemType Directory -Path (Split-Path $helperTarget -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $helperSource -Destination $helperTarget -Force
    foreach ($hubModule in @('InstallerHubContracts.psm1', 'InstallerHubOperation.psm1', 'InstallerHubProcesses.psm1', 'InstallerHubTransaction.psm1', 'InstallerHubPayload.psm1', 'InstallerHubVerification.psm1')) {
      $moduleSource = Join-Path $RootPath (Join-Path 'scripts/installer-burn/modules' $hubModule)
      if (-not (Test-Path -LiteralPath $moduleSource)) { throw "Falta módulo requerido del Installer Hub: $moduleSource" }
      $moduleTargetRoot = Join-Path $StagingRoot 'scripts/installer-burn/modules'
      New-Item -ItemType Directory -Path $moduleTargetRoot -Force | Out-Null
      Copy-Item -LiteralPath $moduleSource -Destination (Join-Path $moduleTargetRoot $hubModule) -Force
    }
    foreach ($hubContract in @('request-envelope-v1.schema.json', 'response-envelope-v1.schema.json', 'dashboard-readiness-v1.schema.json')) {
      $contractSource = Join-Path $RootPath (Join-Path 'contracts/installer-hub' $hubContract)
      if (-not (Test-Path -LiteralPath $contractSource)) { throw "Falta contrato requerido del Installer Hub: $contractSource" }
      $contractTargetRoot = Join-Path $StagingRoot 'scripts/installer-burn/modules'
      New-Item -ItemType Directory -Path $contractTargetRoot -Force | Out-Null
      Copy-Item -LiteralPath $contractSource -Destination (Join-Path $contractTargetRoot $hubContract) -Force
    }
    $sqliteBootstrapSource = Join-Path $RootPath 'scripts/prepare-docente-sqlite.mjs'
    if (-not (Test-Path $sqliteBootstrapSource)) { throw "Falta bootstrap SQLite requerido: $sqliteBootstrapSource" }
    Copy-Item -LiteralPath $sqliteBootstrapSource -Destination (Join-Path $StagingRoot 'scripts/prepare-docente-sqlite.mjs') -Force

    # Compilar y copiar el Host Nativo de Escritorio (EvaluaPro.exe)
    $appHostProject = Join-Path $RootPath 'packaging/app-host/EvaluaPro.AppHost.csproj'
    $appHostPublishDir = Join-Path $RootPath 'packaging/app-host/publish'
    if (Test-Path -LiteralPath $appHostProject) {
      $dotnetExe = Resolve-DotNetExecutable
      Write-Host '[msi] Compilando Host Nativo EvaluaPro.exe (WPF + WebView2)...'
      & $dotnetExe publish $appHostProject -c Release -r win-x64 --self-contained true -o $appHostPublishDir
      if (Test-Path -LiteralPath (Join-Path $appHostPublishDir 'EvaluaPro.exe')) {
        Copy-Item -LiteralPath (Join-Path $appHostPublishDir 'EvaluaPro.exe') -Destination (Join-Path $StagingRoot 'EvaluaPro.exe') -Force
        Write-Host '[msi] Host Nativo EvaluaPro.exe agregado al staging.'
      }
    }

    New-Item -ItemType Directory -Path $frontendTarget,$backendTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $frontendSource '*') -Destination $frontendTarget -Recurse -Force
    Copy-Item -Path (Join-Path $backendSource '*') -Destination $backendTarget -Recurse -Force
    & $embeddedNodeTarget $bundleVerifierSource --dist $frontendTarget
    if ($LASTEXITCODE -ne 0) { throw 'El bundle docente copiado al payload no superó la guardia de versión/estilos.' }
    New-Item -ItemType Directory -Path (Join-Path $backendTarget 'modulos/modulo_analiticas/plantillas') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $RootPath 'apps/backend/src/modulos/modulo_analiticas/plantillas/LIBRO_CALIFICACIONES_PRODUCCION_BASE_SANITIZADA.xlsx') -Destination (Join-Path $backendTarget 'modulos/modulo_analiticas/plantillas') -Force
    Copy-Item -LiteralPath (Join-Path $RootPath 'apps/backend/package.json') -Destination $backendTarget -Force
    Copy-Item -LiteralPath (Join-Path $RootPath 'apps/backend/prisma.config.mjs') -Destination $backendTarget -Force
    Copy-Item -LiteralPath (Join-Path $RootPath 'apps/backend/prisma') -Destination $backendTarget -Recurse -Force
    $prebuiltNodeModules = Join-Path $RootPath 'dist-native/backend/node_modules'
    $reusePrebuiltDependencies = Test-Path -LiteralPath (Join-Path $prebuiltNodeModules '@prisma/client')
    if ($reusePrebuiltDependencies) {
      Write-Host '[msi] Reutilizando node_modules de dist-native; se evita npm ci redundante.'
      Copy-Item -LiteralPath $prebuiltNodeModules -Destination $backendTarget -Recurse -Force
    } else {
      # Instalar desde el lock canónico del monorepo. Copiar solo el manifiesto
      # del backend junto a su lock hijo puede desalinearlos tras Dependabot.
      $npmWorkspaceRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("evaluapro-npm-workspace-{0}" -f [Guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $npmWorkspaceRoot -Force | Out-Null
      Copy-Item -LiteralPath (Join-Path $RootPath 'package.json') -Destination $npmWorkspaceRoot -Force
      Copy-Item -LiteralPath (Join-Path $RootPath 'package-lock.json') -Destination $npmWorkspaceRoot -Force
      $npmConfig = Join-Path $RootPath '.npmrc'
      if (Test-Path -LiteralPath $npmConfig) {
        Copy-Item -LiteralPath $npmConfig -Destination $npmWorkspaceRoot -Force
      }
      foreach ($workspacePath in @('apps/backend', 'apps/frontend', 'apps/portal_alumno_cloud')) {
        $workspaceManifest = Join-Path $RootPath (Join-Path $workspacePath 'package.json')
        if (-not (Test-Path -LiteralPath $workspaceManifest)) {
          throw "Falta el manifiesto requerido del workspace npm: $workspaceManifest"
        }
        $workspaceTarget = Join-Path $npmWorkspaceRoot $workspacePath
        New-Item -ItemType Directory -Path $workspaceTarget -Force | Out-Null
        Copy-Item -LiteralPath $workspaceManifest -Destination $workspaceTarget -Force
      }
      Push-Location $npmWorkspaceRoot
      try {
        & $npmCommand ci --workspace=apps/backend --include-workspace-root=false --omit=dev --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw "Falló instalación de dependencias backend desde el lock raíz (exit=$LASTEXITCODE)." }
        Copy-Item -LiteralPath (Join-Path $npmWorkspaceRoot 'node_modules') -Destination $backendTarget -Recurse -Force
        # npm puede instalar dependencias específicas del workspace anidadas aquí,
        # mientras las demás se izan a node_modules raíz. Fusionarlas conserva
        # la versión de producción del backend (por ejemplo, zod v4) en el MSI.
        $backendNodeModulesTarget = Join-Path $backendTarget 'node_modules'
        $workspaceNodeModules = Join-Path $npmWorkspaceRoot 'apps/backend/node_modules'
        if (Test-Path -LiteralPath $workspaceNodeModules) {
          Get-ChildItem -LiteralPath $workspaceNodeModules -Recurse -File -Force | ForEach-Object {
            $relativeModulePath = $_.FullName.Substring($workspaceNodeModules.Length).TrimStart([char[]]@([char]92, [char]47))
            $destinationModulePath = Join-Path $backendNodeModulesTarget $relativeModulePath
            $destinationModuleDirectory = Split-Path -Parent $destinationModulePath
            New-Item -ItemType Directory -Path $destinationModuleDirectory -Force | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $destinationModulePath -Force
          }
        }
      } finally {
        Pop-Location
        Remove-Item -LiteralPath $npmWorkspaceRoot -Recurse -Force -ErrorAction SilentlyContinue
      }
      $backendWorkspaceLink = Join-Path $backendTarget 'node_modules/backend'
      Remove-NpmWorkspaceLink -LiteralPath $backendWorkspaceLink
    }
    Push-Location $backendTarget
    try {
      $nodeForBuild = if (Test-Path (Join-Path $RootPath 'runtime/node/node.exe')) { Join-Path $RootPath 'runtime/node/node.exe' } else { 'node' }
      $prismaCliPath = Join-Path $RootPath 'node_modules/prisma/build/index.js'
      if (-not (Test-Path -LiteralPath $prismaCliPath)) {
        $prismaCliPath = Join-Path $backendTarget 'node_modules/prisma/build/index.js'
      }
      if (-not (Test-Path -LiteralPath $prismaCliPath)) { throw 'No se encontró Prisma CLI en el entorno de build.' }
      $stagedSchemaPath = Join-Path $backendTarget 'prisma/schema.prisma'
      $stagedSchema = Get-Content -LiteralPath $stagedSchemaPath -Raw -Encoding utf8
      if ($stagedSchema -match 'binaryTargets\s*=\s*\[\s*"native"\s*,\s*"debian-openssl-3\.0\.x"\s*\]') {
        $stagedSchema = $stagedSchema -replace 'binaryTargets\s*=\s*\[\s*"native"\s*,\s*"debian-openssl-3\.0\.x"\s*\]', 'binaryTargets = ["native"]'
        [IO.File]::WriteAllText($stagedSchemaPath, $stagedSchema, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host '[msi] Schema docente reducido a engine native (Windows); se omite engine Linux no utilizado.'
      }
      & $nodeForBuild $prismaCliPath generate --config (Join-Path $backendTarget 'prisma.config.mjs') --schema $stagedSchemaPath
      if ($LASTEXITCODE -ne 0) { throw "Falló generación del cliente Prisma nativo (exit=$LASTEXITCODE)." }
      $previousErrorActionPreference = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $env:PRISMA_HIDE_UPDATE_MESSAGE = '1'
      $env:CHECKPOINT_DISABLE = '1'
      try {
        $schemaSqlOutput = @(& $nodeForBuild $prismaCliPath migrate diff --from-empty --to-schema $stagedSchemaPath --config (Join-Path $backendTarget 'prisma.config.mjs') --script 2>&1 | ForEach-Object { [string]$_ })
      } finally {
        $ErrorActionPreference = $previousErrorActionPreference
      }
      if ($LASTEXITCODE -ne 0) { throw "Falló generación del esquema SQL nativo (exit=$LASTEXITCODE)." }
      $sqlLines = $schemaSqlOutput | Where-Object {
        $lineStr = [string]$_
        if ($lineStr -match 'Update available|major update|Tip:|npm warn|npm NOTICE') { return $false }
        if ($lineStr.Contains([char]0x2500) -or $lineStr.Contains([char]0x2502) -or $lineStr.Contains([char]0x250C) -or $lineStr.Contains([char]0x2514)) { return $false }
        return $true
      }
      $schemaSqlText = $sqlLines -join [Environment]::NewLine
      $sqlStart = $schemaSqlText.IndexOf('-- CreateTable', [StringComparison]::Ordinal)
      if ($sqlStart -lt 0) { throw 'Falló generación del esquema SQL nativo: salida SQL vacía.' }
      $schemaSqlText = $schemaSqlText.Substring($sqlStart)
      $lastSqlTerminator = $schemaSqlText.LastIndexOf(';')
      if ($lastSqlTerminator -lt 0) {
        throw 'Falló saneamiento del esquema SQL nativo: no hay terminador SQL.'
      }
      $schemaSqlText = $schemaSqlText.Substring(0, $lastSqlTerminator + 1).Trim()
      [IO.File]::WriteAllText((Join-Path $backendTarget 'prisma/schema.sql'), $schemaSqlText, (New-Object System.Text.UTF8Encoding($false)))

      # Si se reutilizó un node_modules preconstruido, puede incluir
      # dependencias de desarrollo aunque el árbol tenga package-lock. Hacer
      # prune contra el contrato de producción antes de la poda específica de
      # Prisma evita transportar Vitest, TypeScript u otros paquetes ajenos al
      # runtime nativo.
      if ($reusePrebuiltDependencies) {
        & $npmCommand prune --omit=dev --ignore-scripts --package-lock=false
        if ($LASTEXITCODE -ne 0) { throw "Falló poda de dependencias de desarrollo (exit=$LASTEXITCODE)." }
      }

      # El cliente ya fue generado y el esquema SQL ya quedó materializado.
      # El runtime Windows no necesita la CLI Prisma, sus engines de descarga,
      # cachés ni los bundles WASM/multiplataforma del cliente publicado.
      $prunePaths = @(
        (Join-Path $backendTarget 'node_modules/prisma'),
        (Join-Path $backendTarget 'node_modules/@prisma/engines'),
        (Join-Path $backendTarget 'node_modules/@prisma/fetch-engine'),
        (Join-Path $backendTarget 'node_modules/@prisma/get-platform'),
        # La CLI Prisma instala Studio/PGlite y sus dependencias de interfaz
        # aunque no formen parte del grafo de runtime del backend SQLite.
        (Join-Path $backendTarget 'node_modules/@prisma/dev'),
        (Join-Path $backendTarget 'node_modules/@prisma/studio-core'),
        (Join-Path $backendTarget 'node_modules/@prisma/query-plan-executor'),
        (Join-Path $backendTarget 'node_modules/@prisma/streams-local'),
        (Join-Path $backendTarget 'node_modules/@prisma/config'),
        (Join-Path $backendTarget 'node_modules/@electric-sql'),
        (Join-Path $backendTarget 'node_modules/@radix-ui'),
        (Join-Path $backendTarget 'node_modules/@visx'),
        (Join-Path $backendTarget 'node_modules/@types'),
        (Join-Path $backendTarget 'node_modules/@standard-schema'),
        (Join-Path $backendTarget 'node_modules/elkjs'),
        (Join-Path $backendTarget 'node_modules/effect'),
        (Join-Path $backendTarget 'node_modules/fast-check'),
        (Join-Path $backendTarget 'node_modules/pure-rand'),
        (Join-Path $backendTarget 'node_modules/react'),
        (Join-Path $backendTarget 'node_modules/react-dom'),
        (Join-Path $backendTarget 'node_modules/scheduler'),
        (Join-Path $backendTarget 'node_modules/csstype'),
        (Join-Path $backendTarget 'node_modules/d3-array'),
        (Join-Path $backendTarget 'node_modules/d3-color'),
        (Join-Path $backendTarget 'node_modules/d3-delaunay'),
        (Join-Path $backendTarget 'node_modules/d3-format'),
        (Join-Path $backendTarget 'node_modules/d3-geo'),
        (Join-Path $backendTarget 'node_modules/d3-interpolate'),
        (Join-Path $backendTarget 'node_modules/d3-path'),
        (Join-Path $backendTarget 'node_modules/d3-scale'),
        (Join-Path $backendTarget 'node_modules/d3-shape'),
        (Join-Path $backendTarget 'node_modules/d3-time'),
        (Join-Path $backendTarget 'node_modules/d3-time-format'),
        # El addon compilado se empaqueta abajo; el código fuente de SQLite
        # solo sirve para compilarlo y no se ejecuta en el equipo destino.
        (Join-Path $backendTarget 'node_modules/better-sqlite3/deps'),
        (Join-Path $backendTarget 'node_modules/@prisma/client/runtime/query_engine_bg*'),
        (Join-Path $backendTarget 'node_modules/@prisma/client/runtime/query_compiler_bg*'),
        (Join-Path $backendTarget 'node_modules/.prisma/client/query_engine_bg*'),
        (Join-Path $backendTarget 'node_modules/.prisma/client/query_compiler_bg*'),
        # Un node_modules reutilizado puede conservar engines de Linux del
        # perfil institucional. El payload docente es Windows + SQLite y solo usa el
        # engine native generado arriba (query_engine-windows.dll.node).
        (Join-Path $backendTarget 'node_modules/.prisma/client/libquery_engine-*.so.node'),
        (Join-Path $backendTarget 'node_modules/.cache')
      )
      # El staging preconstruido puede contener engines, cachés y herramientas
      # de desarrollo de la máquina que lo generó. También debe podarse aquí;
      # de lo contrario el MSI arrastra varias plataformas de Prisma y excede
      # el presupuesto del instalador aunque npm ci --omit=dev no se ejecute.
      foreach ($prunePath in $prunePaths) {
        Get-ChildItem -Path $prunePath -Force -ErrorAction SilentlyContinue | ForEach-Object {
          Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
        }
      }
      # El flavor usa Prisma Client generado para SQLite. Los módulos WASM
      # para CockroachDB/MySQL/PostgreSQL/SQL Server y el compilador pequeño
      # no son cargados por ese cliente y agregan varias decenas de MiB.
      $prismaRuntimePath = Join-Path $backendTarget 'node_modules/@prisma/client/runtime'
      $unusedQueryCompilers = @(
        Get-ChildItem -LiteralPath $prismaRuntimePath -File -Force -ErrorAction SilentlyContinue |
          Where-Object {
            $_.Name -match '^query_compiler_(fast|small)_bg\.(cockroachdb|mysql|postgresql|sqlserver)\.wasm-base64\.(js|mjs)$' -or
            $_.Name -match '^query_compiler_small_bg\.sqlite\.wasm-base64\.(js|mjs)$'
          }
      )
      foreach ($unusedQueryCompiler in $unusedQueryCompilers) {
        Remove-Item -LiteralPath $unusedQueryCompiler.FullName -Force -ErrorAction Stop
      }

      # El worker OMR carga explícitamente el modelo español 4.0.0_best_int.
      # Se excluyen dos duplicados históricos y el modelo español alternativo.
      foreach ($unusedOcrAsset in @(
        (Join-Path $StagingRoot 'apps/backend/eng.traineddata'),
        (Join-Path $StagingRoot 'apps/backend/spa.traineddata'),
        (Join-Path $backendTarget 'node_modules/@tesseract.js-data/spa/4.0.0')
      )) {
        if (Test-Path -LiteralPath $unusedOcrAsset) {
          Remove-Item -LiteralPath $unusedOcrAsset -Recurse -Force -ErrorAction Stop
        }
      }
      # pdf-parse importa pdfjs-dist en tiempo de ejecución. Mantener ambos
      # módulos en el payload evita que la API falle al arrancar después de
      # instalar el bundle docente-local.
      foreach ($requiredRuntimeModule in @('pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', 'tesseract.js', '@tesseract.js-data/spa')) {
        $requiredRuntimeModulePath = Join-Path $backendTarget ("node_modules/{0}" -f $requiredRuntimeModule)
        if (-not (Test-Path -LiteralPath $requiredRuntimeModulePath)) {
          throw "Falta dependencia de runtime requerida por el backend: $requiredRuntimeModulePath"
        }
      }
      # Cada dependencia directa de producción del backend debe existir en el
      # árbol que se empaquetará. Esto detecta instalaciones incompletas aunque
      # otra versión de la misma dependencia exista en el node_modules raíz.
      $backendPackageManifest = Get-Content -LiteralPath (Join-Path $backendTarget 'package.json') -Raw -Encoding utf8 | ConvertFrom-Json
      $backendNodeModules = Join-Path $backendTarget 'node_modules'
      foreach ($runtimeDependency in $backendPackageManifest.dependencies.PSObject.Properties.Name) {
        $runtimeDependencyPath = Join-Path $backendNodeModules ($runtimeDependency.Replace('/', [IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $runtimeDependencyPath)) {
          throw "Falta dependencia de runtime declarada en package.json: $runtimeDependency"
        }
      }
      $pdfRuntimeSmoke = Join-Path $backendTarget '.pdf-runtime-smoke.mjs'
      $pdfRuntimeSmokeSource = @'
import { readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

const parser = new PDFParse({ data: readFileSync(process.argv[2]) });
try {
  const result = await parser.getText();
  if (!result.text?.includes('PDF TEST')) throw new Error('pdf-parse no extrajo el texto esperado.');
} finally {
  await parser.destroy();
}
'@
      $pdfRuntimeSmokeUtf8 = New-Object System.Text.UTF8Encoding($false)
      [IO.File]::WriteAllText($pdfRuntimeSmoke, $pdfRuntimeSmokeSource, $pdfRuntimeSmokeUtf8)
      try {
        & $nodeForBuild $pdfRuntimeSmoke (Join-Path $RootPath 'apps/backend/sample-test.pdf')
        if ($LASTEXITCODE -ne 0) { throw "Falló el smoke PDF docente sin Canvas opcional (exit=$LASTEXITCODE)." }
      } finally {
        Remove-Item -LiteralPath $pdfRuntimeSmoke -Force -ErrorAction SilentlyContinue
      }
      $requiredSpanishOcrModel = Join-Path $backendTarget 'node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz'
      if (-not (Test-Path -LiteralPath $requiredSpanishOcrModel)) {
        throw "Falta el modelo español offline requerido para OMR: $requiredSpanishOcrModel"
      }
      if ($reusePrebuiltDependencies) {
        Write-Host '[msi] Payload preconstruido reutilizado y podado para runtime Windows.'
      }
      $runtimeNodeModules = Join-Path $backendTarget 'node_modules'
      $nonRuntimeFiles = @(
        Get-ChildItem -LiteralPath $runtimeNodeModules -Recurse -File -Force -ErrorAction SilentlyContinue |
          Where-Object {
            $_.Name -match '\.(md|markdown|map|ts|tsx|mts|cts)$' -or
            $_.Name -match '\.d\.(ts|mts|cts)$' -or
            $_.Name -in @('CHANGELOG', 'CHANGES', 'HISTORY', 'CONTRIBUTING', 'LICENSE', 'LICENCE', 'NOTICE', 'AUTHORS', 'COPYING')
          }
      )
      foreach ($nonRuntimeFile in $nonRuntimeFiles) {
        Remove-Item -LiteralPath $nonRuntimeFile.FullName -Force -ErrorAction Stop
      }
      $nonRuntimeDirectories = @(
        Get-ChildItem -LiteralPath $runtimeNodeModules -Recurse -Directory -Force -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -match '^(test|tests|__tests__|docs|examples?|\.github)$' } |
          Sort-Object FullName -Descending
      )
      foreach ($nonRuntimeDirectory in $nonRuntimeDirectories) {
        if (Test-Path -LiteralPath $nonRuntimeDirectory.FullName) {
          Remove-Item -LiteralPath $nonRuntimeDirectory.FullName -Recurse -Force -ErrorAction Stop
        }
      }

      $dpapiPackagePath = Join-Path $runtimeNodeModules '@primno/dpapi/package.json'
      $dpapiNativeAddon = Join-Path $runtimeNodeModules '@primno/dpapi/prebuilds/win32-x64/@primno+dpapi.node'
      if (-not (Test-Path -LiteralPath $dpapiPackagePath) -or -not (Test-Path -LiteralPath $dpapiNativeAddon)) {
        throw 'Falta @primno/dpapi o su binario Windows x64 en las dependencias de producción del payload.'
      }
      $dpapiRuntimeSmoke = @'
import { Dpapi, isPlatformSupported } from '@primno/dpapi';
if (process.platform !== 'win32' || !isPlatformSupported) throw new Error('DPAPI CurrentUser is unavailable.');
const original = Buffer.from('EvaluaPro-Classroom-DPAPI-smoke', 'utf8');
const entropy = Buffer.from('EvaluaPro/Classroom/OAuthToken/v1', 'utf8');
const protectedValue = Dpapi.protectData(original, entropy, 'CurrentUser');
const restored = Dpapi.unprotectData(protectedValue, entropy, 'CurrentUser');
if (Buffer.compare(original, Buffer.from(restored)) !== 0) throw new Error('DPAPI roundtrip mismatch.');
'@
      $dpapiSmokeOutput = @(& $nodeForBuild --input-type=module -e $dpapiRuntimeSmoke 2>&1 | ForEach-Object { [string]$_ })
      if ($LASTEXITCODE -ne 0) {
        throw "@primno/dpapi no pudo cifrar/descifrar como CurrentUser en el payload: $($dpapiSmokeOutput -join ' ')"
      }
      Write-Host '[msi] Runtime DPAPI CurrentUser validado con roundtrip efimero.'

      # npm ci se ejecuta con scripts deshabilitados en el staging. Reutilizar
      # el addon que npm preparó para el mismo Node Windows del build para que
      # el runtime SQLite no dependa de compilar código C++ en el equipo destino.
      $stagedSqliteAddon = Join-Path $runtimeNodeModules 'better-sqlite3/build/Release/better_sqlite3.node'
      if (-not (Test-Path -LiteralPath $stagedSqliteAddon)) {
        $builtSqliteAddon = Join-Path $RootPath 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'
        if (-not (Test-Path -LiteralPath $builtSqliteAddon)) {
          throw "No se encontró el addon SQLite para Node Windows: $builtSqliteAddon"
        }
        New-Item -ItemType Directory -Path (Split-Path $stagedSqliteAddon -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $builtSqliteAddon -Destination $stagedSqliteAddon -Force
      }

      $sqliteRuntimeSmoke = @'
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file::memory:' }) });
try {
  const rows = await client.$queryRawUnsafe('SELECT 1 AS value');
  if (Number(rows?.[0]?.value) !== 1) throw new Error('SQLite smoke returned an unexpected result.');
} finally {
  await client.$disconnect();
}
'@
      $sqliteSmokeOutput = @(& $nodeForBuild --input-type=module -e $sqliteRuntimeSmoke 2>&1 | ForEach-Object { [string]$_ })
      if ($LASTEXITCODE -ne 0) {
        throw "Prisma/SQLite no pudo completar su smoke de runtime: $($sqliteSmokeOutput -join ' ')"
      }
      Write-Host '[msi] Runtime Prisma/SQLite validado con consulta en memoria.'
      Write-Host '[msi] Payload nativo podado: se conserva únicamente Prisma SQLite/Windows y dependencias de ejecución.'
    } finally {
      Pop-Location
    }
    Write-Host '[msi] Payload compilado agregado al staging.'
  } finally {
    Pop-Location
  }
}

function New-DocentePayloadArchive {
  param(
    [Parameter(Mandatory = $true)][string]$StagingRoot,
    [Parameter(Mandatory = $true)][string]$OutputPath
  )

  $required = @(
    'apps/backend/dist/index.js',
    'apps/backend/dist/prisma/schema.sql',
    'runtime/node/node.exe',
    'scripts/start-docente-native.mjs',
    'scripts/runtime-env.mjs',
    'scripts/migrate-calificacion-origen-inferida-sqlite.mjs',
    'scripts/migrate-preferencias-retencion-parcial-sqlite.mjs',
    'scripts/migrate-resultados-extra-externos-sqlite.mjs'
  )
  foreach ($relativePath in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $StagingRoot $relativePath))) {
      throw "Payload nativo incompleto: falta $relativePath"
    }
  }

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
  $archive = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
  $stagingFullPath = [System.IO.Path]::GetFullPath($StagingRoot).TrimEnd([char[]]@('\', '/'))
  $stagingPrefix = $stagingFullPath + [System.IO.Path]::DirectorySeparatorChar
  try {
    foreach ($file in Get-ChildItem -LiteralPath $StagingRoot -File -Recurse -Force) {
      $fullFilePath = [System.IO.Path]::GetFullPath($file.FullName)
      if (-not $fullFilePath.StartsWith($stagingPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Archivo de payload fuera del staging: $fullFilePath"
      }
      $relative = $fullFilePath.Substring($stagingPrefix.Length) -replace '\\', '/'
      if ($relative -match '(^|/)scripts/installer-burn/' -or $relative -match '\.(ps1|psm1|vbs)$') { continue }
      $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal
      )
    }
  } finally { $archive.Dispose() }
  $archiveInfo = Get-Item -LiteralPath $OutputPath
  if ($archiveInfo.Length -lt 1MB) {
    throw "Payload ZIP sospechosamente pequeño: $OutputPath ($($archiveInfo.Length) bytes)"
  }
  Write-Host "[msi] Payload ZIP autocontenido: $OutputPath ($([Math]::Round($archiveInfo.Length / 1MB, 1)) MB)"
  return $OutputPath
}

function Write-InstallerLocalPathsManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object[]]$FlavorDefinitions,
    [Parameter(Mandatory = $true)]
    [string]$PublicOutputDirectory,
    [Parameter(Mandatory = $true)]
    [string]$InternalOutputDirectory,
    [hashtable]$BundleNameByFlavor
  )

  $manifestPath = Join-Path $OutputDirectory 'installer-local-paths.json'
  $recommended = $FlavorDefinitions | Where-Object { [string]$_.flavorId -eq 'docente-local' } | Select-Object -First 1
  if (-not $recommended) {
    $recommended = $FlavorDefinitions | Select-Object -First 1
  }

  $payload = [ordered]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
    outputDir = $OutputDirectory
    publicOutputDir = $PublicOutputDirectory
    internalOutputDir = $InternalOutputDirectory
    recommendedFlavorId = if ($recommended) { [string]$recommended.flavorId } else { '' }
    recommendedHubExecutableName = if ($recommended) {
      $rid = [string]$recommended.flavorId
      if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
    } else { '' }
    recommendedHubExecutablePath = if ($recommended) {
      $rid = [string]$recommended.flavorId
      $rname = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
      [string](Join-Path (Join-Path $PublicOutputDirectory $rid) $rname)
    } else { '' }
    recommended = if ($recommended) {
      $rid = [string]$recommended.flavorId
      $rname = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($rid)) { [string]$BundleNameByFlavor[$rid] } else { [string]$recommended.bundleName }
      [ordered]@{
        flavorId = $rid
        bundleName = $rname
        bundlePublicPath = [string](Join-Path (Join-Path $PublicOutputDirectory $rid) $rname)
      }
    } else {
      $null
    }
    artifacts = @($FlavorDefinitions | ForEach-Object {
      $id = [string]$_.flavorId
      $effectiveBundleName = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($id)) { [string]$BundleNameByFlavor[$id] } else { [string]$_.bundleName }
      [ordered]@{
        flavorId = $id
        displayName = [string]$_.displayName
        bundleName = $effectiveBundleName
        bundlePublicPath = [string](Join-Path (Join-Path $PublicOutputDirectory $id) $effectiveBundleName)
        bundleInternalPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) $effectiveBundleName)
        msiName = [string]$_.msiName
        msiInternalPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) ([string]$_.msiName))
      }
    })
    flavors = @($FlavorDefinitions | ForEach-Object {
      $id = [string]$_.flavorId
      $effectiveBundleName = if ($BundleNameByFlavor -and $BundleNameByFlavor.ContainsKey($id)) { [string]$BundleNameByFlavor[$id] } else { [string]$_.bundleName }
      [ordered]@{
        flavorId = $id
        displayName = [string]$_.displayName
        executableName = $effectiveBundleName
        executablePath = [string](Join-Path (Join-Path $PublicOutputDirectory $id) $effectiveBundleName)
        executableRelativePath = [string]([System.IO.Path]::Combine($id, $effectiveBundleName))
        internalMsiPath = [string](Join-Path (Join-Path $InternalOutputDirectory $id) ([string]$_.msiName))
      }
    })
  }

  ($payload | ConvertTo-Json -Depth 6) | Set-Content -Path $manifestPath -Encoding utf8
    $publicManifestPath = Join-Path $PublicOutputDirectory 'installer-local-paths.json'
    $internalManifestPath = Join-Path $InternalOutputDirectory 'installer-local-paths.json'
    if ($publicManifestPath -ne $manifestPath) {
      Copy-Item -LiteralPath $manifestPath -Destination $publicManifestPath -Force
    }
    if ($internalManifestPath -ne $manifestPath) {
      Copy-Item -LiteralPath $manifestPath -Destination $internalManifestPath -Force
    }
}

function Get-IcoImageSizes {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  $bytes = [System.IO.File]::ReadAllBytes($IconPath)
  if ($bytes.Length -lt 6) {
    throw "Icono invalido (cabecera incompleta): $IconPath"
  }

  $reserved = [BitConverter]::ToUInt16($bytes, 0)
  $iconType = [BitConverter]::ToUInt16($bytes, 2)
  $entryCount = [BitConverter]::ToUInt16($bytes, 4)

  if ($reserved -ne 0 -or $iconType -ne 1 -or $entryCount -lt 1) {
    throw "Icono invalido (formato ICO no reconocido): $IconPath"
  }

  $sizes = New-Object 'System.Collections.Generic.HashSet[int]'
  for ($i = 0; $i -lt $entryCount; $i++) {
    $entryOffset = 6 + ($i * 16)
    if (($entryOffset + 15) -ge $bytes.Length) { break }

    $rawWidth = [int]$bytes[$entryOffset]
    $rawHeight = [int]$bytes[$entryOffset + 1]
    $width = if ($rawWidth -eq 0) { 256 } else { $rawWidth }
    $height = if ($rawHeight -eq 0) { 256 } else { $rawHeight }
    if ($width -eq $height) {
      [void]$sizes.Add($width)
    }
  }

  return @($sizes | Sort-Object)
}

function Assert-CanonicalInstallerIcon {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  if (-not (Test-Path $IconPath)) {
    throw "No existe icono canónico del installer: $IconPath"
  }

  $requiredSizes = @(16, 24, 32, 48, 64, 128, 256)
  $actualSizes = @(Get-IcoImageSizes -IconPath $IconPath)
  $missingSizes = @($requiredSizes | Where-Object { $actualSizes -notcontains $_ })
  if ($missingSizes.Count -gt 0) {
    throw "Icono canónico inválido. Faltan tamaños ICO requeridos: $($missingSizes -join ', '). Detectados: $($actualSizes -join ', ')"
  }

  Write-Host "[msi] Icono canónico validado: $IconPath (sizes: $($actualSizes -join ', '))"
}

function Assert-BundleIconCompatible {
  param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath
  )

  if (-not (Test-Path $IconPath)) {
    throw "No existe icono de bundle: $IconPath"
  }

  $sizes = @(Get-IcoImageSizes -IconPath $IconPath)
  if ($sizes.Count -lt 1) {
    throw "Icono de bundle inválido (sin tamaños detectables): $IconPath"
  }

  Write-Host "[msi] Icono de bundle validado: $IconPath (sizes: $($sizes -join ', '))"
}

function Invoke-CheckedStep {
  param(
    [int]$Index,
    [int]$Total,
    [string]$Title,
    [string]$Command,
    [int]$TimeoutSeconds = 900
  )

  $pct = [Math]::Floor((($Index - 1) * 100) / [Math]::Max(1, $Total))
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status $Title -PercentComplete $pct
  Write-Host "[msi][step $Index/$Total] $Title"
  # Ejecutar npm.cmd directamente evita que una segunda capa cmd.exe propague
  # de forma intermitente un exit code incorrecto al proceso PowerShell padre.
  $commandParts = @($Command -split '\s+')
  $executable = $commandParts[0]
  $arguments = @($commandParts | Select-Object -Skip 1)
  if ($executable -eq 'npm') {
    $npmCommand = Get-Command npm.cmd -ErrorAction Stop
    $executable = $npmCommand.Source
  }
  if ($executable -like '*npm.cmd') {
    Push-Location $root
    try {
      & $executable @arguments
      $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 1 }
    } finally {
      Pop-Location
    }
  } else {
    $proc = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $root -NoNewWindow -PassThru
    $completed = $proc.WaitForExit($TimeoutSeconds * 1000)
    if (-not $completed) {
      Write-Warning "Paso '$Title' excedió el límite de $TimeoutSeconds segundos; se terminará su árbol de procesos."
      & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
      throw "Timeout en paso '$Title' después de $TimeoutSeconds segundos: $Command"
    }
    $exitCode = if ($null -ne $proc -and $null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 1 }
  }
  if ($exitCode -ne 0) {
    throw "Fallo en paso '$Title' (exit=$exitCode): $Command"
  }
}

function Assert-BurnBundleAttachedContainer {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WixExecutable,
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,
    [Parameter(Mandatory = $true)]
    [int64]$MinimumPayloadBytes
  )

  if (-not (Test-Path -LiteralPath $BundlePath)) {
    throw "No existe bundle Burn para validar contenedor adjunto: $BundlePath"
  }

  $extractRoot = Join-Path $env:TEMP ("evaluapro-burn-extract-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  try {
    $extractArgs = @('burn', 'extract', $BundlePath, '-out', $extractRoot)
    $extractExit = Invoke-WixBuildProcess -WixExecutable $WixExecutable -Arguments $extractArgs
    if ($extractExit -ne 0) {
      throw "Falló validacion de contenedor Burn para $BundlePath (exit=$extractExit)"
    }

    $payloads = @(Get-ChildItem -LiteralPath $extractRoot -File -Recurse -ErrorAction SilentlyContinue)
    $largestPayload = @($payloads | Sort-Object Length -Descending | Select-Object -First 1)
    $largestPayloadBytes = if ($largestPayload.Count -gt 0) { [int64]$largestPayload[0].Length } else { [int64]0 }
    if ($payloads.Count -lt 1 -or $largestPayload.Count -lt 1 -or $largestPayloadBytes -lt $MinimumPayloadBytes) {
      throw "Bundle Burn sin payload adjunto suficiente: $BundlePath. Payloads=$($payloads.Count), maxBytes=$largestPayloadBytes, esperadoMinimo=$MinimumPayloadBytes"
    }

    Write-Host "[msi] Contenedor Burn validado: $BundlePath (payloads=$($payloads.Count), maxBytes=$largestPayloadBytes)"
  } finally {
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Assert-InstallerHubBundleVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion,
    [Parameter(Mandatory = $true)]
    [string]$WixExecutable
  )

  $guardScript = Join-Path $root 'scripts\assert-installer-hub-bundle.ps1'
  if (-not (Test-Path -LiteralPath $guardScript)) {
    throw "No existe guard de bundle Installer Hub: $guardScript"
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardScript -BundlePath $BundlePath -ExpectedVersion $ExpectedVersion -WixExecutable $WixExecutable
  if ($LASTEXITCODE -ne 0) {
    throw "Falló guard de versión del bundle Installer Hub (exit=$LASTEXITCODE): $BundlePath"
  }
}

function Assert-MsiAdministrativeExtractionContainsAppPayload {
  param(
    [Parameter(Mandatory = $true)]
    [string]$MsiPath,
    [Parameter(Mandatory = $true)]
    [string]$InstallFolderName,
    [switch]$RequireDocenteNativePayload
  )
  if (-not (Test-Path -LiteralPath $MsiPath)) {
    throw "MSI no existe para validar payload instalado: $MsiPath"
  }
  $extractRoot = Join-Path $env:TEMP ("evaluapro-msi-admin-extract-{0}" -f [Guid]::NewGuid().ToString('N'))
  $msiLog = "$extractRoot.log"
  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  $payloadCheckRoot = $null
  $validated = $false
  try {
    # El build comprueba contenido mediante instalación administrativa: /a
    # extrae al staging temporal y evita registrar/desinstalar el producto MSI
    # en el host. Las transacciones /i, repair y /x se reservan al E2E de CI
    # en un runner Windows desechable.
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/a', $MsiPath, "TARGETDIR=$extractRoot", 'REQUIRE_INSTALLER_HUB=1', 'BURNMSIINSTALL=1', 'INSTALL_DESKTOP_SHORTCUTS=0', 'INSTALL_STARTMENU_SHORTCUTS=0', '/qn', '/norestart', '/L*v', $msiLog) -NoNewWindow -PassThru
    if (-not $proc.WaitForExit(300000)) {
      & taskkill.exe /PID $proc.Id /T /F | Out-Null
      throw "Extracción administrativa MSI excedió 300 segundos y se canceló: $MsiPath. Evidencia: $msiLog"
    }
    $proc.Refresh()
    if (-not $proc.HasExited) {
      throw "Extracción administrativa MSI no confirmó su terminación: $MsiPath. Evidencia: $msiLog"
    }
    $installExitCode = [int]$proc.ExitCode
    if ($installExitCode -ne 0) {
      throw "Extracción administrativa MSI falló (exit=$installExitCode). Log: $msiLog"
    }
    # La extracción administrativa puede conservar el INSTALLFOLDER original
    # debajo de TARGETDIR; recoge rutas completas para validar el mismo archivo
    # que MSI colocó realmente, no una ruta supuesta en la raíz temporal.
    $packageArtifacts = @(
      Get-ChildItem -LiteralPath $extractRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -in @('package.json', 'evaluapro-native-dist.zip') }
    )
    $packageOk = $packageArtifacts.Count -gt 0
    if (-not $packageOk) {
      $sample = @(Get-ChildItem -LiteralPath $extractRoot -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 20 -ExpandProperty FullName)
      throw "MSI no instala bootstrap/payload bajo carpeta de producto '$InstallFolderName'. Muestras: $($sample -join ' | ')"
    }
    if ($RequireDocenteNativePayload) {
      $nativePayloadArchive = $packageArtifacts | Where-Object { $_.Name -eq 'evaluapro-native-dist.zip' } | Select-Object -First 1
      if (-not $nativePayloadArchive) {
        throw "MSI docente sin payload nativo completo: falta evaluapro-native-dist.zip bajo '$extractRoot'."
      }
      $payloadCheckRoot = Join-Path $env:TEMP ("evaluapro-msi-payload-check-{0}" -f [Guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Path $payloadCheckRoot -Force | Out-Null
      try {
        Expand-Archive -LiteralPath $nativePayloadArchive.FullName -DestinationPath $payloadCheckRoot -Force
        foreach ($relativePath in @('apps\backend\dist\index.js', 'apps\backend\dist\prisma\schema.sql', 'apps\frontend\dist-docente\index.html', 'runtime\node\node.exe', 'scripts\prepare-docente-sqlite.mjs', 'scripts\runtime-env.mjs', 'scripts\docente-bundle-guard.mjs', 'scripts\verify-docente-bundle.mjs')) {
          if (-not (Test-Path -LiteralPath (Join-Path $payloadCheckRoot $relativePath))) { throw "MSI docente sin payload nativo completo: falta $relativePath" }
        }
        $payloadNode = Join-Path $payloadCheckRoot 'runtime/node/node.exe'
        $bundleVerifier = Join-Path $payloadCheckRoot 'scripts/verify-docente-bundle.mjs'
        $frontendBundle = Join-Path $payloadCheckRoot 'apps/frontend/dist-docente'
        & $payloadNode $bundleVerifier --dist $frontendBundle
        if ($LASTEXITCODE -ne 0) { throw 'El CSS del bundle docente dentro del MSI no superó la guardia de estilos.' }
      } finally {
        Remove-Item -LiteralPath $payloadCheckRoot -Recurse -Force -ErrorAction SilentlyContinue
      }
    }
    $validated = $true
    Write-Host "[msi] Extracción administrativa validada: bootstrap + payload íntegro; el producto MSI no se registró en el host."
  } finally {
    if ($validated -and (Test-Path -LiteralPath $extractRoot)) {
      Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($validated) {
      Remove-Item -LiteralPath $msiLog -Force -ErrorAction SilentlyContinue
    } else {
      Write-Warning "Se conserva la extracción parcial y el log para diagnóstico: $extractRoot; $msiLog"
    }
  }
}

function Resolve-BalExtensionDll {
  param(
    [string]$WixExecutable,
    [Version]$WixVersion,
    [string]$RootPath
  )

  $balPackageRef = "WixToolset.Bal.wixext/$($WixVersion.ToString())"
  $addProc = Start-Process -FilePath $WixExecutable -WorkingDirectory $RootPath -ArgumentList @('extension', 'add', $balPackageRef) -Wait -NoNewWindow -PassThru
  if ([int]$addProc.ExitCode -ne 0) {
    throw "No se pudo instalar extensión BAL de WiX (exit=$($addProc.ExitCode)): $balPackageRef"
  }

  $balDllCandidates = @(
    (Join-Path $RootPath ".wix\extensions\WixToolset.Bal.wixext\$($WixVersion.ToString())\wixext7\WixToolset.BootstrapperApplications.wixext.dll"),
    (Join-Path $RootPath ".wix\extensions\WixToolset.Bal.wixext\$($WixVersion.ToString())\wixext7\WixToolset.Bal.wixext.dll")
  )

  $balDll = $balDllCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $balDll) {
    throw "No se pudo resolver extensión BAL de WiX 7. Esperado paquete $balPackageRef en .wix/extensions."
  }

  return $balDll
}

function Invoke-WixBuildProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WixExecutable,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $timeoutSeconds = 540
  if ($env:EVALUAPRO_WIX_PROCESS_TIMEOUT_SECONDS -match '^\d+$') {
    $timeoutSeconds = [Math]::Max(60, [int]$env:EVALUAPRO_WIX_PROCESS_TIMEOUT_SECONDS)
  }
  $wixOut = Join-Path $env:TEMP ("evaluapro-wix-build-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
  $wixErr = Join-Path $env:TEMP ("evaluapro-wix-build-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
  try {
    $proc = Start-Process -FilePath $WixExecutable -ArgumentList $Arguments -NoNewWindow -PassThru -RedirectStandardOutput $wixOut -RedirectStandardError $wixErr
    if (-not $proc.WaitForExit($timeoutSeconds * 1000)) {
      if (Test-Path -LiteralPath $wixOut) {
        Get-Content -LiteralPath $wixOut -ErrorAction SilentlyContinue | Out-Host
      }
      if (Test-Path -LiteralPath $wixErr) {
        Get-Content -LiteralPath $wixErr -ErrorAction SilentlyContinue | Out-Host
      }
      $children = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $proc.Id })
      foreach ($child in $children) {
        Stop-Process -Id ([int]$child.ProcessId) -Force -ErrorAction SilentlyContinue
      }
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
      throw "WiX excedio timeout de $timeoutSeconds segundos: $WixExecutable $($Arguments -join ' ')"
    }
    if (Test-Path -LiteralPath $wixOut) {
      Get-Content -LiteralPath $wixOut -ErrorAction SilentlyContinue | Out-Host
    }
    if (Test-Path -LiteralPath $wixErr) {
      Get-Content -LiteralPath $wixErr -ErrorAction SilentlyContinue | Out-Host
    }
    $proc.Refresh()
    if (-not $proc.HasExited) {
      throw "WiX no confirmó la terminación del proceso: $WixExecutable $($Arguments -join ' ')"
    }
    return [int]$proc.ExitCode
  } finally {
    if (Test-Path -LiteralPath $wixOut) { Remove-Item -LiteralPath $wixOut -Force -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $wixErr) { Remove-Item -LiteralPath $wixErr -Force -ErrorAction SilentlyContinue }
  }
}

function Resolve-DotNetExecutable {
  $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
  if ($dotnetCmd) {
    return $dotnetCmd.Source
  }

  $candidates = @(
    "$env:ProgramFiles\dotnet\dotnet.exe",
    "${env:ProgramFiles(x86)}\dotnet\dotnet.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $candidateList = @($candidates)
  if ($candidateList.Count -gt 0) {
    return $candidateList[0]
  }

  throw 'No se encontro dotnet.exe. Instala .NET SDK 8 para compilar la Bootstrapper Application.'
}

function Resolve-GitExecutable {
  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if ($gitCmd) {
    return $gitCmd.Source
  }

  $candidates = @(
    "$env:ProgramFiles\Git\cmd\git.exe",
    "$env:ProgramFiles\Git\bin\git.exe",
    "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
    "${env:ProgramFiles(x86)}\Git\bin\git.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $candidateList = @($candidates)
  if ($candidateList.Count -gt 0) {
    return $candidateList[0]
  }

  throw 'No se encontró git.exe. Instala Git for Windows para preparar el staging del instalador.'
}

function Resolve-InstallerVersionTag {
  param(
    [string]$RootPath,
    [string]$RequestedVersion
  )

  $resolved = [string]$RequestedVersion
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $hubVersionPath = Join-Path $RootPath 'config\hub-version.json'
    if (Test-Path -LiteralPath $hubVersionPath) {
      $hubVersion = Get-Content -LiteralPath $hubVersionPath -Raw -Encoding utf8 | ConvertFrom-Json
      $resolved = [string]$hubVersion.version
    }
  }
  if ([string]::IsNullOrWhiteSpace($resolved)) {
    $resolved = '0.0.0'
  }
  return (($resolved -replace '[^0-9A-Za-z\.-]', '-').Trim())
}

function Get-VersionedBundleName {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseName,
    [Parameter(Mandatory = $true)]
    [string]$VersionTag
  )

  if ([string]::IsNullOrWhiteSpace($VersionTag)) {
    return $BaseName
  }

  $ext = [System.IO.Path]::GetExtension($BaseName)
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($BaseName)
  if ([string]::IsNullOrWhiteSpace($ext)) {
    return ("{0}-v{1}" -f $BaseName, $VersionTag)
  }
  return ("{0}-v{1}{2}" -f $stem, $VersionTag, $ext)
}

function ConvertTo-DotNetNumericVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$VersionTag
  )

  # .NET AssemblyVersion/FileVersion solo admiten hasta cuatro componentes
  # numericos. Conservamos el semver completo en InformationalVersion y usamos
  # sus componentes numericos para la identidad binaria.
  $match = [Regex]::Match($VersionTag, '^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?')
  if (-not $match.Success) {
    throw "La version del instalador no contiene un prefijo numerico compatible con .NET: $VersionTag"
  }

  $parts = @(
    [int64]$match.Groups[1].Value,
    $(if ($match.Groups[2].Success) { [int64]$match.Groups[2].Value } else { 0 }),
    $(if ($match.Groups[3].Success) { [int64]$match.Groups[3].Value } else { 0 }),
    $(if ($match.Groups[4].Success) { [int64]$match.Groups[4].Value } else { 0 })
  )
  if ($parts | Where-Object { $_ -gt 65535 }) {
    throw "La version del instalador excede el limite numerico de .NET: $VersionTag"
  }
  return ($parts -join '.')
}

function Publish-BurnBootstrapperApp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DotNetExecutable,
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [string]$ConfigurationName = 'Release',
    [string]$VersionTag,
    [string]$AppVersion
  )

  if (-not (Test-Path $ProjectPath)) {
    throw "No existe proyecto de Bootstrapper Application: $ProjectPath"
  }

  if (Test-Path $OutputDirectory) {
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  $dotNetNumericVersion = ConvertTo-DotNetNumericVersion -VersionTag $VersionTag

  $publishArgs = @(
    'publish',
    $ProjectPath,
    '-c', $ConfigurationName,
    '-r', 'win-x64',
    '--self-contained', 'true',
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:EnableCompressionInSingleFile=true'
  )
  if (![string]::IsNullOrEmpty($VersionTag)) {
    $publishArgs += @(
      "-p:Version=$VersionTag",
      "-p:AssemblyVersion=$dotNetNumericVersion",
      "-p:FileVersion=$dotNetNumericVersion",
      "-p:InformationalVersion=$VersionTag",
      "-p:EvaluaProAppVersion=$AppVersion"
    )
  }
  $publishArgs += @('-o', $OutputDirectory)
  # Contract marker for installer-hub tests: "$DotNetExecutable publish"
  Write-Verbose ("[msi] command: {0} publish {1}" -f $DotNetExecutable, ($publishArgs -join ' '))
  $publishTimeoutSeconds = 600
  if ($env:EVALUAPRO_BA_PUBLISH_TIMEOUT_SECONDS -match '^\d+$') {
    $publishTimeoutSeconds = [Math]::Max(60, [int]$env:EVALUAPRO_BA_PUBLISH_TIMEOUT_SECONDS)
  }
  $publishOut = Join-Path $env:TEMP ("evaluapro-ba-publish-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
  $publishErr = Join-Path $env:TEMP ("evaluapro-ba-publish-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
  try {
    $publishProc = Start-Process -FilePath $DotNetExecutable -ArgumentList $publishArgs -NoNewWindow -PassThru -RedirectStandardOutput $publishOut -RedirectStandardError $publishErr
    if (-not $publishProc.WaitForExit($publishTimeoutSeconds * 1000)) {
      & taskkill.exe /PID ([string]$publishProc.Id) /T /F | Out-Null
      throw "Publish de Bootstrapper Application excedió ${publishTimeoutSeconds}s."
    }
    $publishProc.WaitForExit()
    $publishProc.Refresh()
    if (-not $publishProc.HasExited) {
      throw 'Publish de Bootstrapper Application no confirmó la terminación.'
    }
    if (Test-Path -LiteralPath $publishOut) { Get-Content -LiteralPath $publishOut -ErrorAction SilentlyContinue | Out-Host }
    if (Test-Path -LiteralPath $publishErr) { Get-Content -LiteralPath $publishErr -ErrorAction SilentlyContinue | Out-Host }
    if ([int]$publishProc.ExitCode -ne 0) {
      throw ("Fallo publish de la Bootstrapper Application Burn (exit={0})." -f [int]$publishProc.ExitCode)
    }
  } finally {
    Remove-Item -LiteralPath $publishOut,$publishErr -Force -ErrorAction SilentlyContinue
  }

  $exePath = Join-Path $OutputDirectory 'EvaluaPro.BurnBootstrapperApp.exe'
  if (-not (Test-Path $exePath)) {
    throw "No se genero el ejecutable de la Bootstrapper Application: $exePath"
  }

  if (![string]::IsNullOrEmpty($VersionTag)) {
    $fileVersionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exePath)
    $fileVersion = [string]$fileVersionInfo.FileVersion
    $productVersion = [string]$fileVersionInfo.ProductVersion
    $dotNetNumericVersion = ConvertTo-DotNetNumericVersion -VersionTag $VersionTag
    if ($fileVersion -notlike "$dotNetNumericVersion*" -or $productVersion -notlike "$VersionTag*") {
      throw "Bootstrapper Application Burn publicada con version invalida. Esperada semver=$VersionTag, FileVersion numerica=$dotNetNumericVersion, FileVersion=$fileVersion, ProductVersion=$productVersion, Path=$exePath"
    }
  }

  return $exePath
}

function Resolve-BurnBootstrapperAppExe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [string]$ConfigurationName = 'Release',
    [string]$VersionTag,
    [string]$AppVersion
  )

  $dotnetExe = Resolve-DotNetExecutable
  $bootstrapperProject = Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\EvaluaPro.BurnBootstrapperApp.csproj'
  $bootstrapperOut = Join-Path $RootPath 'dist\installer\_internal\burn-bootstrapper-app'
  # Cuando hay VersionTag (build de release), siempre compilar fresh para que el
  # binario lleve la versión correcta embebida. Nunca reutilizar un binario obsoleto
  # que podria tener una versión anterior hardcodeada en sus atributos de ensamblado.
  if (-not [string]::IsNullOrWhiteSpace($VersionTag)) {
    Write-Host "[msi] Compilando Bootstrapper Application con versión: $VersionTag"
    return (Publish-BurnBootstrapperApp -DotNetExecutable $dotnetExe -ProjectPath $bootstrapperProject -OutputDirectory $bootstrapperOut -ConfigurationName $ConfigurationName -VersionTag $VersionTag -AppVersion $AppVersion)
  }

  # Sin VersionTag (desarrollo local): reutilizar binario pre-existente si hay uno
  # para ahorrar tiempo de compilación.
  $candidatePaths = @(
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Release\net8.0-windows\win-x64\publish\EvaluaPro.BurnBootstrapperApp.exe'),
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Release\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe'),
    (Join-Path $RootPath 'packaging\wix\BurnBootstrapperApp\bin\Debug\net8.0-windows\win-x64\EvaluaPro.BurnBootstrapperApp.exe')
  )

  foreach ($candidatePath in $candidatePaths) {
    if (Test-Path -LiteralPath $candidatePath) {
      Write-Host "[msi] Reutilizando Bootstrapper Application Burn ya publicada: $candidatePath"
      return $candidatePath
    }
  }

  return (Publish-BurnBootstrapperApp -DotNetExecutable $dotnetExe -ProjectPath $bootstrapperProject -OutputDirectory $bootstrapperOut -ConfigurationName $ConfigurationName -VersionTag $VersionTag -AppVersion $AppVersion)
}

function Get-SelectedFlavors {
  param(
    [string]$CatalogPath,
    [string]$RequestedFlavor
  )

  if (-not (Test-Path $CatalogPath)) {
    throw "No existe catalogo de flavors: $CatalogPath"
  }

  $catalog = Get-Content -Path $CatalogPath -Raw -Encoding utf8 | ConvertFrom-Json
  $flavors = @($catalog.flavors)
  $requested = [string]$RequestedFlavor
  if ([string]::IsNullOrWhiteSpace($requested) -or $requested -eq 'all') { return $flavors }

  $requestedIds = @($requested.Split(',') | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  if ($requestedIds.Count -eq 0) { return $flavors }

  return @($flavors | Where-Object { $requestedIds -contains [string]$_.flavorId })
}

function New-ScopedFlavorCatalog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceCatalogPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object]$FlavorDefinition,
    [string]$EffectiveBundleName = ''
  )

  $sourceCatalog = Get-Content -Path $SourceCatalogPath -Raw -Encoding utf8 | ConvertFrom-Json
  $flavorId = [string]$FlavorDefinition.flavorId

  $effectiveFlavor = $FlavorDefinition.PSObject.Copy()
  if (-not [string]::IsNullOrWhiteSpace($EffectiveBundleName)) {
    $effectiveFlavor.bundleName = $EffectiveBundleName
    $effectiveFlavor.installerHubExeName = $EffectiveBundleName
  }

  $scoped = [ordered]@{
    version = if ($null -ne $sourceCatalog.version) { [int]$sourceCatalog.version } else { 1 }
    defaultFlavorId = $flavorId
    flavors = @($effectiveFlavor)
  }

  $scopedDir = Join-Path $OutputDirectory 'bundle-input'
  New-Item -ItemType Directory -Path $scopedDir -Force | Out-Null
  $scopedPath = Join-Path $scopedDir ("installer-flavors.{0}.json" -f $flavorId)
  ($scoped | ConvertTo-Json -Depth 10) | Set-Content -Path $scopedPath -Encoding utf8
  return $scopedPath
}

function New-FlavorBundleIcon {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,
    [Parameter(Mandatory = $true)]
    [object]$FlavorDefinition
  )

  $flavorId = [string]$FlavorDefinition.flavorId
  $iconScript = Join-Path $RootPath 'scripts\icons\generate-installer-flavor-icon.ps1'
  if (-not (Test-Path -LiteralPath $iconScript)) {
    throw "No existe script de icono por flavor: $iconScript"
  }

  $iconsOutDir = Join-Path $OutputDirectory 'bundle-input\icons'
  New-Item -ItemType Directory -Path $iconsOutDir -Force | Out-Null
  $iconPath = Join-Path $iconsOutDir ("installer-icon.{0}.ico" -f $flavorId)

  $iconProc = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $iconScript, '-FlavorId', $flavorId, '-OutputPath', $iconPath) -Wait -NoNewWindow -PassThru
  $iconExit = [int]$iconProc.ExitCode
  if ($iconExit -ne 0) {
    throw "No se pudo generar icono por flavor para '$flavorId'."
  }

  Assert-BundleIconCompatible -IconPath $iconPath
  return $iconPath
}

function Invoke-InstallerHashesGeneration {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RootPath,
    [string]$RequestedVersion = '',
    [string]$RequestedAppVersion = '',
    [string]$Channel = 'stable',
    [string]$FlavorId = ''
  )

  $hashScript = Join-Path $RootPath 'scripts\generate-installer-hashes.ps1'
  if (-not (Test-Path -LiteralPath $hashScript)) {
    throw "No existe script de hashes del installer: $hashScript"
  }

  $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hashScript)
  if (-not [string]::IsNullOrWhiteSpace($RequestedVersion)) {
    $args += @('-Version', $RequestedVersion)
  }
  if (-not [string]::IsNullOrWhiteSpace($RequestedAppVersion)) {
    $args += @('-AppVersion', $RequestedAppVersion)
  }
  if (-not [string]::IsNullOrWhiteSpace($Channel)) {
    $args += @('-Channel', $Channel)
  }
  if (-not [string]::IsNullOrWhiteSpace($FlavorId)) {
    $args += @('-FlavorId', $FlavorId)
  }

  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Wait -NoNewWindow -PassThru
  $exitCode = if ($null -ne $proc -and $null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 1 }
  if ($exitCode -ne 0) {
    throw "No se pudieron generar hashes del installer (exit=$exitCode)."
  }
}

if (-not (Test-Path $wix)) {
  throw "No existe carpeta WiX en $wix"
}

$wixExe = $null
$wixCmd = Get-Command wix -ErrorAction SilentlyContinue
if ($wixCmd) {
  $wixExe = $wixCmd.Source
} else {
  $wixCandidates = @(
    "$env:ProgramFiles\WiX Toolset v7.0\bin\wix.exe",
    "${env:ProgramFiles(x86)}\WiX Toolset v7.0\bin\wix.exe",
    "$env:ProgramFiles\WiX Toolset v7.0\bin\wix.cmd",
    "${env:ProgramFiles(x86)}\WiX Toolset v7.0\bin\wix.cmd"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $wixCandidateList = @($wixCandidates)
  if ($wixCandidateList.Count -gt 0) {
    $wixExe = $wixCandidateList[0]
  }
}

if (-not $wixExe) {
  throw "No se encontró CLI de WiX (wix.exe). Instala WiX Toolset v7.0.x estable y agrega 'wix' al PATH."
}

$wixVersionStdOut = Join-Path $env:TEMP ("evaluapro-wix-version-{0}.out.log" -f [Guid]::NewGuid().ToString('N'))
$wixVersionStdErr = Join-Path $env:TEMP ("evaluapro-wix-version-{0}.err.log" -f [Guid]::NewGuid().ToString('N'))
$wixVersionRaw = ''
try {
  $versionProc = Start-Process -FilePath $wixExe -ArgumentList @('--version') -Wait -NoNewWindow -PassThru -RedirectStandardOutput $wixVersionStdOut -RedirectStandardError $wixVersionStdErr
  if ([int]$versionProc.ExitCode -ne 0) {
    throw "No se pudo ejecutar WiX --version (exit=$($versionProc.ExitCode))."
  }
  $wixVersionOutput = ''
  if (Test-Path -LiteralPath $wixVersionStdOut) {
    $wixVersionOutput = Get-Content -LiteralPath $wixVersionStdOut -Raw -ErrorAction SilentlyContinue
  }
  if ([string]::IsNullOrWhiteSpace([string]$wixVersionOutput) -and (Test-Path -LiteralPath $wixVersionStdErr)) {
    $wixVersionOutput = Get-Content -LiteralPath $wixVersionStdErr -Raw -ErrorAction SilentlyContinue
  }
  $wixVersionRaw = @([string]$wixVersionOutput -split "`r?
" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
} finally {
  if (Test-Path -LiteralPath $wixVersionStdOut) { Remove-Item -LiteralPath $wixVersionStdOut -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $wixVersionStdErr) { Remove-Item -LiteralPath $wixVersionStdErr -Force -ErrorAction SilentlyContinue }
}
if (-not $wixVersionRaw) {
  throw "No se pudo leer la versión de WiX. Verifica instalación de WiX Toolset v7.0.x estable."
}

$wixVersionText = [string]$wixVersionRaw
$wixVersionMatch = [Regex]::Match($wixVersionText, '\d+(\.\d+){1,3}')
if (-not $wixVersionMatch.Success) {
  throw "No se pudo interpretar la versión de WiX desde: $wixVersionText"
}

$wixVersion = [Version]$wixVersionMatch.Value
if ($wixVersion.Major -ne 7 -or $wixVersion.Minor -ne 0) {
  throw "WiX detectado: $wixVersion. Se requiere WiX Toolset v7.0.x estable."
}

$eulaProc = Start-Process -FilePath $wixExe -ArgumentList @('eula', 'accept', 'wix7') -Wait -NoNewWindow -PassThru
if ([int]$eulaProc.ExitCode -ne 0) { throw "No se pudo registrar aceptación autorizada de la EULA wix7 (exit=$($eulaProc.ExitCode))." }

if (-not (Test-Path $out)) {
  New-Item -ItemType Directory -Path $out | Out-Null
}

Remove-StaleInstallerArtifacts -OutputDirectory $out -InternalOutputDirectory $internalOut
Remove-OptionalInstallerArtifacts -OutputDirectory $out

New-Item -ItemType Directory -Path $out -Force | Out-Null
New-Item -ItemType Directory -Path $internalOut -Force | Out-Null
Assert-CanonicalInstallerIcon -IconPath $canonicalInstallerIconPath

$product = Join-Path $wix "Product.wxs"
$bundle = Join-Path $wix "Bundle.wxs"
$fragmentFiles = @(
  (Join-Path $wix "Fragments\AppFiles.wxs"),
  (Join-Path $wix "Fragments\Shortcuts.wxs"),
  (Join-Path $wix "Fragments\Cleanup.wxs")
)

$checks = @()
if (-not $SkipStabilityChecks) {
  $checks = @(
    @{ Title = "Lint"; Cmd = "npm run lint" },
    @{ Title = "Typecheck"; Cmd = "npm run typecheck" },
    @{ Title = "Tests backend CI"; Cmd = "npm run test:backend:ci" },
    @{ Title = "Tests portal CI"; Cmd = "npm run test:portal:ci" },
    @{ Title = "Tests frontend CI"; Cmd = "npm run test:frontend:ci" },
    @{ Title = "Clean architecture check"; Cmd = "npm run qa:clean-architecture:check" },
    @{ Title = "Pipeline contract check"; Cmd = "npm run pipeline:contract:check" }
  )
}

$buildBundle = $IncludeBundle -or ($env:EVALUAPRO_BUILD_BUNDLE -match '^(1|true|yes|si)$')
$selectedFlavors = @(Get-SelectedFlavors -CatalogPath $flavorCatalogPath -RequestedFlavor $Flavor)
if ($selectedFlavors.Count -eq 0) {
  throw "No se resolvieron flavors para '$Flavor'."
}
$appVersionPath = Join-Path $root 'config\app-version.json'
$hubVersionPath = Join-Path $root 'config\hub-version.json'
try {
  $appVersionMetadata = Get-Content -LiteralPath $appVersionPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
  $hubVersionMetadata = Get-Content -LiteralPath $hubVersionPath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
} catch {
  throw "No se pudieron leer las versiones separadas de aplicación y Hub: $($_.Exception.Message)"
}
$payloadVersion = [string]$appVersionMetadata.version
if ([string]::IsNullOrWhiteSpace($payloadVersion) -or [string]$appVersionMetadata.displayVersion -ne $payloadVersion) {
  throw 'config/app-version.json debe incluir version y displayVersion iguales.'
}
$effectiveVersionTag = Resolve-InstallerVersionTag -RootPath $root -RequestedVersion $Version
if ([string]::IsNullOrWhiteSpace($effectiveVersionTag)) { $effectiveVersionTag = [string]$hubVersionMetadata.version }
if ($effectiveVersionTag -ne [string]$hubVersionMetadata.version) {
  throw "La versión solicitada del Hub ($effectiveVersionTag) no coincide con config/hub-version.json ($($hubVersionMetadata.version))."
}
$effectiveVersionNumeric = ConvertTo-DotNetNumericVersion -VersionTag $effectiveVersionTag
$effectiveAppVersionNumeric = ConvertTo-DotNetNumericVersion -VersionTag $payloadVersion
$workspacePackages = @(
  @{ Path = 'package.json'; Lock = 'package-lock.json'; LockKey = ''; Name = 'root' },
  @{ Path = 'apps/backend/package.json'; Lock = 'apps/backend/package-lock.json'; LockKey = 'apps/backend'; Name = 'backend' },
  @{ Path = 'apps/frontend/package.json'; Lock = 'apps/frontend/package-lock.json'; LockKey = 'apps/frontend'; Name = 'frontend' },
  @{ Path = 'apps/portal_alumno_cloud/package.json'; Lock = 'apps/portal_alumno_cloud/package-lock.json'; LockKey = 'apps/portal_alumno_cloud'; Name = 'portal-alumno-cloud' }
)
foreach ($workspacePackage in $workspacePackages) {
  $packagePath = Join-Path $root ([string]$workspacePackage.Path)
  $lockPath = Join-Path $root ([string]$workspacePackage.Lock)
  if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or -not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
    throw "Falta el manifiesto de versión del paquete $($workspacePackage.Name): $packagePath / $lockPath"
  }
  try {
    $packageMetadata = Get-Content -LiteralPath $packagePath -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
    $lockText = Get-Content -LiteralPath $lockPath -Raw -Encoding utf8
    $lockVersionMatch = [Regex]::Match($lockText, '^\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"version"\s*:\s*"([^"]+)"')
    if (-not $lockVersionMatch.Success) { throw "No se pudo leer la version raíz de package-lock: $lockPath" }
    $lockPackageVersion = $lockVersionMatch.Groups[1].Value
  } catch {
    throw "No se pudo leer el manifiesto de versión del paquete $($workspacePackage.Name): $($_.Exception.Message)"
  }
  if ([string]$packageMetadata.version -ne $payloadVersion -or
      $lockPackageVersion -ne $payloadVersion) {
    throw "Versiones desalineadas para $($workspacePackage.Name): bundle=$effectiveVersionTag payload esperado=$payloadVersion package=$($packageMetadata.version) lock=$lockPackageVersion. Alinea package.json y package-lock.json antes de empaquetar."
  }
}
$hubDisplayVersion = [string]$hubVersionMetadata.displayVersion
if ([string]::IsNullOrWhiteSpace($hubDisplayVersion) -or $hubDisplayVersion -ne $effectiveVersionTag) {
  throw 'config/hub-version.json debe incluir version y displayVersion iguales a la versión del Hub.'
}
$effectiveBundleNamesByFlavor = @{}

$stepsPerFlavor = if ($buildBundle) { 2 } else { 1 }
$preBundleSteps = if ($buildBundle) { 1 } else { 0 }
$totalSteps = $checks.Count + $preBundleSteps + ($selectedFlavors.Count * $stepsPerFlavor)
$idx = 1

foreach ($check in $checks) {
  Invoke-CheckedStep -Index $idx -Total $totalSteps -Title $check.Title -Command $check.Cmd
  $idx += 1
}

$balExtDll = $null
$bootstrapperAppExe = $null
$buildRoot = $null
try {
  $buildRoot = New-InstallerBuildStagingRoot -RootPath $root

if (@($selectedFlavors.flavorId) -contains 'docente-local') {
  Add-DocenteNativeCompiledPayload -RootPath $root -StagingRoot $buildRoot
}

$docentePayloadArchive = $null
if (@($selectedFlavors.flavorId) -contains 'docente-local') {
  $docentePayloadArchive = New-DocentePayloadArchive -StagingRoot $buildRoot -OutputPath (Join-Path (Split-Path -Parent $buildRoot) 'evaluapro-native-dist.zip')
}

if ($buildBundle) {
  Write-Host "[msi] Resolviendo extension BAL de WiX..."
  $balExtDll = Resolve-BalExtensionDll -WixExecutable $wixExe -WixVersion $wixVersion -RootPath $buildRoot
  Write-Host "[msi] Extension BAL resuelta: $balExtDll"
  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Publicar Bootstrapper Application Burn" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
  Write-Host "[msi][step $idx/$totalSteps] Publicar Bootstrapper Application Burn"
  $bootstrapperAppExe = Resolve-BurnBootstrapperAppExe -RootPath $root -ConfigurationName $Configuration -VersionTag $effectiveVersionTag -AppVersion $payloadVersion
  Write-Host "[msi] Bootstrapper Application Burn resuelta: $bootstrapperAppExe"
  $idx += 1
}

  foreach ($flavorDef in $selectedFlavors) {
    $flavorId = [string]$flavorDef.flavorId
    $productName = [string]$flavorDef.productName
    $installFolderName = if ($flavorDef.PSObject.Properties.Name -contains 'installFolderName') { [string]$flavorDef.installFolderName } else { $productName }
    $msiName = [string]$flavorDef.msiName
    $bundleNameLegacy = [string]$flavorDef.bundleName
    $bundleName = Get-VersionedBundleName -BaseName $bundleNameLegacy -VersionTag $effectiveVersionTag
    $effectiveBundleNamesByFlavor[$flavorId] = $bundleName
    $upgradeCode = [string]$flavorDef.upgradeCode
    $bundleUpgradeCode = [string]$flavorDef.bundleUpgradeCode
    if ($IsolateBundleIdentity) {
      $upgradeCode = ([Guid]::NewGuid()).ToString().ToUpperInvariant()
      $bundleUpgradeCode = ([Guid]::NewGuid()).ToString().ToUpperInvariant()
      Write-Warning "QA aislado activo para ${flavorId}: no publicar este MSI/Bundle; UpgradeCode y BundleUpgradeCode son temporales."
    }
    $publicFlavorOut = Join-Path $out $flavorId
    $internalFlavorOut = Join-Path $internalOut $flavorId
    $productRegistryRoot = if ($flavorId -eq 'docente-local') { 'HKCU' } else { 'HKLM' }
    New-Item -ItemType Directory -Path $publicFlavorOut -Force | Out-Null
    New-Item -ItemType Directory -Path $internalFlavorOut -Force | Out-Null

    Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar MSI $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
    Write-Host "[msi][step $idx/$totalSteps] Compilar MSI $flavorId"
    $productOut = Join-Path $internalFlavorOut $msiName
    $wixProductWorkRoot = Join-Path $buildRoot ("wix-product-{0}" -f $flavorId)
    $wixCabCache = Join-Path $wixProductWorkRoot 'cab-cache'
    New-Item -ItemType Directory -Path $wixCabCache -Force | Out-Null
    if (Test-Path -LiteralPath $productOut) {
      Remove-Item -LiteralPath $productOut -Force
    }
    $productArgs = @(
      "build", $product
    ) + $fragmentFiles + @(
      "-arch", "x64",
      "-d", "SourceRoot=$buildRoot",
      "-d", ("PayloadArchive={0}" -f $docentePayloadArchive),
      "-d", "FlavorId=$flavorId",
      "-d", "ProductRegistryRoot=$productRegistryRoot",
      "-d", ("ProductName=`"{0}`"" -f $productName),
      "-d", ("InstallFolderName=`"{0}`"" -f $installFolderName),
      "-d", "UpgradeCode=$upgradeCode",
      "-d", "BundleName=$bundleName",
      "-intermediatefolder", $wixProductWorkRoot,
      "-cabcache", $wixCabCache,
      "-cabthreads", "1",
      "-o", (Join-Path $internalFlavorOut $msiName)
    )
    $productArgs += @("-d", "Version=$effectiveAppVersionNumeric")
    $productExit = Invoke-WixBuildProcess -WixExecutable $wixExe -Arguments $productArgs
    if ($productExit -ne 0) { throw "Falló build de Product.wxs para $flavorId (exit=$productExit)" }
    if (-not (Test-Path -LiteralPath $productOut)) {
      throw "Build de Product.wxs para $flavorId no genero MSI esperado: $productOut"
    }
    Assert-MsiAdministrativeExtractionContainsAppPayload -MsiPath $productOut -InstallFolderName $installFolderName -RequireDocenteNativePayload:($flavorId -eq 'docente-local')
    $idx += 1

    if ($buildBundle) {
      $scopedFlavorCatalogPath = New-ScopedFlavorCatalog -SourceCatalogPath $flavorCatalogPath -OutputDirectory $internalFlavorOut -FlavorDefinition $flavorDef -EffectiveBundleName $bundleName
      $flavorBundleIconPath = New-FlavorBundleIcon -RootPath $buildRoot -OutputDirectory $internalFlavorOut -FlavorDefinition $flavorDef
      Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Compilar bundle $flavorId" -PercentComplete ([Math]::Floor((($idx - 1) * 100) / [Math]::Max(1, $totalSteps)))
      Write-Host "[msi][step $idx/$totalSteps] Compilar bundle $flavorId"
      $bundleArgs = @(
        "build", $bundle,
        "-arch", "x64",
        "-ext", $balExtDll,
        "-bindpath", (Split-Path -Parent $bootstrapperAppExe),
        "-bindpath", (Join-Path $buildRoot 'scripts\installer-burn'),
        "-bindpath", (Join-Path $buildRoot 'config'),
        "-bindpath", (Join-Path $buildRoot 'scripts\comercial'),
        "-bindpath", (Join-Path $buildRoot 'scripts\installer-burn\modules'),
        "-d", "SourceRoot=$buildRoot",
        "-d", "FlavorId=$flavorId",
        "-d", ("ProductName=`"{0}`"" -f $productName),
        "-d", ("InstallFolderName=`"{0}`"" -f $installFolderName),
        "-d", "UpgradeCode=$upgradeCode",
        "-d", "BundleUpgradeCode=$bundleUpgradeCode",
        "-d", "BundleName=$bundleName",
        "-d", "MsiName=$msiName",
        "-d", "MsiSourcePath=$([string](Join-Path $internalFlavorOut $msiName))",
        "-d", "FlavorCatalogPath=$scopedFlavorCatalogPath",
        "-d", "BundleIconPath=$flavorBundleIconPath",
        "-o", (Join-Path $publicFlavorOut $bundleName)
      )
      $bundleArgs += @("-d", "Version=$effectiveVersionNumeric")
      # Evita validar un bundle viejo si WiX no puede reemplazar el artefacto (p. ej. archivo bloqueado).
      $bundleOut = Join-Path $publicFlavorOut $bundleName
      if (Test-Path -LiteralPath $bundleOut) {
        Remove-Item -LiteralPath $bundleOut -Force -ErrorAction Stop
      }
      $bundleExit = Invoke-WixBuildProcess -WixExecutable $wixExe -Arguments $bundleArgs
      if ($bundleExit -ne 0) { throw "Falló build de Bundle.wxs para $flavorId (exit=$bundleExit)" }
      if (-not (Test-Path -LiteralPath $bundleOut)) {
        throw "Build de Bundle.wxs para $flavorId no genero bundle esperado: $bundleOut"
      }
      $msiBytes = (Get-Item -LiteralPath $productOut).Length
      Assert-BurnBundleAttachedContainer -WixExecutable $wixExe -BundlePath $bundleOut -MinimumPayloadBytes ([int64]([Math]::Max(1, [Math]::Floor($msiBytes * 0.75))))
      Assert-InstallerHubBundleVersion -BundlePath $bundleOut -ExpectedVersion $effectiveVersionTag -WixExecutable $wixExe
      $bundleWixPdb = Join-Path $publicFlavorOut ([System.IO.Path]::GetFileNameWithoutExtension($bundleName) + '.wixpdb')
      if (Test-Path $bundleWixPdb) {
        Move-Item -LiteralPath $bundleWixPdb -Destination (Join-Path $internalFlavorOut (Split-Path -Leaf $bundleWixPdb)) -Force
      }
      $idx += 1
    }
  }

  if (-not $buildBundle) {
    Write-Host "[msi] Bundle EXE omitido por defecto (migración Burn WiX v6 en progreso). Usa -IncludeBundle o EVALUAPRO_BUILD_BUNDLE=1 para intentarlo."
  }

  if ($buildBundle) {
    Write-InstallerLocalPathsManifest -OutputDirectory $out -PublicOutputDirectory $out -InternalOutputDirectory $internalOut -FlavorDefinitions $selectedFlavors -BundleNameByFlavor $effectiveBundleNamesByFlavor
    Write-InstallerLocalPathsManifest -OutputDirectory $internalOut -PublicOutputDirectory $out -InternalOutputDirectory $internalOut -FlavorDefinitions $selectedFlavors -BundleNameByFlavor $effectiveBundleNamesByFlavor
  }

  Remove-OptionalInstallerArtifacts -OutputDirectory $out
  $manifestChannel = if ($IsolateBundleIdentity) { 'qa' } else { 'stable' }
  $manifestFlavorId = if (@($selectedFlavors).Count -eq 1) { [string]$selectedFlavors[0].flavorId } else { '' }
  Invoke-InstallerHashesGeneration -RootPath $root -RequestedVersion $effectiveVersionTag -RequestedAppVersion $payloadVersion -Channel $manifestChannel -FlavorId $manifestFlavorId

  Write-Progress -Activity "EvaluaPro MSI (estable)" -Status "Completado" -PercentComplete 100
  Write-Host "[msi] Artefactos generados en $out para flavors: $($selectedFlavors.flavorId -join ', ')"
} finally {
  Remove-InstallerBuildStagingRoot -StagingRoot $buildRoot
}
