import type { Response } from 'express';
import { calificarExamen } from './controladorCalificacion.js';
import { esquemaCalificarExamen } from './validacionesCalificacion.js';
import type { SolicitudDocente } from '../modulo_autenticacion/index.js';

export { default as rutasCalificaciones } from './rutasCalificaciones.js';

export async function calificarExamenAutomatico(args: { docenteId: string; body: unknown }) {
  const body = esquemaCalificarExamen.parse(args.body);
  return new Promise<{ statusCode: number; body: unknown }>((resolve, reject) => {
    let statusCode = 201;
    const response = {
      status(nextStatusCode: number) { statusCode = nextStatusCode; return this; },
      json(payload: unknown) { resolve({ statusCode, body: payload }); return this; }
    } as unknown as Response;
    void calificarExamen({ body, docenteId: args.docenteId } as unknown as SolicitudDocente, response).catch(reject);
  });
}
