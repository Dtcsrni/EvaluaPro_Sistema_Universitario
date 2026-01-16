/**
 * Controlador de periodos.
 *
 * Contrato:
 * - Los periodos pertenecen a un docente; siempre se filtran/crean con `docenteId`.
 * - Las fechas se normalizan a `Date` al persistir.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Alumno } from './modeloAlumno';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { CodigoAcceso } from '../modulo_sincronizacion_nube/modeloCodigoAcceso';
import { normalizarNombrePeriodo, Periodo } from './modeloPeriodo';

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

  const periodo = await Periodo.create({
    ...req.body,
    nombre,
    nombreNormalizado,
    docenteId,
    fechaInicio: new Date(req.body.fechaInicio),
    fechaFin: new Date(req.body.fechaFin)
  });
  res.status(201).json({ periodo });
}

/**
 * Borra un periodo (materia) y todos los recursos asociados del docente.
 */
export async function borrarPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.params.periodoId ?? '').trim();

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  await Periodo.deleteOne({ _id: periodoId, docenteId });

  const [alumnos, bancoPreguntas, plantillas, generados, calificaciones, codigosAcceso] = await Promise.all([
    Alumno.deleteMany({ docenteId, periodoId }),
    BancoPregunta.deleteMany({ docenteId, periodoId }),
    ExamenPlantilla.deleteMany({ docenteId, periodoId }),
    ExamenGenerado.deleteMany({ docenteId, periodoId }),
    Calificacion.deleteMany({ docenteId, periodoId }),
    CodigoAcceso.deleteMany({ docenteId, periodoId })
  ]);

  res.json({
    ok: true,
    borrados: {
      alumnos: alumnos.deletedCount,
      bancoPreguntas: bancoPreguntas.deletedCount,
      plantillas: plantillas.deletedCount,
      examenesGenerados: generados.deletedCount,
      calificaciones: calificaciones.deletedCount,
      codigosAcceso: codigosAcceso.deletedCount
    }
  });
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
    BancoPregunta.updateMany({ docenteId, periodoId }, { $set: { activo: false } })
  ]);

  const actualizado = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  res.json({ ok: true, periodo: actualizado });
}
