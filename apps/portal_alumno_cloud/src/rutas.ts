/**
 * Rutas del portal alumno (solo lectura + sync).
 *
 * Superficies de acceso:
 * - Endpoints de sync/limpieza: protegidos con `x-api-key` (solo backend).
 * - Endpoints de alumno: protegidos con token de sesion (Bearer) emitido tras
 *   validar `codigo` + `matricula`.
 *
 * Nota:
 * - El portal es una vista derivada (read-model) de la informacion del backend.
 * - La telemetria se maneja best-effort (no debe interrumpir la UX).
 */
import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'zlib';
import { configuracion } from './configuracion';
import { CodigoAcceso } from './modelos/modeloCodigoAcceso';
import { AgendaAlumno } from './modelos/modeloAgendaAlumno';
import { AvisoAlumno } from './modelos/modeloAvisoAlumno';
import { EventoUsoAlumno } from './modelos/modeloEventoUsoAlumno';
import { HistorialAlumno } from './modelos/modeloHistorialAlumno';
import { MateriaAlumno } from './modelos/modeloMateriaAlumno';
import { PaqueteSyncDocente } from './modelos/modeloPaqueteSyncDocente';
import { PerfilAlumno } from './modelos/modeloPerfilAlumno';
import { ResultadoAlumno } from './modelos/modeloResultadoAlumno';
import { SolicitudRevision } from './modelos/modeloSolicitudRevision';
import { SesionAlumno } from './modelos/modeloSesionAlumno';
import { generarTokenSesion } from './servicios/servicioSesion';
import { requerirSesionAlumno, type SolicitudAlumno } from './servicios/middlewareSesion';
import { exportarMetricasPrometheus } from './infraestructura/observabilidad/metrics';

const router = Router();

function leerVersionAppPortal() {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return {
      name: String(pkg?.name || 'evaluapro'),
      version: String(pkg?.version || '0.0.0')
    };
  } catch {
    return { name: 'evaluapro', version: '0.0.0' };
  }
}

function responderError(res: Response, status: number, codigo: string, mensaje: string) {
  res.status(status).json({ error: { codigo, mensaje } });
}

/**
 * Gate de autenticacion para operaciones internas (sync desde backend).
 *
 * Se usa header en lugar de cookies para simplificar despliegue cloud.
 */
function requerirApiKey(req: Request, res: Response): boolean {
  const apiKey = req.headers['x-api-key'];
  if (!configuracion.portalApiKey || apiKey !== configuracion.portalApiKey) {
    responderError(res, 401, 'NO_AUTORIZADO', 'API key invalida');
    return false;
  }
  return true;
}

function normalizarString(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : String(valor ?? '').trim();
}

function normalizarMatricula(valor: unknown): string {
  return normalizarString(valor)
    .replace(/\s+/g, '')
    .toUpperCase();
}

function esMatriculaValida(valor: string): boolean {
  return /^CUH\d{9}$/.test(normalizarMatricula(valor));
}

function parsearFechaIso(valor: unknown): Date | null {
  if (!valor) return null;
  const texto = typeof valor === 'string' ? valor : String(valor);
  const fecha = new Date(texto);
  if (!Number.isFinite(fecha.getTime())) return null;
  return fecha;
}

function parsearLimite(valor: unknown, porDefecto: number) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

/**
 * Normaliza el numero de dias de retencion para evitar valores peligrosos.
 *
 * Esto protege contra borrados accidentales por payload malicioso o typo.
 */
function parsearDiasRetencion(valor: unknown, porDefecto: number) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  // Evita valores peligrosos (negativos o extremos) que podrían borrar demasiado.
  return Math.min(3650, Math.max(1, Math.floor(n)));
}

function tieneSoloClavesPermitidas(valor: unknown, clavesPermitidas: string[]): boolean {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const claves = Object.keys(valor as Record<string, unknown>);
  return claves.every((clave) => clavesPermitidas.includes(clave));
}

function esMetaSeguro(meta: unknown): boolean {
  if (meta == null) return true;

  if (typeof meta === 'string') return meta.length <= 500;
  if (typeof meta === 'number') return Number.isFinite(meta);
  if (typeof meta === 'boolean') return true;

  const esPrimitivo = (v: unknown) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

  if (Array.isArray(meta)) {
    if (meta.length > 50) return false;
    return meta.every((v) => {
      if (!esPrimitivo(v)) return false;
      if (typeof v === 'string' && v.length > 500) return false;
      if (typeof v === 'number' && !Number.isFinite(v)) return false;
      return true;
    });
  }

  if (typeof meta === 'object') {
    const record = meta as Record<string, unknown>;
    const claves = Object.keys(record);
    if (claves.length > 50) return false;
    return claves.every((k) => {
      if (!k || k.length > 50) return false;
      const v = record[k];
      if (!esPrimitivo(v)) return false;
      if (typeof v === 'string' && v.length > 500) return false;
      if (typeof v === 'number' && !Number.isFinite(v)) return false;
      return true;
    });
  }

  return false;
}

