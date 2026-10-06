/**
 * clienteComun.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas del cliente comun (retry/backoff).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  accionCerrarSesion,
  accionToastSesionParaError,
  crearClienteJsonBase,
  crearGestorEventosUso,
  crearPublicadorEventosUsoJson,
  emitirSesionInvalidada,
  ErrorRemoto,
  fetchConManejoErrores,
  leerErrorRemoto,
  leerJsonOk,
  mensajeUsuarioDeError,
  mensajeUsuarioDeErrorConSugerencia,
  onSesionInvalidada,
  sugerenciaUsuarioDeError
} from '../src/servicios_api/clienteComun';

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

describe('acciones de sesión para errores HTTP', () => {
  it('omite cerrar sesión para credenciales inválidas y lo permite para un token expirado', () => {
    expect(accionToastSesionParaError(
      new ErrorRemoto('Credenciales inválidas', { status: 401, codigo: 'credenciales_invalidas' }),
      'docente'
    )).toBeUndefined();

    const listener = vi.fn();
    window.addEventListener('app:sesion-invalidada', listener);
    const accion = accionToastSesionParaError(
      new ErrorRemoto('Token expirado', { status: 401, codigo: 'TOKEN_EXPIRADO' }),
      'docente'
    );
    expect(accion).toBeDefined();
    accion?.onClick();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { tipo: 'docente' } }));
    window.removeEventListener('app:sesion-invalidada', listener);
  });

  it('crea acción de cierre de sesión para el tipo solicitado', () => {
    const listener = vi.fn();
    window.addEventListener('app:sesion-invalidada', listener);
    accionCerrarSesion('alumno').onClick();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: { tipo: 'alumno' } }));
    window.removeEventListener('app:sesion-invalidada', listener);
  });
});

describe('normalización de respuestas y mensajes', () => {
  it('lee errores anidados desde texto JSON y tolera formatos alternativos', async () => {
    expect(await leerErrorRemoto({
      status: 422,
      clone: () => ({ text: async () => '{"error":{"codigo":"DATOS_INVALIDOS","mensaje":"Revisa el formulario","detalles":["campo"]}}' }),
      text: async () => 'el cuerpo original no debe consumirse'
    })).toEqual({ status: 422, codigo: 'DATOS_INVALIDOS', mensaje: 'Revisa el formulario', detalles: ['campo'] });

    expect(await leerErrorRemoto({ status: 401, json: async () => ({ error: 'Acceso denegado', detalle: 'token' }) }))
      .toEqual({ status: 401, mensaje: 'Acceso denegado', detalles: 'token' });
    expect(await leerErrorRemoto({ status: 409, json: async () => ({ codigo: 'CONFLICTO', message: 'Reintenta', detalles: { id: 1 } }) }))
      .toEqual({ status: 409, codigo: 'CONFLICTO', mensaje: 'Reintenta', detalles: { id: 1 } });
  });

  it('usa texto no JSON, omite cuerpos vacíos y conserva status si la lectura falla', async () => {
    expect(await leerErrorRemoto({ status: 502, clone: () => ({ text: async () => '<html>Gateway caído</html>' }), text: async () => '' }))
      .toEqual({ status: 502, mensaje: '<html>Gateway caído</html>' });
    expect(await leerErrorRemoto({ status: 503, clone: () => { throw new Error('sin clone'); }, json: async () => { throw new Error('sin json'); } }))
      .toEqual({ status: 503 });
    expect(await leerErrorRemoto(null)).toEqual({ status: undefined });
  });

  it('maneja respuestas vacías, ausencia de JSON y fallos al decodificar el cuerpo exitoso', async () => {
    await expect(leerJsonOk({ status: 204 }, 'Servicio')).resolves.toBeUndefined();
    await expect(leerJsonOk({ status: 205 }, 'Servicio')).resolves.toBeUndefined();
    await expect(leerJsonOk({ status: 200 }, 'Servicio')).rejects.toMatchObject({ detalle: { mensaje: 'Respuesta invalida' } });
    await expect(leerJsonOk({ json: async () => { throw new Error('JSON roto'); } }, 'Servicio'))
      .rejects.toMatchObject({ detalle: { detalles: 'Error: JSON roto' } });
  });

  it('prioriza mensajes entendibles por código, status y error de red', () => {
    expect(mensajeUsuarioDeError(new ErrorRemoto('x', { codigo: 'DOCENTE_NO_REGISTRADO' }), 'fallback'))
      .toContain('No existe una cuenta de docente');
    expect(mensajeUsuarioDeError(new ErrorRemoto('x', { codigo: 'SYNC_LEASE_OCUPADO' }), 'fallback'))
      .toContain('solo lectura');
    expect(mensajeUsuarioDeError(new ErrorRemoto('x', { status: 422 }), 'fallback')).toContain('Datos invalidos');
    expect(mensajeUsuarioDeError(new ErrorRemoto('x', { codigo: 'CODIGO_DESCONOCIDO' }), 'fallback')).toBe('Error: CODIGO_DESCONOCIDO');
    expect(mensajeUsuarioDeError(new Error('ECONNREFUSED 127.0.0.1'), 'fallback')).toContain('Servidor local no disponible');
    expect(mensajeUsuarioDeError(new Error('error común'), 'fallback')).toBe('error común');
    expect(mensajeUsuarioDeError('desconocido', 'fallback')).toBe('fallback');
  });

  it('agrega sugerencias útiles sin repetir el mensaje y cubre códigos operativos', () => {
    const errorRed = new ErrorRemoto('falló', { detalles: 'ECONNREFUSED' });
    expect(sugerenciaUsuarioDeError(errorRed)).toContain('inicia el servicio backend');
    expect(mensajeUsuarioDeErrorConSugerencia(errorRed, 'falló')).toContain('inicia el servicio backend');
    expect(mensajeUsuarioDeErrorConSugerencia(new ErrorRemoto('x', { status: 401, codigo: 'CREDENCIALES_INVALIDAS' }), 'x'))
      .toBe('Correo o contrasena incorrectos.');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { status: 401, codigo: 'DOCENTE_NO_REGISTRADO' }))).toContain('Registrar');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { status: 403 }))).toContain('permisos');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { status: 408 }))).toContain('conexion');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { status: 429 }))).toContain('segundos');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { status: 503 }))).toContain('mas tarde');
    expect(sugerenciaUsuarioDeError(new ErrorRemoto('x', { codigo: 'DATOS_INVALIDOS' }))).toContain('campos');
    expect(sugerenciaUsuarioDeError(new Error('x'))).toBeUndefined();
  });

  it('notifica solo tipos de sesión válidos y permite retirar la suscripción', () => {
    const handler = vi.fn();
    const retirar = onSesionInvalidada(handler);
    emitirSesionInvalidada('docente');
    window.dispatchEvent(new CustomEvent('app:sesion-invalidada', { detail: { tipo: 'desconocido' } }));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('docente');
    retirar();
    emitirSesionInvalidada('alumno');
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('eventos de uso y cliente JSON', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('envía lotes al alcanzar veinte eventos y descarta la cola si no hay token o falla el envío', async () => {
    const publicar = vi.fn().mockResolvedValue(undefined);
    const gestor = crearGestorEventosUso({ obtenerToken: () => 'token', publicarLote: publicar });
    await gestor.registrarEventosUso({ eventos: Array.from({ length: 20 }, (_, i) => i) });
    await vi.waitFor(() => expect(publicar).toHaveBeenCalledWith(expect.arrayContaining([0]), 'token'));
    expect(publicar).toHaveBeenCalledTimes(1);

    const sinToken = crearGestorEventosUso({ obtenerToken: () => null, publicarLote: publicar });
    await sinToken.registrarEventosUso({ eventos: [1] });
    window.dispatchEvent(new Event('pagehide'));
    await vi.runAllTimersAsync();
    expect(publicar).toHaveBeenCalledTimes(1);

    const falla = crearGestorEventosUso({ obtenerToken: () => 'token', publicarLote: vi.fn().mockRejectedValue(new Error('offline')) });
    await falla.registrarEventosUso({ eventos: [1] });
    window.dispatchEvent(new Event('visibilitychange'));
    await vi.runAllTimersAsync();
  });

  it('publica telemetría JSON con headers, keepalive y token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const publicar = crearPublicadorEventosUsoJson({ url: '/uso', credentials: 'include', headers: { 'X-Client': 'web' } });
    await publicar([{ accion: 'login' }], 'abc');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options).toMatchObject({ method: 'POST', credentials: 'include', keepalive: true });
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', 'X-Client': 'web', Authorization: 'Bearer abc' });
    expect(options.body).toBe(JSON.stringify({ eventos: [{ accion: 'login' }] }));
    vi.unstubAllGlobals();
  });

  it('refresca token una vez y serializa encabezados y payload de cliente JSON', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const cliente = crearClienteJsonBase({
      baseUrl: '/api', mensajeServicio: 'Servicio', obtenerToken: () => 'viejo', refrescarToken: async () => 'nuevo',
      headers: { 'X-App': 'desktop' }, retry: { intentos: 0 }, ...toastBase, toastTimeout: { id: 'timeout', title: 'Timeout', message: 'timeout' }
    });
    await expect(cliente.enviar('/datos', { valor: 2 }, { headers: { 'X-Request': 'id' } })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer viejo', 'Content-Type': 'application/json' });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer nuevo', 'X-Request': 'id' });
    vi.unstubAllGlobals();
  });
});
