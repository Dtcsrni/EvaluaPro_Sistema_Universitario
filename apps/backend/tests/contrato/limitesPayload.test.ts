/**
 * limitesPayload.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { tokenDocentePrueba } from '../utils/token';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('contrato: limites de payload', () => {
  beforeAll(async () => {
    await conectarMongoTest();
    await limpiarMongoTest();
    await Docente.create({
      _id: '507f1f77bcf86cd799439011',
      nombreCompleto: 'Docente Limites',
      correo: 'docente.limites@local.test',
      roles: ['docente'],
      activo: true
    });
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('responde 413 si el JSON excede LIMITE_JSON', async () => {
    const anterior = { LIMITE_JSON: process.env.LIMITE_JSON };
    process.env.LIMITE_JSON = '1kb';

    vi.resetModules();
    const { crearApp } = await import('../../src/app');
    const app = crearApp();

    const grande = 'x'.repeat(10_000);
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: grande, correo: 'a@b.test', contrasena: '12345678' })
      .expect(413);

    expect(respuesta.body.error.codigo).toBe('PAYLOAD_DEMASIADO_GRANDE');

    process.env.LIMITE_JSON = anterior.LIMITE_JSON;
    vi.resetModules();
  });

  it(
    'rechaza imagenBase64 OMR demasiado grande',
    async () => {
    const anterior = { OMR_IMAGEN_BASE64_MAX_CHARS: process.env.OMR_IMAGEN_BASE64_MAX_CHARS };
    process.env.OMR_IMAGEN_BASE64_MAX_CHARS = '1000';

    vi.resetModules();
    const { crearApp } = await import('../../src/app');
    const app = crearApp();

    const respuesta = await request(app)
      .post('/api/omr/analizar')
      .set({ Authorization: `Bearer ${tokenDocentePrueba()}` })
      .send({ folio: 'FOLIO', numeroPagina: 1, imagenBase64: 'x'.repeat(1_200) })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');

    process.env.OMR_IMAGEN_BASE64_MAX_CHARS = anterior.OMR_IMAGEN_BASE64_MAX_CHARS;
    vi.resetModules();
    },
    15_000
  );
});

