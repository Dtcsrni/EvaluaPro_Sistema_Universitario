/**
 * app-host-shutdown.contract.test
 *
 * Responsabilidad: proteger el contrato de cierre coordinado de la app nativa.
 * Limites: valida la integración estática entre el host WPF y el dashboard local.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dashboardSource = fs.readFileSync(
  path.join(root, 'scripts', 'launcher-dashboard.mjs'),
  'utf8'
);
const hostSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'MainWindow.xaml.cs'),
  'utf8'
);
const appSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'App.xaml.cs'),
  'utf8'
);
const windowSource = fs.readFileSync(
  path.join(root, 'packaging', 'app-host', 'MainWindow.xaml'),
  'utf8'
);
const installerE2ESource = fs.readFileSync(
  path.join(root, 'scripts', 'tests', 'installer-hub-e2e-docente.ps1'),
  'utf8'
);

test('el cierre nativo detiene el árbol completo del dashboard', () => {
  assert.match(dashboardSource, /pathName === '\/api\/shutdown'/);
  assert.match(dashboardSource, /stopAllManagedTasks\(\)/);
  assert.match(dashboardSource, /taskkill', \['\/T', '\/F', '\/PID'/);
  assert.match(hostSource, /PostAsync\(/);
  assert.match(hostSource, /\/api\/shutdown/);
  assert.match(hostSource, /e\.Cancel = true/);
  assert.match(hostSource, /process\.Kill\(entireProcessTree: true\)/);
  assert.match(hostSource, /if \(dashboardProcess == null\) return true;/);
});

test('el cierre asíncrono evita reentrada y cierra después de limpiar servicios', () => {
  const closingHandler = hostSource.match(/private async void MainWindow_Closing[\s\S]*?\n    }/)?.[0];
  assert.ok(closingHandler, 'debe existir el manejador de cierre del App Host');
  assert.match(hostSource, /private bool closeAuthorized;/);

  const shutdownReentryCheck = closingHandler.indexOf('if (shutdownCompleted) return;');
  const hubCloseCheck = closingHandler.indexOf('if (App.IsInstallerHubInvocation) return;');
  const authorizeCheck = closingHandler.indexOf('if (closeAuthorized) return;');
  const cancelRequest = closingHandler.indexOf('e.Cancel = true;');
  const duplicateRequestCheck = closingHandler.indexOf('if (isStopping) return;');
  const confirm = closingHandler.indexOf('var choice = WpfMessageBox.Show(');
  const cancelChoice = closingHandler.indexOf('if (choice == MessageBoxResult.Cancel) return;');
  const noChoice = closingHandler.indexOf('if (choice == MessageBoxResult.No)');
  const cleanup = closingHandler.indexOf('stopped = await ShutdownServicesAsync();');
  const cleanupFailure = closingHandler.indexOf('if (!stopped)');
  const finalClose = closingHandler.indexOf('Dispatcher.BeginInvoke(new Action(Close))');

  assert.ok(shutdownReentryCheck >= 0 && shutdownReentryCheck < hubCloseCheck && hubCloseCheck < authorizeCheck,
    'el cierre repetido y el modo Hub oculto deben terminar sin abrir la confirmación docente');
  assert.ok(authorizeCheck >= 0 && authorizeCheck < cancelRequest,
    'el cierre final autorizado debe pasar sin cancelarse');
  assert.ok(cancelRequest >= 0 && cancelRequest < duplicateRequestCheck,
    'cada solicitud concurrente debe cancelarse antes de omitir el trabajo duplicado');
  assert.ok(duplicateRequestCheck < confirm && confirm < cancelChoice && cancelChoice < noChoice && noChoice < cleanup,
    'la ventana debe ofrecer cancelar, cerrar sin detener servicios o solicitar la detención');
  assert.ok(cleanup < cleanupFailure && cleanupFailure < finalClose,
    'el cierre final se difiere al Dispatcher después de limpiar servicios');
  assert.match(closingHandler, /if \(!stopped\)[\s\S]*?return;/,
    'si la identidad de los servicios no puede verificarse, la ventana debe permanecer abierta');
  assert.doesNotMatch(closingHandler, /await ShutdownServicesAsync\(\);\s*Close\(\);/);
});

test('el E2E detecta y confirma el diálogo de cierre del App Host', () => {
  assert.match(installerE2ESource, /function Get-AppHostTopLevelWindows/);
  assert.match(installerE2ESource, /function Wait-AppHostCloseConfirmation/);
  assert.match(installerE2ESource, /function Invoke-AppHostCloseConfirmationYes/);
  assert.match(installerE2ESource, /Wait-AppHostCloseConfirmation -ProcessId/);
  assert.match(installerE2ESource, /close-confirmation-yes/);
  assert.match(installerE2ESource, /no terminó ni mostró la confirmación de cierre/);
});

test('el host adopta servicios sanos antes del retorno temprano y solo si coinciden con la instalación', () => {
  assert.match(hostSource, /await TryAdoptDashboardAsync\(dashboardPort\);[\s\S]*?var webResponds = await ProbePortAsync\(webHealthUrl\);[\s\S]*?var apiResponds = await ProbePortAsync\(apiHealthUrl\);[\s\S]*?if \(webResponds && apiResponds\)/);
  assert.match(hostSource, /lockRoot\.TryGetProperty\("pid"/);
  assert.match(hostSource, /lockPort != dashboardPort/);
  assert.match(hostSource, /PathsEqual\(statusRoot, appRoot\)/);
  assert.match(hostSource, /statusPort != dashboardPort/);
  assert.match(hostSource, /dashboardProcess = process/);
  assert.match(hostSource, /dashboardProcess = Process\.Start\(psi\)/);
  assert.match(hostSource, /dashboardProcess != null && await VerifyDashboardIdentityAsync\(dashboardProcess, dashboardPort\)\) return true/);
  assert.match(hostSource, /sin identidad de dashboard verificada; no se adoptan ni se inicia sobre esos puertos/);
});

test('el host nativo mantiene una sola ventana EvaluaPro y enfoca la existente', () => {
  assert.match(appSource, /EvaluaProDesktopSingleton/);
  assert.match(appSource, /new Mutex\(/);
  assert.match(appSource, /WaitOne\(0\)/);
  assert.match(appSource, /FocusExistingWindow\(\)/);
  assert.match(appSource, /Shutdown\(\)/);
  assert.match(appSource, /Process\.GetProcessesByName\("EvaluaPro"\)/);
  assert.match(appSource, /ShowWindow\(handle, SwRestore\)/);
  assert.match(appSource, /SetForegroundWindow\(handle\)/);
  assert.match(appSource, /ReleaseDesktopSingleton\(\)/);
});

test('el singleton recupera únicamente un App Host huérfano y reintenta la adquisición', () => {
  assert.match(appSource, /OrphanedInstanceMinimumAge = TimeSpan\.FromSeconds\(30\)/);
  assert.match(appSource, /if \(attempt == 0 && TryRecoverOrphanedInstance\(\)\)[\s\S]*?continue;/);
  assert.match(appSource, /existingProcess\.SessionId != currentProcess\.SessionId/);
  assert.match(appSource, /PathsEqual\(TryGetExecutablePath\(existingProcess\), currentPath\)/);
  assert.match(appSource, /existingProcess\.MainWindowHandle != IntPtr\.Zero/);
  assert.match(appSource, /age < OrphanedInstanceMinimumAge/);
  assert.match(appSource, /existingProcess\.Kill\(entireProcessTree: true\)/);
  assert.match(appSource, /existingProcess\.WaitForExit\(3_000\)/);
  assert.match(appSource, /LogDiagnostic\("DesktopSingleton",/);
});

test('la ventana nativa inicia grande, centrada y redimensionable para cubrir el acceso completo', () => {
  assert.match(windowSource, /WindowState="Normal"/);
  assert.match(windowSource, /ResizeMode="CanResize"/);
  assert.match(windowSource, /x:Name="MaximizeBtn"[\s\S]*Content="🗖"/);
  assert.match(hostSource, /SystemParameters\.WorkArea/);
  assert.match(hostSource, /0\.90/);
  assert.match(hostSource, /0\.92/);
  assert.match(hostSource, /1040/);
  assert.match(windowSource, /WindowStyle="SingleBorderWindow"/);
});
