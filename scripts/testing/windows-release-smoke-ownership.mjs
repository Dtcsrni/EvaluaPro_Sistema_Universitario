import path from 'node:path';

function normalizeText(value) {
  return String(value ?? '').trim().replaceAll('/', '\\').toLowerCase();
}

export function assertBrokerSuccess(result, action) {
  if (Number(result?.status) !== 0) {
    const detail = [result?.stdout, result?.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${action} devolvió código ${result?.status ?? 'desconocido'}${detail ? `:\n${detail}` : ''}`);
  }
}

export function isActiveSmokeEnabled(environment) {
  return environment?.EVALUAPRO_RUN_LOCAL_RELEASE_SMOKE === '1';
}

export function assertSmokeRuntimeAvailable({ platform, shell }) {
  if (platform !== 'win32' || !shell) {
    throw new Error('El smoke activo requiere Windows y PowerShell disponible; no se omitirá en un workflow habilitado.');
  }
}

export async function assertSmokeEnvironmentAvailable({ ports, probePort, lock, isProcessAlive }) {
  const occupied = [];
  for (const port of ports) {
    if (await probePort(port)) occupied.push(port);
  }

  if (occupied.length > 0) {
    throw new Error(`Smoke abortado: puertos reservados ocupados (${occupied.join(', ')}); no se tocarán servicios existentes.`);
  }

  const lockPid = Number(lock?.pid || 0);
  if (lockPid > 0 && await isProcessAlive(lockPid)) {
    throw new Error(`Smoke abortado: dashboard preexistente con PID ${lockPid}; no se adoptará ni terminará.`);
  }
}

function validateNewPid(pid, previousPid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === previousPid) {
    throw new Error('El smoke no pudo demostrar un PID nuevo para el dashboard que inició.');
  }
}

function validateReservedPort(port, ports, reportedPort) {
  if (!Number.isInteger(port) || !ports.includes(port)) {
    throw new Error(`El lock del smoke reportó un puerto no reservado: ${reportedPort ?? 'desconocido'}.`);
  }
}

function validateLock(lock, startedAt) {
  if (lock?.mode !== 'prod' || !startedAt) {
    throw new Error('El lock no acredita modo prod ni hora de arranque para la instancia del smoke.');
  }
}

function validateProcess(pid, processInfo, createdAt) {
  if (Number(processInfo?.pid) !== pid || !createdAt) {
    throw new Error(`No se pudo confirmar la identidad temporal del PID ${pid}.`);
  }
}

function validateCommandLine(pid, normalizedCommand, normalizedRoot) {
  if (!normalizedCommand.includes('launcher-dashboard.mjs') || !normalizedCommand.includes(normalizedRoot)) {
    throw new Error(`El PID ${pid} no corresponde al launcher-dashboard de esta instalación.`);
  }
}

export function createOwnedDashboardIdentity({ lock, previousLock, processInfo, ports, installRoot }) {
  const pid = Number(lock?.pid || 0);
  const port = Number(lock?.port || 0);
  const previousPid = Number(previousLock?.pid || 0);
  const commandLine = String(processInfo?.commandLine || '');
  const normalizedCommand = normalizeText(commandLine);
  const normalizedRoot = normalizeText(path.resolve(installRoot));
  const createdAt = String(processInfo?.creationDate || '');
  const startedAt = String(lock?.startedAt || '');

  validateNewPid(pid, previousPid);
  validateReservedPort(port, ports, lock?.port);
  validateLock(lock, startedAt);
  validateProcess(pid, processInfo, createdAt);
  validateCommandLine(pid, normalizedCommand, normalizedRoot);

  return Object.freeze({
    pid,
    port,
    startedAt,
    process: Object.freeze({ pid, creationDate: createdAt, commandLine })
  });
}

export function sameProcessIdentity(expected, actual) {
  return Number(actual?.pid) === expected?.pid
    && String(actual?.creationDate || '') === expected?.process?.creationDate
    && normalizeText(actual?.commandLine) === normalizeText(expected?.process?.commandLine);
}

export async function cleanupOwnedDashboard(owner, dependencies) {
  const current = await dependencies.readProcess(owner.pid);
  if (Number(current?.pid) !== owner.pid) return 'already-exited';
  if (!sameProcessIdentity(owner, current)) {
    throw new Error(`No se cerrará PID ${owner.pid}: su identidad ya no coincide con la registrada por el smoke.`);
  }
  const currentLock = await dependencies.readLock();
  if (Number(currentLock?.pid) !== owner.pid || Number(currentLock?.port) !== owner.port || currentLock?.startedAt !== owner.startedAt) {
    throw new Error(`No se solicitará cierre en el puerto ${owner.port}: el lock ya no pertenece al PID del smoke.`);
  }

  let gracefulError = null;
  try {
    await dependencies.requestShutdown(owner.port);
  } catch (error) {
    gracefulError = error;
  }

  if (await dependencies.waitForExit(owner, 15_000)) return 'graceful-shutdown';

  const beforeForce = await dependencies.readProcess(owner.pid);
  if (!sameProcessIdentity(owner, beforeForce)) {
    throw new Error(`El proceso del smoke cambió de identidad; no se forzará el cierre del PID ${owner.pid}.`);
  }

  await dependencies.killExactProcess(owner.pid);
  if (!(await dependencies.waitForExit(owner, 5_000))) {
    throw new Error(`El PID propio ${owner.pid} no terminó tras solicitar cierre y cleanup forzado.`);
  }

  const cause = gracefulError ? `: ${String(gracefulError.message || gracefulError)}` : '';
  throw new Error(`El dashboard del smoke requirió terminación forzada aunque su identidad fue verificada${cause}.`);
}
