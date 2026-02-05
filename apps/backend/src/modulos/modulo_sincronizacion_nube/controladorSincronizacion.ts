/**
 * Controlador de sincronizacion con la nube.
 *
 * Objetivo:
 * - Publicar (push) un subconjunto de datos al portal alumno cloud.
 * - Registrar auditoria local (coleccion `sincronizaciones`) para trazabilidad.
 *
 * Seguridad:
 * - Se autentica al docente via JWT (middleware `requerirDocente`).
 * - El portal cloud valida `x-api-key` (secreto compartido backend → portal).
 *
 * Resiliencia:
 * - PDFs se incluyen como best-effort (si falla lectura/compresion se omiten).
 * - El envio al portal puede fallar; se registra intento y se retorna error.
 */
import type { Response } from 'express';
import { gunzipSync, gzipSync } from 'zlib';
import { configuracion } from '../../configuracion';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { Entrega } from '../modulo_vinculacion_entrega/modeloEntrega';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { BanderaRevision } from '../modulo_analiticas/modeloBanderaRevision';
import { CodigoAcceso } from './modeloCodigoAcceso';
import { Sincronizacion } from './modeloSincronizacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { enviarCorreo } from '../../infraestructura/correo/servicioCorreo';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';

const MAX_BASE64_CHARS = 60_000_000; // ~45MB binario aprox

function generarCodigoSimple() {
  // 8 hex chars (A-F0-9) en mayusculas: simple de dictar y transcribir.
  return randomBytes(4).toString('hex').toUpperCase();
}