async function upsertColeccionAcademica(
  Model:
    | typeof PerfilAlumno
    | typeof MateriaAlumno
    | typeof AgendaAlumno
    | typeof AvisoAlumno
    | typeof HistorialAlumno,
  filtro: Record<string, unknown>,
  payload: Record<string, unknown>
) {
  await Model.updateOne(filtro, payload, { upsert: true });
}

router.get('/salud', (_req, res) => {
  res.json({ estado: 'ok', tiempoActivo: process.uptime() });
});

router.get('/salud/live', (_req, res) => {
  res.json({
    estado: 'ok',
    tiempoActivo: process.uptime(),
    servicio: 'portal-alumno',
    env: process.env.NODE_ENV ?? 'development'
  });
});

router.get('/salud/ready', (_req, res) => {
  const estadoDb = mongoose.connection.readyState;
  const textoEstado = ['desconectado', 'conectado', 'conectando', 'desconectando'][estadoDb] ?? 'desconocido';
  const lista = estadoDb === 1 || !configuracion.mongoUri;
  res.status(lista ? 200 : 503).json({
    estado: lista ? 'ok' : 'degradado',
    tiempoActivo: process.uptime(),
    dependencies: {
      mongodb: {
        status: lista ? 'ok' : 'fail',
        ready: lista,
        state: estadoDb,
        description: textoEstado
      }
    },
    dependencias: {
      db: {
        estado: estadoDb,
        descripcion: textoEstado,
        lista
      }
    }
  });
});

router.get('/version', (_req, res) => {
  const app = leerVersionAppPortal();
  res.json({
    name: app.name,
    version: app.version,
    build: {
      commit: String(process.env.GITHUB_SHA || '').trim() || 'local',
      generatedAt: new Date().toISOString()
    }
  });
});

router.get('/metrics', (_req, res) => {
  const estadoDb = mongoose.connection.readyState;
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(
    `${exportarMetricasPrometheus()}\n\n# HELP evaluapro_portal_db_ready_state Estado de conexión MongoDB del portal (0-3)\n# TYPE evaluapro_portal_db_ready_state gauge\nevaluapro_portal_db_ready_state ${estadoDb}\n`
  );
});

