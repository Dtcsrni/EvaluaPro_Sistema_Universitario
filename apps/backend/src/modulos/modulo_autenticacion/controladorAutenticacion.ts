/**
 * Controlador de autenticacion docente.
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { crearHash, compararContrasena } from './servicioHash.js';
import { crearTokenDocente } from './servicioTokens.js';
import { obtenerDocenteId, type SolicitudDocente } from './middlewareAutenticacion.js';
import { cerrarSesionDocente, emitirSesionDocente, refrescarSesionDocente, revocarSesionesDocente } from './servicioSesiones.js';
import { verificarCredencialGoogle, type PerfilGoogle } from './servicioGoogle.js';
import { permisosComoLista, normalizarRoles } from '../../infraestructura/seguridad/rbac.js';
import { enviarCorreo } from '../../infraestructura/correo/servicioCorreo.js';
import { aTituloPropio } from '../../compartido/utilidades/texto.js';
import { log } from '../../infraestructura/logging/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UUID_FLUJO_AUTENTICACION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolverPaginasPreferidas(valor: unknown, predeterminado: number): number {
  const paginas = Number(valor);
  return Number.isInteger(paginas) && paginas >= 2 && paginas <= 50 && paginas % 2 === 0
    ? paginas
    : predeterminado;
}

function registrarTrazaAutenticacion(
  req: Request,
  metodo: 'google' | 'contrasena',
  etapa: string,
  resultado: 'iniciado' | 'exito' | 'error',
  detalle: { codigo?: string; duracionMs?: number } = {}
) {
  const authFlowId = String(req.header('x-auth-flow-id') || '').trim();
  const requestId = (req as Request & { requestId?: string }).requestId;
  log(resultado === 'error' ? 'warn' : 'info', 'Etapa de autenticación docente', {
    requestId,
    ...(UUID_FLUJO_AUTENTICACION.test(authFlowId) ? { authFlowId } : {}),
    authMethod: metodo,
    stage: etapa,
    outcome: resultado,
    ...(detalle.codigo ? { code: detalle.codigo } : {}),
    ...(detalle.duracionMs !== undefined ? { durationMs: detalle.duracionMs } : {})
  });
}

function codigoErrorAutenticacion(error: unknown, alternativo: string): string {
  const codigo = error instanceof ErrorAplicacion ? error.codigo : alternativo;
  return /^[A-Z0-9_]{1,64}$/.test(codigo) ? codigo : alternativo;
}

function rolesParaToken(roles: unknown): string[] {
  const normalizados = normalizarRoles(roles);
  return normalizados.length > 0 ? normalizados : ['docente'];
}

function esCorreoSuperadminGoogle(correo: string): boolean {
  const normalizado = String(correo || '').trim().toLowerCase();
  return normalizado.length > 0 && configuracion.superadminGoogleEmails.includes(normalizado);
}

function fusionarRolesGoogleConSuperadmin(rolesActuales: unknown, correoGoogle: string): string[] {
  const base = new Set(rolesParaToken(rolesActuales));
  base.add('docente');
  if (esCorreoSuperadminGoogle(correoGoogle)) {
    base.add('admin');
    base.add('superadmin_negocio');
  }
  return rolesParaToken(Array.from(base));
}

function resolverScriptAccesosDirectos(): string {
  const posibles = [
    path.resolve(process.cwd(), 'scripts', 'create-shortcuts.ps1'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'create-shortcuts.ps1'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'scripts', 'create-shortcuts.ps1')
  ];
  const unico = new Set(posibles.map((ruta) => path.normalize(ruta)));
  for (const ruta of unico) {
    if (fs.existsSync(ruta)) return ruta;
  }
  throw new ErrorAplicacion(
    'SHORTCUT_SCRIPT_NOT_FOUND',
    'No se encontro scripts/create-shortcuts.ps1 en este entorno.',
    404
  );
}

function ejecutarRegeneracionAccesos(scriptPath: string): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proceso = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Force'],
      {
        cwd: path.resolve(path.dirname(scriptPath), '..'),
        windowsHide: true
      }
    );
    let stdout = '';
    let stderr = '';
    let terminado = false;
    const timeout = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      try {
        proceso.kill();
      } catch {
        // noop
      }
      resolve({ ok: false, code: 124, stdout, stderr: `${stderr}\nTimeout` });
    }, 90_000);

    proceso.stdout.on('data', (chunk) => { stdout += String(chunk ?? ''); });
    proceso.stderr.on('data', (chunk) => { stderr += String(chunk ?? ''); });
    proceso.on('error', (error) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timeout);
      resolve({ ok: false, code: 1, stdout, stderr: `${stderr}\n${error?.message || 'error'}` });
    });
    proceso.on('exit', (code) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timeout);
      resolve({ ok: Number(code || 0) === 0, code: Number(code || 0), stdout, stderr });
    });
  });
}

function hashTokenRecuperacion(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function crearTokenRecuperacion(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function ipSolicitud(req: Request): string {
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

function assertPasswordAuthDisponible() {
  if (!configuracion.requireGoogleOAuth) return;
  throw new ErrorAplicacion(
    'GOOGLE_OAUTH_REQUIRED',
    'Esta instalación requiere inicio de sesión con Google.',
    403
  );
}

function obtenerCapacidadesOauthClassroom() {
  const oauthGoogleBackend = Boolean(String(configuracion.googleOauthClientId || '').trim());
  const classroomBackend = Boolean(
    configuracion.classroomEnabled &&
    String(configuracion.googleClassroomClientId || '').trim() &&
      String(configuracion.googleClassroomClientSecret || '').trim() &&
      String(configuracion.googleClassroomRedirectUri || '').trim() &&
      String(configuracion.classroomTokenCipherKey || '').trim()
  );
  const smtpBackend = Boolean(
    configuracion.correoModuloActivo &&
      String(configuracion.notificacionesWebhookUrl || '').trim() &&
      String(configuracion.notificacionesWebhookToken || '').trim()
  );
  const snapshotGoogleDisponible = Boolean(
    oauthGoogleBackend &&
      String(configuracion.respaldoCifradoSecreto || '').trim() &&
      (configuracion.entorno !== 'production' || String(process.env.EVALUAPRO_BACKUP_CIFRADO_SECRETO || '').trim())
  );

  return {
    oauthGoogleBackend,
    ...(oauthGoogleBackend ? { googleOauthClientId: String(configuracion.googleOauthClientId).trim() } : {}),
    snapshotGoogleDisponible,
    classroomBackend,
    smtpBackend,
    requireGoogleOAuth: configuracion.requireGoogleOAuth,
    passwordLoginAllowed: !configuracion.requireGoogleOAuth
  };
}

async function responderSesionDocente(
  res: Response,
  docente: {
    id: string;
    nombreCompleto: string;
    nombres?: string | null;
    apellidos?: string | null;
    correo: string;
    roles?: string;
  },
  status = 200
) {
  const rolesArray = typeof docente.roles === 'string' ? JSON.parse(docente.roles) : [];
  await emitirSesionDocente(res, docente.id);
  const token = crearTokenDocente({ docenteId: docente.id, roles: rolesParaToken(rolesArray) });
  res.status(status).json({
    token,
    docente: {
      id: docente.id,
      nombreCompleto: docente.nombreCompleto,
      ...(docente.nombres ? { nombres: docente.nombres } : {}),
      ...(docente.apellidos ? { apellidos: docente.apellidos } : {}),
      correo: docente.correo
    }
  });
}

export async function registrarDocente(req: Request, res: Response) {
  assertPasswordAuthDisponible();
  const { nombres, apellidos, nombreCompleto, correo, contrasena } = req.body;
  const correoFinal = String(correo || '').toLowerCase();

  const existente = await prisma.docente.findUnique({ where: { correo: correoFinal } });
  if (existente) {
    throw new ErrorAplicacion('DOCENTE_EXISTE', 'El correo ya esta registrado', 409);
  }

  const hashContrasena = await crearHash(contrasena);
  const nombresFormatted = nombres ? aTituloPropio(nombres) : null;
  const apellidosFormatted = apellidos ? aTituloPropio(apellidos) : null;
  const nombreCompletoFormatted = aTituloPropio(nombreCompleto || '');

  const docente = await prisma.docente.create({
    data: {
      nombres: nombresFormatted,
      apellidos: apellidosFormatted,
      nombreCompleto: nombreCompletoFormatted,
      correo: correoFinal,
      hashContrasena,
      roles: JSON.stringify(['docente']),
      activo: true,
      ultimoAcceso: new Date()
    }
  });

  await responderSesionDocente(res, docente, 201);
}

export async function registrarDocenteGoogle(req: Request, res: Response) {
  const { credential, nombres, apellidos, nombreCompleto, contrasena } = req.body as {
    credential?: unknown;
    nombres?: unknown;
    apellidos?: unknown;
    nombreCompleto?: unknown;
    contrasena?: unknown;
  };

  const perfil = await verificarCredencialGoogle(String(credential ?? ''));
  const correo = perfil.correo.toLowerCase();

  const existente = await prisma.docente.findUnique({ where: { correo } });
  if (existente) {
    if (!existente.activo) {
      throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
    }
    if (existente.googleSub && existente.googleSub !== perfil.sub) {
      throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
    }
    
    const rolesActuales = JSON.parse(existente.roles || '[]');
    const rolesFinales = fusionarRolesGoogleConSuperadmin(rolesActuales, perfil.correo);
    
    const actualizado = await prisma.docente.update({
      where: { id: existente.id },
      data: {
        googleSub: perfil.sub,
        ...(perfil.imagenPerfil ? { imagenPerfil: perfil.imagenPerfil } : {}),
        roles: JSON.stringify(rolesFinales),
        ultimoAcceso: new Date()
      }
    });
    await responderSesionDocente(res, actualizado, 200);
    return;
  }

  const contrasenaStr = typeof contrasena === 'string' ? contrasena : '';
  const hashContrasena =
    contrasenaStr.trim() && !configuracion.requireGoogleOAuth ? await crearHash(contrasenaStr) : undefined;
  const nombreCompletoReq = String(nombreCompleto ?? '').trim();
  const nombreCompletoFinal = nombreCompletoReq || String(perfil.nombreCompleto ?? '').trim();
  const roles = fusionarRolesGoogleConSuperadmin([], correo);
  
  const nombresFormatted = typeof nombres === 'string' && String(nombres).trim() ? aTituloPropio(String(nombres)) : null;
  const apellidosFormatted = typeof apellidos === 'string' && String(apellidos).trim() ? aTituloPropio(String(apellidos)) : null;
  const nombreCompletoFormatted = aTituloPropio(nombreCompletoFinal);

  const docente = await prisma.docente.create({
    data: {
      nombres: nombresFormatted,
      apellidos: apellidosFormatted,
      nombreCompleto: nombreCompletoFormatted,
      correo,
      hashContrasena,
      googleSub: perfil.sub,
      imagenPerfil: perfil.imagenPerfil,
      roles: JSON.stringify(roles),
      activo: true,
      ultimoAcceso: new Date()
    }
  });

  await responderSesionDocente(res, docente, 201);
}

export async function ingresarDocente(req: Request, res: Response) {
  assertPasswordAuthDisponible();
  const { correo, contrasena } = req.body;
  const correoFinal = String(correo || '').toLowerCase();

  registrarTrazaAutenticacion(req, 'contrasena', 'busqueda_cuenta', 'iniciado');
  const docente = await prisma.docente.findUnique({ where: { correo: correoFinal } });
  if (!docente) {
    registrarTrazaAutenticacion(req, 'contrasena', 'busqueda_cuenta', 'error', { codigo: 'CREDENCIALES_INVALIDAS' });
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 'Credenciales invalidas', 401);
  }
  if (!docente.hashContrasena) {
    registrarTrazaAutenticacion(req, 'contrasena', 'busqueda_cuenta', 'error', { codigo: 'DOCENTE_SIN_CONTRASENA' });
    throw new ErrorAplicacion(
      'DOCENTE_SIN_CONTRASENA',
      'Esta cuenta no tiene contrasena. Ingresa con Google o define una contrasena.',
      401
    );
  }
  if (!docente.activo) {
    registrarTrazaAutenticacion(req, 'contrasena', 'busqueda_cuenta', 'error', { codigo: 'DOCENTE_INACTIVO' });
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }
  registrarTrazaAutenticacion(req, 'contrasena', 'busqueda_cuenta', 'exito');

  const inicioValidacion = Date.now();
  registrarTrazaAutenticacion(req, 'contrasena', 'validacion_contrasena', 'iniciado');
  const ok = await compararContrasena(contrasena, docente.hashContrasena);
  if (!ok) {
    registrarTrazaAutenticacion(req, 'contrasena', 'validacion_contrasena', 'error', {
      codigo: 'CREDENCIALES_INVALIDAS',
      duracionMs: Date.now() - inicioValidacion
    });
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 'Credenciales invalidas', 401);
  }
  registrarTrazaAutenticacion(req, 'contrasena', 'validacion_contrasena', 'exito', { duracionMs: Date.now() - inicioValidacion });

  const actualizado = await prisma.docente.update({
    where: { id: docente.id },
    data: { ultimoAcceso: new Date() }
  });

  registrarTrazaAutenticacion(req, 'contrasena', 'sesion_emitida', 'iniciado');
  await responderSesionDocente(res, actualizado, 200);
  registrarTrazaAutenticacion(req, 'contrasena', 'sesion_emitida', 'exito');
}

export async function ingresarDocenteGoogle(req: Request, res: Response) {
  const { credential } = req.body as { credential?: unknown };
  const inicioVerificacion = Date.now();
  registrarTrazaAutenticacion(req, 'google', 'validacion_credencial_google', 'iniciado');
  let perfil: PerfilGoogle;
  try {
    perfil = await verificarCredencialGoogle(String(credential ?? ''));
  } catch (error) {
    registrarTrazaAutenticacion(req, 'google', 'validacion_credencial_google', 'error', {
      codigo: codigoErrorAutenticacion(error, 'GOOGLE_VERIFICATION_FAILED'),
      duracionMs: Date.now() - inicioVerificacion
    });
    throw error;
  }
  registrarTrazaAutenticacion(req, 'google', 'validacion_credencial_google', 'exito', { duracionMs: Date.now() - inicioVerificacion });

  registrarTrazaAutenticacion(req, 'google', 'busqueda_cuenta', 'iniciado');
  const docente = await prisma.docente.findUnique({ where: { correo: perfil.correo } });
  if (!docente) {
    registrarTrazaAutenticacion(req, 'google', 'busqueda_cuenta', 'error', { codigo: 'DOCENTE_NO_REGISTRADO' });
    throw new ErrorAplicacion('DOCENTE_NO_REGISTRADO', 'No existe una cuenta de docente para ese correo', 401);
  }
  if (!docente.activo) {
    registrarTrazaAutenticacion(req, 'google', 'busqueda_cuenta', 'error', { codigo: 'DOCENTE_INACTIVO' });
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  if (docente.googleSub && docente.googleSub !== perfil.sub) {
    registrarTrazaAutenticacion(req, 'google', 'busqueda_cuenta', 'error', { codigo: 'GOOGLE_SUB_MISMATCH' });
    throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
  }
  registrarTrazaAutenticacion(req, 'google', 'busqueda_cuenta', 'exito');

  const rolesActuales = JSON.parse(docente.roles || '[]');
  const rolesFinales = fusionarRolesGoogleConSuperadmin(rolesActuales, perfil.correo);

  const actualizado = await prisma.docente.update({
    where: { id: docente.id },
    data: {
      googleSub: perfil.sub,
      ...(perfil.imagenPerfil ? { imagenPerfil: perfil.imagenPerfil } : {}),
      roles: JSON.stringify(rolesFinales),
      ultimoAcceso: new Date()
    }
  });

  registrarTrazaAutenticacion(req, 'google', 'sesion_emitida', 'iniciado');
  await responderSesionDocente(res, actualizado, 200);
  registrarTrazaAutenticacion(req, 'google', 'sesion_emitida', 'exito');
}

export async function recuperarContrasenaGoogle(req: Request, res: Response) {
  assertPasswordAuthDisponible();
  const { credential, contrasenaNueva } = req.body as { credential?: unknown; contrasenaNueva?: unknown };
  const perfil = await verificarCredencialGoogle(String(credential ?? ''));

  const docente = await prisma.docente.findUnique({ where: { correo: perfil.correo } });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  if (!docente.googleSub) {
    throw new ErrorAplicacion('GOOGLE_NO_VINCULADO', 'La cuenta no tiene Google vinculado', 401);
  }
  if (docente.googleSub !== perfil.sub) {
    throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
  }

  const hashContrasena = await crearHash(String(contrasenaNueva ?? ''));
  const actualizado = await prisma.docente.update({
    where: { id: docente.id },
    data: {
      hashContrasena,
      ultimoAcceso: new Date()
    }
  });

  await revocarSesionesDocente(docente.id);
  await emitirSesionDocente(res, docente.id);

  const rolesArray = JSON.parse(actualizado.roles || '[]');
  const token = crearTokenDocente({ docenteId: actualizado.id, roles: rolesParaToken(rolesArray) });
  res.json({ token });
}

export async function solicitarRecuperacionContrasena(req: Request, res: Response) {
  assertPasswordAuthDisponible();
  if (!configuracion.passwordResetEnabled) {
    throw new ErrorAplicacion(
      'RECUPERACION_NO_DISPONIBLE',
      'La recuperacion de contrasena esta deshabilitada por configuracion operativa.',
      503
    );
  }

  const correo = String((req.body as { correo?: unknown })?.correo || '').trim().toLowerCase();

  const respuesta = {
    ok: true,
    mensaje: 'Si el correo existe y esta activo, se envio un enlace/codigo de recuperacion.'
  };

  const docente = await prisma.docente.findUnique({
    where: { correo },
    select: { id: true, correo: true, activo: true, nombreCompleto: true }
  });
  if (!docente || !docente.activo) {
    res.status(202).json(respuesta);
    return;
  }

  const token = crearTokenRecuperacion();
  const tokenHash = hashTokenRecuperacion(token);
  const expiraEn = new Date(Date.now() + configuracion.passwordResetTokenMinutes * 60_000);
  const resetBase = configuracion.passwordResetUrlBase;
  const enlace = resetBase ? `${resetBase}${resetBase.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : '';
  const contenido = enlace
    ? `Recuperacion de acceso EvaluaPro.\n\nUsa este enlace antes de ${expiraEn.toISOString()}:\n${enlace}\n\nSi no solicitaste este cambio, ignora este mensaje.`
    : `Recuperacion de acceso EvaluaPro.\n\nTu token de recuperacion es:\n${token}\n\nExpira en ${configuracion.passwordResetTokenMinutes} minutos. Si no solicitaste este cambio, ignora este mensaje.`;

  await prisma.recuperacionContrasenaDocente.deleteMany({
    where: { docenteId: docente.id, usadoEn: null }
  });
  await prisma.recuperacionContrasenaDocente.create({
    data: {
      docenteId: docente.id,
      tokenHash,
      expiraEn,
      solicitadoIp: ipSolicitud(req)
    }
  });

  await enviarCorreo(String(docente.correo), 'Recuperacion de contrasena - EvaluaPro', contenido);

  if (String(configuracion.entorno).toLowerCase() !== 'production') {
    res.status(202).json({ ...respuesta, debugToken: token, debugExpiraEn: expiraEn.toISOString() });
    return;
  }

  res.status(202).json(respuesta);
}

export async function restablecerContrasena(req: Request, res: Response) {
  assertPasswordAuthDisponible();
  if (!configuracion.passwordResetEnabled) {
    throw new ErrorAplicacion(
      'RECUPERACION_NO_DISPONIBLE',
      'La recuperacion de contrasena esta deshabilitada por configuracion operativa.',
      503
    );
  }

  const token = String((req.body as { token?: unknown })?.token || '').trim();
  const contrasenaNueva = String((req.body as { contrasenaNueva?: unknown })?.contrasenaNueva || '');
  const tokenHash = hashTokenRecuperacion(token);

  const recuperacion = await prisma.recuperacionContrasenaDocente.findFirst({
    where: {
      tokenHash,
      usadoEn: null,
      expiraEn: { gt: new Date() }
    }
  });

  if (!recuperacion) {
    throw new ErrorAplicacion('TOKEN_RECUPERACION_INVALIDO', 'Token de recuperacion invalido o expirado', 400);
  }

  const docente = await prisma.docente.findUnique({ where: { id: recuperacion.docenteId } });
  if (!docente || !docente.activo) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  const hashContrasena = await crearHash(contrasenaNueva);
  await prisma.docente.update({
    where: { id: docente.id },
    data: {
      hashContrasena,
      ultimoAcceso: new Date()
    }
  });

  await prisma.recuperacionContrasenaDocente.update({
    where: { id: recuperacion.id },
    data: {
      usadoEn: new Date(),
      usadoIp: ipSolicitud(req)
    }
  });

  await prisma.recuperacionContrasenaDocente.deleteMany({
    where: { docenteId: docente.id, usadoEn: null }
  });
  await revocarSesionesDocente(docente.id);

  res.status(204).end();
}

export async function refrescarDocente(req: Request, res: Response) {
  const docenteId = await refrescarSesionDocente(req, res);
  const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
  if (!docente || !docente.activo) {
    await cerrarSesionDocente(req, res);
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }

  const actualizado = await prisma.docente.update({
    where: { id: docente.id },
    data: { ultimoAcceso: new Date() }
  });

  const rolesArray = JSON.parse(actualizado.roles || '[]');
  const token = crearTokenDocente({ docenteId: actualizado.id, roles: rolesParaToken(rolesArray) });
  res.json({ token });
}

export async function salirDocente(req: Request, res: Response) {
  await cerrarSesionDocente(req, res);
  res.status(204).end();
}

export async function definirContrasenaDocente(req: SolicitudDocente, res: Response) {
  assertPasswordAuthDisponible();
  const docenteId = obtenerDocenteId(req);
  const { contrasenaNueva, contrasenaActual, credential } = req.body as {
    contrasenaNueva?: unknown;
    contrasenaActual?: unknown;
    credential?: unknown;
  };

  const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  const contrasenaActualStr = typeof contrasenaActual === 'string' ? contrasenaActual : '';
  const credentialStr = typeof credential === 'string' ? credential : '';

  let reautenticado = false;

  if (docente.hashContrasena && contrasenaActualStr.trim()) {
    const ok = await compararContrasena(contrasenaActualStr, docente.hashContrasena);
    if (!ok) {
      throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 'Credenciales invalidas', 401);
    }
    reautenticado = true;
  }

  if (!reautenticado && docente.googleSub && credentialStr.trim()) {
    const perfil = await verificarCredencialGoogle(credentialStr);
    if (perfil.correo !== String(docente.correo).toLowerCase()) {
      throw new ErrorAplicacion('GOOGLE_CUENTA_NO_COINCIDE', 'Cuenta Google no coincide con el docente', 401);
    }
    if (perfil.sub !== docente.googleSub) {
      throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
    }
    reautenticado = true;
  }

  if (!reautenticado) {
    throw new ErrorAplicacion(
      'REAUTENTICACION_REQUERIDA',
      'Reautenticacion requerida para definir o cambiar contrasena',
      401
    );
  }

  const hashContrasena = await crearHash(String(contrasenaNueva ?? ''));
  await prisma.docente.update({
    where: { id: docente.id },
    data: { hashContrasena }
  });

  res.status(204).end();
}

export async function perfilDocente(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  const preferenciaRetencion = await prisma.preferenciaRetencionParcial.findUnique({ where: { docenteId } });
  const rolesArray = JSON.parse(docente.roles || '[]');
  const roles = rolesParaToken(rolesArray);
  
  let preferenciasPdf: any = {};
  if (docente.preferenciasPdf) {
    try {
      preferenciasPdf = JSON.parse(docente.preferenciasPdf);
    } catch {
      // ignore
    }
  }

  res.json({
    docente: {
      id: docente.id,
      nombreCompleto: docente.nombreCompleto,
      correo: docente.correo,
      imagenPerfil: docente.imagenPerfil || undefined,
      roles,
      permisos: permisosComoLista(roles),
      tieneContrasena: Boolean(docente.hashContrasena),
      tieneGoogle: Boolean(docente.googleSub),
      capacidadesIntegraciones: obtenerCapacidadesOauthClassroom(),
      preferenciasPdf: {
        institucion: String(preferenciasPdf.institucion ?? '').trim() || undefined,
        lema: String(preferenciasPdf.lema ?? '').trim() || undefined,
        paginasPorTipo: {
          parcial: resolverPaginasPreferidas(preferenciasPdf.paginasPorTipo?.parcial, 2),
          global: resolverPaginasPreferidas(preferenciasPdf.paginasPorTipo?.global, 4),
          extraordinario: resolverPaginasPreferidas(preferenciasPdf.paginasPorTipo?.extraordinario, 4)
        },
        logos: {
          izquierdaPath: String(preferenciasPdf.logos?.izquierdaPath ?? '').trim() || undefined,
          derechaPath: String(preferenciasPdf.logos?.derechaPath ?? '').trim() || undefined
        }
      },
      retencionParcialesArchivadosMeses: preferenciaRetencion?.meses ?? null
    }
  });
}

export async function actualizarPreferenciaRetencionParciales(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { meses } = req.body as { meses: 3 | 6 | 12 | null };
  const preferencia = await prisma.preferenciaRetencionParcial.upsert({
    where: { docenteId },
    create: { docenteId, meses },
    update: { meses }
  });
  res.json({ retencionParcialesArchivadosMeses: preferencia.meses ?? null });
}

export async function capacidadesIntegracionesPublicas(_req: Request, res: Response) {
  const totalDocentes = await prisma.docente.count().catch(() => 0);
  const baseCaps = obtenerCapacidadesOauthClassroom();
  res.json({
    capacidadesIntegraciones: {
      ...baseCaps,
      primerUso: totalDocentes === 0,
      requiereRegistroInicial: totalDocentes === 0
    }
  });
}

export async function actualizarPreferenciasPdfDocente(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as {
    institucion?: unknown;
    lema?: unknown;
    paginasPorTipo?: { parcial?: unknown; global?: unknown; extraordinario?: unknown };
    logos?: { izquierdaPath?: unknown; derechaPath?: unknown };
  };

  const docente = await prisma.docente.findUnique({ where: { id: docenteId } });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  let prefs: any = {};
  if (docente.preferenciasPdf) {
    try {
      prefs = JSON.parse(docente.preferenciasPdf);
    } catch {
      // ignore
    }
  }

  if (typeof body.institucion === 'string') prefs.institucion = body.institucion.trim();
  if (typeof body.lema === 'string') prefs.lema = body.lema.trim();
  if (body.paginasPorTipo && typeof body.paginasPorTipo === 'object') {
    prefs.paginasPorTipo = {
      parcial: resolverPaginasPreferidas(body.paginasPorTipo.parcial, resolverPaginasPreferidas(prefs.paginasPorTipo?.parcial, 2)),
      global: resolverPaginasPreferidas(body.paginasPorTipo.global, resolverPaginasPreferidas(prefs.paginasPorTipo?.global, 4)),
      extraordinario: resolverPaginasPreferidas(body.paginasPorTipo.extraordinario, resolverPaginasPreferidas(prefs.paginasPorTipo?.extraordinario, 4))
    };
  }
  if (body.logos && typeof body.logos === 'object') {
    if (!prefs.logos) prefs.logos = {};
    if (typeof body.logos.izquierdaPath === 'string') prefs.logos.izquierdaPath = body.logos.izquierdaPath.trim();
    if (typeof body.logos.derechaPath === 'string') prefs.logos.derechaPath = body.logos.derechaPath.trim();
  }

  await prisma.docente.update({
    where: { id: docenteId },
    data: { preferenciasPdf: JSON.stringify(prefs) }
  });

  res.json({
    preferenciasPdf: {
      institucion: String(prefs.institucion ?? '').trim() || undefined,
      lema: String(prefs.lema ?? '').trim() || undefined,
      paginasPorTipo: {
        parcial: resolverPaginasPreferidas(prefs.paginasPorTipo?.parcial, 2),
        global: resolverPaginasPreferidas(prefs.paginasPorTipo?.global, 4),
        extraordinario: resolverPaginasPreferidas(prefs.paginasPorTipo?.extraordinario, 4)
      },
      logos: {
        izquierdaPath: String(prefs.logos?.izquierdaPath ?? '').trim() || undefined,
        derechaPath: String(prefs.logos?.derechaPath ?? '').trim() || undefined
      }
    }
  });
}

export async function regenerarAccesosDirectosDocente(_req: SolicitudDocente, res: Response) {
  if (process.platform !== 'win32') {
    throw new ErrorAplicacion(
      'SHORTCUTS_UNSUPPORTED_PLATFORM',
      'La regeneracion de accesos directos solo esta disponible en Windows.',
      400
    );
  }
  const scriptPath = resolverScriptAccesosDirectos();
  const resultado = await ejecutarRegeneracionAccesos(scriptPath);
  if (!resultado.ok) {
    throw new ErrorAplicacion(
      'SHORTCUTS_REGEN_FAILED',
      `No se pudieron regenerar los accesos directos. ${String(resultado.stderr || resultado.stdout || 'Sin detalle').slice(0, 300)}`,
      500
    );
  }
  res.json({
    ok: true,
    message: 'Accesos directos regenerados en Escritorio y Menu Inicio.',
    scriptPath
  });
}
