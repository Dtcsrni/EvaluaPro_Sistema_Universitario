import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const installerHubPath = path.join(root, 'scripts', 'installer-hub', 'InstallerHub.ps1');
const burnBootstrapperProjectPath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaPro.BurnBootstrapperApp.csproj');
const burnBootstrapperSourcePath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs');
const burnBootstrapperWindowPath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml');
const burnHelperPath = path.join(root, 'scripts', 'installer-burn', 'InstallerBurnHelper.ps1');
const operationalConfigModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'OperationalConfig.psm1');
const licenseSecurityModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'LicenseClientSecurity.psm1');
const prereqInstallerModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'PrereqInstaller.psm1');

function getAvailablePowerShell() {
  const candidates = process.platform === 'win32'
    ? ['pwsh.exe', 'pwsh', 'powershell.exe']
    : ['pwsh', 'powershell'];

  for (const command of candidates) {
    try {
      const versionOutput = execFileSync(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 12_000
      });
      const major = Number.parseInt(String(versionOutput || '').trim(), 10);
      if (!Number.isFinite(major) || major < 5) {
        continue;
      }
      return command;
    } catch {
      // try next candidate
    }
  }

  return '';
}

function runPowerShell(command) {
  const shell = getAvailablePowerShell();
  if (!shell) {
    return { skipped: true, stdout: '' };
  }

  const stdout = execFileSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 20_000
  });
  return { skipped: false, stdout: String(stdout || '').trim() };
}

function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text) || {};
  } catch {
    const start = text.lastIndexOf('{');
    if (start < 0) return {};
    return JSON.parse(text.slice(start)) || {};
  }
}

test('installer prereq manifest incluye contrato minimo', () => {
  const manifestPath = path.join(root, 'config', 'installer-prereqs.manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  assert.equal(typeof manifest.version, 'string');
  assert.equal(typeof manifest.defaultProfile, 'string');
  assert.equal(Array.isArray(manifest.profiles), true);
  assert.equal(manifest.profiles.length >= 2, true);
  assert.equal(Array.isArray(manifest.prerequisites), true);
  assert.equal(manifest.prerequisites.length >= 2, true);

  for (const item of manifest.prerequisites) {
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.version, 'string');
    assert.equal(typeof item.downloadUrl, 'string');
    assert.equal(typeof item.sha256, 'string');
    assert.equal(typeof item.silentArgs, 'string');
    assert.equal(typeof item.detectRule, 'object');
    assert.equal(typeof item.detectRule.type, 'string');
  }

  const dockerRuntime = manifest.prerequisites.find((item) => item.detectRule?.type === 'docker_runtime_windows');
  assert.ok(dockerRuntime);
  assert.equal(dockerRuntime.name, 'Docker Runtime Windows');
  assert.match(dockerRuntime.downloadUrl, /wsl\/install/i);
});

test('canal update por defecto es stable en config y scripts', () => {
  const updateConfig = JSON.parse(fs.readFileSync(path.join(root, 'config', 'update-config.json'), 'utf8'));
  assert.equal(updateConfig.channel, 'stable');
  assert.equal(updateConfig.flavorId, 'docente-local');
  assert.equal(updateConfig.assetName, 'EvaluaPro-InstallerHub-docente-local.exe');

  const updateManager = fs.readFileSync(path.join(root, 'scripts', 'update-manager.mjs'), 'utf8');
  assert.match(updateManager, /channel:\s*'stable'/);
  assert.match(updateManager, /flavorId/);

  const launcherDashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.match(launcherDashboard, /channel:\s*'stable'/);
  assert.match(launcherDashboard, /flavorId/);
});

