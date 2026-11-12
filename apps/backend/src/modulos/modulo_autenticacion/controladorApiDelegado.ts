import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { permisosParaRoles } from '../../infraestructura/seguridad/rbac.js';
import type { SolicitudDocente } from './middlewareAutenticacion.js';
import { obtenerDocenteId } from './middlewareAutenticacion.js';
import { crearTokenApiDelegado } from './servicioTokens.js';
import {
  crearRefreshApi,
  crearSolicitudApiLocal,
  hashRefreshApi,
  inspeccionarSolicitudApiLocal,
  intercambiarSolicitudApiLocal,
  normalizarPermisosApi,
  resolverSolicitudApiLocal
} from './servicioApiDelegado.js';

const DURACION_TOKEN_ACCESO_SEGUNDOS = 15 * 60;

function permisosDisponibles(req: SolicitudDocente) {
  return permisosParaRoles(req.docenteRoles ?? []);
}

function registrarEventoApi(docenteId: string, accion: string, meta: Record<string, unknown>) {
  return prisma.eventoUso.create({
    data: { docenteId, accion, meta: JSON.stringify(meta) }
  });
}

export function crearSolicitudApiLocalControlador(req: Request, res: Response) {
  const body = req.body as { codeChallenge: string; nombreCliente: string; permisos: string[] };
  const solicitud = crearSolicitudApiLocal(body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json(solicitud);
}

export function inspeccionarSolicitudApiLocalControlador(req: SolicitudDocente, res: Response) {
  const body = req.body as { codigo: string };
  const solicitud = inspeccionarSolicitudApiLocal(body.codigo, permisosDisponibles(req));
  if (!solicitud) throw new ErrorAplicacion('SOLICITUD_API_NO_DISPONIBLE', 'Código inválido, usado o expirado.', 404);
  res.json(solicitud);
}

export async function resolverSolicitudApiLocalControlador(req: SolicitudDocente, res: Response) {
  const body = req.body as { codigo: string; permitir: boolean; permisos?: string[] };
  const docenteId = obtenerDocenteId(req);
  const disponibles = permisosDisponibles(req);
  const inspeccion = inspeccionarSolicitudApiLocal(body.codigo, disponibles);
  if (!inspeccion) throw new ErrorAplicacion('SOLICITUD_API_NO_DISPONIBLE', 'Código inválido, usado o expirado.', 404);

  if (!body.permitir) {
    const denegada = resolverSolicitudApiLocal({
      solicitudId: inspeccion.solicitudId,
      codigo: body.codigo,
      permitir: false,
      docenteId,
      permisosDisponibles: disponibles
    });
    if (!denegada) throw new ErrorAplicacion('SOLICITUD_API_NO_DISPONIBLE', 'La solicitud ya no está pendiente.', 409);
    await registrarEventoApi(docenteId, 'api_local_solicitud_denegada', { nombreCliente: inspeccion.nombreCliente });
    res.json({ estado: 'denegada' });
    return;
  }

  const permisos = normalizarPermisosApi(body.permisos);
  if (permisos.some((permiso) => !inspeccion.permisosSolicitados.includes(permiso) || !disponibles.has(permiso))) {
    throw new ErrorAplicacion('PERMISOS_API_INVALIDOS', 'Concede solo permisos solicitados y disponibles para tu cuenta.', 403);
  }
  const refreshToken = crearRefreshApi();
  const credencialId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + configuracion.refreshTokenDias * 24 * 60 * 60 * 1000);
  await prisma.credencialApiDocente.create({
    data: {
      id: credencialId,
      docenteId,
      nombre: inspeccion.nombreCliente,
      permisos: JSON.stringify(permisos),
      refreshTokenHash: hashRefreshApi(refreshToken),
      expiresAt
    }
  });
  const aprobada = resolverSolicitudApiLocal({
    solicitudId: inspeccion.solicitudId,
    codigo: body.codigo,
    permitir: true,
    docenteId,
    permisosConcedidos: permisos,
    permisosDisponibles: disponibles,
    credencialId,
    refreshToken
  });
  if (!aprobada) {
    await prisma.credencialApiDocente.update({ where: { id: credencialId }, data: { revokedAt: new Date() } });
    throw new ErrorAplicacion('SOLICITUD_API_NO_DISPONIBLE', 'La solicitud ya no está pendiente.', 409);
  }
  await registrarEventoApi(docenteId, 'api_local_credencial_creada', {
    credencialId,
    nombreCliente: inspeccion.nombreCliente,
    permisos,
    expiresAt: expiresAt.toISOString()
  });
  res.json({ estado: 'aprobada', credencialId, permisos, expiresAt: expiresAt.toISOString() });
}

