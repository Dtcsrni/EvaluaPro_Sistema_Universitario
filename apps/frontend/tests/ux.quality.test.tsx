/**
 * ux.quality.test
 *
 * Gate de calidad UX contractual para pantallas criticas.
 * Este suite evita regresiones silenciosas en:
 * - ayudas contextuales
 * - navegacion entendible
 * - uso consistente de iconografia
 * - accesibilidad basica (labels/landmarks)
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

function renderConTema(ui: ReactNode) {
  return render(<TemaProvider>{ui}</TemaProvider>);
}

describe('UX quality contract', () => {
  it('docente sin token muestra acceso guiado y navegacion comprensible', () => {
    const { container } = renderConTema(<AppDocente />);

    expect(screen.getByText(/Acceso docente/i)).toBeInTheDocument();
    expect(screen.getByText(/Plataforma Docente/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Beneficios/i })).toBeInTheDocument();
    expect(container.querySelectorAll('svg[data-icono]').length).toBeGreaterThanOrEqual(4);
  });

  it('docente con token mantiene tabs con iconografia y ayudas por seccion critica', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const user = userEvent.setup();
    const { container } = renderConTema(<AppDocente />);

    const nav = await screen.findByRole('navigation', { name: /Secciones del portal docente/i });
    const botones = within(nav).getAllByRole('button');
    expect(botones.length).toBeGreaterThanOrEqual(5);
    for (const boton of botones) {
      expect(boton.querySelector('svg[data-icono]')).not.toBeNull();
    }

    await user.click(within(nav).getByRole('button', { name: 'Materias' }));
    expect(await screen.findByText(/Para que sirve y como llenarlo/i)).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Sincronización' }));
    expect(await screen.findByText(/Operacion recomendada entre computadoras/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label*="Ayuda"]').length).toBeGreaterThanOrEqual(2);
  });

  it('alumno sin token muestra login claro con ayuda contextual y acciones visibles', () => {
    const { container } = renderConTema(<AppAlumno />);

    expect(screen.getByText(/Portal Alumno/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Codigo de acceso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Matricula/i)).toBeInTheDocument();
    expect(screen.getByText(/Como consultar sin errores/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consultar/i })).toBeInTheDocument();
    expect(container.querySelectorAll('svg[data-icono]').length).toBeGreaterThanOrEqual(4);
  });

  it('admin negocio con permisos muestra ayuda contextual y navegación entendible', async () => {
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
    };

    renderConTema(<AppAdminNegocio />);

    expect(await screen.findByText(/Panel de Negocio EvaluaPro/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Vistas del panel de negocio/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ayuda: Cómo operar/i)).toBeInTheDocument();
    expect(screen.getByText(/Usa los datos crudos como evidencia operativa/i)).toBeInTheDocument();
  });
});
