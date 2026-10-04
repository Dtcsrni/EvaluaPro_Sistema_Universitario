/** Cliente HTTP sin dependencias para automatizar flujos docentes de EvaluaPro. */
import { Buffer } from 'node:buffer';

export class EvaluaproApiError extends Error {
  constructor(message, { status, code, requestId, retryAfter, details } = {}) {
    super(message);
    this.name = 'EvaluaproApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
    this.details = details;
  }
}

function normalizarBaseUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('baseUrl debe usar HTTP o HTTPS');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash) throw new TypeError('baseUrl no debe incluir credenciales, query ni fragmento');
  if (url.protocol === 'http:' && !loopback) throw new TypeError('HTTP sin TLS solo se permite en loopback');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/`;
  return url;
}

function normalizarRutaApi(path) {
  const ruta = String(path).replace(/^\/+/, '');
  if (!ruta || ruta.startsWith('api/') || ruta.split(/[?#]/, 1)[0].split('/').includes('..')) {
    throw new TypeError('Usa una ruta segura relativa a /api, por ejemplo /examenes/plantillas');
  }
  return ruta;
}

function crearHeadersSolicitud({ headers, token, equipoId, body }) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  if (equipoId) requestHeaders.set('X-EvaluaPro-Equipo', equipoId);
  if (body !== undefined && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  return requestHeaders;
}

function serializarBody(body) {
  if (body === undefined) return undefined;
  return body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body);
}

function exigirClientRequestId(value, accion) {
  const requestId = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new TypeError(`clientRequestId UUID estable es obligatorio para recuperar reintentos de ${accion}`);
  }
  return requestId;
}

async function leerRespuesta(response, responseType) {
  if (responseType === 'binary') return Buffer.from(await response.arrayBuffer());
  if (response.status === 204) return undefined;
  return response.json().catch(() => undefined);
}

function crearErrorRed(cause, method, url) {
  const error = new Error(`No se pudo completar ${method} ${url.pathname}; el resultado de una escritura puede ser incierto`, { cause });
  error.name = 'EvaluaproNetworkError';
  error.mutationOutcomeUnknown = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  return error;
}

function crearErrorApi(response, data) {
  const envelope = data?.error ?? {};
  return new EvaluaproApiError(envelope.mensaje || envelope.message || `HTTP ${response.status}`, {
    status: response.status,
    code: envelope.codigo || envelope.code,
    requestId: envelope.requestId || response.headers.get('x-request-id') || undefined,
    retryAfter: response.headers.get('retry-after') || undefined,
    details: envelope.detalles || envelope.details
  });
}

function aplicarEstadoPreflight(resultado, preflight) {
  resultado.preflight = preflight;
  resultado.authenticated = preflight?.session?.authenticated === true;
  resultado.permissions = preflight?.session?.permissions ?? [];
  const lease = preflight?.writeLease;
  resultado.lease = lease
    ? { ...lease, state: lease.mode === 'unknown' ? 'needs_team_id' : lease.mode }
    : { state: 'not_checked' };
}

export class EvaluaproClient {
  constructor({ baseUrl, token, equipoId, timeoutMs = 30_000, fetchImpl = globalThis.fetch }) {
    if (typeof fetchImpl !== 'function') throw new TypeError('Se requiere una implementación fetch');
    this.baseUrl = normalizarBaseUrl(baseUrl);
    this.token = token || undefined;
    this.equipoId = equipoId || undefined;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(path, { method = 'GET', body, headers = {}, signal, responseType = 'json', confirmarEscritura = false } = {}) {
    const ruta = normalizarRutaApi(path);
    if (ruta === 'calificaciones/calificar' && !confirmarEscritura) {
      throw new Error('Escritura de calificación requiere confirmarEscritura: true y autorización docente');
    }
    const url = new URL(ruta, this.baseUrl);
    const requestHeaders = crearHeadersSolicitud({ headers, token: this.token, equipoId: this.equipoId, body });
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers: requestHeaders,
        ...(body === undefined ? {} : { body: serializarBody(body) }),
        signal: combinedSignal
      });
    } catch (cause) {
      throw crearErrorRed(cause, method, url);
    }
    const data = await leerRespuesta(response, responseType);
    if (!response.ok) throw crearErrorApi(response, data);
    return { data, status: response.status, headers: response.headers };
  }

  async login(correo, contrasena) {
    const { data } = await this.request('/autenticacion/ingresar', {
      method: 'POST', body: { correo, contrasena }
    });
    if (!data?.token) throw new Error('La respuesta de autenticación no contiene token');
    this.token = data.token;
    return data.docente;
  }

  async loginGoogle(credential) {
    if (typeof credential !== 'string' || credential.trim().length < 10) {
      throw new TypeError('credential debe ser una credencial de Google válida');
    }
    const { data } = await this.request('/autenticacion/google', {
      method: 'POST', body: { credential: credential.trim() }
    });
    if (!data?.token) throw new Error('La respuesta de autenticación no contiene token');
    this.token = data.token;
    return data.docente;
  }

  async preflight({ comprobarClassroom = false, periodoId } = {}) {
    const [ready, version] = await Promise.all([
      this.request('/salud/ready').then(({ data }) => data),
      this.request('/version').then(({ data }) => data)
    ]);
    const result = { ready, version, authenticated: false, permissions: [], lease: { state: 'not_checked' }, periodo: { state: 'not_checked' } };
    if (!this.token) return result;
    const { data: preflight } = await this.request('/preflight');
    aplicarEstadoPreflight(result, preflight);
    if (periodoId && result.permissions.includes('periodos:leer')) {
      const { data: periodosResponse } = await this.request('/periodos');
      const periodos = Array.isArray(periodosResponse) ? periodosResponse : periodosResponse?.periodos ?? [];
      const seleccionado = periodos.find((periodo) => String(periodo.id ?? periodo._id) === String(periodoId));
      result.periodo = { state: seleccionado ? 'available' : 'not_found', periodoId };
    }
    if (comprobarClassroom && result.permissions.includes('classroom:pull')) {
      const { data: classroom } = await this.request('/evaluaciones/v2/classroom/estado');
      result.classroom = classroom;
    }
    return result;
  }

  async listarPeriodos({ activo, limite } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ activo, limite })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/periodos${suffix}`)).data.periodos;
  }

  async crearPeriodo(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un periodo requiere confirmarEscritura: true');
    return (await this.request('/periodos', { method: 'POST', body: payload })).data.periodo;
  }

  async actualizarPeriodo(periodoId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Actualizar un periodo requiere confirmarEscritura: true');
    return (await this.request(`/periodos/${encodeURIComponent(periodoId)}/actualizar`, { method: 'POST', body: payload })).data.periodo;
  }

  async archivarPeriodo(periodoId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Archivar un periodo requiere confirmarEliminacion: true');
    return (await this.request(`/periodos/${encodeURIComponent(periodoId)}/archivar`, { method: 'POST', body: {} })).data.periodo;
  }

  async eliminarPeriodoDev(periodoId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('La eliminación de desarrollo de un periodo requiere confirmarEliminacion: true');
    return (await this.request(`/periodos/${encodeURIComponent(periodoId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async listarAlumnos({ periodoId, limite } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, limite })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/alumnos${suffix}`)).data.alumnos;
  }

  async importarReactivos(payload) {
    const { data: preview } = await this.request('/banco-preguntas/importaciones/preview', { method: 'POST', body: payload });
    if (!preview?.importId || !preview?.planHash) throw new Error('Preview de reactivos sin importId/planHash; no se confirmó');
    return { preview, confirmar: async () => (await this.request(
      `/banco-preguntas/importaciones/${encodeURIComponent(preview.importId)}/confirmar`,
      { method: 'POST', body: { planHash: preview.planHash, payload } }
    )).data };
  }

  async crearReactivo(payload) {
    if (!Array.isArray(payload?.items) || payload.items.length !== 1 || payload.items[0]?.itemId !== null || payload.items[0]?.expectedVersion !== null) {
      throw new TypeError('crearReactivo requiere un lote de un reactivo nuevo con itemId y expectedVersion nulos');
    }
    return this.importarReactivos(payload);
  }

  async versionarReactivo(payload) {
    if (!Array.isArray(payload?.items) || payload.items.length !== 1 || !payload.items[0]?.itemId || !Number.isInteger(payload.items[0]?.expectedVersion)) {
      throw new TypeError('versionarReactivo requiere un reactivo y expectedVersion para control de concurrencia');
    }
    return this.importarReactivos(payload);
  }

  async listarReactivos({ periodoId, temaId, estado, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, temaId, estado, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/banco-preguntas/reactivos${suffix}`)).data;
  }

  async obtenerAlumno(alumnoId) {
    return (await this.request(`/alumnos/${encodeURIComponent(alumnoId)}`)).data.alumno;
  }

  async crearAlumno(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un alumno requiere confirmarEscritura: true');
    return (await this.request('/alumnos', { method: 'POST', body: payload })).data.alumno;
  }

  async actualizarAlumno(alumnoId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Actualizar un alumno requiere confirmarEscritura: true');
    return (await this.request(`/alumnos/${encodeURIComponent(alumnoId)}/actualizar`, { method: 'POST', body: payload })).data.alumno;
  }

  async eliminarAlumnoDev(alumnoId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('La eliminación de desarrollo de un alumno requiere confirmarEliminacion: true');
    return (await this.request(`/alumnos/${encodeURIComponent(alumnoId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async listarTemarios({ periodoId } = {}) {
    const query = periodoId ? `?${new URLSearchParams({ periodoId })}` : '';
    return (await this.request(`/temarios${query}`)).data.temarios;
  }

  async obtenerNodosTemario(temarioId) {
    return (await this.request(`/temarios/${encodeURIComponent(temarioId)}/nodos`)).data;
  }

  async obtenerTemario(temarioId) {
    return (await this.request(`/temarios/${encodeURIComponent(temarioId)}`)).data;
  }

  async crearTemarioManual(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un temario requiere confirmarEscritura: true');
    return (await this.request('/temarios/manual', { method: 'POST', body: payload })).data;
  }

  async actualizarTemario(temarioId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Actualizar un temario requiere confirmarEscritura: true');
    if (!payload?.expectedUpdatedAt || !String(payload?.motivoCambio ?? '').trim()) {
      throw new Error('Actualizar un temario requiere expectedUpdatedAt y motivoCambio');
    }
    return (await this.request(`/temarios/${encodeURIComponent(temarioId)}`, { method: 'PUT', body: payload })).data;
  }

  async listarAuditoriaTemario(temarioId, { limite = 50, cursor } = {}) {
    const query = new URLSearchParams({ limite: String(limite) });
    if (cursor) query.set('cursor', cursor);
    return (await this.request(`/temarios/${encodeURIComponent(temarioId)}/auditoria?${query}`)).data;
  }

  async listarTodaAuditoriaTemario(temarioId, { limite = 50 } = {}) {
    const eventos = [];
    const cursores = new Set();
    let cursor;
    do {
      const pagina = await this.listarAuditoriaTemario(temarioId, { limite, cursor });
      eventos.push(...(Array.isArray(pagina.eventos) ? pagina.eventos : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursores.has(cursor)) throw new Error('El servidor repitió el cursor de auditoría del temario');
      if (cursor) cursores.add(cursor);
    } while (cursor);
    return eventos;
  }

  async crearTemarioDesdePdf({ periodoId, archivo, nombre }, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un temario desde PDF requiere confirmarEscritura: true');
    if (!(archivo instanceof Blob)) throw new TypeError('archivo debe ser Blob o File');
    const form = new FormData();
    form.set('periodoId', String(periodoId));
    if (nombre) form.set('nombre', nombre);
    form.set('archivo', archivo, String(archivo.name || nombre || 'temario.pdf'));
    return (await this.request('/temarios/desde-pdf', { method: 'POST', body: form })).data;
  }

  async actualizarEstadoNodoTemario(nodoId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Cambiar el estado de un nodo requiere confirmarEscritura: true');
    return (await this.request(`/temarios/nodos/${encodeURIComponent(nodoId)}/estado`, { method: 'POST', body: payload })).data;
  }

  async eliminarTemario(temarioId, { confirmarEliminacion = false, expectedUpdatedAt, motivoCambio } = {}) {
    if (!confirmarEliminacion) throw new Error('La eliminación de un temario requiere confirmarEliminacion: true');
    if (!expectedUpdatedAt || !String(motivoCambio ?? '').trim()) {
      throw new Error('La eliminación de un temario requiere expectedUpdatedAt y motivoCambio');
    }
    return (await this.request(`/temarios/${encodeURIComponent(temarioId)}/eliminar`, {
      method: 'POST',
      body: { confirmarEliminacion: true, expectedUpdatedAt, motivoCambio }
    })).data;
  }

  async listarSesionesAsistencia({ periodoId } = {}) {
    const query = periodoId ? `?${new URLSearchParams({ periodoId })}` : '';
    return (await this.request(`/asistencias/sesiones${query}`)).data;
  }

  async crearSesionAsistencia(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear una sesión de asistencia requiere confirmarEscritura: true');
    return (await this.request('/asistencias/sesiones', { method: 'POST', body: payload })).data;
  }

  async obtenerRegistrosAsistencia(sesionId) {
    return (await this.request(`/asistencias/sesiones/${encodeURIComponent(sesionId)}/registros`)).data;
  }

  async guardarRegistrosAsistencia(sesionId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Guardar asistencia requiere confirmarEscritura: true y autorización docente');
    return (await this.request(`/asistencias/sesiones/${encodeURIComponent(sesionId)}/registros`, { method: 'POST', body: payload })).data;
  }

  async eliminarSesionAsistencia(sesionId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Eliminar la sesión de asistencia requiere confirmarEliminacion: true');
    return (await this.request(`/asistencias/sesiones/${encodeURIComponent(sesionId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async listarReglasAsistencia() {
    return (await this.request('/asistencias/reglas')).data;
  }

  async guardarReglaAsistencia(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear o actualizar una regla de asistencia requiere confirmarEscritura: true');
    return (await this.request('/asistencias/reglas', { method: 'POST', body: payload })).data;
  }

  async eliminarReglaAsistencia(reglaId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Eliminar una regla de asistencia requiere confirmarEliminacion: true');
    return (await this.request(`/asistencias/reglas/${encodeURIComponent(reglaId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async listarExcepcionesAsistencia() {
    return (await this.request('/asistencias/excepciones')).data;
  }

  async crearExcepcionAsistencia(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear una excepción de asistencia requiere confirmarEscritura: true');
    return (await this.request('/asistencias/excepciones', { method: 'POST', body: payload })).data;
  }

  async eliminarExcepcionAsistencia(excepcionId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Eliminar una excepción de asistencia requiere confirmarEliminacion: true');
    return (await this.request(`/asistencias/excepciones/${encodeURIComponent(excepcionId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async obtenerResumenAsistencia() {
    return (await this.request('/asistencias/resumen')).data;
  }

  async verificarDerechoExamen(alumnoId) {
    return (await this.request(`/asistencias/derecho-examen/${encodeURIComponent(alumnoId)}`)).data;
  }

  async listarPlantillas({ periodoId, archivado, limite } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, archivado, limite })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/examenes/plantillas${suffix}`)).data;
  }

  async obtenerPlantilla(plantillaId) {
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}`)).data.plantilla;
  }

  async crearPlantilla(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear una plantilla de examen requiere confirmarEscritura: true');
    return (await this.request('/examenes/plantillas', { method: 'POST', body: payload })).data.plantilla;
  }

  async actualizarPlantilla(plantillaId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Actualizar una plantilla de examen requiere confirmarEscritura: true');
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}`, { method: 'POST', body: payload })).data.plantilla;
  }

  async archivarPlantilla(plantillaId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Archivar una plantilla de examen requiere confirmarEliminacion: true');
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/archivar`, { method: 'POST', body: {} })).data.plantilla;
  }

  async eliminarPlantilla(plantillaId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Eliminar una plantilla y sus artefactos relacionados requiere confirmarEliminacion: true');
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/eliminar`, { method: 'POST', body: {} })).data;
  }

  async previsualizarPlantilla(plantillaId) {
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar`)).data;
  }

  async previsualizarPlantillaPdf(plantillaId, { forzarRegeneracion = false } = {}) {
    const query = forzarRegeneracion ? '?refresh=1' : '';
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar/pdf${query}`, { responseType: 'binary' })).data;
  }

  async previsualizarPlantillaPdfVisual(plantillaId, { forzarRegeneracion = false } = {}) {
    const query = forzarRegeneracion ? '?refresh=1' : '';
    return (await this.request(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar/pdf/visual${query}`)).data;
  }

  async listarTemasBanco(periodoId) {
    const query = periodoId ? `?${new URLSearchParams({ periodoId })}` : '';
    return (await this.request(`/banco-preguntas/temas${query}`)).data.temas;
  }

  async obtenerTemaBanco(temaId) {
    return (await this.request(`/banco-preguntas/temas/${encodeURIComponent(temaId)}`)).data.tema;
  }

  async crearTemaBanco(payload, { confirmarEscritura = false, clientRequestId } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un tema de banco requiere confirmarEscritura: true');
    const requestId = exigirClientRequestId(clientRequestId, 'crear tema de banco');
    return (await this.request('/banco-preguntas/temas', { method: 'POST', body: { ...payload, clientRequestId: requestId } })).data.tema;
  }

  async actualizarTemaBanco(temaId, payload, { confirmarEscritura = false, clientRequestId } = {}) {
    if (!confirmarEscritura) throw new Error('Actualizar un tema de banco requiere confirmarEscritura: true');
    const requestId = exigirClientRequestId(clientRequestId, 'actualizar tema de banco');
    return (await this.request(`/banco-preguntas/temas/${encodeURIComponent(temaId)}/actualizar`, { method: 'POST', body: { ...payload, clientRequestId: requestId } })).data.tema;
  }

  async archivarTemaBanco(temaId, { confirmarEliminacion = false, clientRequestId } = {}) {
    if (!confirmarEliminacion) throw new Error('Archivar un tema de banco requiere confirmarEliminacion: true');
    const requestId = exigirClientRequestId(clientRequestId, 'archivar tema de banco');
    return (await this.request(`/banco-preguntas/temas/${encodeURIComponent(temaId)}/archivar`, { method: 'POST', body: { clientRequestId: requestId } })).data.tema;
  }

  async listarAuditoriaTemaBanco(temaId, { limite = 30, cursor } = {}) {
    const query = new URLSearchParams({ limite: String(limite) });
    if (cursor) query.set('cursor', cursor);
    return (await this.request(`/banco-preguntas/temas/${encodeURIComponent(temaId)}/auditoria?${query}`)).data;
  }

  async listarTodaAuditoriaTemaBanco(temaId, { limite = 30 } = {}) {
    const eventos = [];
    const cursores = new Set();
    let cursor;
    do {
      const pagina = await this.listarAuditoriaTemaBanco(temaId, { limite, cursor });
      eventos.push(...(Array.isArray(pagina.eventos) ? pagina.eventos : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursores.has(cursor)) throw new Error('El historial de auditoría de tema repitió el cursor');
      if (cursor) cursores.add(cursor);
    } while (cursor);
    return eventos;
  }

  async obtenerReactivo(reactivoId) {
    return (await this.request(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}`)).data.reactivo;
  }

  async listarImportacionesReactivos({ limite = 30, cursor } = {}) {
    const query = new URLSearchParams({ limite: String(limite) });
    if (cursor) query.set('cursor', cursor);
    return (await this.request(`/banco-preguntas/importaciones?${query}`)).data;
  }

  async listarTodasImportacionesReactivos({ limite = 30 } = {}) {
    const importaciones = [];
    const cursoresUsados = new Set();
    let cursor;
    do {
      const pagina = await this.listarImportacionesReactivos({ limite, ...(cursor ? { cursor } : {}) });
      importaciones.push(...(Array.isArray(pagina.importaciones) ? pagina.importaciones : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursoresUsados.has(cursor)) throw new Error('La paginación de importaciones de reactivos repitió un cursor');
      if (cursor) cursoresUsados.add(cursor);
    } while (cursor);
    return importaciones;
  }

  async obtenerImportacionReactivos(importId) {
    return (await this.request(`/banco-preguntas/importaciones/${encodeURIComponent(importId)}`)).data;
  }

  async listarVersionesReactivo(reactivoId) {
    return (await this.request(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}/versiones`)).data;
  }

  async revisarReactivo(reactivoId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Enviar un reactivo a revisión requiere confirmarEscritura: true');
    return (await this.request(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}/revisar`, { method: 'POST', body: {} })).data;
  }

  async publicarReactivo(reactivoId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Publicar un reactivo requiere confirmarEscritura: true');
    return (await this.request(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}/publicar`, { method: 'POST', body: {} })).data;
  }

  async retirarReactivo(reactivoId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Retirar un reactivo requiere confirmarEscritura: true');
    return (await this.request(`/banco-preguntas/reactivos/${encodeURIComponent(reactivoId)}/retirar`, { method: 'POST', body: {} })).data;
  }

  async listarPapelera({ limite = 50 } = {}) {
    const query = new URLSearchParams({ limite: String(limite) });
    return (await this.request(`/papelera?${query}`)).data;
  }

  async restaurarPapelera(itemId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Restaurar un elemento de papelera requiere confirmarEscritura: true');
    return (await this.request(`/papelera/${encodeURIComponent(itemId)}/restaurar`, {
      method: 'POST', body: {}
    })).data;
  }

  async listarEntregas({ examenGeneradoId, alumnoId, periodoId, loteId, estado, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ examenGeneradoId, alumnoId, periodoId, loteId, estado, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/entregas${suffix}`)).data;
  }

  async obtenerEntrega(entregaId) {
    return (await this.request(`/entregas/${encodeURIComponent(entregaId)}`)).data.entrega;
  }

  async vincularEntrega(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Vincular una entrega requiere confirmarEscritura: true');
    return (await this.request('/entregas/vincular', { method: 'POST', body: payload })).data.entrega;
  }

  async vincularEntregaPorFolio(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Vincular una entrega requiere confirmarEscritura: true');
    return (await this.request('/entregas/vincular-folio', { method: 'POST', body: payload })).data.entrega;
  }

  async deshacerEntregaPorFolio(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Deshacer una entrega requiere confirmarEscritura: true');
    return (await this.request('/entregas/deshacer-folio', { method: 'POST', body: payload })).data;
  }

  async crearJobOmr({ generatedAssessmentId, sourceType, capturas, clientRequestId }, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear un job OMR requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos OMR');
    }
    return (await this.request('/omr/jobs', {
      method: 'POST', body: { generatedAssessmentId, sourceType, capturas, clientRequestId }
    })).data.job;
  }

  async prevalidarCapturasOmr(capturas) {
    if (!Array.isArray(capturas) || capturas.length === 0) throw new TypeError('Adjunta al menos una captura para prevalidar');
    return (await this.request('/omr/prevalidar-lote', { method: 'POST', body: { capturas } })).data;
  }

  async resolverExcepcionJobOmr(jobId, sheetSerial, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Resolver una excepción OMR requiere confirmarEscritura: true');
    if (!String(payload?.resolutionReason ?? '').trim()) throw new TypeError('resolutionReason es obligatorio');
    return (await this.request(`/omr/jobs/${encodeURIComponent(jobId)}/exceptions/${encodeURIComponent(sheetSerial)}/resolve`, {
      method: 'POST', body: payload
    })).data.job;
  }

  async finalizarJobOmr(jobId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Finalizar un job OMR requiere confirmarEscritura: true');
    return (await this.request(`/omr/jobs/${encodeURIComponent(jobId)}/finalize`, { method: 'POST', body: {} })).data.job;
  }

  async ingresarPdfsOmr({ generatedAssessmentId, clientRequestId, archivos, referencia }, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Ingresar PDFs OMR requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos OMR');
    }
    if (!Array.isArray(archivos) || archivos.length === 0) throw new TypeError('Adjunta al menos un PDF');
    const form = new FormData();
    form.set('generatedAssessmentId', String(generatedAssessmentId));
    form.set('clientRequestId', clientRequestId);
    for (const [index, archivo] of archivos.entries()) {
      if (!(archivo?.file instanceof Blob)) throw new TypeError(`archivos[${index}].file debe ser Blob o File`);
      form.append('archivos', archivo.file, String(archivo.nombre || `captura-${index + 1}.pdf`));
    }
    if (referencia !== undefined) {
      if (!(referencia?.file instanceof Blob)) throw new TypeError('referencia.file debe ser Blob o File');
      form.append('referencia', referencia.file, String(referencia.nombre || 'referencia-lote.pdf'));
    }
    return (await this.request('/omr/ingestas', { method: 'POST', body: form })).data.job;
  }

  async prevalidarReferenciaIngestaOmr({ assessmentIds, referencia } = {}) {
    if (!Array.isArray(assessmentIds) || assessmentIds.length === 0 || assessmentIds.length > 100) {
      throw new TypeError('assessmentIds debe contener de 1 a 100 lotes candidatos');
    }
    const ids = assessmentIds.map((id) => String(id ?? '').trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new TypeError('assessmentIds debe contener IDs únicos y no vacíos');
    if (!(referencia?.file instanceof Blob)) throw new TypeError('referencia.file debe ser Blob o File');
    const form = new FormData();
    form.set('assessmentIds', JSON.stringify(ids));
    form.append('referencia', referencia.file, String(referencia.nombre || 'referencia-lote.pdf'));
    return (await this.request('/omr/ingestas/prevalidar-referencia', { method: 'POST', body: form })).data;
  }

  async obtenerIngestaPdfOmr(jobId) {
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}`)).data;
  }

  async recuperarIngestaPdfOmr(clientRequestId) {
    return (await this.request(`/omr/ingestas/por-clave/${encodeURIComponent(clientRequestId)}`)).data;
  }

  async reintentarIngestaPdfOmr(jobId, clientRequestId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Reprocesar una ingesta OMR requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId debe ser un UUID persistido antes del reintento');
    }
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/reintentar`, { method: 'POST', body: { clientRequestId } })).data.job;
  }

  async descargarOriginalIngestaPdfOmr(jobId, fileId) {
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/originales/${encodeURIComponent(fileId)}`, { responseType: 'binary' })).data;
  }

  async obtenerPreviewPaginaIngestaOmr(jobId, pageIndex) {
    if (!Number.isSafeInteger(Number(pageIndex)) || Number(pageIndex) < 1) throw new TypeError('pageIndex debe ser un entero positivo');
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/paginas/${encodeURIComponent(pageIndex)}/preview`, { responseType: 'binary' })).data;
  }

  async obtenerPreviewReferenciaIngestaOmr(jobId, pageIndex, generatedAssessmentId, examPage) {
    if (!Number.isSafeInteger(Number(pageIndex)) || Number(pageIndex) < 1) throw new TypeError('pageIndex debe ser un entero positivo');
    const tieneExamen = Boolean(String(generatedAssessmentId ?? '').trim());
    const tienePagina = examPage !== undefined && examPage !== null && String(examPage).trim() !== '';
    if (tieneExamen !== tienePagina) throw new TypeError('generatedAssessmentId y examPage deben enviarse juntos');
    let ruta = `/omr/ingestas/${encodeURIComponent(jobId)}/paginas/${encodeURIComponent(pageIndex)}/reference-preview`;
    if (tieneExamen) {
      if (!Number.isSafeInteger(Number(examPage)) || Number(examPage) < 1) throw new TypeError('examPage debe ser un entero positivo');
      const query = new URLSearchParams({ generatedAssessmentId: String(generatedAssessmentId), examPage: String(examPage) });
      ruta += `?${query}`;
    }
    return (await this.request(ruta, { responseType: 'binary' })).data;
  }

  async descargarManifiestoIngestaPdfOmr(jobId) {
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/manifiesto`, { responseType: 'binary' })).data;
  }

  async descargarPaqueteIngestaPdfOmr(jobId, packageId) {
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/paquetes/${encodeURIComponent(packageId)}`, { responseType: 'binary' })).data;
  }

  async resolverPaginaIngestaOmr(jobId, pageIndex, { generatedAssessmentId, examPage, resolutionReason, finalResponses } = {}, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Resolver una página de ingesta OMR requiere confirmarEscritura: true');
    if (!String(resolutionReason ?? '').trim()) throw new TypeError('resolutionReason es obligatorio');
    return (await this.request(`/omr/ingestas/${encodeURIComponent(jobId)}/paginas/${encodeURIComponent(pageIndex)}/resolver`, {
      method: 'POST',
      body: {
        ...(generatedAssessmentId ? { generatedAssessmentId } : {}),
        ...(examPage ? { examPage } : {}),
        resolutionReason,
        ...(finalResponses ? { finalResponses } : {})
      }
    })).data.job;
  }

  async obtenerJobOmr(jobId) {
    return (await this.request(`/omr/jobs/${encodeURIComponent(jobId)}`)).data.job;
  }

  async listarJobsOmr({ generatedAssessmentId, status, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ generatedAssessmentId, status, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/omr/jobs${suffix}`)).data;
  }

  async generarLoteExamenes(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Generar exámenes en lote requiere confirmarEscritura: true');
    if (typeof payload?.loteId !== 'string' || !/^[A-Za-z0-9_-]{4,16}$/.test(payload.loteId)) {
      throw new TypeError('generarLoteExamenes requiere un loteId estable (4-16 caracteres) para recuperar o reanudar la generación');
    }
    return (await this.request('/examenes/generados/lote', { method: 'POST', body: payload })).data;
  }

  async generarExamenIndividual({ plantillaId, clientRequestId } = {}, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Generar un examen requiere confirmarEscritura: true');
    if (!plantillaId) throw new TypeError('generarExamenIndividual requiere plantillaId');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID estable es obligatorio para recuperar reintentos de generación individual');
    }
    return (await this.request('/examenes/generados', {
      method: 'POST', body: { plantillaId, clientRequestId }
    })).data;
  }

  async listarPaginaExamenesGenerados({ periodoId, alumnoId, plantillaId, folio, archivado, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, alumnoId, plantillaId, folio, archivado, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/examenes/generados${suffix}`)).data;
  }

  async listarLotesExamenes({ plantillaId, archivado, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ plantillaId, archivado, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/examenes/generados/lotes${suffix}`)).data;
  }

  async cambiarEstadoLoteExamenes(loteId, accion, { clientRequestId, confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Cambiar el estado de un lote requiere confirmarEscritura: true');
    if (!['archivar', 'restaurar'].includes(accion)) throw new TypeError('accion debe ser archivar o restaurar');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de ciclo de vida del lote');
    }
    return (await this.request(`/examenes/generados/lote/${encodeURIComponent(loteId)}/${accion}`, {
      method: 'POST', body: { clientRequestId }
    })).data;
  }

  async archivarLoteExamenes(loteId, opciones = {}) {
    return this.cambiarEstadoLoteExamenes(loteId, 'archivar', opciones);
  }

  async restaurarLoteExamenes(loteId, opciones = {}) {
    return this.cambiarEstadoLoteExamenes(loteId, 'restaurar', opciones);
  }

  async listarAuditoriaLoteExamenes(loteId, { limite = 30, cursor } = {}) {
    const query = new URLSearchParams({ limite: String(limite) });
    if (cursor) query.set('cursor', cursor);
    return (await this.request(`/examenes/generados/lote/${encodeURIComponent(loteId)}/auditoria?${query}`)).data;
  }

  async listarTodaAuditoriaLoteExamenes(loteId, { limite = 30 } = {}) {
    const eventos = [];
    const cursoresUsados = new Set();
    let cursor;
    do {
      const pagina = await this.listarAuditoriaLoteExamenes(loteId, { limite, ...(cursor ? { cursor } : {}) });
      eventos.push(...(Array.isArray(pagina.eventos) ? pagina.eventos : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursoresUsados.has(cursor)) throw new Error('La paginación de auditoría de lote repitió un cursor');
      if (cursor) cursoresUsados.add(cursor);
    } while (cursor);
    return eventos;
  }

  async listarTodosLotesExamenes({ limite = 25, ...filtros } = {}) {
    const lotes = [];
    const cursoresUsados = new Set();
    let cursor;
    do {
      const pagina = await this.listarLotesExamenes({ ...filtros, limite, ...(cursor ? { cursor } : {}) });
      lotes.push(...(Array.isArray(pagina.lotes) ? pagina.lotes : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursoresUsados.has(cursor)) throw new Error('La paginación de lotes repitió un cursor');
      if (cursor) cursoresUsados.add(cursor);
    } while (cursor);
    return lotes;
  }

  async listarExamenesGenerados(filtros = {}) {
    return (await this.listarPaginaExamenesGenerados(filtros)).examenes;
  }

  async listarTodosExamenesGenerados({ limite = 100, ...filtros } = {}) {
    const examenes = [];
    const cursoresUsados = new Set();
    let cursor;
    do {
      const pagina = await this.listarPaginaExamenesGenerados({ ...filtros, limite, ...(cursor ? { cursor } : {}) });
      examenes.push(...(Array.isArray(pagina.examenes) ? pagina.examenes : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursoresUsados.has(cursor)) throw new Error('La paginación de exámenes repitió un cursor');
      if (cursor) cursoresUsados.add(cursor);
    } while (cursor);
    return examenes;
  }

  async obtenerExamenGenerado(examenId) {
    return (await this.request(`/examenes/generados/${encodeURIComponent(examenId)}`)).data;
  }

  async obtenerExamenPorFolio(folio) {
    return (await this.request(`/examenes/generados/folio/${encodeURIComponent(folio)}`)).data.examen;
  }

  async descargarPdfExamenGenerado(examenId) {
    return (await this.request(`/examenes/generados/${encodeURIComponent(examenId)}/pdf`, { responseType: 'binary' })).data;
  }

  async descargarPdfLoteExamenes(loteId) {
    return (await this.request(`/examenes/generados/lote/${encodeURIComponent(loteId)}/pdf`, { responseType: 'binary' })).data;
  }

  async regenerarPdfExamenGenerado(examenId, { forzar = false, confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Regenerar un examen requiere confirmarEscritura: true');
    return (await this.request(`/examenes/generados/${encodeURIComponent(examenId)}/regenerar`, {
      method: 'POST', body: { forzar }
    })).data;
  }

  async archivarExamenGenerado(examenId, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Archivar un examen generado requiere confirmarEliminacion: true');
    return (await this.request(`/examenes/generados/${encodeURIComponent(examenId)}/archivar`, { method: 'POST', body: {} })).data;
  }

  async progresoLoteExamenes(loteId) {
    return (await this.request(`/examenes/generados/lote/${encodeURIComponent(loteId)}/progreso`)).data;
  }

  async calificarExamen(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Confirma explícitamente la escritura de calificación');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de calificación');
    }
    return (await this.request('/calificaciones/calificar', { method: 'POST', body: payload, confirmarEscritura })).data;
  }

  async obtenerCalificacionesExamen(examenGeneradoId) {
    return (await this.request(`/calificaciones/examen/${encodeURIComponent(examenGeneradoId)}`)).data;
  }

  async listarEvidenciasEvaluacion({ periodoId, alumnoId, incluirArchivadas, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, alumnoId, incluirArchivadas, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/evaluaciones/evidencias${suffix}`)).data;
  }

  async listarPoliticasCalificacion({ incluirArchivadas = false, incluirVersiones = false } = {}) {
    const parametros = new URLSearchParams();
    if (incluirArchivadas) parametros.set('incluirArchivadas', 'true');
    if (incluirVersiones) parametros.set('incluirVersiones', 'true');
    const query = parametros.size ? `?${parametros}` : '';
    return (await this.request(`/evaluaciones/politicas${query}`)).data;
  }

  async obtenerPoliticaCalificacion(codigo, version = 1) {
    const query = new URLSearchParams({ version: String(version) });
    return (await this.request(`/evaluaciones/politicas/${encodeURIComponent(codigo)}?${query}`)).data.politica;
  }

  async obtenerResumenEvaluacion(periodoId, alumnoId) {
    const query = new URLSearchParams({ periodoId: String(periodoId) });
    return (await this.request(`/evaluaciones/v2/alumnos/${encodeURIComponent(alumnoId)}/resumen?${query}`)).data.resumen;
  }

  async guardarComponenteExamen(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Guardar un componente de examen modifica calificaciones y requiere confirmarEscritura: true');
    return (await this.request('/evaluaciones/v2/examenes/componentes', {
      method: 'POST', body: payload, confirmarEscritura
    })).data.componente;
  }

  async crearPoliticaCalificacion(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear una política puede cambiar los cálculos de evaluación; requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de creación de política');
    }
    return (await this.request('/evaluaciones/politicas', { method: 'POST', body: payload, confirmarEscritura })).data.politica;
  }

  async versionarPoliticaCalificacion(codigo, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Versionar una política puede cambiar cálculos futuros; requiere confirmarEscritura: true');
    if (payload?.codigo !== codigo) throw new TypeError('El código de la ruta debe coincidir con payload.codigo');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de versionado');
    }
    return (await this.request(`/evaluaciones/politicas/${encodeURIComponent(codigo)}`, {
      method: 'PUT', body: payload, confirmarEscritura
    })).data.politica;
  }

  async archivarPoliticaCalificacion(codigo, { confirmarEliminacion = false } = {}) {
    if (!confirmarEliminacion) throw new Error('Archivar una política requiere confirmarEliminacion: true');
    return (await this.request(`/evaluaciones/politicas/${encodeURIComponent(codigo)}`, {
      method: 'DELETE', confirmarEliminacion
    })).data.politica;
  }

  async configurarPoliticaEvaluacion(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Cambiar la política de un periodo afecta cálculos y requiere confirmarEscritura: true');
    return (await this.request('/evaluaciones/configuracion-periodo', { method: 'POST', body: payload, confirmarEscritura })).data;
  }

  async obtenerEvidenciaEvaluacion(evidenciaId) {
    return (await this.request(`/evaluaciones/evidencias/${encodeURIComponent(evidenciaId)}`)).data.evidencia;
  }

  async crearEvidenciaEvaluacion(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Crear una evidencia modifica los cálculos de evaluación; requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de evidencia');
    }
    return (await this.request('/evaluaciones/evidencias', { method: 'POST', body: payload, confirmarEscritura })).data.evidencia;
  }

  async actualizarEvidenciaEvaluacion(evidenciaId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Editar una evidencia afecta cálculos y requiere confirmarEscritura: true');
    if (!payload?.expectedUpdatedAt || !payload?.motivoCambio) throw new TypeError('expectedUpdatedAt y motivoCambio son obligatorios para auditar la edición');
    return (await this.request(`/evaluaciones/evidencias/${encodeURIComponent(evidenciaId)}`, {
      method: 'PUT', body: { ...payload, confirmarEscritura: true }, confirmarEscritura
    })).data.evidencia;
  }

  async archivarEvidenciaEvaluacion(evidenciaId, { motivo, confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Archivar una evidencia requiere confirmarEscritura: true');
    if (!motivo) throw new TypeError('motivo es obligatorio para auditar el archivo');
    return (await this.request(`/evaluaciones/evidencias/${encodeURIComponent(evidenciaId)}/archivar`, {
      method: 'POST', body: { motivo, confirmarEscritura: true }, confirmarEscritura
    })).data.evidencia;
  }

  async restaurarEvidenciaEvaluacion(evidenciaId, { motivo, confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Restaurar una evidencia requiere confirmarEscritura: true');
    if (!motivo) throw new TypeError('motivo es obligatorio para auditar la restauración');
    return (await this.request(`/evaluaciones/evidencias/${encodeURIComponent(evidenciaId)}/restaurar`, {
      method: 'POST', body: { motivo, confirmarEscritura: true }, confirmarEscritura
    })).data.evidencia;
  }

  async listarTodasEvidenciasEvaluacion({ limite = 120, ...filtros } = {}) {
    const evidencias = [];
    const cursoresUsados = new Set();
    let cursor;
    do {
      const pagina = await this.listarEvidenciasEvaluacion({ ...filtros, limite, ...(cursor ? { cursor } : {}) });
      evidencias.push(...(Array.isArray(pagina.evidencias) ? pagina.evidencias : []));
      cursor = pagina.nextCursor || undefined;
      if (cursor && cursoresUsados.has(cursor)) throw new Error('La paginación de evidencias repitió un cursor');
      if (cursor) cursoresUsados.add(cursor);
    } while (cursor);
    return evidencias;
  }

  async listarSolicitudesRevisionCalificacion() {
    return (await this.request('/calificaciones/revision/solicitudes')).data;
  }

  async resolverSolicitudRevisionCalificacion(solicitudId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Resolver una revisión puede modificar calificaciones; requiere confirmarEscritura: true');
    return (await this.request(`/calificaciones/revision/solicitudes/${encodeURIComponent(solicitudId)}/resolver`, {
      method: 'POST', body: payload
    })).data;
  }

  async sincronizarSolicitudesRevisionCalificacion(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Sincronizar solicitudes de revisión puede modificar calificaciones; requiere confirmarEscritura: true');
    return (await this.request('/calificaciones/revision/solicitudes/sincronizar', { method: 'POST', body: payload })).data;
  }

  async listaAcademica(periodoId) {
    if (typeof periodoId !== 'string' || !periodoId.trim()) {
      throw new TypeError('periodoId es obligatorio para consultar la lista académica');
    }
    const query = new URLSearchParams({ periodoId: periodoId.trim() });
    return (await this.request(`/analiticas/lista-academica?${query}`)).data;
  }

  async descargarCalificacionesCsv(periodoId) {
    if (typeof periodoId !== 'string' || !periodoId.trim()) {
      throw new TypeError('periodoId es obligatorio para descargar el CSV de calificaciones');
    }
    const query = new URLSearchParams({ periodoId: periodoId.trim() });
    return (await this.request(`/analiticas/calificaciones-csv?${query}`, { responseType: 'binary' })).data;
  }

  async descargarCalificacionesXlsx(periodoId) {
    if (typeof periodoId !== 'string' || !periodoId.trim()) {
      throw new TypeError('periodoId es obligatorio para descargar el XLSX de calificaciones');
    }
    const query = new URLSearchParams({ periodoId: periodoId.trim() });
    return (await this.request(`/analiticas/calificaciones-xlsx?${query}`, { responseType: 'binary' })).data;
  }

  async previsualizarBonoExtracurricular(payload) {
    if (typeof payload?.periodoId !== 'string' || !payload.periodoId.trim()
      || typeof payload?.alumnoId !== 'string' || !payload.alumnoId.trim()) {
      throw new TypeError('periodoId y alumnoId son obligatorios para previsualizar el bono');
    }
    if (typeof payload?.bono !== 'number' || !Number.isFinite(payload.bono) || payload.bono < 0 || payload.bono > 1) {
      throw new RangeError('El bono extracurricular debe ser un número entre 0 y 1');
    }
    return (await this.request('/analiticas/lista-academica/bono/preview', {
      method: 'POST', body: payload
    })).data;
  }

  async guardarBonoExtracurricular(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Guardar un bono modifica calificaciones; requiere confirmarEscritura: true y autorización docente');
    if (payload?.componente !== 'Bono extracurricular') throw new TypeError('El componente debe ser Bono extracurricular');
    return this.guardarCalificacionLista(payload, { confirmarEscritura });
  }

  async guardarCalificacionLista(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Guardar una calificación manual requiere confirmarEscritura: true y autorización docente');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID es obligatorio para recuperar reintentos de calificación manual');
    }
    if (typeof payload?.periodoId !== 'string' || !payload.periodoId.trim()
      || typeof payload?.alumnoId !== 'string' || !payload.alumnoId.trim()) {
      throw new TypeError('periodoId y alumnoId son obligatorios para guardar una calificación de lista');
    }
    if (payload.version !== undefined && (!Number.isInteger(payload.version) || payload.version < 1)) {
      throw new RangeError('version debe ser un entero positivo cuando se proporciona');
    }
    const maximosPorComponente = new Map([
      ['Practica 2do Parcial', 10],
      ['Exámen 2do Parcial', 5.25],
      ['Exámen Global', 5],
      ['Bono extracurricular', 1]
    ]);
    const maximo = maximosPorComponente.get(payload?.componente);
    if (maximo === undefined) {
      throw new TypeError('componente debe coincidir con una etiqueta académica admitida');
    }
    if (typeof payload?.calificacion !== 'number' || !Number.isFinite(payload.calificacion)
      || payload.calificacion < 0 || payload.calificacion > maximo) {
      throw new RangeError(`La calificación de ${payload.componente} debe estar entre 0 y ${maximo}`);
    }
    return (await this.request('/analiticas/lista-academica/calificaciones', {
      method: 'POST', body: payload
    })).data;
  }

  async cursosClassroom() {
    return (await this.request('/evaluaciones/v2/classroom/cursos')).data;
  }

  async actividadesClassroom(courseId, periodoId) {
    if (!periodoId) throw new TypeError('periodoId es obligatorio para consultar actividades Classroom');
    const query = new URLSearchParams({ periodoId: String(periodoId) });
    return (await this.request(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/actividades?${query}`)).data;
  }

  async alumnosCursoClassroom(courseId, periodoId) {
    if (!courseId) throw new TypeError('courseId es obligatorio para consultar alumnos Classroom');
    if (!periodoId) throw new TypeError('periodoId es obligatorio para consultar alumnos Classroom');
    const query = new URLSearchParams({ periodoId: String(periodoId) });
    return (await this.request(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/alumnos?${query}`)).data;
  }

  async actualizarMapeoAlumnosClassroom(courseId, payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Guardar vinculaciones Classroom modifica el padrón asociado; requiere confirmarEscritura: true');
    if (!courseId) throw new TypeError('courseId es obligatorio para guardar el mapeo de alumnos Classroom');
    if (!payload?.periodoId || !Array.isArray(payload?.asignaciones)) {
      throw new TypeError('periodoId y asignaciones son obligatorios para guardar el mapeo de alumnos Classroom');
    }
    return (await this.request(`/evaluaciones/v2/classroom/cursos/${encodeURIComponent(courseId)}/mapeo-alumnos`, {
      method: 'PUT', body: payload, confirmarEscritura
    })).data;
  }

  async historialImportacionesClassroom(periodoId) {
    if (!periodoId) throw new TypeError('periodoId es obligatorio para consultar el historial Classroom');
    const query = new URLSearchParams({ periodoId: String(periodoId) });
    return (await this.request(`/evaluaciones/v2/classroom/importaciones/historial?${query}`)).data;
  }

  async previsualizarImportacionClassroom(payload) {
    return (await this.request('/evaluaciones/v2/classroom/importaciones/preview', {
      method: 'POST', body: payload
    })).data;
  }

  async ejecutarImportacionClassroom(payload, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Importar calificaciones Classroom modifica evidencias; requiere confirmarEscritura: true');
    return (await this.request('/evaluaciones/v2/classroom/importaciones/ejecutar', {
      method: 'POST', body: payload, confirmarEscritura
    })).data;
  }

  async listarCodigosAcceso({ periodoId, estado, limite, cursor } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ periodoId, estado, limite, cursor })) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.size ? `?${query}` : '';
    return (await this.request(`/sincronizaciones/codigo-acceso${suffix}`)).data;
  }

  async obtenerCodigoAcceso(codigoAccesoId) {
    return (await this.request(`/sincronizaciones/codigo-acceso/${encodeURIComponent(codigoAccesoId)}`)).data.codigoAcceso;
  }

  async expirarCodigoAcceso(codigoAccesoId, { confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Expirar un código de acceso requiere confirmarEscritura: true');
    return (await this.request(`/sincronizaciones/codigo-acceso/${encodeURIComponent(codigoAccesoId)}/expirar`, { method: 'POST', body: {} })).data;
  }

  async generarCodigoAcceso(periodoId, { clientRequestId, confirmarEscritura = false } = {}) {
    if (!confirmarEscritura) throw new Error('Generar un código de acceso requiere confirmarEscritura: true');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(clientRequestId ?? ''))) {
      throw new TypeError('clientRequestId UUID estable es obligatorio para recuperar reintentos');
    }
    return (await this.request('/sincronizaciones/codigo-acceso', { method: 'POST', body: { periodoId, clientRequestId } })).data;
  }

  async adquisicionLease(equipoId) {
    return (await this.request('/sincronizaciones/local/lease/adquirir', { method: 'POST', body: { equipoId } })).data;
  }

  async renovarLease(equipoId, leaseId) {
    return (await this.request('/sincronizaciones/local/lease/renovar', { method: 'POST', body: { equipoId, leaseId } })).data;
  }

  async liberarLease(equipoId, leaseId) {
    return (await this.request('/sincronizaciones/local/lease/liberar', { method: 'POST', body: { equipoId, leaseId } })).data;
  }
}
