// Pruebas del middleware de sesion alumno.
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requerirSesionAlumno, type SolicitudAlumno } from '../src/servicios/middlewareSesion';
import { SesionAlumno } from '../src/modelos/modeloSesionAlumno';
import { hashToken } from '../src/servicios/servicioSesion';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from './utils/mongo';

function crearApp() {
  const app = express();
  app.get('/privado', requerirSesionAlumno, (req: SolicitudAlumno, res) => {
    res.json({ alumnoId: req.alumnoId, periodoId: req.periodoId });
  });
  return app;
}

describe('requerirSesionAlumno', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('rechaza cuando no hay token', async () => {
    const respuesta = await request(app).get('/privado').expect(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTORIZADO');
  });

  it('rechaza token inexistente o expirado', async () => {
    const respuesta = await request(app)
      .get('/privado')
      .set({ Authorization: 'Bearer token-invalido' })
      .expect(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('permite acceso con sesion valida', async () => {
    const alumnoId = new mongoose.Types.ObjectId();
    const periodoId = new mongoose.Types.ObjectId();
    const token = 'token-valido';

    await SesionAlumno.create({
      alumnoId,
      periodoId,
      tokenHash: hashToken(token),
      expiraEn: new Date(Date.now() + 60 * 60 * 1000)
    });

    const respuesta = await request(app)
      .get('/privado')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(respuesta.body.alumnoId).toBe(String(alumnoId));
    expect(respuesta.body.periodoId).toBe(String(periodoId));
  });
});
