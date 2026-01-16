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

function normalizarTema(valor: unknown): string | undefined {
  const texto = String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return texto ? texto : undefined;
}

type OpcionBanco = { texto: string; esCorrecta: boolean };
type VersionBanco = { numeroVersion: number; enunciado: string; imagenUrl?: string; opciones: OpcionBanco[] };
type BancoPreguntaDoc = { versiones?: VersionBanco[]; versionActual?: number; tema?: string; activo?: boolean };

function obtenerVersionActiva(pregunta: BancoPreguntaDoc): VersionBanco | undefined {
  const versiones = Array.isArray(pregunta?.versiones) ? pregunta.versiones : [];
  const actual = versiones.find((item) => item.numeroVersion === pregunta?.versionActual);
  return actual ?? versiones[0];
}

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
    tema: normalizarTema(tema),
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

/**
 * Actualiza una pregunta creando una nueva version (versionado).
 */
export async function actualizarPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const preguntaId = String(req.params.preguntaId ?? '').trim();
  const { tema, enunciado, imagenUrl, opciones } = req.body as {
    tema?: string;
    enunciado?: string;
    imagenUrl?: string | null;
    opciones?: Array<{ texto: string; esCorrecta: boolean }>;
  };

  const pregunta = await BancoPregunta.findOne({ _id: preguntaId, docenteId });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  const preguntaDoc = pregunta as unknown as BancoPreguntaDoc & {
    versiones: VersionBanco[];
    versionActual: number;
  };

  const versionActual = obtenerVersionActiva(preguntaDoc);
  if (!versionActual) {
    throw new ErrorAplicacion('PREGUNTA_INVALIDA', 'La pregunta no tiene versiones', 500);
  }

  const versiones = Array.isArray(preguntaDoc.versiones) ? preguntaDoc.versiones : [];
  const maxNumero = versiones.reduce((max, v) => Math.max(max, Number(v?.numeroVersion ?? 0)), 0);
  const siguienteNumero = Math.max(maxNumero, Number(preguntaDoc.versionActual ?? 0)) + 1;

  if (tema !== undefined) {
    preguntaDoc.tema = normalizarTema(tema);
  }

  const nueva = {
    numeroVersion: siguienteNumero,
    enunciado: enunciado ?? versionActual.enunciado,
    imagenUrl: imagenUrl === undefined ? versionActual.imagenUrl : imagenUrl ?? undefined,
    opciones: opciones ?? versionActual.opciones
  };

  preguntaDoc.versiones = [...versiones, nueva];
  preguntaDoc.versionActual = siguienteNumero;
  await pregunta.save();

  res.json({ pregunta });
}

/**
 * Elimina (desactiva) una pregunta del banco.
 */
export async function eliminarPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const preguntaId = String(req.params.preguntaId ?? '').trim();

  const pregunta = await BancoPregunta.findOne({ _id: preguntaId, docenteId });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  const preguntaDoc = pregunta as unknown as BancoPreguntaDoc;
  preguntaDoc.activo = false;
  await pregunta.save();
  res.json({ pregunta });
}
