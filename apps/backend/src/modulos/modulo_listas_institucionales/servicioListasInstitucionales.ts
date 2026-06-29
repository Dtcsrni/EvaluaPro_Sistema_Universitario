/**
 * Servicio de listas institucionales por plantilla.
 *
 * Responsabilidad: generar salidas institucionales reutilizables a partir de
 * datos normalizados del sistema.
 * Limites: no importa datos; consume alumnos/periodos ya persistidos.
 */
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';

export type FormatoListaInstitucional = 'xlsx' | 'pdf';

export type PlantillaInstitucional = {
  id: string;
  nombre: string;
  institucion: string;
  tipo: 'asistencia';
  version: string;
  archivoPlantilla: string;
  formatos: FormatoListaInstitucional[];
};

type AlumnoLista = {
  matricula: string;
  nombreCompleto: string;
  grupo?: string | null;
};

const PLANTILLAS: PlantillaInstitucional[] = [
  {
    id: 'asistencia_cuh_control',
    nombre: 'CUH - Control de asistencias',
    institucion: 'Centro Universitario Hidalguense A.C.',
    tipo: 'asistencia',
    version: '1.0.0',
    archivoPlantilla: 'templates/listas/cuh-control-asistencias.xlsx',
    formatos: ['xlsx', 'pdf']
  }
];

const BORDE_FINO = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const }
};

const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFEFEFEF' } };

function texto(valor: unknown) {
  return String(valor ?? '').trim();
}

function obtenerPlantilla(templateId: string) {
  const plantilla = PLANTILLAS.find((item) => item.id === templateId);
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_LISTA_NO_ENCONTRADA', 'Plantilla institucional no encontrada', 404);
  }
  return plantilla;
}

export function listarPlantillasInstitucionales() {
  return PLANTILLAS;
}

async function obtenerDatosPeriodo(docenteId: string, periodoId: string) {
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId } });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  const alumnos = await prisma.alumno.findMany({
    where: { periodoId, activo: true },
    orderBy: [{ nombreCompleto: 'asc' }, { matricula: 'asc' }]
  });

  return {
    periodo,
    alumnos: alumnos.map((alumno) => ({
      matricula: texto(alumno.matricula),
      nombreCompleto: texto(alumno.nombreCompleto),
      grupo: alumno.grupo
    }))
  };
}

function configurarPagina(ws: ExcelJS.Worksheet) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.25,
      bottom: 0.25,
      header: 0,
      footer: 0
    }
  };
  ws.views = [{ showGridLines: false }];
  for (let col = 1; col <= 52; col += 1) {
    ws.getColumn(col).width = col === 1 ? 5 : col === 2 ? 28 : 4;
  }
  for (let row = 1; row <= 32; row += 1) {
    ws.getRow(row).height = row <= 4 ? 18 : row <= 21 ? 25 : 18;
  }
}

function mergeSeguro(ws: ExcelJS.Worksheet, rango: string) {
  try {
    ws.mergeCells(rango);
  } catch {
    // ExcelJS lanza si el rango ya fue combinado; el generador es idempotente por workbook nuevo.
  }
}

function aplicarCelda(
  ws: ExcelJS.Worksheet,
  ref: string,
  valor: string | number,
  opts?: { bold?: boolean; size?: number; vertical?: boolean; fill?: boolean; align?: Partial<ExcelJS.Alignment> }
) {
  const cell = ws.getCell(ref);
  cell.value = valor;
  cell.border = BORDE_FINO;
  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
    textRotation: opts?.vertical ? 90 : 0,
    ...opts?.align
  };
  cell.font = { name: 'Arial', size: opts?.size ?? 8, bold: Boolean(opts?.bold) };
  if (opts?.fill) cell.fill = HEADER_FILL;
}

function aplicarRangoBorde(ws: ExcelJS.Worksheet, filaInicio: number, filaFin: number, colInicio: number, colFin: number) {
  for (let row = filaInicio; row <= filaFin; row += 1) {
    for (let col = colInicio; col <= colFin; col += 1) {
      const cell = ws.getCell(row, col);
      cell.border = BORDE_FINO;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { name: 'Arial', size: 7 };
    }
  }
}