test('workflow de installer publica contratos nuevos de release', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci-installer-windows.yml'), 'utf8');

  assert.match(workflow, /actions\/setup-dotnet@v4/);
  assert.match(workflow, /dotnet-version:\s*8\.0\.x/);
  assert.match(workflow, /generate-installer-hashes\.ps1/);
  assert.match(workflow, /sign-installer-artifacts\.ps1/);
  assert.match(workflow, /build-msi\.ps1 -SkipStabilityChecks -IncludeBundle -Flavor all/);
  assert.match(workflow, /installer-windows-internal/);
  assert.match(workflow, /dist\/installer\/_internal\/\*\*/);
  assert.match(workflow, /Publicar release assets \(tags v\*\)/);
  assert.match(workflow, /steps\.stable_release_assets\.outputs\.files/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-InstallerHub-saas-completo\.exe/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-InstallerHub-docente-local\.exe/);
  assert.match(workflow, /dist\/installer\/_internal\/EvaluaPro-saas-completo\.msi/);
  assert.match(workflow, /dist\/installer\/_internal\/EvaluaPro-docente-local\.msi/);
  assert.match(workflow, /Smoke GUI del bundle Burn publico empaquetado/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-release-manifest\.json/);
  assert.doesNotMatch(workflow, /dist\/installer\/EvaluaPro-InstallerHub\.exe/);
  assert.doesNotMatch(workflow, /build-installer-hub\.ps1/);
});

test('workflow beta publica solo hubs en assets de prerelease', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-beta.yml'), 'utf8');

  assert.match(workflow, /actions\/setup-dotnet@v4/);
  assert.match(workflow, /Smoke GUI del bundle Burn publico empaquetado/);
  assert.match(workflow, /steps\.beta_assets\.outputs\.files/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-InstallerHub-saas-completo\.exe/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-InstallerHub-docente-local\.exe/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-release-manifest\.json/);
  assert.match(workflow, /build-msi\.ps1 -IncludeBundle -Flavor all/);
  assert.doesNotMatch(workflow, /dist\/installer\/EvaluaPro-InstallerHub\.exe/);
  assert.doesNotMatch(workflow, /build-installer-hub\.ps1/);
});

test('runtime Docker Windows queda abstracto en dashboard, WiX y package scripts', () => {
  const launcherDashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  const productWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Product.wxs'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(launcherDashboard, /EVALUAPRO_DOCKER_RUNTIME/);
  assert.match(launcherDashboard, /WSL2 \+ Docker Engine o Docker Desktop/);
  assert.match(productWxs, /WSLINSTALLED/);
  assert.match(productWxs, /runtime Docker compatible/i);
  assert.equal(packageJson.scripts['docker:runtime:check'], 'node scripts/docker-runtime-check.mjs');
});

test('build-msi publica BA personalizada y conserva contrato de asset publico por flavor', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config', 'installer-flavors.json'), 'utf8'));

  assert.match(buildScript, /Publish-BurnBootstrapperApp/);
  assert.match(buildScript, /Remove-StaleInstallerArtifacts/);
  assert.match(buildScript, /Write-InstallerLocalPathsManifest/);
  assert.match(buildScript, /_internal/);
  assert.match(buildScript, /Assert-CanonicalInstallerIcon/);
  assert.match(buildScript, /MsiSourcePath/);
  assert.match(buildScript, /\$DotNetExecutable publish/);
  assert.match(buildScript, /BootstrapperApp/);
  assert.equal(catalog.flavors.every((flavor) => flavor.bundleName === flavor.installerHubExeName), true);
});

