/**
 * ia-traceability.test
 *
 * Responsabilidad: Verificar el contrato agnostico de trazabilidad IA y el comportamiento del generador de handoff.
 * Limites: Validar contrato, compatibilidad y render sin depender de gates pesados reales.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadTraceSchema,
  listTraceabilityContractTargets,
  normalizeTraceInput,
  renderTraceMarkdown,
  validateTraceDocument,
  validateTraceSchemaDefinition,
  validateTraceabilityContractFiles
} from '../ia-traceability.mjs';
import { generateHandoffReport } from '../ia-handoff.mjs';

const rootDir = process.cwd();

function mkTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function okRunner() {
  return async (command) => ({
    stdout: `ok: ${command}`,
    stderr: '',
    exitCode: 0
  });
}

function baseInputTrace() {
  return {
    agent: {
      name: 'unknown',
      version: 'unknown',
      provider: 'unknown',
      kind: 'agente-ia',
      channel: 'cli'
    },
    request: {
      summary: 'Endurecer la trazabilidad multi-agente del repositorio.'
    },
    objective: 'Emitir evidencia canonica JSON y Markdown por sesion.',
    scope: ['Scripts de handoff', 'Documentacion de gobernanza', 'Policy audit'],
    constraints: ['No registrar prompts completos.'],
    decisions: ['Separar salida JSON y salida Markdown.'],
    assumptions: ['El runtime del agente puede no exponer version exacta.'],
    risks: ['El historico markdown previo queda como legado.'],
    nextStep: 'Ejecutar validaciones de politica y actualizar baselines.'
  };
}

test('trace schema existe y contiene contrato minimo esperado', () => {
  const schema = loadTraceSchema(rootDir);
  assert.equal(validateTraceSchemaDefinition(schema), true);
});

test('generateHandoffReport quick sin input produce sesion draft con json y markdown', async () => {
  const outputDir = mkTempDir('evaluapro-ia-trace-quick-');
  const result = await generateHandoffReport({
    rootDir,
    mode: 'quick',
    outputDir,
    now: new Date('2026-03-22T10:00:00.000Z'),
    runner: okRunner(),
    runtimeContext: {
      rootDir,
      branch: 'main',
      commit: 'abc123',
      workingTreeStatus: '',
      changedFiles: []
    }
  });

  assert.equal(result.trace.status, 'draft');
  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.match(result.markdown, /## Solicitud/);
  assert.match(result.markdown, /## Validacion ejecutada/);
});

test('generateHandoffReport full sin input mantiene compatibilidad y queda draft', async () => {
  const outputDir = mkTempDir('evaluapro-ia-trace-full-');
  const result = await generateHandoffReport({
    rootDir,
    mode: 'full',
    outputDir,
    now: new Date('2026-03-22T10:15:00.000Z'),
    runner: okRunner(),
    runtimeContext: {
      rootDir,
      branch: 'main',
      commit: 'def456',
      workingTreeStatus: 'M docs/IA_TRAZABILIDAD_AGENTES.md',
      changedFiles: ['docs/IA_TRAZABILIDAD_AGENTES.md']
    }
  });

  assert.equal(result.trace.status, 'draft');
  assert.equal(result.trace.commands.some((command) => command.status === 'ok'), true);
  assert.equal(result.trace.files.artifacts.length, 2);
});

test('generateHandoffReport con input minimo valido produce sesion final', async () => {
  const outputDir = mkTempDir('evaluapro-ia-trace-final-');
  const result = await generateHandoffReport({
    rootDir,
    mode: 'quick',
    outputDir,
    now: new Date('2026-03-22T10:30:00.000Z'),
    inputTrace: baseInputTrace(),
    runner: okRunner(),
    runtimeContext: {
      rootDir,
      branch: 'main',
      commit: 'fed789',
      workingTreeStatus: '',
      changedFiles: ['scripts/ia-handoff.mjs']
    }
  });

  assert.equal(result.trace.status, 'final');
  assert.equal(validateTraceDocument(result.trace, { allowDraft: false }), true);
  assert.match(renderTraceMarkdown(result.trace), /## Decisiones/);
});

test('validateTraceDocument falla si una sesion final omite campos semanticos requeridos', () => {
  const trace = normalizeTraceInput(baseInputTrace(), {
    nowIso: '2026-03-22T10:45:00.000Z',
    validationProfile: 'quick',
    sessionId: 'sesion-semantic-fail',
    commands: [
      {
        name: 'pipeline_contract_check',
        command: 'npm run pipeline:contract:check',
        status: 'ok',
        exitCode: 0,
        durationMs: 12,
        resultSummary: 'pipeline contract OK'
      }
    ],
    repo: {
      rootDir,
      branch: 'main',
      commit: '123abc',
      workingTreeStatus: ''
    }
  });

  trace.status = 'final';
  trace.objective = 'Pendiente de completar por el agente.';
  assert.throws(() => validateTraceDocument(trace, { allowDraft: false }), /faltan campos/i);
});

test('unknown en version/provider del agente es valido', () => {
  const trace = normalizeTraceInput(baseInputTrace(), {
    nowIso: '2026-03-22T11:00:00.000Z',
    validationProfile: 'quick',
    sessionId: 'sesion-unknown-ok',
    commands: [
      {
        name: 'docs_check',
        command: 'npm run docs:check',
        status: 'ok',
        exitCode: 0,
        durationMs: 5,
        resultSummary: 'docs OK'
      }
    ],
    repo: {
      rootDir,
      branch: 'main',
      commit: '456def',
      workingTreeStatus: ''
    }
  });

  trace.agent.version = 'unknown';
  trace.agent.provider = 'unknown';
  assert.equal(validateTraceDocument(trace, { allowDraft: false }), true);
});

test('el contrato valida archivos canonicos y excluye el historico markdown de sesiones', () => {
  const targets = validateTraceabilityContractFiles(rootDir);
  assert.equal(targets.length >= 5, true);
  const normalizedTargets = listTraceabilityContractTargets(rootDir).map((item) => item.replace(/\\/g, '/'));
  assert.equal(normalizedTargets.some((item) => item.includes('/docs/handoff/sesiones/')), false);
});
