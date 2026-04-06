import type { Response } from 'express';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  listarEstrategiasMonetizacion,
  listarNivelesComerciales,
  recomendarMonetizacionComunitaria
} from './servicioMonetizacionComunitaria';

export function listarOfertasMonetizacionComunitaria(req: SolicitudDocente, res: Response) {
  obtenerDocenteId(req);
  res.json({
    ofertas: listarNivelesComerciales(),
    guardrails: {
      margenBrutoMinimo: 0.6
    }
  });
}

export function listarEstrategiasMonetizacionComunitaria(req: SolicitudDocente, res: Response) {
  obtenerDocenteId(req);
  res.json({
    estrategias: listarEstrategiasMonetizacion()
  });
}

export function recomendarOfertaMonetizacionComunitaria(req: SolicitudDocente, res: Response) {
  obtenerDocenteId(req);
  const recomendacion = recomendarMonetizacionComunitaria(req.body ?? {});
  res.json({ recomendacion });
}