function dibujarBloqueFechas(ws: ExcelJS.Worksheet, colInicio: number, colFin: number) {
  mergeSeguro(ws, `${ws.getColumn(colInicio).letter}4:${ws.getColumn(colFin).letter}4`);
  aplicarCelda(ws, `${ws.getColumn(colInicio).letter}4`, 'FECHAS', { bold: true, size: 9, fill: true });
  aplicarRangoBorde(ws, 5, 21, colInicio, colFin);
  const conceptos = [
    'A I R O T A M U S',
    'NO ACUMULAN',
    'NEMAXE 1',
    'ODATUSER',
    'LA OICRAP'
  ];
  for (let col = colInicio; col <= colFin; col += 1) {
    const offset = (col - colInicio) % 6;
    if (offset >= 1 && offset <= 5) {
      aplicarCelda(ws, `${ws.getColumn(col).letter}5`, conceptos[offset - 1], { vertical: true, fill: offset === 1 });
    }
  }
}

function llenarAlumnos(ws: ExcelJS.Worksheet, alumnos: AlumnoLista[]) {
  const maxAlumnos = 8;
  for (let i = 0; i < Math.min(alumnos.length, maxAlumnos); i += 1) {
    const row = 6 + i * 2;
    const alumno = alumnos[i];
    mergeSeguro(ws, `A${row}:A${row + 1}`);
    aplicarCelda(ws, `A${row}`, i + 1, { bold: true });
    aplicarCelda(ws, `B${row}`, alumno.nombreCompleto, {
      bold: true,
      align: { horizontal: 'left', vertical: 'middle', wrapText: true }
    });
    aplicarCelda(ws, `B${row + 1}`, alumno.matricula, {
      align: { horizontal: 'left', vertical: 'middle', wrapText: true }
    });
  }
}