test('helper Burn detecta prerequisitos con contrato JSON estable', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-burn-helper-'));
  const requestPath = path.join(tempRoot, 'request.json');
  const responsePath = path.join(tempRoot, 'response.json');
  fs.writeFileSync(requestPath, JSON.stringify({ flavorId: 'docente-local' }, null, 2), 'utf8');

  try {
    const shell = getAvailablePowerShell();
    if (!shell) {
      return;
    }

    execFileSync(shell, [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      burnHelperPath,
      '-Mode',
      'detect-prereqs',
      '-RequestPath',
      requestPath,
      '-ResponsePath',
      responsePath
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000
    });

    const payload = JSON.parse(fs.readFileSync(responsePath, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(payload.ok, true);
    assert.equal(payload.phase, 'analisis_requisitos');
    assert.equal(typeof payload.exitCode, 'number');
    assert.equal(typeof payload.message, 'string');
    assert.equal(Array.isArray(payload.logs), true);
    assert.equal(typeof payload.data.recommendedMode, 'string');
    assert.equal(Array.isArray(payload.data.prerequisites), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('bootstrapper Burn WPF .NET 8 orquesta deteccion, MSI y helper post-install', () => {
  const project = fs.readFileSync(burnBootstrapperProjectPath, 'utf8');
  const program = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'Program.cs'), 'utf8');
  const source = fs.readFileSync(burnBootstrapperSourcePath, 'utf8');
  const windowXaml = fs.readFileSync(burnBootstrapperWindowPath, 'utf8');
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(project, /<TargetFramework>net8\.0-windows<\/TargetFramework>/);
  assert.match(project, /<UseWPF>true<\/UseWPF>/);
  assert.match(project, /WixToolset\.BootstrapperApplicationApi/);

  assert.doesNotMatch(program, /\[STAThread\]/);
  assert.match(program, /ManagedBootstrapperApplication\.Run/);

  assert.match(source, /engineHandle\?\.Detect\(\)/);
  assert.match(source, /var exitCode = operationFinished\.Task\.GetAwaiter\(\)\.GetResult\(\)/);
  assert.match(source, /engineHandle\?\.Quit\(exitCode\)/);
  assert.match(source, /LaunchApprovedExe/);
  assert.match(source, /detect-prereqs/);
  assert.match(source, /post-install/);
  assert.match(source, /EvaluaPro", "installer-hub", "logs"/);
  assert.match(source, /InstallFolder/);
  assert.match(source, /SelectedFlavorId/);
  assert.match(source, /DispatcherUnhandledException/);
  assert.match(source, /StartUiThread fatal exception/);

  assert.match(windowXaml, /install/);
  assert.match(windowXaml, /repair/);
  assert.match(windowXaml, /uninstall/);
  assert.match(windowXaml, /Configuración operativa/);
  assert.match(windowXaml, /Licencia y updates/);
  assert.match(windowXaml, /SplashOverlay/);
  assert.match(windowXaml, /evaluapro-official-hero\.png/);

  assert.match(helper, /ValidateSet\('detect-prereqs', 'post-install'\)/);
  assert.match(helper, /configuracion_operativa/);
  assert.match(helper, /verificacion_final/);
  assert.match(helper, /blindaje_licencia_local/);
  assert.match(helper, /portable-license\.mjs/);
});

test('resolucion de flavors funciona en layout plano del bundle Burn', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installer-flat-'));
  const commonModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'Common.psm1');
  try {
    const flatCatalogPath = path.join(tempRoot, 'installer-flavors.json');
    fs.writeFileSync(flatCatalogPath, JSON.stringify({
      version: 1,
      defaultFlavorId: 'docente-local',
      flavors: [
        { flavorId: 'docente-local', installerHubExeName: 'EvaluaPro-InstallerHub-docente-local.exe' }
      ]
    }, null, 2), 'utf8');

    const script = `
Import-Module -Force -WarningAction SilentlyContinue '${commonModulePath.replace(/'/g, "''")}'
$catalog = Get-InstallerFlavorCatalog -RootPath '${tempRoot.replace(/'/g, "''")}'
$catalog | ConvertTo-Json -Depth 8
`.trim();

    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }

    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.defaultFlavorId, 'docente-local');
    assert.equal(Array.isArray(parsed.flavors), true);
    assert.equal(parsed.flavors.length, 1);
    assert.equal(parsed.flavors[0].flavorId, 'docente-local');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('installer hub incluye fase de configuracion operativa y blindaje de licencia configurable', () => {
  const hub = fs.readFileSync(installerHubPath, 'utf8');
  assert.match(hub, /OperationalConfig\.psm1/);
  assert.match(hub, /WizardUi\.psm1/);
  assert.match(hub, /configuracion_operativa/);
  assert.match(hub, /MONGODB_URI|MongoUri/);
  assert.match(hub, /NODE_ENV|NodeEnv/);
  assert.match(hub, /PUERTO_API|PuertoApi/);
  assert.match(hub, /PUERTO_PORTAL|PuertoPortal/);
  assert.match(hub, /PORTAL_ALUMNO_API_KEY|PortalAlumnoApiKey/);
  assert.match(hub, /GOOGLE_OAUTH_CLIENT_ID|GoogleOauthClientId/);
  assert.match(hub, /GOOGLE_CLASSROOM_CLIENT_ID|GoogleClassroomClientId/);
  assert.match(hub, /RequireLicenseActivation/);
  assert.match(hub, /LicenciaAccountEmail/);
  assert.match(hub, /UpdateChannel/);
  assert.match(hub, /UpdateOwner/);
  assert.match(hub, /UpdateRepo/);
  assert.match(hub, /UpdateAssetName/);
  assert.match(hub, /UpdateShaAssetName/);
  assert.match(hub, /UpdateFeedUrl/);
  assert.match(hub, /UpdateRequireSha256/);
  assert.match(hub, /FlavorId/);
  assert.match(hub, /Get-LatestStableReleaseAssets[\s\S]*-FlavorId/);
  assert.match(hub, /Initialize-EvaluaProPortableAdminLicense/);
  assert.match(hub, /\[string\]\$RequireLicenseActivation = '1'/);
  assert.match(hub, /\$flow\.requireLicenseActivation = '1'/);
  assert.match(hub, /installationHealth = \$null/);
  assert.match(hub, /Regenerar accesos/);
  assert.match(hub, /Verificar/);
  assert.match(hub, /Show-InstallerBootstrapDialog/);
  assert.match(hub, /EvaluaPro necesita permisos de administrador para continuar/);
  assert.match(hub, /Ejecutar como administrador/);
  assert.match(hub, /\$scriptPathForElevation = \(Resolve-Path -LiteralPath \$MyInvocation\.MyCommand\.Path\)\.Path/);
  assert.match(hub, /Ensure-ElevatedSession -ScriptPath \$scriptPathForElevation/);
});

test('installer hub expone preflight GUI y wizard por pasos', () => {
  const hub = fs.readFileSync(installerHubPath, 'utf8');
  const wizard = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'WizardUi.psm1'), 'utf8');
  assert.match(hub, /Test-InstallerHubGuiPreflight/);
  assert.match(hub, /Invoke-InstallerHubWizardUi/);
  assert.match(wizard, /1\. Inicio inteligente/);
  assert.match(wizard, /2\. Revision rapida/);
  assert.match(wizard, /3\. Verificacion/);
  assert.match(wizard, /4\. Instalacion y resultado/);
  assert.match(wizard, /TableLayoutPanel/);
  assert.match(wizard, /FlowLayoutPanel/);
});

test('wizard UI evita patrones fragiles de WinForms ya corregidos', () => {
  const wizard = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'WizardUi.psm1'), 'utf8');
  assert.equal(wizard.includes('$group.AutoScroll'), false);
  assert.equal(wizard.includes('AutoScaleMode]::None'), false);
  assert.equal(wizard.includes('ListBox'), false);
  assert.match(wizard, /function Set-FlowInstallationHealth/);
  assert.match(wizard, /Add-Member -InputObject \$Flow -NotePropertyName 'installationHealth'/);
  assert.match(wizard, /\$brandSummary = Add-Paragraph -Parent \$brandStack/);
  assert.match(wizard, /\$brandSummary\.Text = \$ui\.uiState\.recommendation/);
  assert.doesNotMatch(wizard, /\$toggle\.Add_Click\(\{[\s\S]*\$toggle\./);
  assert.match(wizard, /\$toggle\.Add_Click\(\{[\s\S]*param\(\$sender,\s*\$eventArgs\)/);
  assert.match(wizard, /Mostrar opciones tecnicas/);
  assert.match(wizard, /Ver detalle tecnico/);
  assert.match(wizard, /Reparar \/ abrir instalacion/);
  assert.match(wizard, /Instalar ahora/);
  assert.match(wizard, /Reparar instalacion/);
  assert.match(wizard, /EVALUAPRO_INSTALLER_GUI_SELF_TEST/);
  assert.match(wizard, /UI_SELFTEST_OK/);
  assert.match(wizard, /UI_SELFTEST_FAILED/);
  assert.match(wizard, /UI_CLICK_RUN/);
  assert.match(wizard, /UI_CLICK_NEXT/);
  assert.match(wizard, /UI_CLICK_BACK/);
});

test('scripts de installer hub no usan operadores exclusivos de PowerShell 7', () => {
  const hub = fs.readFileSync(installerHubPath, 'utf8');
  const common = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'Common.psm1'), 'utf8');
  const license = fs.readFileSync(licenseSecurityModulePath, 'utf8');
  const wizard = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'WizardUi.psm1'), 'utf8');
  assert.doesNotMatch(hub, /\?\?/);
  assert.doesNotMatch(common, /\?\?/);
  assert.doesNotMatch(license, /\?\?/);
  assert.doesNotMatch(wizard, /\?\?/);
});

