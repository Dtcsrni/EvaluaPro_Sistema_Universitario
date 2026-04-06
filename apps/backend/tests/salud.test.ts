/**
 * salud.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del endpoint de salud.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';

describe('salud', () => {
  it('responde con estado ok y metadata de DB', async () => {
    const app = crearApp();
    const respuesta = await request(app).get('/api/salud').expect(200);

    expect(respuesta.body.estado).toBe('ok');
    expect(respuesta.body.db).toEqual(
      expect.objectContaining({
        estado: expect.any(Number)
      })
    );
  });

  it('expone liveness y readiness', async () => {
    const app = crearApp();
    const live = await request(app).get('/api/salud/live').expect(200);
    expect(live.body).toEqual(
      expect.objectContaining({
        estado: 'ok',
        servicio: 'api-docente'
      })
    );

    const ready = await request(app).get('/api/salud/ready');
    expect([200, 503]).toContain(ready.status);
    expect(ready.body).toEqual(
      expect.objectContaining({
        dependencies: expect.objectContaining({
          mongodb: expect.objectContaining({
            status: expect.any(String),
            ready: expect.any(Boolean),
            state: expect.any(Number)
          })
        }),
        dependencias: expect.objectContaining({
          db: expect.objectContaining({
            estado: expect.any(Number),
            lista: expect.any(Boolean)
          })
        })
      })
    );
  });

  it('expone métricas en formato texto', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/salud/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(String(res.text)).toContain('evaluapro_http_requests_total');
    expect(String(res.text)).toContain('evaluapro_db_ready_state');
  });

  it('expone alias de métricas en /api/metrics', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/metrics').expect(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/plain');
    expect(String(res.text)).toContain('evaluapro_http_requests_total');
    expect(String(res.text)).toContain('evaluapro_omr_stage_duration_ms');
    expect(String(res.text)).toContain('evaluapro_omr_pipeline_total');
  });

  it('expone version en /api/version', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/version').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        version: expect.any(String),
        displayVersion: expect.any(String),
        build: expect.objectContaining({
          commit: expect.any(String),
          generatedAt: expect.any(String)
        })
      })
    );
  });

  it('expone version-info con repositorio y tecnologías', async () => {
    const app = crearApp();
    const res = await request(app).get('/api/salud/version-info').expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        app: expect.objectContaining({
          name: expect.any(String),
          version: expect.any(String),
          displayVersion: expect.any(String)
        }),
        repositoryUrl: expect.any(String),
        technologies: expect.any(Array)
      })
    );
    expect(String(res.body.repositoryUrl)).toContain('github.com');
    expect(Array.isArray(res.body.technologies)).toBe(true);
    if (res.body.technologies.length > 0) {
      expect(res.body.technologies[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(String),
          logoUrl: expect.any(String)
        })
      );
    }
  });
});

