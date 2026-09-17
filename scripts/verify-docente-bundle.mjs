#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDocenteBundle } from './docente-bundle-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distArgIndex = process.argv.findIndex((value) => value === '--dist');
const distRoot = distArgIndex >= 0
  ? path.resolve(process.argv[distArgIndex + 1] || '')
  : path.join(root, 'apps', 'frontend', 'dist-docente');

const result = assertDocenteBundle({ distRoot });
process.stdout.write(`[docente-bundle-guard] OK ${result.contract}: ${result.root}\n`);
