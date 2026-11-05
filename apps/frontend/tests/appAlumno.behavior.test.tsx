/**
 * appAlumno.behavior.test
 *
 * Responsabilidad: cubrir los flujos principales del portal alumno.
 * Limites: preservar el contrato visible del login, detalle, revisión y sesión.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemaProvider } from '../src/tema/TemaProvider';

const mocks = vi.hoisted(() => ({
  portalMock: {
    enviar: vi.fn(),
    obtener: vi.fn(),
    registrarEventosUso: vi.fn(async () => ({}))
  },
  emitToastMock: vi.fn(),
  accionCerrarSesionMock: vi.fn(() => undefined),
  accionToastSesionParaErrorMock: vi.fn(() => undefined),
  mensajeUsuarioDeErrorConSugerenciaMock: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback
  ),
  obtenerSessionIdMock: vi.fn(() => 'sesion-alumno-test'),
  abrirVentanaVersionMock: vi.fn(),
  windowOpenMock: vi.fn(() => null),
  sesionInvalidadaHandler: null as ((tipo: 'docente' | 'alumno') => void) | null
}));

vi.mock('../src/servicios_api/clientePortal', () => ({
  crearClientePortal: () => mocks.portalMock,
  guardarTokenAlumno: (token: string) => localStorage.setItem('tokenAlumno', token),
  limpiarTokenAlumno: () => localStorage.removeItem('tokenAlumno'),
  obtenerTokenAlumno: () => localStorage.getItem('tokenAlumno')
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: mocks.emitToastMock
}));

vi.mock('../src/ui/version/versionInfo', () => ({
  abrirVentanaVersion: mocks.abrirVentanaVersionMock,
  obtenerVersionApp: () => '1.0.0b'
}));

vi.mock('../src/ui/ux/sesion', () => ({
  obtenerSessionId: mocks.obtenerSessionIdMock
}));

vi.mock('../src/servicios_api/clienteComun', () => ({
  accionCerrarSesion: mocks.accionCerrarSesionMock,
  accionToastSesionParaError: mocks.accionToastSesionParaErrorMock,
  mensajeUsuarioDeErrorConSugerencia: mocks.mensajeUsuarioDeErrorConSugerenciaMock,
  onSesionInvalidada: (handler: (tipo: 'docente' | 'alumno') => void) => {
    mocks.sesionInvalidadaHandler = handler;
    return () => {
      mocks.sesionInvalidadaHandler = null;
    };
  }
}));

import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';

function renderConTema() {
  return render(
    <TemaProvider>
      <AppAlumno />
    </TemaProvider>
  );
}

describe('AppAlumno behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.sesionInvalidadaHandler = null;
    mocks.portalMock.enviar.mockReset();
    mocks.portalMock.obtener.mockReset();
    mocks.portalMock.registrarEventosUso.mockResolvedValue({});
    mocks.accionToastSesionParaErrorMock.mockReturnValue(undefined);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
      json: async () => ({}),
      text: async () => '',
      headers: new Headers()
    } as unknown as Response);
    vi.stubGlobal(
      'URL',
      {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:pdf-test')
      } as unknown as typeof URL
    );
    vi.spyOn(window, 'open').mockImplementation(mocks.windowOpenMock);
  });

  it('permite ingresar, cargar contexto académico, abrir detalle, solicitar revisión, registrar conformidad y abrir PDF', async () => {
    let liberarConformidad: (() => void) | undefined;
    let rechazarConformidad: (() => void) | undefined;
    let liberarRevision: (() => void) | undefined;
    let rechazarRevision: (() => void) | undefined;
    let intentosSolicitudRevision = 0;
    let intentosConformidad = 0;
    let liberarPdf: (() => void) | undefined;
    mocks.portalMock.enviar.mockImplementation(async (ruta: string) => {
      if (ruta === '/ingresar') return { token: 'token-alumno-valido' };
      if (ruta === '/solicitudes-revision') {
        intentosSolicitudRevision += 1;
        return new Promise((resolve, reject) => {
          if (intentosSolicitudRevision === 1) rechazarRevision = () => reject(new Error('Revisión no disponible'));
          else liberarRevision = () => resolve({ ok: true });
        });
      }
      if (ruta === '/solicitudes-revision/conformidad') {
        intentosConformidad += 1;
        if (intentosConformidad === 1) {
          return new Promise((_, reject) => { rechazarConformidad = () => reject(new Error('Conformidad no disponible')); });
        }
        return new Promise((resolve) => { liberarConformidad = () => resolve({ ok: true }); });
      }
      return { ok: true };
    });
    vi.mocked(global.fetch).mockImplementation(() => new Promise((resolve) => {
      liberarPdf = () => resolve({
        ok: true,
        blob: async () => new Blob(['pdf'], { type: 'application/pdf' })
      } as Response);
    }));

    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      switch (ruta) {
        case '/resultados':
          return {
            resultados: [
              {
                folio: 'F-001',
                tipoExamen: 'Parcial',
                totalReactivos: 2,
                aciertos: 1,
                calificacionExamenFinalTexto: '4.25',
                calificacionParcialTexto: '8.5',
                finalDecimal: 8.9,
                finalRedondeada: 9
              }
            ]
          };
        case '/perfil':
          return { ok: true, data: { perfil: { nombreCompleto: 'Ana Alumna', matricula: '2024-001', grupo: 'A-1' } } };
        case '/materias':
          return { ok: true, data: { materias: [{ nombre: 'Matemáticas' }, { nombre: 'Historia' }] } };
        case '/agenda':
          return { ok: true, data: { agenda: [{ titulo: 'Examen parcial' }] } };
        case '/avisos':
          return { ok: true, data: { avisos: [{ titulo: 'Aviso importante' }] } };
        case '/historial':
          return { ok: true, data: { historial: [{ folio: 'F-0001' }] } };
        case '/resultados/F-001':
          return {
            resultado: {
              folio: 'F-001',
              tipoExamen: 'Parcial',
              totalReactivos: 2,
              aciertos: 1,
              calificacionExamenFinalTexto: '4.25',
              calificacionParcialTexto: '8.5',
              versionPolitica: 2,
              bloqueContinuaDecimal: 7.25,
              bloqueExamenesDecimal: 8.5,
              finalDecimal: 8.9,
              finalRedondeada: 9,
              comparativaRespuestas: [
                { numeroPregunta: 1, correcta: 'A', detectada: 'B', coincide: false, confianza: 0.41 },
                { numeroPregunta: 2, correcta: 'C', detectada: 'C', coincide: true, confianza: 0.95 }
              ],
              omrAuditoria: {
                estadoAnalisis: 'requiere_revision',
                motivosRevision: ['Baja confianza']
              },
              omrCapturas: [
                {
                  numeroPagina: 1,
                  formato: 'png',
                  imagenBase64: 'aGVsbG8=',
                  calidad: 0.92,
                  sugerencias: ['Revisar sombreado']
                }
              ]
            }
          };
        default:
          return { ok: true, data: {} };
      }
    });

    const user = userEvent.setup();
    renderConTema();

    await user.type(screen.getByLabelText('Código de acceso'), 'abc123');
    await user.type(screen.getByLabelText(/Matr[ií]cula/i), '2024-001');
    expect(screen.getByRole('heading', { level: 1, name: /Consulta tus resultados/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Ingresa al portal/i })).toBeInTheDocument();
    expect(screen.getByText(/Revisa calificaciones, el detalle de tus respuestas y los archivos disponibles/i)).toBeInTheDocument();
    expect(screen.getByText('Después de ingresar')).toBeInTheDocument();
    expect(screen.queryByText(/Consulta clara y segura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Qué puedes consultar/i })).toBeInTheDocument();
    expect(screen.getByText(/Resultados asociados a tu matrícula/i)).toBeInTheDocument();
    expect(screen.getByText(/detalle y estado de cada folio/i)).toBeInTheDocument();
    await user.keyboard('{Enter}');

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/ingresar', { codigo: 'ABC123', matricula: '2024-001' });
    expect(await screen.findByText(/Resultados disponibles/i)).toBeInTheDocument();
    expect(localStorage.getItem('tokenAlumno')).toBe('token-alumno-valido');
    expect(await screen.findByText('Ana Alumna')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen de folios' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Ayuda: Cómo revisar tus resultados' })).toBeInTheDocument();
    expect(screen.getByText('Guía rápida')).toBeInTheDocument();
    expect(screen.getByText('Marca las preguntas y envía la solicitud de revisión.')).toBeInTheDocument();
    expect(screen.getByText('1 folio')).toBeInTheDocument();
    expect(screen.getByText('2 materias')).toBeInTheDocument();
    expect(screen.getByText('1 aviso reciente')).toBeInTheDocument();
    expect(screen.getByText('Eventos próximos mostrados: 1')).toBeInTheDocument();
    expect(screen.getByText('Aviso importante')).toBeInTheDocument();
    expect(document.querySelector('.portal-card-icon--agenda svg')?.getAttribute('data-icono')).toBe('agenda');
    expect(document.querySelector('.portal-card-icon--historial svg')?.getAttribute('data-icono')).toBe('historial');
    expect(screen.queryByText('Avisos recientes mostrados: 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Total de materias: 2')).not.toBeInTheDocument();
    expect(screen.getByText('Registros mostrados: 1')).toBeInTheDocument();
    expect(screen.getByText(/Matemáticas · Historia/i)).toBeInTheDocument();
    expect(screen.getByText('Examen (sobre 5): 4.25 / 5')).toBeInTheDocument();
    expect(screen.getByText('Calificación parcial (sobre 10): 8.5 / 10')).toBeInTheDocument();
    expect(document.querySelector('.portal-resultado-card__meta')?.textContent).toContain('Calificación final decimal (sobre 10): 8.9 / 10');
    expect(document.querySelector('.portal-resultado-card__meta')?.textContent).toContain('Calificación final redondeada (sobre 10): 9 / 10');
    expect(screen.getByRole('button', { name: 'Ver PDF del folio F-001' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver detalle del folio F-001' }));
    expect(await screen.findByText(/Pendiente de revisi[oó]n manual/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar detalle del folio F-001' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table', { name: /Comparación de respuestas del folio F-001/i })).toBeInTheDocument();
    expect(await screen.findByText(/Motivos de revisi[oó]n: Baja confianza/i)).toBeInTheDocument();
    expect(screen.getByText(/Capturas OMR por página/i)).toBeInTheDocument();
    expect(screen.getByText('Calificación final decimal (sobre 10)')).toBeInTheDocument();
    const desglose = screen.getByText('Ver desglose de la calificación');
    expect(desglose.closest('details')).not.toHaveAttribute('open');
    await user.click(desglose);
    expect(screen.getByText('Bloque de evaluación continua (sobre 10): 7.25 / 10')).toBeInTheDocument();
    expect(screen.getByText('Bloque de exámenes (sobre 10): 8.5 / 10')).toBeInTheDocument();

    const tabla = screen.getByRole('table', { name: /Comparación de respuestas del folio F-001/i });
    expect(within(tabla).getByRole('rowheader', { name: '1' })).toHaveAttribute('scope', 'row');
    const checkboxPreguntaUno = within(tabla).getByRole('checkbox', { name: /pregunta 1 del folio F-001/i });
    const campoComentario = screen.getByRole('textbox', { name: /Comentario obligatorio/i });
    expect(campoComentario).toBeRequired();
    await user.click(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i }));
    expect(screen.getByRole('button', { name: 'Solicitar revisión de marcadas del folio F-001' })).toBeInTheDocument();
    expect(screen.getByText(/Marca al menos una pregunta de este folio/i)).toBeInTheDocument();
    expect(screen.getByText(/Escribe al menos 12 caracteres/i)).toBeInTheDocument();
    await user.click(checkboxPreguntaUno);
    await user.type(campoComentario, 'Solicito revisión por ambigüedad visible.');
    expect(screen.queryByText(/Marca al menos una pregunta de este folio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Escribe al menos 12 caracteres/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i }));
    const botonEnviandoRevision = screen.getByRole('button', { name: /Enviando solicitud/i });
    expect(botonEnviandoRevision).toBeDisabled();
    expect(botonEnviandoRevision).toHaveAttribute('aria-busy', 'true');
    expect(checkboxPreguntaUno).toBeDisabled();
    expect(campoComentario).toBeDisabled();
    await user.click(botonEnviandoRevision);
    expect(mocks.portalMock.enviar.mock.calls.filter(([ruta]) => ruta === '/solicitudes-revision')).toHaveLength(1);
    rechazarRevision?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i })).toBeEnabled();
    });
    expect((await screen.findByText(/Revisión no disponible/i)).closest('[role="alert"]')).toBeInTheDocument();
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'error', title: 'No se pudo enviar' }));
    expect(checkboxPreguntaUno).toBeEnabled();
    expect(campoComentario).toBeEnabled();
    expect(checkboxPreguntaUno).toBeChecked();
    expect(campoComentario).toHaveValue('Solicito revisión por ambigüedad visible.');

    await user.click(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i }));
    expect(screen.getByRole('button', { name: /Enviando solicitud/i })).toBeDisabled();
    expect(mocks.portalMock.enviar.mock.calls.filter(([ruta]) => ruta === '/solicitudes-revision')).toHaveLength(2);
    liberarRevision?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i })).toBeEnabled();
    });
    expect((await screen.findByText('Tu solicitud de revisión fue registrada.')).closest('[role="status"]')).toBeInTheDocument();
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({ level: 'ok', title: 'Solicitud enviada' }));

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/solicitudes-revision', {
      folio: 'F-001',
      solicitudes: [{ numeroPregunta: 1, comentario: 'Solicito revisión por ambigüedad visible.' }]
    }, { silenciarErrores: true });

    const checkboxConformidad = screen.getByRole('checkbox', { name: /En conformidad con resultados/i });
    await user.click(checkboxConformidad);
    expect(screen.getByRole('button', { name: 'Enviar conformidad del folio F-001' })).toBeInTheDocument();
    mocks.emitToastMock.mockClear();
    await user.click(screen.getByRole('button', { name: /Enviar conformidad/i }));
    expect(screen.getByRole('button', { name: /Enviando conformidad/i })).toBeDisabled();
    expect(checkboxConformidad).toBeDisabled();
    rechazarConformidad?.();
    await waitFor(() => expect(mocks.emitToastMock).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      title: 'No se pudo registrar la conformidad del folio F-001',
      message: 'Conformidad no disponible'
    })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar conformidad del folio F-001' })).toBeEnabled());
    expect(checkboxConformidad).toBeEnabled();
    expect(checkboxConformidad).toBeChecked();

    await user.click(screen.getByRole('button', { name: /Enviar conformidad/i }));
    expect(screen.getByRole('button', { name: /Enviando conformidad/i })).toBeDisabled();
    expect(checkboxConformidad).toBeDisabled();
    liberarConformidad?.();
    expect((await screen.findByText('Confirmaste tu conformidad con los resultados del folio F-001.')).closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Conformidad registrada' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Conformidad registrada' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Enviar conformidad del folio F-001' })).not.toBeInTheDocument();
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'ok',
      title: 'Conformidad registrada · folio F-001'
    }));

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/solicitudes-revision/conformidad', {
      folio: 'F-001',
      conformidad: true
    });

    await user.click(screen.getByRole('button', { name: /Ver PDF/i }));
    expect(screen.getByRole('button', { name: /Preparando PDF/i })).toBeDisabled();
    liberarPdf?.();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/portal/examen/F-001',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-alumno-valido' }
        })
      );
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith('blob:pdf-test', '_blank', 'noopener,noreferrer');
    expect(screen.getByText(/El PDF del folio F-001 está listo/i)).toHaveAttribute('role', 'status');

    const fallosHttpPdf = [
      { status: 401, mensaje: 'Tu sesión venció. Vuelve a ingresar al portal y solicita el PDF otra vez.' },
      { status: 403, mensaje: 'No tienes acceso a este PDF. Confirma con tu docente que esté disponible para tu folio.' },
      { status: 404, mensaje: 'El PDF de este folio no está disponible. Consulta con tu docente.' },
      { status: 429, mensaje: 'Hay demasiadas solicitudes. Espera un momento y vuelve a intentarlo.' },
      { status: 503, mensaje: 'El servicio no pudo entregar el PDF. Inténtalo de nuevo más tarde.' }
    ];
    for (const fallo of fallosHttpPdf) {
      vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: fallo.status } as Response);
      mocks.emitToastMock.mockClear();
      await user.click(screen.getByRole('button', { name: 'Ver PDF del folio F-001' }));
      await waitFor(() => expect(mocks.emitToastMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        title: 'PDF del folio F-001 no disponible',
        message: fallo.mensaje
      })));
      expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({ message: `HTTP ${fallo.status}` }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Ver PDF del folio F-001' })).toBeEnabled());
    }
    expect(mocks.accionCerrarSesionMock).toHaveBeenCalledWith('alumno');
    expect(mocks.portalMock.registrarEventosUso).toHaveBeenCalledWith(expect.objectContaining({
      eventos: expect.arrayContaining([expect.objectContaining({
        accion: 'ver_pdf',
        exito: false,
        meta: expect.objectContaining({ folio: 'F-001', status: 403 })
      })])
    }));
  });

  it('asocia errores de acceso a los campos cuando se envía el formulario vacío', async () => {
    const user = userEvent.setup();
    renderConTema();

    await user.click(screen.getByRole('button', { name: /Consultar/i }));

    const codigo = screen.getByLabelText('Código de acceso');
    const matricula = screen.getByRole('textbox', { name: /Matrícula/i });
    expect(screen.getByText(/Escribe el código de acceso/i)).toBeInTheDocument();
    expect(screen.getByText(/Escribe tu matrícula/i)).toBeInTheDocument();
    expect(codigo).toHaveAttribute('aria-invalid', 'true');
    expect(matricula).toHaveAttribute('aria-invalid', 'true');
    expect(codigo.getAttribute('aria-describedby')).toContain('error');
  });

  it('asocia la expiración del código con ese campo y mantiene la ayuda de matrícula específica', () => {
    renderConTema();

    const codigo = screen.getByLabelText('Código de acceso');
    const matricula = screen.getByRole('textbox', { name: /Matrícula/i });
    expect(matricula).toHaveValue('');
    expect(matricula).not.toHaveAttribute('placeholder');
    expect(codigo).toHaveValue('');
    expect(codigo).not.toHaveAttribute('placeholder');
    expect(codigo).toHaveAccessibleDescription('Usa el código más reciente que te compartió tu docente. Si expiró, pídele uno nuevo.');
    expect(matricula).toHaveAccessibleDescription('Escríbela sin espacios.');
    expect(codigo).toHaveAttribute('type', 'password');
    expect(codigo).toHaveAttribute('autocomplete', 'current-password');
  });

  it('permite mostrar y ocultar el código sin cambiar su valor ni enviar el formulario', async () => {
    const user = userEvent.setup();
    renderConTema();

    const codigo = screen.getByLabelText('Código de acceso');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), 'DUMMY-01');
    await user.type(codigo, 'abc123');
    expect(codigo).toHaveValue('ABC123');
    expect(codigo).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar código de acceso' }));
    expect(codigo).toHaveAttribute('type', 'text');
    expect(codigo).toHaveValue('ABC123');
    expect(screen.getByRole('button', { name: 'Ocultar código de acceso' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.portalMock.enviar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ocultar código de acceso' }));
    expect(codigo).toHaveAttribute('type', 'password');
    expect(codigo).toHaveValue('ABC123');
  });

  it('mantiene el error de acceso en el formulario sin duplicarlo en un toast', async () => {
    mocks.portalMock.enviar.mockRejectedValue(new Error('Credenciales de prueba incorrectas'));

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'demo01');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), 'DUMMY-01');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales de prueba incorrectas');
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      title: 'No se pudo ingresar'
    }));
  });

  it('usa un toast distinto solo cuando ofrece recuperar una sesión expirada', async () => {
    const action = { label: 'Cerrar sesión', onClick: vi.fn() };
    mocks.accionToastSesionParaErrorMock.mockReturnValue(action);
    mocks.portalMock.enviar.mockResolvedValue({ token: 'token-demo' });
    mocks.portalMock.obtener.mockRejectedValue(new Error('No se pudieron cargar resultados'));

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'demo01');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), 'DUMMY-01');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar resultados');
    expect(mocks.emitToastMock).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'La sesión requiere atención',
      message: 'Cierra sesión y vuelve a ingresar para continuar.',
      action
    }));
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: 'No se pudieron cargar resultados'
    }));
  });

  it('distingue un fallo de resultados del estado vacío y permite reintentar sin volver a ingresar', async () => {
    let intentosResultados = 0;
    mocks.portalMock.enviar.mockResolvedValue({ token: 'token-reintento-resultados' });
    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      if (ruta === '/resultados') {
        intentosResultados += 1;
        if (intentosResultados === 1) throw new Error('Resultados temporalmente no disponibles.');
        return { resultados: [{ folio: 'F-RECUPERADO', tipoExamen: 'Parcial', calificacionExamenFinalTexto: '8.5' }] };
      }
      if (ruta === '/perfil') return { ok: true, data: { perfil: null } };
      if (ruta === '/materias') return { ok: true, data: { materias: [] } };
      if (ruta === '/agenda') return { ok: true, data: { agenda: [] } };
      if (ruta === '/avisos') return { ok: true, data: { avisos: [] } };
      if (ruta === '/historial') return { ok: true, data: { historial: [] } };
      return { ok: true, data: {} };
    });

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'demo01');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), 'DUMMY-01');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Resultados temporalmente no disponibles.');
    expect(screen.queryByRole('heading', { name: /Sin resultados/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar carga de resultados' }));

    expect(await screen.findByText(/Folio F-RECUPERADO/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.portalMock.enviar.mock.calls.filter(([ruta]) => ruta === '/ingresar')).toHaveLength(1);
    expect(mocks.portalMock.obtener.mock.calls.filter(([ruta]) => ruta === '/resultados')).toHaveLength(2);
  });

  it('aísla fallos de contexto académico, distingue vacíos y permite reintentar sin recargar resultados', async () => {
    let intentosAgenda = 0;
    mocks.portalMock.enviar.mockResolvedValue({ token: 'token-contexto' });
    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      switch (ruta) {
        case '/resultados':
          return { resultados: [{ folio: 'F-CONTEXTO', tipoExamen: 'Parcial', calificacionExamenFinalTexto: '4.5' }] };
        case '/perfil':
          return { ok: true, data: { perfil: { nombreCompleto: 'Estudiante Demo', matricula: 'DUMMY-01', grupo: 'A-1' } } };
        case '/materias':
          return { ok: true, data: { materias: [{ nombre: 'Matemáticas' }, { nombre: 'Historia' }, { nombre: 'Biología' }] } };
        case '/agenda':
          intentosAgenda += 1;
          if (intentosAgenda === 1) throw new Error('backend-secret-path');
          return { ok: true, data: { agenda: [{ titulo: 'Examen parcial recuperado' }] } };
        case '/avisos':
          return { ok: true, data: { avisos: [] } };
        case '/historial':
          return { ok: true, data: { historial: [] } };
        default:
          return { ok: true, data: {} };
      }
    });

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'demo01');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), 'DUMMY-01');
    await user.click(screen.getByRole('button', { name: /Consultar/i }));

    expect(await screen.findByText('Estudiante Demo')).toBeInTheDocument();
    const alertaContexto = screen.getByRole('alert');
    expect(alertaContexto).toHaveTextContent('Algunos datos académicos no se pudieron cargar.');
    expect(alertaContexto).toHaveTextContent('Tus calificaciones siguen disponibles');
    expect(alertaContexto).not.toHaveTextContent('No se pudo cargar la agenda.');
    expect(screen.getAllByText('No se pudo cargar la agenda.')).toHaveLength(1);
    expect(screen.getByText('Eventos próximos: No disponible')).toBeInTheDocument();
    expect(screen.queryByText('Sin próximos eventos')).not.toBeInTheDocument();
    expect(screen.getByText(/Matemáticas · Historia · y 1 más/)).toBeInTheDocument();
    expect(screen.getByText('Sin avisos recientes')).toBeInTheDocument();
    expect(screen.getByText('Sin registros anteriores')).toBeInTheDocument();
    expect(screen.queryByText(/backend-secret-path/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reintentar datos académicos' }));
    expect(await screen.findByText('Examen parcial recuperado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Eventos próximos mostrados: 1')).toBeInTheDocument();
    expect(mocks.portalMock.obtener.mock.calls.filter(([ruta]) => ruta === '/resultados')).toHaveLength(1);
    expect(mocks.portalMock.obtener.mock.calls.filter(([ruta]) => ruta === '/agenda')).toHaveLength(2);
  });

  it('permite reintentar la carga fallida del detalle del folio sin cerrar el panel', async () => {
    mocks.portalMock.enviar.mockResolvedValue({ token: 'token-reintento' });
    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      if (ruta === '/resultados') return { resultados: [{ folio: 'F-ERR', tipoExamen: 'Parcial', calificacionExamenFinalTexto: '8' }] };
      if (ruta === '/resultados/F-ERR') {
        if (mocks.portalMock.obtener.mock.calls.filter(([solicitada]) => solicitada === '/resultados/F-ERR').length === 1) {
          throw new Error('Detalle temporalmente no disponible');
        }
        return { resultado: { folio: 'F-ERR', comparativaRespuestas: [] } };
      }
      return { ok: true, data: {} };
    });

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'abc123');
    await user.type(screen.getByRole('textbox', { name: /Matrícula/i }), '2024-002');
    await user.keyboard('{Enter}');

    const botonDetalle = await screen.findByRole('button', { name: /Ver detalle/i });
    expect(botonDetalle).toHaveAttribute('aria-controls', 'detalle-folio-F-ERR');
    await user.click(botonDetalle);
    expect(await screen.findByRole('button', { name: /Reintentar detalle de F-ERR/i })).toBeInTheDocument();
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      title: 'Detalle no disponible'
    }));
    await user.click(screen.getByRole('button', { name: /Reintentar detalle de F-ERR/i }));
    expect(await screen.findByText(/Aún no hay comparación de respuestas para este examen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ocultar detalle/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('aplica cooldown tras tres intentos fallidos de ingreso', async () => {
    mocks.portalMock.enviar.mockRejectedValue(new Error('Credenciales inválidas'));

    const user = userEvent.setup();
    renderConTema();

    await user.type(screen.getByLabelText('Código de acceso'), 'abc123');
    await user.type(screen.getByLabelText(/Matr[ií]cula/i), '2024-001');

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Consultar/i }));
      await waitFor(() => {
        expect(screen.getByText(/Credenciales inválidas/i)).toBeInTheDocument();
      });
    }

    expect(screen.getByText(/podrás volver a intentar en \d+ segundos/i)).toBeInTheDocument();
    expect(screen.getByText(
      'Por seguridad, el acceso está temporalmente bloqueado tras varios intentos fallidos. Espera a que termine el contador antes de volver a intentar.'
    )).toHaveAttribute('role', 'status');
    expect(screen.getByText(/podrás volver a intentar en \d+ segundos/i).closest('[aria-live="off"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Consultar/i })).toBeDisabled();
    expect(mocks.portalMock.enviar).toHaveBeenCalledTimes(3);

    const formulario = screen.getByLabelText('Código de acceso').closest('form');
    expect(formulario).not.toBeNull();
    fireEvent.submit(formulario!);

    expect(screen.getByText(/podrás volver a intentar en \d+ segundos/i)).toBeInTheDocument();
    expect(mocks.portalMock.enviar).toHaveBeenCalledTimes(3);
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Espera un momento'
    }));
  });

  it('anuncia cuando termina el cooldown y detiene su temporizador', async () => {
    mocks.portalMock.enviar.mockRejectedValue(new Error('Credenciales inválidas'));
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const ticks: Array<() => void> = [];
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((callback, delay) => {
      if (typeof callback === 'function' && delay === 1000) ticks.push(callback as () => void);
      return 42;
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const user = userEvent.setup();
    const vista = renderConTema();

    await user.type(screen.getByLabelText('Código de acceso'), 'abc123');
    await user.type(screen.getByLabelText(/Matr[ií]cula/i), '2024-001');
    for (let intento = 0; intento < 3; intento += 1) {
      await user.click(screen.getByRole('button', { name: /Consultar/i }));
      await waitFor(() => expect(screen.getByText(/Credenciales inválidas/i)).toBeInTheDocument());
    }

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(ticks).toHaveLength(1);
    reloj.mockReturnValue(16_001);
    await act(async () => ticks[0]!());

    const estadoListo = screen.getByText('El tiempo de espera terminó. Ya puedes volver a intentar ingresar.');
    expect(estadoListo).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: /Consultar/i })).toBeEnabled();
    expect(clearIntervalSpy).toHaveBeenCalledWith(42);

    vista.unmount();
    reloj.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('retira el error del último acceso al corregir credenciales fuera del cooldown', async () => {
    mocks.portalMock.enviar.mockRejectedValue(new Error('Credenciales de prueba incorrectas'));

    const user = userEvent.setup();
    renderConTema();
    const codigo = screen.getByLabelText('Código de acceso');
    const matricula = screen.getByLabelText(/Matrícula/i);
    await user.type(codigo, 'abc123');
    await user.type(matricula, '2024-001');
    await user.click(screen.getByRole('button', { name: /Consultar/i }));

    expect(await screen.findByText('Credenciales de prueba incorrectas')).toBeInTheDocument();
    await user.type(codigo, '4');
    expect(screen.queryByText('Credenciales de prueba incorrectas')).not.toBeInTheDocument();
    expect(mocks.portalMock.enviar).toHaveBeenCalledTimes(1);
  });

  it('limpia el contexto del alumno anterior antes de mostrar una nueva sesión', async () => {
    let liberarPerfilNuevo: (() => void) | undefined;
    let cantidadResultados = 0;
    let cantidadPerfiles = 0;
    mocks.portalMock.enviar
      .mockResolvedValueOnce({ token: 'token-alumno-uno' })
      .mockResolvedValueOnce({ token: 'token-alumno-dos' });
    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      if (ruta === '/resultados') {
        cantidadResultados += 1;
        return {
          resultados: [{ folio: cantidadResultados === 1 ? 'F-001' : 'F-002', tipoExamen: 'Parcial' }]
        };
      }
      if (ruta === '/perfil') {
        cantidadPerfiles += 1;
        if (cantidadPerfiles === 2) {
          return await new Promise((resolve) => {
            liberarPerfilNuevo = () => resolve({ ok: true, data: { perfil: { nombreCompleto: 'Bruno Alumno', matricula: '2024-002' } } });
          });
        }
        return { ok: true, data: { perfil: { nombreCompleto: 'Ana Alumna', matricula: '2024-001' } } };
      }
      if (ruta === '/materias') return { ok: true, data: { materias: [{ nombre: 'Matemáticas' }] } };
      if (ruta === '/agenda') return { ok: true, data: { agenda: [] } };
      if (ruta === '/avisos') return { ok: true, data: { avisos: [] } };
      if (ruta === '/historial') return { ok: true, data: { historial: [] } };
      return { ok: true, data: {} };
    });

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'COD001');
    await user.type(screen.getByLabelText(/Matrícula/i), '2024-001');
    await user.click(screen.getByRole('button', { name: /consultar/i }));
    expect(await screen.findByText('Ana Alumna')).toBeInTheDocument();
    expect(await screen.findByText('Folio F-001', { exact: true })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /salir/i }));
    await user.type(screen.getByLabelText('Código de acceso'), 'COD002');
    await user.type(screen.getByLabelText(/Matrícula/i), '2024-002');
    await user.click(screen.getByRole('button', { name: /consultar/i }));

    expect(await screen.findByText('Folio F-002', { exact: true })).toBeInTheDocument();
    await waitFor(() => expect(liberarPerfilNuevo).toBeDefined());
    expect(screen.queryByText('Ana Alumna')).not.toBeInTheDocument();
    expect(screen.getByText(/Cargando perfil y contexto académico/i)).toBeInTheDocument();

    liberarPerfilNuevo?.();
    expect(await screen.findByText('Bruno Alumno')).toBeInTheDocument();
    expect(screen.queryByText('Ana Alumna')).not.toBeInTheDocument();
  });

  it('ignora resultados que terminan de cargar después de cerrar sesión', async () => {
    let liberarResultados: (() => void) | undefined;
    mocks.portalMock.enviar.mockResolvedValue({ token: 'token-alumno-uno' });
    mocks.portalMock.obtener.mockImplementation(async (ruta: string) => {
      if (ruta === '/resultados') {
        return await new Promise((resolve) => {
          liberarResultados = () => resolve({ resultados: [{ folio: 'F-TARDIO', tipoExamen: 'Parcial' }] });
        });
      }
      return { ok: true, data: {} };
    });

    const user = userEvent.setup();
    renderConTema();
    await user.type(screen.getByLabelText('Código de acceso'), 'COD001');
    await user.type(screen.getByLabelText(/Matrícula/i), '2024-001');
    await user.click(screen.getByRole('button', { name: /consultar/i }));
    await waitFor(() => expect(liberarResultados).toBeDefined());
    await user.click(screen.getByRole('button', { name: /salir/i }));

    liberarResultados?.();

    expect(await screen.findByLabelText('Código de acceso')).toBeInTheDocument();
    expect(screen.queryByText(/Folio F-TARDIO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cargando perfil y contexto académico/i)).not.toBeInTheDocument();
  });

  it('cierra la sesión cuando llega una invalidación externa del tipo alumno', async () => {
    localStorage.setItem('tokenAlumno', 'token-previo');
    mocks.portalMock.obtener.mockResolvedValue({ resultados: [] });

    renderConTema();

    expect(screen.getByRole('button', { name: /Salir/i })).toBeInTheDocument();
    expect(mocks.sesionInvalidadaHandler).not.toBeNull();

    mocks.sesionInvalidadaHandler?.('alumno');

    await waitFor(() => {
      expect(localStorage.getItem('tokenAlumno')).toBeNull();
    });
    expect(await screen.findByLabelText('Código de acceso')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión ya no está activa. Ingresa de nuevo para continuar.');
    expect(mocks.emitToastMock).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Sesión cerrada' }));
  });

  it('confirma el cierre voluntario con un toast informativo', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tokenAlumno', 'token-previo');
    mocks.portalMock.obtener.mockResolvedValue({ resultados: [] });

    renderConTema();
    await user.click(screen.getByRole('button', { name: /Salir/i }));

    expect(await screen.findByLabelText('Código de acceso')).toBeInTheDocument();
    expect(mocks.emitToastMock).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      title: 'Sesión',
      message: 'Sesión cerrada'
    }));
  });
});
