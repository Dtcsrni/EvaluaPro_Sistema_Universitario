/**
 * servicioEncuadrePdf
 *
 * Responsabilidad: Generación y estampado de firmas digitales en el PDF del
 * Encuadre de Asignatura institucional.
 *
 * El formato generado replica el documento oficial "ENCUADRE LISC.docx" con
 * todos los datos institucionales (nombre, lema, logo) y de asignatura
 * (clave, materia, horas, créditos, objetivo) completamente parametrizados,
 * permitiendo reutilizar el servicio para cualquier institución.
 *
 * Límites: Solo interactúa con pdf-lib y buffers. No accede a base de datos.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'node:crypto';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AlumnoFirmaInfo = {
  id: string;
  nombreCompleto: string;
  matricula: string;
  correo: string;
};

export type ParamsEncuadre = {
  // ── Datos de la asignatura ────────────────────────────────────────────────
  asignatura: string;
  docenteNombre: string;
  carrera?: string;
  cicloLectivo: string;          // Ej: "Del 03 de noviembre del 2025 al 12 de diciembre de 2025 7:00 am a 9:00 am"
  clave?: string;                // Ej: "ISCF227"
  area?: string;                 // Ej: "Profesional"
  horasDocente?: number;         // Default 50
  horasIndependientes?: number;  // Default 100
  horasTotales?: number;         // Calculado: docente + independientes; default hDoc+hInd
  creditos?: number;             // Default 6.25
  ejeFormacion?: string;         // Default "Profesional"
  objetivoGeneral?: string;

  // ── Datos institucionales (parametrizables para cualquier institución) ────
  /** Nombre completo de la institución. Default: "Centro Universitario Hidalguense" */
  institucionNombre?: string;
  /** Lema institucional. Default: 'LA SABIDURIA ES NUESTRA FUERZA' */
  institucionLema?: string;
  /**
   * Logo izquierdo de la institución (PNG o JPEG como Buffer).
   * Default: carga `apps/backend/src/assets/logos/logo_cuh_izquierda.png` si existe.
   */
  logoPngBuffer?: Buffer;
  /**
   * Logo derecho del programa/carrera (PNG o JPEG como Buffer).
   * Default: carga `apps/backend/src/assets/logos/logo_cuh_programa.png` si existe.
   */
  logoCarreraBuffer?: Buffer;

  // ── Ponderaciones del encuadre (configurables por periodo) ────────────────
  porcentajeExamenes?: number;        // Default 50
  porcentajeEvalContinua?: number;    // Default 50
  ponderacion1erParcial?: number;     // Default 20
  ponderacion2doParcial?: number;     // Default 20
  ponderacionGlobal?: number;         // Default 60
  ponderacionExamenEscrito?: number;  // Default 60 (del bloque examen)
  ponderacionPractica?: number;       // Default 40 (del bloque examen)

  alumnos: AlumnoFirmaInfo[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Divide un texto en líneas para que se ajuste a un ancho máximo en pdf-lib.
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ─── Hash de Integridad ───────────────────────────────────────────────────────

/**
 * Calcula el Hash de Integridad Criptográfica (HMAC-SHA256) de la firma.
 */
export function calcularHashFirma(jwtSecret: string, payload: {
  usuarioId: string;
  correo: string;
  fecha: string;
  direccionIp: string;
}): string {
  const hmac = crypto.createHmac('sha256', jwtSecret);
  const data = `${payload.usuarioId}|${payload.correo}|${payload.fecha}|${payload.direccionIp}`;
  hmac.update(data);
  return hmac.digest('hex').substring(0, 16).toUpperCase();
}

// ─── Carga de logos por defecto ─────────────────────────────────────────────
import fsSync from 'node:fs';
import pathMod from 'node:path';

const __dirname_assets = pathMod.resolve(
  __dirname,
  '../../../src/assets/logos'
);

function cargarLogoDefault(nombre: string): Buffer | undefined {
  try {
    const ruta = pathMod.join(__dirname_assets, nombre);
    if (fsSync.existsSync(ruta)) return fsSync.readFileSync(ruta);
  } catch { /* ignorar */ }
  return undefined;
}

// ─── Generación del PDF Base ──────────────────────────────────────────────────

/**
 * Genera el PDF base del encuadre con el formato oficial ENCUADRE LISC.
 * Replica el encabezado de 3 columnas: [logo inst] [nombre+lema+carrera] [logo carrera]
 * y la tabla "Formato de Asignatura" del DOCX institucional.
 */
export async function generarPdfEncuadreBase(params: ParamsEncuadre): Promise<Buffer> {
  const doc = await PDFDocument.create();

  const fNormal = await doc.embedFont(StandardFonts.Helvetica);
  const fBold   = await doc.embedFont(StandardFonts.HelveticaBold);

  // Paleta de colores institucional
  const AZUL_CUH = rgb(0.08, 0.20, 0.42);
  const GRIS_HDR  = rgb(0.88, 0.88, 0.88);
  const NEGRO     = rgb(0, 0, 0);
  const GRIS_TEXTO = rgb(0.25, 0.25, 0.25);
  const BLANCO    = rgb(1, 1, 1);

  // Defaults de ponderaciones
  const pctExamenes    = params.porcentajeExamenes ?? 50;
  const pctContinua    = params.porcentajeEvalContinua ?? 50;
  const pond1er        = params.ponderacion1erParcial ?? 20;
  const pond2do        = params.ponderacion2doParcial ?? 20;
  const pondGlobal     = params.ponderacionGlobal ?? 60;
  const pondEscrito    = params.ponderacionExamenEscrito ?? 60;
  const pondPractica   = params.ponderacionPractica ?? 40;

  // ─── PÁGINA 1: FORMATO DE ASIGNATURA + ENCUADRE ──────────────────────────
  const page1 = doc.addPage([612, 792]); // Letter (215.9 x 279.4 mm)
  const { height } = page1.getSize();
  const LEFT  = 40;
  const RIGHT = 572;
  const W     = RIGHT - LEFT; // 532 pts

  // ─ Cabecera institucional — layout de 3 columnas ──────────────────────────
  //   [LOGO IZQ] | [Nombre + Lema + Carrera] | [LOGO CARRERA]
  const nombreInst = params.institucionNombre ?? 'CENTRO UNIVERSITARIO HIDALGUENSE';
  const lemaInst   = params.institucionLema   ?? 'LA SABIDURIA ES NUESTRA FUERZA';
  const carreraHdr = params.carrera           ?? 'LICENCIATURA EN INGENIERIA EN SISTEMAS COMPUTACIONALES';

  // Dimensiones del área de cabecera
  const HDR_TOP    = height - 20;   // Y superior del encabezado
  const HDR_HEIGHT = 58;            // Alto total del bloque cabecera
  const LOGO_W_MAX = 70;            // Ancho máximo de cada logo
  const LOGO_H_MAX = 52;            // Alto máximo de cada logo
  const CENTER_X   = LEFT + LOGO_W_MAX + 8;
  const CENTER_W   = W - (LOGO_W_MAX + 8) * 2;

  // Helper: incrustar imagen (intenta PNG luego JPEG)
  const embedImg = async (buf: Buffer) => {
    try { return await doc.embedPng(buf); } catch { /* fall through */ }
    try { return await doc.embedJpg(buf); } catch { /* fall through */ }
    return null;
  };

  // Logo izquierdo (institución)
  const bufIzq = params.logoPngBuffer ?? cargarLogoDefault('logo_cuh_izquierda.png');
  if (bufIzq) {
    const img = await embedImg(bufIzq);
    if (img) {
      const dims = img.scaleToFit(LOGO_W_MAX, LOGO_H_MAX);
      const logoY = HDR_TOP - HDR_HEIGHT / 2 - dims.height / 2;
      page1.drawImage(img, { x: LEFT, y: logoY, width: dims.width, height: dims.height });
    }
  }

  // Logo derecho (carrera/programa)
  const bufDer = params.logoCarreraBuffer ?? cargarLogoDefault('logo_cuh_programa.png');
  if (bufDer) {
    const img = await embedImg(bufDer);
    if (img) {
      const dims = img.scaleToFit(LOGO_W_MAX, LOGO_H_MAX);
      const logoY = HDR_TOP - HDR_HEIGHT / 2 - dims.height / 2;
      page1.drawImage(img, { x: RIGHT - dims.width, y: logoY, width: dims.width, height: dims.height });
    }
  }

  // Texto central: nombre (bold grande), lema (gris pequeño), carrera (azul bold)
  const nomW = fBold.widthOfTextAtSize(nombreInst, 13);
  page1.drawText(nombreInst, {
    x: CENTER_X + (CENTER_W - nomW) / 2,
    y: HDR_TOP - 20,
    size: 13, font: fBold, color: AZUL_CUH
  });
  const lemaW = fNormal.widthOfTextAtSize(lemaInst, 8);
  page1.drawText(lemaInst, {
    x: CENTER_X + (CENTER_W - lemaW) / 2,
    y: HDR_TOP - 33,
    size: 8, font: fNormal, color: GRIS_TEXTO
  });
  // Carrera en azul bold bajo el lema (si es larga, recortar con puntos suspensivos)
  const carreraStr = carreraHdr.length > 58 ? carreraHdr.substring(0, 55) + '...' : carreraHdr;
  const carrW = fBold.widthOfTextAtSize(carreraStr, 8.5);
  page1.drawText(carreraStr, {
    x: CENTER_X + (CENTER_W - carrW) / 2,
    y: HDR_TOP - 47,
    size: 8.5, font: fBold, color: AZUL_CUH
  });

  // Línea separadora bajo cabecera
  page1.drawLine({
    start: { x: LEFT, y: HDR_TOP - HDR_HEIGHT - 2 },
    end:   { x: RIGHT, y: HDR_TOP - HDR_HEIGHT - 2 },
    thickness: 0.5, color: rgb(0.75, 0.75, 0.75)
  });

  // ─ Tabla "Formato de Asignatura" ─────────────────────────────────────────
  const TBL_TOP = HDR_TOP - HDR_HEIGHT - 16;
  page1.drawRectangle({ x: LEFT, y: TBL_TOP - 16, width: W, height: 16, color: AZUL_CUH });
  page1.drawText('Formato de Asignatura', {
    x: LEFT + W / 2 - 62, y: TBL_TOP - 12, size: 9, font: fBold, color: BLANCO
  });

  // Dibuja una celda de la tabla con etiqueta gris en cabecera y valor en cuerpo
  const drawCell = (
    x: number, y: number, w: number, h: number,
    label: string, value: string, valueFontSize = 8
  ) => {
    // Borde
    page1.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.75 });
    // Cabecera de la celda (gris)
    page1.drawRectangle({ x, y: y + h - 13, width: w, height: 13, color: GRIS_HDR });
    page1.drawText(label, { x: x + 3, y: y + h - 10, size: 6.5, font: fBold, color: AZUL_CUH });
    // Valor — truncado para que no se salga del borde
    const maxChars = Math.floor((w - 6) / (valueFontSize * 0.52));
    page1.drawText(String(value ?? '').substring(0, maxChars), {
      x: x + 3, y: y + 4, size: valueFontSize, font: fNormal, color: NEGRO
    });
  };

  // Fila 1: Instituto | Programa Educativo | Periodo y Horario | Área
  const ROW1_Y = TBL_TOP - 16 - 32;
  const carrera = params.carrera ?? 'Lic. en Ingeniería en Sistemas Computacionales';
  drawCell(LEFT,        ROW1_Y, 130, 32, 'Instituto/Escuela Superior', 'Centro Universitario Hidalguense', 7);
  drawCell(LEFT + 130,  ROW1_Y, 195, 32, 'Programa Educativo', carrera, 7);
  drawCell(LEFT + 325,  ROW1_Y, 155, 32, 'Periodo y horario', params.cicloLectivo, 6.5);
  drawCell(LEFT + 480,  ROW1_Y,  92, 32, 'Area', params.area ?? '', 7);

  // Fila 2: Clave | Nombre de la Asignatura
  const ROW2_Y = ROW1_Y - 30;
  drawCell(LEFT,        ROW2_Y,  90, 30, 'Clave', params.clave ?? '', 8);
  drawCell(LEFT + 90,   ROW2_Y, 482, 30, 'Nombre de la Asignatura', params.asignatura, 9);

  // Fila 3: Horas Docente | Horas Independientes | Total de Horas | Total de Créditos
  const ROW3_Y = ROW2_Y - 30;
  const hDoc = params.horasDocente ?? 50;
  const hInd = params.horasIndependientes ?? 100;
  const hTot = params.horasTotales ?? (hDoc + hInd);
  const cred = params.creditos ?? 6.25;
  drawCell(LEFT,        ROW3_Y, 133, 30, 'Horas Docente', String(hDoc), 9);
  drawCell(LEFT + 133,  ROW3_Y, 133, 30, 'Horas Independientes', String(hInd), 9);
  drawCell(LEFT + 266,  ROW3_Y, 133, 30, 'Total de Horas', String(hTot), 9);
  drawCell(LEFT + 399,  ROW3_Y, 173, 30, 'Total de Creditos', String(cred), 9);

  // Fila 4: Eje de formación | Objetivo General (celda alta con wrapping)
  const ROW4_H = 70;
  const ROW4_Y = ROW3_Y - ROW4_H;

  // Eje de formación
  page1.drawRectangle({ x: LEFT, y: ROW4_Y, width: 90, height: ROW4_H, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.75 });
  page1.drawRectangle({ x: LEFT, y: ROW4_Y + ROW4_H - 13, width: 90, height: 13, color: GRIS_HDR });
  page1.drawText('Eje de formacion', { x: LEFT + 3, y: ROW4_Y + ROW4_H - 10, size: 6.5, font: fBold, color: AZUL_CUH });
  page1.drawText(params.ejeFormacion ?? 'Profesional', { x: LEFT + 3, y: ROW4_Y + ROW4_H - 28, size: 8, font: fNormal, color: NEGRO });

  // Objetivo General con word-wrap
  const OBJ_X = LEFT + 90;
  const OBJ_W = W - 90;
  page1.drawRectangle({ x: OBJ_X, y: ROW4_Y, width: OBJ_W, height: ROW4_H, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.75 });
  page1.drawRectangle({ x: OBJ_X, y: ROW4_Y + ROW4_H - 13, width: OBJ_W, height: 13, color: GRIS_HDR });
  page1.drawText('Objetivo General', { x: OBJ_X + 3, y: ROW4_Y + ROW4_H - 10, size: 6.5, font: fBold, color: AZUL_CUH });

  const objText = params.objetivoGeneral ?? '(Sin especificar)';
  const objLines = wrapText(objText, OBJ_W - 8, fNormal, 7);
  let objY = ROW4_Y + ROW4_H - 26;
  for (const linea of objLines) {
    if (objY > ROW4_Y + 2) {
      page1.drawText(linea, { x: OBJ_X + 4, y: objY, size: 7, font: fNormal, color: NEGRO });
      objY -= 9;
    }
  }

  // ─ Sección "Encuadre." ────────────────────────────────────────────────────
  let curY = ROW4_Y - 22;

  page1.drawText('Encuadre.', { x: LEFT, y: curY, size: 11, font: fBold, color: AZUL_CUH });
  curY -= 16;

  // Exámenes (bloque)
  page1.drawText(`Examenes ${pctExamenes}%`, { x: LEFT, y: curY, size: 9, font: fBold, color: NEGRO });
  curY -= 13;

  const bulletLines = [
    `Primer parcial: ${pond1er}% (fecha)`,
    `Segundo parcial: ${pond2do}% (fecha)`,
    `Examen global: ${pondGlobal}% (fecha)`,
    'Examen extraordinario: (fecha)',
  ];
  for (const line of bulletLines) {
    page1.drawCircle({ x: LEFT + 6, y: curY + 3, size: 1.8, color: AZUL_CUH });
    page1.drawText(line, { x: LEFT + 15, y: curY, size: 8.5, font: fNormal, color: NEGRO });
    curY -= 12;
  }

  curY -= 4;
  page1.drawText(`Evaluacion continua ${pctContinua}%.`, { x: LEFT, y: curY, size: 9, font: fBold, color: NEGRO });
  curY -= 12;
  page1.drawText(
    `El examen del parcial equivale a ${pondEscrito}% examen escrito y ${pondPractica}% practica final/proyecto integrador.`,
    { x: LEFT + 15, y: curY, size: 8, font: fNormal, color: NEGRO }
  );
  curY -= 12;

  const continuaItems = [
    'La evaluacion es formativa y sumativa, por lo que se consideran los siguientes aspectos:',
    'Heteroevaluacion y Coevaluacion.',
    'Construccion e integracion de cada producto que se derivan de cada sesion.',
    'Asistencia y desempeno en el trabajo colaborativo.',
    'Participacion individual y en equipo.',
    'Analisis y reflexion de los contenidos tematicos.',
    'Puntualidad y responsabilidad.',
    'Evaluacion del docente titular.',
  ];
  for (const item of continuaItems) {
    page1.drawCircle({ x: LEFT + 6, y: curY + 3, size: 1.8, color: AZUL_CUH });
    page1.drawText(item, { x: LEFT + 15, y: curY, size: 8, font: fNormal, color: NEGRO });
    curY -= 11;
  }

  curY -= 6;
  page1.drawText('Ejemplos:', { x: LEFT, y: curY, size: 8.5, font: fBold, color: NEGRO });
  curY -= 12;
  page1.drawText(
    '6.5 ------ 7              6.4 ------ 6              5.4 ------ 5              5.9 ------ 5',
    { x: LEFT + 10, y: curY, size: 8.5, font: fBold, color: AZUL_CUH }
  );
  curY -= 18;

  // ─ Faltas e inasistencias ──────────────────────────────────────────────────
  page1.drawText('Faltas e inasistencias.', { x: LEFT, y: curY, size: 9, font: fBold, color: NEGRO });
  curY -= 12;

  const faltasTextos = [
    'Alumnos tienen oportunidad de 3 faltas injustificadas como limite, la 4ta inasistencia corresponde a quedar sin',
    'derecho a examen parcial, global y extraordinario.',
    'Solo se justificaran situaciones medicas y el justificante debera ser expedido por dependencias publicas, los',
    'documentos de instituciones privadas quedaran a consideracion de coordinacion academica. (Uno por bimestre)',
    'No existen retardos solo se aplican asistencias o faltas. (Por reglamento solo tienen 10 min de tolerancia para',
    'incorporarse a su clase).',
  ];
  for (const linea of faltasTextos) {
    page1.drawText(linea, { x: LEFT + 15, y: curY, size: 8, font: fNormal, color: NEGRO });
    curY -= 11;
  }

  // ─ Área de firma del Docente ───────────────────────────────────────────────
  curY -= 18;
  page1.drawLine({ start: { x: LEFT, y: curY }, end: { x: LEFT + 210, y: curY }, thickness: 0.75, color: NEGRO });
  page1.drawText('Nombre y Firma del docente', { x: LEFT, y: curY - 12, size: 8, font: fNormal, color: GRIS_TEXTO });

  // Número de página
  page1.drawText('Pagina 1 de 2', { x: RIGHT - 65, y: 25, size: 7.5, font: fNormal, color: rgb(0.5, 0.5, 0.5) });

  // ─── PÁGINA 2: LISTA DE FIRMAS DIGITALES ────────────────────────────────
  const page2 = doc.addPage([612, 792]);

  // Cabecera página 2 — mismos datos institucionales parametrizados
  const nombreInst2 = params.institucionNombre ?? 'Centro Universitario Hidalguense';
  if (params.logoPngBuffer) {
    try {
      let logoImg2;
      try { logoImg2 = await doc.embedPng(params.logoPngBuffer); }
      catch { logoImg2 = await doc.embedJpg(params.logoPngBuffer); }
      const dims2 = logoImg2.scale(0.10);
      const H2 = Math.min(dims2.height, 44);
      const W2 = Math.min(dims2.width, 70);
      page2.drawImage(logoImg2, { x: LEFT, y: height - 28 - H2, width: W2, height: H2 });
    } catch { /* imagen inválida — omitir */ }
  }
  page2.drawText(nombreInst2, {
    x: LEFT + 88, y: height - 38, size: 13, font: fBold, color: AZUL_CUH
  });
  page2.drawText('Registro de Conformidad y Firmas Digitales', {
    x: LEFT + 130, y: height - 56, size: 10, font: fBold, color: AZUL_CUH
  });
  page2.drawText(`Asignatura: ${params.asignatura}   |   Ciclo: ${params.cicloLectivo}`, {
    x: LEFT, y: height - 74, size: 8, font: fNormal, color: GRIS_TEXTO
  });

  // Encabezado de la tabla de firmas
  const SIG_TOP = height - 96;
  const COL_WIDTHS = [50, 180, 160, 70, 72]; // ROL | NOMBRE | CORREO | ESTADO | HASH/FECHA
  const COL_LABELS = ['Rol', 'Nombre', 'Correo institucional', 'Estado', 'Firma digital / IP'];
  const HDR_H = 18;

  page2.drawRectangle({ x: LEFT, y: SIG_TOP - HDR_H, width: W, height: HDR_H, color: AZUL_CUH });

  let colX = LEFT;
  for (let c = 0; c < COL_LABELS.length; c++) {
    page2.drawText(COL_LABELS[c] ?? '', {
      x: colX + 3, y: SIG_TOP - HDR_H + 5, size: 7.5, font: fBold, color: BLANCO
    });
    colX += COL_WIDTHS[c] ?? 0;
  }

  // Fila de cada firmante (Docente + Alumnos)
  const drawSigRow = (idx: number, rol: string, nombre: string, correo: string) => {
    const ROW_H = 22;
    const rowY = SIG_TOP - HDR_H - (idx + 1) * ROW_H;
    const rowBg = idx % 2 === 0 ? rgb(0.97, 0.97, 0.97) : BLANCO;

    page2.drawRectangle({ x: LEFT, y: rowY, width: W, height: ROW_H, color: rowBg, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });

    const vals = [rol, nombre.substring(0, 26), correo.substring(0, 26), 'PENDIENTE', 'Esperando firma...'];
    const colors = [AZUL_CUH, NEGRO, GRIS_TEXTO, rgb(0.75, 0.1, 0.1), GRIS_TEXTO];
    const fonts  = [fBold, fNormal, fNormal, fBold, fNormal];
    const sizes  = [7.5, 8, 7.5, 7.5, 7];

    let cx = LEFT;
    for (let c = 0; c < vals.length; c++) {
      page2.drawText(vals[c] ?? '', {
        x: cx + 3, y: rowY + 7, size: sizes[c] ?? 7, font: fonts[c] ?? fNormal, color: colors[c] ?? NEGRO
      });
      cx += COL_WIDTHS[c] ?? 0;
    }
  };

  // Fila 0 = Docente
  const correoDocente = `${params.docenteNombre.toLowerCase().replace(/\s+/g, '.')}@cuh.mx`;
  drawSigRow(0, 'CATEDRATICO', params.docenteNombre, correoDocente);

  // Filas 1..N = Alumnos
  for (let i = 0; i < params.alumnos.length; i++) {
    const alumno = params.alumnos[i];
    if (alumno) {
      drawSigRow(i + 1, 'ALUMNO', alumno.nombreCompleto, alumno.correo || `${alumno.matricula}@cuh.mx`);
    }
  }

  // Texto de declaración al pie
  const DECL_Y = 80;
  page2.drawRectangle({ x: LEFT, y: DECL_Y, width: W, height: 45, color: rgb(0.96, 0.96, 0.96), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.75 });
  page2.drawText('Declaracion de Conformidad:', { x: LEFT + 8, y: DECL_Y + 31, size: 7.5, font: fBold, color: NEGRO });
  page2.drawText(
    'Al firmar digitalmente este documento mediante el enlace unico enviado a su correo institucional @cuh.mx,',
    { x: LEFT + 8, y: DECL_Y + 20, size: 7, font: fNormal, color: GRIS_TEXTO }
  );
  page2.drawText(
    'el firmante confirma que ha leido y acepta las ponderaciones y el reglamento academico de la asignatura.',
    { x: LEFT + 8, y: DECL_Y + 10, size: 7, font: fNormal, color: GRIS_TEXTO }
  );

  page2.drawText('Pagina 2 de 2', { x: RIGHT - 65, y: 25, size: 7.5, font: fNormal, color: rgb(0.5, 0.5, 0.5) });

  return Buffer.from(await doc.save());
}

