/**
 * Middleware para requerir sesion docente via JWT.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { normalizarRoles } from '../../infraestructura/seguridad/rbac.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { verificarTokenDocente } from './servicioTokens.js';

export type SolicitudDocente = Request & { docenteId?: string; docenteRoles?: string[]; docentePermisosApi?: string[]; apiCredentialId?: string };

export function rutaPermitidaParaApiDelegada(req: SolicitudDocente, permisos: ReadonlySet<string>) {
  const rutaCompleta = `${req.baseUrl}${req.path}`.replace(/\/+$/, '') || '/';
  const ruta = rutaCompleta.replace(/^\/api(?=\/)/, '');
  if (ruta === '/preflight') return permisos.size > 0;
  if (/^\/omr\/ingestas\/[^/]+\/(?:calificacion-preview|calificar)$/.test(ruta)) {
    return req.method === 'POST' && permisos.has('omr:analizar') && permisos.has('calificaciones:calificar');
  }
  if (ruta === '/autenticacion/api-clientes/mia/revocar' && req.apiCredentialId) return true;
  const rutasOmr: Array<[string, RegExp]> = [
    ['POST', /^\/omr\/analizar$/],
    ['POST', /^\/omr\/ingestas\/prevalidar-referencia$/],
    ['POST', /^\/omr\/ingestas$/],
    ['POST', /^\/omr\/ingestas\/[^/]+\/(?:dataset-export|reintentar)$/],
    ['GET', /^\/omr\/ingestas\/por-clave\/[^/]+$/],
    ['GET', /^\/omr\/ingestas\/[^/]+(?:\/manifiesto)?$/],
    ['GET', /^\/omr\/ingestas\/[^/]+\/paginas\/[^/]+\/(?:preview|reference-preview)$/],
    ['POST', /^\/omr\/ingestas\/[^/]+\/paginas\/[^/]+\/resolver$/],
    ['GET', /^\/omr\/ingestas\/[^/]+\/(?:originales\/[^/]+|paquetes\/[^/]+)$/],
    ['POST', /^\/omr\/prevalidar-lote$/],
    ['GET', /^\/omr\/jobs$/],
    ['POST', /^\/omr\/jobs$/],
    ['GET', /^\/omr\/jobs\/[^/]+$/],
    ['POST', /^\/omr\/jobs\/[^/]+\/(?:exceptions\/[^/]+\/resolve|finalize)$/]
  ];
  if (rutasOmr.some(([method, pattern]) => req.method === method && pattern.test(ruta))) {
    return permisos.has('omr:analizar');
  }
  const prefijos: Array<[string, string[]]> = [
    ['/periodos', ['periodos:leer', 'periodos:gestionar', 'periodos:archivar']],
    ['/alumnos', ['alumnos:leer', 'alumnos:gestionar']],
    ['/temarios', ['temarios:leer', 'temarios:gestionar']],
    ['/banco-preguntas', ['banco:leer', 'banco:gestionar', 'banco:ingestar', 'banco:revisar', 'banco:publicar', 'banco:archivar']],
    ['/examenes', ['plantillas:leer', 'plantillas:gestionar', 'plantillas:previsualizar', 'examenes:leer', 'examenes:generar', 'examenes:descargar']],
    ['/entregas', ['entregas:gestionar']],
    ['/omr', ['omr:analizar']],
    ['/calificaciones', ['calificaciones:calificar']],
    ['/analiticas', ['analiticas:leer']],
    ['/asistencias', ['asistencias:leer', 'asistencias:gestionar']]
  ];
  const prefijo = prefijos.find(([base]) => ruta === base || ruta.startsWith(`${base}/`));
  return Boolean(prefijo && prefijo[1].some((permiso) => permisos.has(permiso)));
}

export async function requerirDocente(req: SolicitudDocente, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization ?? '';
  const [tipo, token] = auth.split(' ');

  if (tipo !== 'Bearer' || !token) {
    next(new ErrorAplicacion('NO_AUTORIZADO', 'Token requerido', 401));
    return;
  }

  let docenteId: string;
  let apiPermisos: string[] | undefined;
  let apiCredentialId: string | undefined;
  try {
    const claims = verificarTokenDocente(token);
    docenteId = claims.docenteId;
    apiCredentialId = claims.apiCredentialId;
  } catch {
    next(new ErrorAplicacion('TOKEN_INVALIDO', 'Token invalido o expirado', 401));
    return;
  }

  try {
    if (apiCredentialId) {
      const credencial = await prisma.credencialApiDocente.findUnique({
        where: { id: apiCredentialId },
        select: { docenteId: true, permisos: true, expiresAt: true, revokedAt: true }
      });
      if (!credencial || credencial.docenteId !== docenteId || credencial.revokedAt || credencial.expiresAt <= new Date()) {
        next(new ErrorAplicacion('NO_AUTORIZADO', 'Credencial API revocada o expirada', 401));
        return;
      }
      apiPermisos = JSON.parse(credencial.permisos) as string[];
      if (!rutaPermitidaParaApiDelegada(req, new Set(apiPermisos))) {
        next(new ErrorAplicacion('NO_AUTORIZADO', 'La credencial API no permite esta ruta', 403));
        return;
      }
    }
    const docente = await prisma.docente.findUnique({
      where: { id: docenteId },
      select: { activo: true, roles: true }
    });
    if (!docente) {
      next(new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401));
      return;
    }
    if (!docente.activo) {
      next(new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403));
      return;
    }

    const rolesArray = typeof docente.roles === 'string' ? JSON.parse(docente.roles) : [];
    const roles = normalizarRoles(rolesArray);
    req.docenteId = docenteId;
    req.docenteRoles = roles.length > 0 ? roles : ['docente'];
    req.docentePermisosApi = apiPermisos;
    req.apiCredentialId = apiCredentialId;
    if (apiCredentialId) {
      await prisma.credencialApiDocente.update({ where: { id: apiCredentialId }, data: { lastUsedAt: new Date() } });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function obtenerDocenteId(req: SolicitudDocente) {
  if (!req.docenteId) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }
  return req.docenteId;
}
