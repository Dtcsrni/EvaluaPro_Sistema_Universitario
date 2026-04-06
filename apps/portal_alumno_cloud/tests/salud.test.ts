/**
 * salud.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';

describe('salud portal', () => {
  it('expone salud, live y ready', async () => {
    const app = crearApp();

    const salud = await request(app).get('/api/portal/salud').expect(200);
    expect(salud.body.estado).toBe('ok');

    const live = await request(app).get('/api/portal/salud/live').expect(200);
    expect(live.body).toEqual(expect.objectContaining({ estado: 'ok', servicio: 'portal-alumno' }));

    const ready = await request(app).get('/api/portal/salud/ready');
    expect([200, 503]).toContain(ready.status);
    expect(ready.body?.dependencies?.mongodb).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        ready: expect.any(Boolean),
        state: expect.any(Number)
      })
    );
    expect(ready.body?.dependencias?.db).toEqual(
      expect.objectContaining({
        estado: expect.any(Number),
        lista: expect.any(Boolean)
      })
    );
  });

  it('expone métricas del portal', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/portal/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(String(res.text)).toContain('evaluapro_portal_http_requests_total');
    expect(String(res.text)).toContain('evaluapro_portal_db_ready_state');
  });

  it('expone version en /api/portal/version', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/portal/version').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        version: expect.any(String),
        build: expect.objectContaining({
          commit: expect.any(String),
          generatedAt: expect.any(String)
        })
      })
    );
  });
});
