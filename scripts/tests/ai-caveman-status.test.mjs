import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCavemanIntegration } from '../ai-caveman-status.mjs';

function fixture(hookCommand = 'node scripts/ai-session-start.mjs') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-caveman-'));
  fs.mkdirSync(path.join(root, '.codex'));
  fs.writeFileSync(path.join(root, '.codex', 'config.toml'), '[features]\ncodex_hooks = true\n', 'utf8');
  fs.writeFileSync(path.join(root, '.codex', 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ matcher: 'startup|resume', hooks: [{ type: 'command', command: hookCommand, timeout: 5 }] }] } }), 'utf8');
  return root;
}

test('Caveman configured distingue validacion estructural de plugin instalado', async () => {
  const report = await checkCavemanIntegration(fixture());
  assert.equal(report.configured, true);
  assert.equal(report.hookValid, true);
  assert.equal(report.pluginInstalled, false);
  assert.equal(report.ready, false);
});

test('Caveman reconoce la ruta oficial local .agents/skills', async () => {
  const root = fixture();
  const skillPath = path.join(root, '.agents', 'skills', 'caveman', 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, '# Caveman\n', 'utf8');
  const report = await checkCavemanIntegration(root);
  assert.equal(report.pluginInstalled, true);
  assert.equal(report.ready, true);
});

test('Caveman rechaza hook SessionStart sin comando esperado', async () => {
  const report = await checkCavemanIntegration(fixture('echo caveman'));
  assert.equal(report.hookValid, false);
  assert.equal(report.ready, false);
});
