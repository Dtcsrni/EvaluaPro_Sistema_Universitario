import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acceptHandoff,
  assessHandoff,
  createAcknowledgement,
  describeArtifact,
  normalizeHandoffInput,
  prepareHandoffInput,
  serializeHandoff,
  validateHandoffEnvelope
} from '../ia-handoff-envelope.mjs';

function input() {
  return {
    messageId: 'msg-golden-1',
    taskId: 'task-golden-1',
    contextId: 'ctx-golden-1',
    state: 'working',
    agent: { provider: 'provider-a', name: 'researcher', version: '1.2.3', channel: 'cli' },
    summary: 'Transferir trabajo verificable',
    objective: 'Continuar la implementación sin perder decisiones',
    acceptanceCriteria: ['Preservar semántica', 'No ejecutar comandos'],
    constraints: ['No secretos'],
    decisions: ['Usar envelope compacto'],
    assumptions: ['El receptor valida el contrato'],
    risks: ['Proveedor no soporta todos los artefactos'],
    nextStep: 'Validar e importar en el agente receptor'
  };
}

test('normaliza alias heredados y produce envelope válido', () => {
  const envelope = normalizeHandoffInput({ ...input(), decisions: undefined, risks: undefined, nextStep: undefined, decisiones: ['Decisión heredada'], riesgos: ['Riesgo heredado'], siguientePaso: 'Continuar' });
  assert.equal(validateHandoffEnvelope(envelope), true);
  assert.deepEqual(envelope.context.decisions, ['Decisión heredada']);
  assert.deepEqual(envelope.context.risks, ['Riesgo heredado']);
  assert.equal(envelope.context.nextStep, 'Continuar');
});

test('acepta input canónico anidado sin marcar task como campo desconocido', () => {
  const envelope = normalizeHandoffInput({
    task: { objective: 'Continuar', acceptanceCriteria: ['Validar'] },
    summary: 'Contexto mínimo'
  });
  assert.equal(envelope.task.objective, 'Continuar');
  assert.equal(envelope.warnings, undefined);
});

test('serialización compacta es determinista y no contiene comandos', () => {
  const envelope = normalizeHandoffInput(input());
  const first = serializeHandoff(envelope);
  const second = serializeHandoff(JSON.parse(first));
  assert.equal(first, second);
  assert.equal(first.includes('commands'), false);
  assert.ok(Buffer.byteLength(first) > 0);
});

test('rechaza traversal y rutas absolutas', () => {
  assert.throws(() => normalizeHandoffInput({ ...input(), artifacts: [{ path: '../secreto.txt' }] }), /path insegura/i);
  assert.throws(() => normalizeHandoffInput({ ...input(), artifacts: [{ path: 'C:\\secreto.txt' }] }), /path invalida/i);
});

test('sanitiza secretos y mantiene politica sin autoejecucion', () => {
  const envelope = normalizeHandoffInput({ ...input(), objective: 'Usar token=super-secreto y Bearer abc123' });
  assert.equal(envelope.security.executionPolicy, 'no-auto-exec');
  assert.equal(envelope.security.trust, 'untrusted');
  assert.ok(envelope.security.redactionsApplied.length >= 1);
  assert.equal(serializeHandoff(envelope).includes('super-secreto'), false);
});

test('aceptacion es idempotente y emite ack', () => {
  const envelope = normalizeHandoffInput(input());
  const seen = new Set();
  assert.equal(acceptHandoff(envelope, seen).status, 'accepted');
  const duplicate = acceptHandoff(envelope, seen);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.sideEffects, false);
  assert.equal(createAcknowledgement(envelope, 'duplicate').ackFor, envelope.messageId);
});

test('artefacto local incluye tamaño y SHA-256 verificable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-handoff-artifact-'));
  const file = path.join(root, 'evidence.txt');
  fs.writeFileSync(file, 'evidence\n', 'utf8');
  const artifact = await describeArtifact('evidence.txt', root, { mediaType: 'text/plain' });
  assert.equal(artifact.bytes, 9);
  assert.equal(artifact.sha256, crypto.createHash('sha256').update('evidence\n').digest('hex'));
});

test('prepareHandoffInput enriquece artefactos locales antes de transferir', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-handoff-prepare-'));
  fs.writeFileSync(path.join(root, 'notes.txt'), 'notes', 'utf8');
  const envelope = await prepareHandoffInput({ ...input(), artifacts: [{ path: 'notes.txt', mediaType: 'text/plain' }] }, { rootDir: root });
  assert.equal(envelope.artifacts[0].bytes, 5);
  assert.match(envelope.artifacts[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(envelope.warnings, undefined);
});

test('rechaza propiedades no declaradas por el contrato', () => {
  const envelope = normalizeHandoffInput(input());
  envelope.unexpected = true;
  assert.throws(() => validateHandoffEnvelope(envelope), /propiedad no permitida/);
});

test('schema machine-readable declara el envelope y sus invariantes principales', () => {
  const schema = JSON.parse(fs.readFileSync(path.resolve('docs/handoff/handoff.schema.json'), 'utf8'));
  assert.equal(schema.properties.protocol.const, 'evaluapro.handoff');
  assert.equal(schema.properties.protocolVersion.const, '1.0');
  assert.ok(schema.required.includes('messageId'));
  assert.ok(schema.required.includes('security'));
  assert.deepEqual(schema.properties.task.properties.state.enum, ['submitted', 'working', 'input_required', 'completed', 'failed', 'cancelled', 'rejected']);
});

test('evaluacion reporta envelope listo sin ejecutar contenido', () => {
  const result = assessHandoff(normalizeHandoffInput(input()));
  assert.deepEqual(result, { ready: true, errors: [] });
});
