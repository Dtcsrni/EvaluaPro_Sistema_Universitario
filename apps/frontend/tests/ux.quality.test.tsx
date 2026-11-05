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
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppAdminNegocio } from '../src/apps/app_admin_negocio/AppAdminNegocio';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { SeccionAlumnos } from '../src/apps/app_docente/SeccionAlumnos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import type { PermisosUI } from '../src/apps/app_docente/tipos';
import { TemaProvider } from '../src/tema/TemaProvider';
import { TooltipLayer } from '../src/ui/ux/tooltip/TooltipLayer';

function renderConTema(ui: ReactNode) {
  return render(<TemaProvider>{ui}</TemaProvider>);
}

describe('UX quality contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('docente sin token muestra acceso guiado y navegacion comprensible', async () => {
    const { container } = renderConTema(<AppDocente />);

    expect(await screen.findByText(/Acceso docente/i)).toBeInTheDocument();
    expect(await screen.findByText(/Plataforma Docente/i)).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: /Beneficios/i })).toBeInTheDocument();
    expect(container.querySelectorAll('svg[data-icono]').length).toBeGreaterThanOrEqual(4);
  });

  it('alumnos informa y permite recuperar el resumen de inasistencias no disponible', async () => {
    vi.spyOn(clienteApi, 'obtener').mockRejectedValue(new Error('Servicio no disponible'));

    renderConTema(
      <SeccionAlumnos
        alumnos={[]}
        periodosActivos={[{ _id: 'periodo-ux', nombre: 'Materia de prueba', activo: true }]}
        periodosTodos={[{ _id: 'periodo-ux', nombre: 'Materia de prueba', activo: true }]}
        onRefrescar={() => {}}
        permisos={{ alumnos: { gestionar: true } } as PermisosUI}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={async () => ({})}
        avisarSinPermiso={() => {}}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/el indicador no está disponible/i);
    expect(screen.getByRole('button', { name: 'Reintentar resumen' })).toBeVisible();
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
    await user.click(await screen.findByRole('button', { name: /Ver guía rápida de configuración/i }));
    expect(await screen.findByText(/Para qué sirve y cómo llenarlo/i)).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Sincronización' }));
    expect(await screen.findByText(/Operaci[oó]n recomendada entre computadoras/i, undefined, { timeout: 10_000 })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label*="Ayuda"]').length).toBeGreaterThanOrEqual(2);
  });

  it('no convierte etiquetas ni ayudas persistentes en placeholders redundantes', () => {
    render(
      <>
        <label>
          <span>Nueva contraseña</span>
          <input type="password" autoComplete="new-password" />
          <span className="ayuda">Usa al menos 8 caracteres.</span>
        </label>
        <label>
          <span>Buscar alumno</span>
          <input type="search" />
        </label>
        <label>
          <span>Correo</span>
          <input type="email" placeholder="nombre@universidad.edu.mx" />
        </label>
        <TooltipLayer />
      </>
    );

    const password = screen.getByLabelText(/Nueva contraseña/);
    const search = screen.getByLabelText('Buscar alumno');
    const email = screen.getByLabelText('Correo');

    expect(password).not.toHaveAttribute('placeholder');
    expect(search).not.toHaveAttribute('placeholder');
    expect(email).toHaveAttribute('placeholder', 'nombre@universidad.edu.mx');
    expect(screen.getByText('Usa al menos 8 caracteres.')).toBeVisible();

    fireEvent.focus(password);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('permite recorrer el tooltip con el puntero y cerrarlo con Escape sin perder el foco', async () => {
    render(
      <>
        <label>
          Nombre de materia
          <input data-tooltip="Escribe el nombre oficial de la asignatura" />
        </label>
        <TooltipLayer />
      </>
    );

    const campo = screen.getByRole('textbox', { name: 'Nombre de materia' });
    campo.focus();
    const tooltip = await screen.findByRole('tooltip');
    expect(campo.getAttribute('aria-describedby')).toContain(tooltip.id);

    fireEvent.mouseOut(campo, { relatedTarget: tooltip });
    expect(tooltip).toBeVisible();

    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(campo);
    expect(campo).not.toHaveAttribute('aria-describedby');
  });

  it('alumno sin token muestra login claro con ayuda contextual y acciones visibles', () => {
    const { container } = renderConTema(<AppAlumno />);

    expect(screen.getByText(/Portal Alumno/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código de acceso$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Matrícula/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Consulta tus resultados/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Qué puedes consultar/i })).toBeInTheDocument();
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
