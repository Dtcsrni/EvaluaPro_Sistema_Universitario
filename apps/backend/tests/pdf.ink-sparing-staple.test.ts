import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import {
  detectarColisionesDuplexOmr,
  validarSeparacionDuplexOmr
} from '../src/modulos/modulo_generacion_pdf/domain/duplexOmrGuard.js';
import type { MapaOmr } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';

afterEach(() => vi.unstubAllEnvs());

describe('plantilla OMR de tinta reducida y engrapado', () => {
  it('valida el registro dúplex según el volteo y la tolerancia configurada', () => {
    const mapa = (volteo: 'borde-largo' | 'borde-corto', toleranciaRegistroMm: number): MapaOmr => ({
      margenMm: 8,
      templateVersion: 4,
      templateId: 'omr-canonical-v4',
      impresion: { modo: 'duplex', volteo, paginasPorHoja: 2, toleranciaRegistroMm },
      perfilLayout: {} as MapaOmr['perfilLayout'],
      perfil: { burbujaRadio: 8.5 } as MapaOmr['perfil'],
      paginas: [
        { numeroPagina: 1, templateId: 'omr-canonical-v4', duplex: { hoja: 1, lado: 'frente', indiceEnHoja: 1 }, preguntas: [
          { numeroPregunta: 1, idPregunta: 'q1', opciones: [{ letra: 'A', x: 100, y: 100 }] }
        ] },
        { numeroPagina: 2, templateId: 'omr-canonical-v4', duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 }, preguntas: [
          { numeroPregunta: 2, idPregunta: 'q2', opciones: [{ letra: 'A', x: 492, y: 100 }] }
        ] }
      ]
    });

    expect(detectarColisionesDuplexOmr(mapa('borde-largo', 3))).toHaveLength(1);
    expect(() => validarSeparacionDuplexOmr(mapa('borde-largo', 3))).toThrow(/Plantilla OMR dúplex insegura/);
    expect(detectarColisionesDuplexOmr(mapa('borde-corto', 3))).toHaveLength(0);
    expect(detectarColisionesDuplexOmr(mapa('borde-largo', 1))).toHaveLength(0);
  });

  it('rechaza texto del reverso detrás de una burbuja después del volteo dúplex', () => {
    const mapa: MapaOmr = {
      margenMm: 8,
      templateVersion: 4,
      impresion: { modo: 'duplex', volteo: 'borde-largo', paginasPorHoja: 2, toleranciaRegistroMm: 3 },
      perfilLayout: {} as MapaOmr['perfilLayout'],
      perfil: { burbujaRadio: 8 } as MapaOmr['perfil'],
      paginas: [
        { numeroPagina: 1, duplex: { hoja: 1, lado: 'frente', indiceEnHoja: 1 }, preguntas: [
          { numeroPregunta: 1, idPregunta: 'q1', opciones: [{ letra: 'A', x: 100, y: 100, radio: 8 }] }
        ] },
        { numeroPagina: 2, duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 }, preguntas: [
          {
            numeroPregunta: 2,
            idPregunta: 'q2',
            opciones: [],
            textRuns: [{ tipo: 'texto', fuente: 'sans', size: 8, lineHeight: 10, bbox: { x: 503, y: 96, width: 20, height: 9 } }]
          }
        ] }
      ]
    };

    const colisiones = detectarColisionesDuplexOmr(mapa);
    expect(colisiones.some((item) => item.tipo === 'burbuja-con-tinta-reverso')).toBe(true);
    expect(() => validarSeparacionDuplexOmr(mapa)).toThrow(/contenido impreso detrás de una zona OMR/);
  });

  it('rechaza tinta del reverso detrás de la reserva completa del QR', () => {
    const mapa: MapaOmr = {
      margenMm: 8,
      templateVersion: 4,
      impresion: { modo: 'duplex', volteo: 'borde-largo', paginasPorHoja: 2, toleranciaRegistroMm: 1 },
      perfilLayout: {} as MapaOmr['perfilLayout'],
      perfil: { burbujaRadio: 8 } as MapaOmr['perfil'],
      paginas: [
        {
          numeroPagina: 1,
          duplex: { hoja: 1, lado: 'frente', indiceEnHoja: 1 },
          qr: { texto: 'qr', x: 500, y: 700, size: 32, padding: 3, marginModules: 4 },
          preguntas: []
        },
        {
          numeroPagina: 2,
          duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 },
          preguntas: [{
            numeroPregunta: 2,
            idPregunta: 'q2',
            opciones: [],
            textRuns: [{ tipo: 'texto', fuente: 'sans', size: 8, lineHeight: 10, bbox: { x: 103, y: 706, width: 12, height: 8 } }]
          }]
        }
      ]
    };

    expect(detectarColisionesDuplexOmr(mapa).some((item) => item.tipo === 'qr-con-tinta-reverso')).toBe(true);
  });

  it('rechaza una imagen del reverso detrás de una burbuja', () => {
    const mapa: MapaOmr = {
      margenMm: 8,
      templateVersion: 4,
      templateId: 'omr-inline-exam-v1',
      impresion: { modo: 'duplex', volteo: 'borde-largo', paginasPorHoja: 2, toleranciaRegistroMm: 1 },
      perfilLayout: {} as MapaOmr['perfilLayout'],
      perfil: { burbujaRadio: 8 } as MapaOmr['perfil'],
      paginas: [
        {
          numeroPagina: 1,
          templateId: 'omr-inline-exam-v1',
          duplex: { hoja: 1, lado: 'frente', indiceEnHoja: 1 },
          preguntas: [{ numeroPregunta: 1, idPregunta: 'q1', opciones: [{ letra: 'A', x: 100, y: 100, radio: 8 }] }]
        },
        {
          numeroPagina: 2,
          templateId: 'omr-inline-exam-v1',
          duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 },
          preguntas: [{ numeroPregunta: 2, idPregunta: 'q2', opciones: [], imagen: { x: 503, y: 96, width: 20, height: 9 } }]
        }
      ]
    };

    expect(detectarColisionesDuplexOmr(mapa).some((item) => item.tipo === 'burbuja-con-tinta-reverso')).toBe(true);
  });

  it('rechaza texto del reverso detrás de un fiducial de página', () => {
    const marcas = {
      tipo: 'cuadrados' as const,
      size: 4,
      quietZone: 2,
      tl: { x: 10, y: 782 }, tr: { x: 602, y: 782 },
      bl: { x: 10, y: 10 }, br: { x: 602, y: 10 }
    };
    const mapa: MapaOmr = {
      margenMm: 8,
      templateVersion: 4,
      templateId: 'omr-inline-exam-v1',
      impresion: { modo: 'duplex', volteo: 'borde-largo', paginasPorHoja: 2, toleranciaRegistroMm: 0 },
      perfilLayout: {} as MapaOmr['perfilLayout'],
      perfil: { burbujaRadio: 8 } as MapaOmr['perfil'],
      paginas: [
        { numeroPagina: 1, templateId: 'omr-inline-exam-v1', duplex: { hoja: 1, lado: 'frente', indiceEnHoja: 1 }, marcasPagina: marcas, preguntas: [] },
        {
          numeroPagina: 2,
          templateId: 'omr-inline-exam-v1',
          duplex: { hoja: 1, lado: 'reverso', indiceEnHoja: 2 },
          marcasPagina: marcas,
          preguntas: [{ numeroPregunta: 2, idPregunta: 'q2', opciones: [], textRuns: [
            { tipo: 'texto', fuente: 'sans', size: 8, lineHeight: 10, bbox: { x: 590, y: 780, width: 10, height: 3 } }
          ] }]
        }
      ]
    };

    expect(detectarColisionesDuplexOmr(mapa).some((item) => item.tipo === 'fiducial-con-tinta-reverso')).toBe(true);
  });

  it('ubica GRAPA dentro de una reserva punteada, Ecofont y geometría libre de señales OMR', async () => {
    vi.stubEnv('EXAMEN_LAYOUT_USAR_RELLENOS_DECORATIVOS', '');
    vi.stubEnv('EXAMEN_OMR_TOLERANCIA_REGISTRO_DUPLEX_MM', '');
    const preguntas = Array.from({ length: 25 }, (_, indice) => ({
      id: `p${indice + 1}`,
      enunciado: '¿Qué función cumple next() en un middleware?',
      opciones: [
        { texto: 'A', esCorrecta: false },
        { texto: 'B', esCorrecta: true },
        { texto: 'C', esCorrecta: false },
        { texto: 'D', esCorrecta: false },
        { texto: 'E', esCorrecta: false }
      ]
    }));
    const idsPreguntas = preguntas.map(({ id }) => id);
    const resultado = await generarPdfExamen({
      titulo: 'Control de plantilla',
      folio: 'OMR-STAPLE-001',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas,
      mapaVariante: {
        ordenPreguntas: idsPreguntas,
        ordenOpcionesPorPregunta: Object.fromEntries(idsPreguntas.map((id) => [id, [0, 1, 2, 3, 4]]))
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 8,
      templateVersion: 4,
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        materia: 'Control de plantilla',
        mostrarMarcaInstitucional: true
      }
    });

    const pagina = resultado.mapaOmr.paginas[0]!;
    expect(resultado.mapaOmr.paginas.length).toBeGreaterThanOrEqual(2);
    expect(resultado.mapaOmr.impresion).toMatchObject({
      modo: 'duplex', volteo: 'borde-largo', paginasPorHoja: 2, toleranciaRegistroMm: 3
    });
    const zona = pagina.layoutDebug?.bindingZone;
    const etiquetaZona = pagina.layoutDebug?.bindingLabel;
    const slots = pagina.layoutDebug?.headerSlots ?? [];
    const logo = slots.find((slot) => slot.id === 'logo-izquierdo');
    expect(resultado.mapaOmr.perfilLayout.usarRellenosDecorativos).toBe(false);
    expect(zona).toBeDefined();
    expect(etiquetaZona).toBeDefined();
    expect(etiquetaZona!.x).toBeGreaterThanOrEqual(zona!.x);
    expect(etiquetaZona!.y).toBeGreaterThanOrEqual(zona!.y);
    expect(etiquetaZona!.x + etiquetaZona!.width).toBeLessThanOrEqual(zona!.x + zona!.width);
    expect(etiquetaZona!.y + etiquetaZona!.height).toBeLessThanOrEqual(zona!.y + zona!.height);
    expect(etiquetaZona!.height).toBeGreaterThan(etiquetaZona!.width);
    expect(etiquetaZona!.rotation).toBe(270);
    expect(zona!.x).toBeGreaterThanOrEqual((4.5 * 72) / 25.4);
    expect(logo).toBeDefined();
    expect(zona!.x + zona!.width).toBeLessThanOrEqual(logo!.x);
    expect(zona!.width).toBeGreaterThanOrEqual((8 * 72) / 25.4);
    expect(zona!.height).toBeGreaterThanOrEqual((20 * 72) / 25.4);
    const zonaFisicaFrente = pagina.layoutDebug?.bindingKeepOutZone;
    const despejeGrapa = (3 * 72) / 25.4;
    expect(zonaFisicaFrente).toEqual(zona);
    expect(pagina.layoutDebug?.qr).toBeDefined();
    const fiducial = pagina.marcasPagina?.tl;
    expect(fiducial).toBeDefined();
    const quiet = Number(pagina.marcasPagina?.quietZone ?? 0);
    const size = Number(pagina.marcasPagina?.size ?? 0);
    expect(zona!.y + zona!.height).toBeLessThanOrEqual(fiducial!.y - size - quiet - (2 * 72) / 25.4);
    expect(zona!.x + zona!.width).toBeLessThanOrEqual(Number(pagina.layoutDebug?.qr?.x ?? 0));
    const interseca = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    const cajasNoGrapables = [
      ...(pagina.layoutDebug?.headerTextBlocks ?? []),
      ...(pagina.layoutDebug?.headerIconBoxes ?? []),
      ...(pagina.layoutDebug?.headerFieldBoxes ?? []),
      ...(pagina.layoutDebug?.headerSlots ?? []),
      ...(pagina.layoutDebug?.questionBlockBoxes ?? []),
      ...(pagina.layoutDebug?.questionPromptBoxes ?? []),
      ...(pagina.layoutDebug?.omrPanelBoxes ?? [])
    ];
    expect(cajasNoGrapables.every((caja) => !interseca(zona!, caja))).toBe(true);
    expect(pagina.preguntas[0]?.textRuns?.length).toBeGreaterThan(0);
    expect(pagina.preguntas[0]?.textRuns?.every((run) => run.fuente === 'Ecofont Vera Sans')).toBe(true);

    for (const [indicePagina, paginaDuplex] of resultado.mapaOmr.paginas.entries()) {
      const zonaReserva = paginaDuplex.layoutDebug?.bindingKeepOutZone;
      expect(zonaReserva).toBeDefined();
      const expandida = indicePagina > 0;
      expect(zonaReserva!.width).toBeCloseTo(zona!.width + (expandida ? despejeGrapa * 2 : 0), 5);
      expect(zonaReserva!.height).toBeCloseTo(zona!.height + (expandida ? despejeGrapa * 2 : 0), 5);
      if (expandida) expect(zonaReserva!.y).toBeCloseTo(zona!.y - despejeGrapa, 5);
      const esReverso = paginaDuplex.duplex?.lado === 'reverso';
      expect(zonaReserva!.x).toBeCloseTo(
        (esReverso ? 612 - zona!.x - zona!.width : zona!.x) - (expandida ? despejeGrapa : 0),
        5
      );
      const reservaQr = paginaDuplex.layoutDebug?.qr;
      expect(reservaQr).toBeDefined();
      const despejeQrGrapa = (12.5 * 72) / 25.4;
      const distanciaQrGrapa = esReverso
        ? zonaReserva!.x - (reservaQr!.x + reservaQr!.width)
        : reservaQr!.x - (zonaReserva!.x + zonaReserva!.width);
      expect(distanciaQrGrapa).toBeGreaterThanOrEqual(despejeQrGrapa);
      if (expandida) {
        const contenidoCritico = [
          paginaDuplex.layoutDebug?.qr,
          ...(paginaDuplex.layoutDebug?.questionPromptBoxes ?? []),
          ...(paginaDuplex.layoutDebug?.continuationTextBlocks ?? []),
          ...(paginaDuplex.layoutDebug?.omrPanelBoxes ?? [])
        ].filter((caja): caja is NonNullable<typeof caja> => Boolean(caja));
        expect(contenidoCritico.every((caja) => !interseca(zonaReserva!, caja))).toBe(true);
      }
      for (const pregunta of paginaDuplex.preguntas) {
        for (const opcion of pregunta.opciones) {
          const puntoX = Math.max(zonaReserva!.x, Math.min(opcion.x, zonaReserva!.x + zonaReserva!.width));
          const puntoY = Math.max(zonaReserva!.y, Math.min(opcion.y, zonaReserva!.y + zonaReserva!.height));
          expect(Math.hypot(opcion.x - puntoX, opcion.y - puntoY)).toBeGreaterThanOrEqual(
            resultado.mapaOmr.perfil.burbujaRadio
          );
        }
      }
    }

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      expect((await parser.getText()).text).toContain('GRAPA');
      const capturas = await parser.getScreenshot({
        partial: [1, 2],
        desiredWidth: 1530,
        imageBuffer: true,
        imageDataUrl: false
      });
      const captura = capturas.pages[0]!;
      if (process.env.OMR_QA_WRITE_CONTROL_ARTIFACTS === '1') {
        const directorio = path.resolve(
          process.env.OMR_QA_OUTPUT_DIR ?? path.resolve(process.cwd(), '../../output/qa/qa_omr_plantilla_20260925')
        );
        await mkdir(directorio, { recursive: true });
        await writeFile(path.join(directorio, 'control_omr_grapa_punteada.png'), captura.data);
        await writeFile(path.join(directorio, 'control_omr_grapa_reverso.png'), capturas.pages[1]!.data);
      }
      const roiGrapa = await sharp(captura.data)
        .extract({
          left: Math.floor(zona!.x * captura.width / 612),
          top: Math.floor((792 - (zona!.y + zona!.height)) * captura.width / 612),
          width: Math.ceil(zona!.width * captura.width / 612),
          height: Math.ceil(zona!.height * captura.width / 612)
        })
        .greyscale()
        .raw()
        .toBuffer();
      const pixelesTintaGrapa = [...roiGrapa].filter((pixel) => pixel < 190).length;
      const pixelesFondoPunteado = [...roiGrapa].filter((pixel) => pixel >= 190 && pixel < 254).length;
      expect(pixelesTintaGrapa).toBeGreaterThan(15);
      expect(pixelesTintaGrapa).toBeLessThan(roiGrapa.length * 0.1);
      expect(pixelesFondoPunteado).toBeGreaterThan(20);
      const reservaReverso = resultado.mapaOmr.paginas[1]!.layoutDebug!.bindingKeepOutZone!;
      const roiReverso = await sharp(capturas.pages[1]!.data)
        .extract({
          left: Math.floor(reservaReverso.x * capturas.pages[1]!.width / 612),
          top: Math.floor((792 - (reservaReverso.y + reservaReverso.height)) * capturas.pages[1]!.width / 612),
          width: Math.ceil(reservaReverso.width * capturas.pages[1]!.width / 612),
          height: Math.ceil(reservaReverso.height * capturas.pages[1]!.width / 612)
        })
        .removeAlpha()
        .raw()
        .toBuffer();
      const pixelesTintaReverso = [...roiReverso].filter((pixel) => pixel < 250).length;
      expect(pixelesTintaReverso).toBeLessThan(roiReverso.length * 0.01);
      const pixelExterior = await sharp(captura.data)
        .extract({ left: 4, top: 396, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer();
      expect([...pixelExterior]).toEqual([255, 255, 255]);
    } finally {
      await parser.destroy();
    }
  });
});
