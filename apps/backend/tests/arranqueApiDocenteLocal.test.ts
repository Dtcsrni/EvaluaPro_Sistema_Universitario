import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cerrarApiDocenteLocal, iniciarApiDocenteLocal } from '../src/arranqueApiDocenteLocal.js';

describe('arranque API docente local', () => {
  let servidor: Awaited<ReturnType<typeof iniciarApiDocenteLocal>> | undefined;

  afterEach(async () => {
    if (servidor?.listening) await cerrarApiDocenteLocal(servidor, async () => undefined);
    servidor = undefined;
  });

  it('conecta persistencia antes de escuchar solo en loopback y cierra limpiamente', async () => {
    const eventos: string[] = [];
    servidor = await iniciarApiDocenteLocal({
      puerto: 0,
      conectar: async () => { eventos.push('conectar'); },
      crearAplicacion: () => {
        eventos.push('crear-app');
        return express();
      }
    });

    expect(eventos).toEqual(['conectar', 'crear-app']);
    expect(servidor.address()).toMatchObject({ address: '127.0.0.1' });

    const desconectar = vi.fn(async () => undefined);
    await cerrarApiDocenteLocal(servidor, desconectar);
    servidor = undefined;
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it('no abre el servidor cuando falla la inicialización de persistencia', async () => {
    const crearAplicacion = vi.fn(() => express());
    const desconectar = vi.fn(async () => undefined);
    await expect(iniciarApiDocenteLocal({
      puerto: 0,
      conectar: async () => { throw new Error('persistencia no disponible'); },
      desconectar,
      crearAplicacion
    })).rejects.toThrow('persistencia no disponible');
    expect(crearAplicacion).not.toHaveBeenCalled();
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it('desconecta persistencia si el puerto no es válido', async () => {
    const desconectar = vi.fn(async () => undefined);
    await expect(iniciarApiDocenteLocal({
      puerto: 70_000,
      conectar: async () => undefined,
      desconectar,
      crearAplicacion: () => express()
    })).rejects.toThrow();
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it('preserva el error de arranque si falla la limpieza secundaria', async () => {
    const errorArranque = new Error('fallo de composición');
    const desconectar = vi.fn(async () => { throw new Error('fallo de desconexión'); });

    await expect(iniciarApiDocenteLocal({
      puerto: 0,
      conectar: async () => undefined,
      desconectar,
      crearAplicacion: () => { throw errorArranque; }
    })).rejects.toBe(errorArranque);
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it('comparte cierres concurrentes y desconecta una sola vez', async () => {
    servidor = await iniciarApiDocenteLocal({
      puerto: 0,
      shutdownTimeoutMs: 100,
      conectar: async () => undefined,
      crearAplicacion: () => express()
    });
    const desconectar = vi.fn(async () => undefined);

    await Promise.all([
      cerrarApiDocenteLocal(servidor, desconectar),
      cerrarApiDocenteLocal(servidor, desconectar)
    ]);
    servidor = undefined;
    expect(desconectar).toHaveBeenCalledOnce();
  });

  it('fuerza el cierre de conexiones HTTP que exceden el límite', async () => {
    let terminarSolicitud!: () => void;
    servidor = await iniciarApiDocenteLocal({
      puerto: 0,
      shutdownTimeoutMs: 20,
      conectar: async () => undefined,
      crearAplicacion: () => express().get('/lenta', (_req, res) => {
        terminarSolicitud = () => res.end('terminada');
        res.flushHeaders();
      })
    });
    const direccion = servidor.address();
    if (!direccion || typeof direccion === 'string') throw new Error('Dirección HTTP inválida');
    const http = await import('node:http');
    const solicitud = http.get(`http://127.0.0.1:${direccion.port}/lenta`);
    await new Promise<void>((resolve) => solicitud.once('response', resolve));
    const desconectar = vi.fn(async () => undefined);

    await cerrarApiDocenteLocal(servidor, desconectar);
    servidor = undefined;
    expect(desconectar).toHaveBeenCalledOnce();
    expect(terminarSolicitud).toBeTypeOf('function');
    solicitud.destroy();
  });

  it('rechaza límites de cierre no positivos o no finitos antes de conectar', async () => {
    const conectar = vi.fn(async () => undefined);
    await expect(iniciarApiDocenteLocal({
      conectar,
      shutdownTimeoutMs: 0
    })).rejects.toThrow(/shutdown/i);
    expect(conectar).not.toHaveBeenCalled();
  });
});
