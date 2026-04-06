/**
 * Controlador HTTP de sincronizacion nube.
 *
 * Mantiene contrato de rutas y delega toda la logica de negocio a use cases.
 */
import type { Response } from 'express';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { listarSincronizacionesUseCase } from './application/usecases/listarSincronizaciones';
import { generarCodigoAccesoUseCase } from './application/usecases/generarCodigoAcceso';
import { publicarResultadosUseCase } from './application/usecases/publicarResultados';
import { exportarPaqueteUseCase } from './application/usecases/exportarPaquete';
import { importarPaqueteUseCase } from './application/usecases/importarPaquete';
import { enviarPaqueteServidorUseCase } from './application/usecases/enviarPaqueteServidor';
import { traerPaquetesServidorUseCase } from './application/usecases/traerPaquetesServidor';

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