// ─── Estampado de Firma Digital ───────────────────────────────────────────────

/**
 * Estampa la firma digital de un usuario (docente o alumno) en el PDF del encuadre.
 * Localiza la fila correcta en la tabla de la Página 2 usando el índice del firmante.
 *
 * @param alumnoIndex 0-based index en el array de alumnos. Ignorado si rol='docente'.
 */
export async function registrarFirmaPdf(
  pdfBuffer: Buffer,
  opts: {
    rol: 'docente' | 'alumno';
    usuarioId: string;
    nombreFirmante: string;
    correo: string;
    ip: string;
    hash: string;
    fecha: Date;
    alumnoIndex?: number;
  }
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const pages = doc.getPages();
  const page2 = pages[1];
  if (!page2) throw new Error('El PDF del encuadre no tiene la estructura de 2 páginas esperada');

  const fBold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fNormal = await doc.embedFont(StandardFonts.Helvetica);

  // Calcular la fila Y
  const idx = opts.rol === 'docente' ? 0 : (opts.alumnoIndex ?? 0) + 1;
  const SIG_TOP = page2.getSize().height - 96;
  const HDR_H   = 18;
  const ROW_H   = 22;
  const rowY    = SIG_TOP - HDR_H - (idx + 1) * ROW_H;
  const rowBg   = idx % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);

  // Columnas Estado y Firma
  const LEFT      = 40;
  const COL_WIDTHS = [50, 180, 160, 70, 72];
  const colEstadoX = LEFT + COL_WIDTHS[0]! + COL_WIDTHS[1]! + COL_WIDTHS[2]!;  // 390
  const colFirmaX  = colEstadoX + COL_WIDTHS[3]!;                               // 460

  // Limpiar zona de estado y firma (fondo blanco/gris sobre el PENDIENTE)
  page2.drawRectangle({ x: colEstadoX, y: rowY + 1, width: 182, height: ROW_H - 2, color: rowBg });

  // Dibujar "FIRMADO"
  page2.drawText('FIRMADO', { x: colEstadoX + 3, y: rowY + 7, size: 7.5, font: fBold, color: rgb(0.1, 0.55, 0.15) });

  // Detalles de la firma (Fecha | IP | ID)
  const fechaStr = opts.fecha.toISOString().split('T')[0];
  const firmaLine1 = `${fechaStr} | IP: ${opts.ip}`;
  const firmaLine2 = `ID: ${opts.hash}`;
  page2.drawText(firmaLine1, { x: colFirmaX + 2, y: rowY + 13, size: 6, font: fNormal, color: rgb(0, 0, 0) });
  page2.drawText(firmaLine2, { x: colFirmaX + 2, y: rowY + 5,  size: 6, font: fNormal, color: rgb(0, 0, 0) });

  return Buffer.from(await doc.save());
}
