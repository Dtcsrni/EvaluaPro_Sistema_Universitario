// Configuracion Vitest del frontend React.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { baseVitestConfig } from '../../vitest.base';

export default defineConfig({
  plugins: [react()],
  test: {
    ...baseVitestConfig,
    environment: 'jsdom',
    // En Windows, forks puede ser inestable en algunos entornos/CI.
    // Se mantiene forzable via CLI: `vitest run --pool=forks`.
    pool: process.platform === 'win32' ? 'threads' : 'forks',
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts']
  }
});
