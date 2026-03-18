import { describe, expect, it } from 'vitest';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf tv4 compatibilidad', () => {
  it('genera QR enriquecido, mapa TV4 y normaliza 4 opciones al contrato OMR de 5', async () => {
    const resultado = await generarPdfExamen({
      titulo: 'Compat TV4',
      folio: 'TV4-COMPAT-001',
      examId: 'TV4-EXAM-001',
      preguntas: [
        {
          id: 'p1',
          enunciado: 'Pregunta con 4 opciones',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: true },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false }
          ]
        }
      ],
      mapaVariante: {
        ordenPreguntas: ['p1'],
        ordenOpcionesPorPregunta: { p1: [1, 0, 2, 3] }
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 10,
      templateVersion: 4
    });

    const qrTexto = String(resultado.paginas[0]?.qrTexto ?? '');
    const qrResumen = extraerResumenQrExamen(qrTexto);

    expect(resultado.mapaOmr.templateVersion).toBe(4);
    expect(resultado.mapaOmr.blockSpec?.opcionesPorPregunta).toBe(5);
    expect(resultado.mapaOmr.paginas[0]?.preguntas[0]?.opciones?.length ?? 0).toBe(5);
    expect(qrResumen).not.toBeNull();
    expect(qrResumen?.templateVersion).toBe(4);
    expect(qrResumen?.folio).toBe('TV4-COMPAT-001');
    expect(qrResumen?.examId).toBe('TV4-EXAM-001');
    expect(qrResumen?.variantHash).toBeTruthy();
    expect(qrResumen?.answerKeyHash).toBeTruthy();
    expect(qrResumen?.questionRefs).toHaveLength(1);
    expect(qrResumen?.optionOrders).toEqual(['10234']);
    expect(resultado.mapaOmr.paginas[0]?.qr?.texto).toBe(qrTexto);
  });

  it('rechaza preguntas con mas de 5 opciones por incompatibilidad TV4', async () => {
    await expect(
      generarPdfExamen({
        titulo: 'Compat TV4',
        folio: 'TV4-COMPAT-002',
        preguntas: [
          {
            id: 'p1',
            enunciado: 'Pregunta con 6 opciones',
            opciones: [
              { texto: 'A', esCorrecta: true },
              { texto: 'B', esCorrecta: false },
              { texto: 'C', esCorrecta: false },
              { texto: 'D', esCorrecta: false },
              { texto: 'E', esCorrecta: false },
              { texto: 'F', esCorrecta: false }
            ]
          }
        ],
        mapaVariante: {
          ordenPreguntas: ['p1'],
          ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3, 4, 5] }
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      })
    ).rejects.toThrow('TV4 soporta maximo 5');
  });
});
