/**
 * Controlador de alumnos.
 *
 * Contrato:
 * - Todas las operaciones se asocian al docente autenticado via `docenteId`.
 * - La lectura se filtra por `docenteId` (y opcionalmente `periodoId`).
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { BanderaRevision } from '../modulo_analiticas/modeloBanderaRevision';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { Entrega } from '../modulo_vinculacion_entrega/modeloEntrega';
import { Alumno } from './modeloAlumno';
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
  const filtro: Record<string, string> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId);

  const limite = Number(req.query.limite ?? 0);
  const consulta = Alumno.find(filtro);
  const alumnos = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ alumnos });
}

/**
 * Crea un alumno asociado al docente autenticado.
 */
export async function crearAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumno = await Alumno.create({ ...req.body, docenteId });
  res.status(201).json({ alumno });
}

/**
 * Actualiza un alumno del docente.
 * Nota: la UI envía el objeto completo (semántica tipo PUT) via POST.
 */
export async function actualizarAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();

  const alumno = await Alumno.findOne({ _id: alumnoId, docenteId });
  if (!alumno) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  }

  const { periodoId, matricula, nombres, apellidos, nombreCompleto, correo, grupo, activo } = req.body as Record<string, unknown>;

  alumno.periodoId = periodoId as never;
  alumno.matricula = matricula as never;
  alumno.nombres = nombres as never;
  alumno.apellidos = apellidos as never;
  alumno.nombreCompleto = nombreCompleto as never;
  alumno.correo = correo as never;
  alumno.grupo = grupo as never;
  if (typeof activo === 'boolean') alumno.activo = activo as never;

  await alumno.save();
  res.json({ alumno });
}

/**
 * Elimina un alumno y sus examenes asociados (solo admin en desarrollo).
 */
export async function eliminarAlumnoDev(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  validarAdminDev();
  const alumnoId = String(req.params.alumnoId ?? '').trim();

  const alumno = await Alumno.findOne({ _id: alumnoId, docenteId }).lean();
  if (!alumno) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  }

  const examenes = await ExamenGenerado.find({ docenteId, alumnoId }).select('_id').lean();
  const examenesIds = examenes.map((examen) => String(examen._id));

  const [entregasDocs, banderasDocs] = examenesIds.length
    ? await Promise.all([
        Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean(),
        BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean()
      ])
    : [[], []];
  const calificacionesDocs = await Calificacion.find({ docenteId, alumnoId }).lean();

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

  const [entregasResp, banderasResp] = examenesIds.length
    ? await Promise.all([
        Entrega.deleteMany({ docenteId, examenGeneradoId: { $in: examenesIds } }),
        BanderaRevision.deleteMany({ docenteId, examenGeneradoId: { $in: examenesIds } })
      ])
    : [{ deletedCount: 0 }, { deletedCount: 0 }];

  const examenesResp = examenesIds.length
    ? await ExamenGenerado.deleteMany({ docenteId, _id: { $in: examenesIds } })
    : { deletedCount: 0 };

  const calificacionesResp = await Calificacion.deleteMany({ docenteId, alumnoId });
  const alumnoResp = await Alumno.deleteOne({ _id: alumnoId, docenteId });

  res.json({
    ok: true,
    eliminados: {
      alumnos: alumnoResp.deletedCount ?? 0,
      examenes: examenesResp.deletedCount ?? 0,
      entregas: (entregasResp as { deletedCount?: number }).deletedCount ?? 0,
      calificaciones: (calificacionesResp as { deletedCount?: number }).deletedCount ?? 0,
      banderas: (banderasResp as { deletedCount?: number }).deletedCount ?? 0
    }
  });
}
