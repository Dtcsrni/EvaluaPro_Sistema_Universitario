/**
 * appDocente.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas basicas de la app docente.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('recupera OAuth Desktop tras un fallo temporal en la primera consulta de capacidades', async () => {
    localStorage.removeItem('tokenDocente');
    let consultasCapacidades = 0;
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown, ok = true, status = 200) => ({ ok, status, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/capacidades-integraciones')) {
        consultasCapacidades += 1;
        if (consultasCapacidades === 1) return json({ error: 'API iniciando' }, false, 503);
        return json({ capacidadesIntegraciones: { oauthGoogleDesktopBackend: true, passwordLoginAllowed: false, requireGoogleOAuth: true } });
      }
      return json({});
    });

    render(<TemaProvider><AppDocente /></TemaProvider>);

    expect(await screen.findByRole('button', { name: 'Acceder con Google' })).toBeInTheDocument();
    expect(consultasCapacidades).toBeGreaterThanOrEqual(2);
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

  it('conecta el reintento de materias en la sección Alumnos con la consulta del catálogo', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    let lecturasMateriasActivas = 0;
    let lecturasAlumnos = 0;
    let catalogoDisponible = false;
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown, ok = true, status = 200) => ({ ok, status, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/perfil')) return json({ docente: {
        id: 'docente-dummy', nombreCompleto: 'Docente de prueba', correo: 'docente@local.test', roles: ['docente'],
        permisos: ['periodos:leer', 'alumnos:leer']
      } });
      if (url.includes('/autenticacion/capacidades-integraciones')) return json({ capacidadesIntegraciones: { passwordLoginAllowed: true } });
      if (url.includes('/periodos?activo=1')) {
        lecturasMateriasActivas += 1;
        return catalogoDisponible
          ? json({ periodos: [] })
          : json({ mensaje: 'Catálogo temporalmente no disponible' }, false, 503);
      }
      if (url.includes('/periodos?activo=0')) return json({ periodos: [] });
      if (url.endsWith('/alumnos')) {
        lecturasAlumnos += 1;
        return json({ alumnos: [] });
      }
      return json({});
    });

    render(<TemaProvider><AppDocente /></TemaProvider>);
    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Alumnos' }));

    expect(await screen.findByRole('heading', { name: 'Alumnos' })).toBeInTheDocument();
    expect(lecturasMateriasActivas).toBeGreaterThan(0);
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent('No se pudo cargar el catálogo de materias.');
    expect(screen.queryByRole('heading', { name: 'Comienza seleccionando una materia' })).not.toBeInTheDocument();
    const lecturasAntesDelReintento = lecturasMateriasActivas;
    const lecturasAlumnosAntesDelReintento = lecturasAlumnos;
    catalogoDisponible = true;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    expect(await screen.findByRole('heading', { name: 'Comienza seleccionando una materia' })).toBeInTheDocument();
    expect(lecturasMateriasActivas).toBeGreaterThan(lecturasAntesDelReintento);
    expect(lecturasAlumnos).toBe(lecturasAlumnosAntesDelReintento);
  });

  it('contextualiza el recordatorio y mantiene el anuncio separado de sus controles', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/perfil')) return json({ docente: {
        id: 'docente-dummy', nombreCompleto: 'Docente de prueba', correo: 'docente@local.test', roles: ['docente'],
        permisos: ['periodos:leer', 'asistencias:leer']
      } });
      if (url.includes('/periodos?activo=1')) return json({ periodos: [{ _id: 'periodo-dummy', nombre: 'Grupo de prueba', grupos: ['A'] }] });
      if (url.includes('/asistencias/sesiones?periodoId=periodo-dummy')) return json({ sesiones: [] });
      return json({});
    });

    render(<TemaProvider><AppDocente /></TemaProvider>);

    const status = await screen.findByRole('status');
    expect(status.tagName).toBe('SPAN');
    expect(status).toHaveTextContent('Pase de lista pendiente hoy.');
    expect(status.querySelector('button, summary')).toBeNull();

    const banner = status.closest('.banner-recordatorio-asistencia');
    expect(banner).not.toBeNull();
    expect(within(banner as HTMLElement).getByRole('button', { name: 'Pasar lista' })).toBeInTheDocument();
    expect(within(banner as HTMLElement).getByRole('button', { name: 'Cerrar recordatorio' })).toBeInTheDocument();

    fireEvent.change(document.getElementById('navegacion-docente-movil')!, { target: { value: 'asistencias' } });
    await waitFor(() => expect(status).toHaveTextContent('Pase de lista pendiente. Aún no has pasado lista hoy.'));
  });

  it('distingue el fallo inicial del buzón y reintenta solo la lectura de solicitudes', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    let lecturasSolicitudes = 0;
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown, ok = true, status = 200) => ({ ok, status, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/perfil')) return json({ docente: {
        id: 'docente-dummy', nombreCompleto: 'Docente de prueba', correo: 'docente@local.test', roles: ['docente'],
        permisos: ['calificaciones:calificar', 'omr:analizar', 'periodos:leer', 'alumnos:leer']
      } });
      if (url.includes('/autenticacion/capacidades-integraciones')) return json({ capacidadesIntegraciones: { passwordLoginAllowed: true } });
      if (url.includes('/calificaciones/revision/solicitudes/sincronizar')) return json({});
      if (url.endsWith('/calificaciones/revision/solicitudes')) {
        lecturasSolicitudes += 1;
        if (lecturasSolicitudes === 1 || lecturasSolicitudes === 3 || lecturasSolicitudes === 4) {
          return json({ mensaje: 'API temporalmente no disponible' }, false, 500);
        }
        return json({ solicitudes: [{
          _id: 'solicitud-dummy', externoId: 'externo-dummy', folio: 'F-001', numeroPregunta: 2,
          estado: 'pendiente', comentario: 'Revisar respuesta del reactivo.'
        }] });
      }
      return json({});
    });

    render(<TemaProvider><AppDocente /></TemaProvider>);
    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Calificaciones' }));
    await waitFor(() => expect(lecturasSolicitudes).toBeGreaterThan(0));
    await userEvent.click(await screen.findByRole('button', { name: /Revisión y captura/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar carga de solicitudes' })).toBeInTheDocument();
    expect(screen.queryByText('Sin solicitudes pendientes de revisión.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pendientes: 0/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar carga de solicitudes' }));
    expect(await screen.findByText('Folio F-001 · Pregunta 2')).toBeInTheDocument();
    expect(lecturasSolicitudes).toBe(2);
    expect(fetchMock.mock.calls.some(([request]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
      return url.includes('/calificaciones/revision/solicitudes/sincronizar');
    })).toBe(false);

    await userEvent.click(within(nav).getByRole('button', { name: 'Materias' }));
    await userEvent.click(within(nav).getByRole('button', { name: 'Calificaciones' }));
    await waitFor(() => expect(lecturasSolicitudes).toBe(3));
    await userEvent.click(await screen.findByRole('button', { name: /Revisión y captura/ }));
    expect(await screen.findByText(/Se conserva la última lista cargada/)).toBeInTheDocument();
    expect(screen.getByText('Folio F-001 · Pregunta 2')).toBeInTheDocument();
    expect(screen.getByText('Pendientes: 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sincronizar solicitudes' }));
    await waitFor(() => expect(lecturasSolicitudes).toBe(4));
    expect(await screen.findByText(/Solicitudes sincronizadas, pero no se pudo actualizar la lista/)).toBeInTheDocument();
    expect(screen.getByText('Folio F-001 · Pregunta 2')).toBeInTheDocument();
    expect(screen.queryByText(/No se pudieron sincronizar/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([request, init]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url;
      return url.includes('/calificaciones/revision/solicitudes/sincronizar') && init?.method === 'POST';
    })).toHaveLength(1);
  });

  it('resuelve una solicitud con éxito aunque falle la lectura posterior, conservando el estado del servidor', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    let lecturasSolicitudes = 0;
    let sincronizaciones = 0;
    let resoluciones = 0;
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const json = (payload: unknown, ok = true, status = 200) => ({ ok, status, json: async () => payload, blob: async () => new Blob() });
      if (url.includes('/autenticacion/perfil')) return json({ docente: {
        id: 'docente-dummy', nombreCompleto: 'Docente de prueba', correo: 'docente@local.test', roles: ['docente'],
        permisos: ['calificaciones:calificar', 'omr:analizar', 'periodos:leer', 'alumnos:leer']
      } });
      if (url.includes('/autenticacion/capacidades-integraciones')) return json({ capacidadesIntegraciones: { passwordLoginAllowed: true } });
      if (url.includes('/calificaciones/revision/solicitudes/sincronizar')) {
        sincronizaciones += 1;
        return json({});
      }
      if (url.includes('/calificaciones/revision/solicitudes/solicitud-dummy/resolver')) {
        resoluciones += 1;
        return json({ solicitud: {
          _id: 'solicitud-dummy', externoId: 'externo-dummy', folio: 'F-001', numeroPregunta: 2,
          estado: 'atendida', comentario: 'Revisar respuesta del reactivo.', respuestaDocente: 'Se revisó el desarrollo.'
        } });
      }
      if (url.endsWith('/calificaciones/revision/solicitudes')) {
        lecturasSolicitudes += 1;
        if (lecturasSolicitudes === 2) return json({ mensaje: 'Fallo de lectura simulado' }, false, 500);
        return json({ solicitudes: [
          {
            _id: 'solicitud-dummy', externoId: 'externo-dummy', folio: 'F-001', numeroPregunta: 2,
            estado: 'pendiente', comentario: 'Revisar respuesta del reactivo.'
          },
          {
            _id: 'solicitud-dummy-2', externoId: 'externo-dummy-2', folio: 'F-002', numeroPregunta: 5,
            estado: 'pendiente', comentario: 'Revisar el criterio de este reactivo.'
          }
        ] });
      }
      return json({});
    });

    render(<TemaProvider><AppDocente /></TemaProvider>);
    const nav = await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Calificaciones' }));
    await userEvent.click(await screen.findByRole('button', { name: /Revisión y captura/ }));
    const respuesta = screen.getByRole('textbox', { name: 'Respuesta para el alumno, folio F-001, pregunta 2' });
    const segundaRespuesta = screen.getByRole('textbox', { name: 'Respuesta para el alumno, folio F-002, pregunta 5' });
    expect(screen.getByRole('button', { name: 'Marcar atendida, folio F-001, pregunta 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar atendida, folio F-002, pregunta 5' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar, folio F-001, pregunta 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar, folio F-002, pregunta 5' })).toBeDisabled();
    expect(segundaRespuesta).toBeRequired();
    const ayudaRespuesta = within(respuesta.closest('.campo') as HTMLElement).getByText('Obligatoria. Escribe al menos 8 caracteres; se enviará al alumno.');
    expect(respuesta).toBeRequired();
    expect(respuesta).toHaveAttribute('aria-describedby', ayudaRespuesta.id);
    await userEvent.type(respuesta, 'Se revisó el desarrollo.');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar atendida, folio F-001, pregunta 2' }));

    expect(await screen.findByText('Solicitud atendida correctamente.')).toBeInTheDocument();
    expect(await screen.findByText(/No se pudieron actualizar las solicitudes/)).toBeInTheDocument();
    expect(screen.getByText('atendida')).toBeInTheDocument();
    expect(resoluciones).toBe(1);
    expect(lecturasSolicitudes).toBe(2);
    expect(sincronizaciones).toBe(0);
  });

  it('muestra el avatar docente neutral y la versión real del bundle sin la etiqueta OMR', async () => {
    localStorage.setItem('tokenDocente', 'token-falso');
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('navigation', { name: 'Secciones del portal docente' });
    expect(screen.getByRole('button', { name: /Versión v.*Abrir información de versión/i }))
      .toHaveAccessibleName(new RegExp(`Versión v${obtenerVersionTecnicaApp()}\\. Abrir información de versión`, 'i'));
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
    (globalThis as typeof globalThis & { __TEST_DOCENTE__?: Record<string, unknown> }).__TEST_DOCENTE__ = {
      id: '1',
      nombreCompleto: 'Docente A'
    };
    render(<TemaProvider><AppDocente /></TemaProvider>);

    await screen.findByRole('button', { name: 'Abrir perfil docente de Docente A' });
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
        detail: { docenteId: '1', foto: 'data:image/png;base64,aGVsbG8=' }
      }));
    });
    await waitFor(() => expect(document.querySelector('.chip-docente-avatar img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8='));

    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
        detail: { docenteId: 'otro-docente', foto: 'data:image/png;base64,b3Rybw==' }
      }));
    });
    expect(document.querySelector('.chip-docente-avatar img')).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=');

    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_FOTO_PERFIL_DOCENTE, {
        detail: { docenteId: '1', foto: null }
      }));
    });
    expect(document.querySelector('.chip-docente-avatar img')).toBeNull();
    expect(document.querySelector('.chip-docente-avatar [data-icono="cuenta"]')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /Versión v.*Abrir información de versión/i }));
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
    for (const grupo of ['Academia', 'Evaluación', 'Operación']) {
      expect(within(nav).getByText(grupo)).not.toHaveAttribute('aria-hidden', 'true');
    }
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
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Fecha de término'), { target: { value: '2026-01-30' } });

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

    const mostrarAccesoCorreo = screen.queryByRole('button', { name: /Ingresar con correo y contraseña/i });
    if (mostrarAccesoCorreo) await user.click(mostrarAccesoCorreo);
    fireEvent.change(await screen.findByLabelText(/^Correo/), { target: { value: 'docente@evaluapro.test' } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: '12345678' } });

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
      const mostrarAccesoCorreo = screen.queryByRole('button', { name: /Ingresar con correo y contraseña/i });
      if (mostrarAccesoCorreo) await user.click(mostrarAccesoCorreo);
      await user.type(await screen.findByLabelText(/^Correo/), 'docente@evaluapro.test');
      await user.type(screen.getByLabelText(/^Contraseña/), '12345678');
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
