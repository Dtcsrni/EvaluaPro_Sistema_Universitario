/**
 * ux.visual.test
 *
 * Regresion visual ligera por snapshots de pantallas criticas.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

const resultados: Array<{ id: string; estado: 'ok' | 'error'; detalle?: string }> = [];

describe('UX visual regression', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
      })
    });
  });

  it('docente sin token mantiene layout de acceso', () => {
    const { asFragment } = render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );
    expect(screen.getByText(/Acceso docente/i)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
    resultados.push({ id: 'docente-acceso', estado: 'ok' });
  });

  it('alumno sin token mantiene layout de acceso', () => {
    const { asFragment } = render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );
    expect(screen.getByLabelText(/Codigo de acceso/i)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
    resultados.push({ id: 'alumno-acceso', estado: 'ok' });
  });

  it('admin negocio mantiene layout principal', () => {
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
    };
    const { asFragment } = render(
      <TemaProvider>
        <AppAdminNegocio />
      </TemaProvider>
    );
    expect(screen.getByText(/Panel de Negocio EvaluaPro/i)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
    resultados.push({ id: 'admin-negocio-main', estado: 'ok' });
  });
});

afterAll(async () => {
  const reporte = {
    version: '1',
    ejecutadoEn: new Date().toISOString(),
    suite: 'ux.visual',
    snapshots: resultados
  };
  const out = path.resolve(process.cwd(), 'reports/qa/latest/ux-visual.json');
  const directory = path.dirname(out);
  const temporary = path.join(directory, `.ux-visual.${process.pid}.${Date.now()}.tmp`);
  const payload = `${JSON.stringify(reporte, null, 2)}\n`;
  await fs.mkdir(directory, { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await fs.writeFile(temporary, payload, 'utf8');
      await fs.rm(out, { force: true });
      await fs.rename(temporary, out);
      break;
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
});
