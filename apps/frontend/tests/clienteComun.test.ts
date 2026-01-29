// Pruebas del cliente comun (retry/backoff).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchConManejoErrores } from '../src/servicios_api/clienteComun';

vi.mock('../src/ui/toast/toastBus', () => ({
  emitToast: vi.fn()
}));

const toastBase = {
  toastUnreachable: { id: 'unreach', title: 'Sin conexion', message: 'Sin conexion' },
  toastServerError: { id: 'server', title: 'Error', message: () => 'Error' }
};

describe('fetchConManejoErrores', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reintenta cuando recibe status retryable y termina en OK', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const prom = fetchConManejoErrores<{ ok: boolean }>({
      fetcher,
      mensajeServicio: 'Servicio',
      retry: { intentos: 2, baseMs: 1, maxMs: 1, jitterMs: 0 },
      timeoutMs: 500,
      ...toastBase
    });

    await vi.runAllTimersAsync();
    const respuesta = await prom;

    expect(respuesta.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reintenta si el fetcher falla por red y termina en OK', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const prom = fetchConManejoErrores<{ ok: boolean }>({
      fetcher,
      mensajeServicio: 'Servicio',
      retry: { intentos: 2, baseMs: 1, maxMs: 1, jitterMs: 0 },
      timeoutMs: 500,
      ...toastBase
    });

    await vi.runAllTimersAsync();
    const respuesta = await prom;

    expect(respuesta.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
