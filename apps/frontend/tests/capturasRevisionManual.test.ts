import { describe, expect, it } from 'vitest';
import { asociarCapturasRevisionManual, asociarPaginasIngestaParaManual, actualizarRespuestaManual, identidadExamenManual, paginasExamenManual, tieneCapturaManualVinculada, filtrarExamenesConCapturaManual, etiquetaExamenParaSelectorManual } from '../src/apps/app_docente/capturasRevisionManual';
import type { RevisionExamenOmr } from '../src/apps/app_docente/tipos';

const revision = (overrides: Partial<RevisionExamenOmr> = {}): RevisionExamenOmr => ({
  examenId: 'ex-1',
  folio: 'FOL-1',
  alumnoId: 'alu-1',
  paginas: [
    { numeroPagina: 2, imagenBase64: 'data:image/png;base64,Ag==', respuestas: [], resultado: {} as never, actualizadoEn: 1 },
    { numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQ==', respuestas: [], resultado: {} as never, actualizadoEn: 1 }
  ],
  claveCorrectaPorNumero: {},
  ordenPreguntas: [],
  revisionConfirmada: false,
  actualizadoEn: 1,
  creadoEn: 1,
  ...overrides
});

describe('asociarCapturasRevisionManual', () => {
  it('construye una etiqueta inequívoca para el selector de examen manual', () => {
    expect(etiquetaExamenParaSelectorManual(
      { folio: 'FOL-1', tipoExamen: 'parcial', plantillaTitulo: 'Segundo Parcial' },
      'global',
      'Plantilla Global'
    )).toBe('FOL-1 · Parcial 2 · Segundo Parcial · captura vinculada');

    expect(etiquetaExamenParaSelectorManual(
      { folio: 'FOL-2' },
      'extraordinario',
      'Extraordinario final'
    )).toBe('FOL-2 · Extraordinario · Extraordinario final · captura vinculada');
  });

  it('normaliza la identidad y los rangos de página del examen', () => {
    expect(identidadExamenManual(
      { _id: ' ex-1 ', folio: 'fol-1', alumnoId: null },
      { _id: 'ex-fallback', folio: 'FOL-fallback', alumnoId: 'alu-1' },
      'alu-1'
    )).toEqual({ examenId: 'ex-1', folio: 'FOL-1', alumnoId: 'alu-1' });
    expect(paginasExamenManual({ paginas: [{ numero: 1, preguntasDel: 1, preguntasAl: 5 }, { numero: 0 }] })).toEqual([
      { numeroPagina: 1, preguntasDel: 1, preguntasAl: 5 }
    ]);
  });

  it('solo enlaza el examen, folio y alumno canónicos, ordena páginas y reporta las ausentes', () => {
    const result = asociarCapturasRevisionManual(
      [revision(), revision({ examenId: 'otro-examen' })],
      { examenId: 'ex-1', folio: 'fol-1', alumnoId: 'alu-1' },
      [
        { numeroPagina: 1, preguntasDel: 1, preguntasAl: 5 },
        { numeroPagina: 2, preguntasDel: 6, preguntasAl: 10 },
        { numeroPagina: 3, preguntasDel: 11, preguntasAl: 15 }
      ]
    );

    expect(result.identidadEncontrada).toBe(true);
    expect(result.paginas.map((pagina) => pagina.numeroPagina)).toEqual([1, 2]);
    expect(result.paginas[0].preguntas).toEqual([1, 2, 3, 4, 5]);
    expect(result.faltantes).toEqual([3]);
  });

  it('no asocia una captura cuando el folio o alumno no coincide', () => {
    const result = asociarCapturasRevisionManual(
      [revision()],
      { examenId: 'ex-1', folio: 'FOL-2', alumnoId: 'alu-2' },
      [{ numeroPagina: 1 }, { numeroPagina: 2 }]
    );

    expect(result.identidadEncontrada).toBe(false);
    expect(result.paginas).toEqual([]);
    expect(result.faltantes).toEqual([1, 2]);
  });

  it('no habilita revisión si falta la identidad del alumno aunque coincidan folio y examen', () => {
    const revisionSinAlumno = revision({ alumnoId: undefined });
    const identidad = { examenId: 'ex-1', folio: 'FOL-1', alumnoId: 'alu-1' };

    expect(tieneCapturaManualVinculada([revisionSinAlumno], identidad)).toBe(false);
    expect(asociarCapturasRevisionManual([revisionSinAlumno], identidad, [{ numeroPagina: 1 }])).toMatchObject({
      paginas: [],
      identidadEncontrada: false,
      faltantes: [1]
    });
  });

  it('lista capturas exactas aunque el estado sea generado y excluye calificados o identidades distintas', () => {
    const examenes = [
      { _id: 'ex-1', folio: 'FOL-1', alumnoId: 'alu-1', estado: 'generado' },
      { _id: 'ex-2', folio: 'FOL-2', alumnoId: 'alu-1', estado: 'entregado' },
      { _id: 'ex-1-calificado', folio: 'FOL-1', alumnoId: 'alu-1', estado: 'calificado' },
      { _id: 'ex-3', folio: 'FOL-3', alumnoId: 'alu-otro', estado: 'entregado' }
    ];

    expect(filtrarExamenesConCapturaManual(examenes, [revision()], 'alu-1')).toEqual([examenes[0]]);
  });

  it('distingue una respuesta seleccionada de un blanco confirmado', () => {
    const contexto = {
      examenId: 'ex-1', alumnoId: 'alu-1', folio: 'FOL-1',
      claveCorrectaPorNumero: { 1: 'A' }, ordenPreguntas: [1],
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: null, confianza: 0 }],
      paginasCaptura: [{ numeroPagina: 1, imagenBase64: 'data:image/png;base64,AQ==', preguntas: [1] }]
    };

    expect(actualizarRespuestaManual(contexto, 1, 'A')?.respuestasDetectadas[0]).toMatchObject({ opcion: 'A', estadoRespuesta: 'respondida' });
    expect(actualizarRespuestaManual(contexto, 1, null)?.respuestasDetectadas[0]).toMatchObject({ opcion: null, estadoRespuesta: 'sin_marca' });
    expect(actualizarRespuestaManual(contexto, 1, undefined)?.respuestasDetectadas[0]).toMatchObject({ opcion: null, estadoRespuesta: 'manual_review' });
  });
});

