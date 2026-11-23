import path from 'node:path';
import { createHash } from 'node:crypto';

export const PUERTOS_RUNTIME = Object.freeze({
  prod: Object.freeze({ api: 4000, web: 4173, dashboard: 4519 }),
  dev: Object.freeze({ api: 4001, web: 4174, dashboard: 4520 }),
  test: Object.freeze({ api: 4100, web: 4175, dashboard: 4521 })
});

export function resolverPerfilRuntime(env = process.env) {
  if (String(env.EVALUAPRO_E2E_BUILD || '') === '1') return 'test';
  const modo = String(env.EVALUAPRO_MODE || '').trim().toLowerCase();
  if (modo === 'dev' || modo === 'test') return modo;
  return 'prod';
}

export function obtenerConfiguracionRuntime(perfil, root, programData = process.env.ProgramData || 'C:\\ProgramData') {
  const puertos = PUERTOS_RUNTIME[perfil];
  if (!puertos) throw new Error(`Perfil EvaluaPro desconocido: ${perfil}`);
  const databasePath = perfil === 'prod'
    ? path.join(programData, 'EvaluaPro', 'data', 'evaluapro.db')
    : perfil === 'dev'
      ? path.join(root, 'data-dev', 'evaluapro.db')
      : path.join(root, 'test-results', 'docente-cycle', 'evaluapro.db');
  return Object.freeze({
    perfil,
    modo: perfil === 'prod' ? 'prod' : perfil === 'dev' ? 'dev' : 'test',
    nodeEnv: perfil === 'prod' ? 'production' : 'development',
    flavor: perfil === 'prod' ? 'docente-local' : `docente-local-${perfil}`,
    puertos,
    databasePath,
    databaseUrl: `file:${databasePath.replace(/\\/g, '/')}`,
    databaseIdentity: createHash('sha256').update(`${perfil}\nfile:${databasePath.replace(/\\/g, '/')}`).digest('hex').slice(0, 16)
  });
}
