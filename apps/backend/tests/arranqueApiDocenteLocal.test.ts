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
    await expect(iniciarApiDocenteLocal({
      puerto: 0,
      conectar: async () => { throw new Error('persistencia no disponible'); },
      crearAplicacion
    })).rejects.toThrow('persistencia no disponible');
    expect(crearAplicacion).not.toHaveBeenCalled();
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
});
