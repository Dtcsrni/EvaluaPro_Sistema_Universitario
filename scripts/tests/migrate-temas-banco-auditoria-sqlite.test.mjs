import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

test('migración de auditoría de temas es aditiva e idempotente', () => {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-temas-banco-migration-'));
  const databasePath = path.join(directorio, 'legacy.db');
  const db = new DatabaseSync(databasePath);
  db.exec('CREATE TABLE banco_temas (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, periodoId TEXT NOT NULL, nombre TEXT NOT NULL);');
  db.exec("INSERT INTO banco_temas (id, docenteId, periodoId, nombre) VALUES ('tema-1', 'doc-1', 'periodo-1', 'Álgebra');");
  db.close();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrate-temas-banco-auditoria-sqlite.mjs');
    const primera = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
    assert.equal(primera.status, 0, primera.stderr);
    const salida = JSON.parse(primera.stdout);
    assert.equal(salida.applied, true);
    assert.equal(fs.existsSync(salida.backupPath), true);

    const verificacion = new DatabaseSync(databasePath);
    try {
      const tabla = verificacion.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auditoria_temas_banco'").get();
      assert.equal(tabla.name, 'auditoria_temas_banco');
      const indices = verificacion.prepare("PRAGMA index_list('auditoria_temas_banco')").all();
      assert.equal(indices.some((indice) => indice.unique === 1), true);
      const tema = verificacion.prepare('SELECT id, nombre FROM banco_temas WHERE id = ?').get('tema-1');
      assert.equal(tema.id, 'tema-1');
      assert.equal(tema.nombre, 'Álgebra');
      const segunda = spawnSync(process.execPath, [script, '--database', databasePath], { encoding: 'utf8' });
      assert.equal(segunda.status, 0, segunda.stderr);
      assert.equal(JSON.parse(segunda.stdout).applied, false);
    } finally {
      verificacion.close();
    }
  } finally {
    const ruta = path.resolve(directorio);
    if (path.dirname(ruta) !== path.resolve(os.tmpdir()) || !path.basename(ruta).startsWith('evaluapro-temas-banco-migration-')) {
      throw new Error('Directorio de prueba inesperado; se cancela su eliminación.');
    }
    fs.rmSync(ruta, { recursive: true, force: true });
  }
});
