import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..', '..');

test('el backfill usa la SQLite indicada, pone ambiguos en cuarentena y es idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-reactivos-backfill-'));
  const database = path.join(dir, 'target.db');
  const sentinel = path.join(dir, 'sentinel.db');
  try {
    const legacy = new DatabaseSync(database);
    try {
      legacy.exec(`
        CREATE TABLE docentes (id TEXT PRIMARY KEY, correo TEXT NOT NULL, nombreCompleto TEXT NOT NULL, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        CREATE TABLE periodos (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, nombre TEXT NOT NULL, nombreNormalizado TEXT NOT NULL, fechaInicio TEXT NOT NULL, fechaFin TEXT NOT NULL, grupos TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT 1, archivadoEn TEXT, resumenArchivado TEXT, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        CREATE TABLE banco_preguntas (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, periodoId TEXT NOT NULL, tema TEXT, activo BOOLEAN NOT NULL DEFAULT 1, archivadoEn TEXT, recoverySource TEXT, versionActual INTEGER NOT NULL DEFAULT 1, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        CREATE TABLE version_preguntas (id TEXT PRIMARY KEY, preguntaId TEXT NOT NULL, numeroVersion INTEGER NOT NULL, enunciado TEXT NOT NULL, imagenUrl TEXT, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        CREATE TABLE opcion_preguntas (id TEXT PRIMARY KEY, versionPreguntaId TEXT NOT NULL, texto TEXT NOT NULL, esCorrecta BOOLEAN NOT NULL, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        CREATE TABLE banco_temas (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, periodoId TEXT NOT NULL, nombre TEXT NOT NULL, clave TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT 1, archivadoEn TEXT, createdAt TEXT DEFAULT '2026-01-01T00:00:00.000Z', updatedAt TEXT DEFAULT '2026-01-01T00:00:00.000Z');
        INSERT INTO docentes (id, correo, nombreCompleto) VALUES ('docente-backfill', 'backfill-test@evaluapro.local', 'Backfill Test');
        INSERT INTO periodos (id, docenteId, nombre, nombreNormalizado, fechaInicio, fechaFin, grupos) VALUES ('periodo-backfill', 'docente-backfill', 'Periodo Backfill', 'periodo backfill', '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '["A"]');
        INSERT INTO banco_temas (id, docenteId, periodoId, nombre, clave) VALUES ('tema-backfill', 'docente-backfill', 'periodo-backfill', 'Segundo Parcial', 'segundo parcial');
        INSERT INTO banco_preguntas (id, docenteId, periodoId, tema) VALUES ('pregunta-valida', 'docente-backfill', 'periodo-backfill', 'Segundo Parcial');
        INSERT INTO banco_preguntas (id, docenteId, periodoId, tema) VALUES ('pregunta-ambigua', 'docente-backfill', 'periodo-backfill', 'Tema inexistente');
      `);
      const insertVersion = legacy.prepare('INSERT INTO version_preguntas (id, preguntaId, numeroVersion, enunciado) VALUES (?, ?, 1, ?)');
      const insertOption = legacy.prepare('INSERT INTO opcion_preguntas (id, versionPreguntaId, texto, esCorrecta) VALUES (?, ?, ?, ?)');
      for (const id of ['pregunta-valida', 'pregunta-ambigua']) {
        const versionId = `version-${id}`;
        insertVersion.run(versionId, id, `Enunciado ${id}`);
        ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].forEach((texto, index) => insertOption.run(`opcion-${id}-${index}`, versionId, texto, index === 0 ? 1 : 0));
      }
    } finally {
      legacy.close();
    }
    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'migrate-reactivos-sqlite.mjs'), '--database', database], { cwd: root, windowsHide: true });

    const backfill = path.join(root, 'scripts', 'migrate-reactivos-backfill.mjs');
    const run = () => execFileAsync(process.execPath, [backfill, '--database', database], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: `file:${sentinel.replace(/\\/g, '/')}`, BACKEND_DATABASE_URL: `file:${sentinel.replace(/\\/g, '/')}` },
      windowsHide: true
    });
    const first = JSON.parse((await run()).stdout);
    assert.equal(first.migrados, 1);
    assert.equal(first.cuarentena, 1);
    assert.equal(first.reactivosCuarentena[0].id, 'pregunta-ambigua');
    const second = JSON.parse((await run()).stdout);
    assert.equal(second.migrados, 0);
    assert.equal(second.existentes, 1);
    assert.equal(second.cuarentena, 1);

    const verify = new DatabaseSync(database);
    try {
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM reactivos').get().total, 1);
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM reactivo_versiones').get().total, 1);
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM reactivo_asignaciones').get().total, 1);
      assert.equal(verify.prepare('SELECT legacyPreguntaId FROM reactivos').get().legacyPreguntaId, 'pregunta-valida');
    } finally {
      verify.close();
    }
    assert.equal(fs.existsSync(sentinel), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