function comprimirBase64(buffer: Buffer) {
  return gzipSync(buffer).toString('base64');
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function sha256HexBuffer(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

function normalizarCorreo(valor: unknown): string {
  if (!valor) return '';
  return String(valor).trim().toLowerCase();
}

async function obtenerCorreoDocente(docenteId: string): Promise<string> {
  const docente = await Docente.findById(docenteId).select('correo').lean();
  const correo = normalizarCorreo((docente as { correo?: unknown })?.correo);
  if (!correo) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  return correo;
}

type PaqueteSincronizacionV1 = {
  schemaVersion: 1;
  exportadoEn: string;
  docenteId: string;
  docenteCorreo?: string;
  periodoId?: string;
  desde?: string;
  conteos: Record<string, number>;
  periodos: unknown[];
  alumnos: unknown[];
  bancoPreguntas: unknown[];
  plantillas: unknown[];
  examenes: Array<Record<string, unknown>>;
  entregas: unknown[];
  calificaciones: unknown[];
  banderas: unknown[];
  pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string; pdfSha256?: string }>;
};

type RegistroPlano = Record<string, unknown>;
type ModelQueryLike = {
  select: (fields: string) => ModelQueryLike;
  lean: () => Promise<RegistroPlano | null>;
};
type ModelLike = {
  findById: (id: unknown) => ModelQueryLike;
  findOneAndUpdate: (filtro: RegistroPlano, update: RegistroPlano, options: RegistroPlano) => unknown;
};

function obtenerCampo(doc: unknown, campo: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  return (doc as RegistroPlano)[campo];
}

function obtenerId(doc: unknown): unknown {
  return obtenerCampo(doc, '_id');
}

function obtenerIdTexto(doc: unknown): string {
  return String(obtenerId(doc) ?? '').trim();
}

function aFecha(valor: unknown): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

async function upsertLwwPorUpdatedAt({
  modelName,
  Model,
  docs
}: {
  modelName: string;
  Model: ModelLike;
  docs: Array<Record<string, unknown>>;
}) {
  let aplicados = 0;
  let omitidos = 0;

  for (const doc of docs) {
    const id = obtenerCampo(doc, '_id');
    if (!id) continue;

    const incomingUpdatedAt = aFecha(obtenerCampo(doc, 'updatedAt') ?? obtenerCampo(doc, 'createdAt'));
    const existente = await Model.findById(id).select('updatedAt').lean();
    const existenteUpdatedAt = aFecha(existente ? obtenerCampo(existente, 'updatedAt') : null);
    if (existenteUpdatedAt && (!incomingUpdatedAt || existenteUpdatedAt >= incomingUpdatedAt)) {
      omitidos += 1;
      continue;
    }

    await Model.findOneAndUpdate(
      { _id: id },
      doc,
      {
        upsert: true,
        overwrite: true,
        setDefaultsOnInsert: true
      }
    );
    aplicados += 1;
  }

  return { modelName, aplicados, omitidos, recibidos: docs.length };
}

function parsearFechaIso(valor?: string): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function crearErrorServidorSincronizacionNoConfigurado(codigo: 'SYNC_SERVIDOR_NO_CONFIG' | 'PORTAL_NO_CONFIG') {
  return new ErrorAplicacion(
    codigo,
    'Servidor de sincronizacion no configurado. Define PORTAL_ALUMNO_URL y PORTAL_ALUMNO_API_KEY.',
    503
  );
}

function normalizarErrorServidorSincronizacion(error: unknown) {
  if (error instanceof ErrorAplicacion) return error;
  return new ErrorAplicacion(
    'SYNC_SERVIDOR_INALCANZABLE',
    'No se pudo conectar al servidor de sincronizacion. Verifica PORTAL_ALUMNO_URL y que el portal este en linea.',
    502,
    {
      causa: error instanceof Error ? error.message : String(error)
    }
  );
}

async function generarPaqueteSincronizacion({
  docenteId,
  docenteCorreo,
  periodoId,
  desde,
  incluirPdfs
}: {
  docenteId: string;
  docenteCorreo?: string;
  periodoId?: string;
  desde?: Date | null;
  incluirPdfs: boolean;
}) {
  const correo = docenteCorreo || await obtenerCorreoDocente(docenteId);
  const filtroPeriodo = periodoId ? { _id: periodoId, docenteId } : { docenteId };
  const periodos = await Periodo.find(filtroPeriodo).lean();
  if (periodoId && periodos.length === 0) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const periodoIds = periodos.map((p) => obtenerIdTexto(p)).filter(Boolean);

  const filtroDesde = (desde ? { updatedAt: { $gte: desde } } : {}) as Record<string, unknown>;
  const filtroPeriodoIds = periodoIds.length > 0 ? { periodoId: { $in: periodoIds } } : {};

  const [alumnos, bancoPreguntas, plantillas, examenes, calificaciones] = await Promise.all([
    Alumno.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    BancoPregunta.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    ExamenPlantilla.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    ExamenGenerado.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    Calificacion.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean()
  ]);

  const examenesIds = examenes.map((e) => obtenerIdTexto(e)).filter(Boolean);
  const [entregas, banderas] = await Promise.all([
    examenesIds.length > 0
      ? Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
      : Promise.resolve([]),
    examenesIds.length > 0
      ? BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
      : Promise.resolve([])
  ]);

  const pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string; pdfSha256?: string }> = [];
  if (incluirPdfs) {
    // Guardrail: evita payloads gigantes.
    const MAX_PDFS = 120;
    const MAX_TOTAL_COMPRESSED_BYTES = 25 * 1024 * 1024; // 25MB
    let total = 0;

    for (const examen of examenes.slice(0, MAX_PDFS)) {
      const examenId = String((examen as unknown as { _id?: unknown })?._id ?? '').trim();
      const rutaPdf = String((examen as unknown as { rutaPdf?: unknown })?.rutaPdf ?? '').trim();
      if (!examenId || !rutaPdf) continue;
      try {
        const contenido = await fs.readFile(rutaPdf);
        const pdfSha256 = sha256HexBuffer(contenido);
        const comprimido = gzipSync(contenido);
        total += comprimido.length;
        if (total > MAX_TOTAL_COMPRESSED_BYTES) break;
        pdfs.push({ examenGeneradoId: examenId, pdfComprimidoBase64: comprimido.toString('base64'), pdfSha256 });
      } catch {
        // omitir PDF si no se encuentra/no se puede leer
      }
    }
  }

  const exportadoEn = new Date().toISOString();
  const paquete: PaqueteSincronizacionV1 = {
    schemaVersion: 1,
    exportadoEn,
    docenteId: String(docenteId),
    docenteCorreo: correo || undefined,
    ...(periodoId ? { periodoId } : {}),
    ...(desde ? { desde: desde.toISOString() } : {}),
    conteos: {
      periodos: periodos.length,
      alumnos: alumnos.length,
      bancoPreguntas: bancoPreguntas.length,
      plantillas: plantillas.length,
      examenes: examenes.length,
      entregas: (entregas as unknown[]).length,
      calificaciones: calificaciones.length,
      banderas: (banderas as unknown[]).length,
      pdfs: pdfs.length
    },
    periodos: periodos as unknown[],
    alumnos: alumnos as unknown[],
    bancoPreguntas: bancoPreguntas as unknown[],
    plantillas: plantillas as unknown[],
    examenes: (examenes as unknown[]) as Array<Record<string, unknown>>,
    entregas: entregas as unknown[],
    calificaciones: calificaciones as unknown[],
    banderas: banderas as unknown[],
    pdfs
  };

  const json = JSON.stringify(paquete);
  const checksumSha256 = sha256Hex(json);
  const gzipBytes = gzipSync(Buffer.from(json));
  const checksumGzipSha256 = sha256HexBuffer(gzipBytes);
  const paqueteBase64 = gzipBytes.toString('base64');

  return {
    paquete,
    paqueteBase64,
    checksumSha256,
    checksumGzipSha256,
    exportadoEn
  };
}

