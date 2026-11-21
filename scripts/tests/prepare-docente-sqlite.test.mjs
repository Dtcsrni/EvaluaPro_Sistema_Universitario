/** Contrato de bootstrap SQLite idempotente para repair/update nativo. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = process.cwd();

test('prepare-docente-sqlite conserva una base existente y crea objetos faltantes', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-sqlite-'));
  const database = path.join(temp, 'evaluapro.db');
  const schema = path.join(temp, 'schema.sql');
  await fs.writeFile(schema, [
    'CREATE TABLE "docentes" ("id" TEXT PRIMARY KEY, "correo" TEXT NOT NULL);',
    'CREATE TABLE "cursos" ("id" TEXT PRIMARY KEY, "nombre" TEXT NOT NULL);',
    'CREATE UNIQUE INDEX "cursos_nombre_key" ON "cursos"("nombre");'
  ].join('\n'));
  try {
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-docente-sqlite.mjs'), '--database', database, '--schema-sql', schema]);
    await execFileAsync(process.execPath, ['--input-type=module', '-e', `import { DatabaseSync } from 'node:sqlite';const d=new DatabaseSync(${JSON.stringify(database)});d.exec("INSERT INTO docentes(id,correo) VALUES ('d1','docente@example.test')");d.close();`]);
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-docente-sqlite.mjs'), '--database', database, '--schema-sql', schema]);
    const check = await execFileAsync(process.execPath, ['--input-type=module', '-e', `import { DatabaseSync } from 'node:sqlite';const d=new DatabaseSync(${JSON.stringify(database)});const count=d.prepare("SELECT count(*) AS c FROM docentes").get().c;const columns=d.prepare('PRAGMA table_info("docentes")').all();console.log(JSON.stringify({count,hasProfileImage:columns.some(c=>c.name==='imagenPerfil')}));d.close();`]);
    assert.deepEqual(JSON.parse(check.stdout.trim()), { count: 1, hasProfileImage: true });
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('prepara el esquema actual sobre alumnos legado antes de crear el índice de orden', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-sqlite-orden-'));
  const databasePath = path.join(temp, 'evaluapro.db');
  const schemaPath = path.join(temp, 'schema.sql');
  const database = new DatabaseSync(databasePath);
  database.exec(`CREATE TABLE "alumnos" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "periodoId" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
  );
  INSERT INTO "alumnos" VALUES ('b', 'p1', 'CUH2', '2026-01-02');
  INSERT INTO "alumnos" VALUES ('a', 'p1', 'CUH1', '2026-01-01');
  INSERT INTO "alumnos" VALUES ('c', 'p2', 'CUH3', '2026-01-01');`);
  database.close();
  await fs.writeFile(schemaPath, [
    'CREATE TABLE "alumnos" ("id" TEXT PRIMARY KEY NOT NULL, "periodoId" TEXT NOT NULL, "matricula" TEXT NOT NULL, "createdAt" DATETIME NOT NULL, "ordenLista" INTEGER NOT NULL DEFAULT 0);',
    'CREATE INDEX "alumnos_periodoId_ordenLista_idx" ON "alumnos"("periodoId", "ordenLista");'
  ].join('\n'));

  try {
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-docente-sqlite.mjs'), '--database', databasePath, '--schema-sql', schemaPath]);
    const migrated = new DatabaseSync(databasePath);
    try {
      assert.deepEqual(migrated.prepare('SELECT "id", "ordenLista" FROM "alumnos" WHERE "periodoId" = ? ORDER BY "ordenLista"').all('p1').map((row) => ({ ...row })),
        [{ id: 'a', ordenLista: 1 }, { id: 'b', ordenLista: 2 }]);
      assert.deepEqual(migrated.prepare('SELECT "id", "ordenLista" FROM "alumnos" WHERE "periodoId" = ? ORDER BY "ordenLista"').all('p2').map((row) => ({ ...row })),
        [{ id: 'c', ordenLista: 1 }]);
      assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM "alumnos"').get().count, 3);
      assert.equal(migrated.prepare('PRAGMA index_list("alumnos")').all().some((index) => index.name === 'alumnos_periodoId_ordenLista_idx'), true);
    } finally {
      migrated.close();
    }
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-docente-sqlite.mjs'), '--database', databasePath, '--schema-sql', schemaPath]);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
