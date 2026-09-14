/**
 * pdf.paridad.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { rasterizarPdfParaPreview } from '../src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import { mapearPreguntasBase } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

function crearParametros(cantidadPreguntas = 12) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= cantidadPreguntas; i += 1) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta ${i}`,
      opciones: [
        { texto: 'A', esCorrecta: i % 5 === 1 },
        { texto: 'B', esCorrecta: i % 5 === 2 },
        { texto: 'C', esCorrecta: i % 5 === 3 },
        { texto: 'D', esCorrecta: i % 5 === 4 },
        { texto: 'E', esCorrecta: i % 5 === 0 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return {
    titulo: 'TV4 Contract',
    folio: 'TV4-TEST-001',
    preguntas,
    mapaVariante,
    tipoExamen: 'parcial' as const,
    totalPaginas: 2,
    margenMm: 10,
    templateVersion: 4 as const
  };
}

describe('pdf OMR canónico', () => {
  it('limpia prefijos del banco y mantiene todos los reactivos dentro de dos páginas', async () => {
    const etiquetas = ['HTTP', 'Express', 'API REST', 'JSON', 'MongoDB', 'Mongoose', 'CRUD', 'Node.js', 'Manejo de errores', 'Express', 'CORS', 'JSON', 'HTTP'];
    const preguntasBanco = etiquetas.map((etiqueta, indice) => ({
      id: `banco-${indice + 1}`,
      versionActual: 1,
      versiones: [{
        numeroVersion: 1,
        enunciado: `${indice + 16}. ${etiqueta}\n\nAnaliza el comportamiento descrito y selecciona la respuesta correcta.`,
        opciones: [
          { texto: 'Opción correcta', esCorrecta: true },
          { texto: 'Opción alternativa uno', esCorrecta: false },
          { texto: 'Opción alternativa dos', esCorrecta: false },
          { texto: 'Opción alternativa tres', esCorrecta: false },
          { texto: 'Opción alternativa cuatro', esCorrecta: false }
        ]
      }]
    }));
    const preguntas = mapearPreguntasBase(preguntasBanco);
    const resultado = await generarPdfExamen({
      ...crearParametros(1),
      preguntas,
      mapaVariante: {
        ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
        ordenOpcionesPorPregunta: Object.fromEntries(preguntas.map((pregunta) => [pregunta.id, [0, 1, 2, 3, 4]]))
      },
      totalPaginas: 2,
      bookletConfig: { densityMode: 'compact' }
    });

    expect(resultado.paginas.length).toBeLessThanOrEqual(2);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas)).toHaveLength(preguntas.length);

    const texto = (await new PDFParse({ data: new Uint8Array(resultado.pdfBytes) }).getText()).text;
    expect(texto).not.toMatch(/17\.\s*HTTP/);
    expect(texto).not.toMatch(/18\.\s*Express/);
    expect(texto).toContain('Analiza el comportamiento descrito');
  });

  it('genera PDF carta válido y mapa OMR canónico', async () => {
    const resultado = await generarPdfExamen(crearParametros(16));

    expect(resultado.pdfBytes.byteLength).toBeGreaterThan(10_000);
    expect(resultado.mapaOmr.templateVersion).toBe(4);
    expect(resultado.mapaOmr.markerSpec?.family).toBe('solid_square_4pt_v1');
    expect(resultado.mapaOmr.markerSpec?.sizeMm).toBeCloseTo(2, 2);
    expect(resultado.mapaOmr.paginas[0]?.markerSpec?.family).toBe('solid_square_4pt_v1');
    expect(resultado.mapaOmr.paginas[0]?.templateVersion).toBe(4);
    expect(resultado.mapaOmr.paginas[0]?.engineHints?.forceSimpleScale).toBe(false);
    expect(resultado.mapaOmr.paginas[0]?.engineHints?.useMapCoordinatesStrict).toBe(false);
    expect(resultado.mapaOmr.blockSpec?.opcionesPorPregunta).toBe(5);
    expect(resultado.mapaOmr.engineHints?.preferredEngine).toBe('cv');
    expect(resultado.mapaOmr.impresion).toEqual({
      modo: 'duplex',
      volteo: 'borde-largo',
      paginasPorHoja: 2
    });
    expect(Array.isArray(resultado.mapaOmr.paginas)).toBe(true);
    expect(resultado.mapaOmr.paginas.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(resultado.pdfBytes);
    const first = doc.getPage(0);
    const { width, height } = first.getSize();
    expect(width).toBeCloseTo(612, 0);
    expect(height).toBeCloseTo(792, 0);
  });

  it('mantiene consistencia de QR TV4 por página', async () => {
    const resultado = await generarPdfExamen(crearParametros(8));

    for (const pagina of resultado.paginas) {
      expect(pagina.qrTexto).toContain(':TV4');
    }
    for (const paginaOmr of resultado.mapaOmr.paginas) {
      expect(paginaOmr.qr?.texto).toContain(':TV4');
    }
  });

  it('declara frente y reverso por hoja sin insertar páginas vacías', async () => {
    const resultado = await generarPdfExamen({ ...crearParametros(30), totalPaginas: 3 });

    expect(resultado.mapaOmr.paginas.map((pagina) => pagina.duplex)).toEqual([
      { hoja: 1, lado: 'frente', indiceEnHoja: 1 },
      { hoja: 1, lado: 'reverso', indiceEnHoja: 2 },
      { hoja: 2, lado: 'frente', indiceEnHoja: 1 }
    ]);
    expect(resultado.paginas).toHaveLength(3);
    expect(resultado.mapaOmr.paginas).toHaveLength(3);
    expect(resultado.mapaOmr.paginas.every((pagina) => pagina.tipoPagina !== 'reverso-vacio')).toBe(true);
  });

  it('maximiza el primer par dúplex aunque se declare una meta mayor', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(25),
      totalPaginas: 4,
      bookletConfig: { densityMode: 'compact' }
    });

    expect(resultado.paginas).toHaveLength(2);
    expect(resultado.mapaOmr.paginas).toHaveLength(2);
    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.mapaOmr.paginas.flatMap((pagina) => pagina.preguntas)).toHaveLength(25);
    expect(resultado.mapaOmr.paginas.every((pagina) => pagina.tipoPagina === 'examen')).toBe(true);
    expect(resultado.mapaOmr.paginas.map((pagina) => pagina.duplex)).toEqual([
      { hoja: 1, lado: 'frente', indiceEnHoja: 1 },
      { hoja: 1, lado: 'reverso', indiceEnHoja: 2 }
    ]);
  });

  it('ajusta automáticamente el cuerpo sin modificar la escala de cabecera', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(25),
      totalPaginas: 2,
      bookletConfig: {
        densityMode: 'compact',
        autoFitPages: true,
        fontScale: 1.1,
        lineSpacing: 1.1
      }
    });

    expect(resultado.preguntasRestantes).toBe(0);
    expect(resultado.paginas.length).toBeLessThanOrEqual(2);
    expect(resultado.metricasLayout?.fontSizePregunta).toBeCloseTo(10.4 * 1.1, 4);
    expect(resultado.metricasLayout?.fontSizeIndicaciones).toBeCloseTo(8, 4);
  });

  it('mantiene la cabecera fija cuando se compacta manualmente el cuerpo', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(2),
      bookletConfig: {
        densityMode: 'compact',
        fontScale: 0.9,
        lineSpacing: 1
      }
    });

    expect(resultado.metricasLayout?.fontSizePregunta).toBeCloseTo(10.4 * 0.9, 4);
    expect(resultado.metricasLayout?.fontSizeIndicaciones).toBeCloseTo(8, 4);
  });

  it('omite logos no disponibles sin dibujar sustitutos dentro de la cabecera', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(4),
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'Sapientia est nostra fortis',
        mostrarMarcaInstitucional: true,
        logos: {
          izquierdaPath: 'C:/ruta-inexistente/logo-izquierdo.png',
          derechaPath: 'C:/ruta-inexistente/logo-derecho.png'
        }
      }
    });

    expect(resultado.metricasLayout?.logosOmitidos).toEqual(['izquierdo', 'derecho']);
    const texto = await new PDFParse({ data: new Uint8Array(resultado.pdfBytes) }).getText();
    expect(texto.text).not.toContain('INST.');
    expect(texto.text).not.toContain('PROG.');
  });

  it('protege la cabecera institucional por defecto y mantiene limpio el ROI OMR', async () => {
    const resultado = await generarPdfExamen({
      ...crearParametros(4),
      encabezado: {
        institucion: 'Centro Universitario Hidalguense',
        lema: 'Sapientia est nostra fortis',
        materia: 'Diseño y Desarrollo de Aplicaciones Web',
        docente: 'Erick Renato Vega Cerón'
      }
    });

    const texto = await new PDFParse({ data: new Uint8Array(resultado.pdfBytes) }).getText();
    expect(texto.text).toContain('Centro Universitario Hidalguense');
    expect(texto.text).toContain('Sapientia est nostra fortis');
    expect(texto.text).toContain('Materia: Diseño y Desarrollo de Aplicaciones Web');
    expect(texto.text).toContain('Docente: Erick Renato Vega Cerón');
    expect(texto.text).toContain('Reactivos:');
    // La cabecera puede usar la zona compacta bajo el QR, donde el total se
    // muestra como "/ 4" junto a la etiqueta Reactivos; el respaldo lateral
    // conserva la forma histórica "/ 4 reactivos".
    expect(texto.text).toMatch(/\/ 4(?:\s+reactivos)?/);
    expect(texto.text).toContain('Calificación (0-5):');
    expect(texto.text).toContain('Lea detenidamente cada reactivo');
    expect(texto.text).toContain('Correcta');
    expect(texto.text).toContain('Incorrecta');
    expect(texto.text).not.toContain('Examen =');
    expect(texto.text).not.toContain('(conteo/total)');
    expect(texto.text).not.toContain('Puntos extra');
    expect(texto.text).not.toContain('RESP.');
    expect(resultado.mapaOmr.paginas[0]?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });

  it('persiste la geometría OMR ampliada y separada para impresión carta a color', async () => {
    const resultado = await generarPdfExamen(crearParametros(1));
    expect(resultado.mapaOmr.blockSpec).toMatchObject({
      opcionesPorPregunta: 5,
      orientation: 'horizontal',
      bubbleDiameterMm: 6,
      bubblePitchXmm: 8.82
    });
    expect(resultado.mapaOmr.perfil).toMatchObject({
      burbujaPasoX: 25,
      cajaOmrAncho: 137,
      orientacion: 'horizontal'
    });
    expect(resultado.mapaOmr.perfilLayout?.usarEtiquetaOmrSolida).toBe(false);
  });

  it('usa solo la insignia lateral como numeracion del reactivo', async () => {
    const parametros = crearParametros(2);
    parametros.preguntas[0]!.enunciado = '<strong>Reactivo 1.</strong> ¿Qué conserva la evidencia?';
    parametros.preguntas[1]!.enunciado = 'Reactivo 2: ¿Qué valida el criterio?';

    const resultado = await generarPdfExamen(parametros);
    const texto = await new PDFParse({ data: new Uint8Array(resultado.pdfBytes) }).getText();

    expect(texto.text).toContain('¿Qué conserva la evidencia?');
    expect(texto.text).toContain('¿Qué valida el criterio?');
    expect(texto.text).not.toContain('Reactivo 1');
    expect(texto.text).not.toContain('Reactivo 2');
    expect(resultado.mapaOmr.paginas[0]?.preguntas.map((pregunta) => pregunta.numeroPregunta)).toEqual([1, 2]);
    expect(resultado.mapaOmr.paginas[0]?.layoutDebug?.collisionBoxes ?? []).toHaveLength(0);
  });

  it('conserva marcas y QR distinguibles al rasterizar a 150 y 300 DPI', async () => {
    const resultado = await generarPdfExamen(crearParametros(16));
    const paginasMapa = resultado.mapaOmr.paginas;
    const escalaPtPorMm = 72 / 25.4;

    for (const dpi of [150, 300]) {
      const raster = await rasterizarPdfParaPreview(resultado.pdfBytes, { dpi });
      expect(raster.paginasTotales).toBe(paginasMapa.length);
      expect(raster.paginas).toHaveLength(paginasMapa.length);

      for (const [indice, paginaRaster] of raster.paginas.entries()) {
        expect(paginaRaster.width).toBe(Math.round((612 * dpi) / 72));
        expect(paginaRaster.height).toBe(Math.round((792 * dpi) / 72));

        const imagen = Buffer.from(paginaRaster.dataUrl.split(',', 2)[1] ?? '', 'base64');
        const escala = dpi / 72;
        const pixeles = await sharp(imagen).greyscale().raw().toBuffer({ resolveWithObject: true });
        const contarTinta = (
          xPt: number,
          yPtDesdeAbajo: number,
          anchoPt: number,
          altoPt: number,
          umbral = 80
        ) => {
          const left = Math.max(0, Math.floor(xPt * escala));
          const top = Math.max(0, Math.floor((792 - yPtDesdeAbajo - altoPt) * escala));
          const right = Math.min(pixeles.info.width, Math.ceil((xPt + anchoPt) * escala));
          const bottom = Math.min(pixeles.info.height, Math.ceil((792 - yPtDesdeAbajo) * escala));
          let tinta = 0;
          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              if ((pixeles.data[(y * pixeles.info.width) + x] ?? 255) < umbral) tinta += 1;
            }
          }
          return tinta;
        };

        const paginaMapa = paginasMapa[indice];
        if (paginaMapa?.tipoPagina === 'reverso-vacio') {
          expect(paginaMapa.preguntas).toHaveLength(0);
          expect(paginaMapa.qr).toBeUndefined();
          expect(paginaMapa.marcasPagina).toBeUndefined();
          continue;
        }
        const tamMarcaPt = Number(paginaMapa?.marcasPagina?.size ?? 0);
        const margenPt = 10 * escalaPtPorMm;
        const margenTintaPt = 4;
        const zonasMarca = [
          [margenPt - margenTintaPt, 792 - margenPt - tamMarcaPt + margenTintaPt, tamMarcaPt + 8, tamMarcaPt + 8],
          [612 - margenPt - tamMarcaPt - margenTintaPt, 792 - margenPt - tamMarcaPt + margenTintaPt, tamMarcaPt + 8, tamMarcaPt + 8],
          [margenPt - margenTintaPt, margenPt - margenTintaPt, tamMarcaPt + 8, tamMarcaPt + 8],
          [612 - margenPt - tamMarcaPt - margenTintaPt, margenPt - margenTintaPt, tamMarcaPt + 8, tamMarcaPt + 8]
        ];
        for (const zona of zonasMarca) {
          expect(contarTinta(...zona), `fiducial sin tinta a ${dpi} DPI`).toBeGreaterThan(12);
        }

        for (const pregunta of paginasMapa[indice]?.preguntas ?? []) {
          const radio = Number(pregunta.perfilOmr?.radio ?? 0);
          expect(radio, `radio OMR ausente en pregunta ${pregunta.numeroPregunta}`).toBeGreaterThan(0);
          for (const opcion of pregunta.opciones ?? []) {
            const tintaBurbuja = contarTinta(
              Number(opcion.x) - radio - 1.5,
              Number(opcion.y) - radio - 1.5,
              radio * 2 + 3,
              radio * 2 + 3
            );
            expect(
              tintaBurbuja,
              `burbuja ${opcion.letra} sin contorno distinguible en pregunta ${pregunta.numeroPregunta} a ${dpi} DPI`
            ).toBeGreaterThan(8);
          }
        }

        if (indice === 0) {
          const encabezado = paginasMapa[0]?.layoutDebug?.header;
          expect(encabezado, `cabecera ausente a ${dpi} DPI`).toBeTruthy();
          if (encabezado) {
            // La franja izquierda queda fuera de logos, QR y texto central. Se
            // mide su contraste local para impedir que el patrón geométrico
            // sea sustituido accidentalmente por un fondo plano o invisible.
            const xInicio = Math.floor((encabezado.x + 12) * escala);
            const xFin = Math.min(pixeles.info.width, Math.ceil((encabezado.x + 50) * escala));
            const yInicio = Math.max(1, Math.floor((792 - encabezado.y - encabezado.height + 10) * escala));
            const yFin = Math.min(pixeles.info.height - 1, Math.ceil((792 - encabezado.y - 10) * escala));
            let bordes = 0;
            for (let y = yInicio; y < yFin; y += 1) {
              for (let x = xInicio; x < xFin; x += 1) {
                const actual = pixeles.data[(y * pixeles.info.width) + x] ?? 255;
                const derecha = pixeles.data[(y * pixeles.info.width) + x + 1] ?? actual;
                const abajo = pixeles.data[((y + 1) * pixeles.info.width) + x] ?? actual;
                if (Math.max(Math.abs(actual - derecha), Math.abs(actual - abajo)) > 3) bordes += 1;
              }
            }
            expect(bordes, `patrón geométrico sin contraste suficiente a ${dpi} DPI`).toBeGreaterThan(100);

            const iconos = paginasMapa[0]?.layoutDebug?.headerIconBoxes ?? [];
            expect(iconos.map((icono) => icono.id)).toEqual([
              'icono-alumno',
              'icono-grupo',
              'icono-indicaciones'
            ]);
            for (const icono of iconos) {
              const tintaIcono = contarTinta(
                Number(icono.x) - 1,
                Number(icono.y) - 1,
                Number(icono.width) + 2,
                Number(icono.height) + 2,
                220
              );
              expect(
                tintaIcono,
                `icono ${icono.id} sin trazo distinguible a ${dpi} DPI`
              ).toBeGreaterThan(4);
            }
          }
        }

        if (indice === 0) {
          const qr = paginasMapa[0]?.qr;
          expect(qr).toBeTruthy();
          const tintaQr = contarTinta(Number(qr?.x ?? 0), Number(qr?.y ?? 0), Number(qr?.size ?? 0), Number(qr?.size ?? 0));
          expect(tintaQr, `QR sin módulos distinguibles a ${dpi} DPI`).toBeGreaterThan(100);
        }
      }
    }
  });
});
