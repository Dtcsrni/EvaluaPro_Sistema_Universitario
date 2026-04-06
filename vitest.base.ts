/**
 * vitest.base
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Opciones Vitest compartidas por las apps.
export const baseVitestConfig = {
  clearMocks: true,
  restoreMocks: true,
  mockReset: true,
  testTimeout: 20000,
  hookTimeout: 20000,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'json-summary'],
    all: true,
    exclude: ['**/dist/**', '**/node_modules/**', '**/tests/**', '**/*.d.ts']
  }
};
