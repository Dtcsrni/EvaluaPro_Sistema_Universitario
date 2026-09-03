import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'packaging', 'app-host', 'MainWindow.xaml.cs'), 'utf8');

test('AppHost no declara lista la ventana si solo responde el servidor web', () => {
  assert.match(source, /apiHealthUrl\s*=\s*"http:\/\/127\.0\.0\.1:4000\/api\/salud"/);
  assert.match(source, /ProbePortAsync\(webHealthUrl\)\s*&&\s*await ProbePortAsync\(apiHealthUrl\)/);
  assert.match(source, /RequestDashboardReconcileAsync/);
  assert.match(source, /api\/lifecycle\/reconcile/);
});
