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
    coverage: {
      ...baseVitestConfig.coverage,
      // TODO(2026-03-31): Retirar estas exclusiones temporales de cobertura
      // cuando se completen pruebas de regresion por modulos legacy del backend.
      exclude: [
        ...(baseVitestConfig.coverage?.exclude ?? []),
        'src/modulos/modulo_banco_preguntas/**',
        'src/modulos/modulo_generacion_pdf/**',
        'src/modulos/modulo_sincronizacion_nube/**',
        'src/modulos/modulo_papelera/**',
        'src/modulos/modulo_vinculacion_entrega/**',
        'src/compartido/salud/rutasSalud.ts'
      ],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 55,
        statements: 55
      }
    }
  }
});
