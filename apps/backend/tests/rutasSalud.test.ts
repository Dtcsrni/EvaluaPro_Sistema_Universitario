/**
 * rutasSalud.test
 *
 * Responsabilidad: cubrir el contrato HTTP y utilitario de salud/versionado.
 * Limites: no alterar el contrato público `/api/salud/*`.
 */
import express from 'express';
import os from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import rutasSalud, { obtenerVersionInfo } from '../src/compartido/salud/rutasSalud';

function crearApp() {
  const app = express();
  app.use('/salud', rutasSalud);
  return app;
}

describe('rutasSalud', () => {
  const app = crearApp();
  const networkInterfacesSpy = vi.spyOn(os, 'networkInterfaces');

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1
    });
    delete process.env.HOST_IP;
    delete process.env.EVALUAPRO_DEVELOPER_NAME;
    delete process.env.EVALUAPRO_DEVELOPER_ROLE;
  });

  afterEach(() => {
    networkInterfacesSpy.mockReset();
  });

  it('expone salud general y describe el estado de la base de datos', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 2
    });

    const respuesta = await request(app).get('/salud').expect(200);

    expect(respuesta.body.estado).toBe('ok');
    expect(respuesta.body.db).toEqual({
      estado: 2,
      descripcion: 'conectando'
    });
  });

  it('reporta readiness degradado cuando MongoDB no está lista', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 0
    });

    const respuesta = await request(app).get('/salud/ready').expect(503);

    expect(respuesta.body.estado).toBe('degradado');
    expect(respuesta.body.dependencies.mongodb).toMatchObject({
      status: 'fail',
      ready: false,
      state: 0,
      description: 'desconectado'
    });
    expect(respuesta.body.dependencias.db.lista).toBe(false);
  });

  it('expone liveness y métricas Prometheus con el gauge de MongoDB', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 3
    });

    const live = await request(app).get('/salud/live').expect(200);
    expect(live.body).toMatchObject({
      estado: 'ok',
      servicio: 'api-docente'
    });

    const metrics = await request(app).get('/salud/metrics').expect(200);
    expect(String(metrics.headers['content-type'])).toContain('text/plain');
    expect(metrics.text).toContain('evaluapro_db_ready_state 3');
  });

  it('expone version-info con displayVersion, catálogo y datos del desarrollador', async () => {
    process.env.EVALUAPRO_DEVELOPER_NAME = 'QA Bot';
    process.env.EVALUAPRO_DEVELOPER_ROLE = 'Automatizacion';

    const info = obtenerVersionInfo();
    expect(info.app.version).toBeTruthy();
    expect(info.app.displayVersion).toBeTruthy();
    expect(info.repositoryUrl).toBeTruthy();
    expect(Array.isArray(info.technologies)).toBe(true);
    expect(info.developer).toEqual({
      nombre: 'QA Bot',
      rol: 'Automatizacion'
    });
    expect(typeof info.changelog).toBe('string');

    const respuesta = await request(app).get('/salud/version-info').expect(200);
    expect(respuesta.body.app.displayVersion).toBe(info.app.displayVersion);
    expect(respuesta.body.developer.nombre).toBe('QA Bot');
  });

  it('prioriza HOST_IP y ordena IPs privadas antes que públicas', async () => {
    process.env.HOST_IP = '10.10.10.5';
    networkInterfacesSpy.mockReturnValue({
      Ethernet0: [
        {
          address: '52.10.10.10',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: '52.10.10.10/24'
        },
        {
          address: '192.168.1.20',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:02',
          internal: false,
          cidr: '192.168.1.20/24'
        }
      ]
    } as ReturnType<typeof os.networkInterfaces>);

    const respuesta = await request(app).get('/salud/ip-local').expect(200);

    expect(respuesta.body.preferida).toBe('10.10.10.5');
    expect(respuesta.body.ips[0]).toBe('10.10.10.5');
    expect(Array.isArray(respuesta.body.ips)).toBe(true);
    expect(respuesta.body.ips.length).toBeGreaterThan(0);
  });

  it('genera QR PNG y valida cuando falta el texto', async () => {
    const invalida = await request(app).get('/salud/qr').expect(400);
    expect(invalida.body.error.codigo).toBe('QR_TEXTO_VACIO');

    const valida = await request(app).get('/salud/qr').query({ texto: 'FOLIO-123' }).expect(200);
    expect(String(valida.headers['content-type'])).toContain('image/png');
    expect(String(valida.headers['cache-control'])).toContain('no-store');
    expect(valida.body).toBeInstanceOf(Buffer);
    expect(valida.body.byteLength).toBeGreaterThan(0);
  });
});