router.post('/sincronizar', async (req, res) => {
  if (!requerirApiKey(req, res)) return;

  const clavesSyncPermitidas = [
    'schemaVersion',
    'docenteId',
    'periodo',
    'alumnos',
    'calificaciones',
    'examenes',
    'banderas',
    'codigoAcceso',
    'perfilAlumno',
    'materiasAlumno',
    'agendaAlumno',
    'avisosAlumno',
    'historialAlumno'
  ];
  if (!tieneSoloClavesPermitidas(req.body ?? {}, clavesSyncPermitidas)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const {
    schemaVersion,
    periodo,
    alumnos,
    calificaciones,
    examenes,
    banderas,
    codigoAcceso,
    perfilAlumno,
    materiasAlumno,
    agendaAlumno,
    avisosAlumno,
    historialAlumno
  } = req.body ?? {};

  const schemaVersionNumerica = Number(schemaVersion ?? 2);
  if (schemaVersion !== undefined && schemaVersionNumerica !== 2 && schemaVersionNumerica !== 3) {
    responderError(res, 400, 'VERSION_INVALIDA', 'Version de payload no soportada');
    return;
  }

  if (!periodo || !Array.isArray(alumnos) || !Array.isArray(calificaciones)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload incompleto');
    return;
  }

  if (!tieneSoloClavesPermitidas(periodo, ['_id'])) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  if (!Array.isArray(examenes) && examenes != null) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  if (!Array.isArray(banderas) && banderas != null) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  if (codigoAcceso != null && !tieneSoloClavesPermitidas(codigoAcceso, ['codigo', 'expiraEn'])) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  if (perfilAlumno != null && !Array.isArray(perfilAlumno)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }
  if (materiasAlumno != null && !Array.isArray(materiasAlumno)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }
  if (agendaAlumno != null && !Array.isArray(agendaAlumno)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }
  if (avisosAlumno != null && !Array.isArray(avisosAlumno)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }
  if (historialAlumno != null && !Array.isArray(historialAlumno)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const clavesAlumnoPermitidas = ['_id', 'matricula', 'nombreCompleto', 'grupo'];
  for (const alumno of alumnos) {
    if (!tieneSoloClavesPermitidas(alumno, clavesAlumnoPermitidas)) {
      responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
      return;
    }
  }

  const clavesCalificacionPermitidas = [
    'docenteId',
    'alumnoId',
    'examenGeneradoId',
    'tipoExamen',
    'totalReactivos',
    'aciertos',
    'calificacionExamenFinalTexto',
    'calificacionParcialTexto',
    'calificacionGlobalTexto',
    'evaluacionContinuaTexto',
    'proyectoTexto',
    'politicaId',
    'versionPolitica',
    'componentesExamen',
    'bloqueContinuaDecimal',
    'bloqueExamenesDecimal',
    'finalDecimal',
    'finalRedondeada',
    'respuestasDetectadas',
    'comparativaRespuestas',
    'omrCapturas',
    'omrAuditoria'
  ];
  for (const calificacion of calificaciones) {
    if (!tieneSoloClavesPermitidas(calificacion, clavesCalificacionPermitidas)) {
      responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
      return;
    }
  }

  const clavesExamenPermitidas = ['examenGeneradoId', 'folio', 'pdfComprimidoBase64'];
  for (const examen of ((examenes || []) as unknown[])) {
    if (!tieneSoloClavesPermitidas(examen, clavesExamenPermitidas)) {
      responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
      return;
    }
  }

  const clavesBanderaPermitidas = ['examenGeneradoId', 'alumnoId', 'tipo', 'severidad', 'descripcion', 'sugerencia'];
  for (const bandera of ((banderas || []) as unknown[])) {
    if (!tieneSoloClavesPermitidas(bandera, clavesBanderaPermitidas)) {
      responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
      return;
    }
  }

  if (codigoAcceso?.codigo) {
    const expira = new Date(codigoAcceso.expiraEn);
    if (!(expira instanceof Date) || Number.isNaN(expira.getTime())) {
      responderError(res, 400, 'PAYLOAD_INVALIDO', 'codigoAcceso.expiraEn invalido');
      return;
    }
    await CodigoAcceso.updateOne(
      { codigo: codigoAcceso.codigo },
      { codigo: codigoAcceso.codigo, periodoId: periodo._id, expiraEn: expira, usado: false },
      { upsert: true }
    );
  }

  type AlumnoSync = { _id?: unknown; matricula?: string; nombreCompleto?: string; grupo?: string };
  type ExamenSync = { examenGeneradoId?: unknown; folio?: string; pdfComprimidoBase64?: string };
  type BanderaSync = { examenGeneradoId?: unknown } & Record<string, unknown>;

  const alumnosMap = new Map<string, AlumnoSync>(
    (alumnos as AlumnoSync[]).map((alumno) => [String(alumno._id), alumno])
  );
  const examenesMap = new Map<string, ExamenSync>(
    ((examenes || []) as ExamenSync[]).map((examen) => [String(examen.examenGeneradoId), examen])
  );
  const banderasMap = new Map<string, BanderaSync[]>();
  ((banderas || []) as BanderaSync[]).forEach((bandera) => {
    const clave = String(bandera.examenGeneradoId);
    const lista = banderasMap.get(clave) ?? [];
    lista.push(bandera);
    banderasMap.set(clave, lista);
  });

  // Upsert por folio: el portal se mantiene idempotente frente a reintentos.
  for (const calificacion of calificaciones) {
    const alumno = alumnosMap.get(String(calificacion.alumnoId));
    if (!alumno) continue;

    const examen = examenesMap.get(String(calificacion.examenGeneradoId));
    const banderasExamen = banderasMap.get(String(calificacion.examenGeneradoId)) ?? [];

    const folioNormalizado =
      typeof examen?.folio === 'string' && examen.folio.trim() ? examen.folio.trim() : String(calificacion.examenGeneradoId);

    await ResultadoAlumno.updateOne(
      { folio: folioNormalizado },
      {
        periodoId: periodo._id,
        docenteId: calificacion.docenteId,
        alumnoId: calificacion.alumnoId,
        examenGeneradoId: calificacion.examenGeneradoId,
        matricula: typeof alumno.matricula === 'string' ? normalizarMatricula(alumno.matricula) : undefined,
        nombreCompleto: typeof alumno.nombreCompleto === 'string' ? alumno.nombreCompleto.trim() : undefined,
        grupo: typeof alumno.grupo === 'string' ? alumno.grupo.trim() : undefined,
        folio: folioNormalizado,
        tipoExamen: calificacion.tipoExamen,
        totalReactivos: calificacion.totalReactivos,
        aciertos: calificacion.aciertos,
        calificacionExamenFinalTexto: calificacion.calificacionExamenFinalTexto,
        calificacionParcialTexto: calificacion.calificacionParcialTexto,
        calificacionGlobalTexto: calificacion.calificacionGlobalTexto,
        evaluacionContinuaTexto: calificacion.evaluacionContinuaTexto,
        proyectoTexto: calificacion.proyectoTexto,
        politicaId: calificacion.politicaId,
        versionPolitica: calificacion.versionPolitica,
        componentesExamen: calificacion.componentesExamen,
        bloqueContinuaDecimal: calificacion.bloqueContinuaDecimal,
        bloqueExamenesDecimal: calificacion.bloqueExamenesDecimal,
        finalDecimal: calificacion.finalDecimal,
        finalRedondeada: calificacion.finalRedondeada,
        respuestasDetectadas: Array.isArray(calificacion.respuestasDetectadas) ? calificacion.respuestasDetectadas : [],
        comparativaRespuestas: Array.isArray(calificacion.comparativaRespuestas) ? calificacion.comparativaRespuestas : [],
        omrCapturas: Array.isArray(calificacion.omrCapturas) ? calificacion.omrCapturas : [],
        omrAuditoria: calificacion.omrAuditoria && typeof calificacion.omrAuditoria === 'object' ? calificacion.omrAuditoria : undefined,
        banderas: banderasExamen,
        pdfComprimidoBase64: typeof examen?.pdfComprimidoBase64 === 'string' ? examen.pdfComprimidoBase64 : undefined
      },
      { upsert: true }
    );
  }

  // Read-model académico para portal alumno (TV3 ready).
  const perfilLista = Array.isArray(perfilAlumno) ? perfilAlumno : [];
  for (const item of perfilLista) {
    const alumnoId = String((item as { alumnoId?: unknown }).alumnoId ?? '').trim();
    if (!alumnoId) continue;
    await upsertColeccionAcademica(
      PerfilAlumno,
      { periodoId: periodo._id, alumnoId },
      {
        periodoId: periodo._id,
        alumnoId,
        matricula: String((item as { matricula?: unknown }).matricula ?? '').trim(),
        nombreCompleto: String((item as { nombreCompleto?: unknown }).nombreCompleto ?? '').trim(),
        grupo: String((item as { grupo?: unknown }).grupo ?? '').trim() || undefined,
        docenteId: String((item as { docenteId?: unknown }).docenteId ?? '').trim() || undefined,
        metadata: (item as { metadata?: unknown }).metadata
      }
    );
  }

  const materiasLista = Array.isArray(materiasAlumno) ? materiasAlumno : [];
  for (const item of materiasLista) {
    const alumnoId = String((item as { alumnoId?: unknown }).alumnoId ?? '').trim();
    const materiaId = String((item as { materiaId?: unknown }).materiaId ?? '').trim();
    if (!alumnoId || !materiaId) continue;
    await upsertColeccionAcademica(
      MateriaAlumno,
      { periodoId: periodo._id, alumnoId, materiaId },
      {
        periodoId: periodo._id,
        alumnoId,
        materiaId,
        nombre: String((item as { nombre?: unknown }).nombre ?? '').trim(),
        docente: String((item as { docente?: unknown }).docente ?? '').trim() || undefined,
        estado: String((item as { estado?: unknown }).estado ?? 'activa').trim() || 'activa',
        metadata: (item as { metadata?: unknown }).metadata
      }
    );
  }

  const agendaLista = Array.isArray(agendaAlumno) ? agendaAlumno : [];
  for (const item of agendaLista) {
    const alumnoId = String((item as { alumnoId?: unknown }).alumnoId ?? '').trim();
    const agendaId = String((item as { agendaId?: unknown }).agendaId ?? '').trim();
    if (!alumnoId || !agendaId) continue;
    const fecha = parsearFechaIso((item as { fecha?: unknown }).fecha) ?? new Date();
    await upsertColeccionAcademica(
      AgendaAlumno,
      { periodoId: periodo._id, alumnoId, agendaId },
      {
        periodoId: periodo._id,
        alumnoId,
        agendaId,
        titulo: String((item as { titulo?: unknown }).titulo ?? '').trim(),
        descripcion: String((item as { descripcion?: unknown }).descripcion ?? '').trim() || undefined,
        fecha,
        tipo: String((item as { tipo?: unknown }).tipo ?? 'evento').trim() || 'evento',
        metadata: (item as { metadata?: unknown }).metadata
      }
    );
  }

  const avisosLista = Array.isArray(avisosAlumno) ? avisosAlumno : [];
  for (const item of avisosLista) {
    const alumnoId = String((item as { alumnoId?: unknown }).alumnoId ?? '').trim();
    const avisoId = String((item as { avisoId?: unknown }).avisoId ?? '').trim();
    if (!alumnoId || !avisoId) continue;
    const publicadoEn = parsearFechaIso((item as { publicadoEn?: unknown }).publicadoEn) ?? new Date();
    await upsertColeccionAcademica(
      AvisoAlumno,
      { periodoId: periodo._id, alumnoId, avisoId },
      {
        periodoId: periodo._id,
        alumnoId,
        avisoId,
        titulo: String((item as { titulo?: unknown }).titulo ?? '').trim(),
        mensaje: String((item as { mensaje?: unknown }).mensaje ?? '').trim(),
        severidad: String((item as { severidad?: unknown }).severidad ?? 'info').trim() || 'info',
        publicadoEn,
        metadata: (item as { metadata?: unknown }).metadata
      }
    );
  }

  const historialLista = Array.isArray(historialAlumno) ? historialAlumno : [];
  for (const item of historialLista) {
    const alumnoId = String((item as { alumnoId?: unknown }).alumnoId ?? '').trim();
    const historialId = String((item as { historialId?: unknown }).historialId ?? '').trim();
    if (!alumnoId || !historialId) continue;
    const fecha = parsearFechaIso((item as { fecha?: unknown }).fecha) ?? new Date();
    await upsertColeccionAcademica(
      HistorialAlumno,
      { periodoId: periodo._id, alumnoId, historialId },
      {
        periodoId: periodo._id,
        alumnoId,
        historialId,
        folio: String((item as { folio?: unknown }).folio ?? '').trim() || undefined,
        tipoExamen: String((item as { tipoExamen?: unknown }).tipoExamen ?? '').trim() || undefined,
        calificacionTexto: String((item as { calificacionTexto?: unknown }).calificacionTexto ?? '').trim() || undefined,
        aciertos: Number((item as { aciertos?: unknown }).aciertos ?? 0),
        totalReactivos: Number((item as { totalReactivos?: unknown }).totalReactivos ?? 0),
        fecha,
        metadata: (item as { metadata?: unknown }).metadata
      }
    );
  }

  res.json({ mensaje: 'Sincronizacion aplicada', schemaVersion: schemaVersionNumerica });
});

router.post('/sincronizacion-docente/push', async (req, res) => {
  if (!requerirApiKey(req, res)) return;

  const clavesPermitidas = [
    'docenteId',
    'paqueteBase64',
    'checksumSha256',
    'schemaVersion',
    'exportadoEn',
    'desde',
    'periodoId',
    'conteos'
  ];
  if (!tieneSoloClavesPermitidas(req.body ?? {}, clavesPermitidas)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const docenteId = normalizarString((req.body ?? {}).docenteId);
  const paqueteBase64 = normalizarString((req.body ?? {}).paqueteBase64);
  const checksumSha256 = normalizarString((req.body ?? {}).checksumSha256);
  const schemaVersion = Number((req.body ?? {}).schemaVersion ?? 2);

  if (!docenteId || !paqueteBase64) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload incompleto');
    return;
  }
  if (paqueteBase64.length > 60_000_000) {
    responderError(res, 413, 'PAQUETE_GRANDE', 'Paquete demasiado grande');
    return;
  }
  if (schemaVersion !== 2 && schemaVersion !== 3) {
    responderError(res, 400, 'VERSION_INVALIDA', 'Version de paquete no soportada');
    return;
  }

  const exportadoEn = parsearFechaIso((req.body ?? {}).exportadoEn) ?? new Date();
  const desde = parsearFechaIso((req.body ?? {}).desde);
  const periodoId = normalizarString((req.body ?? {}).periodoId);
  const conteos = (req.body ?? {}).conteos;

  const registro = await PaqueteSyncDocente.create({
    docenteId,
    paqueteBase64,
    checksumSha256: checksumSha256 || undefined,
    schemaVersion,
    exportadoEn,
    desde: desde || undefined,
    periodoId: periodoId || undefined,
    conteos: conteos ?? undefined
  });

  res.json({
    mensaje: 'Paquete recibido',
    cursor: registro?.createdAt ? new Date(registro.createdAt).toISOString() : null
  });
});

router.post('/sincronizacion-docente/pull', async (req, res) => {
  if (!requerirApiKey(req, res)) return;

  const clavesPermitidas = ['docenteId', 'desde', 'limite'];
  if (!tieneSoloClavesPermitidas(req.body ?? {}, clavesPermitidas)) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const docenteId = normalizarString((req.body ?? {}).docenteId);
  if (!docenteId) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'docenteId requerido');
    return;
  }

  const desde = parsearFechaIso((req.body ?? {}).desde);
  const limite = parsearLimite((req.body ?? {}).limite, 6);
  const filtro: Record<string, unknown> = { docenteId };
  if (desde) filtro.createdAt = { $gt: desde };

  const paquetes = await PaqueteSyncDocente.find(filtro).sort({ createdAt: 1 }).limit(limite).lean();
  const respuesta = paquetes.map((paquete) => ({
    paqueteBase64: paquete.paqueteBase64,
    checksumSha256: paquete.checksumSha256,
    schemaVersion: paquete.schemaVersion,
    exportadoEn: paquete.exportadoEn ? new Date(paquete.exportadoEn).toISOString() : undefined,
    desde: paquete.desde ? new Date(paquete.desde).toISOString() : undefined,
    periodoId: paquete.periodoId ? String(paquete.periodoId) : undefined,
    conteos: paquete.conteos,
    cursor: paquete.createdAt ? new Date(paquete.createdAt).toISOString() : undefined
  }));

  res.json({
    paquetes: respuesta,
    ultimoCursor: respuesta.length ? respuesta[respuesta.length - 1].cursor : null
  });
});

