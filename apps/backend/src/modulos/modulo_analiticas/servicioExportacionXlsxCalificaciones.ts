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
  tipoExamen?: 'parcial' | 'global' | 'extraordinario';
  plantillaTitulo?: string;
  calificacionExamenFinalTexto?: string;
  evaluacionContinuaTexto?: string;
  proyectoTexto?: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
  createdAt?: Date | string;
};

type ListaAcademicaExportacion = {
  alumnoId?: string;
  examenPrimerParcialLista?: string;
  tareasYEjercicios2doParcial?: string;
  practica2doParcial?: string;
  examen2doParcial?: string;
  calificacionSegundoParcial?: string;
  examenGlobalLista?: string;
  continuaTercerParcialLista?: string;
  calificacionTercerParcial?: string;
  bonoExtracurricular?: string;
  bonoExtracurricularSolicitado?: string;
};

type OpcionesLibro = {
  docenteNombre: string;
  nombrePeriodo: string;
  cicloLectivo: string;
  alumnos: AlumnoFila[];
  calificaciones: CalificacionFila[];
  listaAcademica?: ListaAcademicaExportacion[];
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
  const parcialesSinCorte = parciales.filter((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === null);
  const parcial1 =
    parciales.filter((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'parcial1').slice(-1)[0] ??
    parcialesSinCorte[0];
  const parcial2 =
    parciales.filter((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'parcial2').slice(-1)[0] ??
    parcialesSinCorte.find((r) => r !== parcial1);
  const globales = registros.filter((r) => resolverCorteExamen(r.tipoExamen, r.plantillaTitulo) === 'global');

  return {
    parcial1,
    parcial2,
    global: globales.slice(-1)[0]
  };
}

export async function generarXlsxCalificacionesProduccion(opts: OpcionesLibro): Promise<Buffer> {
  const wb = new Workbook();
  await wb.xlsx.readFile(obtenerRutaPlantilla());
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.getWorksheet('LIBRO DE CALIFICACIONES');
  if (!ws) {
    throw new Error('Plantilla XLSX invalida: falta hoja LIBRO DE CALIFICACIONES');
  }

  ws.getCell('C6').value = `👨🏽‍🏫 Docente: ${opts.docenteNombre}`;
  ws.getCell('C7').value = opts.nombrePeriodo;
  ws.getCell('C8').value = opts.cicloLectivo;
  ws.getCell('BB10').value = 'Bono extracurricular';
  ws.getCell('BB10').style = { ...ws.getCell('BA10').style };
  ws.getColumn('BB').width = 19;

  const alumnosOrdenados = [...opts.alumnos].sort((a, b) =>
    String(a.nombreCompleto ?? '').localeCompare(String(b.nombreCompleto ?? ''), 'es-MX')
  );
  const listaPorAlumno = new Map((opts.listaAcademica ?? []).map((fila) => [String(fila.alumnoId ?? ''), fila]));

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
    const fisica = listaPorAlumno.get(String(alumno._id));

    const p1Eval = numeroSeguro(grupo.parcial1?.evaluacionContinuaTexto);
    const p1Exam = numeroSeguro(fisica?.examenPrimerParcialLista) ?? numeroSeguro(grupo.parcial1?.calificacionExamenFinalTexto);
    const p1Total = numeroSeguro(grupo.parcial1?.calificacionParcialTexto);

    const gExam = numeroSeguro(grupo.global?.calificacionExamenFinalTexto);
    const gProyecto = numeroSeguro(grupo.global?.proyectoTexto);
    const gTotal = numeroSeguro(grupo.global?.calificacionGlobalTexto);
    const examenGlobalLista = fisica?.examenGlobalLista?.trim()
      ? numeroSeguro(fisica.examenGlobalLista)
      : gExam;
    const continuaTercerParcialLista = fisica?.continuaTercerParcialLista?.trim()
      ? numeroSeguro(fisica.continuaTercerParcialLista)
      : gProyecto;
    const bonoAplicado = Math.min(0.5, Math.max(0, numeroSeguro(fisica?.bonoExtracurricular) ?? 0));
    const totalTercerParcialRegistrado = fisica?.calificacionTercerParcial?.trim()
      ? numeroSeguro(fisica.calificacionTercerParcial)
      : undefined;
    const globalBaseExportado = bonoAplicado > 0
      ? gTotal ?? (examenGlobalLista !== undefined && continuaTercerParcialLista !== undefined
        ? Math.min(10, examenGlobalLista + continuaTercerParcialLista)
        : undefined)
      : undefined;
    const totalTercerParcial = totalTercerParcialRegistrado
      ?? (globalBaseExportado !== undefined ? Math.min(10, globalBaseExportado + bonoAplicado) : undefined)
      ?? gTotal;

    ws.getCell(`B${fila}`).value = i + 1;
    ws.getCell(`C${fila}`).value = toUpperOrEmpty(alumno.nombreCompleto);
    ws.getCell(`D${fila}`).value = toUpperOrEmpty(alumno.matricula);
    ws.getCell(`E${fila}`).value = toUpperOrEmpty(alumno.correo || `${String(alumno.matricula ?? '').trim()}@cuh.mx`);

    // Columna de insumos continuos/parciales: se conserva blanca si no existe ese dato historico.
    setNumeroOBlanco(ws, `AL${fila}`, p1Eval);
    setNumeroOBlanco(ws, `AM${fila}`, p1Exam);
    if (typeof p1Total === 'number') {
      setNumeroOBlanco(ws, `AN${fila}`, Math.max(0, Math.min(10, p1Total)));
    } else {
      setFormula(ws, `AN${fila}`, `IF(COUNT(AL${fila},AM${fila})<2,"",MIN(10,MAX(0,SUM(AL${fila},AM${fila}))))`);
    }
    setNumeroOBlanco(ws, `BB${fila}`, bonoAplicado > 0 ? bonoAplicado : undefined);

    // Columnas físicas autorizadas: tareas Classroom ponderadas por puntos,
    // práctica y examen manuales; OMR permanece como referencia separada en la consulta.
    setNumeroOBlanco(ws, `AO${fila}`, numeroSeguro(fisica?.tareasYEjercicios2doParcial));
    setNumeroOBlanco(ws, `AP${fila}`, numeroSeguro(fisica?.practica2doParcial));
    setFormula(ws, `AQ${fila}`, `IF(COUNT(AO${fila},AP${fila})<2,"",((AO${fila}*0.6+AP${fila}*0.4)/2))`);
    setNumeroOBlanco(ws, `AR${fila}`, numeroSeguro(fisica?.examen2doParcial));
    setFormula(ws, `AS${fila}`, `IF(COUNT(AQ${fila},AR${fila})<2,"",MIN(10,MAX(0,SUM(AQ${fila},AR${fila}))))`);

    setNumeroOBlanco(ws, `AT${fila}`, examenGlobalLista);
    setNumeroOBlanco(ws, `AU${fila}`, continuaTercerParcialLista);
    if (typeof totalTercerParcial === 'number') {
      setNumeroOBlanco(ws, `AV${fila}`, Math.max(0, Math.min(10, totalTercerParcial)));
    } else {
      setFormula(ws, `AV${fila}`, `IF(COUNT(AT${fila},AU${fila})<2,"",MIN(10,MAX(0,SUM(AT${fila},AU${fila}))))`);
    }

    // Formulas de cierre del libro productivo (ponderaciones y base 10).
    setFormula(ws, `AW${fila}`, `IF(ISNUMBER(AV${fila}),(AV${fila}*5/10)*60/5,"")`);
    setFormula(ws, `AX${fila}`, `IF(COUNT(AN${fila},AS${fila})<2,"",(AN${fila}*5)/10+(AS${fila}*5)/10)`);
    setFormula(ws, `AY${fila}`, `IF(ISNUMBER(AX${fila}),(AX${fila}*5/10)*40/5,"")`);
    setFormula(ws, `AZ${fila}`, `IF(COUNT(AW${fila},AY${fila})<2,"",AW${fila}+AY${fila})`);
    setFormula(ws, `BA${fila}`, `IF(ISNUMBER(AZ${fila}),AZ${fila}*0.1,"")`);
  }

  // Limpia filas base sobrantes cuando el grupo real es menor al de la plantilla.
  for (let i = alumnosOrdenados.length; i < filasBase; i++) {
    const fila = filaInicio + i;
    for (const col of ['B', 'C', 'D', 'E', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB']) {
      ws.getCell(`${col}${fila}`).value = null;
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