async function procesarPaqueteSincronizacion({
  docenteId,
  paqueteBase64,
  checksumEsperado,
  docenteCorreo,
  dryRun,
  registroId
}: {
  docenteId: string;
  paqueteBase64: string;
  checksumEsperado?: string;
  docenteCorreo?: string;
  dryRun: boolean;
  registroId?: unknown;
}) {
  const gzipBytes = Buffer.from(paqueteBase64, 'base64');
  const buffer = gunzipSync(gzipBytes);
  const json = buffer.toString('utf8');
  const parsed = JSON.parse(json) as PaqueteSincronizacionV1;

  const checksumActual = sha256Hex(json);
  if (checksumEsperado && checksumEsperado.toLowerCase() !== checksumActual.toLowerCase()) {
    throw new ErrorAplicacion('SYNC_CHECKSUM', 'Checksum invalido: el paquete parece corrupto o fue modificado', 400);
  }

  if (!parsed || parsed.schemaVersion !== 1) {
    throw new ErrorAplicacion('SYNC_VERSION', 'Version de paquete no soportada', 400);
  }
  const docenteIdActual = String(docenteId);
  const docenteIdPaquete = String(parsed.docenteId || '').trim();
  if (!docenteIdPaquete) {
    throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', 'El paquete no corresponde a este docente', 403);
  }

  const correoActual = await obtenerCorreoDocente(docenteIdActual);
  const correoPaquete = normalizarCorreo(parsed.docenteCorreo || docenteCorreo);
  const idsCoinciden = docenteIdPaquete === docenteIdActual;
  const correosCoinciden = Boolean(correoPaquete && correoPaquete === correoActual);

  if (!idsCoinciden && !correosCoinciden) {
    throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', 'El paquete no corresponde a este docente', 403);
  }

  // Validacion minima de que los docs del paquete pertenecen al docente.
  const assertDocente = (docs: Array<Record<string, unknown>>, nombre: string, docenteEsperado: string) => {
    for (const doc of docs) {
      const d = String(obtenerCampo(doc, 'docenteId') ?? '');
      if (d && d !== docenteEsperado) {
        throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', `El paquete contiene ${nombre} de otro docente`, 403);
      }
    }
  };

  const examenesDocs = Array.isArray(parsed.examenes) ? parsed.examenes : [];
  const examenesIds = examenesDocs.map((e) => obtenerIdTexto(e)).filter(Boolean);

  // Importar en orden para respetar referencias basicas.
  const resultados = [] as Array<Record<string, unknown>>;
  const periodosDocs = (Array.isArray(parsed.periodos) ? parsed.periodos : []) as Array<Record<string, unknown>>;
  const alumnosDocs = (Array.isArray(parsed.alumnos) ? parsed.alumnos : []) as Array<Record<string, unknown>>;
  const bancoDocs = (Array.isArray(parsed.bancoPreguntas) ? parsed.bancoPreguntas : []) as Array<Record<string, unknown>>;
  const plantillasDocs = (Array.isArray(parsed.plantillas) ? parsed.plantillas : []) as Array<Record<string, unknown>>;
  const entregasDocs = (Array.isArray(parsed.entregas) ? parsed.entregas : []) as Array<Record<string, unknown>>;
  const calificacionesDocs = (Array.isArray(parsed.calificaciones) ? parsed.calificaciones : []) as Array<Record<string, unknown>>;
  const banderasDocs = (Array.isArray(parsed.banderas) ? parsed.banderas : []) as Array<Record<string, unknown>>;

  assertDocente(periodosDocs, 'periodos', docenteIdPaquete);
  assertDocente(alumnosDocs, 'alumnos', docenteIdPaquete);
  assertDocente(bancoDocs, 'bancoPreguntas', docenteIdPaquete);
  assertDocente(plantillasDocs, 'plantillas', docenteIdPaquete);
  assertDocente(examenesDocs, 'examenes', docenteIdPaquete);
  assertDocente(entregasDocs, 'entregas', docenteIdPaquete);
  assertDocente(calificacionesDocs, 'calificaciones', docenteIdPaquete);
  assertDocente(banderasDocs, 'banderas', docenteIdPaquete);

  const forzarDocenteId = (docs: Array<Record<string, unknown>>, nuevoDocenteId: string) => {
    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(doc, 'docenteId')) {
        (doc as Record<string, unknown>).docenteId = nuevoDocenteId;
      }
    }
  };

  if (!idsCoinciden && correosCoinciden) {
    forzarDocenteId(periodosDocs, docenteIdActual);
    forzarDocenteId(alumnosDocs, docenteIdActual);
    forzarDocenteId(bancoDocs, docenteIdActual);
    forzarDocenteId(plantillasDocs, docenteIdActual);
    forzarDocenteId(examenesDocs, docenteIdActual);
    forzarDocenteId(entregasDocs, docenteIdActual);
    forzarDocenteId(calificacionesDocs, docenteIdActual);
    forzarDocenteId(banderasDocs, docenteIdActual);
  }

  if (dryRun) {
    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        {
          $set: {
            estado: 'exitoso',
            tipo: 'paquete_validar',
            detalles: {
              checksum: checksumActual,
              checksumProvisto: checksumEsperado || null,
              conteos: parsed.conteos
            }
          }
        }
      );
    }
    return {
      mensaje: 'Paquete valido',
      checksumSha256: checksumActual,
      conteos: parsed.conteos
    };
  }

  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Periodo', Model: Periodo as unknown as ModelLike, docs: periodosDocs }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Alumno', Model: Alumno as unknown as ModelLike, docs: alumnosDocs }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BancoPregunta', Model: BancoPregunta as unknown as ModelLike, docs: bancoDocs }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenPlantilla', Model: ExamenPlantilla as unknown as ModelLike, docs: plantillasDocs }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenGenerado', Model: ExamenGenerado as unknown as ModelLike, docs: examenesDocs }));

  // Entregas/banderas no incluyen periodoId, asi que filtramos por examenes del paquete para evitar basura.
  const entregasFiltradas = entregasDocs.filter((e) => examenesIds.includes(String(obtenerCampo(e, 'examenGeneradoId') ?? '')));
  const banderasFiltradas = banderasDocs.filter((b) => examenesIds.includes(String(obtenerCampo(b, 'examenGeneradoId') ?? '')));
  const calificacionesFiltradas = calificacionesDocs.filter((c) => examenesIds.includes(String(obtenerCampo(c, 'examenGeneradoId') ?? '')));

  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Entrega', Model: Entrega as unknown as ModelLike, docs: entregasFiltradas }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Calificacion', Model: Calificacion as unknown as ModelLike, docs: calificacionesFiltradas }));
  resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BanderaRevision', Model: BanderaRevision as unknown as ModelLike, docs: banderasFiltradas }));

  // PDFs best-effort: valida checksum y guarda en almacen local.
  let pdfsGuardados = 0;
  const pdfs = Array.isArray(parsed.pdfs) ? parsed.pdfs : [];
  for (const item of pdfs) {
    const examenGeneradoId = String(obtenerCampo(item, 'examenGeneradoId') ?? '').trim();
    const pdfB64 = String(obtenerCampo(item, 'pdfComprimidoBase64') ?? '').trim();
    const pdfSha256Esperado = String(obtenerCampo(item, 'pdfSha256') ?? '').trim();
    if (!examenGeneradoId || !pdfB64) continue;

    const examen = await ExamenGenerado.findById(examenGeneradoId).lean();
    if (!examen) continue;

    try {
      const pdfBytes = gunzipSync(Buffer.from(pdfB64, 'base64'));
      if (pdfSha256Esperado) {
        const actual = sha256HexBuffer(Buffer.from(pdfBytes));
        if (actual.toLowerCase() !== pdfSha256Esperado.toLowerCase()) {
          continue;
        }
      }
      const folio = String(obtenerCampo(examen, 'folio') ?? 'examen').trim() || 'examen';
      const nombre = `examen_folio-${folio}.pdf`;
      const rutaPdf = await guardarPdfExamen(nombre, Buffer.from(pdfBytes));
      await ExamenGenerado.updateOne({ _id: examenGeneradoId, docenteId }, { $set: { rutaPdf } }).catch(() => {
        // no-op
      });
      pdfsGuardados += 1;
    } catch {
      // omitir
    }
  }

  if (registroId) {
    await Sincronizacion.updateOne(
      { _id: registroId },
      { $set: { estado: 'exitoso', detalles: { resultados, pdfsGuardados, conteos: parsed.conteos } } }
    );
  }

  return { mensaje: 'Paquete importado', resultados, pdfsGuardados };
}

