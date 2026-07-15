/**
 * installer-hub-contract.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const burnBootstrapperProjectPath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaPro.BurnBootstrapperApp.csproj');
const burnBootstrapperSourcePath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs');
const burnBootstrapperWindowPath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml');
const burnBootstrapperWindowCodePath = path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml.cs');
const designDocPath = path.join(root, 'docs', 'DESIGN.md');
const installerHubUiLifecyclePath = path.join(root, 'scripts', 'tests', 'installer-hub-ui-lifecycle.ps1');
const installerHubE2eDocentePath = path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1');
const vmE2eLauncherPath = path.join(root, 'scripts', 'ci', 'run-e2e-launcher.ps1');
const vmE2eInVmPath = path.join(root, 'scripts', 'ci', 'run-e2e-in-vm.ps1');
const hostCanaryLauncherPath = path.join(root, 'scripts', 'ci', 'run-e2e-host-canary.ps1');
const autoE2eLauncherPath = path.join(root, 'scripts', 'ci', 'run-e2e-auto.ps1');
const qaSecretSetupPath = path.join(root, 'scripts', 'ci', 'set-e2e-qa-secret.ps1');
const dockerComposePath = path.join(root, 'docker-compose.yml');
const dockerComposeProdBuildPath = path.join(root, 'docker-compose.prod-build.yml');
const packageWorkflowPath = path.join(root, '.github', 'workflows', 'package.yml');
const burnHelperPath = path.join(root, 'scripts', 'installer-burn', 'InstallerBurnHelper.ps1');
const installerHubBundleGuardPath = path.join(root, 'scripts', 'assert-installer-hub-bundle.ps1');
const operationalConfigModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'OperationalConfig.psm1');
const licenseSecurityModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'LicenseClientSecurity.psm1');
const prereqInstallerModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqInstaller.psm1');

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
    return { skipped: true, stdout: '', stderr: '', status: 0 };
  }

  try {
    const stdout = execFileSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000
    });
    return { skipped: false, stdout: String(stdout || '').trim(), stderr: '', status: 0 };
  } catch (error) {
    return {
      skipped: false,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || '').trim(),
      status: Number(error.status || 1)
    };
  }
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

  const nodeWsl = manifest.prerequisites.find((item) => item.detectRule?.type === 'node_major_wsl');
  assert.ok(nodeWsl);
  assert.equal(nodeWsl.name, 'Node.js WSL2');
  assert.equal(nodeWsl.detectRule.minMajor, 24);

  const docenteProfile = manifest.profiles.find((item) => item.profileId === 'docente-local');
  const saasProfile = manifest.profiles.find((item) => item.profileId === 'saas-completo');
  assert.ok(docenteProfile);
  assert.ok(saasProfile);
  assert.equal(docenteProfile.prerequisites.includes('Node.js'), true);
  assert.equal(docenteProfile.prerequisites.includes('Node.js WSL2'), false);
  assert.equal(docenteProfile.prerequisites.includes('Docker Runtime Windows'), false);
  assert.equal(saasProfile.prerequisites.includes('Node.js'), true);
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
  const stableGateWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'release-stable-gate.yml'), 'utf8');

  assert.match(workflow, /actions\/setup-dotnet@v4/);
  assert.match(workflow, /dotnet-version:\s*8\.0\.x/);
  assert.match(workflow, /generate-installer-hashes\.ps1/);
  assert.match(workflow, /sign-installer-artifacts\.ps1/);
  assert.match(workflow, /build-msi\.ps1 -SkipStabilityChecks -IncludeBundle -Flavor all/);
  assert.match(workflow, /installer-windows-internal/);
  assert.match(workflow, /dist\/installer\/_internal\/\*\*/);
  assert.match(workflow, /Publicar release assets \(tags v\*\)/);
  assert.match(workflow, /steps\.stable_release_assets\.outputs\.files/);
  assert.match(workflow, /make_latest:\s*false/);
  assert.match(stableGateWorkflow, /permissions:\s*\n\s*contents:\s*write/);
  assert.match(stableGateWorkflow, /gh release edit "v\$\{\{ steps\.resolve_version\.outputs\.target \}\}".*--latest/);
  assert.match(workflow, /dist\/installer\/saas-completo\/EvaluaPro-InstallerHub-saas-completo-v\*\.exe/);
  assert.match(workflow, /dist\/installer\/docente-local\/EvaluaPro-InstallerHub-docente-local-v\*\.exe/);
  assert.match(workflow, /dist\/installer\/_internal\/saas-completo\/EvaluaPro-saas-completo\.msi/);
  assert.match(workflow, /dist\/installer\/_internal\/docente-local\/EvaluaPro-docente-local\.msi/);
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
  assert.match(workflow, /dist\/installer\/saas-completo\/EvaluaPro-InstallerHub-saas-completo-v\*\.exe/);
  assert.match(workflow, /dist\/installer\/docente-local\/EvaluaPro-InstallerHub-docente-local-v\*\.exe/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-release-manifest\.json/);
  assert.match(workflow, /build-msi\.ps1 -SkipStabilityChecks -IncludeBundle -Flavor all/);
  assert.doesNotMatch(workflow, /dist\/installer\/EvaluaPro-InstallerHub\.exe/);
  assert.doesNotMatch(workflow, /build-installer-hub\.ps1/);
});

test('runtime Docker Windows queda abstracto en dashboard, WiX y package scripts', () => {
  const launcherDashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  const productWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Product.wxs'), 'utf8');
  const bundleWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Bundle.wxs'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(launcherDashboard, /EVALUAPRO_DOCKER_RUNTIME/);
  assert.match(launcherDashboard, /native-node-sqlite/);
  assert.match(launcherDashboard, /WSL2 \+ Docker Engine/);
  assert.match(launcherDashboard, /Docker Desktop/);
  assert.match(productWxs, /WSLINSTALLED/);
  assert.match(productWxs, /\<\?if \$\(var\.FlavorId\) != docente-local \?\>/);
  assert.match(productWxs, /Installed OR REQUIRE_INSTALLER_HUB = 1 OR BURNMSIINSTALL = 1/);
  assert.match(productWxs, /SKIP_DOCKER_RUNTIME_CHECK = 1 OR REQUIRE_INSTALLER_HUB = 1 OR BURNMSIINSTALL = 1 OR DOCKERINSTALLED64 OR DOCKERINSTALLEDUSER OR WSLINSTALLED/);
  assert.match(productWxs, /Distribucion docente local[\s\S]*persistencia SQLite/);
  assert.match(productWxs, /<Directory Id="INSTALLFOLDER" Name="\$\(var\.InstallFolderName\)" \/>/);
  assert.match(bundleWxs, /MsiProperty Name="REQUIRE_INSTALLER_HUB" Value="1"/);
  assert.match(productWxs, /runtime Docker compatible/i);
  assert.equal(packageJson.scripts['docker:runtime:check'], 'node scripts/docker-runtime-check.mjs');
});

test('build-msi valida contenedor adjunto Burn antes de publicar bundle', () => {
  const buildMsi = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const bundleGuard = fs.readFileSync(installerHubBundleGuardPath, 'utf8');

  assert.match(buildMsi, /function Assert-BurnBundleAttachedContainer/);
  assert.match(buildMsi, /EVALUAPRO_WIX_PROCESS_TIMEOUT_SECONDS/);
  assert.match(buildMsi, /WiX excedio timeout/);
  assert.match(buildMsi, /ParentProcessId -eq \$proc\.Id/);
  assert.match(buildMsi, /'burn', 'extract'/);
  assert.match(buildMsi, /MinimumPayloadBytes/);
  assert.match(buildMsi, /Assert-BurnBundleAttachedContainer -WixExecutable \$wixExe -BundlePath \$bundleOut/);
  assert.match(buildMsi, /function Assert-InstallerHubBundleVersion/);
  assert.match(buildMsi, /assert-installer-hub-bundle\.ps1/);
  assert.match(buildMsi, /Assert-InstallerHubBundleVersion -BundlePath \$bundleOut -ExpectedVersion \$effectiveVersionTag -WixExecutable \$wixExe/);
  assert.match(bundleGuard, /Bootstrapper Application FileVersion/);
  assert.match(bundleGuard, /Bootstrapper Application ProductVersion/);
  assert.match(bundleGuard, /Regex\]::Escape\(\$Expected\)/);
  assert.match(bundleGuard, /\^\{0\}\(\$\|\[\.\+-\]\)/);
  assert.match(bundleGuard, /WixExecutable/);
  assert.match(bundleGuard, /'burn', 'extract'/);
  assert.match(buildMsi, /function Assert-MsiInstallsAppPayload/);
  assert.match(buildMsi, /Assert-MsiInstallsAppPayload -MsiPath \$productOut -InstallFolderName \$installFolderName/);
  assert.match(buildMsi, /'docker-compose\.yml'/);
  assert.match(buildMsi, /'docker-compose\.prod-build\.yml'/);
  assert.match(buildMsi, /-p:AssemblyVersion=\$VersionTag\.0/);
  assert.match(buildMsi, /-p:FileVersion=\$VersionTag\.0/);
  assert.match(buildMsi, /-p:InformationalVersion=\$VersionTag/);
  assert.match(buildMsi, /Bootstrapper Application Burn publicada con version invalida/);
  assert.match(buildMsi, /Publicando Bootstrapper Application Burn desde fuente/);
  assert.doesNotMatch(buildMsi, /Reutilizando Bootstrapper Application Burn ya publicada/);
});

test('installer hub WPF publica timeline por etapas y resumen de error MSI visible', () => {
  const bootstrapper = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'EvaluaProBootstrapperApplication.cs'), 'utf8');
  const mainWindowXaml = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml'), 'utf8');
  const mainWindowCodeBehind = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'MainWindow.xaml.cs'), 'utf8');

  assert.match(bootstrapper, /StageDetection = "detection"/);
  assert.match(bootstrapper, /TryExtractMsiFailureReason/);
  assert.match(bootstrapper, /FailureDisplay/);
  assert.match(bootstrapper, /GetShellWindow/);
  assert.match(bootstrapper, /GetDesktopWindow/);
  assert.match(mainWindowXaml, /StageTimelineHost/);
  assert.match(mainWindowXaml, /FailureSummaryBorder/);
  assert.match(mainWindowCodeBehind, /UpdateWorkflow\(InstallerWorkflowView workflow\)/);
});

