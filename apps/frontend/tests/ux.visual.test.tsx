/**
 * ux.visual.test
 *
 * Regresion visual ligera por snapshots de pantallas criticas.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
});

afterAll(async () => {
  const reporte = {
    version: '1',
    ejecutadoEn: new Date().toISOString(),
    suite: 'ux.visual',
    snapshots: resultados
  };
  const out = path.resolve(process.cwd(), 'reports/qa/latest/ux-visual.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');
});
