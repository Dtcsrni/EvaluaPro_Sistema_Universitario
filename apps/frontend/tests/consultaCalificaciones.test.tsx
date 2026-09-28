/**
 * consultaCalificaciones.test
 *
 * Responsabilidad: validar consulta, filtros y acceso a revisión manual.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConsultaCalificaciones } from '../src/apps/app_docente/ConsultaCalificaciones';

const obtenerMock = vi.fn();
const actualizarMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    actualizar: (...args: unknown[]) => actualizarMock(...args)
  }
}));

describe('ConsultaCalificaciones', () => {
  it('confirma y retira una falta vencida usando la respuesta recalculada del servidor', async () => {
    const user = userEvent.setup();
    const actividad = {
      courseId: 'curso-1', courseWorkId: 'tarea-1', titulo: 'Guía semanal', puntosPosibles: 20,
      puntosObtenidos: null, fechaLimite: '2026-09-20T18:00:00.000Z', estado: 'pendiente' as const, faltanteConfirmado: false
    };
    const filaBase = {
      alumnoId: 'alumno-1', matricula: 'A-001', apellidoPaterno: 'Pérez', apellidoMaterno: '', nombre: 'Ana', grupo: 'A',
      parcial1: '', parcial2: '', resultadoAutomaticoParcial2: '', tareasEjerciciosParcial2: '', puntosObtenidosParcial2: null,
      puntosPosiblesParcial2: null, actividadesCalificadasParcial2: 0, nombresActividadesParcial2: [], actividadesParcial2: [actividad],
      practicaParcial2: '', examenManualParcial2: '', bonoGuiaEstudioParcial2: false, calificacionExamenConBonoParcial2: '',
      evaluacionContinuaParcial2: '', calificacionSegundoParcialFisica: '', global: '', final: '', observaciones: ''
    };
    obtenerMock.mockResolvedValue({ filas: [filaBase] });
    actualizarMock
      .mockResolvedValueOnce({ fila: {
        ...filaBase, tareasEjerciciosParcial2: '0', puntosObtenidosParcial2: 0, puntosPosiblesParcial2: 20,
        actividadesParcial2: [{ ...actividad, estado: 'faltante', faltanteConfirmado: true }]
      } })
      .mockResolvedValueOnce({ fila: filaBase });

    render(<ConsultaCalificaciones periodos={[]} periodoId="periodo-1" onPeriodoChange={() => {}} onSeleccionarAlumno={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalle de Pérez Ana' }));
    const controlFaltante = screen.getByRole('checkbox', { name: 'Marcar Guía semanal como faltante' });
    expect(controlFaltante).toBeEnabled();
    await user.click(controlFaltante);

    await waitFor(() => expect(actualizarMock).toHaveBeenCalledWith(
      '/analiticas/lista-academica/alumno-1/parcial2/faltantes',
      { periodoId: 'periodo-1', courseId: 'curso-1', courseWorkId: 'tarea-1', faltante: true }
    ));
    expect(await screen.findByText(/Se considera 0 puntos/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar Guía semanal como faltante' })).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Marcar Guía semanal como faltante' }));
    await waitFor(() => expect(actualizarMock).toHaveBeenLastCalledWith(
      '/analiticas/lista-academica/alumno-1/parcial2/faltantes',
      { periodoId: 'periodo-1', courseId: 'curso-1', courseWorkId: 'tarea-1', faltante: false }
    ));
    expect(await screen.findByText(/Se retiró la falta/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar Guía semanal como faltante' })).not.toBeChecked();
  });

  it('impide marcar faltantes si no venció o si Classroom ya publicó una calificación', async () => {
    const user = userEvent.setup();
    obtenerMock.mockResolvedValue({ filas: [{
      alumnoId: 'alumno-1', matricula: 'A-001', apellidoPaterno: 'Pérez', apellidoMaterno: '', nombre: 'Ana', grupo: 'A',
      parcial1: '', parcial2: '', global: '', final: '', observaciones: '', actividadesParcial2: [
        { courseId: 'c1', courseWorkId: 'futura', titulo: 'Actividad futura', puntosPosibles: 10, puntosObtenidos: null, fechaLimite: '2099-09-20T18:00:00.000Z', estado: 'pendiente', faltanteConfirmado: false },
        { courseId: 'c1', courseWorkId: 'publicada', titulo: 'Actividad calificada', puntosPosibles: 10, puntosObtenidos: 0, fechaLimite: '2020-09-20T18:00:00.000Z', estado: 'calificada', faltanteConfirmado: false }
      ]
    }] });
    render(<ConsultaCalificaciones periodos={[]} periodoId="periodo-1" onPeriodoChange={() => {}} onSeleccionarAlumno={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalle de Pérez Ana' }));
    expect(screen.getByRole('checkbox', { name: 'Marcar Actividad futura como faltante' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Marcar Actividad calificada como faltante' })).toBeDisabled();
    expect(actualizarMock).not.toHaveBeenCalled();
  });

  it('guarda captura manual idempotente y mantiene separado el resultado OMR', async () => {
    const user = userEvent.setup();
    obtenerMock.mockResolvedValue({ filas: [{
      alumnoId: 'alumno-1', matricula: 'A-001', apellidoPaterno: 'Pérez', apellidoMaterno: '', nombre: 'Ana', grupo: 'A',
      parcial1: '', parcial2: '', resultadoAutomaticoParcial2: '4.25', tareasEjerciciosParcial2: '8',
      puntosObtenidosParcial2: 40, puntosPosiblesParcial2: 50, actividadesCalificadasParcial2: 3, nombresActividadesParcial2: ['Guía'],
      practicaParcial2: '', examenManualParcial2: '', bonoGuiaEstudioParcial2: false, calificacionExamenConBonoParcial2: '',
      global: '', final: '', observaciones: ''
    }] });
    actualizarMock.mockResolvedValue({ captura: { ok: true } });

    render(<ConsultaCalificaciones periodos={[]} periodoId="periodo-1" onPeriodoChange={() => {}} onSeleccionarAlumno={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Ver detalle de Pérez Ana' }));
    await user.type(screen.getByLabelText('Practica 2do Parcial (0–10)'), '8.5');
    await user.type(screen.getByLabelText('Exámen 2do Parcial (0–5 antes del bono)'), '4.5');
    await user.click(screen.getByLabelText('Bono de guía de estudio (+0.25)'));
    await user.click(screen.getByRole('button', { name: 'Guardar captura manual' }));

    await waitFor(() => expect(actualizarMock).toHaveBeenCalledWith('/analiticas/lista-academica/alumno-1/parcial2', {
      periodoId: 'periodo-1', practicaDecimal: 8.5, examenDecimal: 4.5, bonoGuiaEstudio: true
    }));
    expect(await screen.findByText(/resultado OMR permanece separado/i)).toBeInTheDocument();
    expect(screen.getAllByText('4.25').length).toBeGreaterThan(0);
    expect(screen.getByText(/incluye bono \+0\.25/)).toBeInTheDocument();
    expect(screen.getAllByText('4.1').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Evaluación Continua 2do Parcial' })).toBeInTheDocument();
  });

  it('consulta, filtra y abre la revisión del alumno', async () => {
    const user = userEvent.setup();
    const seleccionarAlumno = vi.fn();
    obtenerMock.mockResolvedValue({
      filas: [
        {
          alumnoId: 'alumno-1',
          matricula: 'A-001',
          apellidoPaterno: 'Pérez',
          apellidoMaterno: 'López',
          nombre: 'Ana',
          grupo: 'A',
          parcial1: '7.5',
          parcial2: '8.2',
          global: '9.1',
          final: '9.1',
          observaciones: ''
        },
        {
          alumnoId: 'alumno-2',
          matricula: 'A-002',
          apellidoPaterno: 'Gómez',
          apellidoMaterno: 'Ruiz',
          nombre: 'Luis',
          grupo: 'B',
          parcial1: '',
          parcial2: '',
          global: '',
          final: '',
          observaciones: ''
        }
      ]
    });

    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Inteligencia de Negocios' } as never]}
        periodoId="periodo-1"
        onPeriodoChange={() => {}}
        onSeleccionarAlumno={seleccionarAlumno}
      />
    );

    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    const resumen = document.querySelector('.calificaciones-consulta__summary');
    expect(resumen).toHaveTextContent('2 alumnos');
    expect(resumen).toHaveTextContent('1 calificados');
    expect(resumen).toHaveTextContent('1 pendientes');

    await user.click(screen.getByRole('button', { name: 'Pendientes' }));
    expect(screen.queryByText('Pérez López Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Gómez Ruiz Luis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.click(screen.getByRole('button', { name: 'Abrir revisión manual' }));
    expect(seleccionarAlumno).toHaveBeenCalledWith('alumno-1');
  });

  it('recarga la lista cuando cambia la marca de actualización', async () => {
    obtenerMock
      .mockResolvedValueOnce({ filas: [{ alumnoId: 'alumno-1', matricula: 'A-001', nombre: 'Ana', apellidoPaterno: '', apellidoMaterno: '', grupo: 'A', parcial1: '', parcial2: '', global: '', final: '', observaciones: '' }] })
      .mockResolvedValueOnce({ filas: [{ alumnoId: 'alumno-1', matricula: 'A-001', nombre: 'Ana', apellidoPaterno: '', apellidoMaterno: '', grupo: 'A', parcial1: '8', parcial2: '', global: '', final: '8', observaciones: '' }] });
    const { rerender } = render(
      <ConsultaCalificaciones
        periodos={[]}
        periodoId="periodo-1"
        actualizacion={0}
        onPeriodoChange={() => {}}
        onSeleccionarAlumno={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Pendiente', { exact: true })).toBeInTheDocument());
    rerender(
      <ConsultaCalificaciones
        periodos={[]}
        periodoId="periodo-1"
        actualizacion={1}
        onPeriodoChange={() => {}}
        onSeleccionarAlumno={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText('Calificada', { exact: true })).toBeInTheDocument());
  });

  it('presenta el error de consulta al backend', async () => {
    obtenerMock.mockRejectedValue(new Error('Servicio no disponible'));
    render(
      <ConsultaCalificaciones
        periodos={[]}
        periodoId="periodo-1"
        onPeriodoChange={() => {}}
        onSeleccionarAlumno={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByText(/Servicio no disponible/i)).toBeInTheDocument());
  });
});