async function obtenerFechaUltimoPush(docenteId: string): Promise<Date | null> {
  const ultimo = await Sincronizacion.findOne({ docenteId, tipo: 'sync_push', estado: 'exitoso' })
    .sort({ createdAt: -1 })
    .lean();
  if (!ultimo) return null;
  const detalles = (ultimo as { detalles?: Record<string, unknown> })?.detalles;
  const exportadoEn = detalles && typeof detalles.exportadoEn === 'string' ? parsearFechaIso(detalles.exportadoEn) : null;
  if (exportadoEn) return exportadoEn;
  return ultimo.ejecutadoEn ? new Date(ultimo.ejecutadoEn) : null;
}

async function obtenerCursorUltimoPull(docenteId: string): Promise<string | null> {
  const ultimo = await Sincronizacion.findOne({ docenteId, tipo: 'sync_pull', estado: 'exitoso' })
    .sort({ createdAt: -1 })
    .lean();
  if (!ultimo) return null;
  const detalles = (ultimo as { detalles?: Record<string, unknown> })?.detalles;
  return detalles && typeof detalles.cursor === 'string' ? detalles.cursor : null;
}

export async function listarSincronizaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = { docenteId };

  const limite = Number(req.query.limite ?? 0);
  const consulta = Sincronizacion.find(filtro);
  const sincronizaciones = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ sincronizaciones });
}

