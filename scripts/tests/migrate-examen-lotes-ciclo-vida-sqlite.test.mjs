import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const migrationBase = path.join(root, 'scripts', 'migrate-examen-lote-artefactos-pdf-sqlite.mjs');
const migrationLifecycle = path.join(root, 'scripts', 'migrate-examen-lotes-ciclo-vida-sqlite.mjs');

test('agrega archivo auditable e idempotente al artefacto de lote', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-lote-lifecycle-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('CREATE TABLE docentes (id TEXT PRIMARY KEY); INSERT INTO docentes VALUES (\'doc-1\');');
  } finally {
    db.close();
  }

  try {
    await execFileAsync(process.execPath, [migrationBase, '--database', dbPath]);
    const first = await execFileAsync(process.execPath, [migrationLifecycle, '--database', dbPath]);
    assert.match(first.stdout, /"applied":true/);
    const second = await execFileAsync(process.execPath, [migrationLifecycle, '--database', dbPath]);
    assert.match(second.stdout, /"applied":false/);

    const verify = new DatabaseSync(dbPath);
    try {
      verify.prepare(`INSERT INTO examen_lote_artefactos_pdf
        (id, docenteId, loteId, plantillaId, archivoNombre, sha256, totalPaginas, totalExamenes, archivadoEn)
        VALUES ('artifact-1','doc-1','lote-1','plantilla-1','lote.pdf','${'a'.repeat(64)}',8,2,CURRENT_TIMESTAMP)`).run();
      verify.prepare(`INSERT INTO examen_lote_artefactos_pdf_auditoria
        (id, docenteId, artefactoId, loteId, accion, clientRequestId, archivadoResultante)
        VALUES ('event-1','doc-1','artifact-1','lote-1','archivar','req-1',1)`).run();
      assert.equal(verify.prepare('SELECT archivadoEn FROM examen_lote_artefactos_pdf WHERE id = ?').get('artifact-1').archivadoEn !== null, true);
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM examen_lote_artefactos_pdf_auditoria WHERE docenteId = ? AND loteId = ?').get('doc-1', 'lote-1').total, 1);
      assert.throws(() => verify.prepare(`INSERT INTO examen_lote_artefactos_pdf_auditoria
        (id, docenteId, artefactoId, loteId, accion, clientRequestId, archivadoResultante)
        VALUES ('event-2','doc-1','artifact-1','lote-1','restaurar','req-1',0)`).run());
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('acepta bases creadas desde el esquema Prisma actual', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-lote-schema-actual-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE docentes (id TEXT PRIMARY KEY);
      CREATE TABLE examen_lote_artefactos_pdf (
        id TEXT PRIMARY KEY,
        docenteId TEXT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
        loteId TEXT NOT NULL,
        plantillaId TEXT NOT NULL,
        archivoNombre TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        totalPaginas INTEGER NOT NULL,
        totalExamenes INTEGER NOT NULL,
        archivadoEn DATETIME,
        archivadoPor TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE examen_lote_artefactos_pdf_auditoria (
        id TEXT PRIMARY KEY,
        docenteId TEXT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
        artefactoId TEXT NOT NULL REFERENCES examen_lote_artefactos_pdf(id) ON DELETE CASCADE,
        loteId TEXT NOT NULL,
        accion TEXT NOT NULL,
        clientRequestId TEXT NOT NULL,
        archivadoResultante BOOLEAN NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (docenteId, clientRequestId)
      );
      CREATE INDEX examen_lote_artefactos_pdf_auditoria_lote_idx
        ON examen_lote_artefactos_pdf_auditoria(docenteId, loteId, createdAt);
    `);
  } finally {
    db.close();
  }

  try {
    const result = await execFileAsync(process.execPath, [migrationLifecycle, '--database', dbPath]);
    assert.match(result.stdout, /"applied":true/);
    const verify = new DatabaseSync(dbPath);
    try {
      const columns = verify.prepare('PRAGMA table_info("examen_lote_artefactos_pdf")').all().map((column) => column.name);
      assert.ok(columns.includes('archivadoEn'));
      assert.ok(columns.includes('archivadoPor'));
      assert.equal(verify.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'examen_lote_artefactos_pdf_auditoria'").get().total, 1);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
