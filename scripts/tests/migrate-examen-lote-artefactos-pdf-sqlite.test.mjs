import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'scripts', 'migrate-examen-lote-artefactos-pdf-sqlite.mjs');

test('crea artefactos PDF por lote con migración aditiva e idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-lote-pdf-migration-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('CREATE TABLE docentes (id TEXT PRIMARY KEY); INSERT INTO docentes VALUES (\'doc-1\');');
  } finally {
    db.close();
  }

  try {
    const first = await execFileAsync(process.execPath, [script, '--database', dbPath]);
    assert.match(first.stdout, /"applied":true/);
    const second = await execFileAsync(process.execPath, [script, '--database', dbPath]);
    assert.match(second.stdout, /"applied":false/);

    const verify = new DatabaseSync(dbPath);
    try {
      verify.prepare(`INSERT INTO examen_lote_artefactos_pdf
        (id, docenteId, loteId, plantillaId, archivoNombre, sha256, totalPaginas, totalExamenes)
        VALUES ('id-1','doc-1','lote-1','plantilla-1','lote.pdf','${'a'.repeat(64)}',8,2)`).run();
      assert.equal(verify.prepare('SELECT totalPaginas FROM examen_lote_artefactos_pdf WHERE docenteId = ? AND loteId = ?').get('doc-1', 'lote-1').totalPaginas, 8);
      assert.throws(() => verify.prepare(`INSERT INTO examen_lote_artefactos_pdf
        (id, docenteId, loteId, plantillaId, archivoNombre, sha256, totalPaginas, totalExamenes)
        VALUES ('id-2','doc-1','lote-1','plantilla-1','lote.pdf','${'b'.repeat(64)}',8,2)`).run());
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM examen_lote_artefactos_pdf').get().total, 1);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
