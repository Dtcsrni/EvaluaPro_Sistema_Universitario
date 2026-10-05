import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

test('la migración de auditoría de políticas es aditiva, append-only e idempotente', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-politicas-auditoria-'));
  const databasePath = path.join(directorio, 'legacy.db');
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE docentes (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE politicas_calificacion (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, nombre TEXT NOT NULL, configuracion TEXT NOT NULL);
    INSERT INTO docentes (id) VALUES ('docente-1');
    INSERT INTO politicas_calificacion (id, docenteId, nombre, configuracion)
      VALUES ('politica-1', 'docente-1', 'Política base', '{"codigo":"POLICY_BASE","version":1}');
  `);
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
      const migracion = verificacion.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get('20261004-politicas-calificacion-auditoria-v1');
      assert.equal(migracion.id, '20261004-politicas-calificacion-auditoria-v1');
      const politica = verificacion.prepare('SELECT id, nombre, configuracion FROM politicas_calificacion WHERE id = ?').get('politica-1');
      assert.equal(politica.nombre, 'Política base');
      assert.match(politica.configuracion, /POLICY_BASE/);
      verificacion.prepare(`INSERT INTO auditoria_politicas_calificacion
        (id, docenteId, codigo, version, accion, clientRequestId, requestHash, despues)
        VALUES ('audit-1', 'docente-1', 'POLICY_BASE', 1, 'crear', 'request-1', 'hash', '{"version":1}')`).run();
      assert.throws(() => verificacion.prepare('UPDATE auditoria_politicas_calificacion SET motivo = ? WHERE id = ?').run('alterado', 'audit-1'), /append-only/);
      assert.throws(() => verificacion.prepare('DELETE FROM auditoria_politicas_calificacion WHERE id = ?').run('audit-1'), /append-only/);
      const segunda = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
      assert.equal(segunda.status, 0, segunda.stderr);
      assert.equal(JSON.parse(segunda.stdout).applied, false);
    } finally {
      verificacion.close();
    }
  } finally {
    const ruta = path.resolve(directorio);
    if (path.dirname(ruta) !== path.resolve(os.tmpdir()) || !path.basename(ruta).startsWith('evaluapro-politicas-auditoria-')) {
      throw new Error('Directorio de prueba inesperado; se cancela su eliminación.');
    }
    fs.rmSync(ruta, { recursive: true, force: true });
  }
});
