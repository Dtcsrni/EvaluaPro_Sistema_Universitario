import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
const workflowDir = path.join(root, '.github', 'workflows');

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

test('ext_funcionales usa gate OMR TV generico con version configurable', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa omr-tv-real-gate/);
  assert.match(block, /OMR_TV_GATE_VERSION/);
  assert.match(block, /npm run test:omr:tv:gate:ci/);
  assert.doesNotMatch(block, /npm run test:omr:tv3:gate:ci/);
});

test('ext_funcionales ejecuta PDF print y visual juntos', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa pdf-print-check/);
  assert.match(block, /npm run test:pdf-print:ci/);
  assert.match(block, /npm run test:pdf-visual:ci/);
});

test('ext_funcionales conserva quality visual y journeys para UX', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'ext_funcionales');

  assert.match(block, /Etapa ux-visual-check/);
  assert.match(block, /npm run test:ux-quality:ci/);
  assert.match(block, /npm run test:ux-visual:ci/);
  assert.match(block, /npm run test:e2e:journeys:ci/);
});

test('core backend ejecuta auditoria focal classroom cuando el mapa la activa', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'core_backend_portal');

  assert.match(workflow, /gate_classroom_audit_check/);
  assert.match(block, /Etapa classroom-audit-check/);
  assert.match(block, /npm run test:classroom:audit:ci/);
});

test('core contract valida installer afectado sin depender del bundle release', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const block = extractJobBlock(workflow, 'core_contract_docs_gov');

  assert.match(block, /Etapa installer-contract-check/);
  assert.match(block, /needs\.detectar_cambios\.outputs\.installer == 'true'/);
  assert.match(block, /npm run test:installer-hub:contract/);
  assert.match(block, /npm run test:wix:policy/);
});

test('workflow CI unifica concurrency por repo fuente y branch fuente', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name \|\| github\.repository/);
  assert.match(workflow, /github\.event\.pull_request\.head\.ref \|\| github\.head_ref \|\| github\.ref_name/);
  assert.doesNotMatch(workflow, /group:\s*ci-\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}/);
});

test('workflow CI expone force_full_ci y gating affected-only en extended', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+force_full_ci:/s);
  assert.match(workflow, /job_ext_funcionales/);
  assert.match(workflow, /job_ext_perf_arquitectura/);
  assert.match(workflow, /job_ext_compliance_evidencia/);
  assert.match(workflow, /gate_flujo_docente_check/);
  assert.match(workflow, /gate_perf_check/);
  assert.match(workflow, /gate_qa_manifest/);
  assert.match(workflow, /inputs\.force_full_ci/);
  assert.match(workflow, /needs\.detectar_cambios\.outputs\.escalation == 'full-extended'/);
});

test('workflow CI mantiene schedule full para jobs extended', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const funcionales = extractJobBlock(workflow, 'ext_funcionales');
  const perf = extractJobBlock(workflow, 'ext_perf_arquitectura');
  const compliance = extractJobBlock(workflow, 'ext_compliance_evidencia');

  assert.match(funcionales, /github\.event_name == 'schedule'/);
  assert.match(perf, /github\.event_name == 'schedule'/);
  assert.match(compliance, /github\.event_name == 'schedule'/);
});

test('workflows usan actions oficiales compatibles con runtime Node 24', () => {
  const workflows = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/i.test(file));
  const deprecatedRuntimeActions = [
    /actions\/checkout@v4/,
    /actions\/setup-node@v4/,
    /actions\/upload-artifact@v4/
  ];

  for (const workflow of workflows) {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8');

    for (const action of deprecatedRuntimeActions) {
      assert.doesNotMatch(content, action, `${workflow} conserva ${action}`);
    }
  }
});
