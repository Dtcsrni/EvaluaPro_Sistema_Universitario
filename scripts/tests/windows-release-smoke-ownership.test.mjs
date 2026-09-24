import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertBrokerSuccess,
  assertSmokeRuntimeAvailable,
  assertSmokeEnvironmentAvailable,
  cleanupOwnedDashboard,
  createOwnedDashboardIdentity,
  isActiveSmokeEnabled,
  sameProcessIdentity
} from '../testing/windows-release-smoke-ownership.mjs';

const root = path.resolve('C:/qa/evaluapro');
const processInfo = {
  pid: 1250,
  creationDate: '2026-09-24T12:00:00Z',
  commandLine: `${root.replaceAll('/', '\\')}\\runtime\\node\\node.exe ${root.replaceAll('/', '\\')}\\scripts\\launcher-dashboard.mjs --mode prod`
};
const lock = { pid: 1250, port: 4522, mode: 'prod', startedAt: '2026-09-24T12:00:00Z' };
const ports = Array.from({ length: 20 }, (_, index) => 4519 + index);

test('el smoke exige éxito del broker y conserva el diagnóstico de error', () => {
  assert.doesNotThrow(() => assertBrokerSuccess({ status: 0 }, 'verify-installation'));
  assert.throws(
    () => assertBrokerSuccess({ status: 1, stderr: 'falló arranque' }, 'open-dashboard'),
    /open-dashboard devolvió código 1[\s\S]*falló arranque/
  );
});

test('el smoke activo solo se habilita por opt-in explícito del workflow', () => {
  assert.equal(isActiveSmokeEnabled({ EVALUAPRO_RUN_LOCAL_RELEASE_SMOKE: '1' }), true);
  assert.equal(isActiveSmokeEnabled({}), false);
  assert.equal(isActiveSmokeEnabled({ EVALUAPRO_RUN_LOCAL_RELEASE_SMOKE: 'true' }), false);
});

test('el smoke habilitado falla si el runtime Windows o PowerShell no está disponible', () => {
  assert.doesNotThrow(() => assertSmokeRuntimeAvailable({ platform: 'win32', shell: 'powershell.exe' }));
  assert.throws(() => assertSmokeRuntimeAvailable({ platform: 'linux', shell: 'pwsh' }), /requiere Windows/);
  assert.throws(() => assertSmokeRuntimeAvailable({ platform: 'win32', shell: '' }), /PowerShell disponible/);
});

test('el smoke aborta ante puerto activo sin adoptar ni cerrar el servicio', async () => {
  let aliveChecks = 0;
  await assert.rejects(
    assertSmokeEnvironmentAvailable({
      ports: [4519, 4520],
      probePort: async (port) => port === 4520,
      lock: null,
      isProcessAlive: async () => { aliveChecks += 1; return true; }
    }),
    /puertos reservados ocupados \(4520\)/
  );
  assert.equal(aliveChecks, 0);
});

test('el smoke aborta ante PID vivo del lock aunque el puerto no responda', async () => {
  await assert.rejects(
    assertSmokeEnvironmentAvailable({
      ports: [4519],
      probePort: async () => false,
      lock: { pid: 99 },
      isProcessAlive: async (pid) => pid === 99
    }),
    /dashboard preexistente con PID 99/
  );
});

test('la identidad propia exige PID nuevo, puerto reservado y command line del checkout', () => {
  const owner = createOwnedDashboardIdentity({
    lock,
    previousLock: { pid: 77 },
    processInfo,
    ports,
    installRoot: root
  });
  assert.equal(owner.pid, 1250);
  assert.equal(owner.port, 4522);
  assert.equal(sameProcessIdentity(owner, processInfo), true);
  assert.throws(
    () => createOwnedDashboardIdentity({
      lock: { ...lock, pid: 77 },
      previousLock: { pid: 77 },
      processInfo: { ...processInfo, pid: 77 },
      ports,
      installRoot: root
    }),
    /PID nuevo/
  );
  assert.throws(
    () => createOwnedDashboardIdentity({
      lock,
      previousLock: null,
      processInfo: { ...processInfo, commandLine: 'C:\\other\\launcher-dashboard.mjs' },
      ports,
      installRoot: root
    }),
    /no corresponde/
  );
});

