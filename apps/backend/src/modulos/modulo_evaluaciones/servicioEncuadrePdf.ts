/**
 * servicioEncuadrePdf
 *
 * Responsabilidad: Generación y estampado de firmas digitales en el PDF del Encuadre de Asignatura.
 * Limites: Solo interactúa con pdf-lib y buffers. No accede a base de datos.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'node:crypto';

type AlumnoFirmaInfo = {
  id: string;
  nombreCompleto: string;
  matricula: string;
  correo: string;
};type ParamsEncuadre = {
  asignatura: string;
  docenteNombre: string;
  carrera: string;
  cicloLectivo: string;
  clave?: string;
  area?: string;
  horasDocente?: number;
  horasIndependientes?: number;
  horasTotales?: number;
  creditos?: number;
  objetivoGeneral?: string;
  alumnos: AlumnoFirmaInfo[];
};

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
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Calcula el Hash de Integridad Criptográfica de la firma.
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

/**
 * Genera el PDF base del encuadre con los metadatos y la tabla de firmas vacía.
 */
export async function generarPdfEncuadreBase(params: ParamsEncuadre): Promise<Buffer> {
  const doc = await PDFDocument.create();
  
  // Usar fuentes estándar
  const fontHelvetica = await doc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  
  // ─── PÁGINA 1: DETALLES DEL ENCUADRE ───────────────────────────────────────
  const page1 = doc.addPage([612, 792]); // Letter size
  
  // Encabezado
  page1.drawText('CENTRO UNIVERSITARIO HIDALGUENSE', {
    x: 120, y: 745, size: 15, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });
  page1.drawText('"La sabiduría es nuestra fuerza"', {
    x: 210, y: 730, size: 9, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4)
  });
  page1.drawText('FORMATO DE ENCUADRE DE ASIGNATURA', {
    x: 165, y: 705, size: 11, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2)
  });
  
  // Tabla Formato de Asignatura (Dibujamos recuadros y textos)
  const drawTableBox = (p: typeof page1, x: number, y: number, w: number, h: number, title: string, value: string) => {
    p.drawRectangle({
      x, y, width: w, height: h,
      borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1
    });
    p.drawRectangle({
      x, y: y + h - 12, width: w, height: 12,
      color: rgb(0.9, 0.9, 0.9)
    });
    p.drawText(title, {
      x: x + 4, y: y + h - 9, size: 7, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2)
    });
    p.drawText(String(value || '').substring(0, 55), {
      x: x + 4, y: y + 4, size: 8, font: fontHelvetica, color: rgb(0, 0, 0)
    });
  };
  
  // Renglón 0: Título de la tabla
  page1.drawRectangle({
    x: 40, y: 675, width: 532, height: 15,
    color: rgb(0.1, 0.2, 0.4)
  });
  page1.drawText('FORMATO DE ASIGNATURA', {
    x: 230, y: 679, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1)
  });

  // Renglón 1
  drawTableBox(page1, 40, 635, 140, 35, 'INSTITUTO/ESCUELA SUPERIOR', 'Centro Universitario Hidalguense');
  drawTableBox(page1, 180, 635, 160, 35, 'PROGRAMA EDUCATIVO', params.carrera || 'Lic. en Ingeniería en Sistemas Computacionales');
  drawTableBox(page1, 340, 635, 150, 35, 'PERIODO Y HORARIO', params.cicloLectivo);
  drawTableBox(page1, 490, 635, 82, 35, 'ÁREA', params.area || 'Ingeniería');
  
  // Renglón 2
  drawTableBox(page1, 40, 595, 100, 35, 'CLAVE', params.clave || 'ISCF213');
  drawTableBox(page1, 140, 595, 432, 35, 'NOMBRE DE LA ASIGNATURA', params.asignatura);
  
  // Renglón 3
  drawTableBox(page1, 40, 555, 133, 35, 'HORAS DOCENTE', String(params.horasDocente ?? 50));
  drawTableBox(page1, 173, 555, 133, 35, 'HORAS INDEPENDIENTES', String(params.horasIndependientes ?? 100));
  drawTableBox(page1, 306, 555, 133, 35, 'TOTAL DE HORAS', String(params.horasTotales ?? 150));
  drawTableBox(page1, 439, 555, 133, 35, 'TOTAL DE CRÉDITOS', String(params.creditos ?? 6.25));

  // Renglón 4 (Eje y Objetivo General con Wrapping)
  page1.drawRectangle({
    x: 40, y: 460, width: 100, height: 90, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1
  });
  page1.drawRectangle({
    x: 40, y: 538, width: 100, height: 12, color: rgb(0.9, 0.9, 0.9)
  });
  page1.drawText('EJE DE FORMACIÓN', {
    x: 44, y: 541, size: 7, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2)
  });
  page1.drawText('Profesional', {
    x: 44, y: 520, size: 8, font: fontHelvetica, color: rgb(0, 0, 0)
  });

  page1.drawRectangle({
    x: 140, y: 460, width: 432, height: 90, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1
  });
  page1.drawRectangle({
    x: 140, y: 538, width: 432, height: 12, color: rgb(0.9, 0.9, 0.9)
  });
  page1.drawText('OBJETIVO GENERAL', {
    x: 144, y: 541, size: 7, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2)
  });

  // Dividir objetivo general en líneas
  const lineasObj = wrapText(params.objetivoGeneral || '(Sin especificar)', 422, fontHelvetica, 7.5);
  let objY = 522;
  for (const linea of lineasObj) {
    if (objY >= 465) {
      page1.drawText(linea, {
        x: 144, y: objY, size: 7.5, font: fontHelvetica, color: rgb(0, 0, 0)
      });
      objY -= 10;
    }
  }
  
  // Sección de Ponderaciones
  page1.drawText('1. CRITERIOS DE EVALUACIÓN', {
    x: 40, y: 435, size: 10, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });
  
  page1.drawText('La calificación final del ciclo se compone de la siguiente forma:', {
    x: 40, y: 420, size: 8.5, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2)
  });
  
  const drawBullet = (p: typeof page1, x: number, y: number, text: string, boldText?: string) => {
    p.drawCircle({ x: x + 3, y: y + 2.5, radius: 2, color: rgb(0.1, 0.2, 0.4) });
    if (boldText) {
      p.drawText(boldText, { x: x + 12, y, size: 8.5, font: fontHelveticaBold, color: rgb(0, 0, 0) });
      const offset = fontHelveticaBold.widthOfTextAtSize(boldText, 8.5) + 14;
      p.drawText(text, { x: x + offset, y, size: 8.5, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
    } else {
      p.drawText(text, { x: x + 12, y, size: 8.5, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
    }
  };
  
  drawBullet(page1, 50, 400, 'Exámenes parciales y global (50% de la nota final).', 'Exámenes (50%):');
  drawBullet(page1, 70, 386, 'Primer Parcial: 20% del bloque de exámenes.', '-');
  drawBullet(page1, 70, 372, 'Segundo Parcial: 20% del bloque de exámenes.', '-');
  drawBullet(page1, 70, 358, 'Examen Global: 60% del bloque de exámenes (proporción 20/20/60).', '-');
  
  drawBullet(page1, 50, 338, 'Evaluación formativa y sumativa por parcial.', 'Evaluación Continua (50%):');
  drawBullet(page1, 70, 324, 'Evaluación Continua de cada parcial equivale a tareas y ejercicios (50%).', '-');
  drawBullet(page1, 70, 310, 'El Examen del parcial equivale a 60% examen escrito y 40% práctica/proyecto (50%).', '-');
  
  // Sección de Asistencias
  page1.drawText('2. POLÍTICA DE ASISTENCIA Y TOLERANCIA', {
    x: 40, y: 285, size: 10, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });
  
  drawBullet(page1, 50, 268, 'Límite de inasistencias: Los alumnos tienen permitido un límite de 3 faltas injustificadas.');
  drawBullet(page1, 50, 254, 'Pérdida de derechos: La 4ª inasistencia causa la pérdida automática del derecho a examen parcial y global.');
  drawBullet(page1, 50, 240, 'Tolerancia de ingreso: No existen retardos. La tolerancia es de 10 minutos para incorporarse a su clase.');
  drawBullet(page1, 50, 226, 'Justificantes: Solo se justifican inasistencias por salud de dependencias públicas (límite: 1 por bimestre).');
  
  // Sección de Redondeo
  page1.drawText('3. CRITERIOS DE REDONDEO INSTITUCIONAL', {
    x: 40, y: 200, size: 10, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });
  
  drawBullet(page1, 50, 183, 'Notas Aprobatorias (>= 6.0): Redondeo estándar al entero inmediato (ej: 6.5 -> 7, 6.4 -> 6).');
  drawBullet(page1, 50, 169, 'Notas Reprobatorias (< 6.0): Truncamiento estricto hacia abajo (ej: 5.9 -> 5, 5.4 -> 5).');
  
  page1.drawText('Ejemplos de redondeo del CUH:', {
    x: 50, y: 148, size: 8.5, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2)
  });
  page1.drawText('6.5  ===>  7            6.4  ===>  6            5.9  ===>  5            5.4  ===>  5', {
    x: 70, y: 132, size: 8.5, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });

  // Pie de página 1 - Declaración
  page1.drawRectangle({
    x: 40, y: 65, width: 532, height: 50,
    color: rgb(0.96, 0.96, 0.96), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1
  });
  page1.drawText('Declaración de Conformidad:', {
    x: 48, y: 102, size: 8, font: fontHelveticaBold, color: rgb(0, 0, 0)
  });
  page1.drawText('Al firmar digitalmente este documento de encuadre mediante el enlace único enviado a tu correo institucional', {
    x: 48, y: 90, size: 7.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3)
  });
  page1.drawText('@cuh.mx, confirmas estar de acuerdo con las ponderaciones y el reglamento académico de la asignatura.', {
    x: 48, y: 80, size: 7.5, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3)
  });
  
  page1.drawText('Página 1 de 2', {
    x: 500, y: 35, size: 7.5, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5)
  });
  
  // ─── PÁGINA 2: HOJA DE FIRMAS ──────────────────────────────────────────────
  const page2 = doc.addPage([612, 792]);
  
  page2.drawText('4. REGISTRO DE CONFORMIDAD Y FIRMAS DIGITALES', {
    x: 40, y: 740, size: 12, font: fontHelveticaBold, color: rgb(0.1, 0.2, 0.4)
  });
  page2.drawText(`Asignatura: ${params.asignatura} | Ciclo: ${params.cicloLectivo}`, {
    x: 40, y: 720, size: 9, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4)
  });
  
  // Tabla de Firmas
  // Cabecera de la tabla
  const tableY = 670;
  const drawTableHeader = () => {
    page2.drawRectangle({
      x: 40, y: tableY, width: 532, height: 20,
      color: rgb(0.1, 0.2, 0.4)
    });
    page2.drawText('ROL', { x: 45, y: tableY + 6, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1) });
    page2.drawText('NOMBRE', { x: 100, y: tableY + 6, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1) });
    page2.drawText('CORREO INSTITUCIONAL', { x: 280, y: tableY + 6, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1) });
    page2.drawText('ESTADO', { x: 420, y: tableY + 6, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1) });
    page2.drawText('FIRMA DIGITAL / IP / HASH', { x: 480, y: tableY + 6, size: 8, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  };
  drawTableHeader();
  
  // Dibujar renglón del Docente (Fila 0)
  const drawRow = (idx: number, rol: string, nombre: string, correo: string) => {
    const rowY = tableY - 25 - idx * 25;
    // Fondo alternado
    page2.drawRectangle({
      x: 40, y: rowY, width: 532, height: 25,
      color: idx % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5
    });
    
    page2.drawText(rol, { x: 45, y: rowY + 8, size: 8, font: fontHelveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page2.drawText(nombre.substring(0, 30), { x: 100, y: rowY + 8, size: 8, font: fontHelvetica, color: rgb(0, 0, 0) });
    page2.drawText(correo, { x: 280, y: rowY + 8, size: 8, font: fontHelvetica, color: rgb(0.4, 0.4, 0.4) });
    page2.drawText('PENDIENTE', { x: 420, y: rowY + 8, size: 8, font: fontHelveticaBold, color: rgb(0.7, 0.1, 0.1) });
    page2.drawText('Esperando firma...', { x: 480, y: rowY + 8, size: 7, font: fontHelvetica, color: rgb(0.6, 0.6, 0.6) });
  };
  
  // Dibujar Docente
  drawRow(0, 'CATEDRÁTICO', params.docenteNombre, `${params.docenteNombre.toLowerCase().replace(/\s+/g, '')}@cuh.mx`);
  
  // Dibujar Alumnos
  for (let i = 0; i < params.alumnos.length; i++) {
    const alumno = params.alumnos[i];
    if (alumno) {
      drawRow(i + 1, 'ALUMNO', alumno.nombreCompleto, alumno.correo || `${alumno.matricula}@cuh.mx`);
    }
  }
  
  page2.drawText('Página 2 de 2', {
    x: 500, y: 40, size: 8, font: fontHelvetica, color: rgb(0.5, 0.5, 0.5)
  });
  
  return Buffer.from(await doc.save());
}

/**
 * Estampa la firma digital de un usuario en el PDF del encuadre en su fila correspondiente.
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
    alumnoIndex?: number; // Índice del alumno en el array original (0-based)
  }
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const pages = doc.getPages();
  const page2 = pages[1]; // Página 2 es la de firmas
  if (!page2) {
    throw new Error('El PDF del encuadre no tiene la estructura de páginas esperada');
  }
  
  const fontHelveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontHelvetica = await doc.embedFont(StandardFonts.Helvetica);
  
  // Calcular la fila Y en base al índice
  // Fila 0 es el Docente, Fila 1+ es el Alumno con índice 0+
  const idx = opts.rol === 'docente' ? 0 : (opts.alumnoIndex ?? 0) + 1;
  const tableY = 670;
  const rowY = tableY - 25 - idx * 25;
  
  // Borrar el estado "PENDIENTE" y "Esperando firma..." dibujando un pequeño rectángulo blanco encima
  page2.drawRectangle({
    x: 418, y: rowY + 2, width: 150, height: 20,
    color: idx % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1)
  });
  
  // Dibujar estado "FIRMADO"
  page2.drawText('FIRMADO', {
    x: 420, y: rowY + 8, size: 8, font: fontHelveticaBold, color: rgb(0.1, 0.5, 0.2)
  });
  
  // Dibujar detalles de la firma
  const fechaStr = opts.fecha.toISOString().split('T')[0];
  const firmaText = `FECHA: ${fechaStr} | IP: ${opts.ip} | ID: ${opts.hash}`;
  page2.drawText(firmaText, {
    x: 480, y: rowY + 8, size: 6.5, font: fontHelvetica, color: rgb(0, 0, 0)
  });
  
  return Buffer.from(await doc.save());
}
