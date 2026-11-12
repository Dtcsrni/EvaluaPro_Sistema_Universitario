import { describe, expect, it, vi } from 'vitest';
import { rutaPermitidaParaApiDelegada, type SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion.js';
import { requerirPermiso } from '../src/modulos/modulo_autenticacion/middlewarePermisos.js';
import { normalizarPermisosApi } from '../src/modulos/modulo_autenticacion/servicioApiDelegado.js';

function request(baseUrl: string, path: string, apiCredentialId?: string, method = 'GET') {
  return { baseUrl, path, apiCredentialId, method } as SolicitudDocente;
}

describe('rutas de credenciales API delegadas', () => {
  it('normaliza el prefijo /api y aplica scopes por namespace', () => {
    expect(rutaPermitidaParaApiDelegada(request('/api/banco-preguntas', '/reactivos'), new Set(['banco:leer']))).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/banco-preguntas', '/reactivos'), new Set(['temarios:leer']))).toBe(false);
    expect(rutaPermitidaParaApiDelegada(request('/api/preflight', ''), new Set(['banco:leer']))).toBe(true);
  });

  it('permite revocar solo la credencial propia por la ruta de autoservicio', () => {
    expect(rutaPermitidaParaApiDelegada(request('/api/autenticacion', '/api-clientes/mia/revocar', 'cred-propia'), new Set())).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/autenticacion', '/api-clientes/credenciales/otra/revocar', 'cred-propia'), new Set())).toBe(false);
    expect(rutaPermitidaParaApiDelegada(request('/api/autenticacion', '/api-clientes/mia/revocar'), new Set())).toBe(false);
  });

  it('intersecta el permiso de cuenta con el scope concedido', () => {
    const nextPermitida = vi.fn();
    requerirPermiso('banco:leer')({ docenteRoles: ['docente'], docentePermisosApi: ['banco:leer'] } as SolicitudDocente, {} as never, nextPermitida);
    expect(nextPermitida).toHaveBeenCalledWith();

    const nextDenegada = vi.fn();
    requerirPermiso('banco:gestionar')({ docenteRoles: ['docente'], docentePermisosApi: ['banco:leer'] } as SolicitudDocente, {} as never, nextDenegada);
    expect(nextDenegada.mock.calls[0][0]).toMatchObject({ estadoHttp: 403, codigo: 'NO_AUTORIZADO' });
  });

  it('permite OMR y calificaciones solo con sus scopes explícitos', () => {
    expect(normalizarPermisosApi(['examenes:leer', 'banco:leer', 'omr:analizar', 'calificaciones:calificar']))
      .toEqual(['examenes:leer', 'banco:leer', 'omr:analizar', 'calificaciones:calificar']);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/jobs'), new Set(['omr:analizar']))).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/calificaciones', '/calificar'), new Set(['calificaciones:calificar']))).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/jobs'), new Set(['calificaciones:calificar']))).toBe(false);
    expect(rutaPermitidaParaApiDelegada(request('/api/calificaciones', '/calificar'), new Set(['omr:analizar']))).toBe(false);
  });

  it('exige ambos scopes para previsualizar o registrar una nota OMR', () => {
    const ambos = new Set(['omr:analizar', 'calificaciones:calificar']);
    const soloOmr = new Set(['omr:analizar']);
    const soloCalificar = new Set(['calificaciones:calificar']);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/ingestas/job-1/calificacion-preview', undefined, 'POST'), ambos)).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/ingestas/job-1/calificar', undefined, 'POST'), ambos)).toBe(true);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/ingestas/job-1/calificacion-preview', undefined, 'POST'), soloOmr)).toBe(false);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/ingestas/job-1/calificar', undefined, 'POST'), soloCalificar)).toBe(false);
    expect(rutaPermitidaParaApiDelegada(request('/api/omr', '/ingestas/job-1/calificar', undefined, 'GET'), ambos)).toBe(false);
  });
});
