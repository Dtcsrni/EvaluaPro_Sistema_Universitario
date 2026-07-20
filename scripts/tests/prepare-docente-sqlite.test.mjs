/** Contrato de bootstrap SQLite idempotente para repair/update nativo. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
    await execFileAsync(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(${JSON.stringify(database)});d.exec("INSERT INTO docentes(id,correo) VALUES ('d1','docente@example.test')");d.close();`]);
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-docente-sqlite.mjs'), '--database', database, '--schema-sql', schema]);
    const check = await execFileAsync(process.execPath, ['-e', `const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(${JSON.stringify(database)});console.log(d.prepare("SELECT count(*) AS c FROM docentes").get().c);d.close();`]);
    assert.equal(check.stdout.trim(), '1');
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
