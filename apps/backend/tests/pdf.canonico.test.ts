/**
 * pdf.canonico.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen.js';
import { resolverNivelCorreccionQr } from '../src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.js';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { ANCHO_CARTA, ALTO_CARTA, MM_A_PUNTOS } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';
import { obtenerTransformacion } from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.js';
import { leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import { construirEncabezadoPdf } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';
import { cajaQrDesdeManifiesto, detectarQrRgba } from '../scripts/omr-qr-preprint-check.js';

describe('pdf OMR canónico', () => {
  it('requiere el nombre del docente autenticado al preparar una cabecera de aplicación', () => {
    expect(construirEncabezadoPdf({
      periodo: { nombre: 'Control sintético' },
      docenteDb: { nombreCompleto: 'Docente de control' },
      instrucciones: 'Control OMR',
      incluirPrefijosDocente: true
    }).docente).toBe('I.S.C. Docente de control');

    expect(() => construirEncabezadoPdf({
      periodo: { nombre: 'Control sintético' },
      docenteDb: { nombreCompleto: '   ' },
      instrucciones: 'Control OMR'
    })).toThrow('No se puede generar el PDF sin el nombre del docente autenticado.');
  });

  it('genera el contrato OMR canónico enriquecido', async () => {
    const resultado = await generarPdfExamen({
      titulo: 'OMR canónico',
      folio: 'OMR-CANON-001',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
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

    expect(resultado.mapaOmr.templateVersion).toBe(4);
    expect(resultado.mapaOmr.paginas[0]?.preguntas[0]?.opciones?.length ?? 0).toBe(5);
    const qrResumen = extraerResumenQrExamen(String(resultado.paginas[0]?.qrTexto ?? ''));
    expect(qrResumen?.templateVersion).toBe(4);
    expect(qrResumen?.qrPayloadMode).toBe('manifest-bound');
    expect(qrResumen?.variantHash).toBeUndefined();
    expect(qrResumen?.answerKeyHash).toBeUndefined();
    expect(qrResumen?.pageAnswerKey).toBeUndefined();
    expect(qrResumen?.examId).toBeUndefined();
    expect(resultado.mapaOmr.paginas[0]?.qr?.errorCorrectionLevel).toBe('H');
    expect(QRCode.create(String(resultado.paginas[0]?.qrTexto ?? ''), { errorCorrectionLevel: 'H' }).modules.size).toBeLessThanOrEqual(49);
    const qrGeometria = resultado.mapaOmr.paginas[0]?.qr;
    expect(qrGeometria?.size).toBeCloseTo((32 * 72) / 25.4, 4);
    expect(qrGeometria?.matrixModules).toBeGreaterThan(0);
    expect(
      (qrGeometria!.size * 25.4 / 72) / (qrGeometria!.matrixModules! + 2 * qrGeometria!.marginModules!)
    ).toBeGreaterThanOrEqual(0.56);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({
        partial: [1],
        desiredWidth: 2550,
        imageBuffer: true,
        imageDataUrl: false
      });
      const captura = capturas.pages[0];
      expect(captura).toBeTruthy();

      const escala = captura!.width / 612;
      const marcasPagina = resultado.mapaOmr.paginas[0]?.marcasPagina;
      expect(marcasPagina?.orientacion).toMatchObject({ esquina: 'tl', tipo: 'centro_vacio' });
      const fiducial = await sharp(captura!.data).greyscale().raw().toBuffer({ resolveWithObject: true });
      const leerPixel = (x: number, y: number) => fiducial.data[y * fiducial.info.width + x]!;
      const centroFiducial = (esquina: 'tl' | 'tr' | 'bl' | 'br') => {
        const referencia = marcasPagina![esquina];
        const xPuntos = referencia.x + (esquina.endsWith('l') ? 1 : -1) * marcasPagina!.size / 2;
        const yPuntos = referencia.y + (esquina.startsWith('t') ? -1 : 1) * marcasPagina!.size / 2;
        return leerPixel(Math.round(xPuntos * escala), Math.round((792 - yPuntos) * escala));
      };
      expect(centroFiducial('tl')).toBeGreaterThan(220);
      expect(centroFiducial('tr')).toBeLessThan(80);
      expect(centroFiducial('bl')).toBeLessThan(80);
      expect(centroFiducial('br')).toBeLessThan(80);
      expect(leerPixel(
        Math.round((marcasPagina!.tl.x + marcasPagina!.size / 2 + (marcasPagina!.orientacion!.radio + 2)) * escala),
        Math.round((792 - marcasPagina!.tl.y + marcasPagina!.size / 2) * escala)
      )).toBeLessThan(80);
      const grises = await sharp(captura!.data).greyscale().raw().toBuffer({ resolveWithObject: true });
      const orientacionSinQr = obtenerTransformacion(
        Uint8ClampedArray.from(grises.data),
        grises.info.width,
        grises.info.height,
        [],
        null,
        {
          margenMm: 10,
          qrSizePts: qrGeometria!.size,
          anchoCarta: ANCHO_CARTA,
          altoCarta: ALTO_CARTA,
          mmAPuntos: MM_A_PUNTOS,
          marcasPagina: {
            tipo: marcasPagina!.tipo,
            size: marcasPagina!.size,
            orientacion: marcasPagina!.orientacion
          }
        }
      );
      expect(orientacionSinQr.referenciaPagina.orientacionDeterminada, JSON.stringify(orientacionSinQr.referenciaPagina)).toBe(true);
      expect(orientacionSinQr.referenciaPagina.fuenteOrientacion).toBe('fiducial_direccional');
      expect(orientacionSinQr.referenciaPagina.orientacionGrados).toBe(0);

      const cajaQr = cajaQrDesdeManifiesto({ mapaOmr: resultado.mapaOmr }, 1, 792);
      expect(cajaQr).toBeTruthy();
      const margen = 12;
      const left = Math.max(0, Math.round((cajaQr!.x - margen) * escala));
      const top = Math.max(0, Math.round((cajaQr!.yTop - margen) * escala));
      const lado = Math.round((cajaQr!.size + margen * 2) * escala);
      const rasterQr = await sharp(captura!.data)
        .extract({ left, top, width: lado, height: lado })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      expect(detectarQrRgba(rasterQr.data, rasterQr.info.width, rasterQr.info.height))
        .toBe(resultado.paginas[0]?.qrTexto);
    } finally {
      await parser.destroy();
    }
  });

  it('reduce la redundancia solo para payloads que exceden la densidad fotografica', () => {
    expect(resolverNivelCorreccionQr('X'.repeat(100))).toBe('H');
    const payloadFotograficoReal =
      'EXAMEN:E2FAFF07:P1:TV4:ID:9C473B4C-9505-4855-9093-9BD9D35B:KI:QR-H1-V1:TQ:25:' +
      'VH:E9AB6751B0E7:AK:4DBF14A75DB5:K:CBCCACAADDCB:SG:H1DBC7ED23359CEFF54780275C';
    expect(payloadFotograficoReal.length).toBe(153);
    expect(resolverNivelCorreccionQr(payloadFotograficoReal)).toBe('Q');
    expect(QRCode.create(payloadFotograficoReal, { errorCorrectionLevel: 'Q' }).modules.size).toBe(49);
  });

  it('conserva la reticula 3+2 cuando las cinco opciones no caben en una linea', async () => {
    const id = 'q-largas';
    const descripcion = 'alternativa con descripcion suficientemente larga para ocupar varias lineas';
    const preguntas = [{
      id,
      enunciado: 'Reactivo de control con cinco opciones descriptivas',
      opciones: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
        texto: letra + ': ' + descripcion,
        esCorrecta: letra === 'C'
      }))
    }];
    const resultado = await generarPdfExamen({
      titulo: 'OMR control fallback',
      folio: 'OMR-DENSITY-FALLBACK',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas,
      mapaVariante: {
        ordenPreguntas: [id],
        ordenOpcionesPorPregunta: { [id]: [0, 1, 2, 3, 4] }
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 10,
      templateVersion: 4
    });

    const reactivo = resultado.mapaOmr.paginas[0]?.preguntas[0];
    const renglonesOpciones = new Set(
      (reactivo?.textRuns ?? [])
        .filter((run) => run.size <= 9)
        .map((run) => Number(run.bbox.y.toFixed(2)))
    );
    expect(resultado.paginas).toHaveLength(1);
    expect(renglonesOpciones.size).toBeGreaterThan(1);
    expect((resultado.mapaOmr.paginas[0]?.layoutDebug?.collisionBoxes ?? [])).toEqual([]);
  });

  it('imprime el nombre del docente como metadato y no crea un campo manuscrito', async () => {
    const id = 'q-docente';
    const resultado = await generarPdfExamen({
      titulo: 'Control campo docente',
      folio: 'OMR-DOCENTE-001',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas: [{
        id,
        enunciado: 'Reactivo sintético para validar la cabecera.',
        opciones: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ texto: `Opción ${letra}`, esCorrecta: letra === 'C' }))
      }],
      mapaVariante: { ordenPreguntas: [id], ordenOpcionesPorPregunta: { [id]: [0, 1, 2, 3, 4] } },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 8,
      templateVersion: 4,
      encabezado: {
        docente: 'Docente de control',
        alumno: { nombre: 'Alumno Control Sintetico', grupo: 'QA', iniciales: 'ACS' }
      }
    });

    const pagina = resultado.mapaOmr.paginas[0]!;
    const textoDocente = pagina.layoutDebug?.headerTextBlocks?.find((bloque) => bloque.id === 'meta-docente');
    const lineaDocente = pagina.layoutDebug?.headerFieldBoxes?.find((campo) => campo.id === 'docente-linea');
    expect(textoDocente).toBeDefined();
    expect(lineaDocente).toBeUndefined();
    expect(pagina.layoutDebug?.collisionBoxes ?? []).toEqual([]);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const texto = await parser.getText();
      expect(texto.text).toContain('Docente: Docente de control');
    } finally {
      await parser.destroy();
    }
  });

  it('imprime el primer nombre seguido por las iniciales restantes sin etiqueta', async () => {
    const id = 'q-identidad-alumno';
    const encabezado = construirEncabezadoPdf({
      periodo: { nombre: 'Inteligencia de Negocios' },
      docenteDb: { nombreCompleto: 'Docente de control' },
      instrucciones: '',
      alumno: { nombreCompleto: 'TELLEZ VITE PABLO', grupo: '23A' }
    });
    expect(encabezado.alumno).toMatchObject({ primerNombre: 'Pablo', iniciales: 'PTV' });
    const resultado = await generarPdfExamen({
      titulo: 'Control identidad de alumno',
      folio: 'OMR-ALUMNO-001',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas: [{
        id,
        enunciado: 'Reactivo sintético para validar la identidad impresa.',
        opciones: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ texto: `Opción ${letra}`, esCorrecta: letra === 'C' }))
      }],
      mapaVariante: { ordenPreguntas: [id], ordenOpcionesPorPregunta: { [id]: [0, 1, 2, 3, 4] } },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 8,
      templateVersion: 4,
      encabezado
    });

    const pagina = resultado.mapaOmr.paginas[0]!;
    const identidad = pagina.layoutDebug?.headerTextBlocks?.find((bloque) => bloque.id === 'alumno-identidad');
    const lineaNombre = pagina.layoutDebug?.headerFieldBoxes?.find((bloque) => bloque.id === 'nombre-linea');
    expect(identidad).toBeDefined();
    expect(lineaNombre).toBeDefined();
    expect(identidad!.y).toBeGreaterThan(lineaNombre!.y + lineaNombre!.height);
    const etiquetaNombre = pagina.layoutDebug?.headerTextBlocks?.find((bloque) => bloque.id === 'nombre-etiqueta');
    expect(etiquetaNombre).toBeDefined();
    expect(identidad!.height).toBeLessThan(etiquetaNombre!.height);

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const texto = (await parser.getText()).text.replace(/\s+/g, ' ');
      expect(texto).toContain('Pablo_TV');
      expect(texto).not.toContain('Iniciales:');
    } finally {
      await parser.destroy();
    }
  });

  it('usa un payload compacto H para una pagina real de 25 reactivos', async () => {
    const rutaReactivosBanco = process.env.OMR_QA_BANK_SAMPLE_JSON;
    const preguntasBanco = rutaReactivosBanco
      ? JSON.parse(await readFile(path.resolve(rutaReactivosBanco), 'utf8')) as Array<{
          id: string;
          enunciado: string;
          opciones: Array<{ texto: string; esCorrecta: boolean }>;
        }>
      : undefined;
    const preguntas = preguntasBanco ?? Array.from({ length: 25 }, (_, indice) => {
      const id = `q${indice + 1}`;
      return {
        id,
        enunciado: `Reactivo ${indice + 1}`,
        opciones: [0, 1, 2, 3, 4].map((opcion) => ({
          texto: String.fromCharCode(65 + opcion),
          esCorrecta: opcion === indice % 5
        }))
      };
    });
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const ordenOpcionesPorPregunta = Object.fromEntries(
      ordenPreguntas.map((id) => [id, [0, 1, 2, 3, 4]])
    );

    const resultado = await generarPdfExamen({
      titulo: 'OMR QR compacto',
      folio: 'OMR-COMPACT-025',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas,
      mapaVariante: { ordenPreguntas, ordenOpcionesPorPregunta },
      tipoExamen: 'parcial',
      totalPaginas: 2,
      margenMm: 8,
      templateVersion: 4,
      encabezado: {
        materia: 'Control técnico OMR',
        docente: 'Docente de control',
        alumno: { nombre: 'Alumno Control Sintetico', grupo: 'QA', iniciales: 'ACS' }
      }
    });

    if (!preguntasBanco) expect(resultado.paginas.length).toBe(2);
    expect(resultado.mapaOmr.paginas.reduce((total, pagina) => total + pagina.preguntas.length, 0)).toBe(25);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.margenMm).toBe(8);
    expect(resultado.mapaOmr.paginas[0]?.layoutDebug?.bindingZone).toBeDefined();
    const alturaReticula = resultado.mapaOmr.perfilLayout.gridStepPt;
    for (const [indice, pagina] of resultado.mapaOmr.paginas.entries()) {
      const alturas = pagina.layoutDebug?.plannedQuestionHeights ?? [];
      expect(alturas).toHaveLength(pagina.preguntas.length);
      expect(pagina.layoutDebug?.lineHeightViolations ?? []).toEqual([]);
      expect(pagina.layoutDebug?.collisionBoxes ?? []).toEqual([]);
      for (const [indicePregunta, altura] of alturas.entries()) {
        expect(altura.questionId).toBe(pagina.preguntas[indicePregunta]?.idPregunta);
        expect(altura.renderedHeightPt).toBeLessThanOrEqual(altura.plannedHeightPt + alturaReticula + 0.05);
        expect(pagina.preguntas[indicePregunta]?.bboxPregunta?.y ?? 0).toBeGreaterThanOrEqual(
          (8 * 72) / 25.4 + resultado.mapaOmr.perfilLayout.bottomSafePt - 0.01
        );
      }
      if (indice === 0) {
        expect(pagina.layoutDebug?.headerTextBlocks?.some((bloque) => bloque.id === 'meta-docente')).toBe(true);
        expect(pagina.layoutDebug?.headerTextBlocks?.some((bloque) => bloque.id === 'alumno-identidad')).toBe(true);
        expect(pagina.layoutDebug?.headerFieldBoxes?.some((campo) => campo.id === 'docente-linea')).toBe(false);
      }
    }
    const preguntaCompacta = resultado.mapaOmr.paginas[0]?.preguntas[0];
    const renglonesOpcionesCompactas = new Set(
      (preguntaCompacta?.textRuns ?? [])
        .filter((run) => run.size <= 9)
        .map((run) => Number(run.bbox.y.toFixed(2)))
    );
    if (!preguntasBanco) expect(renglonesOpcionesCompactas.size).toBe(1);
    else expect(renglonesOpcionesCompactas.size).toBeGreaterThan(0);
    expect(preguntaCompacta?.perfilOmr?.radio).toBeGreaterThan(0);
    expect(preguntaCompacta?.perfilOmr?.pasoX).toBeGreaterThan(0);

    for (const [indice, pagina] of resultado.paginas.entries()) {
      const qr = String(pagina.qrTexto ?? '');
      const resumen = extraerResumenQrExamen(qr);
      expect(qr).toContain(':S:');
      expect(qr).not.toContain(':KI:');
      expect(qr).not.toContain(':AK:');
      expect(qr).not.toContain(':VH:');
      expect(resumen?.payloadSignatureValid).toBe(true);
      expect(resumen?.qrPayloadMode).toBe('manifest-bound');
      expect(resumen?.variantHash).toBeUndefined();
      expect(resumen?.answerKeyHash).toBeUndefined();
      expect(resumen?.pageAnswerKey).toBeUndefined();
      expect(resumen?.numeroPagina).toBe(indice + 1);
      expect(resolverNivelCorreccionQr(qr)).toBe('H');
      const matrixModules = QRCode.create(qr, { errorCorrectionLevel: 'H' }).modules.size;
      const qrFisico = resultado.mapaOmr.paginas[indice]?.qr;
      expect(matrixModules).toBeLessThanOrEqual(49);
      expect(qrFisico?.errorCorrectionLevel).toBe('H');
      expect(qrFisico?.matrixModules).toBe(matrixModules);
      expect(qrFisico?.size).toBeCloseTo((32 * 72) / 25.4, 4);
      expect(
        (qrFisico!.size * 25.4 / 72) / (matrixModules + 2 * qrFisico!.marginModules!)
      ).toBeGreaterThanOrEqual(0.56);
    }

    const parser = new PDFParse({ data: resultado.pdfBytes });
    try {
      const capturas = await parser.getScreenshot({
        partial: Array.from({ length: resultado.paginas.length }, (_valor, indice) => indice + 1),
        desiredWidth: preguntasBanco ? 1530 : 2550,
        imageBuffer: true,
        imageDataUrl: false
      });
      expect(capturas.pages).toHaveLength(resultado.paginas.length);
      for (const [indice, captura] of capturas.pages.entries()) {
        const jpegMovil = await sharp(captura.data)
          .resize({ width: 1600, withoutEnlargement: true })
          .blur(0.3)
          .jpeg({ quality: 72, chromaSubsampling: '4:2:0' })
          .toBuffer();
        const qrDetectado = await leerQrDesdeImagen(`data:image/jpeg;base64,${jpegMovil.toString('base64')}`);
        expect(qrDetectado).toBe(resultado.paginas[indice]?.qrTexto);
      }
      const textoPdf = await parser.getText();
      expect(textoPdf.text).toContain('Materia: Control técnico OMR');
      expect(textoPdf.text).toContain('Docente: Docente de control');
      expect(textoPdf.text).toContain('Alumno_CS');
      expect(textoPdf.text).not.toContain('Iniciales:');
      if (process.env.OMR_QA_WRITE_CONTROL_ARTIFACTS === '1') {
        const directorio = path.resolve(process.cwd(), '../../output/qa/qa_omr_plantilla_20260925');
        const nombreControl = preguntasBanco ? 'control_omr_banco_actual_25' : 'control_omr_densidad_adaptativa_25';
        await mkdir(directorio, { recursive: true });
        await writeFile(path.join(directorio, `${nombreControl}.pdf`), resultado.pdfBytes);
        await writeFile(
          path.join(directorio, `${nombreControl}.mapa.json`),
          JSON.stringify(resultado.mapaOmr, null, 2)
        );
        for (const [indice, captura] of capturas.pages.entries()) {
          await writeFile(
            path.join(directorio, `${nombreControl}_page${indice + 1}.png`),
            captura!.data
          );
        }
      }

      for (const [indice, captura] of capturas.pages.entries()) {
        const escala = captura!.width / 612;
        const cajaQr = cajaQrDesdeManifiesto({ mapaOmr: resultado.mapaOmr }, indice + 1, 792);
        expect(cajaQr).toBeTruthy();
        const margen = 12;
        const left = Math.max(0, Math.round((cajaQr!.x - margen) * escala));
        const top = Math.max(0, Math.round((cajaQr!.yTop - margen) * escala));
        const lado = Math.round((cajaQr!.size + margen * 2) * escala);
        const rasterQr = await sharp(captura!.data)
          .extract({ left, top, width: lado, height: lado })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        expect(detectarQrRgba(rasterQr.data, rasterQr.info.width, rasterQr.info.height))
          .toBe(resultado.paginas[indice]?.qrTexto);
      }
    } finally {
      await parser.destroy();
    }
  });

  it('ajusta la separación vertical según caracteres del reactivo y sus respuestas', async () => {
    const preguntas = [
      {
        id: 'q-corto',
        enunciado: 'Corto',
        opciones: ['A', 'B', 'C', 'D', 'E'].map((texto, indice) => ({ texto, esCorrecta: indice === 0 }))
      },
      {
        id: 'q-medio',
        enunciado: 'M'.repeat(120),
        opciones: ['A', 'B', 'C', 'D', 'E'].map((texto, indice) => ({ texto: texto.repeat(15), esCorrecta: indice === 0 }))
      },
      {
        id: 'q-largo',
        enunciado: 'L'.repeat(280),
        opciones: ['A', 'B', 'C', 'D', 'E'].map((texto, indice) => ({ texto: texto.repeat(12), esCorrecta: indice === 0 }))
      }
    ];
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const resultado = await generarPdfExamen({
      titulo: 'Control de densidad tipográfica',
      folio: 'OMR-GAP-003',
      examId: '9AD3DD18-9353-46A4-B99F-16FC94FB',
      preguntas,
      mapaVariante: {
        ordenPreguntas,
        ordenOpcionesPorPregunta: Object.fromEntries(ordenPreguntas.map((id) => [id, [0, 1, 2, 3, 4]]))
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 8,
      templateVersion: 4
    });

    const planes = resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.plannedQuestionHeights ?? []);
    const porPregunta = new Map(planes.map((plan) => [plan.questionId, plan]));
    const corto = porPregunta.get('q-corto');
    const medio = porPregunta.get('q-medio');
    const largo = porPregunta.get('q-largo');
    expect(corto?.contentCharacters).toBeLessThan(medio?.contentCharacters ?? 0);
    expect(medio?.contentCharacters).toBeLessThan(largo?.contentCharacters ?? 0);
    expect(corto?.interQuestionGapPt).toBeCloseTo(2.2);
    expect(medio?.interQuestionGapPt).toBeCloseTo(3.3);
    expect(largo?.interQuestionGapPt).toBeCloseTo(4.4);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.collisionBoxes ?? [])).toEqual([]);
  });
});
