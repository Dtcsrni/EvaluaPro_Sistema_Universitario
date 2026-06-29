/**
 * Servicio de hidratacion de cursos iniciados.
 *
 * Responsabilidad: analizar archivos XLSX/DOCX existentes y aplicar imports
 * idempotentes de alumnos/evidencias para preparar examenes globales.
 */
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';

export type ArchivoHidratacion = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type ColumnaDetectada = {
  indice: number;
  letra: string;
  titulo: string;
  rol: 'nombre' | 'matricula' | 'correo' | 'grupo' | 'calificacion' | 'ignorar';
};

type AlumnoDetectado = {
  fila: number;
  nombreCompleto: string;
  matricula: string;
  correo: string;
  grupo?: string;
  calificaciones: Array<{
    columna: string;
    titulo: string;
    valor: number;
  }>;
};

type PreviewXlsx = {
  tipo: 'lista_calificaciones_xlsx';
  archivo: string;
  sha256: string;
  bytes: number;
  hoja: string;
  filaEncabezado: number;
  columnas: ColumnaDetectada[];
  alumnosDetectados: number;
  evidenciasHistoricasDetectadas: number;
  filasOmitidas: number;
  muestraAlumnos: AlumnoDetectado[];
  advertencias: string[];
};

type PreviewDocx = {
  tipo: 'encuadre' | 'parcial_externo' | 'global_externo' | 'temario_o_material';
  archivo: string;
  sha256: string;
  bytes: number;
  caracteres: number;
  reactivosDetectados: number;
  opcionesDetectadas: number;
  tituloSugerido: string;
  muestraTexto: string[];
  advertencias: string[];
};

export type PreviewArchivoHidratacion = PreviewXlsx | PreviewDocx;

type ReactivoImportable = {
  numero: number;
  enunciado: string;
  opciones: Array<{
    letra: string;
    texto: string;
    esCorrecta: boolean;
  }>;
};

export type PreviewHidratacion = {
  periodoId: string;
  archivos: PreviewArchivoHidratacion[];
  planImportacion: {
    alumnosDetectados: number;
    evidenciasHistoricasDetectadas: number;
    documentosDetectados: number;
    acciones: string[];
    requiereConfirmacionDocente: true;
  };
};

type ResultadoImportacion = {
  periodoId: string;
  resumen: {
    alumnosCreados: number;
    alumnosActualizados: number;
    alumnosOmitidos: number;
    evidenciasHistoricasCreadas: number;
    evidenciasDocumentalesCreadas: number;
    evidenciasDocumentalesOmitidas: number;
    bancoPreguntasCreadas: number;
    bancoPreguntasOmitidas: number;
    conflictos: number;
  };
  archivos: PreviewArchivoHidratacion[];
};

function hashSha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizarTexto(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function valorCeldaTexto(valor: unknown) {
  if (valor && typeof valor === 'object' && 'text' in valor) {
    return String((valor as { text?: unknown }).text ?? '').trim();
  }
  if (valor && typeof valor === 'object' && 'result' in valor) {
    return String((valor as { result?: unknown }).result ?? '').trim();
  }
  return String(valor ?? '').trim();
}

function columnaALetra(indice: number) {
  let n = indice;
  let out = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    n = Math.floor((n - mod) / 26);
  }
  return out;
}

function determinarRolColumna(titulo: string): ColumnaDetectada['rol'] {
  const normalizado = normalizarTexto(titulo);
  if (!normalizado) return 'ignorar';
  if (normalizado.includes('nombre') && normalizado.includes('alumno')) return 'nombre';
  if (normalizado.includes('id') && normalizado.includes('alumno')) return 'matricula';
  if (normalizado.includes('matricula')) return 'matricula';
  if (normalizado.includes('correo') || normalizado.includes('email')) return 'correo';
  if (normalizado === 'grupo' || normalizado.includes('grupo')) return 'grupo';
  if (
    normalizado.includes('parcial') ||
    normalizado.includes('global') ||
    normalizado.includes('calificacion') ||
    normalizado.includes('columna') ||
    normalizado.includes('tarea') ||
    normalizado.includes('examen')
  ) {
    return 'calificacion';
  }
  return 'ignorar';
}

