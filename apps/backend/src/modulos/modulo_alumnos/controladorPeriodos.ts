/**
 * Controlador de periodos.
 *
 * Contrato:
 * - Los periodos pertenecen a un docente; siempre se filtran/crean con `docenteId`.
 * - Las fechas se normalizan a `Date` al persistir.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { BanderaRevision } from '../modulo_analiticas/modeloBanderaRevision';
import { Alumno } from './modeloAlumno';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { TemaBanco } from '../modulo_banco_preguntas/modeloTemaBanco';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { CodigoAcceso } from '../modulo_sincronizacion_nube/modeloCodigoAcceso';
import { Entrega } from '../modulo_vinculacion_entrega/modeloEntrega';
import { normalizarNombrePeriodo, Periodo } from './modeloPeriodo';
import { guardarEnPapelera } from '../modulo_papelera/servicioPapelera';

function validarAdminDev() {
  if (String(configuracion.entorno).toLowerCase() !== 'development') {
    throw new ErrorAplicacion('SOLO_DEV', 'Accion disponible solo en modo desarrollo', 403);
  }
}

function parsearQueryActivo(valor: unknown): boolean | null {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim().toLowerCase();
  if (!texto) return null;
  if (texto === '1' || texto === 'true' || texto === 'si' || texto === 'sí') return true;
  if (texto === '0' || texto === 'false' || texto === 'no') return false;
  return null;
}

/**
 * Lista periodos del docente autenticado.
 */
export async function listarPeriodos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string | boolean> = { docenteId };

  // Por defecto, solo materias activas.
  const activo = parsearQueryActivo(req.query.activo);
  filtro.activo = activo ?? true;

  const limite = Number(req.query.limite ?? 0);
  const consulta = Periodo.find(filtro).sort({ createdAt: -1 });
  const periodos = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ periodos });
}

/**
 * Crea un periodo asociado al docente.
 */
export async function crearPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);

  const nombre = String(req.body.nombre ?? '').trim();
  const nombreNormalizado = normalizarNombrePeriodo(nombre);
  const existente = await Periodo.findOne({ docenteId, nombreNormalizado }).lean();
  if (existente) {
    throw new ErrorAplicacion('PERIODO_DUPLICADO', 'Ya existe una materia con ese nombre', 409);
  }

  const { fechaInicio, fechaFin } = req.body as { fechaInicio: Date; fechaFin: Date };
  const periodo = await Periodo.create({
    ...req.body,
    nombre,
    nombreNormalizado,
    docenteId,
    fechaInicio,
    fechaFin
  });
  res.status(201).json({ periodo });
}

/**
 * Actualiza una materia del docente autenticado.
 */
export async function actualizarPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }
  if (periodo.activo === false) {
    throw new ErrorAplicacion('PERIODO_INACTIVO', 'La materia está archivada', 409);
  }

  const payload = req.body as {
    nombre?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
    grupos?: string[];
  };

  const cambios: Record<string, unknown> = {};
  if (payload.nombre !== undefined) {
    const nombre = String(payload.nombre ?? '').trim();
    const nombreNormalizado = normalizarNombrePeriodo(nombre);
    const existente = await Periodo.findOne({
      docenteId,
      nombreNormalizado,
      _id: { $ne: periodoId }
    }).lean();
    if (existente) {
      throw new ErrorAplicacion('PERIODO_DUPLICADO', 'Ya existe una materia con ese nombre', 409);
    }
    cambios.nombre = nombre;
    cambios.nombreNormalizado = nombreNormalizado;
  }

  const fechaInicioNueva = payload.fechaInicio ?? (periodo.fechaInicio as Date);
  const fechaFinNueva = payload.fechaFin ?? (periodo.fechaFin as Date);
  if (fechaFinNueva < fechaInicioNueva) {
    throw new ErrorAplicacion('PERIODO_FECHAS_INVALIDAS', 'La fecha fin debe ser igual o posterior a la fecha inicio', 400);
  }
  if (payload.fechaInicio !== undefined) cambios.fechaInicio = payload.fechaInicio;
  if (payload.fechaFin !== undefined) cambios.fechaFin = payload.fechaFin;
  if (payload.grupos !== undefined) cambios.grupos = payload.grupos;

  const actualizado = await Periodo.findOneAndUpdate({ _id: periodoId, docenteId }, { $set: cambios }, { returnDocument: 'after' }).lean();
  res.json({ ok: true, periodo: actualizado });
}

/**
 * Archiva un periodo (materia): lo marca como inactivo, registra timestamp y genera un resumen.
 * Nota: no borra datos; desactiva entidades asociadas que soportan `activo`.
 */
