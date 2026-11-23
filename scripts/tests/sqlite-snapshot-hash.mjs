import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createReadStream, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/backend'), 'package.json'));
const Database = require('better-sqlite3');

export async function getSqliteSnapshotSha256(databasePath) {
  const sourcePath = path.resolve(databasePath);
  const snapshotPath = path.join(os.tmpdir(), `evaluapro-sqlite-snapshot-${randomUUID()}.db`);
  const database = new Database(sourcePath, { readonly: true, fileMustExist: true, timeout: 15000 });
  try {
    await database.backup(snapshotPath);
  } finally {
    database.close();
  }

  try {
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(snapshotPath)) digest.update(chunk);
    return digest.digest('hex');
  } finally {
    for (const suffix of ['', '-wal', '-shm']) {
      const artifact = `${snapshotPath}${suffix}`;
      if (existsSync(artifact)) unlinkSync(artifact);
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const databasePath = process.argv[2];
  if (!databasePath) {
    process.stderr.write('Uso: node sqlite-snapshot-hash.mjs <database-path>\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${await getSqliteSnapshotSha256(databasePath)}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
