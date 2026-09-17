/**
 * recovery.manifest.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import {
  construirRecoveryBundle,
  construirRecoveryManifest,
  reconstruirClaveDesdeRecoveryManifest,
  verificarRecoveryBundle,
  verificarRecoveryManifest
} from '../src/modulos/modulo_generacion_pdf/domain/recoveryManifest.js';
import { construirTextoQrExamenPagina } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';

describe('recovery manifests', () => {
  it('construye y verifica un manifiesto de recuperación por examen', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-R1',
      numeroPagina: 1,
      templateVersion: 4,
      examId: 'EXAM-001',
      totalPreguntas: 2,
      preguntaDesde: 1,
      preguntaHasta: 2,
      questionIdsPagina: ['q1', 'q2'],
      mapaVariante: {
        ordenPreguntas: ['q1', 'q2'],
        ordenOpcionesPorPregunta: {
          q1: [1, 0, 2, 3, 4],
          q2: [4, 3, 2, 1, 0]
        }
      },
      preguntas: [
        {
          id: 'q1',
          enunciado: 'Uno',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: true },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        },
        {
          id: 'q2',
          enunciado: 'Dos',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: true }
          ]
        }
      ]
    });

    const manifest = construirRecoveryManifest({
      examId: 'EXAM-001',
      docenteId: 'DOC-001',
      periodoId: 'PER-001',
      plantillaId: 'PLA-001',
      loteId: 'LOT-001',
      folio: 'FOLIO-R1',
      templateVersion: 4,
      preguntas: [
        {
          id: 'q1',
          enunciado: 'Uno',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: true },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        },
        {
          id: 'q2',
          enunciado: 'Dos',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: true }
          ]
        }
      ],
      mapaVariante: {
        ordenPreguntas: ['q1', 'q2'],
        ordenOpcionesPorPregunta: {
          q1: [1, 0, 2, 3, 4],
          q2: [4, 3, 2, 1, 0]
        }
      },
      paginas: [{ numero: 1, qrTexto: qr, preguntasDel: 1, preguntasAl: 2 }],
      pdfBytes: new Uint8Array([1, 2, 3]),
      mapaOmr: {
        margenMm: 10,
        templateVersion: 4,
        perfilLayout: {
          gridStepPt: 12,
          headerHeightFirst: 100,
          headerHeightOther: 80,
          bottomSafePt: 30,
          usarRellenosDecorativos: false,
          usarEtiquetaOmrSolida: true
        },
        perfil: {
          qrSize: 72,
          qrPadding: 8,
          qrMarginModulos: 2,
          marcasEsquina: 'cuadrados',
          marcaCuadradoSize: 10,
          marcaCuadradoQuietZone: 4,
          burbujaRadio: 8,
          burbujaPasoY: 18,
          cajaOmrAncho: 52,
          fiducialSize: 6
        },
        paginas: [
          {
            numeroPagina: 1,
            qr: { texto: qr, x: 10, y: 10, size: 72, padding: 8 },
            marcasPagina: {
              tipo: 'cuadrados',
              size: 10,
              quietZone: 4,
              tl: { x: 0, y: 0 },
              tr: { x: 100, y: 0 },
              bl: { x: 0, y: 100 },
              br: { x: 100, y: 100 }
            },
            preguntas: [
              {
                numeroPregunta: 1,
                idPregunta: 'q1',
                opciones: []
              },
              {
                numeroPregunta: 2,
                idPregunta: 'q2',
                opciones: []
              }
            ]
          }
        ]
      }
    });

    expect(manifest.keyId).toBeTruthy();
    expect(manifest.qrKeyId).toBeTruthy();
    expect(manifest.manifestHash).toMatch(/^[A-Z0-9]{32}$/);
    expect(manifest.traceability.schema).toBe('omr-recovery-trace-v1');
    expect(manifest.traceability.mapaOmrHash).toMatch(/^[A-Z0-9]{64}$/);
    expect(manifest.traceability.sourcePdfSha256).toMatch(/^[A-Z0-9]{64}$/);
    expect(manifest.answerKeySnapshot.hash).toMatch(/^[A-Z0-9]{64}$/);
    expect(manifest.answerKeySnapshot.entries.map((entry) => entry.correctLetterVisible)).toEqual(['A', 'A']);
    expect(reconstruirClaveDesdeRecoveryManifest(manifest)?.map((entry) => entry.correcta)).toEqual(['A', 'A']);
    expect(verificarRecoveryManifest(manifest)).toBe(true);

    const manifestAlterado = {
      ...manifest,
      answerKeySnapshot: {
        ...manifest.answerKeySnapshot,
        entries: manifest.answerKeySnapshot.entries.map((entry, index) => index === 0
          ? { ...entry, correctLetterVisible: 'E' }
          : entry)
      }
    };
    expect(verificarRecoveryManifest(manifestAlterado)).toBe(false);
    expect(reconstruirClaveDesdeRecoveryManifest(manifestAlterado)).toBeNull();
  });

  it('construye y verifica un bundle de recuperación por lote', () => {
    const base = {
      version: 1 as const,
      kind: 'exam-recovery' as const,
      keyId: 'recovery-h1-v1',
      generatedAt: new Date().toISOString(),
      docenteId: 'DOC-001',
      periodoId: 'PER-001',
      plantillaId: 'PLA-001',
      loteId: 'LOT-001',
      templateVersion: 4 as const,
      totalPaginas: 1,
      totalPreguntas: 1,
      variantHash: 'AAAAAAAAAAAA',
      answerKeyHash: 'BBBBBBBBBBBB',
      qrKeyId: 'qr-h1-v1',
      questionBankHash: 'CCCCCCCCCCCCCCCCCCCCCCCC',
      answerKeySnapshot: {
        schema: 'omr-answer-key-v1' as const,
        entries: [{
          questionId: 'q1',
          questionRef: 'QREF0001',
          pageNumber: 1,
          visibleNumber: 1,
          correctLetterVisible: 'A',
          correctOriginalIndex: 0
        }],
        hash: 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE'
      },
      traceability: {
        schema: 'omr-recovery-trace-v1' as const,
        contractId: 'omr-canonical-v4' as const,
        templateVersion: 4 as const,
        renderer: { engine: 'pdf-lib-canonical' as const, layoutVersion: 4 },
        mapaOmrHash: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        questionSnapshotHash: 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
        reconstruction: {
          mode: 'snapshot-plus-versioned-renderer' as const,
          ready: true as const,
          requiredArtifacts: ['source-pdf', 'omr-map', 'question-snapshot', 'variant-map'] as const
        }
      },
      mapaOmrSnapshot: {} as never,
      pages: [],
      questions: [
        {
          questionId: 'q1',
          questionRef: 'QREF0001',
          pageNumber: 1,
          visibleNumber: 1,
          variantOrder: [0, 1, 2, 3, 4],
          correctLetterVisible: 'A',
          enunciado: 'Uno',
          opcionesBase: [{ index: 0, texto: 'A', esCorrecta: true }],
          opcionesVisibles: [{ letra: 'A', originalIndex: 0, texto: 'A', esCorrecta: true }]
        }
      ],
      signature: 'R1DUMMY',
      manifestHash: 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'
    };
    const bundle = construirRecoveryBundle({
      loteId: 'LOT-001',
      docenteId: 'DOC-001',
      periodoId: 'PER-001',
      plantillaId: 'PLA-001',
      templateVersion: 4,
      manifests: [
        { ...base, examId: 'EX-1', folio: 'FOLIO-1' },
        { ...base, examId: 'EX-2', folio: 'FOLIO-2' }
      ]
    });

    expect(bundle.keyId).toBeTruthy();
    expect(bundle.totalExamenes).toBe(2);
    expect(bundle.questionBank).toHaveLength(1);
    expect(verificarRecoveryBundle(bundle)).toBe(true);
  });
});