export async function generarCodigoAcceso(req: SolicitudDocente, res: Response) {
  const { periodoId } = req.body;
  const docenteId = obtenerDocenteId(req);

  // Se intenta evitar colisiones de `codigo` (hay indice unique en Mongo).
  let codigo = generarCodigoSimple();
  let intentos = 0;
  while (intentos < 5) {
    const existe = await CodigoAcceso.findOne({ codigo }).lean();
    if (!existe) break;
    codigo = generarCodigoSimple();
    intentos += 1;
  }
  const expiraEn = new Date(Date.now() + configuracion.codigoAccesoHoras * 60 * 60 * 1000);

  const registro = await CodigoAcceso.create({
    docenteId,
    periodoId,
    codigo,
    expiraEn,
    usado: false
  });

  try {
    await enviarCorreo('destinatario@ejemplo.com', 'Codigo de acceso', `Tu codigo es ${codigo}`);
  } catch {
    // Se permite continuar si el servicio de correo no esta configurado.
  }

  res.status(201).json({ codigo: registro.codigo, expiraEn: registro.expiraEn });
}

export async function publicarResultados(req: SolicitudDocente, res: Response) {
  const { periodoId } = req.body;
  const docenteId = obtenerDocenteId(req);

  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw crearErrorServidorSincronizacionNoConfigurado('PORTAL_NO_CONFIG');
  }

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const alumnos = await Alumno.find({ docenteId, periodoId }).lean();
  const calificaciones = await Calificacion.find({ docenteId, periodoId }).lean();
  const banderas = await BanderaRevision.find({ docenteId }).lean();
  const examenes = await ExamenGenerado.find({ docenteId, periodoId }).lean();
  const codigo = await CodigoAcceso.findOne({ docenteId, periodoId, usado: false }).lean();

  const examenesPayload = [] as Array<Record<string, unknown>>;
  for (const examen of examenes) {
    let pdfComprimidoBase64: string | undefined;
    if (examen.rutaPdf) {
      // El PDF se comprime para reducir payload; si falla, se omite.
      try {
        const contenido = await fs.readFile(examen.rutaPdf);
        pdfComprimidoBase64 = comprimirBase64(contenido);
      } catch {
        // Continuar sin PDF si no se encuentra.
      }
    }

    examenesPayload.push({
      examenGeneradoId: examen._id,
      folio: examen.folio,
      pdfComprimidoBase64
    });
  }

  const periodoPayload = { _id: periodo._id };
  const alumnosPayload = alumnos.map((alumno) => ({
    _id: alumno._id,
    matricula: alumno.matricula,
    nombreCompleto: alumno.nombreCompleto,
    grupo: alumno.grupo
  }));
  const calificacionesPayload = calificaciones.map((calificacion) => ({
    docenteId: calificacion.docenteId,
    alumnoId: calificacion.alumnoId,
    examenGeneradoId: calificacion.examenGeneradoId,
    tipoExamen: calificacion.tipoExamen,
    calificacionExamenFinalTexto: calificacion.calificacionExamenFinalTexto,
    calificacionParcialTexto: calificacion.calificacionParcialTexto,
    calificacionGlobalTexto: calificacion.calificacionGlobalTexto,
    evaluacionContinuaTexto: calificacion.evaluacionContinuaTexto,
    proyectoTexto: calificacion.proyectoTexto
  }));
  const banderasPayload = banderas.map((bandera) => ({
    examenGeneradoId: bandera.examenGeneradoId,
    alumnoId: bandera.alumnoId,
    tipo: bandera.tipo,
    severidad: bandera.severidad,
    descripcion: bandera.descripcion,
    sugerencia: bandera.sugerencia
  }));

  const payload = {
    docenteId,
    periodo: periodoPayload,
    alumnos: alumnosPayload,
    calificaciones: calificacionesPayload,
    examenes: examenesPayload,
    banderas: banderasPayload,
    codigoAcceso: codigo
      ? { codigo: codigo.codigo, expiraEn: codigo.expiraEn }
      : null
  };

  const respuesta = await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': configuracion.portalApiKey
    },
    body: JSON.stringify(payload)
  });

  const estado = respuesta.ok ? 'exitoso' : 'fallido';
  await Sincronizacion.create({
    docenteId,
    estado,
    tipo: 'publicacion',
    detalles: { periodoId, status: respuesta.status },
    ejecutadoEn: new Date()
  });

  if (!respuesta.ok) {
    throw new ErrorAplicacion('PUBLICACION_FALLIDA', 'No se pudo publicar en la nube', 502);
  }

  res.json({ mensaje: 'Publicacion enviada' });
}

