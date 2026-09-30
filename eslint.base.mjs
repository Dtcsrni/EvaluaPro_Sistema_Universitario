// Configuracion ESLint base compartida como objeto ESM.
export default {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  env: { browser: true, es2021: true },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    complexity: ['error', 18],
    'max-depth': ['error', 5],
    'max-params': ['error', 5]
  },
  overrides: [
    {
      files: [
        'apps/backend/scripts/*.ts', 'apps/backend/src/modulos/**/*.ts', 'apps/backend/tests/**/*.ts',
        'tests/**/*.ts', 'apps/frontend/src/apps/**/*.tsx', 'apps/frontend/src/apps/app_docente/mensajeInline.ts',
        'apps/frontend/src/servicios_api/clienteComun.ts', 'apps/frontend/src/ui/iconos.tsx',
        'apps/frontend/src/ui/ux/tooltip/TooltipLayer.tsx', 'apps/portal_alumno_cloud/src/rutas.ts',
        'scripts/*.ts', 'src/modulos/**/*.ts', 'src/apps/**/*.tsx', 'src/apps/app_docente/mensajeInline.ts',
        'src/servicios_api/clienteComun.ts', 'src/ui/iconos.tsx', 'src/ui/ux/tooltip/TooltipLayer.tsx', 'src/rutas.ts'
      ],
      rules: { complexity: 'off', 'max-depth': 'off', 'max-params': 'off', '@typescript-eslint/no-explicit-any': 'off' }
    }
  ],
  ignorePatterns: ['dist', 'node_modules']
};
