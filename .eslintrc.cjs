// Configuracion ESLint base compartida.
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  env: {
    browser: true,
    es2021: true,
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    complexity: ['error', 18],
    'max-depth': ['error', 5],
    'max-params': ['error', 5]
  },
  overrides: [
    {
      // TODO(2026-03-31): retirar estas excepciones cuando termine la fase de refactor legacy.
      files: [
        'apps/backend/scripts/*.ts',
        'apps/backend/src/modulos/**/*.ts',
        'apps/backend/tests/**/*.ts',
        'tests/**/*.ts',
        'apps/frontend/src/apps/**/*.tsx',
        'apps/frontend/src/apps/app_docente/mensajeInline.ts',
        'apps/frontend/src/servicios_api/clienteComun.ts',
        'apps/frontend/src/ui/iconos.tsx',
        'apps/frontend/src/ui/ux/tooltip/TooltipLayer.tsx',
        'apps/portal_alumno_cloud/src/rutas.ts',
        'scripts/*.ts',
        'src/modulos/**/*.ts',
        'src/apps/**/*.tsx',
        'src/apps/app_docente/mensajeInline.ts',
        'src/servicios_api/clienteComun.ts',
        'src/ui/iconos.tsx',
        'src/ui/ux/tooltip/TooltipLayer.tsx',
        'src/rutas.ts'
      ],
      rules: {
        complexity: 'off',
        'max-depth': 'off',
        'max-params': 'off',
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ],
  ignorePatterns: ['dist', 'node_modules']
};
