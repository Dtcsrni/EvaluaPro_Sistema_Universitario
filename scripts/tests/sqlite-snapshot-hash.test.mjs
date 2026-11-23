import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getSqliteSnapshotSha256 } from './sqlite-snapshot-hash.mjs';

const require = createRequire(path.join(path.resolve('apps/backend'), 'package.json'));
const Database = require('better-sqlite3');

test('SQLite snapshot hash reads a coherent copy while the application connection remains open', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'evaluapro-sqlite-snapshot-test-'));
  const databasePath = path.join(directory, 'evaluapro.db');
  const applicationConnection = new Database(databasePath);
  try {
    applicationConnection.pragma('journal_mode = WAL');
    applicationConnection.exec('CREATE TABLE qa_marker (value TEXT NOT NULL)');
    applicationConnection.prepare('INSERT INTO qa_marker (value) VALUES (?)').run('before');

    const before = await getSqliteSnapshotSha256(databasePath);
    assert.match(before, /^[a-f0-9]{64}$/);
    assert.equal(await getSqliteSnapshotSha256(databasePath), before);

    applicationConnection.prepare('UPDATE qa_marker SET value = ?').run('after');
    const after = await getSqliteSnapshotSha256(databasePath);
    assert.notEqual(after, before);
  } finally {
    applicationConnection.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
