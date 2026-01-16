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
import { enviarCorreo } from '../../infraestructura/correo/servicioCorreo';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';

function generarCodigoSimple() {
  // 8 hex chars (A-F0-9) en mayusculas: simple de dictar y transcribir.
  return randomBytes(4).toString('hex').toUpperCase();
}

function comprimirBase64(buffer: Buffer) {
  return gzipSync(buffer).toString('base64');
}

function descomprimirBase64(base64: string) {
  const bytes = Buffer.from(String(base64 || ''), 'base64');
  return gunzipSync(bytes);
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

type PaqueteSincronizacionV1 = {
  schemaVersion: 1;
  exportadoEn: string;
  docenteId: string;
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
  pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string }>;
};

async function upsertLwwPorUpdatedAt({
  modelName,
  Model,
  docs
}: {
  modelName: string;
  Model: { findById: (id: unknown) => any; findOneAndUpdate: (f: any, u: any, o: any) => any };
  docs: Array<Record<string, unknown>>;
}) {
  let aplicados = 0;
  let omitidos = 0;

  for (const doc of docs) {
    const id = doc?._id;
    if (!id) continue;

    const incomingUpdatedAt = new Date(String((doc as { updatedAt?: unknown })?.updatedAt ?? (doc as { createdAt?: unknown })?.createdAt ?? 0));
    const existente = await Model.findById(id).select('updatedAt').lean();
    const existenteUpdatedAt = existente?.updatedAt ? new Date(existente.updatedAt) : null;
    if (existenteUpdatedAt && Number.isFinite(existenteUpdatedAt.getTime()) && existenteUpdatedAt >= incomingUpdatedAt) {
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
    throw new ErrorAplicacion('PORTAL_NO_CONFIG', 'Portal alumno no configurado', 500);
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
  const periodoId = String((req.body as { periodoId?: unknown })?.periodoId ?? '').trim();
  const desdeRaw = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const incluirPdfs = (req.body as { incluirPdfs?: unknown })?.incluirPdfs !== false;

  const desde = desdeRaw ? new Date(desdeRaw) : null;
  if (desde && !Number.isFinite(desde.getTime())) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }

  const filtroPeriodo = periodoId ? { _id: periodoId, docenteId } : { docenteId };
  const periodos = await Periodo.find(filtroPeriodo).lean();
  if (periodoId && periodos.length === 0) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const periodoIds = periodos.map((p) => String((p as unknown as { _id?: unknown })?._id ?? '')).filter(Boolean);

  const filtroDesde = (desde ? { updatedAt: { $gte: desde } } : {}) as Record<string, unknown>;
  const filtroPeriodoIds = periodoIds.length > 0 ? { periodoId: { $in: periodoIds } } : {};

  const [
    alumnos,
    bancoPreguntas,
    plantillas,
    examenes,
    calificaciones
  ] = await Promise.all([
    Alumno.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    BancoPregunta.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    ExamenPlantilla.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    ExamenGenerado.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
    Calificacion.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean()
  ]);

  const examenesIds = examenes.map((e) => String((e as unknown as { _id?: unknown })?._id ?? '')).filter(Boolean);
  const [entregas, banderas] = await Promise.all([
    examenesIds.length > 0
      ? Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
      : Promise.resolve([]),
    examenesIds.length > 0
      ? BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
      : Promise.resolve([])
  ]);

  const pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string }> = [];
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
        const comprimido = gzipSync(contenido);
        total += comprimido.length;
        if (total > MAX_TOTAL_COMPRESSED_BYTES) break;
        pdfs.push({ examenGeneradoId: examenId, pdfComprimidoBase64: comprimido.toString('base64') });
      } catch {
        // omitir PDF si no se encuentra/no se puede leer
      }
    }
  }

  const paquete: PaqueteSincronizacionV1 = {
    schemaVersion: 1,
    exportadoEn: new Date().toISOString(),
    docenteId: String(docenteId),
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
  const paqueteBase64 = comprimirBase64(Buffer.from(json));

  await Sincronizacion.create({
    docenteId,
    estado: 'exitoso',
    tipo: 'paquete_export',
    detalles: { periodoId: periodoId || null, desde: desde?.toISOString() || null, conteos: paquete.conteos },
    ejecutadoEn: new Date()
  });

  res.json({ paqueteBase64, checksumSha256, exportadoEn: paquete.exportadoEn, conteos: paquete.conteos });
}

