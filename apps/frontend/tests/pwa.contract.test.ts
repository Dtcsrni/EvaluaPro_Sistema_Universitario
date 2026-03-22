/**
 * pwa.contract
 *
 * Responsabilidad: Validar contrato de manifests y estado observable PWA.
 * Limites: No prueba instalacion real del SO; verifica identidad y runtime web.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(process.cwd());

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

describe('PWA frontend contracts', () => {
  it('manifests docente y alumno tienen identidad estable e iconos PNG reales', () => {
    const docente = readJson('public/manifest-docente.webmanifest');
    const alumno = readJson('public/manifest-alumno.webmanifest');

    expect(docente.id).toBe('/pwa/evaluapro/docente');
    expect(alumno.id).toBe('/pwa/evaluapro/alumno');
    expect(docente.id).not.toBe(alumno.id);
    expect(docente.x_evaluapro.destino).toBe('docente');
    expect(alumno.x_evaluapro.destino).toBe('alumno');

    const docenteIcons = docente.icons.map((item: { src: string }) => item.src);
    const alumnoIcons = alumno.icons.map((item: { src: string }) => item.src);
    expect(docenteIcons).toContain('/pwa-docente-192.png');
    expect(docenteIcons).toContain('/pwa-docente-512.png');
    expect(docenteIcons).toContain('/pwa-docente-maskable-512.png');
    expect(alumnoIcons).toContain('/pwa-alumno-192.png');
    expect(alumnoIcons).toContain('/pwa-alumno-512.png');
    expect(alumnoIcons).toContain('/pwa-alumno-maskable-512.png');
  });

  it('publica estado observable y sincroniza recursos PWA del destino activo', async () => {
    vi.resetModules();
    document.head.innerHTML = `
      <link id="app-manifest" rel="manifest" href="/manifest-docente.webmanifest" />
      <link id="app-favicon" rel="icon" href="/favicon-docente.svg" />
      <link id="app-apple-touch" rel="apple-touch-icon" href="/pwa-docente-192.png" />
    `;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: browser)' ? false : false,
        media: query,
        addEventListener() {},
        removeEventListener() {}
      }))
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn(async () => [])
      }
    });

    vi.stubGlobal('caches', {
      keys: vi.fn(async () => [])
    });

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('manifest-docente.webmanifest')) {
        return {
          ok: true,
          json: async () => readJson('public/manifest-docente.webmanifest')
        };
      }
      return { ok: true, json: async () => ({}) };
    }));

    const modulo = await import('../src/pwa');
    await modulo.inicializarPwa();

    expect(document.querySelector('#app-manifest')?.getAttribute('href')).toBe('/manifest-docente.webmanifest');
    expect(document.querySelector('#app-favicon')?.getAttribute('href')).toBe('/favicon-docente.svg');
    expect(document.querySelector('#app-apple-touch')?.getAttribute('href')).toBe('/pwa-docente-192.png');
    expect(window.__EVALUAPRO_PWA__?.manifestId).toBe('/pwa/evaluapro/docente');
    expect(document.documentElement.dataset.pwaMode).toBe('browser');
    expect(document.documentElement.dataset.pwaLegacy).toBe('0');
  });
});
