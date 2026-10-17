import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function ejecutarProcesoPdfLimitado(ejecutable: string, args: string[], timeoutMs: number) {
  return execFileAsync(ejecutable, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    timeout: Math.max(1, timeoutMs),
    killSignal: 'SIGTERM'
  });
}
