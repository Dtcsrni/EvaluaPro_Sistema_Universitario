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
});