test('cleanup cierra solo la identidad registrada; un PID sustituido no se toca', async () => {
  const owner = createOwnedDashboardIdentity({ lock, previousLock: null, processInfo, ports, installRoot: root });
  let shutdownCalls = 0;
  let killCalls = 0;
  await assert.rejects(
    cleanupOwnedDashboard(owner, {
      readProcess: async () => ({ ...processInfo, creationDate: '2026-09-24T12:00:01Z' }),
      readLock: async () => lock,
      requestShutdown: async () => { shutdownCalls += 1; },
      waitForExit: async () => false,
      killExactProcess: async () => { killCalls += 1; }
    }),
    /identidad ya no coincide/
  );
  assert.equal(shutdownCalls, 0);
  assert.equal(killCalls, 0);
});

test('cleanup usa shutdown del PID propio y no fuerza al terminar normalmente', async () => {
  const owner = createOwnedDashboardIdentity({ lock, previousLock: null, processInfo, ports, installRoot: root });
  const calls = [];
  await cleanupOwnedDashboard(owner, {
    readProcess: async () => processInfo,
    readLock: async () => lock,
    requestShutdown: async (port) => calls.push(['shutdown', port]),
    waitForExit: async (candidate) => candidate.pid === owner.pid,
    killExactProcess: async (pid) => calls.push(['kill', pid])
  });
  assert.deepEqual(calls, [['shutdown', owner.port]]);
});

test('cleanup no manda shutdown si el lock cambió de PID o puerto', async () => {
  const owner = createOwnedDashboardIdentity({ lock, previousLock: null, processInfo, ports, installRoot: root });
  let shutdownCalls = 0;
  let killCalls = 0;
  await assert.rejects(
    cleanupOwnedDashboard(owner, {
      readProcess: async () => processInfo,
      readLock: async () => ({ ...lock, port: 4523 }),
      requestShutdown: async () => { shutdownCalls += 1; },
      waitForExit: async () => false,
      killExactProcess: async () => { killCalls += 1; }
    }),
    /lock ya no pertenece/
  );
  assert.equal(shutdownCalls, 0);
  assert.equal(killCalls, 0);
});

test('cleanup deja intacto el servicio cuando el PID registrado ya terminó', async () => {
  const owner = createOwnedDashboardIdentity({ lock, previousLock: null, processInfo, ports, installRoot: root });
  let shutdownCalls = 0;
  let killCalls = 0;
  const result = await cleanupOwnedDashboard(owner, {
    readProcess: async () => ({}),
    readLock: async () => lock,
    requestShutdown: async () => { shutdownCalls += 1; },
    waitForExit: async () => true,
    killExactProcess: async () => { killCalls += 1; }
  });
  assert.equal(result, 'already-exited');
  assert.equal(shutdownCalls, 0);
  assert.equal(killCalls, 0);
});

test('cleanup solo fuerza terminación después de revalidar exactamente el PID propio', async () => {
  const owner = createOwnedDashboardIdentity({ lock, previousLock: null, processInfo, ports, installRoot: root });
  let readCount = 0;
  let waitCount = 0;
  const calls = [];
  await assert.rejects(
    cleanupOwnedDashboard(owner, {
      readProcess: async () => { readCount += 1; return processInfo; },
      readLock: async () => lock,
      requestShutdown: async () => {},
      waitForExit: async () => { waitCount += 1; return waitCount === 2; },
      killExactProcess: async (pid) => calls.push(pid)
    }),
    /requirió terminación forzada/
  );
  assert.equal(readCount, 2);
  assert.deepEqual(calls, [owner.pid]);
});

test('el workflow de release habilita explícitamente el smoke que en modo local requiere opt-in', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/release-beta.yml'), 'utf8');
  const activeSmoke = workflow.match(/-\s+name:\s+Etapa\s+windows-release-smoke\s+Installer\s+Hub[\s\S]*?(?=\n\s+-\s+name:|$)/)?.[0] || '';
  assert.match(activeSmoke, /EVALUAPRO_RUN_LOCAL_RELEASE_SMOKE:\s*'1'/);
  assert.match(activeSmoke, /node --test scripts\/tests\/windows-release-smoke\.test\.mjs/);
});
