/**
 * dashboard-pwa-contract
 *
 * Responsabilidad: Validar contrato del manifest PWA del dashboard local.
 * Limites: No prueba desinstalacion del SO; verifica identidad e iconos publicos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

test('dashboard manifest define identidad estable e iconos PNG dedicados', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'dashboard.webmanifest'), 'utf8'));
  const icons = Array.isArray(manifest.icons) ? manifest.icons.map((item) => String(item?.src || '')) : [];

  assert.equal(manifest.id, '/pwa/evaluapro/dashboard-local');
  assert.equal(manifest.start_url, '/#tab=main&source=pwa');
  assert.equal(manifest.x_evaluapro.launcherPreferred, true);
  assert.equal(manifest.x_evaluapro.offlineCapable, false);
  assert.ok(icons.includes('/assets/dashboard-icon-192.png'));
  assert.ok(icons.includes('/assets/dashboard-icon-512.png'));
  assert.ok(icons.includes('/assets/dashboard-icon-maskable-512.png'));
});
