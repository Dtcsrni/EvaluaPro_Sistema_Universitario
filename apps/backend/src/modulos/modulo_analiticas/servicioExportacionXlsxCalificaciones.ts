/**
 * Exportacion XLSX de calificaciones con formato 1:1 de plantilla productiva.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { resolverCorteExamen } from './servicioListaAcademica.js';

const { Workbook } = ExcelJS;
type Worksheet = ExcelJS.Worksheet;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AlumnoFila = {
  _id: unknown;
  matricula?: string;
  nombreCompleto?: string;
  correo?: string;
};

type CalificacionFila = {
  alumnoId: unknown;
  tipoExamen?: 'parcial' | 'global';
  plantillaTitulo?: string;
  calificacionExamenFinalTexto?: string;
  evaluacionContinuaTexto?: string;
  proyectoTexto?: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
  createdAt?: Date | string;
};

type CapturaFisicaParcial2 = {
  tareasEjerciciosParcial2: string;
  practicaParcial2: string;
  calificacionExamenConBonoParcial2: string;
};

type OpcionesLibro = {
  docenteNombre: string;
  nombrePeriodo: string;
  cicloLectivo: string;
  alumnos: AlumnoFila[];
  calificaciones: CalificacionFila[];
  calificacionesFisicasParcial2?: Record<string, CapturaFisicaParcial2>;
};

const NOMBRE_PLANTILLA = 'LIBRO_CALIFICACIONES_PRODUCCION_BASE_SANITIZADA.xlsx';

function obtenerRutaPlantilla(): string {
  const candidatos = [
    path.resolve(process.cwd(), 'apps/backend/src/modulos/modulo_analiticas/plantillas', NOMBRE_PLANTILLA),
    path.resolve(process.cwd(), 'src/modulos/modulo_analiticas/plantillas', NOMBRE_PLANTILLA),
    path.resolve(__dirname, 'plantillas', NOMBRE_PLANTILLA),
    path.resolve(__dirname, '../../../../src/modulos/modulo_analiticas/plantillas', NOMBRE_PLANTILLA)
  ];
  const encontrada = candidatos.find((candidato) => fs.existsSync(candidato));
  if (!encontrada) {
    throw new Error(`Plantilla XLSX no encontrada: ${NOMBRE_PLANTILLA}; rutas revisadas: ${candidatos.join(' | ')}`);
  }
  return encontrada;
}

function numeroSeguro(valor: unknown): number | undefined {
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

function toUpperOrEmpty(valor: unknown): string {
  const texto = String(valor ?? '').trim();
  return texto ? texto.toUpperCase() : '';
}

function setNumeroOBlanco(ws: Worksheet, ref: string, valor?: number) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    ws.getCell(ref).value = valor;
  } else {
    ws.getCell(ref).value = null;
  }
}

function setFormula(ws: Worksheet, ref: string, formula: string) {
  ws.getCell(ref).value = { formula, date1904: false };
}

function porAlumno(calificaciones: CalificacionFila[], alumnoId: string) {
  const registros = calificaciones
    .filter((c) => String(c.alumnoId) === alumnoId)
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());

  const parciales = registros.filter((r) => r.tipoExamen === 'parcial');
  const parcial1 = parciales.find((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'parcial1')
    ?? parciales.find((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === null);
  const parcial2 = parciales.find((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'parcial2')
    ?? parciales.find((r) => r !== parcial1 && resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === null);
  const globales = registros.filter((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'global');

  return {
    parcial1,
    parcial2,
    global: globales[globales.length - 1]
  };
}

export async function generarXlsxCalificacionesProduccion(opts: OpcionesLibro): Promise<Buffer> {
  const wb = new Workbook();
  await wb.xlsx.readFile(obtenerRutaPlantilla());

  const ws = wb.getWorksheet('LIBRO DE CALIFICACIONES');
  if (!ws) {
    throw new Error('Plantilla XLSX invalida: falta hoja LIBRO DE CALIFICACIONES');
  }

  ws.getCell('C6').value = `👨🏽‍🏫 Docente: ${opts.docenteNombre}`;
  ws.getCell('C7').value = opts.nombrePeriodo;
  ws.getCell('C8').value = opts.cicloLectivo;

  const alumnosOrdenados = [...opts.alumnos].sort((a, b) =>
    String(a.nombreCompleto ?? '').localeCompare(String(b.nombreCompleto ?? ''), 'es-MX')
  );

  const filaInicio = 11;
  const filasBase = 8; // plantilla productiva contiene 8 renglones iniciales (11..18)
  const extras = Math.max(0, alumnosOrdenados.length - filasBase);
  if (extras > 0) {
    ws.duplicateRow(18, extras, true);
  }

  for (let i = 0; i < alumnosOrdenados.length; i++) {
    const fila = filaInicio + i;
    const alumno = alumnosOrdenados[i];
    const grupo = porAlumno(opts.calificaciones, String(alumno._id));

    const p1Eval = numeroSeguro(grupo.parcial1?.evaluacionContinuaTexto);
    const p1Exam = numeroSeguro(grupo.parcial1?.calificacionExamenFinalTexto);
    const p1Total = numeroSeguro(grupo.parcial1?.calificacionParcialTexto);

    const capturaFisica = opts.calificacionesFisicasParcial2?.[String(alumno._id)];
    const tareasParcial2 = numeroSeguro(capturaFisica?.tareasEjerciciosParcial2);
    const practicaParcial2 = numeroSeguro(capturaFisica?.practicaParcial2);
    const examenManualParcial2 = numeroSeguro(capturaFisica?.calificacionExamenConBonoParcial2);

    const gExam = numeroSeguro(grupo.global?.calificacionExamenFinalTexto);
    const gProyecto = numeroSeguro(grupo.global?.proyectoTexto);
    const gTotal = numeroSeguro(grupo.global?.calificacionGlobalTexto);

    ws.getCell(`B${fila}`).value = i + 1;
    ws.getCell(`C${fila}`).value = toUpperOrEmpty(alumno.nombreCompleto);
    ws.getCell(`D${fila}`).value = toUpperOrEmpty(alumno.matricula);
    ws.getCell(`E${fila}`).value = toUpperOrEmpty(alumno.correo || `${String(alumno.matricula ?? '').trim()}@cuh.mx`);

    // Columna de insumos continuos/parciales: se conserva blanca si no existe ese dato historico.
    setNumeroOBlanco(ws, `AL${fila}`, p1Eval);
    setNumeroOBlanco(ws, `AM${fila}`, p1Exam);
    if (typeof p1Total === 'number') {
      setNumeroOBlanco(ws, `AN${fila}`, p1Total);
    } else {
      setFormula(ws, `AN${fila}`, `AL${fila}+AM${fila}`);
    }

    setNumeroOBlanco(ws, `AO${fila}`, tareasParcial2);
    // La práctica y el examen impreso son captura manual; no se sustituyen por OMR.
    setNumeroOBlanco(ws, `AP${fila}`, practicaParcial2);
    setFormula(ws, `AQ${fila}`, `IF(COUNT(AO${fila}:AP${fila})<2,"",(AO${fila}*0.6+AP${fila}*0.4)/2)`);
    setNumeroOBlanco(ws, `AR${fila}`, examenManualParcial2);
    setFormula(ws, `AS${fila}`, `IF(COUNT(AQ${fila}:AR${fila})<2,"",AQ${fila}+AR${fila})`);

    setNumeroOBlanco(ws, `AT${fila}`, gExam);
    setNumeroOBlanco(ws, `AU${fila}`, gProyecto);
    if (typeof gTotal === 'number') {
      setNumeroOBlanco(ws, `AV${fila}`, gTotal);
    } else {
      setFormula(ws, `AV${fila}`, `AT${fila}+AU${fila}`);
    }

    // Formulas de cierre del libro productivo (ponderaciones y base 10).
    setFormula(ws, `AW${fila}`, `(AV${fila}*5/10)*60/5`);
    setFormula(ws, `AX${fila}`, `(AN${fila}*5)/10+(AS${fila}*5)/10`);
    setFormula(ws, `AY${fila}`, `(AX${fila}*5/10)*40/5`);
    setFormula(ws, `AZ${fila}`, `AW${fila}+AY${fila}`);
    setFormula(ws, `BA${fila}`, `AZ${fila}*0.1`);
  }

  // Limpia filas base sobrantes cuando el grupo real es menor al de la plantilla.
  for (let i = alumnosOrdenados.length; i < filasBase; i++) {
    const fila = filaInicio + i;
    for (const col of ['B', 'C', 'D', 'E', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA']) {
      ws.getCell(`${col}${fila}`).value = null;
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