function numeroSeguro(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const texto = valorCeldaTexto(valor).replace(/%/g, '').replace(/,/g, '.');
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function esFilaTotalONota(nombre: string) {
  const n = normalizarTexto(nombre);
  return !n || n.includes('total') || n.includes('promedio') || n.includes('nota media');
}

async function analizarXlsx(archivo: ArchivoHidratacion): Promise<PreviewXlsx> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo.buffer as any);
  const hoja =
    workbook.getWorksheet('LIBRO DE CALIFICACIONES') ??
    workbook.worksheets.find((ws) => normalizarTexto(ws.name).includes('calificaciones')) ??
    workbook.worksheets[0];

  if (!hoja) {
    throw new ErrorAplicacion('XLSX_SIN_HOJAS', 'El XLSX no contiene hojas legibles', 400);
  }

  let filaEncabezado = 0;
  let columnas: ColumnaDetectada[] = [];
  const limiteFilas = Math.min(hoja.rowCount || 80, 80);
  const limiteColumnas = Math.min(hoja.columnCount || 80, 80);

  for (let fila = 1; fila <= limiteFilas; fila += 1) {
    const candidatas: ColumnaDetectada[] = [];
    for (let col = 1; col <= limiteColumnas; col += 1) {
      const titulo = valorCeldaTexto(hoja.getRow(fila).getCell(col).value);
      const rol = determinarRolColumna(titulo);
      if (rol !== 'ignorar') {
        candidatas.push({ indice: col, letra: columnaALetra(col), titulo, rol });
      }
    }
    const tieneNombre = candidatas.some((c) => c.rol === 'nombre');
    const tieneMatricula = candidatas.some((c) => c.rol === 'matricula');
    const tieneCorreo = candidatas.some((c) => c.rol === 'correo');
    if (tieneNombre && (tieneMatricula || tieneCorreo)) {
      filaEncabezado = fila;
      columnas = candidatas;
      break;
    }
  }

  if (!filaEncabezado) {
    throw new ErrorAplicacion(
      'XLSX_ENCABEZADOS_NO_DETECTADOS',
      'No se detectaron columnas de alumno en el XLSX',
      400
    );
  }

  const colNombre = columnas.find((c) => c.rol === 'nombre')?.indice;
  const colMatricula = columnas.find((c) => c.rol === 'matricula')?.indice;
  const colCorreo = columnas.find((c) => c.rol === 'correo')?.indice;
  const colGrupo = columnas.find((c) => c.rol === 'grupo')?.indice;
  const columnasCalificacion = columnas.filter((c) => c.rol === 'calificacion');
  const alumnos: AlumnoDetectado[] = [];
  let filasOmitidas = 0;

  for (let fila = filaEncabezado + 1; fila <= Math.min(hoja.rowCount || filaEncabezado + 1, 2000); fila += 1) {
    const row = hoja.getRow(fila);
    const nombreCompleto = valorCeldaTexto(colNombre ? row.getCell(colNombre).value : '');
    const matricula = valorCeldaTexto(colMatricula ? row.getCell(colMatricula).value : '');
    const correo = valorCeldaTexto(colCorreo ? row.getCell(colCorreo).value : '');
    const grupo = valorCeldaTexto(colGrupo ? row.getCell(colGrupo).value : '');
    if (esFilaTotalONota(nombreCompleto) || (!matricula && !correo)) {
      filasOmitidas += 1;
      continue;
    }

    const calificaciones = columnasCalificacion
      .map((col) => ({
        columna: col.letra,
        titulo: col.titulo,
        valor: numeroSeguro(row.getCell(col.indice).value)
      }))
      .filter((item): item is { columna: string; titulo: string; valor: number } => item.valor !== null);

    alumnos.push({
      fila,
      nombreCompleto,
      matricula: matricula || correo,
      correo,
      grupo: grupo || undefined,
      calificaciones
    });
  }

  const advertencias: string[] = [];
  if (columnasCalificacion.length === 0) {
    advertencias.push('No se detectaron columnas de calificacion numerica; solo se importaran alumnos.');
  }
  if (alumnos.length === 0) {
    advertencias.push('No se detectaron alumnos importables.');
  }

  return {
    tipo: 'lista_calificaciones_xlsx',
    archivo: archivo.originalname,
    sha256: hashSha256(archivo.buffer),
    bytes: archivo.size,
    hoja: hoja.name,
    filaEncabezado,
    columnas,
    alumnosDetectados: alumnos.length,
    evidenciasHistoricasDetectadas: alumnos.reduce((acc, alumno) => acc + alumno.calificaciones.length, 0),
    filasOmitidas,
    muestraAlumnos: alumnos.slice(0, 5),
    advertencias
  };
}

