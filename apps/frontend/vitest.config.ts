// Configuracion Vitest del frontend React.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { baseVitestConfig } from '../../vitest.base';

export default defineConfig({
  plugins: [react()],
  test: {
    ...baseVitestConfig,
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts']
  }
});