test('Installer Hub cumple contrato DESIGN.md de layout y accesibilidad WPF', () => {
  const design = fs.readFileSync(designDocPath, 'utf8');
  const uxCriteria = fs.readFileSync(path.join(root, 'docs', 'UX_QUALITY_CRITERIA.md'), 'utf8');
  const installerHubDocs = fs.readFileSync(path.join(root, 'docs', 'INSTALLER_HUB.md'), 'utf8');
  const mainWindowXaml = fs.readFileSync(burnBootstrapperWindowPath, 'utf8');
  const mainWindowCode = fs.readFileSync(burnBootstrapperWindowCodePath, 'utf8');
  const bootstrapperProject = fs.readFileSync(burnBootstrapperProjectPath, 'utf8');

  assert.match(design, /Fuente de verdad visual y UX para las superficies operativas de EvaluaPro/);
  assert.match(design, /frontend docente, portal alumno, admin negocio, Dashboard local e Installer Hub/);
  assert.match(design, /## Layout Wizard Moderno/);
  assert.match(design, /1024x768/);
  assert.match(design, /AutomationProperties\.Name/);
  assert.match(design, /Desinstalacion estandar|Desinstalación estandar|Desinstalación estándar/);
  assert.match(design, /Layout Wizard Moderno/);
  assert.match(design, /Preparar, Revisar, Ejecutar y Resultado/);
  assert.match(design, /#F6F8FA/);
  assert.match(uxCriteria, /docs\/DESIGN\.md/);
  assert.match(installerHubDocs, /docs\/DESIGN\.md/);

  assert.match(mainWindowXaml, /Width="1040"/);
  assert.match(mainWindowXaml, /Height="760"/);
  assert.match(mainWindowXaml, /MinWidth="980"/);
  assert.match(mainWindowXaml, /MinHeight="700"/);
  assert.doesNotMatch(mainWindowXaml, /Canvas IsHitTestVisible="False"/);
  assert.doesNotMatch(mainWindowXaml, /CornerRadius="(?:1[0-9]|2[0-9])"/);
  assert.match(mainWindowXaml, /KeyboardNavigation\.TabNavigation="Cycle"/);
  assert.match(mainWindowXaml, /x:Name="StepperHost"/);
  assert.match(mainWindowXaml, /x:Name="StepHost"/);
  assert.match(mainWindowXaml, /x:Name="PrepareStepPanel"/);
  assert.match(mainWindowXaml, /<ScrollViewer x:Name="ReviewStepPanel"[\s\S]*?VerticalScrollBarVisibility="Auto"/);
  assert.match(mainWindowXaml, /x:Name="ExecuteStepPanel"/);
  assert.match(mainWindowXaml, /x:Name="ResultStepPanel"/);
  assert.match(mainWindowXaml, /PrimaryButtonStyle/);
  assert.match(mainWindowXaml, /SecondaryButtonStyle/);
  assert.match(mainWindowXaml, /DangerButtonStyle/);
  assert.match(mainWindowXaml, /FieldLabelStyle/);
  assert.match(mainWindowXaml, /HelpTextStyle/);
  assert.match(mainWindowXaml, /StepCardStyle/);
  assert.match(mainWindowXaml, /StatusBadgeStyle/);
  assert.match(mainWindowXaml, /#0F766E/);
  assert.match(mainWindowXaml, /#2563EB/);
  assert.match(mainWindowXaml, /#B45309/);
  assert.match(mainWindowXaml, /#B42318/);
  assert.match(mainWindowXaml, /#15803D/);
  assert.doesNotMatch(mainWindowXaml, /#F3EFE7|#F7F2E9|#F4F1EA/);
  assert.doesNotMatch(mainWindowXaml, /LinearGradientBrush/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="AdvancedConfigExpander"/);
  assert.doesNotMatch(mainWindowXaml, /Configuración avanzada|Mongo URI|MongoDB/i);
  assert.doesNotMatch(mainWindowXaml, /x:Name="MongoUriTextBox"|x:Name="NodeEnvTextBox"|x:Name="ApiPortTextBox"/);
  assert.match(mainWindowXaml, /x:Name="PrereqListView"[\s\S]*?MinHeight="72"[\s\S]*?MaxHeight="96"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="PrereqListView"[^>]*Height="300"/);
  assert.match(mainWindowXaml, /x:Name="LogExpander"[\s\S]*?IsExpanded="False"/);
  assert.match(mainWindowXaml, /Text="Evidencia técnica"[\s\S]*?%ProgramData%\\EvaluaPro\\installer-hub\\logs/);
  assert.match(mainWindowXaml, /AutomationProperties\.Name="Ruta de bitácoras técnicas"/);
  assert.doesNotMatch(mainWindowXaml, /ToolTip="Detalle por requisito\."/);
  assert.match(mainWindowXaml, /<Style TargetType="ToolTip">[\s\S]*?<Setter Property="MaxWidth" Value="360"/);
  assert.match(mainWindowXaml, /x:Name="ModeImpactBorder"/);
  assert.match(mainWindowXaml, /x:Name="ModeImpactTitleTextBlock"/);
  assert.match(mainWindowXaml, /x:Name="ModeImpactChecklistTextBlock"/);
  assert.match(mainWindowXaml, /x:Name="PrereqSummaryBorder"/);
  assert.match(mainWindowXaml, /x:Name="PrereqSummaryTextBlock"/);
  assert.match(mainWindowXaml, /x:Name="PrereqSummaryHintTextBlock"/);
  assert.match(mainWindowXaml, /x:Name="FooterNextActionTextBlock"/);
  assert.match(mainWindowXaml, /<Setter Property="ToolTip" Value="\{Binding ToolTipText\}"/);
  assert.match(mainWindowXaml, /<Setter Property="AutomationProperties\.Name" Value="\{Binding AccessibleSummary\}"/);
  assert.match(mainWindowXaml, /x:Name="InstallerLogoFrame"/);
  assert.match(mainWindowXaml, /x:Name="InstallerLogoImage"[\s\S]*?evaluapro-installer-logo\.png[\s\S]*?RenderOptions\.BitmapScalingMode="HighQuality"/);
  assert.match(mainWindowXaml, /x:Name="SplashInstallerLogoImage"[\s\S]*?evaluapro-installer-logo\.png[\s\S]*?RenderOptions\.BitmapScalingMode="HighQuality"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="OfficialLogoFrame"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="OfficialLogoImage"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="BrandGraphicStrip"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="SplashOfficialLogoImage"/);
  assert.match(mainWindowXaml, /Icon="pack:\/\/application:,,,\/assets\/evaluapro-installer-logo\.png"/);
  assert.match(bootstrapperProject, /ApplicationIcon>[\s\S]*installer-logo-contrast\.ico/);
  assert.match(bootstrapperProject, /logos\\evaluapro-installer-logo-contrast\.png" Link="assets\/evaluapro-installer-logo\.png"/);
  assert.doesNotMatch(bootstrapperProject, /logos\\evaluapro-official-hero\.png" Link="assets\/evaluapro-installer-logo\.png"/);
  assert.doesNotMatch(bootstrapperProject, /logos\\logo_sys\.png" Link="assets\/evaluapro-official-imagotipo\.png"/);
  assert.doesNotMatch(bootstrapperProject, /oauth-logo-evaluapro-512\.png" Link="assets\/evaluapro-installer-logo\.png"/);
  assert.doesNotMatch(mainWindowXaml, /evaluapro-official-(hero|imagotipo)\.png/);
  assert.doesNotMatch(mainWindowXaml, />Docente local</);
  assert.doesNotMatch(mainWindowXaml, />Evidencia</);
  assert.doesNotMatch(mainWindowXaml, />Guiado</);
  assert.match(mainWindowXaml, /x:Name="SplashGraphicIndicators"/);
  assert.match(mainWindowXaml, /BrandTileStyle/);
  assert.match(mainWindowXaml, /x:Name="StepConnectorTermsPrepare"/);
  assert.match(mainWindowXaml, /x:Name="StepConnectorExecuteResult"/);
  assert.match(mainWindowXaml, /x:Name="StatusVisualPlate"/);
  assert.match(mainWindowXaml, /x:Name="StatusVisualIcon"/);
  assert.match(mainWindowXaml, /x:Name="ModeImpactIconPlate"/);
  assert.match(mainWindowXaml, /x:Name="ModeImpactIcon"/);
  assert.match(mainWindowXaml, /x:Name="PrereqSummaryIconPlate"/);
  assert.match(mainWindowXaml, /x:Name="PrereqSummaryIcon"/);
  assert.match(mainWindowXaml, /IconPlateStyle/);
  assert.match(mainWindowXaml, /x:Name="LiveExplanationBorder"/);
  assert.match(mainWindowXaml, /x:Name="LiveExplanationTitleTextBlock"/);
  assert.match(mainWindowXaml, /x:Name="LiveExplanationTextBlock"/);
  assert.match(mainWindowXaml, /Qué está pasando/);

  for (const controlName of [
    'FlavorComboBox',
    'ModeComboBox',
    'InstallDirTextBox',
    'PrereqListView',
    'InstallProgressBar',
    'LogTextBox',
    'BackButton',
    'NextButton',
    'DetectButton',
    'StartButton',
    'RestartNowButton',
    'CloseButton'
  ]) {
    const controlPattern = new RegExp(`x:Name="${controlName}"[\\s\\S]*?AutomationProperties\\.Name=`);
    assert.match(mainWindowXaml, controlPattern, `${controlName} debe tener AutomationProperties.Name`);
  }

  assert.match(mainWindowXaml, /Content="_Revisar equipo"/);
  assert.match(mainWindowXaml, /Content="_Atrás"/);
  assert.match(mainWindowXaml, /Content="_Siguiente"/);
  assert.match(mainWindowXaml, /Content="_Continuar"/);
  assert.match(mainWindowXaml, /Content="Reiniciar _ahora"/);
  assert.match(mainWindowXaml, /Content="_Cerrar"/);
  assert.match(mainWindowXaml, /x:Name="AcceptTermsCheckBox"[\s\S]*?Checked="AcceptTermsCheckBox_OnClick"[\s\S]*?Unchecked="AcceptTermsCheckBox_OnClick"/);
  assert.doesNotMatch(mainWindowXaml, /x:Name="AcceptTermsCheckBox"[\s\S]*?Click="AcceptTermsCheckBox_OnClick"/);
  assert.match(mainWindowCode, /DetectButton\.Focus\(\)/);
  assert.match(mainWindowCode, /GetModeActionLabel\(normalizedMode\)\.Replace\("_", string\.Empty\)/);
  assert.match(mainWindowCode, /enum WizardStep/);
  assert.match(mainWindowCode, /SetWizardStep\(WizardStep\.Prepare\)/);
  assert.match(mainWindowCode, /BackButton_OnClick/);
  assert.match(mainWindowCode, /NextButton_OnClick/);
  assert.match(mainWindowCode, /RefreshModeImpact\(normalizedMode\)/);
  assert.match(mainWindowCode, /RefreshPrerequisiteSummary\(rows\)/);
  assert.match(mainWindowCode, /RefreshFooterGuidance\(\)/);
  assert.match(mainWindowCode, /RefreshStatusVisual\(workflow\)/);
  assert.match(mainWindowCode, /RefreshStepConnectors\(hasFailure\)/);
  assert.match(mainWindowCode, /SetStepConnector\(Rectangle connector/);
  assert.match(mainWindowCode, /ModeImpactIcon\.Data = RepairGeometry/);
  assert.match(mainWindowCode, /PrereqSummaryIcon\.Data = CrossGeometry/);
  assert.match(mainWindowCode, /RefreshLiveExplanationForStep\(\)/);
  assert.match(mainWindowCode, /SetLiveExplanation\(string title, string description\)/);
  assert.match(mainWindowCode, /SetLiveExplanation\("Revisión en curso"/);
  assert.match(mainWindowCode, /SetLiveExplanation\("Ejecución iniciada"/);
  assert.match(mainWindowCode, /ToolTipText =>/);
  assert.match(mainWindowCode, /AccessibleSummary =>/);
});

test('Installer Hub tiene QA UIAutomation no destructivo para ciclo de vida visual', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const runner = fs.readFileSync(installerHubUiLifecyclePath, 'utf8');
  const bootstrapper = fs.readFileSync(burnBootstrapperSourcePath, 'utf8');

  assert.equal(
    packageJson.scripts['test:installer-hub:ui'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-ui-lifecycle.ps1'
  );

  assert.match(runner, /UIAutomationClient/);
  assert.match(runner, /dist\\installer\\installer-local-paths\.json/);
  assert.match(runner, /reports\\qa\\installer-hub-ui/);
  assert.match(runner, /installer-hub-ui-automation-report\.json/);
  assert.match(runner, /installer-hub-ui-automation\.log/);
  assert.match(runner, /EVALUAPRO_INSTALLER_UI_QA_NO_PRODUCT_ACTION/);
  assert.match(runner, /EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP/);
  assert.match(runner, /EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP/);
  assert.match(runner, /EVALUAPRO_INSTALLER_SIMULATE_PRODUCT_ACTION/);
  assert.match(runner, /EVALUAPRO_INSTALLER_ASSUME_INTERNET/);
  assert.match(runner, /Capture-Window/);
  assert.match(runner, /01-splash/);
  assert.match(runner, /02-preparar/);
  assert.match(runner, /03-revisar/);
  assert.match(runner, /04-ejecutar-busy/);
  assert.match(runner, /05-resultado/);
  assert.match(runner, /06-avanzado/);
  assert.match(runner, /07-min-980x700/);
  assert.match(runner, /MoveWindow/);
  assert.match(runner, /Select-ComboItem/);
  assert.match(runner, /Test-ScrollPattern/);
  assert.match(runner, /StartButton/);
  assert.match(runner, /RestartNowButton/);
  assert.match(runner, /CloseButton/);
  assert.match(runner, /Stop-Process -Id \$process\.Id -Force/);

  assert.match(bootstrapper, /EVALUAPRO_INSTALLER_UI_QA_NO_PRODUCT_ACTION/);
  assert.match(bootstrapper, /SimulateUiQaProductActionAsync/);
  assert.match(bootstrapper, /No se ejecuto la transaccion Burn\/MSI/);
  assert.match(bootstrapper, /El producto real no fue modificado/);
});

test.skip('Installer Hub tiene runner E2E real docente con guardas de VM y evidencia completa', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const runner = fs.readFileSync(installerHubE2eDocentePath, 'utf8');
  const readiness = fs.readFileSync(path.join(root, 'scripts', 'installer-hub-vm-readiness.ps1'), 'utf8');
  const elevatedLauncher = fs.readFileSync(path.join(root, 'scripts', 'start-installer-hub-e2e-elevated.ps1'), 'utf8');
  const vmLauncher = fs.readFileSync(vmE2eLauncherPath, 'utf8');
  const vmInVm = fs.readFileSync(vmE2eInVmPath, 'utf8');
  const hostCanaryLauncher = fs.readFileSync(hostCanaryLauncherPath, 'utf8');
  const autoE2eLauncher = fs.readFileSync(autoE2eLauncherPath, 'utf8');
  const qaSecretSetup = fs.readFileSync(qaSecretSetupPath, 'utf8');

  assert.equal(
    packageJson.scripts['test:installer-hub:e2e:docente'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1'
  );
  assert.equal(
    packageJson.scripts['installer:hub:vm-readiness'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-hub-vm-readiness.ps1'
  );
  assert.equal(
    packageJson.scripts['installer:hub:e2e:elevated'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-installer-hub-e2e-elevated.ps1'
  );
  assert.equal(
    packageJson.scripts['installer:hub:e2e:host-canary'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ci/run-e2e-host-canary.ps1'
  );
  assert.equal(
    packageJson.scripts['installer:hub:e2e:auto'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ci/run-e2e-auto.ps1'
  );
  assert.equal(
    packageJson.scripts['installer:hub:e2e:set-qa-secret'],
    'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ci/set-e2e-qa-secret.ps1'
  );

  assert.match(runner, /IUnderstandThisMutatesVm/);
  assert.match(runner, /ExpectedSnapshotName = 'pre-evaluapro-installer-e2e'/);
  assert.match(runner, /ExpectedVmComputerName = 'EVALPRO-E2E'/);
  assert.match(runner, /ExpectedHostCanaryComputerName = 'TEZKATLI'/);
  assert.match(runner, /\[switch\]\$AllowHostCanary/);
  assert.match(runner, /host-canary-identity/);
  assert.match(runner, /Host canary autorizado/);
  assert.match(runner, /Assert-RunningInsideExpectedVm/);
  assert.match(runner, /COMPUTERNAME=\$current expected=\$expected/);
  assert.match(runner, /EVALUAPRO_E2E_VM_SNAPSHOT/);
  assert.match(runner, /dist\\installer\\installer-local-paths\.json/);
  assert.match(runner, /EvaluaPro-InstallerHub-docente-local/);
  assert.match(runner, /function Get-Sha256Hash/);
  assert.match(runner, /System\.Security\.Cryptography\.SHA256/);
  assert.match(runner, /Assert-Hash/);
  assert.match(runner, /Captura omitida/);
  assert.match(runner, /detectionTimeoutSec = if \(\$AllowHostCanary\) \{ 420 \} else \{ 240 \}/);
  assert.match(runner, /function Get-LatestDetectPrereqsState/);
  assert.match(runner, /detect-response-ready/);
  assert.match(runner, /Get-EvaluaProUninstallEntries/);
  assert.doesNotMatch(runner, /Invoke-DockerStableStack|Assert-DockerStable|Export-DockerEvidence/);
  assert.doesNotMatch(runner, /LastDockerExitCode|docker compose|docker-ps|docker-inspect|docker-logs|docker-context|docker-images/);
  assert.match(runner, /Capture-DashboardScreenshots/);
  assert.match(runner, /Test-UpdateSmoke/);
  assert.match(runner, /\/api\/update\/status/);
  assert.match(runner, /update-status\.json/);
  assert.match(runner, /\$Name -match 'manifest\|config\|update-status'/);
  assert.match(runner, /RestartNowButton/);
  assert.match(runner, /restart-required/);
  assert.match(runner, /Write-TutorialMarkdown/);
  assert.match(runner, /Assert-NoActiveEvaluaProAfterUninstall/);
  assert.doesNotMatch(runner, /mongo_local|api_docente_prod|web_docente_prod/);
  assert.match(runner, /runtime-audit-before\.json/);
  assert.match(runner, /runtime-audit-after\.json/);
  assert.match(runner, /healthchecks\.json/);
  assert.match(runner, /\/api\/salud/);
  assert.match(runner, /\/api\/status/);
  assert.match(runner, /playwright.*screenshot/s);
  assert.match(runner, /screenshots/);
  assert.match(runner, /manifest/);
  assert.match(runner, /processes/);
  assert.match(runner, /report\.json/);
  assert.match(runner, /tutorial\.md/);
  assert.match(runner, /Invoke-InstallerHubMode -Mode 'install'/);
  assert.match(runner, /Invoke-InstallerHubMode -Mode 'repair'/);
  assert.match(runner, /Invoke-InstallerHubMode -Mode 'uninstall'/);
  assert.match(runner, /Invoke-InstalledBroker -Action 'verify-installation'/);
  assert.match(runner, /Invoke-InstalledBroker -Action 'open-dashboard'/);
  assert.match(runner, /Test-UpdateSmoke -BaseUrl \$dashboardBase/);
  assert.match(runner, /Wait-BootstrapState/);
  assert.match(runner, /\$freshWindow = Find-Window -TimeoutSec 1/);
  assert.match(runner, /\$lastText = Get-WindowTextSnapshot -Window \$Window/);
  assert.match(runner, /installation\.manifest\.json/);
  assert.match(runner, /update-config\.json/);
  assert.match(runner, /programdata-installer-hub-logs/);
  assert.match(runner, /processes-before\.json/);
  assert.match(runner, /processes-after\.json/);
  assert.match(runner, /installer-hub-e2e-docente-report\.json/);

  const tutorial = fs.readFileSync(path.join(root, 'docs', 'tutoriales', 'installer-hub-docente-e2e.md'), 'utf8');
  assert.match(tutorial, /Tutorial visual E2E Installer Hub docente-local/);
  assert.match(tutorial, /Plataforma docente nativa/);
  assert.match(tutorial, /Update smoke/);
  assert.match(tutorial, /run-e2e-launcher\.ps1 -DryRun/);
  assert.match(tutorial, /acceptsCredentialParameter=true/);
  assert.match(tutorial, /-Credential/);
  assert.match(tutorial, /-QaPassSecureString/);
  assert.match(tutorial, /powershell-direct-e2e-launch\.json/);
  assert.match(tutorial, /no guardar passwords/i);
  assert.doesNotMatch(tutorial, /Docker stable|docker compose|docker\//i);
  assert.doesNotMatch(runner, /docker compose --profile prod up --no-build -d/);
  assert.match(tutorial, /report\.json/);
  assert.match(tutorial, /## Capturas/);

  assert.match(readiness, /No instala, no repara, no arranca el Hub y no modifica la VM/);
  assert.match(readiness, /Test-WSMan -ComputerName \$ComputerName/);
  assert.match(readiness, /Get-VM -Name \$VmName/);
  assert.match(readiness, /EVALUAPRO_E2E_VM_SNAPSHOT/);
  assert.match(readiness, /installer-hub-vm-readiness\.json/);

  assert.match(elevatedLauncher, /Start-Process[\s\S]*-Verb RunAs/);
  assert.match(elevatedLauncher, /Start-VM -Name '\$VmName'/);
  assert.match(elevatedLauncher, /Test-WSMan -ComputerName '\$ExpectedVmComputerName'/);
  assert.match(elevatedLauncher, /WinRmTimeoutSeconds = 180/);
  assert.match(elevatedLauncher, /installer-hub-vm-readiness\.ps1/);
  assert.match(elevatedLauncher, /if \(\`\$LASTEXITCODE -ne 0\) \{ throw 'VM readiness fallo; no se ejecuta E2E mutante\.' \}/);
  assert.match(elevatedLauncher, /ExpectedVmComputerName = 'EVALPRO-E2E'/);
  assert.match(elevatedLauncher, /Readiness OK\. Ejecuta el runner mutante dentro de la VM/);
  assert.doesNotMatch(elevatedLauncher, /installer-hub-e2e-docente\.ps1/);
  assert.doesNotMatch(elevatedLauncher, /-IUnderstandThisMutatesVm/);
  assert.match(elevatedLauncher, /\[switch\]\$DryRun/);
  assert.match(elevatedLauncher, /if \(\$DryRun\)/);

  assert.match(vmLauncher, /Read-Host -AsSecureString -Prompt 'Password QA evaluaqa'/);
  assert.match(vmLauncher, /\[System\.Management\.Automation\.PSCredential\]\$Credential/);
  assert.match(vmLauncher, /\[System\.Security\.SecureString\]\$QaPassSecureString/);
  assert.match(vmLauncher, /if \(-not \$Credential\)/);
  assert.match(vmLauncher, /if \(-not \$QaPassSecureString\)/);
  assert.match(vmLauncher, /acceptsCredentialParameter = \$true/);
  assert.match(vmLauncher, /acceptsQaPassSecureString = \$true/);
  assert.match(vmLauncher, /\[switch\]\$DryRun/);
  assert.match(vmLauncher, /function Get-ReadinessReport/);
  assert.match(vmLauncher, /installer-hub-vm-readiness\.json/);
  assert.match(vmLauncher, /VM readiness no esta verde/);
  assert.match(vmLauncher, /State=Running/);
  assert.match(vmLauncher, /SecureStringToBSTR/);
  assert.match(vmLauncher, /ZeroFreeBSTR/);
  assert.match(vmLauncher, /Invoke-Command -VMName \$VMName -Credential \$Credential/);
  assert.match(vmLauncher, /ArgumentList \$qaPass, \$ExpectedSnapshotName, \$ExpectedVmComputerName/);
  assert.doesNotMatch(vmLauncher, /ArgumentList\s+'[^']+'/);
  assert.doesNotMatch(vmLauncher, /EVALUAPRO_QA_PASS=.*[A-Za-z0-9]/);
  assert.match(vmInVm, /\[Parameter\(Mandatory=\$true\)\]/);
  assert.match(vmInVm, /QaPass requerido/);
  assert.match(vmInVm, /ProjectRoot = 'C:\\EvaluaPro'/);
  assert.match(vmInVm, /function Write-LaunchReport/);
  assert.match(vmInVm, /powershell-direct-e2e-launch\.json/);
  assert.match(vmInVm, /missing-project-root/);
  assert.match(vmInVm, /missing-e2e-runner/);
  assert.match(vmInVm, /COMPUTERNAME\.Equals\(\$ExpectedVmComputerName/);
  assert.match(vmInVm, /EVALUAPRO_E2E_VM_SNAPSHOT = \$ExpectedSnapshotName/);
  assert.doesNotMatch(vmInVm, /installer:hub:vm-readiness/);
  assert.doesNotMatch(vmInVm, /QaPass\s*=\s*'[^']+'/);

  assert.match(hostCanaryLauncher, /ExpectedHostCanaryComputerName = 'TEZKATLI'/);
  assert.match(hostCanaryLauncher, /requiresQaPassSecureString = \$true/);
  assert.match(hostCanaryLauncher, /supportsEnvQaPass = \$true/);
  assert.match(hostCanaryLauncher, /autoGeneratesEphemeralQaPass = \$true/);
  assert.match(hostCanaryLauncher, /RandomNumberGenerator/);
  assert.match(hostCanaryLauncher, /PromptForQaPass/);
  assert.match(hostCanaryLauncher, /New-SecureStringFromPlainText/);
  assert.match(hostCanaryLauncher, /System\.Security\.SecureString/);
  assert.match(hostCanaryLauncher, /qaPassSecretConfigured/);
  assert.match(hostCanaryLauncher, /Resolve-QaPassSecureString/);
  assert.match(hostCanaryLauncher, /EVALUAPRO_QA_PASS/);
  assert.match(hostCanaryLauncher, /ConvertTo-SecureString/);
  assert.match(hostCanaryLauncher, /mutatesHost = \$true/);
  assert.match(hostCanaryLauncher, /Read-Host -AsSecureString -Prompt 'Password QA evaluaqa'/);
  assert.doesNotMatch(hostCanaryLauncher, /EVALUAPRO_DOCKER_RUNTIME/);
  assert.doesNotMatch(vmInVm, /EVALUAPRO_DOCKER_RUNTIME/);
  assert.match(hostCanaryLauncher, /-AllowHostCanary/);
  assert.match(hostCanaryLauncher, /-SkipSnapshotCheck/);
  assert.match(hostCanaryLauncher, /ZeroFreeBSTR/);
  assert.doesNotMatch(hostCanaryLauncher, /EVALUAPRO_QA_PASS\s*=\s*'[^']+'/);

  assert.match(autoE2eLauncher, /ValidateSet\('host-canary', 'vm', 'all'\)/);
  assert.match(autoE2eLauncher, /run-e2e-host-canary\.ps1/);
  assert.match(autoE2eLauncher, /run-e2e-launcher\.ps1/);
  assert.match(autoE2eLauncher, /start-installer-hub-e2e-elevated\.ps1/);
  assert.match(autoE2eLauncher, /Invoke-HostCanary/);
  assert.match(autoE2eLauncher, /Invoke-VmE2E/);
  assert.match(autoE2eLauncher, /QaPassSecureString/);
  assert.match(autoE2eLauncher, /QaPassSecretPath/);
  assert.match(autoE2eLauncher, /PromptForQaPass/);
  assert.doesNotMatch(autoE2eLauncher, /EVALUAPRO_QA_PASS\s*=\s*'[^']+'/);

  assert.match(qaSecretSetup, /ConvertFrom-SecureString/);
  assert.match(qaSecretSetup, /current-windows-user-dpapi/);
  assert.match(qaSecretSetup, /FromEnvironment/);
  assert.match(qaSecretSetup, /Clear/);
  assert.doesNotMatch(qaSecretSetup, /EVALUAPRO_QA_PASS\s*=\s*'[^']+'/);
});

test('build-msi publica BA personalizada y conserva contrato de asset publico por flavor', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config', 'installer-flavors.json'), 'utf8'));

  assert.match(buildScript, /solo se soporta en Windows/);
  assert.match(buildScript, /RuntimeInformation/);
  assert.match(buildScript, /Publish-BurnBootstrapperApp/);
  assert.match(buildScript, /Remove-StaleInstallerArtifacts/);
  assert.match(buildScript, /Write-InstallerLocalPathsManifest/);
  assert.match(buildScript, /_internal/);
  assert.match(buildScript, /Assert-CanonicalInstallerIcon/);
  assert.match(buildScript, /MsiSourcePath/);
  assert.match(buildScript, /\$DotNetExecutable publish/);
  assert.match(buildScript, /BootstrapperApp/);
  assert.match(buildScript, /Invoke-InstallerHashesGeneration/);
  assert.equal(catalog.flavors.every((flavor) => flavor.bundleName === flavor.installerHubExeName), true);
});

test('generador de hashes publica SHASUMS256 agregado por directorio contractual', () => {
  const hashScript = fs.readFileSync(path.join(root, 'scripts', 'generate-installer-hashes.ps1'), 'utf8');

  assert.match(hashScript, /SHASUMS256\.txt/);
  assert.match(hashScript, /\$shasumsByDirectory/);
  assert.match(hashScript, /GetEnumerator\(\)/);
});

test('firma de instaladores regenera hashes y manifest despues de mutar binarios', () => {
  const signScript = fs.readFileSync(path.join(root, 'scripts', 'sign-installer-artifacts.ps1'), 'utf8');

  assert.match(signScript, /generate-installer-hashes\.ps1/);
  assert.match(signScript, /Test-AlreadySignedValid/);
  assert.match(signScript, /Ya firmado y valido; se omite/);
  assert.match(signScript, /'-InstallerDir'[\s\S]*\$InstallerDir/);
  assert.match(signScript, /Start-Process[\s\S]*'-File'[\s\S]*\$hashScript[\s\S]*-PassThru/);
  assert.match(signScript, /\$hashProcess\.ExitCode/);
  assert.doesNotMatch(signScript, /& \$hashScript -InstallerDir \$InstallerDir\s+if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(signScript, /post-firma/);
});

test('wrapper Install-EvaluaPro lanza el Hub sin forzar RunAs', () => {
  const wrapper = fs.readFileSync(path.join(root, 'scripts', 'Install-EvaluaPro.ps1'), 'utf8');

  assert.match(wrapper, /Start-Process -FilePath \$targetPath -WorkingDirectory \$InstallersDir \| Out-Null/);
  assert.doesNotMatch(wrapper, /-Verb RunAs/);
});

test.skip('installer burn ejecuta MSI con msiexec y deja trazabilidad de errores de Node', () => {
  const commonModule = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1'), 'utf8');
  const prereqInstaller = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqInstaller.psm1'), 'utf8');
  const prereqDetector = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1'), 'utf8');

  assert.match(commonModule, /msiexec\.exe/);
  assert.match(commonModule, /\/L\*v/);
  assert.match(commonModule, /Get-InstallerHubLastProcessResult/);

  assert.match(prereqInstaller, /Log MSI:/);
  assert.match(prereqInstaller, /codigo 1603 \(MSI\)/);

  assert.match(prereqDetector, /Node no detectado o no ejecutable/);
});

test.skip('helper Burn detecta prerequisitos con contrato JSON estable', () => {
  if (process.platform !== 'win32') {
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-burn-helper-'));
  const requestPath = path.join(tempRoot, 'request.json');
  const responsePath = path.join(tempRoot, 'response.json');
  fs.writeFileSync(requestPath, JSON.stringify({ flavorId: 'saas-completo' }, null, 2), 'utf8');

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
    assert.equal(payload.phase, 'detect-prereqs');
    assert.equal(typeof payload.exitCode, 'number');
    assert.equal(typeof payload.message, 'string');
    assert.equal(Array.isArray(payload.logs), true);
    assert.equal(typeof payload.data.recommendedMode, 'string');
    assert.equal(typeof payload.data.system.internetOk, 'boolean');
    assert.equal(Array.isArray(payload.data.prerequisites), true);
    if (payload.data.remediation) {
      assert.equal(typeof payload.data.remediation.requiresRestart, 'boolean');
      assert.equal(typeof payload.data.remediation.restartReason, 'string');
      assert.equal(typeof payload.data.remediation.resumeToken, 'string');
      assert.equal(typeof payload.data.remediation.phase, 'string');
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test.skip('helper Burn respeta EVALUAPRO_INSTALLER_ASSUME_INTERNET en deteccion', () => {
  if (process.platform !== 'win32') {
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-burn-helper-internet-'));
  const requestPath = path.join(tempRoot, 'request.json');
  const responsePath = path.join(tempRoot, 'response.json');
  fs.writeFileSync(requestPath, JSON.stringify({ flavorId: 'saas-completo' }, null, 2), 'utf8');

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
      timeout: 60_000,
      env: {
        ...process.env,
        EVALUAPRO_INSTALLER_ASSUME_INTERNET: '1'
      }
    });

    const payload = JSON.parse(fs.readFileSync(responsePath, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(payload.ok, true);
    assert.equal(payload.data.system.internetOk, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test.skip('helper Burn prioriza runtime Node host valido antes de descarga remota', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(helper, /EVALUAPRO_INSTALLER_USE_HOST_NODE_RUNTIME/);
  assert.match(helper, /Get-Command\s+'node\.exe'/);
  assert.match(helper, /\$hostMajor -ge \$requiredMajor/);
  assert.match(helper, /Copy-Item[\s\S]+Get-EmbeddedNodeMajorVersion/);
  assert.match(helper, /source\s+=\s+'host-node'/);
});

test.skip('helper Burn alinea rutas de shortcuts con verificacion post-install', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(helper, /EVALUAPRO_DESKTOP_PATH[\s\S]+USERPROFILE[\s\S]+Desktop/);
  assert.match(helper, /EVALUAPRO_STARTMENU_PATH[\s\S]+APPDATA[\s\S]+Start Menu\\Programs\\EvaluaPro/);
  assert.match(helper, /& \$shortcutsScript -Port 4519 -IncludeDevShortcut \(\[bool\]\$includeDevShortcut\)/);
  assert.match(helper, /No se pudieron regenerar accesos directos oficiales/);
});

test.skip('bootstrapper Burn WPF .NET 8 orquesta deteccion, MSI y helper post-install', () => {
  const project = fs.readFileSync(burnBootstrapperProjectPath, 'utf8');
  const program = fs.readFileSync(path.join(root, 'packaging', 'wix', 'BurnBootstrapperApp', 'Program.cs'), 'utf8');
  const source = fs.readFileSync(burnBootstrapperSourcePath, 'utf8');
  const windowXaml = fs.readFileSync(burnBootstrapperWindowPath, 'utf8');
  const windowCode = fs.readFileSync(burnBootstrapperWindowCodePath, 'utf8');
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(project, /<TargetFramework>net8\.0-windows<\/TargetFramework>/);
  assert.match(project, /<UseWPF>true<\/UseWPF>/);
  assert.match(project, /WixToolset\.BootstrapperApplicationApi/);

  assert.doesNotMatch(program, /\[STAThread\]/);
  assert.match(program, /ManagedBootstrapperApplication\.Run/);

  assert.match(source, /engineHandle\?\.Detect\(\)/);
  assert.match(source, /var exitCode = operationFinished\.Task\.GetAwaiter\(\)\.GetResult\(\)/);
  assert.match(source, /engineHandle\?\.Quit\(exitCode\)/);
  assert.match(source, /StartPowerShellHelperProcess/);
  assert.match(source, /CreatePowerShellHelperStartInfo/);
  assert.match(source, /GetPowerShellExecutableCandidates/);
  assert.match(source, /ArgumentList\.Add\("-RequestPath"\)/);
  assert.doesNotMatch(source, /LaunchApprovedExe/);
  assert.match(source, /detect-prereqs/);
  assert.match(source, /RunAutomaticRemediationFromDetectionAsync/);
  assert.match(source, /EnsurePrerequisitesReadyAsync/);
  assert.match(source, /RemediationPayload/);
  assert.match(source, /RequiresRestart/);
  assert.match(source, /RegisterRunOnceForResume/);
  assert.match(source, /GetOperationTitle/);
  assert.match(source, /GetWorkflowHint/);
  assert.match(source, /GetStageDisplayLabel/);
  assert.match(source, /PersistResumeState/);
  assert.match(source, /RequestSystemRestart/);
  assert.match(source, /post-install/);
  assert.match(source, /GetOperationProgressVerb/);
  assert.match(source, /GetStageDisplayLabel/);
  assert.match(source, /GetPostOperationStageTitle/);
  assert.match(source, /GetOperationCompletedTitle/);
  assert.match(source, /EvaluaPro", "installer-hub", "logs"/);
  assert.match(source, /InstallFolder/);
  assert.match(source, /SelectedFlavorId/);
  assert.match(source, /DispatcherUnhandledException/);
  assert.match(source, /StartUiThread fatal exception/);
  assert.match(source, /ConfigureInitialFlavorLayout/);
  assert.match(source, /NotifyInitialDetectionCompleted/);

  assert.match(windowXaml, /install/);
  assert.match(windowXaml, /repair/);
  assert.match(windowXaml, /uninstall/);
  assert.match(windowXaml, /SelectionChanged="ModeComboBox_OnSelectionChanged"/);
  assert.doesNotMatch(windowXaml, /BrandModeBadgeTextBlock/);
  assert.doesNotMatch(windowXaml, /BrandFlavorBadgeTextBlock/);
  assert.match(windowXaml, /BrandVersionBadgeTextBlock/);
  assert.match(windowXaml, /BrandStatementTextBlock/);
  assert.match(windowXaml, /Analizando prerequisitos\.\.\./);
  assert.doesNotMatch(windowXaml, /Configuración avanzada|Mongo URI|MongoDB/i);
  assert.doesNotMatch(windowXaml, /Requerir activación de licencia/);
  assert.match(windowXaml, /SplashOverlay/);
  assert.match(windowXaml, /RestartNowButton/);
  assert.match(windowXaml, /evaluapro-installer-logo\.png/);
  assert.doesNotMatch(windowXaml, /evaluapro-official-(hero|imagotipo)\.png/);
  assert.match(windowCode, /ConfigureInitialFlavorLayout/);
  assert.match(windowCode, /NotifyInitialDetectionCompleted/);
  assert.match(windowCode, /SetRestartActionVisible/);
  assert.match(windowCode, /RestartRequested/);
  assert.match(windowCode, /ModeChanged/);
  assert.match(windowCode, /RefreshOperationalChrome/);
  assert.match(windowCode, /StartSplashFallbackWatcher/);
  assert.match(windowXaml, /WorkflowHeaderTitleTextBlock/);

  assert.match(helper, /ValidateSet\('detect-prereqs', 'post-install'\)/);
  assert.match(helper, /configuracion_operativa/);
  assert.match(helper, /verificacion_final/);
  assert.match(helper, /blindaje_licencia_local/);
  assert.match(helper, /portable-license\.mjs/);
  assert.match(helper, /mode -ne 'uninstall' -and \[string\]\$flavor\.flavorId -eq 'saas-completo'/);
});

test('resolucion de flavors funciona en layout plano del bundle Burn', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installer-flat-'));
  const commonModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1');
  try {
    const flatCatalogPath = path.join(tempRoot, 'installer-flavors.json');
    fs.writeFileSync(flatCatalogPath, JSON.stringify({
      version: 1,
      defaultFlavorId: 'saas-completo',
      flavors: [
        {
          flavorId: 'saas-completo',
          installerHubExeName: 'EvaluaPro-InstallerHub-saas-completo.exe',
          requireLocalPortal: false
        }
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
    assert.equal(parsed.defaultFlavorId, 'saas-completo');
    assert.equal(Array.isArray(parsed.flavors), true);
    assert.equal(parsed.flavors.length, 1);
    assert.equal(parsed.flavors[0].flavorId, 'saas-completo');
    assert.equal(parsed.flavors[0].requireLocalPortal, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('resolver SHASUMS soporta pattern preferido y fallback dinamico por canal', () => {
  const commonModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1');
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${commonModulePath.replace(/'/g, "''")}'
$text = @'
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  node-v24.11.1-x64.msi
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  node-v24.14.1-x64.msi
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc  node-v24.14.1-win-x64.zip
'@
$preferred = Resolve-InstallerHubPackageFromShasums -Text $text -PreferredPattern 'node-v24.11.1-x64.msi' -FallbackRegex '^node-v24\\.\\d+\\.\\d+-x64\\.msi$'
$fallback = Resolve-InstallerHubPackageFromShasums -Text $text -PreferredPattern 'node-v24.99.9-x64.msi' -FallbackRegex '^node-v24\\.\\d+\\.\\d+-x64\\.msi$'
[pscustomobject]@{
  preferred = $preferred
  fallback = $fallback
} | ConvertTo-Json -Depth 10
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.preferred.matchedBy, 'preferred-pattern');
  assert.equal(parsed.preferred.fileName, 'node-v24.11.1-x64.msi');
  assert.equal(parsed.fallback.matchedBy, 'fallback-regex');
  assert.equal(parsed.fallback.fileName, 'node-v24.14.1-x64.msi');
});

test.skip('runtime Burn concentra configuracion operativa, prerequisitos y blindaje de licencia', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');
  const operationalConfig = fs.readFileSync(operationalConfigModulePath, 'utf8');
  const license = fs.readFileSync(licenseSecurityModulePath, 'utf8');
  const prereqInstaller = fs.readFileSync(prereqInstallerModulePath, 'utf8');

  assert.match(helper, /configuracion_operativa/);
  assert.match(helper, /verificacion_final/);
  assert.match(helper, /blindaje_licencia_local/);
  assert.match(helper, /FlavorId|flavorId/);
  assert.match(operationalConfig, /DATABASE_URL|databaseUrl/);
  assert.doesNotMatch(operationalConfig, /MONGODB_URI|mongoUri/);
  assert.match(operationalConfig, /NODE_ENV|nodeEnv/);
  assert.match(operationalConfig, /PUERTO_API|puertoApi/);
  assert.match(operationalConfig, /PUERTO_PORTAL|puertoPortal/);
  assert.match(operationalConfig, /PORTAL_ALUMNO_API_KEY|portalAlumnoApiKey/);
  assert.match(operationalConfig, /GOOGLE_OAUTH_CLIENT_ID|requireGoogleOAuth/);
  assert.match(operationalConfig, /UpdateChannel|updateChannel/);
  assert.match(operationalConfig, /UpdateOwner|updateOwner/);
  assert.match(operationalConfig, /UpdateRepo|updateRepo/);
  assert.match(operationalConfig, /UpdateAssetName|updateAssetName/);
  assert.match(operationalConfig, /UpdateShaAssetName|updateShaAssetName/);
  assert.match(operationalConfig, /UpdateRequireSha256|updateRequireSha256/);
  assert.match(operationalConfig, /New-Item -ItemType Directory -Force -Path \$updateConfigDir/);
  assert.match(license, /Initialize-EvaluaProPortableAdminLicense/);
  assert.match(prereqInstaller, /Invoke-PrerequisiteInstallationFlow/);
});

test.skip('runtime embebido rehace runtime y evita Move-Item frágil', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(helper, /Runtime Node embebido preparado desde Node host/);
  assert.match(helper, /source = 'host-node'/);
  assert.match(helper, /\$hostMajor -ge \$requiredMajor/);
  assert.match(helper, /Remove-Item -LiteralPath \$runtimeRoot -Recurse -Force -ErrorAction Stop/);
  assert.match(helper, /New-Item -ItemType Directory -Path \$runtimeRoot -Force \| Out-Null/);
  assert.match(helper, /Copy-Item -Path \(Join-Path \$expandedRoot\.FullName '\*'\) -Destination \$stagingRoot -Recurse -Force/);
  assert.match(helper, /New-Item -ItemType Directory -Path \$nodeRoot -Force \| Out-Null/);
  assert.match(helper, /Copy-Item -Path \(Join-Path \$stagingRoot '\*'\) -Destination \$nodeRoot -Recurse -Force/);
  assert.doesNotMatch(helper, /Move-Item -LiteralPath \$stagingRoot -Destination \$nodeRoot -Force/);
});

test.skip('helper Burn limpia residuos de uninstall y omite refresh/verification restringida', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');
  const operationalConfig = fs.readFileSync(operationalConfigModulePath, 'utf8');

  assert.match(helper, /Invoke-DesktopAssetRefresh -InstallDir \$installDir -FlavorId \(\[string\]\$flavor\.flavorId\) -SkipManifestUpdate/);
  assert.match(helper, /if \(\$mode -eq 'uninstall'\) \{/);
  assert.match(helper, /Remove-InstallerInstallDirectory -InstallDir \$installDir/);
  assert.match(helper, /Blindaje de licencia omitido en uninstall\./);
  assert.match(operationalConfig, /if \(\$Mode -eq 'uninstall'\) \{/);
  assert.match(operationalConfig, /Configuracion operativa omitida en desinstalacion\./);
});

test('solo Burn queda soportado y el legado WinForms desaparece del arbol', () => {
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'installer-hub', 'InstallerHub.ps1')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'WizardUi.psm1')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'ProductInstaller.psm1')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'installer-hub', 'modules', 'ReleaseResolver.psm1')), false);
});

test('scripts del runtime Burn no usan operadores exclusivos de PowerShell 7', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');
  const common = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1'), 'utf8');
  const license = fs.readFileSync(licenseSecurityModulePath, 'utf8');
  const prereqInstaller = fs.readFileSync(prereqInstallerModulePath, 'utf8');
  assert.doesNotMatch(helper, /\?\?/);
  assert.doesNotMatch(common, /\?\?/);
  assert.doesNotMatch(license, /\?\?/);
  assert.doesNotMatch(prereqInstaller, /\?\?/);
});

test('helper Burn acepta installDir moderno sin romper StrictMode de PowerShell 5', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(helper, /function Get-RequestValue/);
  assert.match(helper, /function Get-TargetInstallDir/);
  assert.match(helper, /'TargetDir', 'targetDir', 'InstallDir', 'installDir'/);
  assert.doesNotMatch(helper, /\$requestJson\.TargetDir/);
});

test('helper Burn prepara contrato runtime instalado para dashboard docente', () => {
  const helper = fs.readFileSync(burnHelperPath, 'utf8');

  assert.match(helper, /function Ensure-InstallerRuntimeContract/);
  assert.match(helper, /apps\\backend\\data\\examenes_dev/);
  assert.match(helper, /apps\\backend\\data\\examenes_prod/);
  assert.match(helper, /apps\\backend\\data\\examenes_test/);
  assert.match(helper, /runtime\\node\\node\.exe/);
  assert.match(helper, /scripts\\launcher-broker\.ps1/);
  assert.match(helper, /ConvertTo-VbsStringLiteralContent/);
  assert.match(helper, /function Write-InstallerRuntimeEnv/);
  assert.match(helper, /JWT_SECRETO/);
  assert.match(helper, /New-InstallerSecret/);
  assert.match(helper, /DATABASE_URL/);
  assert.match(helper, /BACKEND_DATABASE_URL/);
  assert.doesNotMatch(helper, /EVALUAPRO_IMAGE_TAG/);
  assert.match(helper, /Write-InstallerEnvMap/);
  assert.match(helper, /Import-Module \$operationalConfigModule -Force/);
  assert.match(helper, /Invoke-EvaluaProOperationalConfiguration/);
  assert.match(helper, /function Assert-InstallerRuntimeEnv/);
  assert.match(helper, /Contrato runtime incompleto en \.env/);
  assert.doesNotMatch(helper, /backend\\dist\\index\.js/);
});

test('descarga de prerequisitos usa fallback HttpClient -> BITS -> Invoke-WebRequest', () => {
  const common = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1'), 'utf8');
  assert.match(common, /Add-Type -AssemblyName 'System\.Net\.Http'/);
  assert.match(common, /Start-BitsTransfer/);
  assert.match(common, /Invoke-WebRequest -Uri \$Url -OutFile \$Destination/);
  assert.match(common, /Descarga fallida por todos los metodos/);
});

test('elevacion UAC relanza con ruta absoluta y working directory del script', () => {
  const common = fs.readFileSync(path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1'), 'utf8');
  assert.match(common, /Resolve-InstallerElevationScriptPath/);
  assert.match(common, /Split-Path -Parent \$resolvedScriptPath/);
  assert.match(common, /WorkingDirectory = \$workingDirectory/);
  assert.match(common, /ArgumentList = \(\$quotedArgs -join ' '\)/);
});

test('elevacion UAC prepara copia estable cuando el script vive en IXP temp', () => {
  if (process.platform !== 'win32') {
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-ixp-'));
  const ixpDir = path.join(tempRoot, 'IXP123.TMP');
  fs.mkdirSync(ixpDir, { recursive: true });
  fs.writeFileSync(path.join(ixpDir, 'installer-hub.ps1'), 'Write-Host "hub"', 'utf8');
  fs.writeFileSync(path.join(ixpDir, 'Common.psm1'), 'Write-Host "common"', 'utf8');
  try {
    const script = `
Import-Module -Force -WarningAction SilentlyContinue '${path.join(root, 'scripts', 'installer-burn', 'modules', 'Common.psm1').replace(/'/g, "''")}'
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
    assert.match(workflow, /dist\/installer\/saas-completo\/EvaluaPro-InstallerHub-saas-completo-v\*\.exe/);
    assert.match(workflow, /Start-Process -FilePath \$exe(\.FullName)? -PassThru/);
    assert.match(workflow, /El bundle Burn publico se cerro antes del smoke timeout|El Installer Hub empaquetado se cerro antes del smoke timeout/);
  }
});

test('launcher broker unifica shortcuts, hub y splash state', () => {
  const broker = fs.readFileSync(path.join(root, 'scripts', 'launcher-broker.ps1'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  const trayHidden = fs.readFileSync(path.join(root, 'scripts', 'launcher-tray-hidden.vbs'), 'utf8');
  const shortcuts = fs.readFileSync(path.join(root, 'scripts', 'create-shortcuts.ps1'), 'utf8');
  const manifestScript = fs.readFileSync(path.join(root, 'scripts', 'generate-installation-manifest.ps1'), 'utf8');

  assert.match(broker, /booting_dashboard/);
  assert.match(broker, /booting_stack/);
  assert.match(broker, /Test-RequiresLocalPortal/);
  assert.match(broker, /healthy/);
  assert.match(broker, /degraded/);
  assert.match(broker, /failed/);
  assert.match(trayHidden, /launcher-broker\.ps1/);
  assert.match(trayHidden, /runId/);
  assert.match(shortcuts, /EvaluaPro - Hub/);
  assert.match(shortcuts, /EvaluaPro - Desinstalar/);
  assert.match(shortcuts, /open-hub/);
  assert.match(shortcuts, /uninstall \$Port auto/);
  assert.match(broker, /Iniciando desinstalacion guiada/);
  assert.match(shortcuts, /installer-canonical\.ico/);
  assert.match(shortcuts, /Resolve-InstalledShortcutIconPath/);
  assert.match(shortcuts, /Remove-LegacyShortcutIcons/);
  assert.doesNotMatch(shortcuts, /Save-IcoFromPngImages/);
  assert.doesNotMatch(shortcuts, /New-MultiSizeIcon/);
  assert.match(dashboard, /resolveInstallerHubExecutablePath/);
  assert.match(dashboard, /kind === 'uninstall'/);
  assert.match(dashboard, /installer-local-paths\.json/);
  assert.match(dashboard, /requireLocalPortal/);
  assert.match(manifestScript, /installer-canonical\.ico/);
  assert.match(manifestScript, /EvaluaPro - Desinstalar/);
  assert.doesNotMatch(manifestScript, /dashboard-hub\.ico/);
  assert.doesNotMatch(dashboard, /scripts[\\/]+installer-hub[\\/]+InstallerHub\.ps1/);
});

test('dashboard protege operaciones privilegiadas de soporte con step-up y allowlist', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');

  assert.match(dashboard, /privilegedSupportActions/);
  assert.match(dashboard, /hub-install/);
  assert.match(dashboard, /hub-repair/);
  assert.match(dashboard, /hub-update-apply/);
  assert.match(dashboard, /hub-uninstall/);
  assert.match(dashboard, /resolveSupportAuthorization/);
  assert.match(dashboard, /readVerifiedStepUpStatus/);
  assert.match(dashboard, /Get-EvaluaProStepUpStatus/);
  assert.match(dashboard, /step_up_required/);
  assert.match(dashboard, /support_action_not_allowed/);
  assert.match(dashboard, /support_confirmation_required/);
  assert.match(dashboard, /\/api\/support\/privileged\/status/);
  assert.match(dashboard, /\/api\/support\/privileged\/run/);
});

test('configuracion operativa rechaza ajustes inseguros o invalidos (fail-fast)', () => {
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${operationalConfigModulePath.replace(/'/g, "''")}'
$cfg = @{
  databaseUrl='file:C:/ProgramData/EvaluaPro/data/evaluapro.db'
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

test.skip('detector PowerShell expone estado abstracto de runtime Docker Windows', () => {
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
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

test.skip('docker_runtime_windows exige daemon operativo para marcar prerequisito como instalado', () => {
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='wsl2-engine-daemon-down'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
$prereq = [pscustomobject]@{
  name = 'Docker Runtime Windows'
  detectRule = [pscustomobject]@{ type = 'docker_runtime_windows' }
}
$status = Test-PrerequisiteStatus -Prerequisite $prereq
$runtime = Get-DockerRuntimeStatus
[pscustomobject]@{
  prereq = $status
  runtime = $runtime
} | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.runtime.installed, true);
  assert.equal(parsed.runtime.ready, false);
  assert.equal(parsed.prereq.installed, false);
  assert.match(String(parsed.prereq.reason || ''), /daemon no responde/i);
});

test.skip('docker_runtime_windows acepta Docker Desktop operativo como runtime compatible', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-burn-helper-docker-'));
  const requestPath = path.join(tempRoot, 'request.json');
  const responsePath = path.join(tempRoot, 'response.json');
  fs.writeFileSync(requestPath, JSON.stringify({ flavorId: 'saas-completo' }, null, 2), 'utf8');

  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='desktop'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_MAJOR='0'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
$dockerPrereq = [pscustomobject]@{
  name = 'Docker Runtime Windows'
  detectRule = [pscustomobject]@{ type = 'docker_runtime_windows' }
}
$nodeWslPrereq = [pscustomobject]@{
  name = 'Node.js WSL2'
  detectRule = [pscustomobject]@{ type = 'node_major_wsl'; minMajor = 24 }
}
[pscustomobject]@{
  docker = Test-PrerequisiteStatus -Prerequisite $dockerPrereq
  nodeWsl = Test-PrerequisiteStatus -Prerequisite $nodeWslPrereq
  runtime = Get-DockerRuntimeStatus
} | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.runtime.mode, 'desktop');
  assert.equal(parsed.docker.installed, true);
  assert.equal(parsed.nodeWsl.installed, true);
  assert.match(String(parsed.nodeWsl.reason || ''), /no es requerido/i);
});

test.skip('runtime Docker legacy prioriza WSL2 si Docker Desktop existe pero daemon no responde', () => {
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_DOCKER_RUNTIME='wsl2-engine'
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='desktop-daemon-down-wsl-ready'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
$runtime = Get-DockerRuntimeStatus
$runtime | ConvertTo-Json -Depth 8
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.preference, 'wsl2-engine');
  assert.equal(parsed.mode, 'wsl2-bootstrap-required');
  assert.equal(parsed.desktopInstalled, true);
  assert.equal(parsed.ready, false);
  assert.match(String(parsed.reason || ''), /prioriza bootstrap WSL2|WSL2 detectado/i);
});

test('Compose legacy conserva image-first y fallback build separado fuera del Hub docente', () => {
  const compose = fs.readFileSync(dockerComposePath, 'utf8');
  const prodBuild = fs.readFileSync(dockerComposeProdBuildPath, 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(compose, /api_docente_local:[\s\S]*?profiles:\s*\["dev"\]/);
  assert.match(compose, /web_docente_local:[\s\S]*?profiles:\s*\["dev"\]/);
  assert.match(compose, /api_docente_prod:[\s\S]*?image:\s*\$\{EVALUAPRO_API_DOCENTE_IMAGE:-ghcr\.io\/dtcsrni\/evaluapro_sistema_universitario\/evaluapro-api-docente/);
  assert.match(compose, /web_docente_prod:[\s\S]*?image:\s*\$\{EVALUAPRO_WEB_DOCENTE_IMAGE:-ghcr\.io\/dtcsrni\/evaluapro_sistema_universitario\/evaluapro-web-docente/);
  assert.match(compose, /EVALUAPRO_IMAGE_TAG:-1\.1\.1/);
  assert.doesNotMatch(compose, /api_docente_prod:[\s\S]*?build:[\s\S]*?profiles:\s*\["prod"\]/);
  assert.doesNotMatch(compose, /web_docente_prod:[\s\S]*?build:[\s\S]*?profiles:\s*\["prod"\]/);
  assert.match(prodBuild, /api_docente_prod:[\s\S]*?build:/);
  assert.match(prodBuild, /web_docente_prod:[\s\S]*?build:/);
  assert.match(packageJson.scripts['stack:prod:full'], /docker-compose\.prod-build\.yml/);
  assert.match(packageJson.scripts['api:rebuild'], /docker-compose\.prod-build\.yml/);
  assert.doesNotMatch(packageJson.scripts['stack:prod'], /--build/);
  assert.match(packageJson.scripts['stack:prod'], /--no-build -d mongo_local api_docente_prod web_docente_prod/);
  assert.doesNotMatch(packageJson.scripts['stack:prod'], /detect-host-ip/);
});

test('package workflow publica imagenes docente GHCR versionadas', () => {
  const workflow = fs.readFileSync(packageWorkflowPath, 'utf8');

  assert.match(workflow, /packages:\s*write/);
  assert.match(workflow, /docker\/login-action@v3/);
  assert.match(workflow, /ghcr\.io\/\$\{GITHUB_REPOSITORY,,\}\/evaluapro-api-docente/);
  assert.match(workflow, /ghcr\.io\/\$\{GITHUB_REPOSITORY,,\}\/evaluapro-web-docente/);
  assert.match(workflow, /docker push \$\{\{ steps\.meta\.outputs\.api_image \}\}:\$\{\{ steps\.meta\.outputs\.version \}\}/);
  assert.match(workflow, /docker push \$\{\{ steps\.meta\.outputs\.web_image \}\}:\$\{\{ steps\.meta\.outputs\.version \}\}/);
});

test.skip('bootstrap guiado WSL2 genera guia local y permite simulacion de cierre', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-wsl-bootstrap-'));
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
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

test.skip('bootstrap semiautomatico WSL2 ejecuta pasos host y reporta trazabilidad', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-wsl-autobootstrap-'));
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='missing'
$env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL='1'
$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP='1'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP='0'
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

test('bootstrap semiautomatico WSL2 no reinstala distro ya registrada', () => {
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_DISTROS='Ubuntu'
$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP='0'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP='0'
$module = Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}' -PassThru
$global:EvaluaProWslBootstrapLogs = @()
$plan = [pscustomobject]@{
  distro = 'Ubuntu'
  requiresReboot = $true
  steps = @(
    [pscustomobject]@{
      title = 'Instalar distro soportada para WSL2'
      executor = 'host'
      autoRunnable = $true
      command = 'wsl --install -d Ubuntu'
    }
  )
}
$result = & $module {
  param($plan)
  Invoke-DockerRuntimeBootstrapAuto -Plan $plan -OnLog { param($level, $message) $global:EvaluaProWslBootstrapLogs += "$level|$message" } -OnProgress { param($activity, $percent, $status, $meta) }
} $plan
[pscustomobject]@{ result = $result; logs = $global:EvaluaProWslBootstrapLogs } | ConvertTo-Json -Depth 10
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.result.executed.length, 1);
  assert.equal(parsed.result.failed.length, 0);
  assert.match(parsed.logs.join('\n'), /distro WSL ya registrada/i);
});

test('bootstrap WSL2 conserva nombre completo cuando userDistros llega como string', () => {
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
$module = Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}' -PassThru
& $module {
  $status = [pscustomobject]@{
    defaultDistro = 'docker-desktop'
    userDistros = 'Ubuntu'
    wslAvailable = $true
  }
  New-DockerRuntimeWindowsBootstrapPlan -Status $status | ConvertTo-Json -Depth 8
}
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.distro, 'Ubuntu');
  assert.equal(parsed.steps.some((step) => String(step.command || '').includes('wsl -d Ubuntu ')), true);
  assert.equal(parsed.steps.some((step) => String(step.command || '').includes('wsl -d U ')), false);
});

test('bootstrap WSL2 marca fallido un comando host con exit code no cero', () => {
  const mockCommand = process.platform === 'win32' ? 'cmd /c exit 7' : 'sh -c "exit 7"';
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP='0'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP='0'
$module = Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}' -PassThru
$plan = [pscustomobject]@{
  distro = 'Ubuntu'
  requiresReboot = $false
  steps = @(
    [pscustomobject]@{
      title = 'Fallo controlado'
      executor = 'host'
      autoRunnable = $true
      command = '${mockCommand}'
    }
  )
}
& $module {
  param($plan)
  Invoke-DockerRuntimeBootstrapAuto -Plan $plan -OnLog { param($level, $message) } -OnProgress { param($activity, $percent, $status, $meta) }
} $plan | ConvertTo-Json -Depth 10
`.trim();

  const result = runPowerShell(script);
  if (result.skipped) {
    return;
  }

  const parsed = parseJsonOutput(result.stdout);
  assert.equal(parsed.executed.length, 0);
  assert.equal(parsed.failed.length, 1);
  assert.match(String(parsed.failed[0].error || ''), /exit code 7/i);
});

test.skip('helper detect-prereqs propaga requiresRestart/restartReason en remediacion', () => {
  if (process.platform !== 'win32') {
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-helper-restart-'));
  const requestPath = path.join(tempRoot, 'request.json');
  const responsePath = path.join(tempRoot, 'response.json');
  fs.writeFileSync(requestPath, JSON.stringify({
    flavorId: 'saas-completo',
    autoRemediate: true
  }, null, 2), 'utf8');

  const shell = getAvailablePowerShell();
  if (!shell) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return;
  }

  const command = [
    '$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE=\'missing\'',
    '$env:EVALUAPRO_INSTALLER_AUTO_BOOTSTRAP_WSL=\'1\'',
    '$env:EVALUAPRO_INSTALLER_SIMULATE_AUTO_BOOTSTRAP=\'1\'',
    '$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_BOOTSTRAP=\'0\'',
    '$env:EVALUAPRO_INSTALLER_SIMULATE_NODE_MAJOR=\'24\'',
    `& '${burnHelperPath.replace(/'/g, "''")}' -Mode detect-prereqs -RequestPath '${requestPath.replace(/'/g, "''")}' -ResponsePath '${responsePath.replace(/'/g, "''")}'`
  ].join('; ');

  try {
    execFileSync(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000
    });
    const payload = JSON.parse(fs.readFileSync(responsePath, 'utf8').replace(/^\uFEFF/, ''));
    assert.equal(payload.ok, true);
    assert.equal(payload.phase, 'helper_detect');
    assert.equal(typeof payload.data?.remediation, 'object');
    assert.equal(payload.data.remediation.attempted, true);
    assert.equal(payload.data.remediation.requiresRestart, true);
    assert.match(String(payload.data.remediation.restartReason || ''), /reiniciar windows/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test.skip('detector e instalador soportan Node 24 dentro de WSL2 con simulacion contractual', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-wsl-node-bootstrap-'));
  const detectorModulePath = path.join(root, 'scripts', 'installer-burn', 'modules', 'PrereqDetector.psm1');
  const script = `
$env:EVALUAPRO_INSTALLER_SIMULATE_DOCKER_RUNTIME_MODE='wsl2-engine'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_BOOTSTRAP='1'
$env:EVALUAPRO_INSTALLER_SIMULATE_WSL_NODE_MAJOR='0'
Import-Module -Force -WarningAction SilentlyContinue '${detectorModulePath.replace(/'/g, "''")}'
Import-Module -Force -WarningAction SilentlyContinue '${prereqInstallerModulePath.replace(/'/g, "''")}'
$manifest = [pscustomobject]@{
  prerequisites = @(
    [pscustomobject]@{
      name = 'Node.js WSL2'
      version = '24.x'
      downloadUrl = 'https://deb.nodesource.com/setup_24.x'
      sha256 = 'GUIDED_BOOTSTRAP'
      sha256Url = ''
      sha256Pattern = ''
      silentArgs = 'bootstrap-guided'
      detectRule = [pscustomobject]@{ type = 'node_major_wsl'; minMajor = 24 }
    }
  )
}
$before = Test-PrerequisiteStatus -Prerequisite $manifest.prerequisites[0]
$r = Invoke-PrerequisiteInstallationFlow -Manifest $manifest -DownloadRoot '${tempRoot.replace(/'/g, "''")}'
$after = Test-PrerequisiteStatus -Prerequisite $manifest.prerequisites[0]
[pscustomobject]@{
  before = $before
  after = $after
  result = $r
} | ConvertTo-Json -Depth 12
`.trim();

  try {
    const result = runPowerShell(script);
    if (result.skipped) {
      return;
    }
    const parsed = parseJsonOutput(result.stdout);
    assert.equal(parsed.before.installed, false);
    assert.equal(parsed.after.installed, true);
    assert.equal(parsed.after.actualVersion, '24.x');
    assert.equal(parsed.result.ok, true);
    assert.equal(Array.isArray(parsed.result.installed), true);
    assert.equal(parsed.result.installed.length, 1);
    assert.equal(parsed.result.installed[0].mode, 'wsl2-node');
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
  databaseUrl='file:C:/ProgramData/EvaluaPro/data/evaluapro.db'
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
    assert.match(envRaw, /DATABASE_URL=/);
    assert.match(envRaw, /BACKEND_DATABASE_URL=/);
    assert.match(envRaw, /JWT_SECRETO=/);
    assert.match(envRaw, /EVALUAPRO_FLAVOR=docente-local/);
    assert.doesNotMatch(envRaw, /EVALUAPRO_IMAGE_TAG=/);
    assert.match(envRaw, /BACKEND_DATA_DIR_DEV=\.\/apps\/backend\/data\/examenes_dev/);
    assert.match(envRaw, /BACKEND_DATA_DIR_PROD=\.\/apps\/backend\/data\/examenes_prod/);
    assert.match(envRaw, /PORTAL_SYNC_REQUIRED=1/);
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

test('configuracion operativa difiere portal cloud en instalacion minima docente', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-installerhub-minimo-'));
  const installDir = path.join(tempRoot, 'EvaluaPro');
  fs.mkdirSync(path.join(installDir, 'config'), { recursive: true });

  const script = `
Import-Module -Force -WarningAction SilentlyContinue '${operationalConfigModulePath.replace(/'/g, "''")}'
$cfg = @{
  flavorId='docente-local'
  updateChannel='stable'
  updateOwner='Dtcsrni'
  updateRepo='EvaluaPro_Sistema_Universitario'
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

    const envRaw = fs.readFileSync(path.join(installDir, '.env'), 'utf8');
    assert.match(envRaw, /EVALUAPRO_FLAVOR=docente-local/);
    assert.match(envRaw, /PORTAL_SYNC_REQUIRED=0/);
    assert.match(envRaw, /PORTAL_ALUMNO_URL=\r?\n/);
    assert.match(envRaw, /PASSWORD_RESET_ENABLED=0/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('blindaje de licencia exige DPAPI local machine e integridad MAC', () => {
  const securityModule = fs.readFileSync(licenseSecurityModulePath, 'utf8');
  assert.match(securityModule, /System\.Security\.Cryptography\.ProtectedData/);
  assert.match(securityModule, /function Import-DpapiProtectedDataType/);
  assert.match(securityModule, /Add-Type -AssemblyName \$assemblyName/);
  assert.match(securityModule, /DataProtectionScope\]::LocalMachine/);
  assert.match(securityModule, /Get-HmacSha256Hex/);
  assert.match(securityModule, /Envelope de licencia alterado \(MAC invalido\)/);
  assert.match(securityModule, /Baseline alterado \(MAC invalido\)/);
  assert.match(securityModule, /Initialize-EvaluaProAdminStepUp/);
  assert.match(securityModule, /Invoke-EvaluaProStepUp/);
  assert.match(securityModule, /Get-EvaluaProCurrentTotpCode/);
  assert.match(securityModule, /recovery_code/);
});

test('runner E2E tolera estados finales sin propiedad timeout', () => {
  const runner = fs.readFileSync(installerHubE2eDocentePath, 'utf8');

  assert.match(runner, /PSObject\.Properties\.Match\('timeout'\)\.Count -gt 0/);
  assert.match(runner, /stateTimedOut/);
});

test('runner E2E acepta post-install helper JSON como estado estable', () => {
  const runner = fs.readFileSync(installerHubE2eDocentePath, 'utf8');

  assert.match(runner, /function Get-LatestPostInstallHelperState/);
  assert.match(runner, /MinLastWriteTime/);
  assert.match(runner, /LastWriteTime -ge \$MinLastWriteTime/);
  assert.match(runner, /post-install-\*\.response\.json/);
  assert.match(runner, /Post-install helper OK/);
});

test('runner E2E ejecuta broker instalado preservando rutas con espacios', () => {
  const runner = fs.readFileSync(installerHubE2eDocentePath, 'utf8');

  assert.match(runner, /& powershell\.exe @args > \$stdout 2> \$stderr/);
  assert.match(runner, /\$exitCode = \$LASTEXITCODE/);
  assert.match(runner, /Copy-ArtifactIfExists -Path \$stdout/);
  assert.match(runner, /Export-BrokerDiagnostics -Action \$Action -RunId \$RunId/);
  assert.match(runner, /bootstrap-state-\{0\}\.json/);
  assert.doesNotMatch(runner, /Start-Process -FilePath 'powershell\.exe' -ArgumentList \$args/);
});

test('runner E2E falla temprano si memoria o pagefile de VM no alcanzan', () => {
  const runner = fs.readFileSync(installerHubE2eDocentePath, 'utf8');

  assert.match(runner, /function Get-SystemMemorySnapshot/);
  assert.match(runner, /Win32_OperatingSystem/);
  assert.match(runner, /Win32_PageFileUsage/);
  assert.match(runner, /preflight-memory\.json/);
  assert.match(runner, /memory-pagefile/);
  assert.match(runner, /freeVirtualMB -ge 1536/);
});

test('launcher broker arranca dashboard preservando rutas instaladas con espacios', () => {
  const broker = fs.readFileSync(path.join(root, 'scripts', 'launcher-broker.ps1'), 'utf8');

  assert.match(broker, /function ConvertTo-NativeArgumentString/);
  assert.match(broker, /Start-Process -FilePath \$psExe -ArgumentList \(ConvertTo-NativeArgumentString -Arguments \$args\)/);
});

test('dashboard usa runtime nativo en docente-local y conserva Docker solo para flavors que lo requieren', () => {
  const dashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');

  assert.match(dashboard, /function resolveEffectiveDockerRuntime/);
  assert.match(dashboard, /native-node-sqlite/);
  assert.match(dashboard, /function requiresDockerRuntime/);
  assert.match(dashboard, /docente:prod:native/);
  assert.match(dashboard, /not-required/);
  assert.match(dashboard, /function dockerCliArgs/);
  assert.match(dashboard, /function dockerCommandForShell/);
  assert.match(dashboard, /wsl', '-d', 'Ubuntu', '-u', 'root'/);
  assert.match(dashboard, /--no-build', '-d', 'mongo_local', 'api_docente_prod', 'web_docente_prod'/);
  assert.match(dashboard, /desktop-manual/);
  assert.match(dashboard, /desktop-unapproved/);
  assert.match(dashboard, /EVALUAPRO_DOCKER_RUNTIME=desktop/);
  assert.match(dashboard, /runtime: dockerRuntime/);
});

test('baseline docente deriva runtime y evita probes Docker innecesarios', () => {
  const baseline = fs.readFileSync(path.join(root, 'scripts', 'installer-docente-baseline.mjs'), 'utf8');
  assert.match(baseline, /runtimeTarget: requiresDockerRuntime \? 'docker-compatible' : 'native-node-sqlite'/);
  assert.match(baseline, /skippedDockerProbe\('runtime nativo docente-local'\)/);
  assert.match(baseline, /requiredServices: requiresDockerRuntime \? /);
  assert.match(baseline, /requiredImages: requiresDockerRuntime \? /);
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
    if (/The term 'node' is not recognized/i.test(String(result.stderr || ''))) {
      test();
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
  assert.match(script, /\$publishedAssetPath\s*=\s*\$versionedHubName/);
  assert.match(script, /\$publishedAssetShaPath\s*=\s*"\$versionedHubName\.sha256"/);
  assert.match(script, /Join-UrlPath -BaseUrl \$ReleaseBaseUrl -RelativePath \$publishedAssetPath/);
  assert.match(script, /Join-UrlPath -BaseUrl \$ReleaseBaseUrl -RelativePath \$publishedAssetShaPath/);
  assert.match(script, /deployment\s*=\s*\[ordered\]@{/);
  assert.match(script, /target\s*=\s*if \(\$DeploymentTarget\)/);
  assert.match(script, /SignerCertificate/);
  assert.match(script, /NotSigned/);
});
