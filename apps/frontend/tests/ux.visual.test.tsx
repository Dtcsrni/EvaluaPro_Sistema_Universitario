/**
 * ux.visual.test
 *
 * Regresion visual ligera por snapshots de pantallas criticas.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

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

  it('docente sin token mantiene layout de acceso', async () => {
    const { asFragment } = render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );
    expect(await screen.findByText(/Acceso docente/i)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it('alumno sin token mantiene layout de acceso', () => {
    const { asFragment } = render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );
    expect(screen.getByLabelText(/Codigo de acceso/i)).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
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
  });
});
