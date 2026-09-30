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
import baseConfig from './eslint.base.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [...compat.config(baseConfig)];