test('elevacion UAC relanza con ruta absoluta y working directory del script', () => {
  const common = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'Common.psm1'), 'utf8');
  assert.match(common, /Resolve-InstallerElevationScriptPath/);
  assert.match(common, /Split-Path -Parent \$resolvedScriptPath/);
  assert.match(common, /WorkingDirectory = \$workingDirectory/);
  assert.match(common, /ArgumentList = \(\$quotedArgs -join ' '\)/);
});

test('elevacion UAC prepara copia estable cuando el script vive en IXP temp', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-ixp-'));
  const ixpDir = path.join(tempRoot, 'IXP123.TMP');
  fs.mkdirSync(ixpDir, { recursive: true });
  fs.writeFileSync(path.join(ixpDir, 'installer-hub.ps1'), 'Write-Host "hub"', 'utf8');
  fs.writeFileSync(path.join(ixpDir, 'Common.psm1'), 'Write-Host "common"', 'utf8');
  try {
    const script = `
Import-Module -Force -WarningAction SilentlyContinue '${path.join(root, 'scripts', 'installer-hub', 'modules', 'Common.psm1').replace(/'/g, "''")}'
$resolved = Resolve-InstallerElevationScriptPath -ScriptPath '${path.join(ixpDir, 'installer-hub.ps1').replace(/'/g, "''")}'
[pscustomobject]@{
  resolved = $resolved
  exists = Test-Path -LiteralPath $resolved
  parentName = Split-Path -Leaf (Split-Path -Parent $resolved)
  commonExists = Test-Path -LiteralPath (Join-Path (Split-Path -Parent $resolved) 'Common.psm1')
  originalParentName = Split-Path -Leaf '${ixpDir.replace(/'/g, "''")}'
} | ConvertTo-Json -Depth 6
`.trim();
    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.exists, true);
    assert.equal(parsed.commonExists, true);
    assert.notEqual(parsed.parentName, parsed.originalParentName);
    assert.match(String(parsed.resolved || ''), /EvaluaProInstallerHub-Elevated/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('smoke del bundle Burn publico queda declarado en workflows post-build', () => {
  const stableWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci-installer-windows.yml'), 'utf8');
  const betaWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-beta.yml'), 'utf8');

  for (const workflow of [stableWorkflow, betaWorkflow]) {
    assert.match(workflow, /Smoke GUI del bundle Burn publico empaquetado/);
    assert.match(workflow, /dist\/installer\/EvaluaPro-InstallerHub-docente-local\.exe/);
    assert.match(workflow, /Start-Process -FilePath \$exe -PassThru/);
    assert.match(workflow, /El bundle Burn publico se cerro antes del smoke timeout|El Installer Hub empaquetado se cerro antes del smoke timeout/);
  }
});

test('launcher broker unifica shortcuts, hub y splash state', () => {
  const broker = fs.readFileSync(path.join(root, 'scripts', 'launcher-broker.ps1'), 'utf8');
  const trayHidden = fs.readFileSync(path.join(root, 'scripts', 'launcher-tray-hidden.vbs'), 'utf8');
  const shortcuts = fs.readFileSync(path.join(root, 'scripts', 'create-shortcuts.ps1'), 'utf8');

  assert.match(broker, /booting_dashboard/);
  assert.match(broker, /booting_stack/);
  assert.match(broker, /booting_portal/);
  assert.match(broker, /healthy/);
  assert.match(broker, /degraded/);
  assert.match(broker, /failed/);
  assert.match(trayHidden, /launcher-broker\.ps1/);
  assert.match(trayHidden, /runId/);
  assert.match(shortcuts, /EvaluaPro - Hub/);
  assert.match(shortcuts, /open-hub/);
});

test('flujo del installer hub conserva fases y codigos de salida criticos', () => {
  const hub = fs.readFileSync(installerHubPath, 'utf8');

  const orderedPhases = [
    'analisis_requisitos',
    'carpeta_recursos',
    'prerequisitos',
    'release_estable',
    'accion_producto',
    'configuracion_operativa',
    'verificacion_final',
    'blindaje_licencia_local'
  ];

  let lastIndex = -1;
  for (const phase of orderedPhases) {
    const index = hub.indexOf(`Invoke-FlowPhase -Name '${phase}'`);
    assert.ok(index > lastIndex, `fase fuera de orden o ausente: ${phase}`);
    lastIndex = index;
  }

  assert.match(hub, /'analisis_requisitos'\s+-FailCode\s+10/);
  assert.match(hub, /'prerequisitos'\s+-FailCode\s+10/);
  assert.match(hub, /'release_estable'\s+-FailCode\s+20/);
  assert.match(hub, /'accion_producto'\s+-FailCode\s+30/);
  assert.match(hub, /'configuracion_operativa'\s+-FailCode\s+35/);
  assert.match(hub, /'verificacion_final'\s+-FailCode\s+40/);
  assert.match(hub, /'blindaje_licencia_local'\s+-FailCode\s+50/);
  assert.match(hub, /if \(\$Headless\)\s*\{[\s\S]*Invoke-HeadlessFlow/);
  assert.match(hub, /result = \[pscustomobject\]@\{[\s\S]*exitCode = 0[\s\S]*\}/);
});

test('configuracion operativa rechaza ajustes inseguros o invalidos (fail-fast)', () => {
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${operationalConfigModulePath.replace(/'/g, "''")}'
$cfg = @{
  mongoUri='mongodb://mongo_local:27017/evaluapro'
  jwtSecreto='abc123'
  nodeEnv='production'
  puertoApi='0'
  puertoPortal='4518'
  corsOrigenes='*'
  portalAlumnoUrl='https://portal-alumno.example.edu'
  portalAlumnoApiKey='portal-key'
  portalApiKey='portal-key'
  passwordResetEnabled='0'
  requireGoogleOAuth='0'
  correoModuloActivo='0'
  requireLicenseActivation='0'
  updateChannel='stable'
  updateOwner='Dtcsrni'
  updateRepo='EvaluaPro_Sistema_Universitario'
}
$normalized = Normalize-OperationalConfig -InputConfig $cfg
$r = Test-OperationalConfig -Mode install -Config $normalized
$r | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(Array.isArray(parsed.errors), true);
  assert.equal(parsed.errors.some((entry) => String(entry).includes('Puerto invalido para puertoApi')), true);
  assert.equal(parsed.errors.some((entry) => String(entry).includes('CORS no puede ser "*"')), true);
});

test('detector PowerShell expone estado abstracto de runtime Docker Windows', () => {
  const detectorModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'PrereqDetector.psm1');
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
$status = Get-DockerRuntimeStatus
$status | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(typeof parsed.preference, 'string');
  assert.equal(typeof parsed.mode, 'string');
  assert.equal(typeof parsed.installed, 'boolean');
  assert.equal(Array.isArray(parsed.manualActions), true);
});

test('bootstrap guiado WSL2 genera guia local y permite simulacion de cierre', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-wsl-bootstrap-'));
  const detectorModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='missing'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP='1'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}'
$manifest = [pscustomobject]@{
  prerequisites = @(
    [pscustomobject]@{
      name = 'Docker Runtime Windows'
      version = 'wsl2-engine-default'
      downloadUrl = 'https://learn.microsoft.com/windows/wsl/install'
      sha256 = 'GUIDED_BOOTSTRAP'
      sha256Url = ''
      sha256Pattern = ''
      silentArgs = 'bootstrap-guided'
      detectRule = [pscustomobject]@{ type = 'docker_runtime_windows' }
    }
  )
}
$r = Invoke-PrerequisiteInstallationFlow -Manifest $manifest -DownloadRoot '${tempRoot.replace(/'/g, "''")}'
$r | ConvertTo-Json -Depth 10
`.trim();

  try {
    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(Array.isArray(parsed.installed), true);
    assert.equal(parsed.installed.length, 1);
    assert.equal(typeof parsed.installed[0].guidePath, 'string');
    assert.equal(fs.existsSync(parsed.installed[0].guidePath), true);
    assert.equal(fs.existsSync(parsed.installed[0].scriptPath), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('bootstrap semiautomatico WSL2 ejecuta pasos host y reporta trazabilidad', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-wsl-autobootstrap-'));
  const detectorModulePath = path.join(root, 'scripts', 'installer-hub', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='missing'
$env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL='1'
$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP='1'
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE_AFTER_AUTO='wsl2-engine'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}'
$manifest = [pscustomobject]@{
  prerequisites = @(
    [pscustomobject]@{
      name = 'Docker Runtime Windows'
      version = 'wsl2-engine-default'
      downloadUrl = 'https://learn.microsoft.com/windows/wsl/install'
      sha256 = 'GUIDED_BOOTSTRAP'
      sha256Url = ''
      sha256Pattern = ''
      silentArgs = 'bootstrap-guided'
      detectRule = [pscustomobject]@{ type = 'docker_runtime_windows' }
    }
  )
}
$r = Invoke-PrerequisiteInstallationFlow -Manifest $manifest -DownloadRoot '${tempRoot.replace(/'/g, "''")}'
$r | ConvertTo-Json -Depth 10
`.trim();

  try {
    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(Array.isArray(parsed.installed), true);
    assert.equal(parsed.installed.length, 1);
    assert.equal(typeof parsed.installed[0].guidePath, 'string');
    assert.equal(fs.existsSync(parsed.installed[0].guidePath), true);
    assert.equal(fs.existsSync(parsed.installed[0].scriptPath), true);
    assert.equal(typeof parsed.installed[0].autoBootstrap, 'object');
    assert.equal(Array.isArray(parsed.installed[0].autoBootstrap.executed), true);
    assert.equal(parsed.installed[0].autoBootstrap.executed.length >= 1, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('configuracion operativa escribe .env y update-config endurecido para docente', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installerhub-'));
  const installDir = path.join(tempRoot, 'EvaluaPro');
  fs.mkdirSync(path.join(installDir, 'config'), { recursive: true });

  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${operationalConfigModulePath.replace(/'/g, "''")}'
$cfg = @{
  mongoUri='mongodb://mongo_local:27017/evaluapro'
  jwtSecreto=''
  nodeEnv='production'
  puertoApi='4000'
  puertoPortal='4518'
  corsOrigenes='http://localhost:4173,http://127.0.0.1:4173'
  portalAlumnoUrl='https://portal.ejemplo.edu'
  portalAlumnoApiKey='portal-key-shared'
  portalApiKey='portal-key-shared'
  passwordResetEnabled='0'
  passwordResetTokenMinutes='30'
  passwordResetUrlBase=''
  requireGoogleOAuth='0'
  correoModuloActivo='0'
  requireLicenseActivation='0'
  updateChannel='stable'
  updateOwner='Dtcsrni'
  updateRepo='EvaluaPro_Sistema_Universitario'
  flavorId='docente-local'
  updateAssetName='EvaluaPro-InstallerHub-docente-local.exe'
  updateShaAssetName='EvaluaPro-InstallerHub-docente-local.exe.sha256'
  updateRequireSha256='1'
}
$r = Invoke-EvaluaProOperationalConfiguration -Mode install -InstallDir '${installDir.replace(/'/g, "''")}' -Config $cfg
$r | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  try {
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'ok')) {
      assert.equal(parsed.ok, true);
    }
    const envPath = typeof parsed?.envPath === 'string' && parsed.envPath
      ? parsed.envPath
      : path.join(installDir, '.env');
    assert.equal(fs.existsSync(envPath), true);

    const envRaw = fs.readFileSync(envPath, 'utf8');
    assert.match(envRaw, /MONGODB_URI=/);
    assert.match(envRaw, /JWT_SECRETO=/);
    assert.match(envRaw, /PORTAL_ALUMNO_API_KEY=portal-key-shared/);
    assert.match(envRaw, /PORTAL_API_KEY=portal-key-shared/);

    const updateConfigPath = path.join(path.dirname(envPath), 'config', 'update-config.json');
    const updateConfigRaw = fs.readFileSync(updateConfigPath, 'utf8').replace(/^\uFEFF/, '');
    const updateConfig = JSON.parse(updateConfigRaw);
    assert.equal(updateConfig.channel, 'stable');
    assert.equal(updateConfig.flavorId, 'docente-local');
    assert.equal(updateConfig.owner, 'Dtcsrni');
    assert.equal(updateConfig.repo, 'EvaluaPro_Sistema_Universitario');
    assert.equal(updateConfig.requireSha256, true);
    assert.equal(updateConfig.assetName, 'EvaluaPro-InstallerHub-docente-local.exe');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('blindaje de licencia exige DPAPI local machine e integridad MAC', () => {
  const securityModule = fs.readFileSync(licenseSecurityModulePath, 'utf8');
  assert.match(securityModule, /System\.Security\.Cryptography\.ProtectedData/);
  assert.match(securityModule, /DataProtectionScope\]::LocalMachine/);
  assert.match(securityModule, /Get-HmacSha256Hex/);
  assert.match(securityModule, /Envelope de licencia alterado \(MAC invalido\)/);
  assert.match(securityModule, /Baseline alterado \(MAC invalido\)/);
  assert.match(securityModule, /Initialize-EvaluaProAdminStepUp/);
  assert.match(securityModule, /Invoke-EvaluaProStepUp/);
  assert.match(securityModule, /Get-EvaluaProCurrentTotpCode/);
  assert.match(securityModule, /recovery_code/);
});

test('step-up local inicializa TOTP y permite sesion elevada con recovery/TOTP', () => {
  if (process.platform !== 'win32') {
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-stepup-'));
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${licenseSecurityModulePath.replace(/'/g, "''")}'
$portable = Initialize-EvaluaProPortableAdminLicense -RootDir '${tempRoot.replace(/'/g, "''")}' -HolderName 'Test Admin'
$step = Initialize-EvaluaProAdminStepUp -RootDir '${tempRoot.replace(/'/g, "''")}' -HolderName 'Test Admin'
$before = Get-EvaluaProStepUpStatus -RootDir '${tempRoot.replace(/'/g, "''")}'
$totp = Get-EvaluaProCurrentTotpCode -RootDir '${tempRoot.replace(/'/g, "''")}'
$auth = Invoke-EvaluaProStepUp -RootDir '${tempRoot.replace(/'/g, "''")}' -TotpCode $totp
$after = Get-EvaluaProStepUpStatus -RootDir '${tempRoot.replace(/'/g, "''")}'
[pscustomobject]@{
  before = $before
  after = $after
  methods = $step.methods
} | ConvertTo-Json -Depth 10
`.trim();

  try {
    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.before.licenseValid, true);
    assert.equal(parsed.before.required, true);
    assert.equal(Array.isArray(parsed.methods), true);
    assert.equal(parsed.methods.includes('totp'), true);
    assert.equal(parsed.methods.includes('recovery_code'), true);
    assert.equal(parsed.after.active, true);
    assert.equal(parsed.after.required, false);
    assert.equal(Number(parsed.after.recoveryCodesRemaining) > 0, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('script de release manifest incluye contrato extendido de build/deployment/artifacts', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'generate-installer-release-manifest.ps1'), 'utf8');
  assert.match(script, /build\s*=\s*\[ordered\]@{/);
  assert.match(script, /commit\s*=\s*\$commit/);
  assert.match(script, /artifacts\s*=\s*\$artifacts/);
  assert.match(script, /flavors\s*=\s*\$flavors/);
  assert.match(script, /flavorId\s*=/);
  assert.match(script, /deployment\s*=\s*\[ordered\]@{/);
  assert.match(script, /target\s*=\s*if \(\$DeploymentTarget\)/);
});