export function intercambiarSolicitudApiLocalControlador(req: Request, res: Response) {
  const body = req.body as { solicitudId: string; codeVerifier: string };
  const resultado = intercambiarSolicitudApiLocal(body);
  if (resultado.estado === 'pendiente') {
    res.status(202).json({ estado: 'pendiente' });
    return;
  }
  if (resultado.estado !== 'aprobada') {
    throw new ErrorAplicacion('SOLICITUD_API_NO_DISPONIBLE', 'La solicitud no puede intercambiarse.', 410);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ estado: 'aprobada', refreshToken: resultado.refreshToken, credencialId: resultado.credencialId });
}

export async function refrescarTokenApiDelegadoControlador(req: Request, res: Response) {
  const refreshToken = String((req.body as { refreshToken?: unknown }).refreshToken || '');
  const credencial = await prisma.credencialApiDocente.findUnique({
    where: { refreshTokenHash: hashRefreshApi(refreshToken) },
    select: { id: true, docenteId: true, permisos: true, expiresAt: true, revokedAt: true }
  });
  if (!credencial || credencial.revokedAt || credencial.expiresAt <= new Date()) {
    throw new ErrorAplicacion('CREDENCIAL_API_INVALIDA', 'Credencial API revocada o expirada.', 401);
  }
  const docente = await prisma.docente.findUnique({
    where: { id: credencial.docenteId },
    select: { id: true, activo: true, roles: true }
  });
  if (!docente?.activo) throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo.', 403);
  const roles = typeof docente.roles === 'string' ? JSON.parse(docente.roles) as string[] : [];
  const disponible = permisosParaRoles(roles);
  const permisos = normalizarPermisosApi(JSON.parse(credencial.permisos));
  const permisosVigentes = permisos.filter((permiso) => disponible.has(permiso));
  if (!permisosVigentes.length) throw new ErrorAplicacion('CREDENCIAL_API_SIN_PERMISOS', 'La cuenta ya no conserva los permisos delegados.', 403);
  await prisma.credencialApiDocente.update({ where: { id: credencial.id }, data: { lastUsedAt: new Date() } });
  const token = crearTokenApiDelegado({ docenteId: docente.id, roles, apiCredentialId: credencial.id });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token, tokenType: 'Bearer', expiresIn: DURACION_TOKEN_ACCESO_SEGUNDOS, permisos: permisosVigentes });
}

export async function listarCredencialesApiDocenteControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const credenciales = await prisma.credencialApiDocente.findMany({
    where: { docenteId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, nombre: true, permisos: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true }
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ credenciales: credenciales.map((credencial) => ({
    ...credencial,
    permisos: JSON.parse(credencial.permisos) as string[]
  })) });
}

export async function revocarCredencialApiDocenteControlador(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const credencialId = String(req.params.credencialId || req.apiCredentialId || '');
  const credencial = await prisma.credencialApiDocente.findFirst({ where: { id: credencialId, docenteId } });
  if (!credencial) throw new ErrorAplicacion('CREDENCIAL_API_NO_ENCONTRADA', 'No se encontró esa credencial API.', 404);
  if (!credencial.revokedAt) {
    await prisma.credencialApiDocente.update({ where: { id: credencial.id }, data: { revokedAt: new Date() } });
    await registrarEventoApi(docenteId, 'api_local_credencial_revocada', { credencialId });
  }
  res.json({ id: credencial.id, revoked: true });
}
