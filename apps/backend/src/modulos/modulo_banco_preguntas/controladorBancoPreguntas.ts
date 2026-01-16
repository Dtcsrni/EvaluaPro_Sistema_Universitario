/**
 * Controlador de banco de preguntas.
 *
 * Contrato:
 * - El banco de preguntas es multi-tenant por `docenteId`.
 * - Al crear una pregunta se inicializa con `versionActual = 1` y una sola version.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { BancoPregunta } from './modeloBancoPregunta';

/**
 * Lista preguntas del docente (opcionalmente por periodo).
 */
export async function listarBancoPreguntas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const queryActivo = String(req.query.activo ?? '').trim().toLowerCase();
  const activo = queryActivo === '' ? true : !(queryActivo === '0' || queryActivo === 'false');

  const querySinMateria = String(req.query.sinMateria ?? '').trim().toLowerCase();
  const sinMateria = querySinMateria === '1' || querySinMateria === 'true';

  const filtro: Record<string, unknown> = { docenteId, activo };
  if (sinMateria) {
    // Soporta preguntas legacy sin periodoId (backfill).
    (filtro as Record<string, unknown>).$or = [{ periodoId: { $exists: false } }, { periodoId: null }];
  } else if (req.query.periodoId) {
    filtro.periodoId = String(req.query.periodoId);
  }

  const limite = Number(req.query.limite ?? 0);
  const consulta = BancoPregunta.find(filtro).sort({ createdAt: -1 });
  const preguntas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ preguntas });
}

/**
 * Asigna una materia (periodo) a una pregunta legacy que no tiene periodoId.
 */
export async function asignarMateriaPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const preguntaId = String(req.params.preguntaId ?? '').trim();
  const { periodoId } = req.body as { periodoId?: string };

  const materia = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!materia) {
    throw new ErrorAplicacion('MATERIA_NO_ENCONTRADA', 'Materia no encontrada', 404);
  }

  const pregunta = await BancoPregunta.findOne({ _id: preguntaId, docenteId });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  const periodoActual = (pregunta as unknown as { periodoId?: unknown }).periodoId;
  if (periodoActual) {
    if (String(periodoActual) === String(periodoId)) {
      return res.json({ pregunta });
    }
    throw new ErrorAplicacion('PREGUNTA_YA_ASIGNADA', 'La pregunta ya tiene una materia asignada', 409);
  }

  (pregunta as unknown as { periodoId: unknown }).periodoId = periodoId as unknown;
  await pregunta.save();
  res.json({ pregunta });
}

/**
 * Crea una pregunta en el banco del docente.
 */
export async function crearPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, tema, enunciado, imagenUrl, opciones } = req.body;

  const pregunta = await BancoPregunta.create({
    docenteId,
    periodoId,
    tema,
    versionActual: 1,
    versiones: [
      {
        numeroVersion: 1,
        enunciado,
        imagenUrl,
        opciones
      }
    ]
  });

  res.status(201).json({ pregunta });
}
