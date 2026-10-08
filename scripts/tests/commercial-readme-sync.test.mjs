import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-readme-context-'));
after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

test('elimina el bloque comercial heredado sin alterar README sin ese bloque', () => {
  const syncScript = path.join(tempRoot, 'scripts', 'comercial', 'sync-readmes-context.mjs');
  const legacyReadme = path.join(tempRoot, 'apps', 'backend', 'README.md');
  const plainReadme = path.join(tempRoot, 'docs', 'README.md');
  fs.mkdirSync(path.dirname(syncScript), { recursive: true });
  fs.mkdirSync(path.dirname(legacyReadme), { recursive: true });
  fs.mkdirSync(path.dirname(plainReadme), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'scripts', 'comercial', 'sync-readmes-context.mjs'), syncScript);

  const original = [
    '# Backend',
    '',
    'Guía técnica.',
    '',
    '<!-- AUTO:COMMERCIAL-CONTEXT:START -->',
    '## Contexto Comercial y Soporte',
    'SLA de una oferta no publicada.',
    '<!-- AUTO:COMMERCIAL-CONTEXT:END -->',
  ].join('\n');
  fs.writeFileSync(legacyReadme, original, 'utf8');
  fs.writeFileSync(plainReadme, '# Docs\n\nGuía vigente.\n', 'utf8');

  const result = spawnSync(process.execPath, [syncScript], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(legacyReadme, 'utf8'), '# Backend\n\nGuía técnica.\n');
  assert.equal(fs.readFileSync(plainReadme, 'utf8'), '# Docs\n\nGuía vigente.\n');
});
