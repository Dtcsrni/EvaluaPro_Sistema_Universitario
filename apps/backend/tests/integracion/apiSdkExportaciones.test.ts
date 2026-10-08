/**
 * apiSdkExportaciones.test
 *
 * Responsabilidad: verificar descargas de calificaciones desde el SDK oficial
 * contra la API real usando la base aislada de integración.
 */
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';
// @ts-expect-error El cliente SDK es un módulo JavaScript sin declaraciones TypeScript.
import { EvaluaproClient } from '../../../../scripts/api/evaluapro-client.mjs';

describe('descargas de calificaciones mediante el SDK API', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('descarga CSV y XLSX autenticados por el periodo elegido y conserva sus bytes', async () => {
    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente SDK',
        correo: 'docente-sdk-exportacion@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    const token = String(registro.body.token);
    const auth = { Authorization: `Bearer ${token}` };

    const periodo = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Periodo SDK exportación', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = String(periodo.body.periodo._id);

    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({ periodoId, matricula: 'CUH512410169', nombreCompleto: 'Alumno SDK', grupo: 'A' })
      .expect(201);

    const server = app.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address() as AddressInfo;
      const client = new EvaluaproClient({ baseUrl: `http://127.0.0.1:${address.port}`, token });

      const [csv, xlsx] = await Promise.all([
        client.descargarCalificacionesCsv(periodoId),
        client.descargarCalificacionesXlsx(periodoId)
      ]);

      expect(Buffer.isBuffer(csv)).toBe(true);
      expect(csv.toString('utf8')).toContain('matricula,nombre,grupo');
      expect(csv.toString('utf8')).toContain('CUH512410169');
      expect(Buffer.isBuffer(xlsx)).toBe(true);
      expect(xlsx.subarray(0, 2).toString('ascii')).toBe('PK');
      expect(xlsx.byteLength).toBeGreaterThan(0);
    } finally {
      server.close();
      await once(server, 'close');
    }
  });
});
