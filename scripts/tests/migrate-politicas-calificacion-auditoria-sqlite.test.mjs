import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

test('migración de auditoría de políticas es aditiva e idempotente', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-politicas-migration-'));
  const databasePath = path.join(directorio, 'legacy.db');
  const db = new DatabaseSync(databasePath);
  db.exec('CREATE TABLE docentes (id TEXT PRIMARY KEY NOT NULL);');
  db.exec("INSERT INTO docentes (id) VALUES ('doc-1');");
  db.exec('CREATE TABLE politicas_calificacion (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, nombre TEXT NOT NULL, configuracion TEXT NOT NULL);');
  db.exec("INSERT INTO politicas_calificacion (id, docenteId, nombre, configuracion) VALUES ('policy-1', 'doc-1', 'LISC', '{}');");
  db.close();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrate-politicas-calificacion-auditoria-sqlite.mjs');
    const primera = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
    assert.equal(primera.status, 0, primera.stderr);
    const salida = JSON.parse(primera.stdout);
    assert.equal(salida.applied, true);
    assert.equal(fs.existsSync(salida.backupPath), true);

    const verificacion = new DatabaseSync(databasePath);
    try {
      const tabla = verificacion.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auditoria_politicas_calificacion'").get();
      assert.equal(tabla.name, 'auditoria_politicas_calificacion');
      const columnas = verificacion.prepare('PRAGMA table_info(politicas_calificacion)').all().map((columna) => columna.name);
      assert.deepEqual(columnas.slice(-5), ['codigo', 'familia', 'version', 'descripcion', 'activa']);
      const indices = verificacion.prepare("PRAGMA index_list('auditoria_politicas_calificacion')").all();
      assert.equal(indices.some((indice) => indice.unique === 1), true);
      const politica = verificacion.prepare('SELECT id, nombre FROM politicas_calificacion WHERE id = ?').get('policy-1');
      assert.equal(politica.nombre, 'LISC');
      verificacion.prepare(`INSERT INTO auditoria_politicas_calificacion
        (id, docenteId, codigo, version, accion, clientRequestId, requestHash, despues)
        VALUES ('audit-1', 'doc-1', 'POLICY_CUSTOM', 1, 'create', 'request-1', 'hash-1', '{}')`).run();
      assert.throws(() => verificacion.prepare('UPDATE auditoria_politicas_calificacion SET accion = ? WHERE id = ?').run('cambio', 'audit-1'), /append-only/);
      assert.throws(() => verificacion.prepare('DELETE FROM auditoria_politicas_calificacion WHERE id = ?').run('audit-1'), /append-only/);
      const segunda = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
      assert.equal(segunda.status, 0, segunda.stderr);
      assert.equal(JSON.parse(segunda.stdout).applied, false);
    } finally {
      verificacion.close();
    }
  } finally {
    const ruta = path.resolve(directorio);
    if (path.dirname(ruta) === path.resolve(os.tmpdir()) && path.basename(ruta).startsWith('evaluapro-politicas-migration-')) {
      fs.rmSync(ruta, { recursive: true, force: true });
    }
  }
});