router.post('/ingresar', async (req, res) => {
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['codigo', 'matricula'])) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Payload invalido');
    return;
  }

  const { codigo, matricula } = req.body ?? {};
  if (!codigo || !matricula) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Codigo y matricula requeridos');
    return;
  }

  const codigoNormalizado = normalizarString(codigo).toUpperCase();
  const matriculaNormalizada = normalizarMatricula(matricula);
  if (!esMatriculaValida(matriculaNormalizada)) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Matricula invalida. Formato esperado: CUH######### (ej. CUH512410168).');
    return;
  }
  const registro = await CodigoAcceso.findOne({ codigo: codigoNormalizado, usado: false });
  if (!registro || registro.expiraEn < new Date()) {
    responderError(res, 401, 'CODIGO_INVALIDO', 'Codigo invalido o expirado');
    return;
  }

  const resultado = await ResultadoAlumno.findOne({ periodoId: registro.periodoId, matricula: matriculaNormalizada }).lean();
  if (!resultado) {
    responderError(res, 404, 'ALUMNO_NO_ENCONTRADO', 'No hay resultados para la matricula');
    return;
  }

  // Codigo de acceso de un solo uso.
  registro.usado = true;
  await registro.save();

  // Se devuelve el token al cliente, pero solo se guarda el hash en DB.
  const { token, hash } = generarTokenSesion();
  const expiraEn = new Date(Date.now() + configuracion.codigoAccesoHoras * 60 * 60 * 1000);
  await SesionAlumno.create({
    periodoId: resultado.periodoId,
    alumnoId: resultado.alumnoId,
    tokenHash: hash,
    expiraEn
  });

  res.json({ token, expiraEn, alumno: { nombreCompleto: resultado.nombreCompleto, matricula: resultado.matricula } });
});

