/**
 * controladorIntegracionesClassroom
 *
 * Responsabilidad: Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).
 * Limites: Evitar mover logica de negocio profunda a controlador.
 */
import type { Request, Response } from 'express';
import { URL } from 'node:url';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { IntegracionClassroom } from './modeloIntegracionClassroom';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia';
import {
  completarOauthClassroom,
  construirUrlOauthClassroom,
  desconectarOauthClassroom
} from './servicioClassroomGoogle';
import {
  actualizarMapeoAlumnosCurso,
  importarAlumnosClassroomAEvaluaPro,
  guardarMapeoLegadoYCurso,
  listarActividadesPorCurso,
  listarCursosParaDocente,
  listarHistorialSyncClassroom,
  obtenerAlumnosCursoClassroom,
  obtenerEstadoClassroom,
  sincronizarImportacionClassroom
} from './servicioSyncClassroom';

function normalizarTexto(valor: unknown): string {
  return String(valor || '').trim();
}

function obtenerFrontendOrigin(req: Request): string | undefined {
  const originHeader = normalizarTexto(req.headers.origin);
  if (originHeader) return originHeader;
  const referer = normalizarTexto(req.headers.referer);
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export async function iniciarOauthClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const frontendOrigin = obtenerFrontendOrigin(req);
  const { url } = construirUrlOauthClassroom(docenteId, { frontendOrigin });
  const integracion = await IntegracionClassroom.findOne({ docenteId }).lean();
  res.json({
    url,
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null
  });
}

