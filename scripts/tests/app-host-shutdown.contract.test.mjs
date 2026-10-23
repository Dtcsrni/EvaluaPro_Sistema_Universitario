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

test('el cierre nativo detiene el árbol completo del dashboard', () => {
  assert.match(dashboardSource, /pathName === '\/api\/shutdown'/);
  assert.match(dashboardSource, /stopAllManagedTasks\(\)/);
  assert.match(dashboardSource, /taskkill', \['\/T', '\/F', '\/PID'/);
  assert.match(hostSource, /PostAsync\(/);
  assert.match(hostSource, /\/api\/shutdown/);
  assert.match(hostSource, /e\.Cancel = true/);
  assert.match(hostSource, /process\.Kill\(entireProcessTree: true\)/);
  assert.match(hostSource, /private async Task<bool> EnsureDashboardProcessForShutdownAsync\(\)/);
  assert.match(hostSource, /await TryAdoptDashboardAsync\(dashboardPort\)/);
  assert.match(hostSource, /if \(webResponds \|\| apiResponds\)[\s\S]*?return false;/);
  assert.match(hostSource, /if \(!await ShutdownServicesAsync\(\)\)[\s\S]*?isStopping = false;[\s\S]*?La ventana permanece abierta/);
  assert.match(hostSource, /WpfMessageBox\.Show\([\s\S]*?MessageBoxButton\.YesNoCancel/);
  assert.match(hostSource, /Sí: detener API e interfaz y cerrar/);
  assert.match(hostSource, /No: dejar los servicios activos en segundo plano y cerrar solo la ventana/);
  assert.match(hostSource, /if \(choice == MessageBoxResult\.Cancel\) return;/);
  assert.match(hostSource, /if \(choice == MessageBoxResult\.No\)[\s\S]*?closeAuthorized = true;[\s\S]*?Close\(\);[\s\S]*?return;/);
  assert.match(hostSource, /isStopping = true;[\s\S]*?if \(!await ShutdownServicesAsync\(\)\)[\s\S]*?closeAuthorized = true;[\s\S]*?Close\(\);/);
});

test('el cierre asíncrono cancela solicitudes concurrentes y autoriza una sola transición final', () => {
  const closingHandler = hostSource.match(/private async void MainWindow_Closing[\s\S]*?\n    }/)?.[0];
  assert.ok(closingHandler, 'debe existir el manejador de cierre del App Host');
  assert.match(hostSource, /private bool closeAuthorized;/);

  const authorizeCheck = closingHandler.indexOf('if (closeAuthorized) return;');
  const cancelRequest = closingHandler.indexOf('e.Cancel = true;');
  const duplicateRequestCheck = closingHandler.indexOf('if (isStopping) return;');
  const cleanup = closingHandler.indexOf('await ShutdownServicesAsync()');
  const authorizeFinalClose = closingHandler.lastIndexOf('closeAuthorized = true;');
  const finalClose = closingHandler.lastIndexOf('Close();');

  assert.ok(authorizeCheck >= 0 && authorizeCheck < cancelRequest,
    'el único cierre final autorizado debe pasar sin cancelarse');
  assert.ok(cancelRequest >= 0 && cancelRequest < duplicateRequestCheck,
    'cada solicitud concurrente debe cancelarse antes de omitir el trabajo duplicado');
  assert.ok(duplicateRequestCheck < cleanup && cleanup < authorizeFinalClose && authorizeFinalClose < finalClose,
    'el cierre final debe autorizarse después de completar la limpieza, sin reentrar durante la espera');
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