router.post('/eventos-uso', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['eventos'])) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Payload invalido');
    return;
  }

  const eventos = Array.isArray(req.body?.eventos) ? req.body.eventos : [];
  if (!eventos.length) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'eventos requerido');
    return;
  }

  const eventosLimitados = eventos.slice(0, 100);
  const clavesEventoPermitidas = ['sessionId', 'pantalla', 'accion', 'exito', 'duracionMs', 'meta'];
  for (const evento of eventosLimitados) {
    if (!tieneSoloClavesPermitidas(evento, clavesEventoPermitidas)) {
      responderError(res, 400, 'DATOS_INVALIDOS', 'Payload invalido');
      return;
    }

    const meta = (evento as { meta?: unknown } | null)?.meta;
    if (!esMetaSeguro(meta)) {
      responderError(res, 400, 'DATOS_INVALIDOS', 'meta invalido');
      return;
    }
  }

  type EventoUsoSync = {
    sessionId?: unknown;
    pantalla?: unknown;
    accion?: unknown;
    exito?: unknown;
    duracionMs?: unknown;
    meta?: unknown;
  };

  const docs = (eventosLimitados as EventoUsoSync[])
    .map((evento) => {
      const accion = normalizarString(evento.accion);
      return {
        periodoId: req.periodoId,
        alumnoId: req.alumnoId,
        sessionId: typeof evento.sessionId === 'string' ? evento.sessionId : undefined,
        pantalla: typeof evento.pantalla === 'string' ? evento.pantalla : undefined,
        accion,
        exito: typeof evento.exito === 'boolean' ? evento.exito : undefined,
        duracionMs: typeof evento.duracionMs === 'number' ? evento.duracionMs : undefined,
        meta: evento.meta
      };
    })
    .filter((doc) => Boolean(doc.accion));

  if (!docs.length) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'eventos sin accion');
    return;
  }

  try {
    await EventoUsoAlumno.insertMany(docs, { ordered: false });
    res.status(201).json({ ok: true, recibidos: docs.length });
  } catch {
    // Best-effort: telemetria nunca debe tumbar el portal.
    res.status(201).json({ ok: true, recibidos: docs.length, advertencia: 'Algunos eventos no se pudieron guardar' });
  }
});

