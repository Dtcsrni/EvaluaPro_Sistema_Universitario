/**
 * Controlador HTTP de sincronizacion nube.
 *
 * Mantiene contrato de rutas y delega toda la logica de negocio a use cases.
 */
import type { Request, Response } from 'express';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { listarSincronizacionesUseCase } from './application/usecases/listarSincronizaciones';
import { generarCodigoAccesoUseCase } from './application/usecases/generarCodigoAcceso';
import { publicarResultadosUseCase } from './application/usecases/publicarResultados';
import { exportarPaqueteUseCase } from './application/usecases/exportarPaquete';
import { importarPaqueteUseCase } from './application/usecases/importarPaquete';
import { enviarPaqueteServidorUseCase } from './application/usecases/enviarPaqueteServidor';
import { traerPaquetesServidorUseCase } from './application/usecases/traerPaquetesServidor';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { exportarInstantaneaLocal as crearInstantaneaLocal, importarInstantaneaLocal as aplicarInstantaneaLocal, type MetodoDesbloqueoInstantanea } from './domain/instantaneaLocal';
import {
  adquirirLease,
  descargarInstantaneaNube,
  importarInstantaneaNube,
  liberarLease,
  obtenerEstadoLease,
  publicarInstantaneaNube,
  renovarLease
} from './domain/leaseSincronizacion';
import { configurarDirectorioSincronizacion, obtenerConfiguracionSincronizacion } from './domain/preferenciasSincronizacion';

export async function listarSincronizaciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const limite = Number(req.query.limite ?? 0);
  const payload = await listarSincronizacionesUseCase({ docenteId, limite });
  res.json(payload);
}

export async function generarCodigoAcceso(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String((req.body as { periodoId?: unknown })?.periodoId ?? '').trim();
  const payload = await generarCodigoAccesoUseCase({ docenteId, periodoId });
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
  const cuerpo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
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