/**
 * Exporta un paquete (gzip+base64) para sincronizar datos entre computadoras.
 *
 * Diseño:
 * - Idempotente: el paquete se puede importar multiples veces.
 * - Resolucion de conflictos: LWW por `updatedAt` (timestamps de Mongoose).
 * - PDFs: best-effort, comprimidos (gzip base64). Si fallan, se omiten.
 */
export async function exportarPaquete(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const docenteCorreo = await obtenerCorreoDocente(String(docenteId));
  const periodoId = String((req.body as { periodoId?: unknown })?.periodoId ?? '').trim();
  const desdeRaw = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const incluirPdfs = (req.body as { incluirPdfs?: unknown })?.incluirPdfs !== false;

  const desde = desdeRaw ? parsearFechaIso(desdeRaw) : null;
  if (desdeRaw && !desde) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }

  const { paquete, paqueteBase64, checksumSha256, checksumGzipSha256, exportadoEn } = await generarPaqueteSincronizacion({
    docenteId: String(docenteId),
    docenteCorreo,
    periodoId: periodoId || undefined,
    desde: desde || undefined,
    incluirPdfs
  });

  await Sincronizacion.create({
    docenteId,
    estado: 'exitoso',
    tipo: 'paquete_export',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, conteos: paquete.conteos },
    ejecutadoEn: new Date()
  });

  res.json({
    paqueteBase64,
    checksumSha256,
    checksumGzipSha256,
    exportadoEn,
    conteos: paquete.conteos
  });
}

