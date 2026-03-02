import { describe, expect, it } from 'vitest';
import {
  agruparPaginasPorHojaV1,
  calificarRespuestasV1,
  crearPreviewFingerprintV1,
  crearTemplateSnapshotV1,
  generarVersionesDeterministasV1,
  resolverAutoGradableV1,
  resolverBindingsOmrV1,
  resolverScanStatusV1,
  resumirPaginasJobV1,
  shuffleDeterministaV1
} from '../src/modulos/modulo_omr_v1/workflowOmrV1';

describe('workflowOmrV1', () => {
  const preguntasBase = [
    {
      id: 'p1',
      enunciado: 'Pregunta 1',
      opciones: [
        { texto: 'A', esCorrecta: true },
        { texto: 'B', esCorrecta: false },
        { texto: 'C', esCorrecta: false }
      ]
    },
    {
      id: 'p2',
      enunciado: 'Pregunta 2',
      opciones: [
        { texto: 'A', esCorrecta: false },
        { texto: 'B', esCorrecta: true },
        { texto: 'C', esCorrecta: false }
      ]
    }
  ];

  it('genera versiones deterministas con la misma seed', () => {
    const first = generarVersionesDeterministasV1({
      preguntas: preguntasBase,
      versionCount: 2,
      generationSeed: 'seed-omr-v1'
    });
    const second = generarVersionesDeterministasV1({
      preguntas: preguntasBase,
      versionCount: 2,
      generationSeed: 'seed-omr-v1'
    });

    expect(second).toEqual(first);
    expect(first[0]?.versionCode).toBe('A');
    expect(first[1]?.versionCode).toBe('B');
  });

  it('resuelve bindings roster y califica respuestas correctamente', () => {
    const bindings = resolverBindingsOmrV1({
      prefillMode: 'roster',
      folio: 'FOLIO1',
      students: [
        { _id: 'al-1', matricula: 'M001', nombreCompleto: 'Alumno Uno' },
        { _id: 'al-2', matricula: 'M002', nombreCompleto: 'Alumno Dos' }
      ],
      versionCodes: ['A', 'B']
    });
    expect(bindings).toHaveLength(2);
    expect(bindings[0]?.studentId).toBe('M001');
    expect(bindings[1]?.versionCode).toBe('B');

    const version = generarVersionesDeterministasV1({
      preguntas: preguntasBase,
      versionCount: 1,
      generationSeed: 'score-seed'
    })[0]!;
    const score = calificarRespuestasV1({
      answerKey: version.answerKey,
      responses: [
        { numeroPregunta: 1, opcion: version.answerKey[0]?.correcta ?? null },
        { numeroPregunta: 2, opcion: 'Z' }
      ]
    });

    expect(score.correctas).toBe(1);
    expect(score.contestadas).toBe(2);
    expect(score.invalidas).toBe(1);
    expect(score.porcentaje).toBe(50);
  });

  it('resume páginas y resuelve auto-grade/status con reglas conservadoras', () => {
    const pages = [
      {
        sheetSerial: 'S-001',
        pageIndex: 2,
        scanStatus: 'accepted',
        autoGradable: true,
        scoreResult: { porcentaje: 90 }
      },
      {
        sheetSerial: 'S-001',
        pageIndex: 1,
        scanStatus: 'needs_review',
        autoGradable: false,
        scoreResult: { porcentaje: 50 }
      },
      {
        sheetSerial: 'S-002',
        pageIndex: 1,
        scanStatus: 'rejected',
        autoGradable: false,
        scoreResult: { porcentaje: 0 }
      }
    ];

    const grouped = agruparPaginasPorHojaV1(pages);
    expect(grouped.get('S-001')?.map((page) => page.pageIndex)).toEqual([1, 2]);

    const summary = resumirPaginasJobV1(pages);
    expect(summary).toMatchObject({
      accepted: 1,
      needsReview: 1,
      rejected: 1,
      autoGradable: 1,
      sheets: 2
    });
    expect(summary.averageScore).toBeCloseTo(46.67, 2);

    expect(
      resolverAutoGradableV1({
        confidence: 0.95,
        exceptions: [],
        studentId: 'M001',
        versionCode: 'A'
      })
    ).toBe(true);

    expect(
      resolverScanStatusV1({
        confidence: 0.81,
        exceptions: [],
        studentId: 'M001',
        versionCode: 'A'
      })
    ).toBe('needs_review');
    expect(
      resolverScanStatusV1({
        confidence: 0.95,
        exceptions: [{ severity: 'blocking' }],
        studentId: 'M001',
        versionCode: 'A'
      })
    ).toBe('rejected');
  });

  it('mantiene fingerprint estable y shuffle determinista para snapshot equivalente', () => {
    const snapshot = crearTemplateSnapshotV1({
      _id: 'tpl-1',
      updatedAt: '2026-03-01T00:00:00.000Z',
      titulo: 'Parcial V1',
      numeroPaginas: 2,
      reactivosObjetivo: 10,
      defaultVersionCount: 2,
      preguntasIds: ['p1', 'p2'],
      temas: ['Algebra'],
      bookletConfig: { targetPages: 2 },
      omrConfig: { sheetFamilyCode: 'S50_5A_ID5_VR6' }
    });
    const fingerprintA = crearPreviewFingerprintV1(snapshot);
    const fingerprintB = crearPreviewFingerprintV1({
      ...snapshot,
      preguntasIds: shuffleDeterministaV1(['p1', 'p2'], 'same-seed').sort()
    });

    expect(fingerprintA).toBeTypeOf('string');
    expect(fingerprintA.length).toBeGreaterThan(8);
    expect(fingerprintB).not.toBe('');
  });
});
