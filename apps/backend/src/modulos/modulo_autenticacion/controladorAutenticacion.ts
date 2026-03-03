/**
 * Controlador de autenticacion docente.
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { esCorreoDeDominioPermitido } from '../../compartido/utilidades/correo';
import { configuracion } from '../../configuracion';
import { Docente } from './modeloDocente';
import { RecuperacionContrasenaDocente } from './modeloRecuperacionContrasena';
import { crearHash, compararContrasena } from './servicioHash';
import { crearTokenDocente } from './servicioTokens';
import { obtenerDocenteId, type SolicitudDocente } from './middlewareAutenticacion';
import { cerrarSesionDocente, emitirSesionDocente, refrescarSesionDocente, revocarSesionesDocente } from './servicioSesiones';
import { verificarCredencialGoogle } from './servicioGoogle';
import { permisosComoLista, normalizarRoles } from '../../infraestructura/seguridad/rbac';
import { enviarCorreo } from '../../infraestructura/correo/servicioCorreo';

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

function obtenerCapacidadesOauthClassroom() {
  const oauthGoogleBackend = Boolean(String(configuracion.googleOauthClientId || '').trim());
  const classroomBackend = Boolean(
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

  return {
    oauthGoogleBackend,
    classroomBackend,
    smtpBackend
  };
}

export async function registrarDocente(req: Request, res: Response) {
  const { nombres, apellidos, nombreCompleto, correo, contrasena } = req.body;
  const correoFinal = String(correo || '').toLowerCase();

  if (
    Array.isArray(configuracion.dominiosCorreoPermitidos) &&
    configuracion.dominiosCorreoPermitidos.length > 0 &&
    !esCorreoDeDominioPermitido(correoFinal, configuracion.dominiosCorreoPermitidos)
  ) {
    throw new ErrorAplicacion(
      'DOMINIO_CORREO_NO_PERMITIDO',
      'Correo no permitido por politicas. Usa tu correo institucional.',
      403
    );
  }

  const existente = await Docente.findOne({ correo: correoFinal }).lean();
  if (existente) {
    throw new ErrorAplicacion('DOCENTE_EXISTE', 'El correo ya esta registrado', 409);
  }

  const hashContrasena = await crearHash(contrasena);
  const docente = await Docente.create({
    ...(typeof nombres === 'string' && nombres.trim() ? { nombres: nombres.trim() } : {}),
    ...(typeof apellidos === 'string' && apellidos.trim() ? { apellidos: apellidos.trim() } : {}),
    nombreCompleto: String(nombreCompleto ?? '').trim(),
    correo: correoFinal,
    hashContrasena,
    roles: ['docente'],
    activo: true,
    ultimoAcceso: new Date()
  });

  await emitirSesionDocente(res, String(docente._id));
  const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.status(201).json({
    token,
    docente: {
      id: docente._id,
      nombreCompleto: docente.nombreCompleto,
      ...(docente.nombres ? { nombres: docente.nombres } : {}),
      ...(docente.apellidos ? { apellidos: docente.apellidos } : {}),
      correo: docente.correo
    }
  });
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

  const existente = await Docente.findOne({ correo }).lean();
  if (existente) {
    throw new ErrorAplicacion('DOCENTE_EXISTE', 'El correo ya esta registrado', 409);
  }

  const contrasenaStr = typeof contrasena === 'string' ? contrasena : '';
  const hashContrasena = contrasenaStr.trim() ? await crearHash(contrasenaStr) : undefined;
  const nombreCompletoReq = String(nombreCompleto ?? '').trim();
  const nombreCompletoFinal = nombreCompletoReq || String(perfil.nombreCompleto ?? '').trim();
  const roles = fusionarRolesGoogleConSuperadmin([], correo);
  const docente = await Docente.create({
      ...(typeof nombres === 'string' && String(nombres).trim() ? { nombres: String(nombres).trim() } : {}),
      ...(typeof apellidos === 'string' && String(apellidos).trim() ? { apellidos: String(apellidos).trim() } : {}),
      ...(nombreCompletoFinal ? { nombreCompleto: nombreCompletoFinal } : { nombreCompleto: String(perfil.nombreCompleto ?? '').trim() }),
      correo,
      ...(hashContrasena ? { hashContrasena } : {}),
      googleSub: perfil.sub,
      roles,
      activo: true,
      ultimoAcceso: new Date()
    });

    await emitirSesionDocente(res, String(docente._id));
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.status(201).json({
    token,
    docente: {
      id: docente._id,
      nombreCompleto: docente.nombreCompleto,
      ...(docente.nombres ? { nombres: docente.nombres } : {}),
      ...(docente.apellidos ? { apellidos: docente.apellidos } : {}),
      correo: docente.correo
    }
  });
}

export async function ingresarDocente(req: Request, res: Response) {
  const { correo, contrasena } = req.body;
  const correoFinal = String(correo || '').toLowerCase();

  if (
    Array.isArray(configuracion.dominiosCorreoPermitidos) &&
    configuracion.dominiosCorreoPermitidos.length > 0 &&
    !esCorreoDeDominioPermitido(correoFinal, configuracion.dominiosCorreoPermitidos)
  ) {
    throw new ErrorAplicacion(
      'DOMINIO_CORREO_NO_PERMITIDO',
      'Correo no permitido por politicas. Usa tu correo institucional.',
      403
    );
  }

  const docente = await Docente.findOne({ correo: correoFinal });
  if (!docente) {
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 'Credenciales invalidas', 401);
  }
  if (!docente.hashContrasena) {
    throw new ErrorAplicacion(
      'DOCENTE_SIN_CONTRASENA',
      'Esta cuenta no tiene contrasena. Ingresa con Google o define una contrasena.',
      401
    );
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  const ok = await compararContrasena(contrasena, docente.hashContrasena);
  if (!ok) {
    throw new ErrorAplicacion('CREDENCIALES_INVALIDAS', 'Credenciales invalidas', 401);
  }

  docente.ultimoAcceso = new Date();
  await docente.save();

  await emitirSesionDocente(res, String(docente._id));
  const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.json({
    token,
    docente: {
      id: docente._id,
      nombreCompleto: docente.nombreCompleto,
      ...(docente.nombres ? { nombres: docente.nombres } : {}),
      ...(docente.apellidos ? { apellidos: docente.apellidos } : {}),
      correo: docente.correo
    }
  });
}

export async function ingresarDocenteGoogle(req: Request, res: Response) {
  const { credential } = req.body as { credential?: unknown };
  const perfil = await verificarCredencialGoogle(String(credential ?? ''));

  const docente = await Docente.findOne({ correo: perfil.correo });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_REGISTRADO', 'No existe una cuenta de docente para ese correo', 401);
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  // Si ya esta vinculado, exige el mismo subject. Si no, vincula al primer login.
  if (docente.googleSub && docente.googleSub !== perfil.sub) {
    throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
  }
  if (!docente.googleSub) {
    docente.googleSub = perfil.sub;
  }
  const rolesFinales = fusionarRolesGoogleConSuperadmin(docente.roles, perfil.correo);
  if (String((docente.roles ?? []).join(',')) !== String(rolesFinales.join(','))) {
    docente.roles = rolesFinales;
  }

  docente.ultimoAcceso = new Date();
  await docente.save();

  await emitirSesionDocente(res, String(docente._id));
  const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.json({
    token,
    docente: {
      id: docente._id,
      nombreCompleto: docente.nombreCompleto,
      ...(docente.nombres ? { nombres: docente.nombres } : {}),
      ...(docente.apellidos ? { apellidos: docente.apellidos } : {}),
      correo: docente.correo
    }
  });
}

export async function recuperarContrasenaGoogle(req: Request, res: Response) {
  const { credential, contrasenaNueva } = req.body as { credential?: unknown; contrasenaNueva?: unknown };
  const perfil = await verificarCredencialGoogle(String(credential ?? ''));

  const docente = await Docente.findOne({ correo: perfil.correo });
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  // Requiere cuenta Google vinculada y que coincida con el subject.
  if (!docente.googleSub) {
    throw new ErrorAplicacion('GOOGLE_NO_VINCULADO', 'La cuenta no tiene Google vinculado', 401);
  }
  if (docente.googleSub !== perfil.sub) {
    throw new ErrorAplicacion('GOOGLE_SUB_MISMATCH', 'Cuenta Google no coincide con el docente', 401);
  }

  docente.hashContrasena = await crearHash(String(contrasenaNueva ?? ''));
  docente.ultimoAcceso = new Date();
  await docente.save();

  // Revoca todas las sesiones previas y emite una nueva.
  await revocarSesionesDocente(String(docente._id));
  await emitirSesionDocente(res, String(docente._id));

  const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.json({ token });
}

export async function solicitarRecuperacionContrasena(req: Request, res: Response) {
  if (!configuracion.passwordResetEnabled) {
    throw new ErrorAplicacion(
      'RECUPERACION_NO_DISPONIBLE',
      'La recuperacion de contrasena esta deshabilitada por configuracion operativa.',
      503
    );
  }

  const correo = String((req.body as { correo?: unknown })?.correo || '').trim().toLowerCase();

  // Respuesta no-enumerable: nunca revela si existe o no el correo.
  const respuesta = {
    ok: true,
    mensaje: 'Si el correo existe y esta activo, se envio un enlace/codigo de recuperacion.'
  };

  const docente = await Docente.findOne({ correo }).select({ _id: 1, correo: 1, activo: 1, nombreCompleto: 1 }).lean();
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

  await RecuperacionContrasenaDocente.deleteMany({ docenteId: docente._id, usadoEn: { $exists: false } });
  await RecuperacionContrasenaDocente.create({
    docenteId: docente._id,
    tokenHash,
    expiraEn,
    solicitadoIp: ipSolicitud(req)
  });

  await enviarCorreo(String(docente.correo), 'Recuperacion de contrasena - EvaluaPro', contenido);

  if (String(configuracion.entorno).toLowerCase() !== 'production') {
    res.status(202).json({ ...respuesta, debugToken: token, debugExpiraEn: expiraEn.toISOString() });
    return;
  }

  res.status(202).json(respuesta);
}

export async function restablecerContrasena(req: Request, res: Response) {
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

  const recuperacion = await RecuperacionContrasenaDocente.findOne({
    tokenHash,
    usadoEn: { $exists: false },
    expiraEn: { $gt: new Date() }
  });

  if (!recuperacion) {
    throw new ErrorAplicacion('TOKEN_RECUPERACION_INVALIDO', 'Token de recuperacion invalido o expirado', 400);
  }

  const docente = await Docente.findById(recuperacion.docenteId);
  if (!docente || !docente.activo) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  docente.hashContrasena = await crearHash(contrasenaNueva);
  docente.ultimoAcceso = new Date();
  await docente.save();

  recuperacion.usadoEn = new Date();
  recuperacion.usadoIp = ipSolicitud(req);
  await recuperacion.save();
  await RecuperacionContrasenaDocente.deleteMany({ docenteId: docente._id, usadoEn: { $exists: false } });
  await revocarSesionesDocente(String(docente._id));

  res.status(204).end();
}

export async function refrescarDocente(req: Request, res: Response) {
  const docenteId = await refrescarSesionDocente(req, res);
  const docente = await Docente.findById(docenteId);
  if (!docente || !docente.activo) {
    await cerrarSesionDocente(req, res);
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sesion requerida', 401);
  }

  docente.ultimoAcceso = new Date();
  await docente.save();

  const token = crearTokenDocente({ docenteId: String(docente._id), roles: rolesParaToken(docente.roles) });
  res.json({ token });
}

export async function salirDocente(req: Request, res: Response) {
  await cerrarSesionDocente(req, res);
  res.status(204).end();
}

export async function definirContrasenaDocente(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { contrasenaNueva, contrasenaActual, credential } = req.body as {
    contrasenaNueva?: unknown;
    contrasenaActual?: unknown;
    credential?: unknown;
  };

  const docente = await Docente.findById(docenteId);
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  if (!docente.activo) {
    throw new ErrorAplicacion('DOCENTE_INACTIVO', 'Docente inactivo', 403);
  }

  const contrasenaActualStr = typeof contrasenaActual === 'string' ? contrasenaActual : '';
  const credentialStr = typeof credential === 'string' ? credential : '';

  // Reautenticacion requerida para una accion sensible.
  // - Si existe password, se puede validar con contrasenaActual.
  // - Si existe Google vinculado, se puede validar con credential (ID token).
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

  docente.hashContrasena = await crearHash(String(contrasenaNueva ?? ''));
  await docente.save();

  res.status(204).end();
}

export async function perfilDocente(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const docente = await Docente.findById(docenteId).lean();
  if (!docente) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  const roles = rolesParaToken((docente as unknown as { roles?: unknown }).roles);
  res.json({
    docente: {
      id: docente._id,
      nombreCompleto: docente.nombreCompleto,
      correo: docente.correo,
      roles,
      permisos: permisosComoLista(roles),
      tieneContrasena: Boolean(docente.hashContrasena),
      tieneGoogle: Boolean(docente.googleSub),
      capacidadesIntegraciones: obtenerCapacidadesOauthClassroom(),
      preferenciasPdf: {
        institucion: String((docente as unknown as { preferenciasPdf?: { institucion?: unknown } })?.preferenciasPdf?.institucion ?? '').trim() || undefined,
        lema: String((docente as unknown as { preferenciasPdf?: { lema?: unknown } })?.preferenciasPdf?.lema ?? '').trim() || undefined,
        logos: {
          izquierdaPath:
            String((docente as unknown as { preferenciasPdf?: { logos?: { izquierdaPath?: unknown } } })?.preferenciasPdf?.logos?.izquierdaPath ?? '').trim() ||
            undefined,
          derechaPath:
            String((docente as unknown as { preferenciasPdf?: { logos?: { derechaPath?: unknown } } })?.preferenciasPdf?.logos?.derechaPath ?? '').trim() ||
            undefined
        }
      }
    }
  });
}

export async function capacidadesIntegracionesPublicas(_req: Request, res: Response) {
  res.json({ capacidadesIntegraciones: obtenerCapacidadesOauthClassroom() });
}

export async function actualizarPreferenciasPdfDocente(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { institucion?: unknown; lema?: unknown; logos?: { izquierdaPath?: unknown; derechaPath?: unknown } };

  const set: Record<string, unknown> = {};
  if (typeof body.institucion === 'string') set['preferenciasPdf.institucion'] = body.institucion.trim();
  if (typeof body.lema === 'string') set['preferenciasPdf.lema'] = body.lema.trim();
  if (body.logos && typeof body.logos === 'object') {
    if (typeof body.logos.izquierdaPath === 'string') set['preferenciasPdf.logos.izquierdaPath'] = body.logos.izquierdaPath.trim();
    if (typeof body.logos.derechaPath === 'string') set['preferenciasPdf.logos.derechaPath'] = body.logos.derechaPath.trim();
  }

  const actualizado = await Docente.findOneAndUpdate(
    { _id: docenteId },
    { $set: set },
    { new: true }
  ).lean();

  if (!actualizado) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }

  res.json({
    preferenciasPdf: {
      institucion: String((actualizado as unknown as { preferenciasPdf?: { institucion?: unknown } })?.preferenciasPdf?.institucion ?? '').trim() || undefined,
      lema: String((actualizado as unknown as { preferenciasPdf?: { lema?: unknown } })?.preferenciasPdf?.lema ?? '').trim() || undefined,
      logos: {
        izquierdaPath:
          String((actualizado as unknown as { preferenciasPdf?: { logos?: { izquierdaPath?: unknown } } })?.preferenciasPdf?.logos?.izquierdaPath ?? '').trim() ||
          undefined,
        derechaPath:
          String((actualizado as unknown as { preferenciasPdf?: { logos?: { derechaPath?: unknown } } })?.preferenciasPdf?.logos?.derechaPath ?? '').trim() ||
          undefined
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
