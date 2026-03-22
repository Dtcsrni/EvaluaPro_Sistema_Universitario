/**
 * appAlumno.behavior.test
 *
 * Responsabilidad: cubrir los flujos principales del portal alumno.
 * Limites: preservar el contrato visible del login, detalle, revisión y sesión.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
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
    mocks.portalMock.enviar.mockImplementation(async (ruta: string) => {
      if (ruta === '/ingresar') return { token: 'token-alumno-valido' };
      if (ruta === '/solicitudes-revision') return { ok: true };
      if (ruta === '/solicitudes-revision/conformidad') return { ok: true };
      return { ok: true };
    });

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
                calificacionExamenFinalTexto: '8.5'
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
              calificacionExamenFinalTexto: '8.5',
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

    await user.type(screen.getByLabelText(/Codigo de acceso/i), 'abc123');
    await user.type(screen.getByLabelText(/Matricula/i), '2024-001');
    await user.click(screen.getByRole('button', { name: /Consultar/i }));

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/ingresar', { codigo: 'ABC123', matricula: '2024-001' });
    expect(await screen.findByText(/Resultados disponibles/i)).toBeInTheDocument();
    expect(localStorage.getItem('tokenAlumno')).toBe('token-alumno-valido');
    expect(await screen.findByText('Ana Alumna')).toBeInTheDocument();
    expect(screen.getByText(/Matemáticas · Historia/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ver detalle/i }));
    expect(await screen.findByText(/Pendiente de revision manual/i)).toBeInTheDocument();
    expect(await screen.findByText(/Motivos de revision: Baja confianza/i)).toBeInTheDocument();
    expect(screen.getByText(/Capturas OMR por página/i)).toBeInTheDocument();

    const filaPreguntaUno = screen.getByText('1').closest('tr');
    expect(filaPreguntaUno).not.toBeNull();
    await user.click(within(filaPreguntaUno as HTMLTableRowElement).getByRole('checkbox'));
    await user.type(screen.getByPlaceholderText(/Comentario obligatorio/i), 'Solicito revisión por ambigüedad visible.');
    await user.click(screen.getByRole('button', { name: /Solicitar revisión de marcadas/i }));

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/solicitudes-revision', {
      folio: 'F-001',
      solicitudes: [{ numeroPregunta: 1, comentario: 'Solicito revisión por ambigüedad visible.' }]
    });

    await user.click(screen.getByRole('checkbox', { name: /En conformidad con resultados/i }));
    await user.click(screen.getByRole('button', { name: /Enviar conformidad/i }));

    expect(mocks.portalMock.enviar).toHaveBeenCalledWith('/solicitudes-revision/conformidad', {
      folio: 'F-001',
      conformidad: true
    });

    await user.click(screen.getByRole('button', { name: /Ver PDF/i }));

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
  });

  it('aplica cooldown tras tres intentos fallidos de ingreso', async () => {
    mocks.portalMock.enviar.mockRejectedValue(new Error('Credenciales inválidas'));

    const user = userEvent.setup();
    renderConTema();

    await user.type(screen.getByLabelText(/Codigo de acceso/i), 'abc123');
    await user.type(screen.getByLabelText(/Matricula/i), '2024-001');

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Consultar/i }));
      await waitFor(() => {
        expect(screen.getByText(/Credenciales inválidas/i)).toBeInTheDocument();
      });
    }

    expect(screen.getByText(/Por seguridad, espera unos segundos antes de reintentar\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consultar/i })).toBeDisabled();
    expect(mocks.portalMock.enviar).toHaveBeenCalledTimes(3);
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
    expect(await screen.findByLabelText(/Codigo de acceso/i)).toBeInTheDocument();
    expect(mocks.emitToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        title: 'Sesion',
        message: 'Sesion cerrada'
      })
    );
  });
});
