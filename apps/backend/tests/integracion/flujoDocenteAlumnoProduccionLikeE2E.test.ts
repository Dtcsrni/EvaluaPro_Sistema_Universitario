/**
 * flujoDocenteAlumnoProduccionLikeE2E.test
 *
 * E2E integral cross-app:
 * backend docente -> publicacion al portal -> ingreso alumno -> resultados + PDF.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import {
  cerrarMongoTest as cerrarMongoPortalTest,
  conectarMongoTest as conectarMongoPortalTest,
  limpiarMongoTest as limpiarMongoPortalTest
} from '../../../portal_alumno_cloud/tests/utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

type AppFactory = () => import('express').Express;

function leerCounter(metricas: string, nombre: string): number {
  const linea = metricas
    .split('\n')
    .find((line) => line.startsWith(nombre))
    ?.trim();
  if (!linea) return 0;
  const parts = linea.split(' ');
  return Number(parts[parts.length - 1] ?? 0);
}

describe('flujo docente->portal->alumno (prod-like)', () => {
  let crearAppBackend: AppFactory;
  let crearAppPortal: AppFactory;
  let backendApp: import('express').Express;
  let portalApp: import('express').Express;
  let portalServer: import('node:http').Server | null = null;
  let portalUrl = '';

  beforeAll(async () => {
    await conectarMongoTest();
    await conectarMongoPortalTest();
    process.env.PORTAL_API_KEY = 'TEST_PORTAL_KEY';
    vi.resetModules();
    ({ crearApp: crearAppPortal } = await import('../../../portal_alumno_cloud/src/app'));
    portalApp = crearAppPortal();
    portalServer = await new Promise((resolve) => {
      const server = portalApp.listen(0, '127.0.0.1', () => resolve(server));
    });
    const address = portalServer.address() as AddressInfo;
    portalUrl = `http://127.0.0.1:${address.port}`;

    process.env.PORTAL_ALUMNO_URL = portalUrl;
    process.env.PORTAL_ALUMNO_API_KEY = 'TEST_PORTAL_KEY';
    vi.resetModules();
    ({ crearApp: crearAppBackend } = await import('../../src/app'));
    backendApp = crearAppBackend();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    await limpiarMongoPortalTest();
  });

  afterAll(async () => {
    if (portalServer) {
      await new Promise<void>((resolve, reject) => portalServer?.close((error) => (error ? reject(error) : resolve())));
      portalServer = null;
    }
    await cerrarMongoTest();
    await cerrarMongoPortalTest();
  });

  it('encadena flujo parcial/global y valida trazabilidad + metricas', async () => {
    const pasos: Array<{ paso: string; estado: 'ok' | 'error'; requestId?: string; detalle?: string }> = [];
    const parcial = await prepararEscenarioFlujo(backendApp, 'parcial', 'docente-parcial-cross@prueba.test');
    pasos.push({ paso: 'flujo_docente_parcial', estado: 'ok' });
    const global = await prepararEscenarioFlujo(backendApp, 'global', 'docente-global-cross@prueba.test');
    pasos.push({ paso: 'flujo_docente_global', estado: 'ok' });

    const metricsBeforeBackend = await request(backendApp).get('/api/metrics').expect(200);
    const backendReqBefore = leerCounter(String(metricsBeforeBackend.text), 'evaluapro_http_requests_total');

    const codigoResp = await request(backendApp)
      .post('/api/sincronizaciones/codigo-acceso')
      .set(global.auth)
      .send({ periodoId: global.periodoId })
      .expect(201);
    expect(codigoResp.body.codigo).toBeTruthy();
    pasos.push({
      paso: 'codigo_acceso_generado',
      estado: 'ok',
      requestId: String(codigoResp.headers['x-request-id'] ?? '')
    });

    const publicarResp = await request(backendApp)
      .post('/api/sincronizaciones/publicar')
      .set(global.auth)
      .send({ periodoId: global.periodoId })
      .expect(200);
    expect(publicarResp.body.mensaje).toContain('Publicacion');
    expect(String(publicarResp.headers['x-request-id'] ?? '')).not.toBe('');
    pasos.push({
      paso: 'publicacion_portal',
      estado: 'ok',
      requestId: String(publicarResp.headers['x-request-id'] ?? '')
    });

    const ingresoResp = await request(portalApp)
      .post('/api/portal/ingresar')
      .send({
        codigo: String(codigoResp.body.codigo),
        matricula: 'CUH512410169'
      })
      .expect(200);
    const tokenAlumno = String(ingresoResp.body.token ?? '');
    expect(tokenAlumno).not.toBe('');
    expect(String(ingresoResp.headers['x-request-id'] ?? '')).not.toBe('');
    pasos.push({
      paso: 'ingreso_alumno_portal',
      estado: 'ok',
      requestId: String(ingresoResp.headers['x-request-id'] ?? '')
    });

    const resultadosResp = await request(portalApp)
      .get('/api/portal/resultados')
      .set({ Authorization: `Bearer ${tokenAlumno}` })
      .expect(200);
    expect(Array.isArray(resultadosResp.body.resultados)).toBe(true);
    expect(resultadosResp.body.resultados.length).toBeGreaterThan(0);
    const resultadoGlobal = resultadosResp.body.resultados.find(
      (item: { tipoExamen?: string; folio?: string }) => item.tipoExamen === 'global' || item.folio === global.folio
    );
    expect(resultadoGlobal).toBeTruthy();
    pasos.push({ paso: 'consulta_resultados_portal', estado: 'ok' });

    const pdfPortal = await request(portalApp)
      .get(`/api/portal/examen/${encodeURIComponent(global.folio)}`)
      .set({ Authorization: `Bearer ${tokenAlumno}` })
      .expect(200);
    expect(String(pdfPortal.headers['content-type'] ?? '')).toContain('application/pdf');
    pasos.push({ paso: 'descarga_pdf_portal', estado: 'ok' });

    const metricsAfterBackend = await request(backendApp).get('/api/metrics').expect(200);
    const backendReqAfter = leerCounter(String(metricsAfterBackend.text), 'evaluapro_http_requests_total');
    expect(backendReqAfter).toBeGreaterThanOrEqual(backendReqBefore);

    const metricsPortal = await request(portalApp).get('/api/portal/metrics').expect(200);
    expect(String(metricsPortal.text)).toContain('evaluapro_portal_http_requests_total');
    pasos.push({ paso: 'metricas_backend_y_portal', estado: 'ok' });

    const reporte = {
      version: '1',
      ejecutadoEn: new Date().toISOString(),
      estado: 'ok',
      pasos,
      resumen: {
        periodoId: global.periodoId,
        examenId: global.examenId,
        folio: global.folio,
        alumnoId: global.alumnoId,
        folioParcial: parcial.folio
      }
    };
    const out = path.resolve(process.cwd(), 'reports/qa/latest/e2e-docente-alumno.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');
  });
});
