/**
 * vitest.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Configuracion Vitest del portal alumno.
import { defineConfig } from 'vitest/config';
import { baseVitestConfig } from '../../vitest.base';

export default defineConfig({
  test: {
    ...baseVitestConfig,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      ...baseVitestConfig.coverage,
      exclude: [
        ...(baseVitestConfig.coverage.exclude || []),
        '**/generado/**'
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    }
  }
});
