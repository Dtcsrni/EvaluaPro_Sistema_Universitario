/**
 * appDocente.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas basicas de la app docente.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppDocente } from '../src/apps/app_docente/AppDocente';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppDocente', () => {
  it('muestra formulario de acceso cuando no hay token', async () => {
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(await screen.findByText('Acceso docente')).toBeInTheDocument();
    expect(screen.getByText('Plataforma Docente')).toBeInTheDocument();
  });

  it('muestra panel docente cuando existe token', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    expect(screen.queryByText('Acceso docente')).toBeNull();
    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
  });

  it('abre la cuenta desde el control de identidad del encabezado', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const user = userEvent.setup();
    render(
      <TemaProvider>
        <AppDocente />
      </TemaProvider>
    );

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    const controlCuenta = screen.getByRole('button', { name: /Abrir perfil docente de Docente/i });
    await user.click(controlCuenta);

    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    expect(within(nav).getByRole('button', { name: 'Cuenta' })).toHaveAttribute('aria-current', 'page');
  });

  it('adquiere el lease al configurar la carpeta después de iniciar sesión', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown) => ({ ok: true, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/perfil')) return json({ docente: { id: 'doc-1', nombreCompleto: 'Docente', correo: 'docente@local.test', permisos: ['cuenta:leer', 'cuenta:actualizar', 'sincronizacion:listar', 'sincronizacion:importar'] } });
      if (url.includes('/autenticacion/capacidades-integraciones')) return json({ capacidadesIntegraciones: { passwordLoginAllowed: true } });
      if (url.includes('/sincronizaciones/local/lease') && !url.includes('/adquirir')) return json({ configurado: false, proveedor: 'carpeta-sincronizada', ttlMs: 60_000, modo: 'disponible' });
      if (url.includes('/sincronizaciones/local/configuracion/carpeta')) return json({ configurado: true, directorio: 'C:\\Users\\docente\\OneDrive\\EvaluaPro', origen: 'docente', proveedor: 'carpeta-sincronizada', ttlMs: 60_000, modo: 'disponible' });
      if (url.includes('/sincronizaciones/local/lease/adquirir')) return json({ ttlMs: 60_000, lease: { leaseId: 'lease-test-12345678', equipoId: 'equipo-test-123456', adquiridoEn: new Date().toISOString(), ultimoHeartbeatEn: new Date().toISOString(), expiraEn: new Date(Date.now() + 60_000).toISOString(), propio: true } });
      return json({});
    });

    const user = userEvent.setup();
    render(<TemaProvider><AppDocente /></TemaProvider>);
    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await user.click(screen.getByRole('button', { name: /Abrir perfil docente de Docente/i }));
    const input = await screen.findByLabelText(/Carpeta local sincronizada por OneDrive/i);
    fireEvent.change(input, { target: { value: 'C:\\Users\\docente\\OneDrive\\EvaluaPro' } });
    await user.click(screen.getByRole('button', { name: /Guardar carpeta/i }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([request, options]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
      return url.includes('/sincronizaciones/local/lease/adquirir') && options?.method === 'POST';
    })).toBe(true));
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
    await user.click(screen.getByRole('button', { name: /Mostrar formulario/i }));

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

    fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: 'docente@evaluapro.test' } });
    fireEvent.change(screen.getByLabelText(/Contrase[nñ]a/i), { target: { value: '12345678' } });

    const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
    await user.click(botonesIngresar[botonesIngresar.length - 1]);

    expect(await screen.findByRole('navigation', { name: 'Secciones del portal docente' })).toBeInTheDocument();
  });
});