router.get('/resultados', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const resultados = await ResultadoAlumno.find({ periodoId: req.periodoId, alumnoId: req.alumnoId }).lean();
  res.json({ resultados });
});

router.get('/resultados/:folio', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const resultado = await ResultadoAlumno.findOne({ folio: req.params.folio, periodoId: req.periodoId, alumnoId: req.alumnoId }).lean();
  if (!resultado) {
    responderError(res, 404, 'NO_ENCONTRADO', 'Resultado no encontrado');
    return;
  }
  res.json({ resultado });
});

router.get('/perfil', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const perfil = await PerfilAlumno.findOne({ periodoId: req.periodoId, alumnoId: req.alumnoId }).lean();
  res.json({ ok: true, data: { perfil } });
});

router.get('/materias', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const materias = await MateriaAlumno.find({ periodoId: req.periodoId, alumnoId: req.alumnoId })
    .sort({ nombre: 1, createdAt: -1 })
    .lean();
  res.json({ ok: true, data: { materias } });
});

router.get('/agenda', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const agenda = await AgendaAlumno.find({ periodoId: req.periodoId, alumnoId: req.alumnoId })
    .sort({ fecha: -1, createdAt: -1 })
    .lean();
  res.json({ ok: true, data: { agenda } });
});

router.get('/avisos', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const avisos = await AvisoAlumno.find({ periodoId: req.periodoId, alumnoId: req.alumnoId })
    .sort({ publicadoEn: -1, createdAt: -1 })
    .lean();
  res.json({ ok: true, data: { avisos } });
});

