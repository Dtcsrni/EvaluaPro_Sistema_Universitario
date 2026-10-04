/**
 * Controlador HTTP de sincronizacion nube.
 *
 * Mantiene contrato de rutas y delega toda la logica de negocio a use cases.
 */
import type { Request, Response } from 'express';
import { Buffer } from 'node:buffer';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { esquemaListarCodigosAcceso } from './validacionesSincronizacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { listarSincronizacionesUseCase } from './application/usecases/listarSincronizaciones.js';
import { generarCodigoAccesoUseCase } from './application/usecases/generarCodigoAcceso.js';
import { publicarResultadosUseCase } from './application/usecases/publicarResultados.js';
import { exportarPaqueteUseCase } from './application/usecases/exportarPaquete.js';
import { importarPaqueteUseCase } from './application/usecases/importarPaquete.js';
import { enviarPaqueteServidorUseCase } from './application/usecases/enviarPaqueteServidor.js';
import { traerPaquetesServidorUseCase } from './application/usecases/traerPaquetesServidor.js';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { exportarInstantaneaLocal as crearInstantaneaLocal, importarInstantaneaLocal as aplicarInstantaneaLocal, type MetodoDesbloqueoInstantanea } from './domain/instantaneaLocal.js';
import {
  adquirirLease,
  descargarInstantaneaNube,
  importarInstantaneaNube,
  liberarLease,
  obtenerEstadoLease,
  publicarInstantaneaNube,
  renovarLease
} from './domain/leaseSincronizacion.js';
import { configurarDirectorioSincronizacion, obtenerConfiguracionSincronizacion } from './domain/preferenciasSincronizacion.js';

export async function listarSincronizaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const limite = Number(req.query.limite ?? 0);
  const payload = await listarSincronizacionesUseCase({ docenteId, limite });
  res.json(payload);
}

export async function generarCodigoAcceso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { periodoId?: unknown; clientRequestId?: unknown };
  const periodoId = String(body?.periodoId ?? '').trim();
  const clientRequestId = typeof body?.clientRequestId === 'string' ? body.clientRequestId : undefined;
  const payload = await generarCodigoAccesoUseCase({ docenteId, periodoId, clientRequestId });
  res.status(201).json(payload);
}

export async function publicarResultados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String((req.body as { periodoId?: unknown })?.periodoId ?? '').trim();
  const payload = await publicarResultadosUseCase({ docenteId, periodoId });
  res.json(payload);
}

export async function exportarPaquete(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = await exportarPaqueteUseCase({
    docenteId,
    periodoIdRaw: (req.body as { periodoId?: unknown })?.periodoId,
    desdeRaw: (req.body as { desde?: unknown })?.desde,
    incluirPdfsRaw: (req.body as { incluirPdfs?: unknown })?.incluirPdfs
  });
  res.json(payload);
}

export async function importarPaquete(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = await importarPaqueteUseCase({
    docenteId,
    paqueteBase64Raw: (req.body as { paqueteBase64?: unknown })?.paqueteBase64,
    checksumSha256Raw: (req.body as { checksumSha256?: unknown })?.checksumSha256,
    docenteCorreoRaw: (req.body as { docenteCorreo?: unknown })?.docenteCorreo,
    dryRunRaw: (req.body as { dryRun?: unknown })?.dryRun,
    backupMetaRaw: (req.body as { backupMeta?: unknown })?.backupMeta
  });
  res.json(payload);
}

export async function enviarPaqueteServidor(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = await enviarPaqueteServidorUseCase({
    docenteId,
    periodoIdRaw: (req.body as { periodoId?: unknown })?.periodoId,
    desdeRaw: (req.body as { desde?: unknown })?.desde,
    incluirPdfsRaw: (req.body as { incluirPdfs?: unknown })?.incluirPdfs
  });
  res.json(payload);
}

export async function traerPaquetesServidor(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = await traerPaquetesServidorUseCase({
    docenteId,
    desdeRaw: (req.body as { desde?: unknown })?.desde,
    limiteRaw: (req.body as { limite?: unknown })?.limite
  });
  res.json(payload);
}