function construirWorkbookCuh(params: { materia: string; grupo: string; alumnos: AlumnoLista[] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EvaluaPro';
  wb.created = new Date();
  const ws = wb.addWorksheet('CONTROL DE ASISTENCIAS');
  configurarPagina(ws);

  mergeSeguro(ws, 'A1:AZ1');
  aplicarCelda(ws, 'A1', 'Centro Universitario Hidalguense A.C.', { bold: true, size: 14, align: { horizontal: 'center' } });
  mergeSeguro(ws, 'A2:AZ2');
  aplicarCelda(ws, 'A2', 'CONTROL DE ASISTENCIAS', { bold: true, size: 11 });
  mergeSeguro(ws, 'A3:B5');
  aplicarCelda(ws, 'A3', 'NO', { bold: true });
  aplicarCelda(ws, 'B3', 'NOMBRE DEL ALUMNO', { bold: true, size: 9 });
  aplicarCelda(ws, 'C3', `MATERIA: ${params.materia}`, { align: { horizontal: 'left' } });
  mergeSeguro(ws, 'C3:S3');
  aplicarCelda(ws, 'C4', `GRUPO: ${params.grupo || '-'}`, { align: { horizontal: 'left' } });
  mergeSeguro(ws, 'C4:S4');
  aplicarRangoBorde(ws, 5, 21, 1, 52);

  dibujarBloqueFechas(ws, 3, 19);
  dibujarBloqueFechas(ws, 20, 37);
  dibujarBloqueFechas(ws, 38, 52);
  llenarAlumnos(ws, params.alumnos);

  mergeSeguro(ws, 'A22:AZ22');
  aplicarCelda(ws, 'A22', 'Nota: La presente lista es definitiva y por ningún motivo podrán agregarse más alumnos.', {
    bold: true,
    size: 9
  });
  mergeSeguro(ws, 'A30:Q30');
  mergeSeguro(ws, 'R30:AH30');
  mergeSeguro(ws, 'AI30:AZ30');
  aplicarCelda(ws, 'A30', 'NOMBRE Y FIRMA DEL CATEDRATICO', { bold: true, size: 9 });
  aplicarCelda(ws, 'R30', 'NOMBRE Y FIRMA DEL COORDINADOR', { bold: true, size: 9 });
  aplicarCelda(ws, 'AI30', 'NOMBRE Y FIRMA DE QUIEN RECIBE', { bold: true, size: 9 });
  ws.getCell('AZ32').value = '2023ISCMT24';
  ws.getCell('AZ32').font = { name: 'Arial', size: 6 };
  return wb;
}

export async function generarListaInstitucionalXlsx(params: { docenteId: string; periodoId: string; templateId: string }) {
  obtenerPlantilla(params.templateId);
  const { periodo, alumnos } = await obtenerDatosPeriodo(params.docenteId, params.periodoId);
  const grupos = Array.from(new Set(alumnos.map((a) => texto(a.grupo)).filter(Boolean)));
  const wb = construirWorkbookCuh({
    materia: texto(periodo.nombre),
    grupo: grupos.join(', '),
    alumnos
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function generarListaInstitucionalPdf(params: { docenteId: string; periodoId: string; templateId: string }) {
  obtenerPlantilla(params.templateId);
  const { periodo, alumnos } = await obtenerDatosPeriodo(params.docenteId, params.periodoId);
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  page.drawText('Centro Universitario Hidalguense A.C.', { x: 245, y: 575, size: 16, font: bold, color: black });
  page.drawText('CONTROL DE ASISTENCIAS', { x: 315, y: 555, size: 11, font: bold, color: black });
  page.drawText(`Materia: ${texto(periodo.nombre)}`, { x: 40, y: 532, size: 8, font, color: black });

  const left = 30;
  const top = 510;
  const rowH = 18;
  const colNo = 25;
  const colAlumno = 210;
  page.drawRectangle({ x: left, y: top - rowH, width: colNo, height: rowH, borderColor: black, borderWidth: 0.7 });
  page.drawRectangle({ x: left + colNo, y: top - rowH, width: colAlumno, height: rowH, borderColor: black, borderWidth: 0.7 });
  page.drawText('NO', { x: left + 7, y: top - 12, size: 7, font: bold });
  page.drawText('NOMBRE DEL ALUMNO', { x: left + colNo + 55, y: top - 12, size: 7, font: bold });

  const bloques = [
    { x: left + colNo + colAlumno, w: 160 },
    { x: left + colNo + colAlumno + 160, w: 180 },
    { x: left + colNo + colAlumno + 340, w: 180 }
  ];
  for (const bloque of bloques) {
    page.drawRectangle({ x: bloque.x, y: top - rowH, width: bloque.w, height: rowH, borderColor: black, borderWidth: 0.7 });
    page.drawText('FECHAS', { x: bloque.x + bloque.w / 2 - 15, y: top - 12, size: 7, font: bold });
  }

  alumnos.slice(0, 16).forEach((alumno, index) => {
    const y = top - rowH * (index + 2);
    page.drawRectangle({ x: left, y, width: colNo, height: rowH, borderColor: black, borderWidth: 0.7 });
    page.drawRectangle({ x: left + colNo, y, width: colAlumno, height: rowH, borderColor: black, borderWidth: 0.7 });
    page.drawText(String(index + 1), { x: left + 9, y: y + 6, size: 7, font });
    page.drawText(alumno.nombreCompleto.slice(0, 38), { x: left + colNo + 4, y: y + 9, size: 6.5, font: bold });
    page.drawText(alumno.matricula.slice(0, 26), { x: left + colNo + 4, y: y + 2, size: 6, font });
    for (const bloque of bloques) {
      page.drawRectangle({ x: bloque.x, y, width: bloque.w, height: rowH, borderColor: black, borderWidth: 0.7 });
    }
  });

  page.drawText('Nota: La presente lista es definitiva y por ningún motivo podrán agregarse más alumnos.', {
    x: 165,
    y: 190,
    size: 9,
    font: bold
  });
  page.drawLine({ start: { x: 80, y: 60 }, end: { x: 250, y: 60 }, thickness: 0.8, color: black });
  page.drawLine({ start: { x: 310, y: 60 }, end: { x: 500, y: 60 }, thickness: 0.8, color: black });
  page.drawLine({ start: { x: 560, y: 60 }, end: { x: 740, y: 60 }, thickness: 0.8, color: black });
  page.drawText('NOMBRE Y FIRMA DEL CATEDRATICO', { x: 92, y: 45, size: 8, font: bold });
  page.drawText('NOMBRE Y FIRMA DEL COORDINADOR', { x: 325, y: 45, size: 8, font: bold });
  page.drawText('NOMBRE Y FIRMA DE QUIEN RECIBE', { x: 580, y: 45, size: 8, font: bold });

  return Buffer.from(await doc.save());
}