router.get('/historial', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const historial = await HistorialAlumno.find({ periodoId: req.periodoId, alumnoId: req.alumnoId })
    .sort({ fecha: -1, createdAt: -1 })
    .lean();
  res.json({ ok: true, data: { historial } });
});

router.post('/solicitudes-revision', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['folio', 'solicitudes'])) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Payload invalido');
    return;
  }

  const folio = normalizarString((req.body as { folio?: unknown })?.folio);
  const solicitudes = Array.isArray((req.body as { solicitudes?: unknown }).solicitudes)
    ? ((req.body as { solicitudes?: unknown[] }).solicitudes ?? [])
    : [];
  if (!folio || solicitudes.length === 0) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'folio y solicitudes requeridos');
    return;
  }

  const resultado = await ResultadoAlumno.findOne({ folio, periodoId: req.periodoId, alumnoId: req.alumnoId }).lean();
  if (!resultado) {
    responderError(res, 404, 'NO_ENCONTRADO', 'Resultado no encontrado');
    return;
  }

  type SolicitudEntrada = { numeroPregunta?: unknown; comentario?: unknown };
  const ahora = new Date();
  const operaciones = (solicitudes as SolicitudEntrada[])
    .slice(0, 100)
    .map((item) => {
      const numeroPregunta = Number(item?.numeroPregunta);
      if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) return null;
      const comentario = normalizarString(item?.comentario).slice(0, 500);
      if (comentario.length < 12) return null;
      const externoId = `${folio}:${req.alumnoId}:${numeroPregunta}`;
      return SolicitudRevision.updateOne(
        { externoId },
        {
          $set: {
            periodoId: req.periodoId,
            docenteId: resultado.docenteId,
            alumnoId: req.alumnoId,
            examenGeneradoId: resultado.examenGeneradoId,
            folio,
            numeroPregunta,
            comentario,
            estado: 'pendiente',
            solicitadoEn: ahora,
            origen: 'portal'
          }
        },
        { upsert: true }
      );
    })
    .filter(Boolean);

  await Promise.all(operaciones as Array<Promise<unknown>>);
  if (operaciones.length === 0) {
    responderError(
      res,
      400,
      'COMENTARIO_OBLIGATORIO',
      'Cada solicitud debe incluir comentario obligatorio (minimo 12 caracteres)'
    );
    return;
  }

  const pendientes = await SolicitudRevision.find({ alumnoId: req.alumnoId, folio, estado: 'pendiente' })
    .sort({ numeroPregunta: 1 })
    .lean();
  res.status(201).json({ mensaje: 'Solicitudes registradas', pendientes });
});

router.post('/solicitudes-revision/conformidad', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['folio', 'conformidad'])) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'Payload invalido');
    return;
  }
  const folio = normalizarString((req.body as { folio?: unknown })?.folio);
  const conformidad = Boolean((req.body as { conformidad?: unknown })?.conformidad);
  if (!folio || !conformidad) {
    responderError(res, 400, 'DATOS_INVALIDOS', 'folio y conformidad requeridos');
    return;
  }

  const ahora = new Date();
  await SolicitudRevision.updateMany(
    { alumnoId: req.alumnoId, periodoId: req.periodoId, folio },
    { $set: { conformidadAlumno: true, conformidadActualizadaEn: ahora } }
  );
  res.json({ mensaje: 'Conformidad registrada', conformidadAlumno: true, folio });
});

router.post('/sincronizacion-docente/solicitudes-revision/pull', async (req, res) => {
  if (!requerirApiKey(req, res)) return;
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['docenteId', 'desde', 'limite'])) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const docenteId = normalizarString((req.body as { docenteId?: unknown })?.docenteId);
  if (!docenteId) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'docenteId requerido');
    return;
  }
  const desde = parsearFechaIso((req.body as { desde?: unknown })?.desde);
  const limite = parsearLimite((req.body as { limite?: unknown })?.limite, 80);
  const filtro: Record<string, unknown> = { docenteId };
  if (desde) filtro.updatedAt = { $gt: desde };

  const solicitudes = await SolicitudRevision.find(filtro).sort({ updatedAt: 1 }).limit(limite).lean();
  const respuesta = solicitudes.map((s) => ({
    externoId: s.externoId,
    docenteId: s.docenteId,
    periodoId: s.periodoId,
    alumnoId: s.alumnoId,
    examenGeneradoId: s.examenGeneradoId,
    folio: s.folio,
    numeroPregunta: s.numeroPregunta,
    comentario: s.comentario,
    estado: s.estado,
    solicitadoEn: s.solicitadoEn ? new Date(s.solicitadoEn).toISOString() : new Date().toISOString(),
    atendidoEn: s.atendidoEn ? new Date(s.atendidoEn).toISOString() : null,
    respuestaDocente: s.respuestaDocente,
    firmaDocente: s.firmaDocente,
    firmadoEn: s.firmadoEn ? new Date(s.firmadoEn).toISOString() : null,
    cerradoEn: s.cerradoEn ? new Date(s.cerradoEn).toISOString() : null,
    conformidadAlumno: Boolean(s.conformidadAlumno),
    conformidadActualizadaEn: s.conformidadActualizadaEn ? new Date(s.conformidadActualizadaEn).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString()
  }));

  res.json({
    solicitudes: respuesta,
    ultimoCursor: respuesta.length ? respuesta[respuesta.length - 1].updatedAt : null
  });
});