export async function archivarPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  if (periodo.activo === false) {
    const actualizado = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
    return res.json({ ok: true, periodo: actualizado });
  }

  const [alumnos, bancoPreguntas, plantillas, generados, calificaciones, codigosAcceso] = await Promise.all([
    Alumno.countDocuments({ docenteId, periodoId }),
    BancoPregunta.countDocuments({ docenteId, periodoId }),
    ExamenPlantilla.countDocuments({ docenteId, periodoId }),
    ExamenGenerado.countDocuments({ docenteId, periodoId }),
    Calificacion.countDocuments({ docenteId, periodoId }),
    CodigoAcceso.countDocuments({ docenteId, periodoId })
  ]);

  await Promise.all([
    Periodo.updateOne(
      { _id: periodoId, docenteId },
      {
        $set: {
          activo: false,
          archivadoEn: new Date(),
          resumenArchivado: {
            alumnos,
            bancoPreguntas,
            plantillas,
            examenesGenerados: generados,
            calificaciones,
            codigosAcceso
          }
        }
      }
    ),
    Alumno.updateMany({ docenteId, periodoId }, { $set: { activo: false } }),
    BancoPregunta.updateMany({ docenteId, periodoId }, { $set: { activo: false, archivadoEn: new Date() } }),
    TemaBanco.updateMany({ docenteId, periodoId }, { $set: { activo: false, archivadoEn: new Date() } }),
    ExamenPlantilla.updateMany({ docenteId, periodoId }, { $set: { archivadoEn: new Date() } }),
    ExamenGenerado.updateMany({ docenteId, periodoId }, { $set: { archivadoEn: new Date() } })
  ]);

  const actualizado = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  res.json({ ok: true, periodo: actualizado });
}

/**
 * Elimina una materia y sus datos asociados (solo admin en desarrollo).
 */
export async function eliminarPeriodoDev(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  validarAdminDev();
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  const examenes = await ExamenGenerado.find({ docenteId, periodoId }).select('_id').lean();
  const examenesIds = examenes.map((examen) => String(examen._id));

  const [
    alumnosDocs,
    bancoDocs,
    temasDocs,
    plantillasDocs,
    calificacionesDocs,
    codigosDocs,
    entregasDocs,
    banderasDocs
  ] = await Promise.all([
    Alumno.find({ docenteId, periodoId }).lean(),
    BancoPregunta.find({ docenteId, periodoId }).lean(),
    TemaBanco.find({ docenteId, periodoId }).lean(),
    ExamenPlantilla.find({ docenteId, periodoId }).lean(),
    Calificacion.find({ docenteId, periodoId }).lean(),
    CodigoAcceso.find({ docenteId, periodoId }).lean(),
    examenesIds.length ? Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean() : Promise.resolve([]),
    examenesIds.length ? BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds } }).lean() : Promise.resolve([])
  ]);

  await guardarEnPapelera({
    docenteId,
    tipo: 'periodo',
    entidadId: periodoId,
    payload: {
      periodo,
      alumnos: alumnosDocs,
      bancoPreguntas: bancoDocs,
      temas: temasDocs,
      plantillas: plantillasDocs,
      examenes,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs,
      codigosAcceso: codigosDocs
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

  const [
    alumnosResp,
    bancoResp,
    temasResp,
    plantillasResp,
    calificacionesResp,
    codigosResp,
    periodoResp
  ] = await Promise.all([
    Alumno.deleteMany({ docenteId, periodoId }),
    BancoPregunta.deleteMany({ docenteId, periodoId }),
    TemaBanco.deleteMany({ docenteId, periodoId }),
    ExamenPlantilla.deleteMany({ docenteId, periodoId }),
    Calificacion.deleteMany({ docenteId, periodoId }),
    CodigoAcceso.deleteMany({ docenteId, periodoId }),
    Periodo.deleteOne({ _id: periodoId, docenteId })
  ]);

  res.json({
    ok: true,
    eliminados: {
      periodos: periodoResp.deletedCount ?? 0,
      alumnos: (alumnosResp as { deletedCount?: number }).deletedCount ?? 0,
      bancoPreguntas: (bancoResp as { deletedCount?: number }).deletedCount ?? 0,
      temas: (temasResp as { deletedCount?: number }).deletedCount ?? 0,
      plantillas: (plantillasResp as { deletedCount?: number }).deletedCount ?? 0,
      examenes: examenesResp.deletedCount ?? 0,
      entregas: (entregasResp as { deletedCount?: number }).deletedCount ?? 0,
      calificaciones: (calificacionesResp as { deletedCount?: number }).deletedCount ?? 0,
      banderas: (banderasResp as { deletedCount?: number }).deletedCount ?? 0,
      codigosAcceso: (codigosResp as { deletedCount?: number }).deletedCount ?? 0
    }
  });
}
