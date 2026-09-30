import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareDataset } from '../../tools/omr-camera-dataset/prepare.mjs';

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('prepara dataset externo con hashes, etiquetas y copia byte a byte', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-camera-dataset-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  const attached = path.join(root, 'attached-duplicate.jpg');
  fs.mkdirSync(input);
  const fixture = path.resolve('omr_samples_tv4/images/TV4-SYNTH-001-P1.jpg');
  fs.copyFileSync(fixture, path.join(input, 'capture-001.jpg'));
  fs.copyFileSync(fixture, attached);
  const reportPath = path.join(root, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ processed: 1, determined: 1, rows: [{
    file: 'attached-duplicate.jpg', folio: 'TEST-01', response: 'ABC', key: 'ABC', observed: 'ABC', determined: 3, ambiguous: 0, blank: 0, invalid: 0, estado: 'ok', responseDetails: []
  }] }));
  const sourceHash = hash(path.join(input, 'capture-001.jpg'));

  const result = await prepareDataset({ inputDir: input, outputDir: output, reportPath, attachedPaths: [attached], archive: false });
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  const label = JSON.parse(fs.readFileSync(path.join(output, 'labels.jsonl'), 'utf8').trim());

  assert.equal(result.archivePath, null);
  assert.equal(manifest.source.sourceMutation, false);
  assert.equal(manifest.files.images, 1);
  assert.equal(label.sourceSha256, sourceHash);
  assert.equal(label.duplicate.matchedBy, 'sha256');
  assert.equal(label.label.mappingSource, 'duplicate_hash_match');
  assert.equal(label.label.folio, 'TEST-01');
  assert.equal(hash(path.join(output, 'images/capture-001.jpg')), sourceHash);
  assert.equal(hash(path.join(input, 'capture-001.jpg')), sourceHash);
  assert.match(fs.readFileSync(path.join(output, 'README.md'), 'utf8'), /no forma parte del ejecutable/i);
});

test('rechaza sobrescribir una salida existente', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-camera-dataset-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  fs.mkdirSync(input);
  fs.copyFileSync(path.resolve('omr_samples_tv4/images/TV4-SYNTH-001-P1.jpg'), path.join(input, 'capture.jpg'));
  fs.mkdirSync(output);

  await assert.rejects(
    prepareDataset({ inputDir: input, outputDir: output, archive: false }),
    /salida ya existe/i
  );
});

test('crea ZIP y sidecar SHA-256 verificando imágenes sin recomprimir', { skip: process.platform !== 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-camera-dataset-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  fs.mkdirSync(input);
  fs.copyFileSync(path.resolve('omr_samples_tv4/images/TV4-SYNTH-001-P1.jpg'), path.join(input, 'capture.jpg'));

  const result = await prepareDataset({ inputDir: input, outputDir: output, archive: true });
  assert.equal(result.archiveVerification.hashMismatches, 0);
  assert.equal(fs.existsSync(result.archivePath), true);
  assert.equal(fs.existsSync(result.archiveSha256Path), true);
  assert.match(fs.readFileSync(result.archiveSha256Path, 'utf8'), /^[a-f0-9]{64}  /i);
});
