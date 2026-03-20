import { afterEach, describe, expect, it, vi } from 'vitest';

describe('logger portal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.EVALUAPRO_LOG_SILENT;
    delete process.env.EVALUAPRO_SILENT_LOGS;
    vi.resetModules();
  });

  it('serializa niveles normales y errores con estructura consistente', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { log, logError } = await import('../src/infraestructura/logging/logger');

    log('ok', 'todo bien', { traceId: 't-1' });
    log('warn', 'aviso', { requestId: 'r-1' });
    logError('fallo controlado', new Error('boom'), { requestId: 'r-2' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const infoEntry = JSON.parse(String(logSpy.mock.calls[0]?.[0] || '{}'));
    expect(infoEntry.service).toBe('portal-alumno');
    expect(infoEntry.level).toBe('info');
    expect(infoEntry.traceId).toBe('t-1');

    const warnEntry = JSON.parse(String(warnSpy.mock.calls[0]?.[0] || '{}'));
    expect(warnEntry.level).toBe('warn');
    expect(warnEntry.requestId).toBe('r-1');

    const errorEntry = JSON.parse(String(errorSpy.mock.calls[0]?.[0] || '{}'));
    expect(errorEntry.level).toBe('error');
    expect(errorEntry.error.message).toBe('boom');
    expect(errorEntry.requestId).toBe('r-2');
  });

  it('silencia logs cuando la bandera operacional esta activa', async () => {
    process.env.EVALUAPRO_LOG_SILENT = 'true';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { log } = await import('../src/infraestructura/logging/logger');

    log('system', 'silenciado');

    expect(logSpy).not.toHaveBeenCalled();
  });
});