async function extraerTextoDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) {
    throw new ErrorAplicacion('DOCX_INVALIDO', 'No se encontro word/document.xml en el DOCX', 400);
  }
  const xml = await documentXml.async('text');
  const tokens: string[] = [];
  const patron = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab[^>]*\/>|<\/w:p>/g;
  for (const match of xml.matchAll(patron)) {
    const completo = match[0] ?? '';
    if (completo.startsWith('<w:tab')) {
      tokens.push('\t');
      continue;
    }
    if (completo === '</w:p>') {
      tokens.push('\n');
      continue;
    }
    const texto = String(match[1] ?? '');
    if (texto.includes('<')) continue;
    tokens.push(
      texto
        .replace(/&lt;/g, '[')
        .replace(/&gt;/g, ']')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
    );
  }
  return tokens.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function extraerOpcionesLinea(linea: string) {
  const opciones: Array<{ letra: string; texto: string }> = [];
  const patron = /(?:^|\s)([A-E])[).-]\s*([\s\S]*?)(?=\s+[A-E][).-]\s*|$)/gi;
  for (const match of linea.matchAll(patron)) {
    const letra = String(match[1] ?? '').toUpperCase();
    const texto = String(match[2] ?? '').trim();
    if (letra && texto) opciones.push({ letra, texto });
  }
  return opciones;
}

function extraerClaveRespuesta(linea: string) {
  const match = linea.match(/respuesta\s+(?:correcta\s*)?:?\s*([A-E])/i) ?? linea.match(/\bclave\s*:?\s*([A-E])\b/i);
  return match ? String(match[1]).toUpperCase() : null;
}

function extraerReactivosDocx(texto: string): ReactivoImportable[] {
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  const reactivos: ReactivoImportable[] = [];
  let actual: {
    numero: number;
    partesEnunciado: string[];
    opciones: Array<{ letra: string; texto: string }>;
    correcta: string | null;
  } | null = null;

  const cerrarActual = () => {
    if (!actual) return;
    const opciones = actual.opciones
      .filter((opcion, index, arr) => arr.findIndex((item) => item.letra === opcion.letra) === index)
      .map((opcion) => ({
        ...opcion,
        esCorrecta: actual?.correcta === opcion.letra
      }));
    const enunciado = actual.partesEnunciado.join(' ').replace(/\s+/g, ' ').trim();
    if (enunciado && opciones.length >= 2) {
      reactivos.push({ numero: actual.numero, enunciado, opciones });
    }
  };

  for (const linea of lineas) {
    const inicio = linea.match(/^(\d+)[).\s-]+(.+)$/);
    if (inicio) {
      cerrarActual();
      actual = {
        numero: Number(inicio[1]),
        partesEnunciado: [String(inicio[2] ?? '').trim()],
        opciones: [],
        correcta: null
      };
      const opcionesEnLinea = extraerOpcionesLinea(String(inicio[2] ?? ''));
      if (opcionesEnLinea.length) {
        actual.partesEnunciado = [String(inicio[2] ?? '').replace(/(?:^|\s)[A-E][).-]\s*[\s\S]*$/i, '').trim()];
        actual.opciones.push(...opcionesEnLinea);
      }
      continue;
    }

    if (!actual) continue;
    const correcta = extraerClaveRespuesta(linea);
    if (correcta) {
      actual.correcta = correcta;
      continue;
    }

    const opciones = extraerOpcionesLinea(linea);
    if (opciones.length) {
      actual.opciones.push(...opciones);
    } else {
      actual.partesEnunciado.push(linea);
    }
  }
  cerrarActual();

  return reactivos;
}

