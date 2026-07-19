/**
 * utilidades.appDocente.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esCorreoDeDominioPermitidoFrontend,
  etiquetaMateria,
  idCortoMateria,
  normalizarResultadoOmr,
  obtenerDominiosCorreoPermitidosFrontend,
  obtenerVersionPregunta,
  obtenerVistaInicial,
  patronNombreMateria,
  preguntaTieneCodigo,
  textoDominiosPermitidos
} from '../src/apps/app_docente/utilidades';

const preguntaBase = {
  _id: 'pre-1',
  versionActual: 2,
  versiones: [
    {
      numeroVersion: 1,
      enunciado: 'Pregunta v1',
      opciones: [
        { texto: 'A', esCorrecta: true },
        { texto: 'B', esCorrecta: false }
      ]
    },
    {
      numeroVersion: 2,
      enunciado: 'Pregunta v2',
      opciones: [
        { texto: 'A2', esCorrecta: false },
        { texto: 'B2', esCorrecta: true }
      ]
    }
  ]
} as const;

describe('utilidades app docente', () => {
  it('obtenerVistaInicial respeta vistas validas y aliases', () => {
    window.history.pushState({}, '', '/?vista=banco');
    expect(obtenerVistaInicial()).toBe('banco');
    window.history.pushState({}, '', '/?vista=recepcion');
    expect(obtenerVistaInicial()).toBe('entrega');
    window.history.pushState({}, '', '/?vista=escaneo');
    expect(obtenerVistaInicial()).toBe('calificaciones');
    window.history.pushState({}, '', '/?vista=invalida');
    expect(obtenerVistaInicial()).toBe('periodos');
    window.history.pushState({}, '', '/');
  });

  it('obtenerVersionPregunta usa version actual y fallback a ultima', () => {
    const versionActual = obtenerVersionPregunta(preguntaBase as unknown as Parameters<typeof obtenerVersionPregunta>[0]);
    expect(versionActual?.numeroVersion).toBe(2);

    const sinVersionActual = {
      ...preguntaBase,
      versionActual: 99
    };
    const fallback = obtenerVersionPregunta(sinVersionActual as unknown as Parameters<typeof obtenerVersionPregunta>[0]);
    expect(fallback?.numeroVersion).toBe(2);

    const vacia = { _id: 'x', versiones: [], versionActual: 1 };
    expect(obtenerVersionPregunta(vacia as unknown as Parameters<typeof obtenerVersionPregunta>[0])).toBeNull();
  });

  it('preguntaTieneCodigo detecta patrones en enunciado y opciones', () => {
    const conCodigoEnEnunciado = {
      ...preguntaBase,
      versiones: [{ numeroVersion: 2, enunciado: 'const x = 1;', opciones: [{ texto: 'ok', esCorrecta: true }] }]
    };
    expect(preguntaTieneCodigo(conCodigoEnEnunciado as unknown as Parameters<typeof preguntaTieneCodigo>[0])).toBe(true);

    const conCodigoEnOpcion = {
      ...preguntaBase,
      versiones: [{ numeroVersion: 2, enunciado: 'texto normal', opciones: [{ texto: 'return true;', esCorrecta: true }] }]
    };
    expect(preguntaTieneCodigo(conCodigoEnOpcion as unknown as Parameters<typeof preguntaTieneCodigo>[0])).toBe(true);

    const sinCodigo = {
      ...preguntaBase,
      versiones: [{ numeroVersion: 2, enunciado: 'texto normal', opciones: [{ texto: 'opcion simple', esCorrecta: true }] }]
    };
    expect(preguntaTieneCodigo(sinCodigo as unknown as Parameters<typeof preguntaTieneCodigo>[0])).toBe(false);
  });

  it('construirClaveCorrectaExamen arma clave y orden', () => {
    const banco = [
      {
        _id: 'p1',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            opciones: [
              { texto: 'A', esCorrecta: false },
              { texto: 'B', esCorrecta: true },
              { texto: 'C', esCorrecta: false }
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
            opciones: [
              { texto: 'A', esCorrecta: true },
              { texto: 'B', esCorrecta: false },
              { texto: 'C', esCorrecta: false }
            ]
          }
        ]
      }
    ] as unknown as Parameters<typeof construirClaveCorrectaExamen>[1];

    const examen = {
      preguntasIds: ['p1', 'p2'],
      mapaVariante: {
        ordenPreguntas: ['p1', 'p2'],
        ordenOpcionesPorPregunta: {
          p1: [0, 1, 2],
          p2: [2, 1, 0]
        }
      }
    } as unknown as Parameters<typeof construirClaveCorrectaExamen>[0];

    const { claveCorrectaPorNumero, ordenPreguntas } = construirClaveCorrectaExamen(examen, banco);
    expect(ordenPreguntas).toEqual([1, 2]);
    expect(claveCorrectaPorNumero[1]).toBe('B');
    expect(claveCorrectaPorNumero[2]).toBe('C');

    expect(construirClaveCorrectaExamen(null, banco)).toEqual({
      claveCorrectaPorNumero: {},
      ordenPreguntas: []
    });
  });

  it('prioriza answerKeySet persistido y descarta entradas inválidas', () => {
    const examen = {
      answerKeySet: {
        B: [
          { numeroPregunta: '2', correcta: 'd' },
          { numeroPregunta: 'x', correcta: 'A' },
          { numeroPregunta: 0, correcta: 'B' }
        ],
        A: [
          { numeroPregunta: 3, correcta: 'c' },
          { numeroPregunta: 1, correcta: 'A' },
          { numeroPregunta: 4, correcta: 'AB' }
        ]
      }
    } as unknown as Parameters<typeof construirClaveCorrectaExamen>[0];

    expect(construirClaveCorrectaExamen(examen, [])).toEqual({
      claveCorrectaPorNumero: { 1: 'A', 3: 'C' },
      ordenPreguntas: [1, 3]
    });
  });

  it('combina respuestas OMR por pagina y consolida resultado', () => {
    const paginas = [
      {
        numeroPagina: 2,
        respuestas: [
          { numeroPregunta: 2, opcion: 'B', confianza: 0.6 },
          { numeroPregunta: 4, opcion: '', confianza: 0.1 }
        ],
        resultado: {
          advertencias: ['A1'],
          motivosRevision: ['M1'],
          estadoAnalisis: 'ok',
          calidadPagina: 0.8,
          confianzaPromedioPagina: 0.7,
          ratioAmbiguas: 0.1,
          templateVersionDetectada: 1
        }
      },
      {
        numeroPagina: 1,
        respuestas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
          { numeroPregunta: 2, opcion: 'C', confianza: 0.4 }
        ],
        resultado: {
          advertencias: ['A2'],
          motivosRevision: ['M2'],
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.4,
          confianzaPromedioPagina: 0.5,
          ratioAmbiguas: 0.3,
          templateVersionDetectada: 2,
          qrTexto: 'QR-1'
        }
      }
    ] as unknown as Parameters<typeof combinarRespuestasOmrPaginas>[0];

    const combinadas = combinarRespuestasOmrPaginas(paginas);
    expect(combinadas.map((r) => r.numeroPregunta)).toEqual([1, 2, 4]);
    expect(combinadas.find((r) => r.numeroPregunta === 2)?.opcion).toBe('B');

    const consolidado = consolidarResultadoOmrExamen(paginas);
    expect(consolidado?.estadoAnalisis).toBe('requiere_revision');
    expect(consolidado?.templateVersionDetectada).toBe(3);
    expect(consolidado?.qrTexto).toBe('QR-1');
    expect(consolidado?.advertencias).toEqual(expect.arrayContaining(['A1', 'A2']));
    expect(consolidarResultadoOmrExamen([])).toBeNull();
  });

  it('normaliza resultado OMR con defaults estables', () => {
    const normal = normalizarResultadoOmr({
      respuestasDetectadas: [{ numeroPregunta: '1' as unknown as number, opcion: '', confianza: 'x' as unknown as number }],
      estadoAnalisis: 'otro' as unknown as 'ok',
      calidadPagina: 'nan' as unknown as number
    });

    expect(normal.respuestasDetectadas[0]).toEqual({
      numeroPregunta: 1,
      opcion: null,
      confianza: 0
    });
    expect(normal.estadoAnalisis).toBe('requiere_revision');
    expect(normal.templateVersionDetectada).toBe(1);
  });

  it('dominios de correo, etiquetas e ids', () => {
    vi.stubEnv('VITE_DOMINIOS_CORREO_PERMITIDOS', '@uni.mx, facultad.edu ');
    expect(obtenerDominiosCorreoPermitidosFrontend()).toEqual(['uni.mx', 'facultad.edu']);
    expect(esCorreoDeDominioPermitidoFrontend('a@uni.mx', ['uni.mx'])).toBe(true);
    expect(esCorreoDeDominioPermitidoFrontend('a@otro.mx', ['uni.mx'])).toBe(false);
    expect(esCorreoDeDominioPermitidoFrontend('sin-arroba', ['uni.mx'])).toBe(false);
    expect(textoDominiosPermitidos(['uni.mx', 'facultad.edu'])).toBe('@uni.mx, @facultad.edu');

    expect(idCortoMateria('1234567890', 4)).toBe('7890');
    expect(idCortoMateria('abc', 8)).toBe('abc');
    expect(idCortoMateria('')).toBe('-');
    expect(etiquetaMateria({ _id: '1234567890', nombre: 'Matematicas' })).toContain('Matematicas');
    expect(etiquetaMateria({ _id: '', nombre: '' })).toBe('-');
  });

  it('patronNombreMateria acepta y rechaza formatos esperados', () => {
    expect(patronNombreMateria.test('Calculo I')).toBe(true);
    expect(patronNombreMateria.test('IA-2026 (grupo A)')).toBe(true);
    expect(patronNombreMateria.test('')).toBe(false);
    expect(patronNombreMateria.test('  Empieza con espacio')).toBe(false);
  });
});
