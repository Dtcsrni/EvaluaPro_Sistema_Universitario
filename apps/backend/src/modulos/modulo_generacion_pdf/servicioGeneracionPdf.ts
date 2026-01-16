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

type SegmentoTexto = { texto: string; font: PDFFont; size: number; esCodigo?: boolean };
type LineaSegmentos = { segmentos: SegmentoTexto[]; lineHeight: number };

function partirCodigoEnLineas(texto: string) {
  // Preserva saltos de linea; expande tabs.
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, '  '));
}

function partirBloquesCodigo(texto: string) {
  const src = String(texto ?? '');
  const bloques: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];

  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('```', i);
    if (idx === -1) {
      bloques.push({ tipo: 'texto', contenido: src.slice(i) });
      break;
    }

    if (idx > i) bloques.push({ tipo: 'texto', contenido: src.slice(i, idx) });

    const fin = src.indexOf('```', idx + 3);
    if (fin === -1) {
      // Sin cierre: trata como texto normal.
      bloques.push({ tipo: 'texto', contenido: src.slice(idx) });
      break;
    }

    const cuerpo = src.slice(idx + 3, fin);
    // Permite un "lenguaje" en la primera linea tipo ```js
    const lineas = partirCodigoEnLineas(cuerpo);
    const primera = lineas[0] ?? '';
    const resto = lineas.slice(1);
    const pareceLang = primera.trim().length > 0 && resto.length > 0;
    const contenido = (pareceLang ? resto : lineas).join('\n');
    bloques.push({ tipo: 'codigo', contenido });
    i = fin + 3;
  }

  return bloques;
}

function partirInlineCodigo(texto: string) {
  // Divide por `...` (sin escapes). Devuelve segmentos alternando texto/codigo.
  const src = String(texto ?? '');
  const out: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];
  let actual = '';
  let enCodigo = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '`') {
      out.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
      actual = '';
      enCodigo = !enCodigo;
      continue;
    }
    actual += ch;
  }
  out.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
  return out;
}

function widthSeg(seg: SegmentoTexto) {
  return seg.font.widthOfTextAtSize(seg.texto, seg.size);
}

function envolverSegmentos({ segmentos, maxWidth, preservarEspaciosIniciales }: { segmentos: SegmentoTexto[]; maxWidth: number; preservarEspaciosIniciales?: boolean }) {
  const lineas: SegmentoTexto[][] = [];
  let actual: SegmentoTexto[] = [];
  let anchoActual = 0;

  const pushLinea = () => {
    lineas.push(actual);
    actual = [];
    anchoActual = 0;
  };

  for (const seg of segmentos) {
    const texto = String(seg.texto ?? '');
    if (!texto) continue;

    const esCodigo = Boolean(seg.esCodigo);
    const tokens = esCodigo ? [texto] : texto.split(/(\s+)/).filter((p) => p.length > 0);

    for (const token of tokens) {
      const esSoloEspacios = /^\s+$/.test(token);
      if (!preservarEspaciosIniciales && actual.length === 0 && esSoloEspacios) continue;

      const tokenSeg: SegmentoTexto = { ...seg, texto: token };
      const w = widthSeg(tokenSeg);
      if (anchoActual + w <= maxWidth) {
        actual.push(tokenSeg);
        anchoActual += w;
        continue;
      }

      if (actual.length > 0) {
        pushLinea();
        if (!preservarEspaciosIniciales && esSoloEspacios) continue;
      }

      // Token demasiado ancho: trocea por caracter.
      if (w > maxWidth) {
        let chunk = '';
        for (const ch of token) {
          const c2 = chunk + ch;
          const w2 = seg.font.widthOfTextAtSize(c2, seg.size);
          if (w2 <= maxWidth) {
            chunk = c2;
            continue;
          }
          if (chunk) {
            actual.push({ ...seg, texto: chunk });
            pushLinea();
          }
          chunk = ch;
        }
        if (chunk) {
          actual.push({ ...seg, texto: chunk });
          anchoActual = widthSeg({ ...seg, texto: chunk });
        }
        continue;
      }

      actual.push(tokenSeg);
      anchoActual = w;
    }
  }

  if (actual.length > 0) lineas.push(actual);
  return lineas.length > 0 ? lineas : [[]];
}

