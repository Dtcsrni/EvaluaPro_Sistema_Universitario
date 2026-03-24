import { describe, expect, it } from 'vitest';
import { ExamenPdf } from '../src/modulos/modulo_generacion_pdf/domain/examenPdf';
import { renderExamHtml } from '../src/modulos/modulo_generacion_pdf/infra/html/examPrintTemplate';
import type { PageToken } from '../src/modulos/modulo_generacion_pdf/infra/html/examLayoutTokens';

function crearPaginaMock(): PageToken {
  return {
    numeroPagina: 1,
    qrTexto: 'EXAMEN:BASELINE:P1:TV4',
    pageShell: { x: 32, y: 32, width: 752, height: 992 },
    headerBox: { x: 32, y: 32, width: 752, height: 132 },
    headerSlots: [],
    footerBox: { x: 32, y: 980, width: 752, height: 44 },
    contentBox: { x: 32, y: 168, width: 752, height: 812 },
    qrBox: { x: 684, y: 46, width: 96, height: 96 },
    preguntas: [
      {
        id: 'p1',
        numero: 1,
        stemHtml: '<p>Pregunta de baseline visual</p>',
        stemText: 'Pregunta de baseline visual',
        opciones: [
          { letra: 'A', texto: 'Opcion A' },
          { letra: 'B', texto: 'Opcion B' },
          { letra: 'C', texto: 'Opcion C' },
          { letra: 'D', texto: 'Opcion D' },
          { letra: 'E', texto: 'Opcion E' }
        ],
        box: { x: 32, y: 180, width: 752, height: 92 },
        numberBox: { x: 32, y: 182, width: 30, height: 26 },
        textBox: { x: 70, y: 180, width: 580, height: 92 },
        omrBox: { x: 676, y: 182, width: 76, height: 90 },
        optionColumns: 2,
        lineHeightStem: 17,
        lineHeightOption: 13
      }
    ]
  };
}

describe('pdf visual baseline', () => {
  it('usa la paleta canonica A050929D en el renderer HTML', () => {
    const examen = new ExamenPdf(
      'Primer Parcial',
      'BASELINE-001',
      'BASELINE-EXAM-001',
      [
        {
          id: 'p1',
          enunciado: 'Pregunta de baseline visual',
          opciones: [
            { texto: 'Opcion A', esCorrecta: true },
            { texto: 'Opcion B', esCorrecta: false },
            { texto: 'Opcion C', esCorrecta: false },
            { texto: 'Opcion D', esCorrecta: false },
            { texto: 'Opcion E', esCorrecta: false }
          ]
        }
      ],
      {
        ordenPreguntas: ['p1'],
        ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3, 4] }
      },
      'parcial',
      { margenMm: 10, templateVersion: 4, totalPaginas: 1 },
      {
        institucion: 'Centro Universitario Hidalguense',
        materia: 'Logica de Programacion',
        docente: 'I.S.C. Docente'
      }
    );

    const html = renderExamHtml({
      pages: [crearPaginaMock()],
      examen,
      qrDataUrls: { 1: 'data:image/png;base64,AAA=' },
      logos: {}
    });

    expect(html).toContain('#141f33');
    expect(html).toContain('#0d75b3');
    expect(html).toContain('#2e3d54');
    expect(html).toContain('#edf7ff');
    expect(html).toContain("'Helvetica Neue', Helvetica, Arial, sans-serif");
    expect(html).not.toContain('#7c3aed');
    expect(html).not.toContain('#22c55e');
    expect(html).not.toContain('#a855f7');
  });
});
