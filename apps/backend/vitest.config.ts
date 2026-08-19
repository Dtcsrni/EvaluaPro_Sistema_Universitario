/**
 * vitest.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Configuracion Vitest del backend.
import { defineConfig } from 'vitest/config';
import { baseVitestConfig } from '../../vitest.base';

export default defineConfig({
  test: {
    ...baseVitestConfig,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    forks: {
      execArgv: ['--max-old-space-size=2048']
    },
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      ...baseVitestConfig.coverage,
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 54,
        statements: 55
      }
    }
  }
});
