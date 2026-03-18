import type { Response } from 'express';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  listarBundlesRecuperables,
  reconstruirDesdeBundle,
  reconstruirDesdeManifest,
  verificarArtifactsRecuperacion
} from './servicioRecuperacionExamenes';

function obtenerRoles(req: SolicitudDocente) {
  return Array.isArray(req.docenteRoles) && req.docenteRoles.length ? req.docenteRoles : ['docente'];
}

export async function listarBundles(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const items = await listarBundlesRecuperables({
    actorDocenteId: docenteId,
    actorRoles: obtenerRoles(req)
  });
  res.json({ items });
}

export async function verificarRecuperacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const resultado = await verificarArtifactsRecuperacion({
    actorDocenteId: docenteId,
    actorRoles: obtenerRoles(req),
    ...req.body
  });
  res.json(resultado);
}

export async function reconstruirManifest(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const resultado = await reconstruirDesdeManifest({
    actorDocenteId: docenteId,
    actorRoles: obtenerRoles(req),
    ...req.body
  });
  res.json(resultado);
}

export async function reconstruirBundle(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const resultado = await reconstruirDesdeBundle({
    actorDocenteId: docenteId,
    actorRoles: obtenerRoles(req),
    ...req.body
  });
  res.json(resultado);
}
