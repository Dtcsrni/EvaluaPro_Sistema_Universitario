/**
 * seccionCalificaciones.resumen
 *
 * Contrato de consulta rápida por alumno y tipo de examen.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConsultaCalificaciones } from '../src/apps/app_docente/ConsultaCalificaciones';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    enviar: (...args: unknown[]) => enviarMock(...args)
  }
}));

describe('ConsultaCalificaciones', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    enviarMock.mockReset().mockResolvedValue({ ok: true });
    obtenerMock.mockResolvedValue({
      filas: [
        {
          alumnoId: 'alumno-1',
          matricula: 'A001',
          apellidoPaterno: 'Pérez',
          apellidoMaterno: 'López',
          nombre: 'Ana',
          grupo: 'A',
          parcial1: '8',
          parcial2: '9.876',
          global: '10',
          final: '10',
          examenGlobalComponente: '8',
          examenGlobalLista: '4',
          examenGlobalListaVersion: 2,
          continuaTercerParcialLista: '4.25',
          calificacionTercerParcial: '8.25',
          observaciones: '',
          tareasYEjercicios2doParcial: '8.5',
          tareasPuntosObtenidos: '170',
          tareasPuntosPosibles: '200',
          practica2doParcial: '',
          practica2doParcialVersion: null,
          evaluacionContinua2doParcial: '',
          examen2doParcial: '',
          examen2doParcialAutomatico: '4.75',
          examen2doParcialVersion: null,
          calificacionSegundoParcial: ''
        },
        {
          alumnoId: 'alumno-2',
          matricula: 'A002',
          apellidoPaterno: 'Soto',
          apellidoMaterno: '',
          nombre: 'Luis',
          grupo: 'A',
          parcial1: '',
          parcial2: '',
          global: '',
          final: '',
          observaciones: ''
        }
      ]
    });
  });

  it('muestra las notas por examen, permite filtrar y abre el detalle del alumno', async () => {
    const user = userEvent.setup();
    const onSeleccionarAlumno = vi.fn();

    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={onSeleccionarAlumno}
      />
    );

    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('9.88')).toBeInTheDocument();
    expect(screen.getAllByText('10')).toHaveLength(2);
    expect(screen.getByText('A002')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pendientes' }));
    expect(screen.queryByText('Pérez López Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Soto Luis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.click(screen.getAllByRole('button', { name: /Ver detalle de/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Abrir revisión manual' }));
    expect(onSeleccionarAlumno).toHaveBeenCalledWith('alumno-1');
    expect((clienteApi as { obtener: unknown }).obtener).toBeDefined();
  });

  it('permite consultar y actualizar materias archivadas sin reactivarlas', async () => {
    const user = userEvent.setup();
    const onSeleccionarAlumno = vi.fn();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-archivado', nombre: 'Inteligencia de Negocios', activo: false }]}
        periodoId="periodo-archivado"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={onSeleccionarAlumno}
      />
    );

    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/analiticas/lista-academica?periodoId=periodo-archivado'));
    expect(screen.getByRole('option', { name: /Inteligencia de Negocios .* \(Archivada\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Materia archivada: estás consultando el historial/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-archivado', alumnoId: 'alumno-1', componente: 'Practica 2do Parcial', calificacion: 7.5
    })));
    await user.click(screen.getByRole('button', { name: 'Abrir revisión manual' }));
    expect(onSeleccionarAlumno).toHaveBeenCalledWith('alumno-1');
  });

  it('captura el puntaje total de Exámen Global en escala física 0–5 y conserva la versión', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    const global = screen.getByRole('spinbutton', { name: 'Exámen Global manual · 0–5' });
    await user.clear(global);
    await user.type(global, '4.5');
    await user.click(screen.getByRole('button', { name: 'Guardar Global' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-1',
      alumnoId: 'alumno-1',
      componente: 'Exámen Global',
      calificacion: 4.5,
      version: 2
    })));
  });

  it('muestra la referencia automática separada y envía práctica manual con nombre de columna', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    expect(screen.getByText('Exámen 2do Parcial automático · referencia')).toBeInTheDocument();
    expect(screen.getByText('Exámen Global · componente fuente 0–10')).toBeInTheDocument();
    expect(screen.getByText('Evaluación Continua 3er Parcial · 0–5')).toBeInTheDocument();
    expect(screen.getByText('8.25')).toBeInTheDocument();
    expect(screen.getByText(/no sustituye la captura manual/)).toBeInTheDocument();
    await user.type(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', {
      periodoId: 'periodo-1', alumnoId: 'alumno-1', componente: 'Practica 2do Parcial', calificacion: 7.5,
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    }));
  });

  it('conserva otro borrador manual mientras refresca la fila después de guardar', async () => {
    const fila = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '8', parcial2: '9.876', global: '10', final: '10', observaciones: '',
      practica2doParcial: '', practica2doParcialVersion: null, examen2doParcial: '', examen2doParcialVersion: null,
      examenGlobalLista: '4', examenGlobalListaVersion: 2, tareasYEjercicios2doParcial: '8.5',
      tareasPuntosObtenidos: '170', tareasPuntosPosibles: '200', examen2doParcialAutomatico: '4.75',
      evaluacionContinua2doParcial: '', calificacionSegundoParcial: ''
    };
    obtenerMock
      .mockResolvedValueOnce({ filas: [fila] })
      .mockResolvedValueOnce({ filas: [{ ...fila, practica2doParcial: '7.5', practica2doParcialVersion: 1 }] });
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Exámen 2do Parcial · 0–5.25' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Exámen 2do Parcial · 0–5.25' }), '5.25');
    await user.type(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Exámen 2do Parcial · 0–5.25' })).toHaveValue(5.25));
    await user.click(screen.getByRole('button', { name: 'Guardar examen' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    expect(enviarMock.mock.calls[1][1]).toEqual(expect.objectContaining({ componente: 'Exámen 2do Parcial', calificacion: 5.25 }));
  });

  it('reconcilia la lista si se pierde la respuesta después de guardar', async () => {
    let consultas = 0;
    obtenerMock.mockImplementation(async () => {
      consultas += 1;
      const guardada = consultas > 1;
      return {
        filas: [
          {
            alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
            parcial1: '8', parcial2: '9.876', global: '10', final: '10', observaciones: '', tareasYEjercicios2doParcial: '8.5',
            tareasPuntosObtenidos: '170', tareasPuntosPosibles: '200', practica2doParcial: guardada ? '7.5' : '',
            practica2doParcialVersion: guardada ? 1 : null, evaluacionContinua2doParcial: '', examen2doParcial: '',
            examen2doParcialAutomatico: '4.75', examen2doParcialVersion: null, calificacionSegundoParcial: ''
          }
        ]
      };
    });
    enviarMock.mockRejectedValueOnce(new Error('respuesta perdida'));
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' })).toHaveValue(7.5);
    expect(screen.queryByText('respuesta perdida')).not.toBeInTheDocument();
  });

  it('reutiliza clientRequestId si la respuesta y la lectura de recuperación quedan inciertas', async () => {
    let consultas = 0;
    obtenerMock.mockImplementation(async () => {
      consultas += 1;
      if (consultas === 2 || consultas === 3) throw new Error('lectura temporalmente no disponible');
      const guardada = consultas >= 4;
      return { filas: [{
        alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
        parcial1: '8', parcial2: '9.876', global: '10', final: '10', observaciones: '', tareasYEjercicios2doParcial: '8.5',
        tareasPuntosObtenidos: '170', tareasPuntosPosibles: '200', practica2doParcial: guardada ? '7.5' : '',
        practica2doParcialVersion: guardada ? 1 : null, evaluacionContinua2doParcial: '', examen2doParcial: '',
        examen2doParcialAutomatico: '4.75', examen2doParcialVersion: null, calificacionSegundoParcial: ''
      }] };
    });
    enviarMock.mockRejectedValueOnce(new Error('respuesta incierta')).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);
    await screen.findByText('Pérez López Ana');
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Practica 2do Parcial · 0–10' }), '7.5');
    const guardar = screen.getByRole('button', { name: 'Guardar práctica' });
    await user.click(guardar);
    await screen.findByText('respuesta incierta');
    await user.click(guardar);
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    const escrituras = enviarMock.mock.calls.filter(([ruta]) => ruta === '/analiticas/lista-academica/calificaciones');
    expect(escrituras).toHaveLength(2);
    expect(escrituras[0][1].clientRequestId).toBe(escrituras[1][1].clientRequestId);
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledTimes(4));
    expect(screen.queryByText('respuesta incierta')).not.toBeInTheDocument();
  });

  it('previsualiza el bono y solo lo guarda tras confirmación explícita', async () => {
    const preview = {
      alumnoId: 'alumno-1', bonoSolicitado: '0.5', bonoAplicado: '0.5',
      bonoDistribucion: { continuaGlobal: 0.5, examenGlobal: 0, continuaParcial2: 0, examenParcial2: 0, continuaParcial1: 0, examenParcial1: 0 },
      parcial1: '8', parcial2: '9.5', parcial3: '9.5', calificacionFinalCurso: '9.4',
      regla: 'continua-primero; global-c3, p2, p1', requiereConfirmacion: true
    };
    enviarMock.mockResolvedValue({ preview });
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Bono solicitado · 0–1' }), '0.5');
    await user.click(screen.getByRole('button', { name: 'Previsualizar bono' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/bono/preview', {
      periodoId: 'periodo-1', alumnoId: 'alumno-1', bono: 0.5
    }));
    expect(screen.getByText(/Vista previa: aplicado 0.5 de 0.5/)).toBeInTheDocument();
    expect(screen.getByText('Continua · Global (tercer parcial): +0.5')).toBeInTheDocument();
    expect(enviarMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar bono' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-1', alumnoId: 'alumno-1', componente: 'Bono extracurricular', calificacion: 0.5,
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    })));
  });

  it('reutiliza clientRequestId al recuperar un guardado de bono con respuesta incierta', async () => {
    const preview = {
      alumnoId: 'alumno-1', bonoSolicitado: '0.5', bonoAplicado: '0.5',
      parcial1: '8', parcial2: '9.5', parcial3: '9.5', calificacionFinalCurso: '9.4',
      regla: 'continua-primero; global-c3, p2, p1', requiereConfirmacion: true
    };
    enviarMock.mockResolvedValueOnce({ preview }).mockRejectedValueOnce(new Error('respuesta perdida')).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );
    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Ver detalle de Pérez López Ana' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Bono solicitado · 0–1' }), '0.5');
    await user.click(screen.getByRole('button', { name: 'Previsualizar bono' }));
    await screen.findByText(/Vista previa: aplicado 0.5 de 0.5/);
    const confirmar = screen.getByRole('button', { name: 'Confirmar y guardar bono' });
    await user.click(confirmar);
    await screen.findByText('respuesta perdida');
    await user.click(confirmar);
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(3));
    const escrituras = enviarMock.mock.calls.filter(([ruta]) => ruta === '/analiticas/lista-academica/calificaciones');
    expect(escrituras).toHaveLength(2);
    expect(escrituras[0][1].clientRequestId).toBe(escrituras[1][1].clientRequestId);
  });
});
