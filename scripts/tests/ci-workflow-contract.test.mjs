import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');

function extractJobBlock(workflow, jobKey) {
  const startMarker = `  ${jobKey}:\n`;
  const start = workflow.indexOf(startMarker);
  assert.ok(start >= 0, `job no encontrado: ${jobKey}`);

  const rest = workflow.slice(start + startMarker.length);
  const nextJobMatch = rest.match(/\n  [a-z0-9_]+:\n/i);
  const end = nextJobMatch ? start + startMarker.length + nextJobMatch.index : workflow.length;
  return workflow.slice(start, end);
}

test('ext_perf_arquitectura prepara sharp antes de perf:check', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_perf_arquitectura');

  assert.match(block, /run:\s*npm ci --foreground-scripts/);
  assert.match(block, /Preparar runtime sharp \(linux-x64\)/);
  assert.match(block, /npm install --no-save --include=optional --os=linux --cpu=x64 sharp/);
  assert.match(block, /run:\s*npm run perf:check/);

  const setupIndex = block.indexOf('run: npm ci --foreground-scripts');
  const sharpIndex = block.indexOf('npm install --no-save --include=optional --os=linux --cpu=x64 sharp');
  const perfIndex = block.indexOf('run: npm run perf:check');

  assert.ok(setupIndex >= 0, 'faltante setup npm ci');
  assert.ok(sharpIndex > setupIndex, 'sharp debe ejecutarse despues de npm ci');
  assert.ok(perfIndex > sharpIndex, 'perf:check debe ejecutarse despues de preparar sharp');
});