export async function importarPaquete(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const paqueteBase64 = String((req.body as { paqueteBase64?: unknown })?.paqueteBase64 ?? '').trim();
  const checksumEsperado = String((req.body as { checksumSha256?: unknown })?.checksumSha256 ?? '').trim();
  const docenteCorreo = normalizarCorreo((req.body as { docenteCorreo?: unknown })?.docenteCorreo);
  const dryRun = Boolean((req.body as { dryRun?: unknown })?.dryRun);
  if (!paqueteBase64) {
    throw new ErrorAplicacion('SYNC_PAQUETE_VACIO', 'Paquete vacio', 400);
  }

  // Guardrail simple para evitar payloads absurdos (base64 aprox 4/3 del binario).
  if (paqueteBase64.length > MAX_BASE64_CHARS) {
    throw new ErrorAplicacion('SYNC_PAQUETE_GRANDE', 'Paquete demasiado grande', 413);
  }

  const registro = await Sincronizacion.create({
    docenteId,
    estado: 'pendiente',
    tipo: 'paquete_import',
    detalles: { bytesBase64: paqueteBase64.length },
    ejecutadoEn: new Date()
  });
  const registroId = obtenerId(registro);

  try {
    const resultado = await procesarPaqueteSincronizacion({
      docenteId: String(docenteId),
      paqueteBase64,
      checksumEsperado: checksumEsperado || undefined,
      docenteCorreo: docenteCorreo || undefined,
      dryRun,
      registroId
    });
    res.json(resultado);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        { $set: { estado: 'fallido', detalles: { error: errorMsg } } }
      );
    }
    throw error;
  }
}

export async function enviarPaqueteServidor(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw crearErrorServidorSincronizacionNoConfigurado('SYNC_SERVIDOR_NO_CONFIG');
  }

  const periodoId = String((req.body as { periodoId?: unknown })?.periodoId ?? '').trim();
  const desdeRaw = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const incluirPdfs = (req.body as { incluirPdfs?: unknown })?.incluirPdfs !== false;

  const desde = desdeRaw ? parsearFechaIso(desdeRaw) : await obtenerFechaUltimoPush(String(docenteId));
  if (desdeRaw && !desde) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }

  const registro = await Sincronizacion.create({
    docenteId,
    estado: 'pendiente',
    tipo: 'sync_push',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null },
    ejecutadoEn: new Date()
  });
  const registroId = obtenerId(registro);

  try {
    const { paquete, paqueteBase64, checksumSha256, exportadoEn } = await generarPaqueteSincronizacion({
      docenteId: String(docenteId),
      periodoId: periodoId || undefined,
      desde: desde || undefined,
      incluirPdfs
    });

    const totalRegistros = Object.values(paquete.conteos).reduce((acc, valor) => acc + (Number(valor) || 0), 0);
    if (totalRegistros === 0) {
      if (registroId) {
        await Sincronizacion.updateOne(
          { _id: registroId },
          {
            $set: {
              estado: 'exitoso',
              detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, sinCambios: true, exportadoEn }
            }
          }
        );
      }
      res.json({ mensaje: 'Sin cambios para enviar', conteos: paquete.conteos, exportadoEn });
      return;
    }

    const respuesta = await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configuracion.portalApiKey
      },
      body: JSON.stringify({
        docenteId: String(docenteId),
        paqueteBase64,
        checksumSha256,
        schemaVersion: 1,
        exportadoEn,
        ...(desde ? { desde: desde.toISOString() } : {}),
        ...(periodoId ? { periodoId } : {}),
        conteos: paquete.conteos
      })
    });

    const payload = (await respuesta.json().catch(() => ({}))) as { cursor?: string; error?: { mensaje?: string } };
    if (!respuesta.ok) {
      throw new ErrorAplicacion('SYNC_PUSH_FALLIDO', payload?.error?.mensaje || 'No se pudo enviar el paquete', 502);
    }

    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        {
          $set: {
            estado: 'exitoso',
            detalles: {
              periodoId: periodoId || null,
              desde: desde?.toISOString() || null,
              exportadoEn,
              conteos: paquete.conteos,
              cursor: payload?.cursor || null
            }
          }
        }
      );
    }

    res.json({
      mensaje: 'Paquete enviado',
      conteos: paquete.conteos,
      exportadoEn,
      cursor: payload?.cursor || null
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        { $set: { estado: 'fallido', detalles: { error: errorMsg } } }
      );
    }
    throw normalizarErrorServidorSincronizacion(error);
  }
}

