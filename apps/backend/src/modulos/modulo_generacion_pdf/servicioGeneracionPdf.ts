/**
 * Generacion de PDFs en formato carta con marcas y QR por pagina.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import type { MapaVariante, PreguntaBase } from './servicioVariantes';

const ANCHO_CARTA = 612;
const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;

function mmAPuntos(mm: number) {
  return mm * MM_A_PUNTOS;
}

function agregarMarcasRegistro(page: PDFPage, margen: number) {
  const largo = 12;
  const color = rgb(0, 0, 0);

  page.drawLine({ start: { x: margen, y: ALTO_CARTA - margen }, end: { x: margen + largo, y: ALTO_CARTA - margen }, color });
  page.drawLine({ start: { x: margen, y: ALTO_CARTA - margen }, end: { x: margen, y: ALTO_CARTA - margen - largo }, color });

  page.drawLine({ start: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen }, end: { x: ANCHO_CARTA - margen - largo, y: ALTO_CARTA - margen }, color });
  page.drawLine({ start: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen }, end: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen - largo }, color });

  page.drawLine({ start: { x: margen, y: margen }, end: { x: margen + largo, y: margen }, color });
  page.drawLine({ start: { x: margen, y: margen }, end: { x: margen, y: margen + largo }, color });

  page.drawLine({ start: { x: ANCHO_CARTA - margen, y: margen }, end: { x: ANCHO_CARTA - margen - largo, y: margen }, color });
  page.drawLine({ start: { x: ANCHO_CARTA - margen, y: margen }, end: { x: ANCHO_CARTA - margen, y: margen + largo }, color });
}

async function agregarQr(pdfDoc: PDFDocument, page: PDFPage, qrTexto: string, margen: number) {
  const qrDataUrl = await QRCode.toDataURL(qrTexto, { margin: 1, width: 140 });
  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const qrImage = await pdfDoc.embedPng(qrBytes);
  const qrSize = 90;

  page.drawImage(qrImage, {
    x: ANCHO_CARTA - margen - qrSize,
    y: ALTO_CARTA - margen - qrSize,
    width: qrSize,
    height: qrSize
  });
}

function ordenarPreguntas(preguntas: PreguntaBase[], mapa: MapaVariante) {
  const mapaPreguntas = new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));
  return mapa.ordenPreguntas
    .map((id) => mapaPreguntas.get(id))
    .filter((pregunta): pregunta is PreguntaBase => Boolean(pregunta));
}

function normalizarEspacios(valor: string) {
  return valor.replace(/\s+/g, ' ').trim();
}

function partirEnLineas({ texto, maxWidth, font, size }: { texto: string; maxWidth: number; font: PDFFont; size: number }) {
  const limpio = normalizarEspacios(String(texto ?? ''));
  if (!limpio) return [''];

  const palabras = limpio.split(' ');
  const lineas: string[] = [];
  let actual = '';

  const cabe = (t: string) => font.widthOfTextAtSize(t, size) <= maxWidth;

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(candidato)) {
      actual = candidato;
      continue;
    }

    if (actual) lineas.push(actual);

    // Si la palabra sola no cabe, se trocea por caracteres.
    if (!cabe(palabra)) {
      let chunk = '';
      for (const ch of palabra) {
        const c2 = chunk + ch;
        if (cabe(c2)) {
          chunk = c2;
        } else {
          if (chunk) lineas.push(chunk);
          chunk = ch;
        }
      }
      actual = chunk;
    } else {
      actual = palabra;
    }
  }

  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [''];
}

export async function generarPdfExamen({
  titulo,
  folio,
  preguntas,
  mapaVariante,
  tipoExamen,
  margenMm = 10
}: {
  titulo: string;
  folio: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: 'parcial' | 'global';
  margenMm?: number;
}) {
  const pdfDoc = await PDFDocument.create();
  const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margen = mmAPuntos(margenMm);
  const paginasMinimas = tipoExamen === 'parcial' ? 2 : 4;

  const sizeTitulo = 16;
  const sizeMeta = 10;
  const sizePregunta = 11;
  const sizeOpcion = 10;
  const sizeNota = 9;

  const lineaPregunta = 13;
  const lineaOpcion = 12;
  const lineaNota = 12;
  const separacionPregunta = 6;

  const xNumeroPregunta = margen;
  const xTextoPregunta = margen + 18;
  const xBurbuja = margen + 6;
  const xEtiquetaOpcion = margen + 16;
  const xTextoOpcion = margen + 32;

  const anchoTextoPregunta = ANCHO_CARTA - margen - xTextoPregunta;
  const anchoTextoOpcion = ANCHO_CARTA - margen - xTextoOpcion;

  const preguntasOrdenadas = ordenarPreguntas(preguntas, mapaVariante);
  let indicePregunta = 0;
  let numeroPagina = 1;
  const paginasMeta: { numero: number; qrTexto: string; preguntasDel: number; preguntasAl: number }[] = [];
  // Se guarda el mapa de posiciones para el escaneo OMR posterior.
  const paginasOmr: Array<{
    numeroPagina: number;
    preguntas: Array<{
      numeroPregunta: number;
      idPregunta: string;
      opciones: Array<{ letra: string; x: number; y: number }>;
    }>;
  }> = [];

  while (indicePregunta < preguntasOrdenadas.length || numeroPagina <= paginasMinimas) {
    const page = pdfDoc.addPage([ANCHO_CARTA, ALTO_CARTA]);
    const qrTexto = `EXAMEN:${folio}:P${numeroPagina}`;
    let preguntasDel = 0;
    let preguntasAl = 0;
    const mapaPagina: Array<{
      numeroPregunta: number;
      idPregunta: string;
      opciones: Array<{ letra: string; x: number; y: number }>;
    }> = [];

    agregarMarcasRegistro(page, margen);
    await agregarQr(pdfDoc, page, qrTexto, margen);

    page.drawText(titulo, { x: margen, y: ALTO_CARTA - margen - 24, size: sizeTitulo, font: fuente });
    page.drawText(`Folio: ${folio} | Pagina ${numeroPagina}`, {
      x: margen,
      y: ALTO_CARTA - margen - 44,
      size: sizeMeta,
      font: fuente
    });

    let cursorY = ALTO_CARTA - margen - 70;

    const alturaDisponibleMin = margen + 60;

    const calcularAlturaPregunta = (pregunta: PreguntaBase, numero: number) => {
      const lineasEnunciado = partirEnLineas({ texto: pregunta.enunciado, maxWidth: anchoTextoPregunta, font: fuente, size: sizePregunta });
      const tieneImagen = Boolean(String(pregunta.imagenUrl ?? '').trim());
      let alto = lineasEnunciado.length * lineaPregunta;
      if (tieneImagen) alto += lineaNota;

      const ordenOpciones = mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
      for (const indiceOpcion of ordenOpciones) {
        const opcion = pregunta.opciones[indiceOpcion];
        const lineasOpcion = partirEnLineas({ texto: opcion?.texto ?? '', maxWidth: anchoTextoOpcion, font: fuente, size: sizeOpcion });
        alto += Math.max(1, lineasOpcion.length) * lineaOpcion;
      }
      alto += separacionPregunta;
      // Reserva extra para evitar quedar demasiado pegado al limite.
      alto += 4;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void numero;
      return alto;
    };

    while (indicePregunta < preguntasOrdenadas.length && cursorY > alturaDisponibleMin) {
      const pregunta = preguntasOrdenadas[indicePregunta];
      const numero = indicePregunta + 1;

      const alturaNecesaria = calcularAlturaPregunta(pregunta, numero);
      if (cursorY - alturaNecesaria < alturaDisponibleMin) break;

      if (!preguntasDel) preguntasDel = numero;
      preguntasAl = numero;

      // Numero + enunciado con wrap (el numero se dibuja aparte para alinear correctamente).
      page.drawText(`${numero}.`, { x: xNumeroPregunta, y: cursorY, size: sizePregunta, font: fuente });
      const lineasEnunciado = partirEnLineas({ texto: pregunta.enunciado, maxWidth: anchoTextoPregunta, font: fuente, size: sizePregunta });
      for (const linea of lineasEnunciado) {
        page.drawText(linea, { x: xTextoPregunta, y: cursorY, size: sizePregunta, font: fuente });
        cursorY -= lineaPregunta;
      }

      if (pregunta.imagenUrl) {
        page.drawText('(Imagen adjunta)', {
          x: xTextoPregunta,
          y: cursorY,
          size: sizeNota,
          font: fuente,
          color: rgb(0.4, 0.4, 0.4)
        });
        cursorY -= lineaNota;
      }

      const ordenOpciones = mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
      const opcionesOmr: Array<{ letra: string; x: number; y: number }> = [];
      ordenOpciones.forEach((indiceOpcion, idx) => {
        const opcion = pregunta.opciones[indiceOpcion];
        const letra = String.fromCharCode(65 + idx);
        const yBurbuja = cursorY + 3;
        page.drawCircle({ x: xBurbuja, y: yBurbuja, size: 4, borderWidth: 0.8, borderColor: rgb(0, 0, 0) });
        page.drawText(`${letra})`, { x: xEtiquetaOpcion, y: cursorY, size: sizeOpcion, font: fuente });

        const lineasOpcion = partirEnLineas({ texto: opcion?.texto ?? '', maxWidth: anchoTextoOpcion, font: fuente, size: sizeOpcion });
        for (const linea of lineasOpcion) {
          page.drawText(linea, { x: xTextoOpcion, y: cursorY, size: sizeOpcion, font: fuente });
          cursorY -= lineaOpcion;
        }

        opcionesOmr.push({ letra, x: xBurbuja, y: yBurbuja });
      });

      cursorY -= separacionPregunta;
      indicePregunta += 1;
      mapaPagina.push({ numeroPregunta: numero, idPregunta: pregunta.id, opciones: opcionesOmr });
    }

    paginasMeta.push({ numero: numeroPagina, qrTexto, preguntasDel, preguntasAl });

    paginasOmr.push({ numeroPagina, preguntas: mapaPagina });
    numeroPagina += 1;
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes: Buffer.from(pdfBytes), paginas: paginasMeta, mapaOmr: { margenMm, paginas: paginasOmr } };
}
