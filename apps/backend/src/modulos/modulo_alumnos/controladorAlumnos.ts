/**
 * Controlador de alumnos.
 */
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion.js';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { normalizarMatricula } from '../../compartido/utilidades/texto.js';
import { guardarEnPapelera } from '../modulo_papelera/servicioPapelera.js';

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

export async function obtenerAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();
  const alumno = await prisma.alumno.findFirst({ where: { id: alumnoId, periodo: { docenteId } } });
  if (!alumno) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  res.json({ alumno });
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

function normalizarGrupo(valor: unknown): string {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/** Reinscribe, sin alterar el origen, a un grupo perteneciente a una materia archivada. */
export async function reinscribirGrupoArchivado(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoOrigenId, periodoDestinoId, grupo } = req.body as {
    periodoOrigenId: string;
    periodoDestinoId: string;
    grupo: string;
  };

  const resultado = await prisma.$transaction(async (tx) => {
    const [origen, destino] = await Promise.all([
      tx.periodo.findFirst({ where: { id: periodoOrigenId, docenteId } }),
      tx.periodo.findFirst({ where: { id: periodoDestinoId, docenteId } })
    ]);
    if (!origen) throw new ErrorAplicacion('MATERIA_ORIGEN_NO_ENCONTRADA', 'Materia archivada no encontrada', 404);
    if (origen.activo !== false) throw new ErrorAplicacion('MATERIA_ORIGEN_NO_ARCHIVADA', 'La materia de origen debe estar archivada', 409);
    if (!destino) throw new ErrorAplicacion('MATERIA_DESTINO_NO_ENCONTRADA', 'Materia destino no encontrada', 404);
    if (destino.activo === false) throw new ErrorAplicacion('MATERIA_DESTINO_ARCHIVADA', 'La materia destino debe estar activa', 409);
    if (origen.id === destino.id) throw new ErrorAplicacion('MATERIAS_IGUALES', 'El origen y el destino deben ser distintos', 400);

    const alumnosOrigen = await tx.alumno.findMany({
      where: { periodoId: origen.id, activo: false },
      select: { matricula: true, nombres: true, apellidos: true, nombreCompleto: true, correo: true, grupo: true }
    });
    const grupoKey = normalizarGrupo(grupo);
    const seleccionados = alumnosOrigen.filter((alumno) => normalizarGrupo(alumno.grupo) === grupoKey);
    if (seleccionados.length === 0) {
      throw new ErrorAplicacion('GRUPO_ARCHIVADO_VACIO', 'El grupo archivado ya no tiene alumnos disponibles', 409);
    }

    const registrosDestino = await tx.alumno.findMany({
      where: { periodoId: destino.id },
      select: { matricula: true }
    });
    const matriculasDestino = new Set(registrosDestino.map((alumno) => normalizarMatricula(alumno.matricula)));
    const matriculasOrigen = new Set<string>();
    let yaInscritos = 0;
    let reinscritos = 0;
    const grupoDestino = String(seleccionados[0]?.grupo ?? grupo).trim().replace(/\s+/g, ' ');

    const gruposDestino = (() => {
      try {
        const valor = JSON.parse(destino.grupos || '[]');
        return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
      } catch {
        return [];
      }
    })();
    const grupoYaConfigurado = gruposDestino.some((actual) => normalizarGrupo(actual) === grupoKey);
    if (!grupoYaConfigurado) {
      gruposDestino.push(grupoDestino);
      await tx.periodo.update({ where: { id: destino.id }, data: { grupos: JSON.stringify(gruposDestino) } });
    }

    for (const alumno of seleccionados) {
      const matriculaKey = normalizarMatricula(alumno.matricula);
      if (matriculasOrigen.has(matriculaKey) || matriculasDestino.has(matriculaKey)) {
        yaInscritos += 1;
        continue;
      }
      matriculasOrigen.add(matriculaKey);

      const idNuevo = randomUUID();
      const inscrito = await tx.alumno.upsert({
        where: {
          periodoId_matricula: {
            periodoId: destino.id,
            matricula: alumno.matricula
          }
        },
        update: {},
        create: {
          id: idNuevo,
          periodoId: destino.id,
          matricula: alumno.matricula,
          nombres: alumno.nombres,
          apellidos: alumno.apellidos,
          nombreCompleto: alumno.nombreCompleto,
          correo: alumno.correo,
          grupo: grupoDestino,
          activo: true
        }
      });
      if (inscrito.id === idNuevo) {
        reinscritos += 1;
        matriculasDestino.add(matriculaKey);
      } else {
        yaInscritos += 1;
      }
    }

    return { grupo: grupoDestino, totalSeleccionados: seleccionados.length, reinscritos, yaInscritos };
  });

  res.json({ ok: true, ...resultado });
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
