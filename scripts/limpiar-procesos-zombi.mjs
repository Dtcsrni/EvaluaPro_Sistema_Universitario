/**
 * limpiar-procesos-zombi.mjs
 *
 * Utilidad de higiene de procesos para desarrollo y testing en EvaluaPro.
 * Identifica y termina procesos colgados o duplicados en puertos de desarrollo.
 */
import { execSync } from 'child_process';
import os from 'os';

const PUERTOS_DESARROLLO = [4000, 5173, 8080];
const esWindows = os.platform() === 'win32';

console.log('[limpiar-zombi] Iniciando escaneo de procesos colgados/zombi...');

let liberados = 0;

for (const puerto of PUERTOS_DESARROLLO) {
  try {
    if (esWindows) {
      const output = execSync(`netstat -ano | findstr :${puerto}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lineas = output.trim().split('\n');
      const pids = new Set();

      for (const linea of lineas) {
        const partes = linea.trim().split(/\s+/);
        const estado = partes[3];
        const pid = partes[partes.length - 1];
        if (estado === 'LISTENING' && pid && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }

      for (const pid of pids) {
        try {
          console.log(`[limpiar-zombi] Terminando proceso huérfano PID ${pid} en puerto ${puerto}...`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          liberados++;
        } catch {
          // Ya no existe o permisos restringidos
        }
      }
    } else {
      try {
        const pid = execSync(`lsof -ti :${puerto}`, { encoding: 'utf8' }).trim();
        if (pid) {
          console.log(`[limpiar-zombi] Terminando proceso PID ${pid} en puerto ${puerto}...`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          liberados++;
        }
      } catch {
        // Puerto libre
      }
    }
  } catch {
    // Puerto libre
  }
}

console.log(`[limpiar-zombi] Finalizado. Procesos terminados: ${liberados}. Puertos de desarrollo verificados.`);
