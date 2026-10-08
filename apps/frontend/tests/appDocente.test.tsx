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
import { EVENTO_FOTO_PERFIL_DOCENTE, guardarFotoPerfilLocal } from '../src/apps/app_docente/fotoPerfilDocente';
import { TemaProvider } from '../src/tema/TemaProvider';
import { obtenerVersionTecnicaApp } from '../src/ui/version/versionInfo';

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

  it('muestra el avatar docente neutral y la versión real del bundle sin la etiqueta OMR', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    expect(screen.getByRole('button', { name: `Versión ${obtenerVersionTecnicaApp()}` })).toBeInTheDocument();
    expect(document.querySelector('.chip-docente-avatar [data-icono="cuenta"]')).toBeInTheDocument();
    expect(document.querySelector('.chip-omr-contract')).toBeNull();
  });

  it('prioriza la imagen de perfil local por docente', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    guardarFotoPerfilLocal('1', 'data:image/png;base64,aGVsbG8=');
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8='));
    expect(document.querySelector('.chip-docente-avatar [data-icono="cuenta"]')).toBeNull();
  });

  it('actualiza el avatar cuando cambia la foto local del docente actual', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
      detail: { docenteId: '1', foto: 'data:image/png;base64,aGVsbG8=' }
    }));
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8='));
  });

  it('vuelve al avatar neutral si falla la imagen local', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    guardarFotoPerfilLocal('1', 'data:image/png;base64,aGVsbG8=');
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar img')).toBeInTheDocument());
    fireEvent.error(document.querySelector('.chip-docente-avatar img') as HTMLImageElement);
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar [data-icono="cuenta"]')).toBeInTheDocument());
  });

  it('abre la información técnica desde la versión del shell', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await user.click(screen.getByRole('button', { name: `Versión ${obtenerVersionTecnicaApp()}` }));
    expect(abrir).toHaveBeenCalledOnce();
    abrir.mockRestore();
  });

  it('prioriza la imagen vinculada a la cuenta sobre la imagen local', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    guardarFotoPerfilLocal('1', 'data:image/png;base64,aGVsbG8=');
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      imagenPerfil: 'https://cuenta.example/foto.png'
    };
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar img')).toHaveAttribute('src', 'https://cuenta.example/foto.png'));
  });

  it('vuelve al avatar docente si la imagen de perfil de cuenta falla al cargar', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      imagenPerfil: 'https://cuenta.example/foto.png'
    };
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    fireEvent.error(document.querySelector('.chip-docente-avatar img') as HTMLImageElement);
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar [data-icono="cuenta"]')).toBeInTheDocument());
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

  it('registra perfil_rechazado y muestra toast cuando falla validar la sesión emitida', async () => {
    localStorage.removeItem('tokenDocente');
    const flowId = '123e4567-e89b-42d3-a456-426614174000';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(flowId);
    const eventosToast: Array<{ detail?: Record<string, unknown> }> = [];
    const escucharToast = (event: Event) => eventosToast.push(event as CustomEvent<Record<string, unknown>>);
    window.addEventListener('app:toast', escucharToast);
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown, ok = true, status = 200) => ({ ok, status, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/ingresar')) return json({ token: 'token-profile-fail' });
      if (url.includes('/autenticacion/perfil')) return json({ mensaje: 'perfil no disponible' }, false, 400);
      if (url.includes('/autenticacion/capacidades-integraciones')) return json({ capacidadesIntegraciones: { passwordLoginAllowed: true } });
      if (url.includes('/salud')) return json({ tiempoActivo: 1 });
      return json({});
    });
    try {
      const user = userEvent.setup();
      render(<TemaProvider><AppDocente /></TemaProvider>);
      await user.type(await screen.findByLabelText('Correo'), 'docente@evaluapro.test');
      await user.type(screen.getByLabelText(/Contrase[nñ]a/i), '12345678');
      const botonesIngresar = screen.getAllByRole('button', { name: /^Ingresar$/i });
      await user.click(botonesIngresar[botonesIngresar.length - 1]);

      await waitFor(() => {
        const eventos = JSON.parse(localStorage.getItem('evaluapro.auth.trace.v1') || '[]');
        expect(eventos).toEqual(expect.arrayContaining([expect.objectContaining({
          flowId, canal: 'sesion', etapa: 'perfil_rechazado', resultado: 'error', codigo: 'PROFILE_VALIDATION_FAILED'
        })]));
      });
      expect(localStorage.getItem('tokenDocente')).toBe('token-profile-fail');
      expect(eventosToast).toEqual(expect.arrayContaining([expect.objectContaining({
        detail: expect.objectContaining({ title: 'Sesion no validada', message: 'La sesión se guardó, pero no se pudo validar el perfil con la API.' })
      })]));
    } finally {
      window.removeEventListener('app:toast', escucharToast);
    }
  });
});
