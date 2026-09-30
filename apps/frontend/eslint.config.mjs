/**
 * eslint.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import baseConfig from '../../eslint.base.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [...compat.config({
  ...baseConfig,
  extends: [...baseConfig.extends, 'plugin:react/recommended', 'plugin:react-hooks/recommended', 'plugin:jsx-a11y/recommended'],
  plugins: [...baseConfig.plugins, 'react', 'jsx-a11y'],
  rules: {
    ...baseConfig.rules,
    'react/react-in-jsx-scope': 'off',
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
  settings: { react: { version: 'detect' } },
  overrides: [
    ...baseConfig.overrides,
    { files: ['src/apps/app_docente/**/*.tsx'], rules: { 'max-lines': ['error', { max: 1600, skipBlankLines: true, skipComments: true }] } },
    { files: ['src/apps/app_docente/AppDocente.tsx'], rules: { 'max-lines': ['error', { max: 8000, skipBlankLines: true, skipComments: true }] } }
  ]
})];
