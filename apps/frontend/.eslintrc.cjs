// Configuracion ESLint para el frontend (React + TypeScript).
module.exports = {
  extends: [
    '../../.eslintrc.cjs',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended'
  ],
  env: {
    browser: true,
    es2021: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  plugins: ['react', 'jsx-a11y'],
  rules: {
    'react/react-in-jsx-scope': 'off'
  },
  overrides: [
    {
      files: ['src/apps/app_docente/**/*.tsx'],
      rules: {
        'max-lines': ['error', { max: 1600, skipBlankLines: true, skipComments: true }]
      }
    },
    {
      files: ['src/apps/app_docente/AppDocente.tsx'],
      rules: {
        // Excepcion temporal para archivo legacy en proceso de particion.
        'max-lines': ['error', { max: 8000, skipBlankLines: true, skipComments: true }]
      }
    }
  ]
};
