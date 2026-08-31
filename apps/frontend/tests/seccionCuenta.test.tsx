/**
 * seccionCuenta.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCuenta } from '../src/apps/app_docente/SeccionCuenta';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Docente } from '../src/apps/app_docente/tipos';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    registrarEventosUso: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionCuenta', () => {
  const docenteMock: Docente = {
    _id: 'doc-1',
    nombre: 'Profesor Titular',
    correo: 'profesor@cuh.mx',
    tieneGoogle: true,
    tieneContrasena: true,
    preferenciasPdf: {
      institucion: 'Universidad EvaluaPro',
      lema: 'Excelencia y Rigor',
      logos: {
        izquierdaPath: '',
        derechaPath: ''
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteApi.obtener).mockResolvedValue({ items: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValue({});
  });

  const renderConOAuth = (ui: React.ReactElement) => {
    return render(<GoogleOAuthProvider clientId="test-client-id">{ui}</GoogleOAuthProvider>);
  };

  it('renderiza resumen de cuenta, estado de accesos y preferencias PDF', () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    expect(screen.getByRole('heading', { name: /^Cuenta$/i })).toBeInTheDocument();
    expect(screen.getByText('profesor@cuh.mx')).toBeInTheDocument();
    expect(screen.getByText('Vinculado')).toBeInTheDocument();
    expect(screen.getByText('Definida')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Universidad EvaluaPro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Excelencia y Rigor')).toBeInTheDocument();
  });

  it('permite cambiar contraseña tras validar contraseña actual y coincidencia de 8+ caracteres', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
        oauthGoogleDisponible={true}
        classroomDisponible={false}
        smtpDisponible={true}
        requireGoogleOAuth={false}
      />
    );

    const inputActual = screen.getByLabelText(/Contrasena actual/i, { selector: 'input' });
    const inputNueva = screen.getByLabelText(/^Nueva contrasena/i, { selector: 'input' });
    const inputConfirmar = screen.getByLabelText(/Confirmar contrasena/i, { selector: 'input' });
    const botonGuardar = screen.getByRole('button', { name: /Guardar contrasena/i });

    expect(botonGuardar).toBeDisabled();

    fireEvent.change(inputActual, { target: { value: 'PasswordAnterior123' } });
    fireEvent.change(inputNueva, { target: { value: 'NuevaClaveSegura2026' } });
    fireEvent.change(inputConfirmar, { target: { value: 'NuevaClaveSegura2026' } });

    expect(botonGuardar).not.toBeDisabled();

    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/definir-contrasena',
        expect.objectContaining({
          contrasenaActual: 'PasswordAnterior123',
          contrasenaNueva: 'NuevaClaveSegura2026'
        })
      );
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Cuenta' })
    );
  });

  it('permite actualizar preferencias de encabezado PDF institucional', async () => {
    const mockActualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      preferenciasPdf: {
        institucion: 'Campus Central',
        lema: 'Innovación Continua'
      }
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={mockActualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const inputInstitucion = screen.getByLabelText(/^Institucion/i, { selector: 'input' });
    fireEvent.change(inputInstitucion, { target: { value: 'Campus Central' } });

    const inputLema = screen.getByLabelText(/^Lema/i, { selector: 'input' });
    fireEvent.change(inputLema, { target: { value: 'Innovación Continua' } });

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/preferencias/pdf',
        expect.objectContaining({
          institucion: 'Campus Central',
          lema: 'Innovación Continua'
        })
      );
    });

    expect(mockActualizarDocente).toHaveBeenCalledWith(
      expect.objectContaining({
        preferenciasPdf: {
          institucion: 'Campus Central',
          lema: 'Innovación Continua'
        }
      })
    );
  });

  it('permite regenerar accesos directos en el escritorio', async () => {
    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonRegenerar = screen.getByRole('button', { name: /Regenerar accesos/i });
    fireEvent.click(botonRegenerar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/autenticacion/accesos-directos/regenerar', {});
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Accesos directos' })
    );
  });

  it('carga la papelera de reciclaje y permite restaurar elementos cuando es admin y dev', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      items: [
        {
          _id: 'item-pap-1',
          tipo: 'plantilla',
          createdAt: '2026-08-20T10:00:00.000Z',
          payload: {
            plantilla: { titulo: 'Examen Parcial Álgebra' }
          }
        }
      ]
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Examen Parcial Álgebra')).toBeInTheDocument();
    });

    const botonRestaurar = screen.getByRole('button', { name: /Restaurar/i });
    fireEvent.click(botonRestaurar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/papelera/item-pap-1/restaurar', {});
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Papelera' })
    );
  });

  it('renderiza la sección de actualizaciones y permite consultar el estado oficial', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: 'v1.1.1',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.1.1',
        assets: [
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.1.1.exe', browser_download_url: 'https://download.url/installer.exe' }
        ]
      })
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    expect(screen.getByText(/Actualizaciones del Sistema & Installer Hub/i)).toBeInTheDocument();
    expect(screen.getAllByText(/v1.1.1 Estable/i).length).toBeGreaterThanOrEqual(1);

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/El sistema se encuentra en la versión oficial estable más reciente/i)).toBeInTheDocument();
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Sistema al día' })
    );

    fetchSpy.mockRestore();
  });

  it('muestra banner y botón de descarga cuando hay una nueva versión disponible', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: 'v1.2.0',
        html_url: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.2.0',
        assets: [
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.2.0.exe', browser_download_url: 'https://download.url/installer-v1.2.0.exe' },
          { name: 'EvaluaPro-InstallerHub-docente-local-v1.2.0.exe.sha256', browser_download_url: 'https://download.url/installer-v1.2.0.exe.sha256' }
        ]
      })
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/¡Nueva versión estable v1.2.0 disponible!/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Descargar Actualización Oficial/i })).toHaveAttribute('href', 'https://download.url/installer-v1.2.0.exe');
      expect(screen.getByRole('link', { name: /Ver Novedades/i })).toHaveAttribute('href', 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/tag/v1.2.0');
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info', title: 'Actualización disponible' })
    );

    fetchSpy.mockRestore();
  });

  it('maneja errores en preferencias PDF y accesos directos', async () => {
    vi.mocked(clienteApi.enviar).mockRejectedValue(new Error('Fallo de red'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'PDF' })
      );
    });

    const botonRegenerar = screen.getByRole('button', { name: /Regenerar accesos/i });
    fireEvent.click(botonRegenerar);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'Accesos directos' })
      );
    });
  });

  it('maneja error o desconexión en verificación de actualizaciones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/Versión oficial local v1.1.1 activa/i)).toBeInTheDocument();
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Versión verificada' })
    );

    fetchSpy.mockRestore();
  });

  it('maneja respuesta HTTP no OK al verificar actualizaciones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500
    } as unknown as Response);

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );

    const botonBuscar = screen.getByRole('button', { name: /Buscar actualizaciones ahora/i });
    fireEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/Versión oficial local v1.1.1 activa/i)).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it('guarda preferencias de PDF incluyendo rutas de logos', async () => {
    const mockActualizarDocente = vi.fn();
    vi.mocked(clienteApi.enviar).mockResolvedValue({
      preferenciasPdf: {
        institucion: 'Campus Norte',
        lema: 'Ciencia y Cultura',
        logos: {
          izquierdaPath: 'logos/izq.png',
          derechaPath: 'logos/der.png'
        }
      }
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={mockActualizarDocente}
        esAdmin={false}
        esDev={false}
      />
    );

    const inputLogoIzq = screen.getByLabelText(/Logo izquierda/i);
    fireEvent.change(inputLogoIzq, { target: { value: 'logos/izq.png' } });

    const inputLogoDer = screen.getByLabelText(/Logo derecha/i);
    fireEvent.change(inputLogoDer, { target: { value: 'logos/der.png' } });

    const botonGuardarPdf = screen.getByRole('button', { name: /Guardar PDF/i });
    fireEvent.click(botonGuardarPdf);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/autenticacion/preferencias/pdf',
        expect.objectContaining({
          logos: {
            izquierdaPath: 'logos/izq.png',
            derechaPath: 'logos/der.png'
          }
        })
      );
    });
  });

  it('renderiza items de papelera tipo periodo y alumno y maneja error al restaurar', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      items: [
        {
          _id: 'item-periodo-1',
          tipo: 'periodo',
          eliminadoEn: '2026-08-01T12:00:00.000Z',
          expiraEn: '2026-09-15T12:00:00.000Z',
          payload: { periodo: { nombre: '2026-1' } }
        },
        {
          _id: 'item-alumno-1',
          tipo: 'alumno',
          eliminadoEn: '2026-08-05T12:00:00.000Z',
          expiraEn: '2026-09-20T12:00:00.000Z',
          payload: { alumno: { nombreCompleto: 'Juan Pérez' } }
        }
      ]
    });

    renderConOAuth(
      <SeccionCuenta
        docente={docenteMock}
        onDocenteActualizado={() => {}}
        esAdmin={true}
        esDev={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2026-1')).toBeInTheDocument();
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Fallo al restaurar'));
    const botonesRestaurar = screen.getAllByRole('button', { name: /Restaurar/i });
    fireEvent.click(botonesRestaurar[0]);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'Papelera' })
      );
    });
  });
});
