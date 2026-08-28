/**
 * seccionEvaluaciones.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionEvaluaciones } from '../src/apps/app_docente/SeccionEvaluaciones';
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

vi.mock('../src/apps/app_docente/CentroClassroom', () => ({
  CentroClassroom: () => <div data-testid="centro-classroom">Mock CentroClassroom</div>
}));

describe('SeccionEvaluaciones', () => {
  const periodosMock = [
    { _id: 'per-1', nombre: 'Periodo 2026-A', activo: true }
  ];

  const alumnosMock = [
    { _id: 'alu-1', nombreCompleto: 'Juan Pérez', periodoId: 'per-1', matricula: 'A100' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza correctamente y carga el contexto de políticas del periodo', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValueOnce({
      politicas: [
        { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026' }
      ],
      configuracion: {
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1
      }
    });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    expect(screen.getByText('Evaluaciones y políticas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^política$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^evidencias$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^exámenes$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resumen$/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(clienteApi.obtener).toHaveBeenCalledWith('/evaluaciones/v2/contexto?periodoId=per-1');
    });
  });

  it('permite guardar la configuración de política y maneja errores de guardado', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({
      politicas: [
        { codigo: 'POLICY_LISC_ENCUADRE_2026', version: 1, nombre: 'LISC Encuadre 2026' }
      ]
    });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    const botonGuardar = screen.getByRole('button', { name: /guardar política/i });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/politica', {
        periodoId: 'per-1',
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1
      });
    });

    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ok', title: 'Evaluaciones' })
    );

    // Prueba de fallo al guardar política
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Politica Save Failed'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar la configuración')).toBeInTheDocument();
    });
  });

  it('permite cambiar a la pestaña de evidencias, guardar y capturar error', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabEvidencias = screen.getByRole('button', { name: /evidencias/i });
    fireEvent.click(tabEvidencias);

    const inputTitulo = screen.getByLabelText(/evidencia título/i);
    fireEvent.change(inputTitulo, { target: { value: 'Tarea 1' } });

    const selectCorte = screen.getByLabelText(/corte/i);
    fireEvent.change(selectCorte, { target: { value: '2' } });

    const botonGuardar = screen.getByRole('button', { name: /guardar evidencia/i });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/evidencias', {
        periodoId: 'per-1',
        alumnoId: 'alu-1',
        titulo: 'Tarea 1',
        calificacionDecimal: 10,
        ponderacion: 1,
        corte: 2
      });
    });

    // Error al guardar evidencia
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Evidencia Error'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'Evaluaciones' })
      );
    });
  });

  it('permite cambiar a la pestaña de exámenes, guardar y capturar error', async () => {
    vi.mocked(clienteApi.obtener).mockResolvedValue({ politicas: [] });
    vi.mocked(clienteApi.enviar).mockResolvedValueOnce({});

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
        puedeClassroomConectar={false}
        puedeClassroomPull={false}
        classroomDisponible={false}
      />
    );

    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabExamenes = screen.getByRole('button', { name: /exámenes/i });
    fireEvent.click(tabExamenes);

    const selectCorte = screen.getByLabelText(/corte examen/i);
    fireEvent.change(selectCorte, { target: { value: 'parcial2' } });

    const botonGuardar = screen.getByRole('button', { name: /guardar examen/i });
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(clienteApi.enviar).toHaveBeenCalledWith('/evaluaciones/v2/examenes/componentes', {
        periodoId: 'per-1',
        alumnoId: 'alu-1',
        corte: 'parcial2',
        teoricoDecimal: 10,
        practicas: [10]
      });
    });

    // Error al guardar examen
    vi.mocked(clienteApi.enviar).mockRejectedValueOnce(new Error('Examen Error'));
    fireEvent.click(botonGuardar);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'Evaluaciones' })
      );
    });
  });

  it('permite consultar el resumen y navegar a classroom cuando está habilitado', async () => {
    vi.mocked(clienteApi.obtener)
      .mockResolvedValueOnce({ politicas: [] })
      .mockResolvedValueOnce({
        resumen: {
          politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
          politicaVersion: 1,
          continuaPorCorte: { c1: 9.5, c2: 8.0, c3: 10 },
          examenesPorCorte: { parcial1: 10, parcial2: 9, global: 0 },
          bloqueContinuaDecimal: 9.1666,
          bloqueExamenesDecimal: 9.5,
          finalDecimal: 9.3333,
          finalRedondeada: 9,
          faltantes: ['Evidencia 2', 'Examen Parcial 3']
        }
      });

    render(
      <SeccionEvaluaciones
        periodos={periodosMock}
        alumnos={alumnosMock}
        puedeGestionar={true}
      />
    );

    // Seleccionar alumno y consultar resumen
    const selectAlumno = screen.getByLabelText(/alumno/i);
    fireEvent.change(selectAlumno, { target: { value: 'alu-1' } });

    const tabResumen = screen.getByRole('button', { name: /resumen/i });
    fireEvent.click(tabResumen);

    const botonConsultar = screen.getByRole('button', { name: /consultar resumen/i });
    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(screen.getByText(/Final decimal: 9.3333/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Faltantes: Evidencia 2, Examen Parcial 3/i)).toBeInTheDocument();

    // Error al consultar resumen
    vi.mocked(clienteApi.obtener).mockRejectedValueOnce(new Error('Resumen Fetch Error'));
    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(emitToast).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', title: 'Evaluaciones' })
      );
    });
  });
});
