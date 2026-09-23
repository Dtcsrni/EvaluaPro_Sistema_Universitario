/**
 * seccionAsistencias.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionAsistencias } from '../src/apps/app_docente/SeccionAsistencias';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { emitToast } from '../src/ui/toast/toastBus';

vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn()
  }
}));

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

describe('SeccionAsistencias (Resiliencia)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maneja fallos de red al cargar el resumen de asistencias sin colapsar', async () => {
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('DB Timeout Connection'));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar={true}
      />
    );

    // Seleccionamos un periodo para gatillar la carga
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'per-1' }
    });

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    // La UI no debe crashear, debe mantener el título principal visible
    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });

  it('maneja fallos al guardar un pase de lista (DB offline)', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [] });
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Network Error'));

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
        puedeGestionar={true}
      />
    );

    // Cambiar el periodo para que se muestre el formulario de "Nueva sesión"
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.change(comboboxes[0], {
      target: { value: 'per-1' }
    });

    // Esperar a que renderice "Crear e iniciar"
    await screen.findByRole('button', { name: /Crear e iniciar/i });

    // Cambiar el grupo en el select de la sesión nueva
    const selects = screen.getAllByRole('combobox');
    if (selects.length > 1) {
      fireEvent.change(selects[1], { target: { value: 'A' } });
    }

    // Guardar (Crear sesión)
    fireEvent.click(screen.getByRole('button', { name: /Crear e iniciar/i }));

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      );
    });

    expect(screen.getByRole('heading', { name: /Asistencias/i })).toBeInTheDocument();
  });

  it('permite configurar y guardar reglas de asistencia con conteo de retardos', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      resumen: [],
      sesiones: [],
      reglas: [
        { _id: 'reg-1', maxFaltas: 3, accion: 'bloquear_examen', grupo: 'A', contarRetardos: true, retardosEquivalenFalta: 3 }
      ]
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ regla: { _id: 'reg-1', maxFaltas: 4, accion: 'bloquear_examen' } });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1' }]}
        puedeGestionar={true}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    // Navegar a pestaña reglas
    const tabReglas = screen.getByRole('button', { name: /Reglas/i });
    fireEvent.click(tabReglas);

    // Habilitar conteo de retardos
    const checkboxRetardo = screen.getByRole('checkbox');
    fireEvent.click(checkboxRetardo);

    const btnGuardar = screen.getByRole('button', { name: /Guardar regla/i });
    fireEvent.click(btnGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/asistencias/reglas', expect.objectContaining({
        periodoId: 'per-1',
        contarRetardos: true
      }));
    });
  });

  it('permite marcar a todos presentes y guardar el pase de lista', async () => {
    vi.mocked(clienteApi.obtener).mockImplementation(async (url: string) => {
      if (url.includes('/asistencias/sesiones/ses-1/registros')) {
        return { registros: [] };
      }
      if (url.includes('/asistencias/sesiones')) {
        return { sesiones: [{ _id: 'ses-1', fecha: '2026-08-21T12:00:00Z', grupo: 'A' }] };
      }
      return { resumen: [], reglas: [] };
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({ guardados: 1 });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
        puedeGestionar={true}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'per-1' } });

    const btnSesion = await screen.findByRole('button', { name: /21 ago.*A/i });
    fireEvent.click(btnSesion);

    const btnTodosPresentes = await screen.findByRole('button', { name: /Todos Presentes/i });
    fireEvent.click(btnTodosPresentes);

    fireEvent.click(screen.getByRole('button', { name: /Marcar a Alumno 1 como Falta/i }));

    const btnGuardarLista = screen.getByRole('button', { name: /Guardar lista/i });
    fireEvent.click(btnGuardarLista);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith(
        '/asistencias/sesiones/ses-1/registros',
        expect.anything()
      );
    });
  });

  it('crea la lista solo para el grupo elegido y permite marcar Justificada directamente', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({
      sesion: { _id: 'ses-2', fecha: '2026-09-22T12:00:00.000Z', grupo: 'B' }
    }).mockResolvedValueOnce({ total: 1 });

    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A', 'B'] }]}
        alumnos={[
          { _id: 'alu-a', nombreCompleto: 'Alumno Grupo A', matricula: 'A1', periodoId: 'per-1', grupo: 'A' },
          { _id: 'alu-b', nombreCompleto: 'Alumno Grupo B', matricula: 'B1', periodoId: 'per-1', grupo: 'B' },
          { _id: 'alu-otro-periodo', nombreCompleto: 'Alumno Otro Periodo', matricula: 'C1', periodoId: 'per-2', grupo: 'B' }
        ]}
        puedeGestionar
      />
    );

    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'B' } });
    fireEvent.click(await screen.findByRole('button', { name: /Crear e iniciar/i }));

    expect(await screen.findByText('Alumno Grupo B')).toBeInTheDocument();
    expect(screen.queryByText('Alumno Grupo A')).not.toBeInTheDocument();
    expect(screen.queryByText('Alumno Otro Periodo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Marcar a Alumno Grupo B como Justificada/i }));
    const motivo = screen.getByRole('textbox', { name: 'Motivo de justificación para Alumno Grupo B' });
    expect(motivo).toHaveAttribute('maxLength', '300');
    fireEvent.change(motivo, { target: { value: 'Cita médica' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar lista/i }));

    await waitFor(() => expect(clienteApi.enviar).toHaveBeenLastCalledWith(
      '/asistencias/sesiones/ses-2/registros',
      { registros: [{ alumnoId: 'alu-b', estado: 'J', justificacion: 'Cita médica' }] }
    ));
  });

  it('mantiene en solo lectura los controles de gestión', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ resumen: [], sesiones: [], reglas: [] });
    render(
      <SeccionAsistencias
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1', activo: true, grupos: ['A'] }]}
        alumnos={[{ _id: 'alu-1', nombreCompleto: 'Alumno 1', matricula: 'A1', periodoId: 'per-1', grupo: 'A' }]}
      />
    );
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'per-1' } });
    expect(await screen.findByText(/Tienes acceso de solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear e iniciar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Reglas/i }));
    expect(screen.getByRole('button', { name: /Guardar regla/i })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: /Máximo de faltas/i })).toBeDisabled();
  });
});

