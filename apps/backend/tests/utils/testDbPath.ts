/**
 * testDbPath
 *
 * Responsabilidad: Resolver nombres de SQLite temporales aislados por proceso de prueba.
 */
export function segmentoSeguroDbTest(valor: unknown, fallback: string) {
  const normalizado = String(valor || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalizado || fallback;
}

export function resolverNombreDbTest(env: NodeJS.ProcessEnv = process.env) {
  const workerId = segmentoSeguroDbTest(env.VITEST_WORKER_ID, '1');
  const poolId = segmentoSeguroDbTest(env.VITEST_POOL_ID || env.VITEST_POOL_WORKER_ID, 'pool');
  const processId = segmentoSeguroDbTest(env.EVALUAPRO_TEST_PROCESS_ID || process.pid, String(process.pid));
  return `test_${workerId}_${poolId}_${processId}.db`;
}