function clasificarDocx(nombre: string, texto: string): PreviewDocx['tipo'] {
  const base = `${nombre} ${texto.slice(0, 1500)}`;
  const normalizado = normalizarTexto(base);
  if (normalizado.includes('encuadre') || normalizado.includes('formato de asignatura')) return 'encuadre';
  if (normalizado.includes('examen') && normalizado.includes('global')) return 'global_externo';
  if (normalizado.includes('examen') && normalizado.includes('parcial')) return 'parcial_externo';
  return 'temario_o_material';
}

async function analizarDocx(archivo: ArchivoHidratacion): Promise<PreviewDocx> {
  const texto = await extraerTextoDocx(archivo.buffer);
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  const reactivosDetectados = (texto.match(/(^|\n)\s*\d+[).\-\s]/g) ?? []).length;
  const opcionesDetectadas = (texto.match(/(^|\n|\s)[A-D][).\-\s]/g) ?? []).length;
  const tipo = clasificarDocx(archivo.originalname, texto);
  const tituloSugerido =
    lineas.find((linea) => /examen|encuadre|temario|asignatura/i.test(linea)) ??
    archivo.originalname.replace(/\.docx$/i, '');
  const advertencias: string[] = [];
  if ((tipo === 'parcial_externo' || tipo === 'global_externo') && reactivosDetectados === 0) {
    advertencias.push('El documento parece examen, pero no se detectaron reactivos numerados.');
  }

  return {
    tipo,
    archivo: archivo.originalname,
    sha256: hashSha256(archivo.buffer),
    bytes: archivo.size,
    caracteres: texto.length,
    reactivosDetectados,
    opcionesDetectadas,
    tituloSugerido,
    muestraTexto: lineas.slice(0, 12),
    advertencias
  };
}

function esXlsx(archivo: ArchivoHidratacion) {
  return /\.xlsx$/i.test(archivo.originalname) || archivo.mimetype.includes('spreadsheet');
}

function esDocx(archivo: ArchivoHidratacion) {
  return /\.docx$/i.test(archivo.originalname) || archivo.mimetype.includes('wordprocessingml');
}

export async function previsualizarHidratacionCurso(params: {
  periodoId: string;
  docenteId?: string;
  archivos: ArchivoHidratacion[];
}): Promise<PreviewHidratacion> {
  if (!params.periodoId) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'periodoId es requerido', 400);
  }
  if (!params.archivos.length) {
    throw new ErrorAplicacion('ARCHIVOS_REQUERIDOS', 'Se requiere al menos un archivo XLSX o DOCX', 400);
  }
  if (params.docenteId) {
    await validarPeriodoDocente(params.periodoId, params.docenteId);
  }

  const previews: PreviewArchivoHidratacion[] = [];
  for (const archivo of params.archivos) {
    if (esXlsx(archivo)) previews.push(await analizarXlsx(archivo));
    else if (esDocx(archivo)) previews.push(await analizarDocx(archivo));
    else {
      throw new ErrorAplicacion('ARCHIVO_NO_SOPORTADO', `Archivo no soportado: ${archivo.originalname}`, 400);
    }
  }

  const alumnosDetectados = previews
    .filter((p): p is PreviewXlsx => p.tipo === 'lista_calificaciones_xlsx')
    .reduce((acc, p) => acc + p.alumnosDetectados, 0);
  const evidenciasHistoricasDetectadas = previews
    .filter((p): p is PreviewXlsx => p.tipo === 'lista_calificaciones_xlsx')
    .reduce((acc, p) => acc + p.evidenciasHistoricasDetectadas, 0);
  const documentosDetectados = previews.filter((p) => p.tipo !== 'lista_calificaciones_xlsx').length;

  return {
    periodoId: params.periodoId,
    archivos: previews,
    planImportacion: {
      alumnosDetectados,
      evidenciasHistoricasDetectadas,
      documentosDetectados,
      acciones: [
        'Previsualizar mapeo de columnas y documentos.',
        'Confirmar importacion docente.',
        'Crear o actualizar alumnos por matricula.',
        'Registrar evidencias historicas y documentales con hash de origen.'
      ],
      requiereConfirmacionDocente: true
    }
  };
}

async function validarPeriodoDocente(periodoId: string, docenteId: string) {
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId } });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
}