export async function traerPaquetesServidor(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw crearErrorServidorSincronizacionNoConfigurado('SYNC_SERVIDOR_NO_CONFIG');
  }

  const desdeRaw = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const limiteRaw = (req.body as { limite?: unknown })?.limite;
  const limite = Math.min(20, Math.max(1, Number(limiteRaw) || 6));

  const cursorDesde = desdeRaw || (await obtenerCursorUltimoPull(String(docenteId))) || undefined;
  if (desdeRaw && !parsearFechaIso(desdeRaw)) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }

  const registro = await Sincronizacion.create({
    docenteId,
    estado: 'pendiente',
    tipo: 'sync_pull',
    detalles: { desde: cursorDesde || null, limite },
    ejecutadoEn: new Date()
  });
  const registroId = obtenerId(registro);

  try {
    const respuesta = await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configuracion.portalApiKey
      },
      body: JSON.stringify({
        docenteId: String(docenteId),
        ...(cursorDesde ? { desde: cursorDesde } : {}),
        limite
      })
    });

    const payload = (await respuesta.json().catch(() => ({}))) as {
      paquetes?: Array<{
        paqueteBase64?: string;
        checksumSha256?: string;
        cursor?: string;
      }>;
      ultimoCursor?: string | null;
      error?: { mensaje?: string };
    };

    if (!respuesta.ok) {
      throw new ErrorAplicacion('SYNC_PULL_FALLIDO', payload?.error?.mensaje || 'No se pudieron obtener paquetes', 502);
    }

    const paquetes = Array.isArray(payload.paquetes) ? payload.paquetes : [];
    if (paquetes.length === 0) {
      if (registroId) {
        await Sincronizacion.updateOne(
          { _id: registroId },
          {
            $set: {
              estado: 'exitoso',
              detalles: { desde: cursorDesde || null, limite, sinCambios: true, cursor: payload?.ultimoCursor || null }
            }
          }
        );
      }
      res.json({ mensaje: 'Sin cambios', paquetesRecibidos: 0, ultimoCursor: payload?.ultimoCursor || null });
      return;
    }

    const resultados = [] as Array<Record<string, unknown>>;
    let pdfsGuardados = 0;
    let ultimoCursor = payload?.ultimoCursor || null;

    for (const paquete of paquetes) {
      const paqueteBase64 = String(paquete?.paqueteBase64 ?? '').trim();
      if (!paqueteBase64) continue;
      if (paqueteBase64.length > MAX_BASE64_CHARS) {
        throw new ErrorAplicacion('SYNC_PAQUETE_GRANDE', 'Paquete demasiado grande', 413);
      }

      const resultado = await procesarPaqueteSincronizacion({
        docenteId: String(docenteId),
        paqueteBase64,
        checksumEsperado: paquete.checksumSha256 ? String(paquete.checksumSha256) : undefined,
        dryRun: false,
        registroId: undefined
      });
      if (resultado && Array.isArray(resultado.resultados)) {
        resultados.push(...(resultado.resultados as Array<Record<string, unknown>>));
      }
      if (typeof resultado.pdfsGuardados === 'number') {
        pdfsGuardados += resultado.pdfsGuardados;
      }
      if (paquete.cursor) {
        ultimoCursor = paquete.cursor;
      }
    }

    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        {
          $set: {
            estado: 'exitoso',
            detalles: {
              desde: cursorDesde || null,
              limite,
              cursor: ultimoCursor,
              paquetesRecibidos: paquetes.length,
              pdfsGuardados
            }
          }
        }
      );
    }

    res.json({
      mensaje: 'Paquetes aplicados',
      paquetesRecibidos: paquetes.length,
      ultimoCursor,
      pdfsGuardados
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        { $set: { estado: 'fallido', detalles: { error: errorMsg } } }
      );
    }
    throw normalizarErrorServidorSincronizacion(error);
  }
}
