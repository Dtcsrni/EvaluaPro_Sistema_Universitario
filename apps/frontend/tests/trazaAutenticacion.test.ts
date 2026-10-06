import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportarTrazaAutenticacion,
  leerTrazaAutenticacion,
  registrarEventoTrazabilidadAutenticacion
} from '../src/apps/app_docente/trazaAutenticacion';

const flowId = 'b7a0a8f6-8d17-4d87-8e8c-41c39fcb2390';

describe('trazaAutenticacion', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('mantiene solo los 80 eventos más recientes y exporta campos permitidos', () => {
    for (let index = 0; index < 90; index += 1) {
      registrarEventoTrazabilidadAutenticacion({
        flowId,
        canal: 'google',
        etapa: 'solicitud_api',
        resultado: 'exito',
        duracionMs: index
      });
    }

    const eventos = leerTrazaAutenticacion();
    expect(eventos).toHaveLength(80);
    expect(eventos[0]?.duracionMs).toBe(10);
    expect(JSON.parse(exportarTrazaAutenticacion()).eventos).toHaveLength(80);
  });

  it('descarta campos adicionales que podrían contener credenciales o PII', () => {
    registrarEventoTrazabilidadAutenticacion({
      flowId,
      canal: 'google',
      etapa: 'callback_google',
      resultado: 'exito',
      credential: 'id-token-secreto',
      correo: 'docente@ejemplo.test',
      sub: 'google-sub'
    } as never);

    const diagnostico = exportarTrazaAutenticacion();
    expect(diagnostico).toContain('callback_google');
    expect(diagnostico).not.toContain('id-token-secreto');
    expect(diagnostico).not.toContain('docente@ejemplo.test');
    expect(diagnostico).not.toContain('google-sub');
  });

  it('no interrumpe el login si localStorage falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });

    expect(() => registrarEventoTrazabilidadAutenticacion({
      flowId,
      canal: 'contrasena',
      etapa: 'solicitud_api',
      resultado: 'iniciado'
    })).not.toThrow();
    expect(leerTrazaAutenticacion()).toEqual([]);
  });
});
