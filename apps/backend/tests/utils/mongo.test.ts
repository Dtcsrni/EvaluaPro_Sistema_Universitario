/**
 * mongo.test
 *
 * Responsabilidad: Verifica el aislamiento de base SQLite temporal usada por pruebas.
 */
import { describe, expect, it } from 'vitest';
import { resolverNombreDbTest } from './testDbPath';

describe('utils/mongo test database isolation', () => {
  it('usa un nombre distinto para procesos Vitest distintos con el mismo worker id', () => {
    const base = { VITEST_WORKER_ID: '1', VITEST_POOL_ID: '1' };
    const primero = resolverNombreDbTest({ ...base, EVALUAPRO_TEST_PROCESS_ID: '100' });
    const segundo = resolverNombreDbTest({ ...base, EVALUAPRO_TEST_PROCESS_ID: '101' });

    expect(primero).not.toBe(segundo);
    expect(primero).toBe('test_1_1_100.db');
    expect(segundo).toBe('test_1_1_101.db');
  });
});
