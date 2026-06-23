/**
 * Controlador de Asistencias.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import type {
  ResumenAsistenciaAlumno,
  ResultadoDerechoExamen
} from './tiposAsistencias';

// ─── SESIONES ─────────────────────────────────────────────────────────────────

export async function crearSesion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, fecha, grupo, temaId, temaNombre, observaciones, modo } = req.body as {
    periodoId: string;
    fecha: string;
    grupo: string;
    temaId?: string;
    temaNombre?: string;
    observaciones?: string;
    modo?: 'manual' | 'qr_automatico';
  };

  const sesion = await prisma.asistenciaSesion.create({
    data: {
      docenteId,
      periodoId,
      fecha: new Date(fecha),
      grupo: grupo.trim(),
      temaId: temaId?.trim() || null,
      temaNombre: temaNombre?.trim() || null,
      observaciones: observaciones?.trim() || null,
      modo: modo ?? 'manual'
    }
  });

  res.status(201).json({ sesion });
}

export async function listarSesiones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, unknown> = { docenteId };
  if (req.query['periodoId']) filtro['periodoId'] = String(req.query['periodoId']);
  if (req.query['grupo']) filtro['grupo'] = String(req.query['grupo']).trim();
  
  const sesiones = await prisma.asistenciaSesion.findMany({
    where: filtro,
    orderBy: { fecha: 'desc' }
  });
  res.json({ sesiones });
}

export async function eliminarSesion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const sesionId = String(req.params['sesionId'] ?? '');
  
  const sesion = await prisma.asistenciaSesion.findFirst({
    where: { id: sesionId, docenteId }
  });
  if (!sesion) throw new ErrorAplicacion('NO_ENCONTRADO', 'Sesión no encontrada', 404);
  
  await prisma.$transaction([
    prisma.asistenciaRegistro.deleteMany({ where: { sesionId } }),
    prisma.asistenciaSesion.delete({ where: { id: sesionId } })
  ]);
  res.json({ ok: true });
}

// ─── REGISTROS (PASE DE LISTA) ────────────────────────────────────────────────

export async function guardarRegistros(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const sesionId = String(req.params['sesionId'] ?? '');
  const { registros } = req.body as {
    registros: Array<{ alumnoId: string; estado: 'P' | 'F' | 'R' | 'J'; justificacion?: string }>;
  };

  const sesion = await prisma.asistenciaSesion.findFirst({
    where: { id: sesionId, docenteId }
  });
  if (!sesion) throw new ErrorAplicacion('NO_ENCONTRADO', 'Sesión no encontrada', 404);

  await prisma.$transaction(
    registros.map((r) =>
      prisma.asistenciaRegistro.upsert({
        where: {
          sesionId_alumnoId: {
            sesionId,
            alumnoId: r.alumnoId
          }
        },
        update: {
          estado: r.estado,
          justificacion: r.justificacion?.trim() || null
        },
        create: {
          sesionId,
          alumnoId: r.alumnoId,
          docenteId,
          periodoId: sesion.periodoId,
          grupo: sesion.grupo,
          fecha: sesion.fecha,
          estado: r.estado,
          justificacion: r.justificacion?.trim() || null
        }
      })
    )
  );

  res.json({ ok: true, total: registros.length });
}

export async function obtenerRegistrosSesion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const sesionId = String(req.params['sesionId'] ?? '');
  
  const sesion = await prisma.asistenciaSesion.findFirst({
    where: { id: sesionId, docenteId }
  });
  if (!sesion) throw new ErrorAplicacion('NO_ENCONTRADO', 'Sesión no encontrada', 404);
  
  const registros = await prisma.asistenciaRegistro.findMany({
    where: { sesionId }
  });
  res.json({ registros });
}

// ─── RESUMEN POR ALUMNO ───────────────────────────────────────────────────────

export async function obtenerResumen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  if (!req.query['periodoId']) throw new ErrorAplicacion('PARAM_REQUERIDO', 'periodoId es requerido', 400);
  const periodoId = String(req.query['periodoId']);
  const grupo = req.query['grupo'] ? String(req.query['grupo']).trim() : undefined;

  const filtroBase: Record<string, unknown> = {
    docenteId,
    periodoId
  };
  if (grupo) filtroBase.grupo = grupo;

  const totalSesiones = await prisma.asistenciaSesion.count({
    where: filtroBase
  });

  const registros = await prisma.asistenciaRegistro.findMany({
    where: filtroBase
  });

  const mapAgrupados = new Map<string, { presentes: number; faltas: number; retardos: number; justificadas: number }>();
  for (const r of registros) {
    const key = r.alumnoId;
    if (!mapAgrupados.has(key)) {
      mapAgrupados.set(key, { presentes: 0, faltas: 0, retardos: 0, justificadas: 0 });
    }
    const val = mapAgrupados.get(key)!;
    if (r.estado === 'P') val.presentes++;
    else if (r.estado === 'F') val.faltas++;
    else if (r.estado === 'R') val.retardos++;
    else if (r.estado === 'J') val.justificadas++;
  }

  const regla = await prisma.asistenciaRegla.findFirst({
    where: {
      docenteId,
      periodoId,
      OR: grupo ? [{ grupo }, { grupo: null }] : [{ grupo: null }]
    }
  });

  const excepciones = await prisma.asistenciaExcepcion.findMany({
    where: {
      docenteId,
      periodoId
    }
  });
  const excepcionSet = new Set(excepciones.map((e) => e.alumnoId));

  const alumnos = await prisma.alumno.findMany({
    where: {
      periodoId,
      activo: true,
      grupo: grupo ? grupo : undefined
    },
    select: {
      id: true,
      matricula: true,
      nombreCompleto: true,
      grupo: true
    }
  });

  const resumen: ResumenAsistenciaAlumno[] = alumnos.map((alumno) => {
    const datos = mapAgrupados.get(alumno.id);
    const faltas = datos?.faltas ?? 0;
    const retardos = datos?.retardos ?? 0;
    // Calcular faltas efectivas sumando equivalencia de retardos si la regla lo habilita
    const faltasRetardos =
      regla?.contarRetardos && regla.retardosEquivalenFalta > 0
        ? Math.floor(retardos / regla.retardosEquivalenFalta)
        : 0;
    const faltasEfectivas = faltas + faltasRetardos;
    const tieneExcepcion = excepcionSet.has(alumno.id);
    const superaLimite = regla ? faltasEfectivas > regla.maxFaltas : false;
    const bloqueado = superaLimite && regla?.accion === 'bloquear_examen' && !tieneExcepcion;

    return {
      alumnoId: alumno.id,
      matricula: alumno.matricula,
      nombreCompleto: alumno.nombreCompleto,
      grupo: alumno.grupo ?? grupo ?? '',
      presentes: datos?.presentes ?? 0,
      faltas,
      retardos,
      faltasEfectivas,
      justificadas: datos?.justificadas ?? 0,
      totalSesiones,
      porcentajeAsistencia:
        totalSesiones > 0
          ? Math.round(((datos?.presentes ?? 0) / totalSesiones) * 100)
          : 0,
      superaLimiteFaltas: superaLimite,
      tieneExcepcion,
      bloqueadoExamen: bloqueado
    };
  });

  res.json({ resumen, regla, totalSesiones });
}

// ─── DERECHO A EXAMEN ─────────────────────────────────────────────────────────

export async function verificarDerechoExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params['alumnoId'] ?? '');
  if (!req.query['periodoId']) throw new ErrorAplicacion('PARAM_REQUERIDO', 'periodoId es requerido', 400);
  const periodoId = String(req.query['periodoId']);
  const grupoQuery = req.query['grupo'] ? String(req.query['grupo']).trim() : undefined;

  let grupo = grupoQuery;
  if (!grupo) {
    const alumno = await prisma.alumno.findFirst({
      where: { id: alumnoId, periodo: { docenteId } }
    });
    if (alumno) {
      grupo = alumno.grupo || undefined;
    }
  }

  const regla = await prisma.asistenciaRegla.findFirst({
    where: {
      docenteId,
      periodoId,
      OR: [{ grupo: grupo ?? null }, { grupo: null }]
    }
  });

  if (!regla) {
    return res.json({ tieneDerecho: true, motivo: 'sin_regla_configurada' } satisfies ResultadoDerechoExamen);
  }

  const faltas = await prisma.asistenciaRegistro.count({
    where: {
      docenteId,
      alumnoId,
      periodoId,
      estado: 'F'
    }
  });

  const retardos = regla.contarRetardos
    ? await prisma.asistenciaRegistro.count({
        where: { docenteId, alumnoId, periodoId, estado: 'R' }
      })
    : 0;

  const faltasRetardos =
    regla.contarRetardos && regla.retardosEquivalenFalta > 0
      ? Math.floor(retardos / regla.retardosEquivalenFalta)
      : 0;
  const faltasEfectivas = faltas + faltasRetardos;

  const excepcion = await prisma.asistenciaExcepcion.findFirst({
    where: {
      docenteId,
      alumnoId,
      periodoId
    }
  });

  const superaLimite = faltasEfectivas > regla.maxFaltas;
  const tieneDerecho = !superaLimite || regla.accion === 'advertir' || Boolean(excepcion);

  return res.json({
    tieneDerecho,
    faltas,
    retardos,
    faltasEfectivas,
    maxFaltas: regla.maxFaltas,
    contarRetardos: regla.contarRetardos,
    retardosEquivalenFalta: regla.retardosEquivalenFalta,
    superaLimite,
    tieneExcepcion: Boolean(excepcion),
    accion: regla.accion as 'bloquear_examen' | 'advertir',
    motivo: superaLimite
      ? excepcion
        ? 'excepcion_autorizada'
        : regla.accion === 'advertir'
          ? 'supera_limite_advertencia'
          : 'bloqueado_por_faltas'
      : 'dentro_del_limite'
  } satisfies ResultadoDerechoExamen);
}

// ─── REGLAS ───────────────────────────────────────────────────────────────────

export async function listarReglas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, unknown> = { docenteId };
  if (req.query['periodoId']) filtro['periodoId'] = String(req.query['periodoId']);
  
  const reglas = await prisma.asistenciaRegla.findMany({
    where: filtro,
    orderBy: { createdAt: 'desc' }
  });
  res.json({ reglas });
}

export async function crearOActualizarRegla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, grupo, maxFaltas, accion, excepcionPermitida, contarRetardos, retardosEquivalenFalta } = req.body as {
    periodoId: string;
    grupo?: string | null;
    maxFaltas: number;
    accion?: 'bloquear_examen' | 'advertir';
    excepcionPermitida?: boolean;
    contarRetardos?: boolean;
    retardosEquivalenFalta?: number;
  };

  const grupoClave = grupo?.trim() || null;

  const reglaExistente = await prisma.asistenciaRegla.findFirst({
    where: {
      docenteId,
      periodoId,
      grupo: grupoClave
    }
  });

  let regla;
  if (reglaExistente) {
    regla = await prisma.asistenciaRegla.update({
      where: { id: reglaExistente.id },
      data: {
        maxFaltas,
        accion: accion ?? 'bloquear_examen',
        excepcionPermitida: excepcionPermitida ?? true,
        contarRetardos: contarRetardos ?? reglaExistente.contarRetardos,
        retardosEquivalenFalta: retardosEquivalenFalta ?? reglaExistente.retardosEquivalenFalta
      }
    });
  } else {
    regla = await prisma.asistenciaRegla.create({
      data: {
        docenteId,
        periodoId,
        grupo: grupoClave,
        maxFaltas,
        accion: accion ?? 'bloquear_examen',
        excepcionPermitida: excepcionPermitida ?? true,
        contarRetardos: contarRetardos ?? false,
        retardosEquivalenFalta: retardosEquivalenFalta ?? 3
      }
    });
  }

  res.json({ regla });
}

export async function eliminarRegla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const reglaId = String(req.params['reglaId'] ?? '');
  
  const regla = await prisma.asistenciaRegla.findFirst({
    where: { id: reglaId, docenteId }
  });
  if (!regla) throw new ErrorAplicacion('NO_ENCONTRADO', 'Regla no encontrada', 404);
  
  await prisma.asistenciaRegla.delete({
    where: { id: reglaId }
  });
  res.json({ ok: true });
}

// ─── EXCEPCIONES ─────────────────────────────────────────────────────────────

export async function crearExcepcion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { alumnoId, periodoId, motivo } = req.body as {
    alumnoId: string;
    periodoId: string;
    motivo?: string;
  };

  const existente = await prisma.asistenciaExcepcion.findUnique({
    where: { alumnoId }
  });

  let excepcion;
  if (existente) {
    excepcion = await prisma.asistenciaExcepcion.update({
      where: { alumnoId },
      data: {
        motivo: motivo?.trim() || null
      }
    });
  } else {
    excepcion = await prisma.asistenciaExcepcion.create({
      data: {
        docenteId,
        alumnoId,
        periodoId,
        motivo: motivo?.trim() || null
      }
    });
  }

  res.json({ excepcion });
}

export async function eliminarExcepcion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const excepcionId = String(req.params['excepcionId'] ?? '');
  
  const exc = await prisma.asistenciaExcepcion.findFirst({
    where: { id: excepcionId, docenteId }
  });
  if (!exc) throw new ErrorAplicacion('NO_ENCONTRADO', 'Excepción no encontrada', 404);
  
  await prisma.asistenciaExcepcion.delete({
    where: { id: excepcionId }
  });
  res.json({ ok: true });
}

export async function listarExcepciones(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, unknown> = { docenteId };
  if (req.query['periodoId']) filtro['periodoId'] = String(req.query['periodoId']);
  
  const excepciones = await prisma.asistenciaExcepcion.findMany({
    where: filtro
  });
  res.json({ excepciones });
}
