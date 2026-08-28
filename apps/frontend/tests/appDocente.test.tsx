/**
 * appDocente.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas basicas de la app docente.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppDocente', () => {
  it('muestra formulario de acceso cuando no hay token', () => {
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(screen.getByText('Acceso docente')).toBeInTheDocument();
    expect(screen.getByText('Plataforma Docente')).toBeInTheDocument();
  });

  it('muestra panel docente cuando existe token', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
  });

  it('oculta secciones sin permisos', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      permisos: ['periodos:leer', 'cuenta:leer']
    };

    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    expect(within(nav).getByRole('button', { name: 'Materias' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Cuenta' })).toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: 'Banco' })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /Plantillas|Diseño de Exámenes/i })).toBeNull();
  });

  it('permite crear materia sin crashear el render', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const user = userEvent.setup();
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Secciones del portal docente' });
    const tabsMaterias = within(nav).getAllByRole('button', { name: 'Materias' });
    await user.click(tabsMaterias[0]);

    fireEvent.change(screen.getByLabelText('Nombre de la materia'), { target: { value: 'Algebra I' } });
    fireEvent.change(screen.getByLabelText('Fecha inicio'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Fecha fin'), { target: { value: '2026-01-30' } });

    await user.click(screen.getByRole('button', { name: 'Crear materia' }));

    expect(await screen.findByText('Materia creada')).toBeInTheDocument();
  });

  it('permite ingresar desde la pantalla de autenticación y carga el perfil docente', async () => {
    localStorage.removeItem('tokenDocente');
    const user = userEvent.setup();
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'docente@evaluapro.test' } });
    fireEvent.change(screen.getByLabelText(/Contrase[nñ]a/i), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
  });
});
