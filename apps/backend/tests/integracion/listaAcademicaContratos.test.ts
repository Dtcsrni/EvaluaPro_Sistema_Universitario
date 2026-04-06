/**
 * listaAcademicaContratos.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../../src/app';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

function parsearBinario(res: NodeJS.ReadableStream & { setEncoding: (encoding: string) => void }, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('contratos de seguridad y observabilidad de lista academica', () => {
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

  it('requiere permiso analiticas:leer y periodoId para exportar', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-contrato-lista@prueba.test');

    const tokenSinPermisos = crearTokenDocente({
      docenteId: '507f1f77bcf86cd799439011',
      roles: ['rol_desconocido']
    });

    await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set({ Authorization: `Bearer ${tokenSinPermisos}` })
      .expect(403);

    await request(app).get('/api/analiticas/lista-academica-csv').set(escenario.auth).expect(400);
    await request(app).get('/api/analiticas/lista-academica-docx').set(escenario.auth).expect(400);
    await request(app).get('/api/analiticas/lista-academica-firma').set(escenario.auth).expect(400);
  });

  it('publica contadores de exportacion en /api/metrics', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-metricas-lista@prueba.test');

    await request(app)
      .get(`/api/analiticas/lista-academica-csv?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);

    await request(app)
      .get(`/api/analiticas/lista-academica-docx?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);

    await request(app)
      .get(`/api/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(escenario.periodoId)}`)
      .set(escenario.auth)
      .expect(200);

    const metricas = await request(app).get('/api/metrics').expect(200);
    const cuerpo = String(metricas.text ?? '');
    expect(cuerpo).toContain('evaluapro_lista_export_csv_total');
    expect(cuerpo).toContain('evaluapro_lista_export_docx_total');
    expect(cuerpo).toContain('evaluapro_lista_export_firma_total');
    expect(cuerpo).toContain('evaluapro_lista_export_error_total');
  });

  it('no expone token o secretos en logs durante exportacion', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-seguridad-lista@prueba.test');
    const token = escenario.token;
    const espiaLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const espiaWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const espiaError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let lineas = '';
    try {
      await request(app)
        .get(`/api/analiticas/lista-academica-firma?periodoId=${encodeURIComponent(escenario.periodoId)}`)
        .set(escenario.auth)
        .expect(200);
      lineas = [...espiaLog.mock.calls, ...espiaWarn.mock.calls, ...espiaError.mock.calls]
        .flat()
        .map((item) => String(item ?? ''))
        .join('\n');
    } finally {
      espiaLog.mockRestore();
      espiaWarn.mockRestore();
      espiaError.mockRestore();
    }
    expect(lineas).not.toContain(token);
    if (process.env.JWT_SECRETO) {
      expect(lineas).not.toContain(process.env.JWT_SECRETO);
    }
  });
});
