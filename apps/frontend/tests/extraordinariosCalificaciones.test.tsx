import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtraordinariosCalificaciones } from '../src/apps/app_docente/ExtraordinariosCalificaciones';

const obtenerMock = vi.fn();
const enviarMock = vi.fn();
const tokenMock = vi.fn();
const refrescarTokenMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: { obtener: (...args: unknown[]) => obtenerMock(...args), enviar: (...args: unknown[]) => enviarMock(...args), baseApi: 'http://localhost/api', intentarRefrescarToken: (...args: unknown[]) => refrescarTokenMock(...args) }
}));
vi.mock('../src/servicios_api/clienteApi', () => ({ obtenerTokenDocente: (...args: unknown[]) => tokenMock(...args) }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function diferir<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { resolver = resolve; });
  return { promise, resolver };
}

function abrirDisclosure(id: string) {
  const disclosure = document.getElementById(id) as HTMLDetailsElement | null;
  if (!disclosure) throw new Error(`No se encontró el disclosure ${id}`);
  expect(disclosure.open).toBe(false);
  if (!disclosure.open) fireEvent.click(disclosure.querySelector('summary'));
  expect(disclosure.open).toBe(true);
}

describe('ExtraordinariosCalificaciones', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    enviarMock.mockReset();
    tokenMock.mockReset().mockReturnValue('token-docente');
    refrescarTokenMock.mockReset();
    localStorage.clear();
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [] },
        { alumnoId: 'a-2', nombre: 'Luis', apellidoPaterno: 'Soto', apellidoMaterno: '', matricula: 'A002', grupo: 'A', calificacionFinalCurso: '6.00', calificacionFinalCursoActa: '6', extraDisponible: false, solicitaExtra: false, resultadosExtraordinarios: [{ claseRegistro: 'externo', folio: 'FOLIO-1', calificacionSobre5: '2.29', calificacionSobre10: '4.58', estadoAprobatorio: 'No aprobatoria', origen: 'inferida manualmente' }] }
      ] });
      return Promise.resolve({ plantillas: [] });
    });
  });

  it('explica el umbral decimal y conserva el historial de un alumno ya no elegible', async () => {
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    expect((await screen.findAllByText('Pérez Ana')).length).toBeGreaterThan(0);
    expect(screen.getByText('El cálculo usa la final del curso antes del redondeo; «Final para acta» muestra el valor por separado.')).toBeInTheDocument();
    const filasAlumno = document.querySelectorAll<HTMLElement>('.calificaciones-extra__student');
    expect(filasAlumno).toHaveLength(2);
    const filaElegible = filasAlumno[0]!;
    const filaNoElegible = filasAlumno[1]!;
    expect(within(filaElegible).getByText('Final del curso')).toBeInTheDocument();
    expect(within(filaElegible).getByText('Final para acta')).toBeInTheDocument();
    expect(within(filaElegible).getByText('Elegible')).toBeInTheDocument();
    expect(within(filaNoElegible).getByText('No elegible')).toBeInTheDocument();
    const historial = document.getElementById('extra-historial-disclosure') as HTMLDetailsElement;
    expect(historial.open).toBe(false);
    fireEvent.click(historial.querySelector('summary'));
    expect(historial.open).toBe(true);
    expect(screen.getByText('5.99')).toBeInTheDocument();
    expect(screen.getAllByText('6.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Resultado externo · folio FOLIO-1')).toBeInTheDocument();
    const resumen = Array.from(document.querySelectorAll('.calificaciones-extra__summary > span'), (item) => item.textContent?.replace(/\s+/g, ' ').trim());
    expect(resumen).toEqual(['1 elegible de 2 alumnos', '1 alumno con solicitud', '1 resultado histórico']);
    expect(screen.getByRole('checkbox', { name: /^Incluir en el lote Pérez Ana/ })).not.toBeChecked();
    expect(screen.getByText('Incluir en el lote')).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /^Incluir en el lote Soto Luis/ })).not.toBeInTheDocument();
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas?periodoId=p-1&archivado=true'));
  });

  it('distingue la selección para extraordinario cuando hay alumnos homónimos', async () => {
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'dummy-a', nombre: 'Ana', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', matricula: 'DUMMY-101', grupo: 'A', calificacionFinalCurso: '5.5', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] },
        { alumnoId: 'dummy-b', nombre: 'Ana', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', matricula: 'DUMMY-202', grupo: 'B', calificacionFinalCurso: '5.6', calificacionFinalCursoActa: '6', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] }
      ] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [
        { _id: 'dummy-examen-a', tipoExamen: 'extraordinario', folio: 'F-DUMMY-101', alumnoId: 'dummy-a', alumnoNombre: 'Ejemplo Ana' },
        { _id: 'dummy-examen-b', tipoExamen: 'extraordinario', folio: 'F-DUMMY-202', alumnoId: 'dummy-b', alumnoNombre: 'Ejemplo Ana' }
      ], nextCursor: null });
      return Promise.resolve({ plantillas: [] });
    });

    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    const identidadA = 'Ejemplo Ana · matrícula DUMMY-101 · grupo A';
    const identidadB = 'Ejemplo Ana · matrícula DUMMY-202 · grupo B';
    expect(await screen.findByRole('checkbox', { name: `Incluir en el lote ${identidadA}` })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: `Incluir en el lote ${identidadB}` })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: `Solicitud docente para ${identidadA}` })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: `Solicitud docente para ${identidadB}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Abrir revisión OMR de ${identidadA}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Abrir revisión OMR de ${identidadB}` })).toBeInTheDocument();

    const alumnoSolicitante = screen.getByRole('combobox', { name: /^Alumno solicitante elegible/ });
    expect(within(alumnoSolicitante).getByRole('option', { name: identidadA })).toBeInTheDocument();
    expect(within(alumnoSolicitante).getByRole('option', { name: identidadB })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Exámenes extraordinarios generados'));
    expect(await screen.findByRole('button', { name: `Abrir revisión del alumno ${identidadA} · folio F-DUMMY-101` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Abrir revisión del alumno ${identidadB} · folio F-DUMMY-202` })).toBeInTheDocument();
  });

  it.each([
    ['faltan solicitudes docentes', true, true, false, 'No hay solicitudes docentes vigentes. Marca «Solicitud docente» en la sección «Elegibilidad y solicitud» para un alumno elegible.'],
    ['no hay alumnado elegible', true, false, false, 'No hay alumnos con calificación final menor que 6. Revisa la sección «Elegibilidad y solicitud».'],
    ['falta permiso de captura', false, true, false, 'No tienes permiso para registrar resultados externos en esta materia.']
  ] as const)('explica el estado del registro externo cuando %s', async (_caso, puedeCalificar, extraDisponible, solicitaExtra, mensaje) => {
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'dummy-a', nombre: 'Ana', apellidoPaterno: 'Ejemplo', apellidoMaterno: '', matricula: 'DUMMY-101', grupo: 'A', calificacionFinalCurso: extraDisponible ? '5.5' : '6.0', calificacionFinalCursoActa: extraDisponible ? '5' : '6', extraDisponible, solicitaExtra, resultadosExtraordinarios: [] }
      ] });
      return Promise.resolve({ plantillas: [] });
    });

    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar={puedeCalificar}
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    await screen.findByText('Elegibilidad y solicitud');
    fireEvent.click(screen.getByText('Registrar examen externo'));
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    const alumnoSolicitante = screen.getByRole('combobox', { name: /^Alumno solicitante elegible/ });
    expect(within(alumnoSolicitante).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Registrar resultado externo' })).toBeDisabled();
  });

  it('pluraliza los conteos de elegibilidad, solicitudes e historial', async () => {
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [
        { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.5', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [{ claseRegistro: 'externo', folio: 'F-1', calificacionSobre5: '3', calificacionSobre10: '6', estadoAprobatorio: 'No aprobatoria' }] },
        { alumnoId: 'a-2', nombre: 'Luis', apellidoPaterno: 'Soto', apellidoMaterno: '', matricula: 'A002', grupo: 'A', calificacionFinalCurso: '5.8', calificacionFinalCursoActa: '6', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [{ claseRegistro: 'externo', folio: 'F-2', calificacionSobre5: '4', calificacionSobre10: '8', estadoAprobatorio: 'Aprobado' }] }
      ] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      return Promise.resolve({ plantillas: [] });
    });

    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    await screen.findByText('Elegibilidad y solicitud');
    const resumen = Array.from(document.querySelectorAll('.calificaciones-extra__summary > span'), (item) => item.textContent?.replace(/\s+/g, ' ').trim());
    expect(resumen).toEqual(['2 elegibles de 2 alumnos', '2 alumnos con solicitud', '2 resultados históricos']);
  });

  it('permite reintentar la carga de plantillas tras un error recuperable', async () => {
    let fallaCarga = true;
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      if (ruta.startsWith('/examenes/plantillas')) {
        if (fallaCarga) return Promise.reject(new Error('Backend temporalmente no disponible'));
        return Promise.resolve({ plantillas: [{ _id: 'plantilla-1', periodoId: 'p-1', titulo: 'Plantilla de prueba' }] });
      }
      return Promise.resolve({});
    });
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    expect(await screen.findByText('No se pudieron cargar las plantillas de esta materia. Reintenta la consulta.')).toBeInTheDocument();
    fallaCarga = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga de plantillas' }));

    expect(await screen.findByRole('option', { name: 'Plantilla de prueba' })).toBeInTheDocument();
    expect(screen.queryByText('No se pudieron cargar las plantillas de esta materia. Reintenta la consulta.')).not.toBeInTheDocument();
  });

  it.each(['/analiticas/lista-academica', '/examenes/generados'])('permite reintentar la carga académica si falla %s sin presentar el error como lista vacía', async (rutaConFalla) => {
    let fallaCarga = true;
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith(rutaConFalla) && fallaCarga) return Promise.reject(new Error('Backend temporalmente no disponible'));
      if (ruta.startsWith('/analiticas/lista-academica')) {
        return Promise.resolve({ filas: [
          { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: false, resultadosExtraordinarios: [] }
        ] });
      }
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      return Promise.resolve({ plantillas: [] });
    });
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend temporalmente no disponible');
    expect(screen.getByRole('button', { name: 'Reintentar carga académica' })).toBeInTheDocument();
    expect(document.querySelector('.calificaciones-extra__summary')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay alumnos registrados en este periodo.')).not.toBeInTheDocument();
    expect(screen.queryByText('Elegibilidad y solicitud')).not.toBeInTheDocument();

    fallaCarga = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga académica' }));

    expect(await screen.findByText('Pérez Ana')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('.calificaciones-extra__summary')?.textContent).toContain('1 elegible de 1 alumno');
    expect(obtenerMock.mock.calls.filter(([ruta]) => String(ruta).startsWith('/examenes/generados?periodoId=p-1&limite=100'))).toHaveLength(2);
    expect(obtenerMock.mock.calls.filter(([ruta]) => String(ruta).startsWith('/analiticas/lista-academica'))).toHaveLength(2);
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('limpia la plantilla seleccionada y sus opciones al cambiar de materia', async () => {
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      if (ruta.startsWith('/examenes/plantillas')) return Promise.resolve({ plantillas: [
        { _id: 'plantilla-1', periodoId: 'p-1', titulo: 'Plantilla de materia uno' },
        { _id: 'plantilla-2', periodoId: 'p-2', titulo: 'Plantilla de materia dos' }
      ] });
      return Promise.resolve({});
    });
    const props = {
      periodos: [{ _id: 'p-1', nombre: 'Materia uno' }, { _id: 'p-2', nombre: 'Materia dos' }],
      periodoId: 'p-1',
      onPeriodoChange: vi.fn(),
      puedeCalificar: true,
      puedeGenerar: true,
      onAbrirRevision: vi.fn()
    };
    const { rerender } = render(<ExtraordinariosCalificaciones {...props} />);
    const selector = await screen.findByRole('combobox', { name: 'Plantilla de examen' });
    await screen.findByRole('option', { name: 'Plantilla de materia uno' });
    fireEvent.change(selector, { target: { value: 'plantilla-1' } });
    expect(selector).toHaveValue('plantilla-1');

    rerender(<ExtraordinariosCalificaciones {...props} periodoId="p-2" />);

    expect(screen.getByRole('combobox', { name: 'Materia y periodo' })).toHaveValue('p-2');
    await waitFor(() => expect(selector).toHaveValue(''));
    expect(await screen.findByRole('option', { name: 'Plantilla de materia dos' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Plantilla de materia uno' })).not.toBeInTheDocument();
  });

  it('ignora la respuesta tardía de elegibilidad de una materia anterior', async () => {
    const respuestaMateriaUno = diferir<{ filas: Array<Record<string, unknown>> }>();
    const filaMateriaDos = { alumnoId: 'a-2', nombre: 'María', apellidoPaterno: 'López', apellidoMaterno: '', matricula: 'B002', grupo: 'B', calificacionFinalCurso: '5.5', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.includes('/analiticas/lista-academica?periodoId=p-1')) return respuestaMateriaUno.promise;
      if (ruta.includes('/analiticas/lista-academica?periodoId=p-2')) return Promise.resolve({ filas: [filaMateriaDos] });
      if (ruta.includes('/examenes/generados')) return Promise.resolve({ examenes: [] });
      if (ruta.includes('/examenes/plantillas')) return Promise.resolve({ plantillas: [] });
      return Promise.resolve({});
    });
    const props = {
      periodos: [{ _id: 'p-1', nombre: 'Materia uno' }, { _id: 'p-2', nombre: 'Materia dos' }],
      periodoId: 'p-1',
      onPeriodoChange: vi.fn(),
      puedeCalificar: true,
      puedeGenerar: true,
      onAbrirRevision: vi.fn()
    };
    const { rerender } = render(<ExtraordinariosCalificaciones {...props} />);
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/analiticas/lista-academica?periodoId=p-1'));

    rerender(<ExtraordinariosCalificaciones {...props} periodoId="p-2" />);
    expect((await screen.findAllByText('López María')).length).toBeGreaterThan(0);
    await act(async () => { respuestaMateriaUno.resolver({ filas: [
      { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.9', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] }
    ] }); });

    expect(screen.queryAllByText('Pérez Ana')).toHaveLength(0);
    expect(screen.getAllByText('López María').length).toBeGreaterThan(0);
  });

  it('ignora una página tardía del historial después de cambiar de materia', async () => {
    const paginaMateriaUno = diferir<{ examenes: Array<Record<string, unknown>>; nextCursor: string | null }>();
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [] });
      if (ruta.includes('/examenes/generados?periodoId=p-1&limite=100&cursor=')) return paginaMateriaUno.promise;
      if (ruta.includes('/examenes/generados?periodoId=p-1')) return Promise.resolve({ examenes: [], nextCursor: 'cursor-p1' });
      if (ruta.includes('/examenes/generados?periodoId=p-2')) return Promise.resolve({ examenes: [{ _id: 'ex-p2', tipoExamen: 'extraordinario', folio: 'EX-P2', loteId: 'L-P2', alumnoId: 'a-2' }], nextCursor: null });
      if (ruta.includes('/examenes/plantillas')) return Promise.resolve({ plantillas: [] });
      return Promise.resolve({});
    });
    const props = {
      periodos: [{ _id: 'p-1', nombre: 'Materia uno' }, { _id: 'p-2', nombre: 'Materia dos' }],
      periodoId: 'p-1',
      onPeriodoChange: vi.fn(),
      puedeCalificar: true,
      puedeGenerar: true,
      onAbrirRevision: vi.fn()
    };
    const { rerender } = render(<ExtraordinariosCalificaciones {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más exámenes' }));
    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/generados?periodoId=p-1&limite=100&cursor=cursor-p1'));

    rerender(<ExtraordinariosCalificaciones {...props} periodoId="p-2" />);
    expect(await screen.findByText('Lote L-P2 · folio EX-P2')).toBeInTheDocument();
    await act(async () => { paginaMateriaUno.resolver({
      examenes: [{ _id: 'ex-p1', tipoExamen: 'extraordinario', folio: 'EX-P1', loteId: 'L-P1', alumnoId: 'a-1' }],
      nextCursor: null
    }); });

    expect(screen.queryByText('Lote L-P1 · folio EX-P1')).not.toBeInTheDocument();
    expect(screen.getByText('Lote L-P2 · folio EX-P2')).toBeInTheDocument();
  });

  it('calcula SHA-256 del PDF local y envía solo metadatos confirmados', async () => {
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0a).buffer) },
      getRandomValues: (value: Uint8Array) => value.fill(1),
      randomUUID: () => 'request-test-1'
    });
    enviarMock.mockResolvedValue({});
    render(<ExtraordinariosCalificaciones
      periodos={[{ _id: 'p-1', nombre: 'Materia de prueba' }]}
      periodoId="p-1"
      onPeriodoChange={vi.fn()}
      puedeCalificar
      puedeGenerar
      onAbrirRevision={vi.fn()}
    />);

    await screen.findByText('Elegibilidad y solicitud');
    abrirDisclosure('extra-externo-disclosure');
    fireEvent.change(await screen.findByRole('combobox', { name: /^Alumno solicitante elegible/ }), { target: { value: 'a-1' } });
    const archivo = new File(['%PDF-1.7 contenido privado'], 'anwar-extra.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7 contenido privado').buffer });
    const selectorPdf = screen.getByLabelText(/^PDF local/);
    expect(selectorPdf).toBeRequired();
    expect(selectorPdf).toHaveAccessibleDescription('Solo se calcula su SHA-256 localmente; no se leen respuestas del archivo. Sin PDF seleccionado.');
    expect(document.getElementById('extra-externo-pdf-status')).toHaveTextContent('Sin PDF seleccionado.');
    fireEvent.change(selectorPdf, { target: { files: [archivo] } });
    const toggleHuella = await screen.findByText('Ver huella SHA-256 del archivo seleccionado');
    const huella = screen.getByText(`SHA-256 local: ${'0a'.repeat(32)}`);
    expect(toggleHuella.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(toggleHuella);
    expect(huella).toBeVisible();
    expect(document.getElementById('extra-externo-pdf-status')).toHaveTextContent('Archivo: anwar-extra.pdf · SHA-256 calculado');

    const folio = screen.getByLabelText(/^Folio visible/);
    const aciertos = screen.getByLabelText(/^Aciertos confirmados/);
    const reactivos = screen.getByLabelText(/^Reactivos evaluables/);
    const criterios = screen.getByLabelText(/^Criterios aplicados/);
    for (const campo of [folio, aciertos, reactivos, criterios]) expect(campo).toBeRequired();
    expect(aciertos).toHaveAccessibleDescription('Número entero de 0 hasta el total de reactivos evaluables.');
    expect(reactivos).toHaveAccessibleDescription('Número entero mayor que cero.');
    expect(criterios).toHaveAccessibleDescription('Describe el criterio de revisión en al menos 12 caracteres.');
    expect(screen.getByLabelText(/^Lote documentado/)).not.toBeRequired();
    fireEvent.change(folio, { target: { value: 'FOLIO-EXTRA' } });
    fireEvent.change(aciertos, { target: { value: '7' } });
    fireEvent.change(reactivos, { target: { value: '10' } });
    fireEvent.change(criterios, { target: { value: 'Revisión manual con rúbrica documentada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));

    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/analiticas/lista-academica/resultados-extra-externos', expect.objectContaining({
      fuenteArchivo: 'anwar-extra.pdf', documentoSha256: '0a'.repeat(32), folio: 'FOLIO-EXTRA', aciertos: 7, totalReactivos: 10
    })));
    const payload = enviarMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('archivo');
    expect(JSON.stringify(payload)).not.toContain('contenido privado');
  });
});

  it('retira solicitud y pagina historial conservando los datos previos si falla la página siguiente', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 3, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return ruta.includes('cursor=') ? Promise.reject(new Error('Página no disponible')) : Promise.resolve({ examenes: [{ _id: 'e-ord', folio: 'ORD-1', tipoExamen: 'ordinario' }, { _id: 'e-extra', folio: 'EX-1', loteId: 'L-1', tipoExamen: 'extraordinario', alumnoId: 'a-1' }], nextCursor: 'cursor/2' });
      return Promise.resolve({ plantillas: [] });
    });
    vi.stubGlobal('crypto', { randomUUID: () => '44444444-aaaa-bbbb-cccc-123456789000' });
    enviarMock.mockRejectedValueOnce(new Error('No se guardó')).mockResolvedValue({});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    expect(await screen.findByText('Lote L-1 · folio EX-1')).toBeInTheDocument();
    expect(screen.queryByText('folio ORD-1')).not.toBeInTheDocument();
    const solicitud = screen.getByRole('checkbox', { name: /^Solicitud docente para/ });
    fireEvent.click(solicitud);
    expect(await screen.findByText('No se guardó')).toBeInTheDocument();
    fireEvent.click(solicitud);
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    expect(enviarMock.mock.calls[0][1].clientRequestId).toBe(enviarMock.mock.calls[1][1].clientRequestId);
    expect(await screen.findByText(/Solicitud retirada para Pérez Ana/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más exámenes' }));
    expect(await screen.findByText('Página no disponible')).toBeInTheDocument();
    expect(screen.getByText('Lote L-1 · folio EX-1')).toBeInTheDocument();
  });

  it('muestra error recuperable de carga académica sin simular una lista vacía', async () => {
    obtenerMock.mockRejectedValue(new Error('API académica fuera de línea'));
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    expect(await screen.findByText('API académica fuera de línea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar carga académica' })).toBeInTheDocument();
    expect(document.querySelector('.calificaciones-extra__summary')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay alumnos registrados en este periodo.')).not.toBeInTheDocument();
  });

  it('valida preview y generación, persiste clave de lote y renueva token al descargar PDF', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1, resultadosExtraordinarios: [] };
    const hash = 'ab'.repeat(32);
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [], nextCursor: null });
      if (ruta.endsWith('/previsualizar')) return Promise.resolve({ layoutConfirmado: true, numeroPaginas: 2, totalUsados: 10, totalDisponibles: 12 });
      if (ruta.startsWith('/examenes/plantillas')) return Promise.resolve({ plantillas: [{ _id: 'tpl-1', periodoId: 'p-1', titulo: 'Plantilla global', numeroPaginas: 2 }] });
      return Promise.resolve({});
    });
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-aaaa-bbbb-cccc-123456789000' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ paginas: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AA==' }, { numero: 2, width: 100, height: 140, dataUrl: 'data:image/png;base64,AA==' }] }) })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (name: string) => name === 'X-EvaluaPro-PDF-SHA256' ? hash : null }, blob: async () => new Blob(['pdf']) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:extra'), revokeObjectURL: vi.fn() });
    refrescarTokenMock.mockResolvedValue('token-renovado');
    enviarMock.mockResolvedValue({ loteId: 'L-EXTRA-1', totalAlumnos: 1, totalPaginas: 2, paginasPorExamen: 2, pdfSha256: hash, lotePdfUrl: '/examenes/generados/lote/L-EXTRA-1/pdf', examenesGenerados: [{ folio: 'F-1' }] });
    const clickDescarga = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Incluir en el lote Pérez Ana/ }));
    fireEvent.change(screen.getByLabelText('Plantilla de examen'), { target: { value: 'tpl-1' } });
    tokenMock.mockReturnValue('token-docente');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText(/Vista previa validada · 2 páginas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisé el diseño y las páginas de la vista previa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generar exámenes extraordinarios' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledWith('/examenes/generados/lote', expect.objectContaining({ plantillaId: 'tpl-1', tipoExamen: 'extraordinario', alumnoIds: ['a-1'], loteId: '12345678' })));
    const textoEstadoLote = await screen.findByText(/Lote L-EXTRA-1 · 1 exámenes · 2 páginas/);
    const estadoLote = textoEstadoLote.closest('[role="status"]');
    expect(estadoLote).toBeInTheDocument();
    expect(estadoLote?.querySelector('button, summary')).toBeNull();
    expect(localStorage.getItem('evaluapro.plantillas.lote-pendiente.v1:tpl-1:extraordinario:a-1')).toBe('12345678');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF del lote' }));
    await waitFor(() => expect(clickDescarga).toHaveBeenCalled());
    expect(refrescarTokenMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.any(String), expect.objectContaining({ headers: { Authorization: 'Bearer token-renovado' } }));
    expect(screen.getByText(/SHA-256 verificado/)).toBeInTheDocument();
  });

  it('rechaza preview sin sesión ni diseño confirmado y mantiene bloqueada la generación', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => {
      if (ruta.startsWith('/analiticas/lista-academica')) return Promise.resolve({ filas: [fila] });
      if (ruta.startsWith('/examenes/generados')) return Promise.resolve({ examenes: [] });
      if (ruta.endsWith('/previsualizar')) return Promise.resolve({ layoutConfirmado: false });
      if (ruta.startsWith('/examenes/plantillas')) return Promise.resolve({ plantillas: [{ _id: 'tpl-1', periodoId: 'p-1', titulo: 'Plantilla global' }] });
      return Promise.resolve({});
    });
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-aaaa-bbbb-cccc-123456789000' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ paginas: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AA==' }] }) })));
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Incluir en el lote Pérez Ana/ }));
    fireEvent.change(screen.getByLabelText('Plantilla de examen'), { target: { value: 'tpl-1' } });
    tokenMock.mockReturnValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText('Sesión docente no válida. Vuelve a iniciar sesión.')).toBeInTheDocument();
    tokenMock.mockReturnValue('token-docente');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vista previa' }));
    expect(await screen.findByText('El diseño de la plantilla aún no está confirmado; revisa la plantilla antes de generar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar exámenes extraordinarios' })).toBeDisabled();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('valida archivo, firma PDF, disponibilidad criptográfica y aciertos antes de registrar', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => ruta.startsWith('/analiticas/lista-academica') ? Promise.resolve({ filas: [fila] }) : Promise.resolve({ plantillas: [], examenes: [] }));
    vi.stubGlobal('crypto', { randomUUID: () => '22222222-aaaa-bbbb-cccc-123456789000', subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    await screen.findByText('Elegibilidad y solicitud');
    abrirDisclosure('extra-externo-disclosure');
    fireEvent.change(await screen.findByRole('combobox', { name: /^Alumno solicitante elegible/ }), { target: { value: 'a-1' } });
    const input = screen.getByLabelText(/^PDF local/);
    fireEvent.change(input, { target: { files: [new File(['texto'], 'examen.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Selecciona un PDF válido y no vacío.')).toBeInTheDocument();

    const pdfSinFirma = new File(['no es pdf'], 'examen.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfSinFirma, 'arrayBuffer', { value: async () => new TextEncoder().encode('texto falso').buffer });
    fireEvent.change(input, { target: { files: [pdfSinFirma] } });
    expect(await screen.findByText('El contenido seleccionado no tiene firma PDF.')).toBeInTheDocument();

    vi.stubGlobal('crypto', { randomUUID: () => '22222222-aaaa-bbbb-cccc-123456789000' });
    const pdfValido = new File(['%PDF-1.7'], 'examen.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfValido, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(input, { target: { files: [pdfValido] } });
    expect(await screen.findByText('SHA-256 local requiere un navegador en contexto seguro.')).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('rechaza aciertos fuera de rango y conserva request id si falla el alta externa', async () => {
    const fila = { alumnoId: 'a-1', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: '', matricula: 'A001', grupo: 'A', calificacionFinalCurso: '5.99', calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, resultadosExtraordinarios: [] };
    obtenerMock.mockImplementation((ruta: string) => ruta.startsWith('/analiticas/lista-academica') ? Promise.resolve({ filas: [fila] }) : Promise.resolve({ plantillas: [], examenes: [] }));
    vi.stubGlobal('crypto', { randomUUID: () => '33333333-aaaa-bbbb-cccc-123456789000', subtle: { digest: vi.fn(async () => new Uint8Array(32).fill(0x0a).buffer) } });
    enviarMock.mockRejectedValueOnce(new Error('Error de registro')).mockResolvedValue({});
    render(<ExtraordinariosCalificaciones periodos={[{ _id: 'p-1', nombre: 'Materia' }]} periodoId="p-1" onPeriodoChange={vi.fn()} puedeCalificar puedeGenerar onAbrirRevision={vi.fn()} />);
    await screen.findByText('Elegibilidad y solicitud');
    abrirDisclosure('extra-externo-disclosure');
    fireEvent.change(await screen.findByRole('combobox', { name: /^Alumno solicitante elegible/ }), { target: { value: 'a-1' } });
    const pdf = new File(['%PDF-1.7'], 'anwar.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdf, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.7').buffer });
    fireEvent.change(screen.getByLabelText(/^PDF local/), { target: { files: [pdf] } });
    await screen.findByText('SHA-256 local: ' + '0a'.repeat(32));
    fireEvent.change(screen.getByLabelText(/^Folio visible/), { target: { value: ' extra-1 ' } });
    fireEvent.change(screen.getByLabelText(/^Aciertos confirmados/), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText(/^Reactivos evaluables/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^Criterios aplicados/), { target: { value: 'Criterio manual detallado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    expect(await screen.findByText(/Confirma elegibilidad y solicitud/)).toBeInTheDocument();
    expect(enviarMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Aciertos confirmados/), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    await screen.findByText('Error de registro');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado externo' }));
    await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(2));
    expect(enviarMock.mock.calls[0][1].clientRequestId).toBe(enviarMock.mock.calls[1][1].clientRequestId);
  });