router.post('/sincronizacion-docente/solicitudes-revision/update', async (req, res) => {
  if (!requerirApiKey(req, res)) return;
  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['externoId', 'estado', 'respuestaDocente', 'conformidadAlumno', 'firmaDocente', 'firmadoEn', 'cerradoEn'])) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }
  const externoId = normalizarString((req.body as { externoId?: unknown })?.externoId);
  const estado = normalizarString((req.body as { estado?: unknown })?.estado).toLowerCase();
  const respuestaDocente = normalizarString((req.body as { respuestaDocente?: unknown })?.respuestaDocente).slice(0, 500);
  const firmaDocente = normalizarString((req.body as { firmaDocente?: unknown })?.firmaDocente).slice(0, 200);
  const firmadoEn = parsearFechaIso((req.body as { firmadoEn?: unknown })?.firmadoEn);
  const cerradoEn = parsearFechaIso((req.body as { cerradoEn?: unknown })?.cerradoEn);
  const conformidadAlumno = Boolean((req.body as { conformidadAlumno?: unknown })?.conformidadAlumno);
  if (!externoId) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'externoId requerido');
    return;
  }

  const update: Record<string, unknown> = {};
  if (estado === 'atendida' || estado === 'rechazada' || estado === 'pendiente') {
    update.estado = estado;
    if (estado !== 'pendiente') update.atendidoEn = new Date();
    if (estado === 'atendida') {
      update.firmadoEn = new Date();
      update.firmaDocente = 'firmado-docente';
    }
    if (estado === 'rechazada') {
      update.cerradoEn = new Date();
    }
  }
  if (respuestaDocente) update.respuestaDocente = respuestaDocente;
  if (firmaDocente) update.firmaDocente = firmaDocente;
  if (firmadoEn) update.firmadoEn = firmadoEn;
  if (cerradoEn) update.cerradoEn = cerradoEn;
  if (conformidadAlumno) {
    update.conformidadAlumno = true;
    update.conformidadActualizadaEn = new Date();
  }
  if (Object.keys(update).length === 0) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'No hay cambios para aplicar');
    return;
  }

  const actualizada = await SolicitudRevision.findOneAndUpdate(
    { externoId },
    { $set: update },
    { returnDocument: 'after' }
  ).lean();
  if (!actualizada) {
    responderError(res, 404, 'NO_ENCONTRADO', 'Solicitud no encontrada');
    return;
  }
  res.json({ solicitud: actualizada });
});

router.get('/examen/:folio', requerirSesionAlumno, async (req: SolicitudAlumno, res) => {
  const resultado = await ResultadoAlumno.findOne({ folio: req.params.folio, periodoId: req.periodoId, alumnoId: req.alumnoId }).lean();
  if (!resultado || !resultado.pdfComprimidoBase64) {
    responderError(res, 404, 'PDF_NO_DISPONIBLE', 'PDF no disponible');
    return;
  }

  try {
    // El PDF se almacena comprimido para reducir costos de almacenamiento/egreso.
    const buffer = gunzipSync(Buffer.from(resultado.pdfComprimidoBase64, 'base64'));
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  } catch {
    responderError(res, 500, 'PDF_INVALIDO', 'No se pudo abrir el PDF');
  }
});

router.post('/limpiar', async (req, res) => {
  if (!requerirApiKey(req, res)) return;

  if (!tieneSoloClavesPermitidas(req.body ?? {}, ['dias'])) {
    responderError(res, 400, 'PAYLOAD_INVALIDO', 'Payload invalido');
    return;
  }

  const { dias } = req.body ?? {};
  const diasRetencion = parsearDiasRetencion(dias, 60);
  const limite = new Date(Date.now() - diasRetencion * 24 * 60 * 60 * 1000);
  // Se purga por fecha de publicacion para no romper sincronizaciones recientes.
  await ResultadoAlumno.deleteMany({ publicadoEn: { $lt: limite } });
  res.json({ mensaje: 'Datos purgados', diasRetencion });
});

export default router;
