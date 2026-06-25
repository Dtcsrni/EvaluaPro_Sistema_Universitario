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
    baseApi: '/api'
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
          plantillas: [{ _id: 'pla-1', titulo: 'Plantilla Algebra', tipo: 'parcial', numeroPaginas: 1 }]
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
              plantillaTitulo: 'Plantilla Algebra',
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

    await waitFor(() => expect(obtenerMock).toHaveBeenCalledWith('/examenes/plantillas'));

    await user.selectOptions(screen.getByLabelText('Alumno'), 'alu-1');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /FOL-1 · Parcial 1 · Plantilla Algebra · entregado/i })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Examen entregado'), 'ex-1');
    await user.click(screen.getByRole('button', { name: /Usar examen para calificación manual/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Calificar examen · Parcial 1/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Modo manual activo · Folio FOL-1 · Tipo Parcial 1 · Plantilla Plantilla Algebra/i)).toBeInTheDocument();
    expect((clienteApi as { obtener: unknown }).obtener).toBeDefined();
  });

  it('evita bucle de reintentos cuando /calificaciones/examen responde 404', async () => {
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
});