function corteDesdeTitulo(titulo: string): number | null {
  const n = normalizarTexto(titulo);
  if (n.includes('primer') || n.includes('parcial 1') || n.includes('parcial1')) return 1;
  if (n.includes('segundo') || n.includes('parcial 2') || n.includes('parcial2')) return 2;
  if (n.includes('global') || n.includes('final')) return 3;
  return null;
}

async function importarAlumnosDesdePreview(params: {
  docenteId: string;
  periodoId: string;
  archivoHash: string;
  alumnos: AlumnoDetectado[];
}) {
  let alumnosCreados = 0;
  let alumnosActualizados = 0;
  let alumnosOmitidos = 0;
  let evidenciasHistoricasCreadas = 0;
  const conflictos = 0;

  for (const alumno of params.alumnos) {
    if (!alumno.nombreCompleto || !alumno.matricula) {
      alumnosOmitidos += 1;
      continue;
    }

    const existente = await prisma.alumno.findUnique({
      where: { periodoId_matricula: { periodoId: params.periodoId, matricula: alumno.matricula } }
    });

    const correo = alumno.correo || `${alumno.matricula}@sin-correo.local`;
    const registro = existente
      ? await prisma.alumno.update({
          where: { id: existente.id },
          data: {
            nombreCompleto: alumno.nombreCompleto,
            correo,
            grupo: alumno.grupo ?? existente.grupo,
            activo: true
          }
        })
      : await prisma.alumno.create({
          data: {
            periodoId: params.periodoId,
            matricula: alumno.matricula,
            nombreCompleto: alumno.nombreCompleto,
            correo,
            grupo: alumno.grupo ?? null,
            activo: true
          }
        });

    if (existente) alumnosActualizados += 1;
    else alumnosCreados += 1;

    for (const calificacion of alumno.calificaciones) {
      const metadata = {
        origen: 'hidratacion_xlsx',
        archivoOrigenHash: params.archivoHash,
        columnaOrigen: calificacion.columna,
        filaOrigen: alumno.fila,
        tituloColumna: calificacion.titulo
      };
      const duplicadas = await prisma.evidenciaEvaluacion.findMany({
        where: {
          docenteId: params.docenteId,
          periodoId: params.periodoId,
          alumnoId: registro.id,
          fuente: 'importacion_xlsx'
        }
      });
      const yaExiste = duplicadas.some((ev) => {
        try {
          const meta = JSON.parse(String(ev.metadata ?? '{}')) as Record<string, unknown>;
          return (
            meta['archivoOrigenHash'] === params.archivoHash &&
            meta['columnaOrigen'] === calificacion.columna &&
            meta['filaOrigen'] === alumno.fila
          );
        } catch {
          return false;
        }
      });
      if (yaExiste) continue;
      await prisma.evidenciaEvaluacion.create({
        data: {
          docenteId: params.docenteId,
          periodoId: params.periodoId,
          alumnoId: registro.id,
          titulo: calificacion.titulo || `Calificacion ${calificacion.columna}`,
          descripcion: 'Evidencia historica importada desde libro de calificaciones.',
          calificacionDecimal: calificacion.valor,
          ponderacion: 1,
          fechaEvidencia: new Date(),
          corte: corteDesdeTitulo(calificacion.titulo),
          fuente: 'importacion_xlsx',
          estadoCaptura: 'calificada',
          metadata: JSON.stringify(metadata)
        }
      });
      evidenciasHistoricasCreadas += 1;
    }
  }

  return { alumnosCreados, alumnosActualizados, alumnosOmitidos, evidenciasHistoricasCreadas, conflictos };
}