export async function importarPaquete(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const paqueteBase64 = String((req.body as { paqueteBase64?: unknown })?.paqueteBase64 ?? '').trim();
  if (!paqueteBase64) {
    throw new ErrorAplicacion('SYNC_PAQUETE_VACIO', 'Paquete vacio', 400);
  }

  const registro = await Sincronizacion.create({
    docenteId,
    estado: 'pendiente',
    tipo: 'paquete_import',
    detalles: { bytesBase64: paqueteBase64.length },
    ejecutadoEn: new Date()
  });

  try {
    const buffer = descomprimirBase64(paqueteBase64);
    const json = buffer.toString('utf8');
    const parsed = JSON.parse(json) as PaqueteSincronizacionV1;

    if (!parsed || parsed.schemaVersion !== 1) {
      throw new ErrorAplicacion('SYNC_VERSION', 'Version de paquete no soportada', 400);
    }
    if (String(parsed.docenteId || '') !== String(docenteId)) {
      throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', 'El paquete no corresponde a este docente', 403);
    }

    const examenesDocs = Array.isArray(parsed.examenes) ? parsed.examenes : [];
    const examenesIds = examenesDocs.map((e) => String((e as any)?._id ?? '')).filter(Boolean);

    // Importar en orden para respetar referencias basicas.
    const resultados = [] as Array<Record<string, unknown>>;
    const periodosDocs = (Array.isArray(parsed.periodos) ? parsed.periodos : []) as Array<Record<string, unknown>>;
    const alumnosDocs = (Array.isArray(parsed.alumnos) ? parsed.alumnos : []) as Array<Record<string, unknown>>;
    const bancoDocs = (Array.isArray(parsed.bancoPreguntas) ? parsed.bancoPreguntas : []) as Array<Record<string, unknown>>;
    const plantillasDocs = (Array.isArray(parsed.plantillas) ? parsed.plantillas : []) as Array<Record<string, unknown>>;
    const entregasDocs = (Array.isArray(parsed.entregas) ? parsed.entregas : []) as Array<Record<string, unknown>>;
    const calificacionesDocs = (Array.isArray(parsed.calificaciones) ? parsed.calificaciones : []) as Array<Record<string, unknown>>;
    const banderasDocs = (Array.isArray(parsed.banderas) ? parsed.banderas : []) as Array<Record<string, unknown>>;

    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Periodo', Model: Periodo as any, docs: periodosDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Alumno', Model: Alumno as any, docs: alumnosDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BancoPregunta', Model: BancoPregunta as any, docs: bancoDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenPlantilla', Model: ExamenPlantilla as any, docs: plantillasDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenGenerado', Model: ExamenGenerado as any, docs: examenesDocs }));

    // Entregas/banderas no incluyen periodoId, asi que filtramos por examenes del paquete para evitar basura.
    const entregasFiltradas = entregasDocs.filter((e) => examenesIds.includes(String((e as any)?.examenGeneradoId ?? '')));
    const banderasFiltradas = banderasDocs.filter((b) => examenesIds.includes(String((b as any)?.examenGeneradoId ?? '')));
    const calificacionesFiltradas = calificacionesDocs.filter((c) => examenesIds.includes(String((c as any)?.examenGeneradoId ?? '')));

    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Entrega', Model: Entrega as any, docs: entregasFiltradas }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Calificacion', Model: Calificacion as any, docs: calificacionesFiltradas }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BanderaRevision', Model: BanderaRevision as any, docs: banderasFiltradas }));

    // PDFs best-effort: guarda en almacen local y actualiza rutaPdf si corresponde.
    let pdfsGuardados = 0;
    const pdfs = Array.isArray(parsed.pdfs) ? parsed.pdfs : [];
    for (const item of pdfs) {
      const examenGeneradoId = String((item as any)?.examenGeneradoId ?? '').trim();
      const pdfB64 = String((item as any)?.pdfComprimidoBase64 ?? '').trim();
      if (!examenGeneradoId || !pdfB64) continue;

      const examen = await ExamenGenerado.findById(examenGeneradoId).lean();
      if (!examen) continue;

      try {
        const pdfBytes = gunzipSync(Buffer.from(pdfB64, 'base64'));
        const folio = String((examen as any)?.folio ?? 'examen').trim() || 'examen';
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

    await Sincronizacion.updateOne(
      { _id: (registro as any)?._id },
      { $set: { estado: 'exitoso', detalles: { resultados, pdfsGuardados } } }
    );

    res.json({ mensaje: 'Paquete importado', resultados, pdfsGuardados });
  } catch (error) {
    await Sincronizacion.updateOne(
      { _id: (registro as any)?._id },
      { $set: { estado: 'fallido', detalles: { error: String((error as any)?.message || error) } } }
    );
    throw error;
  }
}
