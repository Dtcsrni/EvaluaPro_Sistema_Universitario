/**
 * Controlador para plantillas y examenes generados.
 *
 * Contrato de seguridad:
 * - Todas las operaciones son multi-tenant por `docenteId`.
 * - Para acciones sobre una plantilla existente, se valida propiedad (`plantilla.docenteId`).
 *
 * Efectos laterales:
 * - `generarExamen` escribe el PDF a almacenamiento local y crea un `ExamenGenerado`.
 */
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { barajar } from '../../compartido/utilidades/aleatoriedad';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { ExamenGenerado } from './modeloExamenGenerado';
import { ExamenPlantilla } from './modeloExamenPlantilla';
import { generarPdfExamen } from './servicioGeneracionPdf';
import { generarVariante } from './servicioVariantes';

type BancoPreguntaLean = {
  _id: unknown;
  versionActual: number;
  versiones: Array<{
    numeroVersion: number;
    enunciado: string;
    imagenUrl?: string;
    opciones: Array<{ texto: string; esCorrecta: boolean }>;
  }>;
};

/**
 * Lista plantillas del docente autenticado (opcionalmente filtradas por periodo).
 */
export async function listarPlantillas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId);

  const limite = Number(req.query.limite ?? 0);
  const consulta = ExamenPlantilla.find(filtro);
  const plantillas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ plantillas });
}

/**
 * Crea una plantilla asociandola al docente autenticado.
 */
export async function crearPlantilla(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);

  const temasRaw = (req.body as { temas?: unknown }).temas;
  const temas = Array.isArray(temasRaw)
    ? Array.from(
        new Set(
          temasRaw
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
            .map((t) => t.replace(/\s+/g, ' '))
        )
      )
    : undefined;

  const plantilla = await ExamenPlantilla.create({ ...req.body, temas, docenteId });
  res.status(201).json({ plantilla });
}

/**
 * Genera un examen a partir de una plantilla.
 *
 * Contrato de autorizacion por objeto:
 * - La plantilla debe pertenecer al docente autenticado.
 *
 * Notas de implementacion:
 * - `folio` se deriva de `randomUUID()` para minimizar colisiones.
 * - El PDF se persiste en almacenamiento local y se registra la ruta.
 */
export async function generarExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { plantillaId, alumnoId } = req.body;
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();

  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
    ? ((plantilla as unknown as { temas?: unknown[] }).temas ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  let preguntasDb: BancoPreguntaLean[] = [];
  if (temas.length > 0) {
    if (!plantilla.periodoId) {
      throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla por temas requiere materia (periodoId)', 400);
    }
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      periodoId: plantilla.periodoId,
      tema: { $in: temas }
    }).lean()) as BancoPreguntaLean[];
  } else {
    preguntasDb = (await BancoPregunta.find({
      docenteId,
      activo: true,
      ...(plantilla.periodoId ? { periodoId: plantilla.periodoId } : {}),
      _id: { $in: preguntasIds }
    }).lean()) as BancoPreguntaLean[];
  }

  if (preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas asociadas', 400);
  }
  if (plantilla.totalReactivos > preguntasDb.length) {
    throw new ErrorAplicacion('REACTIVOS_INSUFICIENTES', 'No hay suficientes preguntas en el banco', 400);
  }

  const preguntasBase = preguntasDb.map((pregunta) => {
    const version =
      pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    return {
      id: String(pregunta._id),
      enunciado: version.enunciado,
      imagenUrl: version.imagenUrl ?? undefined,
      opciones: version.opciones
    };
  });

  const preguntasSeleccionadas = barajar(preguntasBase).slice(0, plantilla.totalReactivos);
  const mapaVariante = generarVariante(preguntasSeleccionadas);
  const folio = randomUUID().split('-')[0].toUpperCase();

  const { pdfBytes, paginas, mapaOmr } = await generarPdfExamen({
    titulo: plantilla.titulo,
    folio,
    preguntas: preguntasSeleccionadas,
    mapaVariante,
    tipoExamen: plantilla.tipo as 'parcial' | 'global',
    margenMm: plantilla.configuracionPdf?.margenMm ?? 10
  });

  const nombreArchivo = `examen_${folio}.pdf`;
  const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);

  const examenGenerado = await ExamenGenerado.create({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id,
    alumnoId,
    folio,
    estado: 'generado',
    mapaVariante,
    paginas,
    mapaOmr,
    rutaPdf
  });

  res.status(201).json({ examenGenerado });
}