async function importarDocx(params: {
  docenteId: string;
  periodoId: string;
  preview: PreviewDocx;
  archivo: ArchivoHidratacion;
}) {
  const alumnoSistema = await prisma.alumno.upsert({
    where: {
      periodoId_matricula: {
        periodoId: params.periodoId,
        matricula: '__CURSO__'
      }
    },
    update: {
      nombreCompleto: 'Evidencias del curso',
      correo: 'curso@evaluapro.local',
      activo: false
    },
    create: {
      periodoId: params.periodoId,
      matricula: '__CURSO__',
      nombreCompleto: 'Evidencias del curso',
      correo: 'curso@evaluapro.local',
      activo: false
    }
  });

  const existentes = await prisma.evidenciaEvaluacion.findMany({
    where: {
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      alumnoId: alumnoSistema.id,
      fuente: 'importacion_docx'
    }
  });
  const yaExiste = existentes.some((ev) => {
    try {
      const meta = JSON.parse(String(ev.metadata ?? '{}')) as Record<string, unknown>;
      return meta['archivoOrigenHash'] === params.preview.sha256;
    } catch {
      return false;
    }
  });
  let evidenciaCreada = false;

  if (!yaExiste) {
    await prisma.evidenciaEvaluacion.create({
      data: {
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        alumnoId: alumnoSistema.id,
        titulo: params.preview.tituloSugerido,
        descripcion: `Documento importado para hidratacion de curso: ${params.preview.tipo}.`,
        ponderacion: 1,
        fechaEvidencia: new Date(),
        corte:
          params.preview.tipo === 'parcial_externo' || params.preview.tipo === 'global_externo'
            ? corteDesdeTitulo(params.preview.tituloSugerido)
            : null,
        fuente: 'importacion_docx',
        estadoCaptura: 'documental',
        metadata: JSON.stringify({
          origen: 'hidratacion_docx',
          archivoOrigenHash: params.preview.sha256,
          archivo: params.preview.archivo,
          tipoDocumento: params.preview.tipo,
          reactivosDetectados: params.preview.reactivosDetectados,
          opcionesDetectadas: params.preview.opcionesDetectadas,
          caracteres: params.preview.caracteres
        })
      }
    });
    evidenciaCreada = true;
  }

  const banco = await importarBancoPreguntasDesdeDocx(params);
  return { creada: evidenciaCreada, bancoPreguntasCreadas: banco.creadas, bancoPreguntasOmitidas: banco.omitidas };
}

async function importarBancoPreguntasDesdeDocx(params: {
  docenteId: string;
  periodoId: string;
  preview: PreviewDocx;
  archivo: ArchivoHidratacion;
}) {
  if (params.preview.tipo !== 'parcial_externo' && params.preview.tipo !== 'global_externo') {
    return { creadas: 0, omitidas: 0 };
  }

  const texto = await extraerTextoDocx(params.archivo.buffer);
  const reactivos = extraerReactivosDocx(texto);
  let creadas = 0;
  let omitidas = 0;
  const corte = corteDesdeTitulo(params.preview.tituloSugerido);
  const tema =
    params.preview.tipo === 'global_externo'
      ? 'Examen Global'
      : corte === 2
        ? 'Examen Segundo Parcial'
        : 'Examen Primer Parcial';
  const existentes = await prisma.bancoPregunta.findMany({
    where: {
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      activo: true
    }
  });

  for (const reactivo of reactivos) {
    const yaExiste = existentes.some((pregunta) => {
      try {
        const meta = JSON.parse(String(pregunta.recoverySource ?? '{}')) as Record<string, unknown>;
        return meta['archivoOrigenHash'] === params.preview.sha256 && meta['numeroReactivo'] === reactivo.numero;
      } catch {
        return false;
      }
    });
    if (yaExiste) {
      omitidas += 1;
      continue;
    }

    const pregunta = await prisma.bancoPregunta.create({
      data: {
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        tema,
        versionActual: 1,
        activo: true,
        recoverySource: JSON.stringify({
          origen: 'hidratacion_docx',
          archivoOrigenHash: params.preview.sha256,
          archivo: params.preview.archivo,
          tipoDocumento: params.preview.tipo,
          numeroReactivo: reactivo.numero
        })
      }
    });
    existentes.push(pregunta);
    const version = await prisma.versionPregunta.create({
      data: {
        preguntaId: pregunta.id,
        numeroVersion: 1,
        enunciado: reactivo.enunciado
      }
    });
    await prisma.opcionPregunta.createMany({
      data: reactivo.opciones.map((opcion) => ({
        versionPreguntaId: version.id,
        texto: opcion.texto,
        esCorrecta: opcion.esCorrecta
      }))
    });
    creadas += 1;
  }

  return { creadas, omitidas };
}