export async function exportarInstantaneaLocal(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { metodo?: MetodoDesbloqueoInstantanea; credencial?: unknown };
  const resultado = await crearInstantaneaLocal({
    docenteId,
    metodo: body.metodo as MetodoDesbloqueoInstantanea,
    credencial: typeof body.credencial === 'string' ? body.credencial : undefined
  });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="evaluapro_${resultado.exportadoEn.replace(/:/g, '-').replace(/\./g, '-')}.ep-snapshot"`);
  res.setHeader('X-EvaluaPro-Snapshot-Checksum', resultado.checksumSha256);
  res.setHeader('X-EvaluaPro-Snapshot-Exported-At', resultado.exportadoEn);
  res.setHeader('X-EvaluaPro-Snapshot-Counts', JSON.stringify(resultado.conteos));
  res.setHeader('X-EvaluaPro-Snapshot-Methods', resultado.metodos.join(','));
  res.send(resultado.archivo);
}

function leerSolicitudInstantanea(req: Request): { archivo: Buffer; metodo: MetodoDesbloqueoInstantanea; credencial?: string; dryRun: boolean } {
  const cuerpoRecibido: unknown = req.body;
  if (!(cuerpoRecibido instanceof Uint8Array)) {
    throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La solicitud de importación debe ser binaria', 400);
  }
  const cuerpo = Buffer.from(cuerpoRecibido);
  if (cuerpo.length < 4) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La solicitud de importación está incompleta', 400);
  const longitudCabecera = cuerpo.readUInt32BE(0);
  if (longitudCabecera < 2 || longitudCabecera > 4096 || 4 + longitudCabecera > cuerpo.length) throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de importación es inválida', 400);
  let cabecera: { metodo?: unknown; credencial?: unknown; dryRun?: unknown };
  try { cabecera = JSON.parse(cuerpo.subarray(4, 4 + longitudCabecera).toString('utf8')) as typeof cabecera; } catch { throw new ErrorAplicacion('SYNC_INSTANTANEA_INVALIDA', 'La cabecera de importación no es válida', 400); }
  const metodo = String(cabecera.metodo || '').trim() as MetodoDesbloqueoInstantanea;
  if (metodo !== 'contrasena' && metodo !== 'google') throw new ErrorAplicacion('SYNC_METODO_INVALIDO', 'Método de desbloqueo inválido', 400);
  const credencial = typeof cabecera.credencial === 'string' ? cabecera.credencial : undefined;
  if (credencial && credencial.length > 256) throw new ErrorAplicacion('SYNC_CREDENCIAL_INVALIDA', 'La credencial es demasiado larga', 400);
  return { archivo: cuerpo.subarray(4 + longitudCabecera), metodo, credencial, dryRun: cabecera.dryRun === true };
}

export async function importarInstantaneaLocal(req: Request & { docenteId?: string }, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const solicitud = leerSolicitudInstantanea(req);
  const resultado = await aplicarInstantaneaLocal({ docenteId, ...solicitud });
  res.json(resultado);
}

function leerLeaseBody(req: Request) {
  return req.body as { equipoId?: unknown; leaseId?: unknown };
}

export async function estadoLeaseSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const equipoId = String(req.header('X-EvaluaPro-Equipo') || '').trim();
  res.json(await obtenerEstadoLease(docenteId, equipoId));
}

export async function obtenerConfiguracionCarpetaSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  res.json(await obtenerConfiguracionSincronizacion(docenteId));
}

export async function configurarCarpetaSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const directorio = String((req.body as { directorio?: unknown })?.directorio || '');
  res.json(await configurarDirectorioSincronizacion(docenteId, directorio));
}

export async function adquirirLeaseSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = leerLeaseBody(req);
  res.json(await adquirirLease(docenteId, String(body.equipoId || '')));
}

export async function renovarLeaseSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = leerLeaseBody(req);
  res.json(await renovarLease(docenteId, String(body.equipoId || ''), String(body.leaseId || '')));
}

export async function liberarLeaseSincronizacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = leerLeaseBody(req);
  res.json(await liberarLease(docenteId, String(body.equipoId || ''), String(body.leaseId || '')));
}

export async function publicarInstantaneaNubeControlada(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { equipoId?: unknown; leaseId?: unknown; metodo?: MetodoDesbloqueoInstantanea; credencial?: unknown };
  res.json(await publicarInstantaneaNube({
    docenteId,
    equipoId: String(body.equipoId || ''),
    leaseId: String(body.leaseId || ''),
    metodo: body.metodo as MetodoDesbloqueoInstantanea,
    credencial: typeof body.credencial === 'string' ? body.credencial : undefined
  }));
}

export async function descargarInstantaneaNubeControlada(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const resultado = await descargarInstantaneaNube(docenteId);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${resultado.nombreArchivo}"`);
  res.setHeader('X-EvaluaPro-Snapshot-Checksum', resultado.checksumSha256);
  res.setHeader('X-EvaluaPro-Snapshot-Exported-At', resultado.exportadoEn);
  res.setHeader('X-EvaluaPro-Snapshot-Published-At', resultado.publicadoEn);
  res.setHeader('X-EvaluaPro-Snapshot-Counts', JSON.stringify(resultado.conteos));
  res.send(resultado.archivo);
}

