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
    'react/react-in-jsx-scope': 'off',
    // React Compiler rules landed in eslint-plugin-react-hooks v7 recommended.
    // Keep the classic hooks contract active until the frontend is migrated deliberately.
    'react-hooks/config': 'off',
    'react-hooks/error-boundaries': 'off',
    'react-hooks/gating': 'off',
    'react-hooks/globals': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/incompatible-library': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/set-state-in-render': 'off',
    'react-hooks/static-components': 'off',
    'react-hooks/unsupported-syntax': 'off',
    'react-hooks/use-memo': 'off'
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