function envolverTextoMixto({
  texto,
  maxWidth,
  fuente,
  fuenteMono,
  sizeTexto,
  sizeCodigoInline,
  sizeCodigoBloque,
  lineHeightTexto,
  lineHeightCodigo
}: {
  texto: string;
  maxWidth: number;
  fuente: PDFFont;
  fuenteMono: PDFFont;
  sizeTexto: number;
  sizeCodigoInline: number;
  sizeCodigoBloque: number;
  lineHeightTexto: number;
  lineHeightCodigo: number;
}) {
  const bloques = partirBloquesCodigo(texto);
  const lineas: LineaSegmentos[] = [];

  for (const bloque of bloques) {
    if (bloque.tipo === 'codigo') {
      const rawLines = partirCodigoEnLineas(bloque.contenido);
      for (const raw of rawLines) {
        const seg: SegmentoTexto = { texto: String(raw ?? ''), font: fuenteMono, size: sizeCodigoBloque, esCodigo: true };
        const env = envolverSegmentos({ segmentos: [seg], maxWidth, preservarEspaciosIniciales: true });
        for (const linea of env) {
          lineas.push({ segmentos: linea.length > 0 ? linea : [{ ...seg, texto: '' }], lineHeight: lineHeightCodigo });
        }
      }
      continue;
    }

    const textoPlano = String(bloque.contenido ?? '');
    const inline = partirInlineCodigo(textoPlano);
    const segmentos: SegmentoTexto[] = [];
    for (const s of inline) {
      if (!s.contenido) continue;
      if (s.tipo === 'codigo') {
        // Mantener lo escrito, pero evita whitespace extremo.
        const t = String(s.contenido).replace(/\s+/g, ' ').trim();
        if (!t) continue;
        segmentos.push({ texto: t, font: fuenteMono, size: sizeCodigoInline, esCodigo: true });
      } else {
        const t = normalizarEspacios(String(s.contenido));
        if (!t) continue;
        segmentos.push({ texto: t, font: fuente, size: sizeTexto, esCodigo: false });
      }
    }

    if (segmentos.length === 0) {
      lineas.push({ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto });
      continue;
    }

    // Insertar espacios entre segmentos cuando cambian de tipo y no hay espacio explicito.
    const conEspacios: SegmentoTexto[] = [];
    for (let idx = 0; idx < segmentos.length; idx++) {
      const seg = segmentos[idx];
      if (conEspacios.length > 0) {
        const prev = conEspacios[conEspacios.length - 1];
        const prevEndsSpace = /\s$/.test(prev.texto);
        const segStartsSpace = /^\s/.test(seg.texto);
        if (!prevEndsSpace && !segStartsSpace) {
          conEspacios.push({ texto: ' ', font: fuente, size: sizeTexto, esCodigo: false });
        }
      }
      conEspacios.push(seg);
    }

    const env = envolverSegmentos({ segmentos: conEspacios, maxWidth });
    for (const linea of env) {
      lineas.push({ segmentos: linea.length > 0 ? linea : [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto });
    }
  }

  return lineas.length > 0 ? lineas : [{ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto }];
}

function dibujarLineasMixtas({ page, lineas, x, y, colorTexto }: { page: PDFPage; lineas: LineaSegmentos[]; x: number; y: number; colorTexto?: ReturnType<typeof rgb> }) {
  let cursorY = y;
  for (const linea of lineas) {
    let cursorX = x;
    for (const seg of linea.segmentos) {
      const t = String(seg.texto ?? '');
      if (t) {
        page.drawText(t, { x: cursorX, y: cursorY, size: seg.size, font: seg.font, color: colorTexto });
        cursorX += seg.font.widthOfTextAtSize(t, seg.size);
      }
    }
    cursorY -= linea.lineHeight;
  }
  return cursorY;
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
  const fuenteMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const margen = mmAPuntos(margenMm);
  const paginasMinimas = tipoExamen === 'parcial' ? 2 : 4;

  const sizeTitulo = 16;
  const sizeMeta = 10;
  const sizePregunta = 11;
  const sizeOpcion = 10;
  const sizeNota = 9;

  // Codigo: monospace ligeramente mas pequeno y con interlineado mas compacto.
  const sizeCodigoInline = 10;
  const sizeCodigoBloque = 9;

  const lineaPregunta = 13;
  const lineaOpcion = 12;
  const lineaNota = 12;
  const separacionPregunta = 6;

  const lineaCodigoInline = lineaPregunta; // mismo alto para no afectar layout
  const lineaCodigoBloque = 10.5;

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
      const lineasEnunciado = envolverTextoMixto({
        texto: pregunta.enunciado,
        maxWidth: anchoTextoPregunta,
        fuente,
        fuenteMono,
        sizeTexto: sizePregunta,
        sizeCodigoInline,
        sizeCodigoBloque,
        lineHeightTexto: lineaPregunta,
        lineHeightCodigo: lineaCodigoBloque
      });
      const tieneImagen = Boolean(String(pregunta.imagenUrl ?? '').trim());
      let alto = lineasEnunciado.reduce((acc, l) => acc + l.lineHeight, 0);
      if (tieneImagen) alto += lineaNota;

      const ordenOpciones = mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
      for (const indiceOpcion of ordenOpciones) {
        const opcion = pregunta.opciones[indiceOpcion];
        const lineasOpcion = envolverTextoMixto({
          texto: opcion?.texto ?? '',
          maxWidth: anchoTextoOpcion,
          fuente,
          fuenteMono,
          sizeTexto: sizeOpcion,
          sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
          sizeCodigoBloque,
          lineHeightTexto: lineaOpcion,
          lineHeightCodigo: lineaCodigoBloque
        });
        alto += lineasOpcion.reduce((acc, l) => acc + l.lineHeight, 0);
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
      const lineasEnunciado = envolverTextoMixto({
        texto: pregunta.enunciado,
        maxWidth: anchoTextoPregunta,
        fuente,
        fuenteMono,
        sizeTexto: sizePregunta,
        sizeCodigoInline,
        sizeCodigoBloque,
        lineHeightTexto: lineaPregunta,
        lineHeightCodigo: lineaCodigoBloque
      });
      cursorY = dibujarLineasMixtas({ page, lineas: lineasEnunciado, x: xTextoPregunta, y: cursorY });

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

        const lineasOpcion = envolverTextoMixto({
          texto: opcion?.texto ?? '',
          maxWidth: anchoTextoOpcion,
          fuente,
          fuenteMono,
          sizeTexto: sizeOpcion,
          sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
          sizeCodigoBloque,
          lineHeightTexto: lineaOpcion,
          lineHeightCodigo: lineaCodigoBloque
        });
        cursorY = dibujarLineasMixtas({ page, lineas: lineasOpcion, x: xTextoOpcion, y: cursorY });

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
