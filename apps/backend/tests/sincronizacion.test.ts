// Pruebas del modulo de sincronizacion a nube.
import type { Response } from 'express';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { CodigoAcceso } from '../src/modulos/modulo_sincronizacion_nube/modeloCodigoAcceso';

vi.mock('../src/configuracion', () => ({
  configuracion: {
    codigoAccesoHoras: 12,
    portalAlumnoUrl: '',
    portalApiKey: ''
  }
}));

let generarCodigoAcceso: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').generarCodigoAcceso;
let publicarResultados: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').publicarResultados;

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('sincronizacion nube', () => {
  beforeAll(async () => {
    const controlador = await import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion');
    generarCodigoAcceso = controlador.generarCodigoAcceso;
    publicarResultados = controlador.publicarResultados;
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('genera codigo de acceso y lo persiste', async () => {
    const req = {
      body: { periodoId: '507f1f77bcf86cd799439011' },
      docenteId: '507f1f77bcf86cd799439012'
    } as SolicitudDocente;
    const res = crearRespuesta();

    await generarCodigoAcceso(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { codigo: string };
    expect(payload.codigo).toHaveLength(8);

    const registro = await CodigoAcceso.findOne({ codigo: payload.codigo }).lean();
    expect(registro).toBeTruthy();
    expect(String(registro?.docenteId)).toBe(req.docenteId);
  });

  it('falla si el portal alumno no esta configurado', async () => {
    const req = {
      body: { periodoId: '507f1f77bcf86cd799439011' },
      docenteId: '507f1f77bcf86cd799439012'
    } as SolicitudDocente;

    await expect(publicarResultados(req, crearRespuesta())).rejects.toMatchObject({
      codigo: 'PORTAL_NO_CONFIG'
    });
  });
});
