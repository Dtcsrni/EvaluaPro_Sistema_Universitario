/**
 * servicioSesiones
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio para refresh tokens rotatorios.
 */
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';

const COOKIE_REFRESH_DOCENTE = 'refreshDocente';

function msDias(dias: number) {
  return dias * 24 * 60 * 60 * 1000;
}

function crearTokenRefresh() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function leerCookie(req: Request, nombre: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  const parts = header.split(';');
  for (const p of parts) {
    const [kRaw, ...vParts] = p.trim().split('=');
    const k = (kRaw ?? '').trim();
    if (!k) continue;
    if (k !== nombre) continue;
    const v = vParts.join('=');
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}

function opcionesCookieRefresh() {
  return {
    httpOnly: true,
    secure: configuracion.entorno === 'production',
    sameSite: 'lax' as const,
    path: '/api/autenticacion',
    maxAge: msDias(configuracion.refreshTokenDias)
  };
}

export async function emitirSesionDocente(res: Response, docenteId: string) {
  const token = crearTokenRefresh();
  const tokenHash = hashToken(token);
  const ahora = new Date();

  await prisma.sesionDocente.create({
    data: {
      docenteId,
      tokenHash,
      creadoEn: ahora,
      ultimoUso: ahora,
      expiraEn: new Date(Date.now() + msDias(configuracion.refreshTokenDias))
    }
  });

  res.cookie(COOKIE_REFRESH_DOCENTE, token, opcionesCookieRefresh());
}

export async function refrescarSesionDocente(req: Request, res: Response): Promise<string> {
  const token = leerCookie(req, COOKIE_REFRESH_DOCENTE);
  if (!token) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }

  const ahora = new Date();
  const tokenHash = hashToken(token);

  const sesion = await prisma.sesionDocente.findFirst({
    where: {
      tokenHash,
      revocadoEn: null,
      expiraEn: { gt: ahora }
    }
  });
  if (!sesion) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion expirada', 401);
  }

  const nuevoToken = crearTokenRefresh();
  await prisma.sesionDocente.update({
    where: { id: sesion.id },
    data: {
      tokenHash: hashToken(nuevoToken),
      ultimoUso: ahora,
      expiraEn: new Date(Date.now() + msDias(configuracion.refreshTokenDias))
    }
  });

  res.cookie(COOKIE_REFRESH_DOCENTE, nuevoToken, opcionesCookieRefresh());

  return sesion.docenteId;
}

export async function cerrarSesionDocente(req: Request, res: Response) {
  const token = leerCookie(req, COOKIE_REFRESH_DOCENTE);
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.sesionDocente.updateMany({
      where: { tokenHash, revocadoEn: null },
      data: { revocadoEn: new Date() }
    });
  }

  res.clearCookie(COOKIE_REFRESH_DOCENTE, { path: '/api/autenticacion' });
}

export async function revocarSesionesDocente(docenteId: string) {
  await prisma.sesionDocente.updateMany({
    where: { docenteId, revocadoEn: null },
    data: { revocadoEn: new Date() }
  });
}