function responderCallbackHtml(res: Response, exito: boolean, mensaje: string) {
  const estado = exito ? 'ok' : 'error';
  const detalleEscapado = mensaje
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${exito ? 'Google Classroom Conectado' : 'Error de Conexión'} · EvaluaPro</title>
  <style>
    :root {
      --bg: #070d1e;
      --card-bg: rgba(15, 23, 42, 0.88);
      --border: ${exito ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'};
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: ${exito ? '#10b981' : '#ef4444'};
      --accent-glow: ${exito ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'};
      --btn-bg: ${exito ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at 50% 20%, #172554 0%, #070d1e 100%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.4rem 2rem;
      max-width: 460px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 24px 48px -12px rgba(0,0,0,0.8), 0 0 40px -5px var(--accent-glow);
      backdrop-filter: blur(20px);
      animation: popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.92) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .orb {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: var(--accent-glow);
      border: 1px solid var(--border);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.2rem;
      color: var(--accent);
      box-shadow: 0 0 20px var(--accent-glow);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px;
      padding: 0.3rem 0.8rem;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.8rem;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
      color: #ffffff;
    }
    p.desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 1.4rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      padding: 0.7rem 1.2rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 1.5rem;
      max-width: 100%;
    }
    .chip svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem 1.2rem;
      border-radius: 12px;
      border: none;
      background: var(--btn-bg);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--accent-glow);
      transition: all 0.2s ease;
    }
    .btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
    }
    .progress-wrap {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 1.2rem;
    }
    .progress-bar {
      height: 100%;
      width: 100%;
      background: var(--accent);
      animation: countdown 2.2s linear forwards;
    }
    @keyframes countdown {
      from { width: 100%; }
      to { width: 0%; }
    }
    .timer-text {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="orb">
      ${exito ? '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'}
    </div>
    <div class="badge">
      <span class="badge-dot"></span>
      <span>Google Workspace · EvaluaPro</span>
    </div>
    <h1>${exito ? '¡Vinculación Exitosa!' : 'No se pudo conectar'}</h1>
    <p class="desc">
      ${exito ? 'La conexión segura con Google Classroom se ha establecido. Ya puedes sincronizar tus cursos y tareas.' : 'Ocurrió un problema al autorizar la cuenta de Google.'}
    </p>
    <div class="chip">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      <span>${detalleEscapado}</span>
    </div>
    <button type="button" class="btn" onclick="cerrar()">
      Cerrar ventana
    </button>
    ${exito ? '<div class="progress-wrap"><div class="progress-bar"></div></div><div class="timer-text">Cerrando automáticamente en breve...</div>' : ''}
  </div>

  <script>
    function emitirNotificaciones() {
      try {
        if (window.opener) {
          window.opener.postMessage({ source: 'classroom-oauth', status: '${estado}', message: '${detalleEscapado}' }, '*');
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('ep_classroom_sync');
          bc.postMessage({ source: 'classroom-oauth', status: '${estado}', message: '${detalleEscapado}' });
          bc.close();
        }
      } catch (e) {}
      try {
        localStorage.setItem('ep.classroom.event', JSON.stringify({ ts: Date.now(), status: '${estado}', message: '${detalleEscapado}' }));
      } catch (e) {}
    }

    emitirNotificaciones();

    function cerrar() {
      emitirNotificaciones();
      try {
        window.open('', '_self', '');
        window.close();
      } catch (e) {}
      try {
        self.close();
      } catch (e) {}
    }

    ${exito ? 'setTimeout(() => { cerrar(); }, 400);' : ''}
  </script>
</body>
</html>`;

  res.status(exito ? 200 : 400).type('html').send(html);
}

export async function callbackOauthClassroom(req: Request, res: Response) {
  const error = normalizarTexto(req.query.error);
  if (error) {
    responderCallbackHtml(res, false, `Google devolvió error OAuth: ${error}`);
    return;
  }

  try {
    const code = normalizarTexto(req.query.code);
    const state = normalizarTexto(req.query.state);
    const resultado = await completarOauthClassroom({ code, state });
    responderCallbackHtml(
      res,
      true,
      `Cuenta Classroom conectada: ${resultado.correoGoogle || 'sin correo'}`
    );
  } catch (errorCallback) {
    const mensaje =
      errorCallback instanceof ErrorAplicacion ? errorCallback.message : 'No se pudo completar la conexión OAuth';
    responderCallbackHtml(res, false, mensaje);
  }
}

export async function obtenerEstadoClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const estado = await obtenerEstadoClassroom(docenteId);
  res.json({ estado });
}

export async function desconectarOauthClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  await desconectarOauthClassroom(docenteId);
  res.status(204).end();
}

export async function listarCursosClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const cursos = await listarCursosParaDocente(docenteId);
  res.json({ cursos });
}

export async function listarActividadesClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const periodoId = normalizarTexto(req.query.periodoId);
  const actividades = await listarActividadesPorCurso(docenteId, courseId, periodoId || undefined);
  res.json({ actividades });
}

export async function obtenerAlumnosCursoClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const periodoId = normalizarTexto(req.query.periodoId);
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
  const roster = await obtenerAlumnosCursoClassroom(docenteId, periodoId, courseId);
  res.json(roster);
}

export async function actualizarMapeoAlumnosCursoController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const payload = req.body as { periodoId: string; asignaciones: Array<{ classroomUserId: string; alumnoId?: string | null }> };
  const roster = await actualizarMapeoAlumnosCurso({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    courseId,
    asignaciones: Array.isArray(payload.asignaciones) ? payload.asignaciones : []
  });
  res.json(roster);
}

export async function previewImportacionClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as { periodoId: string; actividades: unknown[]; limiteSubmissions?: number };
  const preview = await sincronizarImportacionClassroom({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    actividades: (Array.isArray(payload.actividades) ? payload.actividades : []) as Array<{
      courseId: string;
      courseWorkId: string;
      tituloEvidencia?: string;
      descripcionEvidencia?: string;
      ponderacion?: number;
      corte?: number;
      activo?: boolean;
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: false
  });
  res.json(preview);
}

export async function ejecutarImportacionClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as { periodoId: string; actividades: unknown[]; limiteSubmissions?: number };
  const resultado = await sincronizarImportacionClassroom({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    actividades: (Array.isArray(payload.actividades) ? payload.actividades : []) as Array<{
      courseId: string;
      courseWorkId: string;
      tituloEvidencia?: string;
      descripcionEvidencia?: string;
      ponderacion?: number;
      corte?: number;
      activo?: boolean;
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: true
  });
  res.json(resultado);
}

export async function listarHistorialSyncClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
  const historial = await listarHistorialSyncClassroom(docenteId, periodoId);
  res.json({ historial });
}

export async function mapearClassroomEvidencia(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);
  const actividad = {
    courseId: normalizarTexto(payload.courseId),
    courseWorkId: normalizarTexto(payload.courseWorkId),
    tituloEvidencia: normalizarTexto(payload.tituloEvidencia) || undefined,
    descripcionEvidencia: normalizarTexto(payload.descripcionEvidencia) || undefined,
    ponderacion: Number(payload.ponderacion ?? 1),
    corte: Number(payload.corte || 0) || undefined,
    activo: payload.activo === false ? false : true
  };
  const asignacionesAlumnos = (Array.isArray(payload.asignacionesAlumnos)
    ? payload.asignacionesAlumnos
    : [])
    .map((item) => item as { classroomUserId?: string; alumnoId?: string })
    .map((item) => ({
      classroomUserId: normalizarTexto(item.classroomUserId),
      alumnoId: normalizarTexto(item.alumnoId)
    }))
    .filter((item) => Boolean(item.classroomUserId && item.alumnoId));

  await guardarMapeoLegadoYCurso({
    docenteId,
    periodoId,
    actividad,
    asignacionesAlumnos
  });

  const mapeo = await MapeoClassroomEvidencia.findOne({
    docenteId,
    periodoId,
    courseId: actividad.courseId,
    courseWorkId: actividad.courseWorkId
  }).lean();

  res.status(201).json({ mapeo, deprecado: true });
}

export async function listarMapeosClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  const filtro: Record<string, unknown> = { docenteId };
  if (periodoId) filtro.periodoId = periodoId;
  const [mapeos, estado] = await Promise.all([
    MapeoClassroomEvidencia.find(filtro).sort({ updatedAt: -1 }).lean(),
    obtenerEstadoClassroom(docenteId)
  ]);
  res.json({
    conectado: estado.conectado,
    correoGoogle: estado.correoGoogle,
    mapeos,
    deprecado: true
  });
}

export async function ejecutarPullClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);
  const courseIdFiltro = normalizarTexto(payload.courseId);
  const courseWorkIdFiltro = normalizarTexto(payload.courseWorkId);
  const limiteSubmissions = Math.max(1, Math.min(500, Number(payload.limiteSubmissions ?? 200) || 200));

  const filtro: Record<string, unknown> = { docenteId, periodoId, activo: true };
  if (courseIdFiltro) filtro.courseId = courseIdFiltro;
  if (courseWorkIdFiltro) filtro.courseWorkId = courseWorkIdFiltro;

  const mapeos = await MapeoClassroomEvidencia.find(filtro).lean();
  if (!Array.isArray(mapeos) || mapeos.length === 0) {
    throw new ErrorAplicacion('CLASSROOM_MAPEO_NO_ENCONTRADO', 'No existen mapeos activos para ese periodo/filtro', 404);
  }

  const resultado = await sincronizarImportacionClassroom({
    docenteId,
    periodoId,
    actividades: mapeos.map((mapeo) => ({
      courseId: normalizarTexto(mapeo.courseId),
      courseWorkId: normalizarTexto(mapeo.courseWorkId),
      tituloEvidencia: normalizarTexto(mapeo.tituloEvidencia) || undefined,
      descripcionEvidencia: normalizarTexto(mapeo.descripcionEvidencia) || undefined,
      ponderacion: Number(mapeo.ponderacion ?? 1),
      corte: Number.isFinite(Number(mapeo.corte)) ? Number(mapeo.corte) : undefined,
      activo: mapeo.activo !== false
    })),
    limiteSubmissions,
    persistir: true
  });

  res.json({
    dryRun: false,
    totalMapeos: resultado.totalActividades,
    submissionsProcesadas: resultado.submissionsProcesadas,
    importadas: resultado.importadas,
    actualizadas: resultado.actualizadas,
    omitidas: resultado.omitidas,
    errores: resultado.errores,
    deprecado: true
  });
}

export async function importarAlumnosClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const { periodoId, alumnos } = req.body;
  const resultado = await importarAlumnosClassroomAEvaluaPro({
    docenteId,
    periodoId: normalizarTexto(periodoId),
    courseId,
    alumnos: Array.isArray(alumnos) ? alumnos : []
  });
  res.status(200).json(resultado);
}
