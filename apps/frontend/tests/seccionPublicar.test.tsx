/**
 * seccionPublicar.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionPublicar, type CodigoAccesoMetadata } from '../src/apps/app_docente/SeccionPublicar';
import { emitToast } from '../src/ui/toast/toastBus';
import type { Periodo } from '../src/apps/app_docente/tipos';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionPublicar', () => {
  const periodosMock: Periodo[] = [
    { _id: 'per-1', nombre: 'Física Cuántica', activo: true }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la sección y mantiene los botones bloqueados si no hay materia seleccionada', () => {
    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={vi.fn()}
        onCodigo={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Publicación y acceso al Portal Alumno/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Publicar resultados$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Generar código de acceso$/i })).toBeDisabled();
  });

  it('explica la carga, el error recuperable, la lista vacía y la falta de permiso de materias', async () => {
    const onReintentarMaterias = vi.fn().mockResolvedValue(undefined);
    const props = {
      periodos: [] as Periodo[],
      onPublicar: vi.fn(),
      onCodigo: vi.fn(),
      onReintentarMaterias
    };
    const { rerender } = render(<SeccionPublicar {...props} cargandoMaterias />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando materias disponibles');
    expect(screen.getByLabelText(/^Materia para publicar$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Publicar resultados$/i })).toBeDisabled();

    rerender(<SeccionPublicar {...props} errorMaterias />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las materias disponibles');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de materias' }));
    await waitFor(() => expect(onReintentarMaterias).toHaveBeenCalledTimes(1));

    rerender(<SeccionPublicar {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('No hay materias activas para publicar');
    expect(screen.getByRole('status')).toHaveTextContent('Crea o activa una materia en Materias');

    rerender(<SeccionPublicar {...props} puedeLeerMaterias={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('No tienes permiso para consultar las materias disponibles');
    expect(screen.queryByRole('button', { name: 'Reintentar carga de materias' })).not.toBeInTheDocument();
  });

  it('permite publicar resultados hacia el portal alumno tras seleccionar una materia', async () => {
    const mockPublicar = vi.fn().mockResolvedValue({});

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia para publicar$/i);
    expect(screen.getByRole('option', { name: 'Física Cuántica' })).not.toHaveAttribute('title');
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonPublicar = screen.getByRole('button', { name: /^Publicar resultados$/i });
    expect(botonPublicar).not.toBeDisabled();

    fireEvent.click(botonPublicar);

    await waitFor(() => {
      expect(mockPublicar).toHaveBeenCalledWith('per-1');
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Resultados de Física Cuántica publicados en el Portal Alumno.');
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('permite generar un código de acceso temporal para el portal alumno', async () => {
    const mockPublicar = vi.fn().mockResolvedValue({});
    const mockCodigo = vi.fn().mockResolvedValue({
      codigo: 'CUH-EXP-8899',
      expiraEn: '2026-08-30T12:00:00.000Z'
    });

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={mockCodigo}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia para publicar$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonCodigo = screen.getByRole('button', { name: /^Generar código de acceso$/i });
    fireEvent.click(botonCodigo);

    await waitFor(() => {
      expect(mockCodigo).toHaveBeenCalledWith('per-1');
      expect(mockPublicar).toHaveBeenCalledWith('per-1');
    });

    expect(screen.getByText('CUH-EXP-8899')).toBeInTheDocument();
    expect(screen.getByText('Listo para compartir')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Código de acceso generado para Física Cuántica/i);
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('muestra mensaje de error cuando falla la publicación', async () => {
    const mockPublicar = vi.fn().mockRejectedValue(new Error('Fallo de conexión al portal'));

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn()}
      />
    );

    const selectMateria = screen.getByLabelText(/^Materia para publicar$/i);
    fireEvent.change(selectMateria, { target: { value: 'per-1' } });

    const botonPublicar = screen.getByRole('button', { name: /^Publicar resultados$/i });
    fireEvent.click(botonPublicar);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Fallo de conexión al portal/i);
    });

    expect(emitToast).not.toHaveBeenCalled();
  });

  it('reserva el toast para la acción de renovar sesión y no repite el error contextual', async () => {
    const mockPublicar = vi.fn().mockRejectedValue(new ErrorRemoto('Sesión vencida.', { status: 401 }));

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Publicar resultados$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo autenticar');
    expect(emitToast).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      title: 'Renueva tu sesión docente',
      message: expect.stringContaining('después reintenta la acción'),
      action: expect.objectContaining({ label: 'Cerrar sesión' })
    }));
    expect(vi.mocked(emitToast).mock.calls[0]?.[0].message).not.toContain('No se pudo autenticar');
  });

  it('conserva el código creado y explica que falta publicarlo si falla la sincronización', async () => {
    const mockPublicar = vi.fn()
      .mockRejectedValueOnce(new Error('Servicio no disponible'))
      .mockResolvedValueOnce({});

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={mockPublicar}
        onCodigo={vi.fn().mockResolvedValue({ codigoAccesoId: 'code-dummy-1', codigo: 'DUMMY-8899', expiraEn: '2026-12-31T12:00:00.000Z' })}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Generar código de acceso$/i }));

    expect(await screen.findByText('DUMMY-8899')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Código creado, pero aún no publicado/i);
    expect(screen.getByText('Pendiente de publicación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Publicar resultados$/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /^Publicar resultados$/i }));
    expect(await screen.findByText('Listo para compartir')).toBeInTheDocument();
    expect(mockPublicar).toHaveBeenCalledTimes(2);
  });

  it('no presenta un fallo de generación si el código se publicó pero falla la actualización de su lista', async () => {
    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={vi.fn().mockResolvedValue({})}
        onCodigo={vi.fn().mockResolvedValue({ codigoAccesoId: 'code-dummy-2', codigo: 'DUMMY-2233', expiraEn: '2026-12-31T12:00:00.000Z' })}
        onListarCodigos={vi.fn().mockRejectedValue(new Error('Error al consultar la lista'))}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Generar código de acceso$/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Código generado y publicado, pero no se pudo actualizar la lista/i);
    expect(screen.getByText('DUMMY-2233')).toBeInTheDocument();
    expect(screen.getByText('Listo para compartir')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(emitToast).not.toHaveBeenCalled();
  });

  it('limpia códigos y su lista al cambiar de materia', async () => {
    const mockListar = vi.fn().mockResolvedValue({ codigosAcceso: [
      { id: 'code-dummy-list-1', periodoId: 'per-1', expiraEn: '2026-12-31T12:00:00.000Z', usado: false, estado: 'vigente' }
    ] });
    render(
      <SeccionPublicar
        periodos={[...periodosMock, { _id: 'per-2', nombre: 'Biología', activo: true }]}
        onPublicar={vi.fn().mockResolvedValue({})}
        onCodigo={vi.fn().mockResolvedValue({ codigoAccesoId: 'code-dummy-3', codigo: 'DUMMY-3344', expiraEn: '2026-12-31T12:00:00.000Z' })}
        onListarCodigos={mockListar}
      />
    );

    const selector = screen.getByLabelText(/^Materia para publicar$/i);
    fireEvent.change(selector, { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Generar código de acceso$/i }));
    expect(await screen.findByText('Vigente')).toBeInTheDocument();
    expect(await screen.findByText('DUMMY-3344')).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'per-2' } });
    expect(screen.queryByText('DUMMY-3344')).not.toBeInTheDocument();
    expect(screen.queryByText('Vigente')).not.toBeInTheDocument();
    expect(screen.getByText(/Selecciona “Consultar códigos”/i)).toBeInTheDocument();
  });

  it('distingue una consulta vacía de una consulta aún no realizada', async () => {
    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={vi.fn()}
        onCodigo={vi.fn()}
        onListarCodigos={vi.fn().mockResolvedValue({ codigosAcceso: [] })}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
    expect(screen.getByText(/Selecciona “Consultar códigos”/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Consultar códigos/i }));
    expect(await screen.findByText('No hay códigos de acceso para esta materia.')).toHaveAttribute('role', 'status');
  });

  it('conserva la última lista correcta mientras actualiza códigos y si la consulta falla', async () => {
    const codigoAnterior: CodigoAccesoMetadata = {
      id: 'code-dummy-preservado',
      periodoId: 'per-1',
      expiraEn: '2026-12-31T12:00:00.000Z',
      usado: false,
      estado: 'vigente'
    };
    let rechazarConsulta: ((error: Error) => void) | undefined;
    const mockListar = vi.fn()
      .mockResolvedValueOnce({ codigosAcceso: [codigoAnterior] })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rechazarConsulta = reject; }));

    render(
      <SeccionPublicar
        periodos={periodosMock}
        onPublicar={vi.fn()}
        onCodigo={vi.fn()}
        onListarCodigos={mockListar}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Consultar códigos$/i }));
    expect(await screen.findByText('Vigente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Consultar códigos$/i }));
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/se mantiene visible la última lista correcta/i);

    await act(async () => {
      rechazarConsulta?.(new Error('Fallo de red'));
    });

    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Se conserva la lista de la última consulta correcta/i);
    expect(screen.getByRole('status')).toHaveTextContent(/Fallo de red/i);
  });
});


it('expira un código local solo después de confirmación y conserva aviso de sincronización', async () => {
  const codigo = { id: 'code-1', periodoId: 'per-1', expiraEn: '2026-12-31T00:00:00.000Z', usado: false };
  const mockListar = vi.fn()
    .mockResolvedValueOnce({ codigosAcceso: [{ ...codigo, estado: 'vigente' }] })
    .mockResolvedValueOnce({ codigosAcceso: [{ ...codigo, estado: 'expirado' }] });
  const mockExpirar = vi.fn().mockResolvedValue({ codigoAccesoId: 'code-1', expirado: true });
  render(
    <ConfirmDialogProvider>
      <SeccionPublicar
        periodos={[{ _id: 'per-1', nombre: 'Física Cuántica', activo: true }]}
        onPublicar={vi.fn().mockResolvedValue({})}
        onCodigo={vi.fn().mockResolvedValue({ codigoAccesoId: 'code-1', codigo: 'ABC123', expiraEn: '2026-12-31T00:00:00.000Z' })}
        onListarCodigos={mockListar}
        onExpirarCodigo={mockExpirar}
      />
    </ConfirmDialogProvider>
  );
  fireEvent.change(screen.getByLabelText(/^Materia para publicar$/i), { target: { value: 'per-1' } });
  fireEvent.click(screen.getByRole('button', { name: /Consultar códigos/i }));
  expect(await screen.findByText('Vigente')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Expirar en esta instalación/i }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(/publica los resultados para enviar el cambio/i);
  fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
  expect(mockExpirar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Expirar en esta instalación/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Expirar aquí$/i }));
  await waitFor(() => expect(mockExpirar).toHaveBeenCalledWith('code-1'));
  expect(await screen.findByText(/Publica los resultados para enviar el cambio/i)).toBeInTheDocument();
  expect(await screen.findByText('Expirado')).toBeInTheDocument();
  expect(mockListar).toHaveBeenCalledTimes(2);
});