export async function importarHidratacionCurso(params: {
  docenteId: string;
  periodoId: string;
  archivos: ArchivoHidratacion[];
}): Promise<ResultadoImportacion> {
  await validarPeriodoDocente(params.periodoId, params.docenteId);
  const preview = await previsualizarHidratacionCurso({ periodoId: params.periodoId, archivos: params.archivos });
  const resumen: ResultadoImportacion['resumen'] = {
    alumnosCreados: 0,
    alumnosActualizados: 0,
    alumnosOmitidos: 0,
    evidenciasHistoricasCreadas: 0,
    evidenciasDocumentalesCreadas: 0,
    evidenciasDocumentalesOmitidas: 0,
    bancoPreguntasCreadas: 0,
    bancoPreguntasOmitidas: 0,
    conflictos: 0
  };

  for (const archivoPreview of preview.archivos) {
    if (archivoPreview.tipo === 'lista_calificaciones_xlsx') {
      const archivoOriginal = params.archivos.find((archivo) => hashSha256(archivo.buffer) === archivoPreview.sha256);
      if (!archivoOriginal) continue;
      const xlsxCompleto = await analizarXlsx(archivoOriginal);
      const alumnos = await extraerAlumnosCompletosDesdeXlsx(archivoOriginal);
      const resultado = await importarAlumnosDesdePreview({
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        archivoHash: xlsxCompleto.sha256,
        alumnos
      });
      resumen.alumnosCreados += resultado.alumnosCreados;
      resumen.alumnosActualizados += resultado.alumnosActualizados;
      resumen.alumnosOmitidos += resultado.alumnosOmitidos;
      resumen.evidenciasHistoricasCreadas += resultado.evidenciasHistoricasCreadas;
      resumen.conflictos += resultado.conflictos;
    } else {
      const archivoOriginal = params.archivos.find((archivo) => hashSha256(archivo.buffer) === archivoPreview.sha256);
      if (!archivoOriginal) continue;
      const resultado = await importarDocx({
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        preview: archivoPreview,
        archivo: archivoOriginal
      });
      if (resultado.creada) resumen.evidenciasDocumentalesCreadas += 1;
      else resumen.evidenciasDocumentalesOmitidas += 1;
      resumen.bancoPreguntasCreadas += resultado.bancoPreguntasCreadas;
      resumen.bancoPreguntasOmitidas += resultado.bancoPreguntasOmitidas;
    }
  }

  return { periodoId: params.periodoId, resumen, archivos: preview.archivos };
}

async function extraerAlumnosCompletosDesdeXlsx(archivo: ArchivoHidratacion) {
  const preview = await analizarXlsx(archivo);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo.buffer as any);
  const hoja = workbook.getWorksheet(preview.hoja);
  if (!hoja) return [];

  const colNombre = preview.columnas.find((c) => c.rol === 'nombre')?.indice;
  const colMatricula = preview.columnas.find((c) => c.rol === 'matricula')?.indice;
  const colCorreo = preview.columnas.find((c) => c.rol === 'correo')?.indice;
  const colGrupo = preview.columnas.find((c) => c.rol === 'grupo')?.indice;
  const columnasCalificacion = preview.columnas.filter((c) => c.rol === 'calificacion');
  const alumnos: AlumnoDetectado[] = [];

  for (let fila = preview.filaEncabezado + 1; fila <= Math.min(hoja.rowCount || preview.filaEncabezado + 1, 2000); fila += 1) {
    const row = hoja.getRow(fila);
    const nombreCompleto = valorCeldaTexto(colNombre ? row.getCell(colNombre).value : '');
    const matricula = valorCeldaTexto(colMatricula ? row.getCell(colMatricula).value : '');
    const correo = valorCeldaTexto(colCorreo ? row.getCell(colCorreo).value : '');
    const grupo = valorCeldaTexto(colGrupo ? row.getCell(colGrupo).value : '');
    if (esFilaTotalONota(nombreCompleto) || (!matricula && !correo)) continue;
    alumnos.push({
      fila,
      nombreCompleto,
      matricula: matricula || correo,
      correo,
      grupo: grupo || undefined,
      calificaciones: columnasCalificacion
        .map((col) => ({
          columna: col.letra,
          titulo: col.titulo,
          valor: numeroSeguro(row.getCell(col.indice).value)
        }))
        .filter((item): item is { columna: string; titulo: string; valor: number } => item.valor !== null)
    });
  }

  return alumnos;
}