export async function importarInstantaneaNubeControlada(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { equipoId?: unknown; leaseId?: unknown; metodo?: MetodoDesbloqueoInstantanea; credencial?: unknown; dryRun?: unknown };
  res.json(await importarInstantaneaNube({
    docenteId,
    equipoId: String(body.equipoId || ''),
    leaseId: String(body.leaseId || ''),
    metodo: body.metodo as MetodoDesbloqueoInstantanea,
    credencial: typeof body.credencial === 'string' ? body.credencial : undefined,
    dryRun: body.dryRun === true
  }));
}


/** Lista metadatos de códigos propios sin devolver el secreto de acceso. */
export async function listarCodigosAcceso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarCodigosAcceso.safeParse(res.locals.validatedQuery ?? req.query);
  if (!filtros.success) {
    throw new ErrorAplicacion('CODIGOS_ACCESO_QUERY_INVALIDA', 'Los filtros de códigos de acceso no cumplen el contrato', 400, filtros.error.flatten());
  }

  const ahora = new Date();
  let cursor: { id: string; createdAt: Date } | undefined;
  if (filtros.data.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.data.cursor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id) || !Number.isFinite(createdAt.getTime())) {
        throw new Error('invalid cursor');
      }
      cursor = { id: decoded.id, createdAt };
    } catch {
      throw new ErrorAplicacion('CODIGO_ACCESO_CURSOR_INVALIDO', 'El cursor de códigos de acceso no es válido', 400);
    }
  }

  const estado = filtros.data.estado;
  const where: Prisma.CodigoAccesoWhereInput = {
    docenteId,
    periodo: { is: { docenteId } },
    ...(filtros.data.periodoId ? { periodoId: filtros.data.periodoId } : {}),
    ...(estado === 'vigente' ? { usado: false, expiraEn: { gt: ahora } } : {}),
    ...(estado === 'expirado' ? { usado: false, expiraEn: { lte: ahora } } : {}),
    ...(estado === 'usado' ? { usado: true } : {}),
    ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
  };
  const filas = await prisma.codigoAcceso.findMany({
    where,
    take: filtros.data.limite + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true, docenteId: true, periodoId: true, expiraEn: true, usado: true, createdAt: true, updatedAt: true,
      periodo: { select: { id: true, nombre: true } }
    }
  });
  const hayMas = filas.length > filtros.data.limite;
  const codigosAcceso = filas.slice(0, filtros.data.limite).map((codigo) => ({
    ...codigo,
    estado: codigo.usado ? 'usado' : codigo.expiraEn > ahora ? 'vigente' : 'expirado'
  }));
  const ultimo = hayMas ? codigosAcceso[codigosAcceso.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, createdAt: ultimo.createdAt.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({ codigosAcceso, nextCursor });
}

/** Consulta un código por ID bajo el dueño del periodo; nunca devuelve el secreto. */
export async function obtenerCodigoAcceso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const codigoAccesoId = String(req.params.codigoAccesoId ?? '').trim();
  const codigo = await prisma.codigoAcceso.findFirst({
    where: { id: codigoAccesoId, docenteId, periodo: { is: { docenteId } } },
    select: {
      id: true, docenteId: true, periodoId: true, expiraEn: true, usado: true, createdAt: true, updatedAt: true,
      periodo: { select: { id: true, nombre: true } }
    }
  });
  if (!codigo) throw new ErrorAplicacion('CODIGO_ACCESO_NO_ENCONTRADO', 'Código de acceso no encontrado', 404);
  const ahora = new Date();
  res.json({ codigoAcceso: { ...codigo, estado: codigo.usado ? 'usado' : codigo.expiraEn > ahora ? 'vigente' : 'expirado' } });
}


/** Expira un código local; la copia del portal requiere publicación separada. */
export async function expirarCodigoAcceso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const codigoAccesoId = String(req.params.codigoAccesoId ?? '').trim();
  const ahora = new Date();
  const resultado = await prisma.codigoAcceso.updateMany({
    where: { id: codigoAccesoId, docenteId, periodo: { is: { docenteId } }, usado: false, expiraEn: { gt: ahora } },
    data: { expiraEn: ahora }
  });
  if (resultado.count === 0) {
    const codigo = await prisma.codigoAcceso.findFirst({
      where: { id: codigoAccesoId, docenteId, periodo: { is: { docenteId } } },
      select: { id: true, usado: true, expiraEn: true }
    });
    if (!codigo) throw new ErrorAplicacion('CODIGO_ACCESO_NO_ENCONTRADO', 'Código de acceso no encontrado', 404);
  }
  res.json({ codigoAccesoId, expirado: resultado.count > 0 });
}
