import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

test('migración de auditoría de plantillas es aditiva, append-only e idempotente', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-plantillas-auditoria-'));
  const databasePath = path.join(directorio, 'legacy.db');
  const db = new DatabaseSync(databasePath);
  db.exec('CREATE TABLE examenes_plantilla (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, titulo TEXT NOT NULL);');
  db.exec("INSERT INTO examenes_plantilla (id, docenteId, titulo) VALUES ('plantilla-1', 'doc-1', 'Parcial');");
  db.close();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrate-plantillas-auditoria-sqlite.mjs');
    const primera = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
    assert.equal(primera.status, 0, primera.stderr);
    const salida = JSON.parse(primera.stdout);
    assert.equal(salida.applied, true);
    assert.equal(fs.existsSync(salida.backupPath), true);

    const verificacion = new DatabaseSync(databasePath);
    try {
      const indices = verificacion.prepare("PRAGMA index_list('auditoria_plantillas_examen')").all();
      assert.equal(indices.some((indice) => indice.unique === 1), true);
      verificacion.prepare(`INSERT INTO auditoria_plantillas_examen
        (id, docenteId, plantillaId, accion, clientRequestId, requestHash, despues)
        VALUES ('audit-1', 'doc-1', 'plantilla-1', 'crear', 'request-1', 'hash', '{"ok":true}')`).run();
      assert.throws(() => verificacion.prepare('UPDATE auditoria_plantillas_examen SET accion = ? WHERE id = ?').run('editar', 'audit-1'), /append-only/);
      assert.throws(() => verificacion.prepare('DELETE FROM auditoria_plantillas_examen WHERE id = ?').run('audit-1'), /append-only/);
      const plantilla = verificacion.prepare('SELECT id, titulo FROM examenes_plantilla WHERE id = ?').get('plantilla-1');
      assert.equal(plantilla.id, 'plantilla-1');
      assert.equal(plantilla.titulo, 'Parcial');
      const segunda = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
      assert.equal(segunda.status, 0, segunda.stderr);
      assert.equal(JSON.parse(segunda.stdout).applied, false);
    } finally {
      verificacion.close();
    }
  } finally {
    const ruta = path.resolve(directorio);
    if (path.dirname(ruta) !== path.resolve(os.tmpdir()) || !path.basename(ruta).startsWith('evaluapro-plantillas-auditoria-')) {
      throw new Error('Directorio de prueba inesperado; se cancela su eliminación.');
    }
    fs.rmSync(ruta, { recursive: true, force: true });
  }
});
