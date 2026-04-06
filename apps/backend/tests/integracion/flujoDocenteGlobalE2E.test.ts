/**
 * flujoDocenteGlobalE2E.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

function parsearBinario(res: NodeJS.ReadableStream & { setEncoding: (encoding: string) => void }, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('flujo docente e2e (global)', () => {
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

  it('completa flujo global y exporta CSV/DOCX/firma consistente', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-global-e2e@prueba.test');

    const csvResp = await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);
    expect(csvResp.text).toContain(
      'matricula,apellidoPaterno,apellidoMaterno,nombre,grupo,parcial1,parcial2,global,final,observaciones,conformidadAlumno'
    );
    expect(csvResp.text).toContain(',global,');

    const docxResp = await request(app)
      .get(`/api/analiticas/lista-academica-docx?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    const docxBuffer = docxResp.body as Buffer;
    expect(Buffer.isBuffer(docxBuffer)).toBe(true);
    expect(docxBuffer.byteLength).toBeGreaterThan(0);

    const firmaResp = await request(app)
      .get(`/api/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);

    const manifiesto = firmaResp.body as {
      algoritmo: string;
      archivos: Array<{ nombre: string; sha256: string; bytes: number }>;
    };
    const csvFirmado = manifiesto.archivos.find((a) => a.nombre === 'lista-academica.csv');
    const docxFirmado = manifiesto.archivos.find((a) => a.nombre === 'lista-academica.docx');
    expect(csvFirmado?.sha256).toBe(createHash('sha256').update(Buffer.from(csvResp.text, 'utf-8')).digest('hex'));
    expect(String(docxFirmado?.sha256 ?? '')).toMatch(/^[a-f0-9]{64}$/);
  });
});
