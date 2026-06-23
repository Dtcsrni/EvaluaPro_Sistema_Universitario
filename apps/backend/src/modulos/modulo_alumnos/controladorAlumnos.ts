/**
 * Controlador de alumnos.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { guardarEnPapelera } from '../modulo_papelera/servicioPapelera';

function validarAdminDev() {
  if (String(configuracion.entorno).toLowerCase() !== 'development') {
    throw new ErrorAplicacion('SOLO_DEV', 'Accion disponible solo en modo desarrollo', 403);
  }
}

/**
 * Lista alumnos del docente (opcionalmente por periodo).
 */
export async function listarAlumnos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const limite = Number(req.query.limite ?? 0);
  const periodoId = req.query.periodoId ? String(req.query.periodoId) : undefined;

  const alumnos = await prisma.alumno.findMany({
    where: {
      periodoId,
      periodo: {
        docenteId
      }
    },
    take: limite > 0 ? limite : undefined
  });

  res.json({ alumnos });
}

/**
 * Crea un alumno asociado al docente autenticado.
 */
export async function crearAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, matricula, nombres, apellidos, nombreCompleto, correo, grupo, activo } = req.body;

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  const alumno = await prisma.alumno.create({
    data: {
      periodoId,
      matricula,
      nombres: nombres || null,
      apellidos: apellidos || null,
      nombreCompleto,
      correo,
      grupo: grupo || null,
      activo: typeof activo === 'boolean' ? activo : true
    }
  });

  res.status(201).json({ alumno });
}

/**
 * Actualiza un alumno del docente.
 */
export async function actualizarAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();

  const alumno = await prisma.alumno.findFirst({
    where: {
      id: alumnoId,
      periodo: {
        docenteId
      }
    }
  });
  if (!alumno) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  }

  const { periodoId, matricula, nombres, apellidos, nombreCompleto, correo, grupo, activo } = req.body as Record<string, any>;

  const actualizado = await prisma.alumno.update({
    where: { id: alumnoId },
    data: {
      periodoId: periodoId || undefined,
      matricula: matricula || undefined,
      nombres: nombres !== undefined ? nombres : undefined,
      apellidos: apellidos !== undefined ? apellidos : undefined,
      nombreCompleto: nombreCompleto || undefined,
      correo: correo || undefined,
      grupo: grupo !== undefined ? grupo : undefined,
      activo: typeof activo === 'boolean' ? activo : undefined
    }
  });

  res.json({ alumno: actualizado });
}

/**
 * Elimina un alumno y sus examenes asociados (solo admin en desarrollo).
 */
export async function eliminarAlumnoDev(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  validarAdminDev();
  const alumnoId = String(req.params.alumnoId ?? '').trim();

  const alumno = await prisma.alumno.findFirst({
    where: {
      id: alumnoId,
      periodo: {
        docenteId
      }
    }
  });
  if (!alumno) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  }

  const examenes = await prisma.examenGenerado.findMany({
    where: {
      docenteId,
      alumnoId
    }
  });
  const examenesIds = examenes.map((examen) => examen.id);

  const [entregasDocs, banderasDocs] = examenesIds.length
    ? await Promise.all([
        prisma.entrega.findMany({ where: { docenteId, examenGeneradoId: { in: examenesIds } } }),
        prisma.banderaRevision.findMany({ where: { docenteId, examenGeneradoId: { in: examenesIds } } })
      ])
    : [[], []];
  const calificacionesDocs = await prisma.calificacion.findMany({ where: { docenteId, alumnoId } });

  await guardarEnPapelera({
    docenteId,
    tipo: 'alumno',
    entidadId: alumnoId,
    payload: {
      alumno,
      examenes,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs
    }
  });

  if (examenesIds.length > 0) {
    await Promise.all([
      prisma.entrega.deleteMany({ where: { docenteId, examenGeneradoId: { in: examenesIds } } }),
      prisma.banderaRevision.deleteMany({ where: { docenteId, examenGeneradoId: { in: examenesIds } } })
    ]);
  }

  const [examenesResp, calificacionesResp, alumnoResp] = await Promise.all([
    examenesIds.length ? prisma.examenGenerado.deleteMany({ where: { docenteId, id: { in: examenesIds } } }) : Promise.resolve({ count: 0 }),
    prisma.calificacion.deleteMany({ where: { docenteId, alumnoId } }),
    prisma.alumno.deleteMany({ where: { id: alumnoId } })
  ]);

  res.json({
    ok: true,
    eliminados: {
      alumnos: alumnoResp.count,
      examenes: examenesResp.count,
      entregas: entregasDocs.length,
      calificaciones: calificacionesResp.count,
      banderas: banderasDocs.length
    }
  });
}
