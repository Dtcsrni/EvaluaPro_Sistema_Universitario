import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

test('migración de auditoría de temarios es aditiva e idempotente', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-temarios-migration-'));
  const databasePath = path.join(directorio, 'legacy.db');
  const db = new DatabaseSync(databasePath);
  db.exec('CREATE TABLE temarios (id TEXT PRIMARY KEY, periodoId TEXT NOT NULL, nombre TEXT NOT NULL);');
  db.exec("INSERT INTO temarios (id, periodoId, nombre) VALUES ('t-1', 'p-1', 'Programa anterior');");
  db.close();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrate-temarios-auditoria-sqlite.mjs');
    const primera = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
    assert.equal(primera.status, 0, primera.stderr);
    const salida = JSON.parse(primera.stdout);
    assert.equal(salida.applied, true);
    assert.equal(fs.existsSync(salida.backupPath), true);

    const verificacion = new DatabaseSync(databasePath);
    try {
      const nombres = new Set(verificacion.prepare("PRAGMA table_info('temarios')").all().map((columna) => columna.name));
      assert.equal(nombres.has('auditoriaCambios'), true);
      const tablaAuditoria = verificacion.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auditoria_temarios'").get();
      assert.equal(tablaAuditoria.name, 'auditoria_temarios');
      const filaAnterior = verificacion.prepare('SELECT id, nombre, auditoriaCambios FROM temarios WHERE id = ?').get('t-1');
      assert.equal(filaAnterior.id, 't-1');
      assert.equal(filaAnterior.nombre, 'Programa anterior');
      assert.equal(filaAnterior.auditoriaCambios, null);
      const segunda = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
      assert.equal(segunda.status, 0, segunda.stderr);
      assert.equal(JSON.parse(segunda.stdout).applied, false);
    } finally {
      verificacion.close();
    }
  } finally {
    const ruta = path.resolve(directorio);
    if (path.dirname(ruta) !== path.resolve(os.tmpdir()) || !path.basename(ruta).startsWith('evaluapro-temarios-migration-')) {
      throw new Error('Directorio de prueba inesperado; se cancela su eliminación.');
    }
    fs.rmSync(ruta, { recursive: true, force: true });
  }
});
