#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PRODLIKE_GENERATED_FIXTURE = 'reports/qa/generated/prodlike-anon.json.gz';
export const PRODLIKE_CI_SCRIPTS = [
  'scripts/testing/export-anon-fixture.mjs',
  'scripts/testing/validate-anon-fixture.mjs',
  'scripts/testing/import-anon-fixture.mjs'
];

export function runProdlikeDatasetCi({
  root = process.cwd(),
  writeError = (message) => process.stderr.write(message),
  runScript = (script, env) => spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    env,
    stdio: 'inherit'
  })
} = {}) {
  const generatedFixture = path.resolve(root, PRODLIKE_GENERATED_FIXTURE);
  const env = {
    ...process.env,
    ANON_OUTPUT_GZ: generatedFixture,
    ANON_INPUT_GZ: generatedFixture,
    ANON_IMPORTED_JSON: path.resolve(root, 'reports/qa/generated/prodlike-imported.json')
  };

  for (const script of PRODLIKE_CI_SCRIPTS) {
    const result = runScript(script, env);
    if (result?.error) {
      writeError(`[dataset-prodlike:ci] ERROR ejecutando ${script}: ${result.error.message}\n`);
      return 1;
    }
    if (result?.status !== 0) {
      writeError(`[dataset-prodlike:ci] FAIL en ${script} (exit=${result?.status ?? 'desconocido'})\n`);
      return result?.status && result.status > 0 ? result.status : 1;
    }
  }

  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = runProdlikeDatasetCi();
}
