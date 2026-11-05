/**
 * seccionCalificaciones.manualSelector.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';
import type { Alumno, PermisosUI } from '../src/apps/app_docente/tipos';
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';
import { ErrorRemoto } from '../src/servicios_api/clienteComun';

vi.mock('../src/apps/app_docente/SeccionEscaneo', () => ({
  SeccionEscaneo: () => <div data-testid="escaneo-mock">Escaneo mock</div>,
  QrAccesoMovil: () => null
}));

const obtenerMock = vi.fn();
vi.mock('../src/apps/app_docente/clienteApiDocente', () => ({
  clienteApi: {
    obtener: (...args: unknown[]) => obtenerMock(...args),
    baseApi: '/api',
    registrarEventosUso: vi.fn()
  }
}));

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const alumno = {
  _id: 'alu-1',
  nombreCompleto: 'Alumno Uno',
  matricula: 'A001',
  grupo: 'A',
  periodoId: 'per-1'
} as unknown as Alumno;

describe('SeccionCalificaciones manual selector', () => {
  beforeEach(() => {
    obtenerMock.mockReset();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') {
        return {
          plantillas: [{ _id: 'pla-1', titulo: 'Primer Parcial · Plantilla Algebra', tipo: 'parcial', numeroPaginas: 1 }]
        };
      }
      if (ruta.startsWith('/examenes/generados?alumnoId=')) {
        return {
          examenes: [
            {
              _id: 'ex-1',
              folio: 'FOL-1',
              alumnoId: 'alu-1',
              estado: 'entregado',
              plantillaId: 'pla-1',
              tipoExamen: 'parcial',
              plantillaTitulo: 'Primer Parcial · Plantilla Algebra',
              entregadoEn: '2026-02-16T00:00:00.000Z'
            }
          ]
        };
      }
      if (ruta === '/examenes/generados/folio/FOL-1') {
        return {
          examen: {
            _id: 'ex-1',
            folio: 'FOL-1',
            alumnoId: 'alu-1',
            periodoId: 'per-1',
            mapaVariante: { ordenPreguntas: ['p1'] }
          }
        };
      }
      if (ruta === '/banco-preguntas?periodoId=per-1') {
        return {
          preguntas: [
            {
              _id: 'p1',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 1',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            }
          ]
        };
      }
      return {};
    });
  });

  it('muestra tipo en selector y en encabezado al activar modo manual', async () => {
    const user = userEvent.setup();
    const abrirLotesPdfOmr = vi.fn();

    render(
      <SeccionCalificaciones
        alumnos={[alumno, { ...alumno, _id: 'alu-2', periodoId: 'per-2', grupo: 'B' }]}
        periodos={[
          { _id: 'per-1', nombre: 'Materia Uno' },
          { _id: 'per-2', nombre: 'Materia Dos' }
        ]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        onAbrirLotesPdfOmr={abrirLotesPdfOmr}
        avisarSinPermiso={() => {}}
      />
    );

    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas'));
    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));

    const opcionMateriaUno = screen.getByRole('option', { name: 'A001 - Alumno Uno · Materia Uno · Grupo A' });
    const opcionMateriaDos = screen.getByRole('option', { name: 'A001 - Alumno Uno · Materia Dos · Grupo B' });
    expect(opcionMateriaUno).toHaveValue('alu-1');
    expect(opcionMateriaDos).toHaveValue('alu-2');
    expect(opcionMateriaUno).not.toHaveTextContent('(ID:');
    expect(opcionMateriaDos).not.toHaveTextContent('(ID:');
    expect(screen.getByText('Selecciona un alumno')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');
    const selectorAlumno = screen.getByLabelText('Alumno');
    const identidadSeleccionada = screen.getByText('Alumno seleccionado: A001 - Alumno Uno · Materia Uno · Grupo A');
    expect(selectorAlumno).toHaveAttribute('aria-describedby', 'calificacion-manual-alumno-seleccionado');
    expect(identidadSeleccionada).toHaveAttribute('id', 'calificacion-manual-alumno-seleccionado');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /FOL-1 · Parcial 1 · Primer Parcial · Plantilla Algebra · entregado/i })).toBeInTheDocument();
    });
    expect(screen.getByText('Exámenes cargados: 1')).toBeInTheDocument();
    expect(screen.getByText('Coincidencias de folio: 1')).toBeInTheDocument();

    const buscarFolio = screen.getByLabelText('Buscar folio');
    expect(buscarFolio).toHaveAttribute('type', 'search');
    await user.type(buscarFolio, 'inexistente');
    expect(screen.getByText('No hay exámenes que coincidan con el folio buscado.')).toBeInTheDocument();
    expect(screen.getByText('Coincidencias de folio: 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('option', { name: /FOL-1 · Parcial 1 · Primer Parcial · Plantilla Algebra · entregado/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Examen entregado o calificado'), 'ex-1');
    expect(screen.queryByText('Tu perfil no tiene permiso para calificar manualmente.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Usar examen para calificación manual/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Calificar examen · Parcial 1/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Captura manual de aciertos · Folio FOL-1 · Tipo Parcial 1 · Plantilla Primer Parcial · Plantilla Algebra/i)).toBeInTheDocument();
    expect((clienteApi as { obtener: unknown }).obtener).toBeDefined();

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await user.click(screen.getByRole('button', { name: 'Procesar PDFs de un lote generado' }));
    expect(abrirLotesPdfOmr).toHaveBeenCalledOnce();
  });

  it('explica el permiso faltante al seleccionar un examen para calificación manual', async () => {
    const user = userEvent.setup();
    const permisosSinCalificar: PermisosUI = {
      ...permisos,
      calificaciones: { calificar: false }
    };

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        periodos={[{ _id: 'per-1', nombre: 'Materia Uno' }]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: {} as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisosSinCalificar}
        onAbrirLotesPdfOmr={() => {}}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    expect(screen.queryByText('Tu perfil no tiene permiso para calificar manualmente.')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');
    const opcionExamen = await screen.findByRole('option', { name: /FOL-1 · Parcial 1/i });
    expect(screen.queryByText('Tu perfil no tiene permiso para calificar manualmente.')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Examen entregado o calificado'), opcionExamen);

    const activarManual = screen.getByRole('button', { name: 'Usar examen para calificación manual' });
    const aviso = screen.getByText('Tu perfil no tiene permiso para calificar manualmente.');
    expect(activarManual).toBeDisabled();
    expect(activarManual).toHaveAttribute('aria-describedby', 'calificar-manual-permiso-ayuda');
    expect(aviso.closest('#calificar-manual-permiso-ayuda')).toContainElement(aviso);
    expect(aviso.closest('[role="status"]')).toContainElement(aviso);
  });

  it('permite buscar en páginas posteriores y conserva lo cargado si una página falla', async () => {
    const user = userEvent.setup();
    let intentosPaginaSiguiente = 0;
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') return { plantillas: [] };
      if (ruta.startsWith('/examenes/generados?alumnoId=')) {
        if (ruta.includes('&cursor=')) {
          intentosPaginaSiguiente += 1;
          if (intentosPaginaSiguiente === 1) throw new Error('Error temporal');
          return {
            examenes: [{
              _id: 'ex-2',
              folio: 'FOL-ANTIGUO',
              alumnoId: 'alu-1',
              estado: 'entregado',
              plantillaId: 'pla-1',
              entregadoEn: '2025-01-10T00:00:00.000Z'
            }],
            nextCursor: null
          };
        }
        return {
          examenes: [{
            _id: 'ex-1',
            folio: 'FOL-RECIENTE',
            alumnoId: 'alu-1',
            estado: 'calificado',
            plantillaId: 'pla-1',
            entregadoEn: '2026-02-16T00:00:00.000Z'
          }],
          nextCursor: 'cursor-siguiente'
        };
      }
      return {};
    });

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        periodos={[{ _id: 'per-1', nombre: 'Materia Uno' }]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: {} as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');
    expect(await screen.findByRole('option', { name: /FOL-RECIENTE.*calificado/i })).toBeInTheDocument();
    expect(screen.getByText(/Hay más exámenes por cargar/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar folio'), 'FOL-ANTIGUO');
    expect(screen.getByText(/No hay coincidencias entre los exámenes cargados \(1\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cargar más exámenes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo cargar la página siguiente/);

    expect(screen.getByText('Exámenes cargados: 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('option', { name: /FOL-RECIENTE.*calificado/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar folio'), 'FOL-ANTIGUO');
    await user.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(await screen.findByRole('option', { name: /FOL-ANTIGUO.*entregado/i })).toBeInTheDocument();
    expect(screen.getByText('Se cargó 1 examen más.')).toBeInTheDocument();
    expect(screen.getByText('Exámenes cargados: 2')).toBeInTheDocument();
    expect(obtenerMock).toHaveBeenCalledWith('/examenes/generados?alumnoId=alu-1&limite=200&cursor=cursor-siguiente');
  });

  it('permite reintentar la carga fallida de exámenes del alumno', async () => {
    const user = userEvent.setup();
    let intentos = 0;
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') return { plantillas: [] };
      if (ruta.startsWith('/examenes/generados?alumnoId=')) {
        intentos += 1;
        if (intentos === 1) throw new Error('Error temporal de red');
        return {
          examenes: [{
            _id: 'ex-reintento',
            folio: 'FOL-REINTENTO',
            alumnoId: 'alu-1',
            estado: 'calificado',
            plantillaId: 'pla-1',
            tipoExamen: 'parcial',
            plantillaTitulo: 'Parcial calificado',
            entregadoEn: '2026-02-16T00:00:00.000Z'
          }]
        };
      }
      return {};
    });

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        periodos={[{ _id: 'per-1', nombre: 'Materia Uno' }]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: {} as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los exámenes de este alumno. Selecciona «Reintentar carga de exámenes» para volver a consultar.'
    );
    expect(screen.getByText('Lista no disponible')).toBeInTheDocument();
    expect(screen.queryByText(/Exámenes cargados:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Coincidencias de folio:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar folio')).toBeDisabled();
    expect(screen.getByLabelText('Examen entregado o calificado')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reintentar carga de exámenes' }));

    expect(await screen.findByRole('option', { name: /FOL-REINTENTO.*calificado/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Examen entregado o calificado')).toBeEnabled();
    expect(screen.getByText('Exámenes cargados: 1')).toBeInTheDocument();
    expect(intentos).toBe(2);
  });

  it('evita bucle de reintentos cuando /calificaciones/examen responde 404', async () => {
    const user = userEvent.setup();
    obtenerMock.mockReset();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') {
        return { plantillas: [{ _id: 'pla-1', titulo: 'Plantilla Algebra', tipo: 'parcial', numeroPaginas: 1 }] };
      }
      if (ruta === '/examenes/generados?limite=200') {
        return {
          examenes: [
            {
              _id: 'ex-cal-1',
              folio: 'FOL-CAL-1',
              alumnoId: 'alu-1',
              estado: 'calificado',
              plantillaId: 'pla-1',
              tipoExamen: 'parcial',
              plantillaTitulo: 'Plantilla Algebra',
              entregadoEn: '2026-02-16T00:00:00.000Z'
            }
          ]
        };
      }
      if (ruta === '/examenes/generados/folio/FOL-CAL-1') {
        return {
          examen: {
            _id: 'ex-cal-1',
            folio: 'FOL-CAL-1',
            alumnoId: 'alu-1',
            periodoId: 'per-1',
            mapaVariante: { ordenPreguntas: ['p1'] }
          }
        };
      }
      if (ruta === '/calificaciones/examen/ex-cal-1') {
        throw new ErrorRemoto('No hay calificación', { status: 404, codigo: 'CALIFICACION_NO_ENCONTRADA' });
      }
      if (ruta === '/banco-preguntas?periodoId=per-1') {
        return {
          preguntas: [
            {
              _id: 'p1',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 1',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            }
          ]
        };
      }
      return {};
    });

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo="ex-cal-1"
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await waitFor(() => {
      const llamadas = obtenerMock.mock.calls.filter((args) => String(args[0]) === '/calificaciones/examen/ex-cal-1');
      expect(llamadas.length).toBe(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const llamadasFinales = obtenerMock.mock.calls.filter((args) => String(args[0]) === '/calificaciones/examen/ex-cal-1');
    expect(llamadasFinales.length).toBe(1);
    expect(screen.getByText(/Aún no hay calificación guardada para el examen seleccionado./i)).toBeInTheDocument();
  });

  it('rehidrata la revisión histórica por páginas al seleccionar examen calificado', async () => {
    const user = userEvent.setup();
    const onCargarRevisionHistoricaCalificada = vi.fn();
    obtenerMock.mockReset();
    obtenerMock.mockImplementation(async (ruta: string) => {
      if (ruta === '/examenes/plantillas') {
        return { plantillas: [{ _id: 'pla-1', titulo: 'Plantilla Algebra', tipo: 'parcial', numeroPaginas: 2 }] };
      }
      if (ruta === '/examenes/generados?limite=200') {
        return {
          examenes: [
            {
              _id: 'ex-cal-2',
              folio: 'FOL-CAL-2',
              alumnoId: 'alu-1',
              estado: 'calificado',
              plantillaId: 'pla-1',
              tipoExamen: 'parcial',
              plantillaTitulo: 'Plantilla Algebra',
              entregadoEn: '2026-02-16T00:00:00.000Z'
            }
          ]
        };
      }
      if (ruta === '/examenes/generados/folio/FOL-CAL-2') {
        return {
          examen: {
            _id: 'ex-cal-2',
            folio: 'FOL-CAL-2',
            alumnoId: 'alu-1',
            periodoId: 'per-1',
            mapaVariante: { ordenPreguntas: ['p1', 'p2', 'p3', 'p4'] },
            paginas: [
              { numero: 1, preguntasDel: 1, preguntasAl: 2 },
              { numero: 2, preguntasDel: 3, preguntasAl: 4 }
            ]
          }
        };
      }
      if (ruta === '/calificaciones/examen/ex-cal-2') {
        return {
          calificacion: {
            respuestasDetectadas: [
              { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
              { numeroPregunta: 2, opcion: 'B', confianza: 0.8 },
              { numeroPregunta: 3, opcion: 'C', confianza: 0.7 },
              { numeroPregunta: 4, opcion: 'D', confianza: 0.6 }
            ],
            aciertos: 3,
            totalReactivos: 4,
            calificacionExamenFinalTexto: '3.75'
          }
        };
      }
      if (ruta === '/banco-preguntas?periodoId=per-1') {
        return {
          preguntas: [
            {
              _id: 'p1',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 1',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            },
            {
              _id: 'p2',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 2',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            },
            {
              _id: 'p3',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 3',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            },
            {
              _id: 'p4',
              versionActual: 1,
              versiones: [
                {
                  numeroVersion: 1,
                  enunciado: 'Pregunta 4',
                  opciones: [
                    { texto: 'A', esCorrecta: true },
                    { texto: 'B', esCorrecta: false },
                    { texto: 'C', esCorrecta: false },
                    { texto: 'D', esCorrecta: false },
                    { texto: 'E', esCorrecta: false }
                  ]
                }
              ]
            }
          ]
        };
      }
      return {};
    });

    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo="ex-cal-2"
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        onCargarRevisionHistoricaCalificada={onCargarRevisionHistoricaCalificada}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Revisión y captura/i }));
    await waitFor(() => {
      expect(onCargarRevisionHistoricaCalificada).toHaveBeenCalledTimes(1);
    });

    const payload = onCargarRevisionHistoricaCalificada.mock.calls[0][0] as {
      numeroPagina: number;
      paginas?: Array<{ numeroPagina: number; respuestas: Array<{ numeroPregunta: number }> }>;
    };

    expect(payload.numeroPagina).toBe(1);
    expect(Array.isArray(payload.paginas)).toBe(true);
    expect(payload.paginas).toHaveLength(2);
    expect(payload.paginas?.map((p) => p.numeroPagina)).toEqual([1, 2]);
    expect(payload.paginas?.[0]?.respuestas.map((r) => r.numeroPregunta)).toEqual([1, 2]);
    expect(payload.paginas?.[1]?.respuestas.map((r) => r.numeroPregunta)).toEqual([3, 4]);
  });

  it('descarga reporte CSV de la materia seleccionada', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tokenDocente', 'token-test');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['csv']) });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickDescarga = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    render(
      <SeccionCalificaciones
        periodos={[{ _id: 'per-1', nombre: 'Periodo 1' } as never]}
        alumnos={[alumno]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as never })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /Reportes y exportación/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Descargar CSV/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /Descargar CSV/i }));

    await waitFor(() => expect(screen.getByText(/Descarga CSV solicitada en el navegador/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/analiticas/calificaciones-csv?periodoId=per-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-test' } })
    );
    expect(clickDescarga).toHaveBeenCalledTimes(1);
    expect((clickDescarga.mock.contexts[0] as HTMLAnchorElement).download).toBe('calificaciones-per-1.csv');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:test'), { timeout: 2000 });

    await user.click(screen.getByRole('button', { name: /Descargar XLSX/i }));
    await waitFor(() => expect(screen.getByText(/Descarga XLSX solicitada en el navegador/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/analiticas/calificaciones-xlsx?periodoId=per-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-test' } })
    );
    expect(clickDescarga).toHaveBeenCalledTimes(2);
    expect((clickDescarga.mock.contexts[1] as HTMLAnchorElement).download).toBe('calificaciones-per-1.xlsx');
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledTimes(2), { timeout: 2000 });

    localStorage.removeItem('tokenDocente');
    await user.click(screen.getByRole('button', { name: /Descargar CSV/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Sesión no válida/i));
  });
});