describe('asociarPaginasIngestaParaManual', () => {
  const exam = { id: 'ex-1', folio: 'FOL-1', pages: [1, 2] };
  const pages = [
    { pageIndex: 2, scanStatus: 'accepted', examId: 'ex-1', folio: 'fol-1', examPage: 2, identitySource: 'qr', identityResult: { studentId: 'alu-1' } },
    { pageIndex: 1, scanStatus: 'accepted', examId: 'ex-1', folio: 'FOL-1', examPage: 1, identitySource: 'qr', identityResult: { studentId: 'alu-1' } }
  ];

  it('ordena las páginas y conserva la identidad solo con cobertura QR completa', () => {
    expect(asociarPaginasIngestaParaManual(exam, pages)).toEqual({
      ok: true,
      examenId: 'ex-1',
      folio: 'FOL-1',
      alumnoId: 'alu-1',
      paginas: [{ pageIndex: 1, numeroPagina: 1 }, { pageIndex: 2, numeroPagina: 2 }]
    });
  });

  it.each([
    ['página ausente', pages.slice(0, 1)],
    ['página duplicada', [pages[0], pages[1], { ...pages[1], pageIndex: 3 }]],
    ['índice de página fuente duplicado', [pages[0], { ...pages[1], pageIndex: pages[0].pageIndex }]],
    ['QR no aceptado', [{ ...pages[0], identitySource: 'manual' }, pages[1]]],
    ['estado pendiente', [{ ...pages[0], scanStatus: 'needs_review' }, pages[1]]],
    ['alumno distinto', [pages[0], { ...pages[1], identityResult: { studentId: 'alu-2' } }]],
    ['examen distinto', [{ ...pages[0], examId: 'ex-2' }, pages[1]]]
  ])('se abstiene cuando existe %s', (_caso, capturas) => {
    expect(asociarPaginasIngestaParaManual(exam, capturas as typeof pages)).toMatchObject({ ok: false });
  });
});
