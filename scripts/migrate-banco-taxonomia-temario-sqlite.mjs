import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const rutaArgumento = argumento('--database');
if (!rutaArgumento) throw new Error('Uso: migrate-banco-taxonomia-temario-sqlite.mjs --database <ruta>');
const databasePath = path.resolve(rutaArgumento);
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) throw new Error('La migración requiere una base SQLite existente y explícita.');

const migrationId = '20261023-banco-taxonomia-temario-v1';
const db = new DatabaseSync(databasePath);
try {
  db.exec('PRAGMA foreign_keys = ON;');
  const banco = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='banco_temas'").get();
  if (!banco) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    db.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    if (!db.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId)) {
      const backupPath = `${databasePath}.bak-banco-taxonomia-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS banco_categorias (
            id TEXT PRIMARY KEY NOT NULL,
            docenteId TEXT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            periodoId TEXT NOT NULL REFERENCES periodos(id) ON DELETE CASCADE ON UPDATE CASCADE,
            nombre TEXT NOT NULL,
            clave TEXT NOT NULL,
            temarioNodoId TEXT,
            activo BOOLEAN NOT NULL DEFAULT 1,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE UNIQUE INDEX IF NOT EXISTS banco_categorias_docenteId_periodoId_clave_key ON banco_categorias(docenteId, periodoId, clave);
          CREATE INDEX IF NOT EXISTS banco_categorias_periodoId_temarioNodoId_idx ON banco_categorias(periodoId, temarioNodoId);
        `);
        const columnas = new Set(db.prepare('PRAGMA table_info(banco_temas)').all().map((columna) => columna.name));
        if (!columnas.has('categoriaId')) db.exec('ALTER TABLE banco_temas ADD COLUMN categoriaId TEXT REFERENCES banco_categorias(id) ON DELETE SET NULL;');
        if (!columnas.has('temarioNodoId')) db.exec('ALTER TABLE banco_temas ADD COLUMN temarioNodoId TEXT;');
        const periodos = db.prepare('SELECT DISTINCT docenteId, periodoId FROM banco_temas').all();
        const insertar = db.prepare('INSERT OR IGNORE INTO banco_categorias (id, docenteId, periodoId, nombre, clave) VALUES (?, ?, ?, ?, ?)');
        const consultar = db.prepare('SELECT id FROM banco_categorias WHERE docenteId = ? AND periodoId = ? AND clave = ?');
        const actualizar = db.prepare('UPDATE banco_temas SET categoriaId = ? WHERE docenteId = ? AND periodoId = ? AND categoriaId IS NULL');
        for (const periodo of periodos) {
          const id = `legacy-${periodo.docenteId}-${periodo.periodoId}`;
          insertar.run(id, periodo.docenteId, periodo.periodoId, 'Sin categoría', 'sin categoría');
          const categoria = consultar.get(periodo.docenteId, periodo.periodoId, 'sin categoría');
          actualizar.run(categoria.id, periodo.docenteId, periodo.periodoId);
        }
        db.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
        db.exec('COMMIT;');
        console.log(JSON.stringify({ migrationId, applied: true, backupPath }));
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
    } else {
      console.log(JSON.stringify({ migrationId, applied: false }));
    }
  }
} finally {
  db.close();
}
