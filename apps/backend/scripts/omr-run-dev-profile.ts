/**
 * omr-run-dev-profile
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { spawn } from 'node:child_process';

type Perfil = 'actual' | 'geo_tight_search';

const PROFILE_OVERRIDES: Record<Perfil, Record<string, string>> = {
  actual: {
    OMR_GEOMETRY_PROFILE: 'actual'
  },
  geo_tight_search: {
    OMR_GEOMETRY_PROFILE: 'geo_tight_search',
    OMR_ALIGN_RANGE: '16',
    OMR_VERT_RANGE: '8',
    OMR_LOCAL_SEARCH_RATIO: '0.30',
    OMR_OFFSET_X: '0',
    OMR_OFFSET_Y: '0'
  }
};

function parseProfile(argv: string[]): Perfil {
  const value = String(argv[2] || 'geo_tight_search').trim().toLowerCase();
  return value === 'actual' ? 'actual' : 'geo_tight_search';
}

function main() {
  const profile = parseProfile(process.argv);
  const env = {
    ...process.env,
    ...PROFILE_OVERRIDES[profile]
  };

  process.stdout.write(`Iniciando backend con perfil OMR: ${profile}\n`);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(`${npmCmd} run dev`, {
    stdio: 'inherit',
    env,
    shell: true
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    process.stderr.write(`No se pudo iniciar npm run dev: ${error.message}\n`);
    process.exit(1);
  });
}

main();
