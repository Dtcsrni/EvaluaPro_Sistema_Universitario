/**
 * seccionCalificaciones.resumen
 *
 * Contrato de consulta rápida por alumno y tipo de examen.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConsultaCalificaciones } from '../src/apps/app_docente/ConsultaCalificaciones';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

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
    vi.unstubAllGlobals();
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
          tareasYEjerciciosPrimerParcial: '',
          practicaPrimerParcial: '',
          examenPrimerParcialAutomatico: '4',
          examenPrimerParcialLista: '',
          examenPrimerParcialListaVersion: null,
          continuaPrimerParcialLista: '4',
          calificacionPrimerParcialLista: '8',
          parcial2: '9.876',
          global: '10',
          final: '10',
          examenGlobalComponente: '8',
          examenGlobalLista: '4',
          examenGlobalListaVersion: 2,
          continuaTercerParcialLista: '4.25',
          calificacionTercerParcial: '8.25',
          ponderacionTercerParcialLista: '4.95',
          subtotalPrimerSegundoParcialLista: '8.94',
          ponderacionPrimerSegundoParcialesLista: '3.576',
          calificacionFinalLibroLista: '8.526',
          calificacionFinalBase10Lista: '0.8526',
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

  it('no presenta conteos como ceros y explica que los filtros esperan una materia', async () => {
    const onResumenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[]}
        periodoId=""
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
        onResumenChange={onResumenChange}
      />
    );

    expect(screen.getByText('Selecciona una materia para consultar sus calificaciones.')).toBeInTheDocument();
    expect(screen.queryByText('0 alumnos')).not.toBeInTheDocument();
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
    expect(document.querySelector('.calificaciones-consulta__result-meta')).not.toBeInTheDocument();
    expect(onResumenChange).not.toHaveBeenCalled();

    const grupoFiltros = screen.getByRole('group', { name: 'Filtrar alumnos' });
    const todos = screen.getByRole('button', { name: 'Todos' });
    expect(grupoFiltros).toHaveAttribute('aria-disabled', 'true');
    expect(grupoFiltros).toHaveAccessibleDescription('Selecciona una materia para activar los filtros.');
    expect(todos).toHaveAttribute('aria-disabled', 'true');
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    const calificados = screen.getByRole('button', { name: 'Con calificación' });
    await user.tab();
    expect(screen.getByRole('combobox', { name: 'Materia' })).toHaveFocus();
    await user.tab();
    expect(todos).toHaveFocus();
    await user.tab();
    expect(calificados).toHaveFocus();
    await user.keyboard(' ');
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    expect(calificados).toHaveAttribute('aria-pressed', 'false');
  });

  it('confirma los ceros solo después de cargar una materia sin alumnos', async () => {
    const onResumenChange = vi.fn();
    obtenerMock.mockResolvedValueOnce({ filas: [] });
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-vacio', nombre: 'Materia vacía' }]}
        periodoId="periodo-vacio"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
        onResumenChange={onResumenChange}
      />
    );

    expect(await screen.findByText('No hay alumnos registrados en esta materia.')).toBeInTheDocument();
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
    expect(onResumenChange).toHaveBeenLastCalledWith({ periodoId: 'periodo-vacio', total: 0, calificados: 0, pendientes: 0 });
  });

  it('oculta los conteos cuando falla la carga y permite reintentarla', async () => {
    const onResumenChange = vi.fn();
    obtenerMock.mockRejectedValueOnce(new Error('Servicio no disponible'));
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-error', nombre: 'Materia de prueba' }]}
        periodoId="periodo-error"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
        onResumenChange={onResumenChange}
      />
    );

    expect(await screen.findByText(/No se pudo cargar la consulta: Servicio no disponible/)).toBeInTheDocument();
    expect(screen.queryByText('0 alumnos')).not.toBeInTheDocument();
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
    expect(onResumenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
    expect(await screen.findByText('Pérez López Ana')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Todos los alumnos · 2 visibles');
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
    expect(onResumenChange).toHaveBeenLastCalledWith({ periodoId: 'periodo-error', total: 2, calificados: 1, pendientes: 1 });
    expect(within(screen.getByRole('row', { name: /Pérez López Ana/ })).getByText('Con calificación')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Soto Luis/ })).getByText('Sin calificación')).toBeInTheDocument();
    expect(obtenerMock).toHaveBeenCalledTimes(2);
  });

  it('explica cómo recuperar un error de conexión sin mostrar detalles técnicos', async () => {
    obtenerMock.mockRejectedValueOnce(new ErrorRemoto('API no disponible', {
      mensaje: 'Sin conexion',
      detalles: 'connect ECONNREFUSED 127.0.0.1:4000'
    }));
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-error', nombre: 'Materia de prueba' }]}
        periodoId="periodo-error"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Sin conexion');
    expect(error).toHaveTextContent('Tip: inicia el servicio backend de EvaluaPro o recarga la pagina.');
    expect(error).not.toHaveTextContent('ECONNREFUSED');
    expect(error).not.toHaveTextContent('127.0.0.1:4000');
    expect(screen.getByRole('button', { name: 'Reintentar consulta' })).toBeInTheDocument();
  });

  it('usa etiquetas singulares cuando hay un solo alumno', async () => {
    obtenerMock.mockResolvedValueOnce({ filas: [{
      alumnoId: 'alumno-unico', matricula: 'DUMMY-001', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', nombre: 'Alex',
      grupo: '2A', parcial1: '8.5', parcial2: '', global: '', final: '', observaciones: ''
    }] });
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    expect(await screen.findByText('Ejemplo Alex')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Todos los alumnos · 1 visible$/);
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
  });

  it('usa el ID canónico como clave interna y conserva filas con matrícula repetida', async () => {
    obtenerMock.mockResolvedValueOnce({ filas: [
      { alumnoId: 'alumno-canonico-1', matricula: 'DUP-001', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', nombre: 'Alex', grupo: 'A', parcial1: '8', parcial2: '', global: '', final: '', observaciones: '' },
      { alumnoId: 'alumno-canonico-2', matricula: 'DUP-001', apellidoPaterno: 'Muestra', apellidoMaterno: '', nombre: 'Sam', grupo: 'B', parcial1: '', parcial2: '', global: '', final: '', observaciones: '' }
    ] });
    const errorReact = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    expect(await screen.findByText('Ejemplo Alex')).toBeInTheDocument();
    expect(screen.getByText('Muestra Sam')).toBeInTheDocument();
    expect(document.querySelectorAll('.calificaciones-consulta__table tbody tr')).toHaveLength(2);
    expect(errorReact.mock.calls.flat().join(' ')).not.toContain('same key');
    expect(document.body.textContent).not.toContain('alumno-canonico-1');
    expect(document.body.textContent).not.toContain('alumno-canonico-2');
    errorReact.mockRestore();
  });

  it('distingue los controles de detalle de alumnos homónimos por matrícula y grupo', async () => {
    obtenerMock.mockResolvedValueOnce({ filas: [
      { alumnoId: 'alumno-a', matricula: 'DUMMY-101', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', nombre: 'Ana', grupo: 'A', parcial1: '', parcial2: '', global: '', final: '', observaciones: '' },
      { alumnoId: 'alumno-b', matricula: 'DUMMY-202', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', nombre: 'Ana', grupo: 'B', parcial1: '', parcial2: '', global: '', final: '', observaciones: '' }
    ] });

    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    const botonGrupoA = await screen.findByRole('button', { name: 'Ver detalle de Ejemplo Ana · matrícula DUMMY-101 · grupo A' });
    const botonGrupoB = screen.getByRole('button', { name: 'Ver detalle de Ejemplo Ana · matrícula DUMMY-202 · grupo B' });
    expect(botonGrupoA).toHaveTextContent('Ver detalle');
    expect(botonGrupoB).toHaveTextContent('Ver detalle');
  });

  it('identifica la materia por nombre y fecha sin mostrar el ID interno', () => {
    const periodoId = 'periodo-interno-12345678';
    render(<ConsultaCalificaciones
      periodos={[{ _id: periodoId, nombre: 'Materia de prueba', fechaInicio: '2026-09-27' }]}
      periodoId={periodoId}
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    const selector = screen.getByLabelText('Materia');
    const opcion = within(selector).getByRole('option', { name: 'Materia de prueba · inicia 27/09/2026' });
    expect(opcion).toHaveValue(periodoId);
    expect(opcion).not.toHaveTextContent(periodoId);
    expect(selector).toHaveAccessibleDescription('Materia seleccionada: Materia de prueba · inicia 27/09/2026');
    expect(screen.getByText('Materia seleccionada: Materia de prueba · inicia 27/09/2026')).toBeVisible();
  });

  it('expone los controles de consulta como grupo con nombre accesible', async () => {
    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    const controles = screen.getByRole('group', { name: 'Controles de consulta' });
    expect(controles).toContainElement(screen.getByRole('combobox', { name: 'Materia' }));
    const busqueda = screen.getByRole('searchbox', { name: 'Buscar alumno' });
    expect(controles).toContainElement(busqueda);
    expect(busqueda).toHaveAttribute('placeholder', 'Nombre o matrícula');
    expect(busqueda).toHaveAccessibleDescription('También puedes buscar por grupo.');
    expect(controles).toContainElement(screen.getByRole('combobox', { name: 'Ordenar' }));
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
    expect(screen.getByRole('group', { name: 'Filtrar alumnos' })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('9.88')).toBeInTheDocument();
    expect(screen.getAllByText('10')).toHaveLength(2);
    expect(screen.getByText('A002')).toBeInTheDocument();
    const estadoResultados = screen.getByRole('status');
    expect(estadoResultados).toHaveTextContent('Todos los alumnos · 2 visibles');
    expect(document.querySelector('.calificaciones-consulta__summary')).not.toBeInTheDocument();
    expect(document.querySelector('.calificaciones-consulta__result-meta')).not.toHaveAttribute('aria-live');

    await user.click(screen.getByRole('button', { name: 'Sin calificación' }));
    expect(estadoResultados).toHaveTextContent('Alumnos sin calificación · 1 visible');
    expect(screen.queryByText('Pérez López Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Soto Luis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    const botonDetalle = screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ });
    expect(botonDetalle).toHaveAttribute('aria-expanded', 'false');
    botonDetalle.focus();
    await user.keyboard('{Enter}');
    expect(botonDetalle).toHaveAttribute('aria-expanded', 'true');
    const panelDetalleId = botonDetalle.getAttribute('aria-controls');
    expect(panelDetalleId).toBeTruthy();
    expect(document.getElementById(panelDetalleId!)).toBeInTheDocument();
    expect(document.getElementById(panelDetalleId!)).toHaveFocus();
    const cerrarDetalle = screen.getByRole('button', { name: 'Cerrar detalle' });
    expect(cerrarDetalle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(cerrarDetalle).not.toHaveTextContent('×');
    await user.click(cerrarDetalle);
    expect(botonDetalle).toHaveFocus();
    expect(botonDetalle).toHaveAttribute('aria-expanded', 'false');
    expect(botonDetalle).not.toHaveAttribute('aria-controls');

    await user.click(botonDetalle);
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('button', { name: 'Abrir revisión manual' }));
    expect(onSeleccionarAlumno).toHaveBeenCalledWith('alumno-1');
    expect((clienteApi as { obtener: unknown }).obtener).toBeDefined();
  });

  it('permite recuperar los resultados después de una búsqueda sin coincidencias', async () => {
    const user = userEvent.setup();
    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    await waitFor(() => expect(screen.getByText('Pérez López Ana')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Sin calificación' }));
    expect(screen.getByText('Soto Luis')).toBeInTheDocument();
    expect(screen.queryByText('Pérez López Ana')).not.toBeInTheDocument();
    const busqueda = screen.getByRole('searchbox', { name: 'Buscar alumno' });
    await user.type(busqueda, 'sin-coincidencias');

    const estadoSinResultados = document.querySelector('.calificaciones-consulta__no-results');
    expect(estadoSinResultados).not.toBeNull();
    expect(within(estadoSinResultados as HTMLElement).getByRole('status')).toHaveTextContent('No hay alumnos que coincidan con «sin-coincidencias» con los filtros actuales.');
    expect(within(estadoSinResultados as HTMLElement).getByRole('button', { name: 'Limpiar búsqueda' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(busqueda).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Sin calificación' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Soto Luis')).toBeInTheDocument();
    expect(screen.queryByText('Pérez López Ana')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(await screen.findByText('Pérez López Ana')).toBeInTheDocument();

    await user.type(busqueda, 'perez');
    expect(screen.getByText('Pérez López Ana')).toBeInTheDocument();
    expect(screen.queryByText(/No hay alumnos que coincidan/)).not.toBeInTheDocument();
  });

  it('mantiene al final a los alumnos sin calificación al ordenar por nota', async () => {
    const user = userEvent.setup();
    render(<ConsultaCalificaciones
      periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
      periodoId="periodo-1"
      onPeriodoChange={vi.fn()}
      onSeleccionarAlumno={vi.fn()}
    />);

    await screen.findByText('Pérez López Ana');
    const ordenar = screen.getByRole('combobox', { name: 'Ordenar' });
    const filas = () => Array.from(document.querySelectorAll('.calificaciones-consulta__table tbody tr'));
    const matriculas = () => filas().map((fila) => within(fila).getByText(/A00[12]/).textContent);

    await user.selectOptions(ordenar, 'final-asc');
    expect(matriculas()).toEqual(['A001', 'A002']);

    await user.selectOptions(ordenar, 'final-desc');
    expect(matriculas()).toEqual(['A001', 'A002']);
  });

  it('muestra Extra solo con final reprobatoria y persiste la solicitud explícita del docente', async () => {
    const user = userEvent.setup();
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '5.99', parcial2: '5.99', global: '5.99', final: '5.99', calificacionFinalCurso: '5.99',
      calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: false, solicitudExtraVersion: null,
      resultadosExtraordinarios: [{ examenGeneradoId: 'examen-1', loteId: 'lote-1', folio: 'folio-1', calificacionSobre5: '2.285714285714285714', calificacionSobre10: '4.57', estadoAprobatorio: 'No aprobatoria', origen: 'inferida manualmente' }],
      bonoExtracurricular: '', observaciones: '', tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '',
      practica2doParcial: '', practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '',
      examen2doParcialAutomatico: '', examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '',
      examenGlobalLista: '', examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    obtenerMock.mockResolvedValueOnce({ filas: [filaExtra] }).mockResolvedValue({ filas: [{ ...filaExtra, solicitaExtra: true, solicitudExtraVersion: 1 }] });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(screen.getByText('Final del curso')).toBeInTheDocument();
    expect(screen.getByText('Final para acta')).toBeInTheDocument();
    expect(screen.getByText('La elegibilidad usa la final del curso antes del redondeo: debe ser menor que 6. La solicitud solo se registra cuando el docente la marca.')).toBeInTheDocument();
    expect(screen.queryByText(/Calificación 2.29 \/ 5 · equivalente 4.57 \/ 10 · No aprobatoria/)).not.toBeInTheDocument();
    const solicitud = screen.getByRole('checkbox', { name: 'El docente confirma que el alumno solicita presentar Extra' });
    expect(solicitud).not.toBeChecked();
    await user.click(solicitud);
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-1', alumnoId: 'alumno-1', componente: 'Solicitud Extra', calificacion: 1,
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    })));
    await waitFor(() => expect(screen.getByText(/Calificación 2.29 \/ 5 · equivalente 4.57 \/ 10 · No aprobatoria/)).toBeInTheDocument());
    expect(screen.getByText(/Lote lote-1 · folio folio-1 · examen examen-1/)).toBeInTheDocument();
  });

  it('presenta un resultado externo sin inventar lote ni examen generado', async () => {
    const user = userEvent.setup();
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '4', parcial2: '5', global: '5', final: '4.84', calificacionFinalCurso: '4.84',
      calificacionFinalCursoActa: '4', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1,
      resultadosExtraordinarios: [{
        claseRegistro: 'externo', folio: '88DC8464', loteId: null, calificacionSobre5: '2.29', calificacionSobre10: '4.57',
        estadoAprobatorio: 'No aprobatoria', origen: 'inferida manualmente', fuenteArchivo: 'extra-externo-prueba.pdf',
        documentoSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }],
      observaciones: '', tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '',
      practica2doParcial: '', practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '',
      examen2doParcialAutomatico: '', examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '',
      examenGlobalLista: '', examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    obtenerMock.mockResolvedValueOnce({ filas: [filaExtra] });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    expect(screen.getByText('Resultado extraordinario · externo')).toBeInTheDocument();
    expect(screen.getByText(/Lote sin verificar · folio 88DC8464 · archivo extra-externo-prueba.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256: a{64}/)).toBeInTheDocument();
    expect(screen.queryByText(/examen undefined/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Registrar resultado de examen Extra externo' })).not.toBeInTheDocument();
  });

  it('valida y registra la evidencia de un Extra externo con solicitud docente', async () => {
    const user = userEvent.setup();
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '4', parcial2: '5', global: '5', final: '4.84', calificacionFinalCurso: '4.84',
      calificacionFinalCursoActa: '4', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1,
      resultadosExtraordinarios: [], observaciones: '', tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '',
      practica2doParcial: '', practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '',
      examen2doParcialAutomatico: '', examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '',
      examenGlobalLista: '', examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    const resultadoExterno = {
      claseRegistro: 'externo' as const, folio: '88DC8464', loteId: null, calificacionSobre5: '2.29', calificacionSobre10: '4.57',
      estadoAprobatorio: 'No aprobatoria' as const, origen: 'inferida manualmente', fuenteArchivo: 'extra-externo.pdf',
      documentoSha256: 'a'.repeat(64)
    };
    obtenerMock.mockResolvedValueOnce({ filas: [filaExtra] }).mockResolvedValueOnce({
      filas: [{ ...filaExtra, resultadosExtraordinarios: [resultadoExterno] }]
    });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    expect(await screen.findByText('Revisa los campos marcados antes de registrar el resultado.')).toBeInTheDocument();
    const campoFolio = screen.getByLabelText('Folio visible (obligatorio)');
    expect(campoFolio).toHaveAttribute('aria-invalid', 'true');
    expect(campoFolio).toHaveFocus();
    const errorFolio = screen.getByText('Escribe el folio visible del examen.');
    expect(errorFolio.id).not.toBe('');
    expect(campoFolio).toHaveAttribute('aria-describedby', expect.stringContaining(errorFolio.id));
    const camposInvalidos = [
      [screen.getByLabelText(/PDF fuente local/), screen.getByText('Selecciona un PDF válido y espera a que se calcule su SHA-256.')],
      [screen.getByLabelText(/Aciertos/), screen.getByText('Escribe los aciertos; captura 0 si no hubo respuestas correctas.')],
      [screen.getByLabelText(/Reactivos evaluables/), screen.getByText('Escribe un total entero de al menos 1 reactivo evaluable.')],
      [screen.getByLabelText(/Criterios aplicados/), screen.getByText('Describe los criterios de revisión con al menos 12 caracteres.')]
    ] as const;
    for (const [campo, error] of camposInvalidos) {
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(campo.getAttribute('aria-describedby')?.split(/\s+/)).toContain(error.id);
    }
    expect(enviarMock).not.toHaveBeenCalled();

    await user.type(campoFolio, '88dc8464');
    await user.type(screen.getByLabelText('Lote (opcional)'), 'lote-a');
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0xab).buffer) },
      randomUUID: () => '01234567-89ab-cdef-0123-456789abcdef'
    });
    const archivo = new File(['%PDF-1.7 evidencia'], 'extra-externo.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7 evidencia').buffer });
    fireEvent.change(screen.getByLabelText(/PDF fuente local/), { target: { files: [archivo] } });
    expect(await screen.findByText(`SHA-256 calculado en este dispositivo: ${'ab'.repeat(32)}`)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reactivos evaluables/), '35');
    await user.type(screen.getByLabelText(/Criterios aplicados/), 'Se revisó cada reactivo contra la clave autorizada.');
    await user.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    const campoAciertos = screen.getByLabelText('Aciertos (obligatorio)');
    expect(campoAciertos).toHaveAttribute('aria-invalid', 'true');
    expect(campoAciertos).toHaveFocus();
    expect(screen.getByText('Escribe los aciertos; captura 0 si no hubo respuestas correctas.')).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();

    await user.type(campoAciertos, '0');
    expect(campoAciertos).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Escribe los aciertos; captura 0 si no hubo respuestas correctas.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/resultados-extra-externos', expect.objectContaining({
      periodoId: 'periodo-1', alumnoId: 'alumno-1', solicitaExtra: true, folio: '88DC8464', loteId: 'LOTE-A',
      fuenteArchivo: 'extra-externo.pdf', documentoSha256: 'ab'.repeat(32), aciertos: 0, totalReactivos: 35,
      criteriosAplicados: 'Se revisó cada reactivo contra la clave autorizada.',
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    })));
    expect(await screen.findByText('Resultado extraordinario · externo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Folio visible')).not.toBeInTheDocument();
  });

  it('recupera un resultado externo aunque falle la escritura después de persistir', async () => {
    const user = userEvent.setup();
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '4', parcial2: '5', global: '5', final: '4.84', calificacionFinalCurso: '4.84',
      extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [], observaciones: '',
      tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '', practica2doParcial: '',
      practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '', examen2doParcialAutomatico: '',
      examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '', examenGlobalLista: '',
      examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    const resultado = {
      claseRegistro: 'externo', folio: '88DC8464', loteId: null, calificacionSobre5: '2.29', calificacionSobre10: '4.57',
      estadoAprobatorio: 'No aprobatoria', origen: 'manual', fuenteArchivo: 'extra.pdf', documentoSha256: 'a'.repeat(64)
    };
    obtenerMock.mockResolvedValueOnce({ filas: [filaExtra] }).mockResolvedValueOnce({
      filas: [{ ...filaExtra, resultadosExtraordinarios: [resultado] }]
    });
    enviarMock.mockRejectedValueOnce(new Error('respuesta perdida'));
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.type(screen.getByLabelText(/Folio visible/), '88dc8464');
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0xab).buffer) },
      randomUUID: () => '01234567-89ab-cdef-0123-456789abcdef'
    });
    const archivo = new File(['%PDF-1.7 evidencia'], 'extra.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7 evidencia').buffer });
    fireEvent.change(screen.getByLabelText(/PDF fuente local/), { target: { files: [archivo] } });
    expect(await screen.findByText(`SHA-256 calculado en este dispositivo: ${'ab'.repeat(32)}`)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Aciertos/), '16');
    await user.type(screen.getByLabelText(/Reactivos evaluables/), '35');
    await user.type(screen.getByLabelText(/Criterios aplicados/), 'Revisado contra la clave oficial de la materia.');
    await user.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));

    expect(await screen.findByText('Resultado extraordinario · externo')).toBeInTheDocument();
    expect(screen.queryByText('respuesta perdida')).not.toBeInTheDocument();
    expect(enviarMock).toHaveBeenCalledTimes(1);
  });

  it('recupera una solicitud de Extra confirmada aunque falle la respuesta de guardado', async () => {
    const user = userEvent.setup();
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '5', parcial2: '5', global: '5', final: '5', calificacionFinalCurso: '5', extraDisponible: true,
      solicitaExtra: false, solicitudExtraVersion: null, resultadosExtraordinarios: [], observaciones: ''
    };
    enviarMock.mockRejectedValueOnce(new Error('Timeout'));
    obtenerMock.mockResolvedValueOnce({ filas: [filaExtra] }).mockResolvedValueOnce({
      filas: [{ ...filaExtra, solicitaExtra: true, solicitudExtraVersion: 1 }]
    });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('checkbox', { name: 'El docente confirma que el alumno solicita presentar Extra' }));
    await waitFor(() => expect(screen.getByText('Solicitud registrada por el docente. Apartado Extra activado.')).toHaveAttribute('role', 'status'));
    expect(screen.queryByText('Timeout')).not.toBeInTheDocument();
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
    expect(screen.getByRole('option', { name: /Inteligencia de Negocios · Archivada/ })).toBeInTheDocument();
    expect(screen.getByText(/Materia archivada: estás consultando el historial/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Segundo Parcial' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-archivado', alumnoId: 'alumno-1', componente: 'Practica 2do Parcial', calificacion: 7.5
    })));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('button', { name: 'Abrir revisión manual' }));
    expect(onSeleccionarAlumno).toHaveBeenCalledWith('alumno-1');
  });

  it('captura el puntaje total de Examen Global en escala física 0–5 y conserva la versión', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Global y bono' }));
    const global = screen.getByRole('spinbutton', { name: 'Examen Global manual · 0–5' });
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

  it('captura el examen del primer parcial en escala 0–5 y presenta las columnas nombradas del Excel', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    expect(screen.getByRole('heading', { name: 'Lista física · Primer Parcial' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lista Excel · columnas AJ–BB' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Libro completo' }));
    expect(screen.getByRole('heading', { name: 'Lista Excel · columnas AJ–BB' })).toBeInTheDocument();
    expect(screen.getByText(/AJ · Tareas y Ejercicios 1er Parcial/)).toBeInTheDocument();
    expect(screen.getByText(/AM · Examen 1er Parcial/)).toBeInTheDocument();
    expect(screen.getByText(/BB · Bono extracurricular otorgado/)).toBeInTheDocument();
    const columnasSinDato = screen.getByText('Columnas sin dato (8)');
    const avisoSinDato = screen.getAllByText('Sin dato', { exact: true })[0];
    expect(avisoSinDato).not.toBeVisible();
    await user.click(columnasSinDato);
    expect(avisoSinDato).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Primer Parcial' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Examen 1er Parcial · 0–5' }), '4.67');
    await user.click(screen.getAllByRole('button', { name: 'Guardar examen' })[0]);

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({
      periodoId: 'periodo-1',
      alumnoId: 'alumno-1',
      componente: 'Exámen 1er Parcial',
      calificacion: 4.67,
      canalCaptura: 'gui',
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
    })));
  });

  it('presenta la validación con ortografía correcta sin alterar la escritura', async () => {
    const user = userEvent.setup();
    render(
      <ConsultaCalificaciones
        periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]}
        periodoId="periodo-1"
        onPeriodoChange={vi.fn()}
        onSeleccionarAlumno={vi.fn()}
      />
    );

    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Primer Parcial' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Examen 1er Parcial · 0–5' }), '5.01');
    await user.click(screen.getByRole('button', { name: 'Guardar examen' }));

    expect(screen.getByText('La calificación de “Examen 1er Parcial” debe estar entre 0 y 5.')).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('consulta el historial de captura del examen con canal, valor y versión', async () => {
    const user = userEvent.setup();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta.includes('/calificaciones/historial')) return { eventos: [{
        id: 'mutacion-1', componente: 'Exámen 1er Parcial', valorAnterior: null, valorNuevo: 4.67,
        version: 1, escalaMaxima: 5, canalCaptura: 'gui', metodoCaptura: 'captura_manual',
        actorId: 'docente-1', createdAt: '2026-10-14T10:00:00.000Z'
      }] };
      return { filas: [{
        alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
        parcial1: '8', examenPrimerParcialLista: '4.67', examenPrimerParcialListaVersion: 1, observaciones: ''
      }] };
    });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Primer Parcial' }));
    await user.click(screen.getByRole('button', { name: 'Consultar historial de captura' }));
    await waitFor(() => expect(screen.getByText(/Captura inicial → 4\.67 \/ 1 · gui/)).toBeInTheDocument());
    expect(obtenerMock).toHaveBeenCalledWith(expect.stringContaining('/analiticas/lista-academica/calificaciones/historial?'));
  });

  it('normaliza los errores de consulta del historial sin perder la sugerencia', async () => {
    const user = userEvent.setup();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta.includes('/calificaciones/historial')) {
        throw new ErrorRemoto('API no disponible', {
          mensaje: 'Sin conexion',
          detalles: 'connect ECONNREFUSED 127.0.0.1:4000'
        });
      }
      return { filas: [{
        alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
        parcial1: '8', examenPrimerParcialLista: '4.67', examenPrimerParcialListaVersion: 1, observaciones: ''
      }] };
    });
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Primer Parcial' }));
    await user.click(screen.getByRole('button', { name: 'Consultar historial de captura' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Sin conexion');
    expect(error).toHaveTextContent('Tip: inicia el servicio backend de EvaluaPro o recarga la pagina.');
    expect(error).not.toHaveTextContent('ECONNREFUSED');
    expect(error).not.toHaveTextContent('127.0.0.1:4000');
    expect(screen.getByRole('button', { name: 'Consultar historial de captura' })).toBeEnabled();
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
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Segundo Parcial' }));
    expect(screen.getByText('Examen 2do Parcial automático · referencia')).toBeInTheDocument();
    expect(screen.getAllByText(/no sustituye la captura manual/).length).toBeGreaterThan(0);
    await user.type(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', {
      periodoId: 'periodo-1', alumnoId: 'alumno-1', componente: 'Practica 2do Parcial', calificacion: 7.5,
      canalCaptura: 'gui',
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

    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Segundo Parcial' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Examen 2do Parcial · 0–5.25' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Examen 2do Parcial · 0–5.25' }), '5.25');
    await user.type(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Examen 2do Parcial · 0–5.25' })).toHaveValue(5.25));
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
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Segundo Parcial' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' }), '7.5');
    await user.click(screen.getByRole('button', { name: 'Guardar práctica' }));
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' })).toHaveValue(7.5);
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
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Segundo Parcial' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Práctica 2do Parcial · 0–10' }), '7.5');
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
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Global y bono' }));
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
    await user.click(screen.getByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Global y bono' }));
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

  it('muestra errores al guardar una solicitud Extra y al registrar un PDF externo', async () => {
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '5', parcial2: '5.5', global: '5.5', final: '5.3', calificacionFinalCurso: '5.3',
      calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: false, solicitudExtraVersion: null,
      resultadosExtraordinarios: [], observaciones: '', tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '',
      practica2doParcial: '', practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '',
      examen2doParcialAutomatico: '', examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '',
      examenGlobalLista: '', examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    obtenerMock.mockResolvedValue({ filas: [filaExtra] });
    enviarMock.mockRejectedValueOnce(new Error('Solicitud rechazada'));
    const user = userEvent.setup();
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('checkbox', { name: 'El docente confirma que el alumno solicita presentar Extra' }));
    expect(await screen.findAllByText('Solicitud rechazada')).not.toHaveLength(0);
    expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/calificaciones', expect.objectContaining({ componente: 'Solicitud Extra', calificacion: 1 }));
  });
  it('valida el PDF local externo y presenta el error del registro conservando datos para corregir', async () => {
    const filaExtra = {
      alumnoId: 'alumno-1', matricula: 'A001', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', nombre: 'Ana', grupo: 'A',
      parcial1: '5', parcial2: '5.5', global: '5.5', final: '5.3', calificacionFinalCurso: '5.3',
      calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1,
      resultadosExtraordinarios: [], observaciones: '', tareasYEjercicios2doParcial: '', tareasPuntosObtenidos: '', tareasPuntosPosibles: '',
      practica2doParcial: '', practica2doParcialVersion: null, evaluacionContinua2doParcial: '', examen2doParcial: '',
      examen2doParcialAutomatico: '', examen2doParcialVersion: null, calificacionSegundoParcial: '', examenGlobalComponente: '',
      examenGlobalLista: '', examenGlobalListaVersion: null, continuaTercerParcialLista: '', calificacionTercerParcial: ''
    };
    obtenerMock.mockResolvedValue({ filas: [filaExtra] });
    enviarMock.mockRejectedValueOnce(new Error('No se pudo registrar resultado'));
    vi.stubGlobal('crypto', {
      randomUUID: () => '123e4567-e89b-42d3-a456-426614174000',
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0b).buffer) }
    });
    const user = userEvent.setup();
    render(<ConsultaCalificaciones periodos={[{ _id: 'periodo-1', nombre: 'Materia de prueba' }]} periodoId="periodo-1" onPeriodoChange={vi.fn()} onSeleccionarAlumno={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: /^Ver detalle de Pérez López Ana/ }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    const grupo = screen.getByRole('group', { name: 'Registrar resultado de examen Extra externo' });
    const archivoInput = within(grupo).getByLabelText(/PDF fuente local/);
    const txt = new File(['texto'], 'examen.txt', { type: 'text/plain' });
    fireEvent.change(archivoInput, { target: { files: [txt] } });
    expect(await screen.findAllByText('Selecciona un PDF válido y no vacío.')).not.toHaveLength(0);

    vi.stubGlobal('crypto', { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' });
    const pdfSeguro = new File(['%PDF-1.7'], 'anwar.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfSeguro, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(archivoInput, { target: { files: [pdfSeguro] } });
    expect(await screen.findAllByText(/No se puede calcular SHA-256 en este navegador/)).not.toHaveLength(0);

    vi.stubGlobal('crypto', {
      randomUUID: () => '123e4567-e89b-42d3-a456-426614174000',
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0b).buffer) }
    });
    const firmaInvalida = new File(['otro texto'], 'anwar.pdf', { type: 'application/pdf' });
    Object.defineProperty(firmaInvalida, 'arrayBuffer', { value: async () => new TextEncoder().encode('texto').buffer });
    fireEvent.change(archivoInput, { target: { files: [firmaInvalida] } });
    expect(await screen.findAllByText('El contenido seleccionado no tiene firma PDF.')).not.toHaveLength(0);

    const pdfValido = new File(['%PDF-1.7'], 'anwar.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfValido, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(archivoInput, { target: { files: [pdfValido] } });
    expect(await screen.findByText('SHA-256 calculado en este dispositivo: ' + '0b'.repeat(32))).toBeInTheDocument();

    await user.type(within(grupo).getByLabelText(/Folio visible/), 'FOLIO-EXTRA');
    await user.type(within(grupo).getByLabelText(/Aciertos/), '7');
    await user.type(within(grupo).getByLabelText(/Reactivos evaluables/), '10');
    await user.type(within(grupo).getByLabelText(/Criterios aplicados/), 'Revisión manual con rúbrica');
    await user.click(within(grupo).getByRole('button', { name: 'Registrar resultado externo' }));
    expect(await screen.findAllByText('No se pudo registrar resultado')).not.toHaveLength(0);
    expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/resultados-extra-externos', expect.objectContaining({
      folio: 'FOLIO-EXTRA', fuenteArchivo: 'anwar.pdf', documentoSha256: '0b'.repeat(32), aciertos: 7, totalReactivos: 10
    }));
  });
});
