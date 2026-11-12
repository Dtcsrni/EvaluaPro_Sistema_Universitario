import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'credential-manager.ps1');

function ejecutarPowerShell(operation, target, payload = {}) {
  if (process.platform !== 'win32') throw new Error('La reutilización persistente de credenciales API requiere Windows Credential Manager.');
  return new Promise((resolve, reject) => {
    const powershell = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe';
    const child = spawn(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-Operation', operation, '-Target', target
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let stdout = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('Windows Credential Manager excedió el tiempo de espera.'));
    }, 10_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 8192 && !settled) {
        settled = true;
        clearTimeout(timeout);
        child.kill();
        reject(new Error('Credential Manager returned an oversized response.'));
      }
    });
    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('No se pudo iniciar Windows Credential Manager.'));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error('Windows Credential Manager rechazó la operación.'));
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error('Respuesta inválida de Windows Credential Manager.'));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export class WindowsCredentialStore {
  constructor(baseUrl) {
    const hostKey = createHash('sha256').update(String(baseUrl)).digest('hex').slice(0, 32);
    this.target = `EvaluaPro/Api/${hostKey}`;
  }

  async get() {
    const result = await ejecutarPowerShell('read', this.target);
    if (typeof result?.value !== 'string' || !result.value) return null;
    try {
      const value = JSON.parse(result.value);
      if (typeof value.refreshToken !== 'string' || !value.refreshToken.startsWith('epr_') || typeof value.credencialId !== 'string') return null;
      return value;
    } catch {
      return null;
    }
  }

  async set(value) {
    if (!value || typeof value.refreshToken !== 'string' || !value.refreshToken.startsWith('epr_') || typeof value.credencialId !== 'string') {
      throw new TypeError('La credencial de sesión API tiene un formato inválido.');
    }
    await ejecutarPowerShell('write', this.target, { value: JSON.stringify(value) });
  }

  async delete() {
    await ejecutarPowerShell('delete', this.target);
  }
}

export function crearCredentialStoreFake(seed = null) {
  let value = seed;
  return {
    async get() { return value; },
    async set(next) { value = next; },
    async delete() { value = null; }
  };
}
