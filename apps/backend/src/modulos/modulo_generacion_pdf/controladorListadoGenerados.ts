/**
 * Controlador para listado de examenes generados.
 *
 * Seguridad:
 * - Todas las consultas se filtran por `docenteId` para evitar acceso entre docentes.
 * - `descargarPdf` solo sirve PDFs cuyo path proviene del propio documento del examen.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { ExamenGenerado } from './modeloExamenGenerado';
import { promises as fs } from 'fs';
import { ExamenPlantilla } from './modeloExamenPlantilla';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { generarPdfExamen } from './servicioGeneracionPdf';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { normalizarParaNombreArchivo } from '../../compartido/utilidades/texto';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { Entrega } from '../modulo_vinculacion_entrega/modeloEntrega';
import { Docente } from '../modulo_autenticacion/modeloDocente';

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

function construirNombrePdfExamen(parametros: {
  folio: string;
  loteId?: string;
  materiaNombre?: string;
  temas?: string[];
  plantillaTitulo?: string;
}): string {
  const materia = normalizarParaNombreArchivo(parametros.materiaNombre, { maxLen: 42 });
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 42 });
  const folio = normalizarParaNombreArchivo(parametros.folio, { maxLen: 16 });
  const lote = normalizarParaNombreArchivo(parametros.loteId, { maxLen: 16 });

  const temas = Array.isArray(parametros.temas) ? parametros.temas.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
  let tema = '';
  if (temas.length === 1) {
    tema = normalizarParaNombreArchivo(temas[0], { maxLen: 36 });
  } else if (temas.length > 1) {
    const primero = normalizarParaNombreArchivo(temas[0], { maxLen: 26 });
    tema = primero ? `${primero}_mas-${temas.length - 1}` : `mas-${temas.length}`;
  }

  const partes = ['examen'];
  if (materia) partes.push(materia);
  if (tema) partes.push(`tema-${tema}`);
  if (titulo) partes.push(titulo);
  if (lote) partes.push(`lote-${lote}`);
  if (folio) partes.push(`folio-${folio}`);

  const nombre = partes.filter(Boolean).join('_');
  return `${nombre}.pdf`;
}

/**
 * Lista examenes generados del docente, con filtros opcionales (periodo, alumno, folio).
 */
export async function listarExamenesGenerados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId).trim();
  if (req.query.alumnoId) filtro.alumnoId = String(req.query.alumnoId).trim();
  if (req.query.plantillaId) filtro.plantillaId = String(req.query.plantillaId).trim();
  if (req.query.folio) filtro.folio = String(req.query.folio).trim().toUpperCase();

  const limite = Number(req.query.limite ?? 0);
  const consulta = ExamenGenerado.find(filtro).sort({ generadoEn: -1, _id: -1 });
  const examenes = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ examenes });
}

/**
 * Obtiene un examen por folio (multi-tenant por docente).
 */
export async function obtenerExamenPorFolio(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const folio = String(req.params.folio || '').trim().toUpperCase();
  const examen = await ExamenGenerado.findOne({ folio, docenteId }).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  res.json({ examen });
}

/**
 * Descarga el PDF asociado a un examen.
 *
 * Nota: este endpoint hace IO a disco (almacen local). Si el archivo desaparecio,
 * se responde con error 500 para indicar inconsistencia de almacenamiento.
 */
export async function descargarPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '');
  const examen = await ExamenGenerado.findOne({ _id: examenId, docenteId }).lean();
  if (!examen || !examen.rutaPdf) {
    throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF no disponible', 404);
  }

  try {
    const buffer = await fs.readFile(examen.rutaPdf);

    const [plantilla, periodo] = await Promise.all([
      ExamenPlantilla.findById(String((examen as unknown as { plantillaId?: unknown })?.plantillaId ?? '')).lean(),
      (examen as unknown as { periodoId?: unknown })?.periodoId
        ? Periodo.findById(String((examen as unknown as { periodoId?: unknown })?.periodoId ?? '')).lean()
        : Promise.resolve(null)
    ]);

    const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] })?.temas)
      ? (((plantilla as unknown as { temas?: unknown[] })?.temas ?? []) as unknown[]).map((t) => String(t ?? '').trim()).filter(Boolean)
      : [];

    const nombreDescarga = construirNombrePdfExamen({
      folio: String((examen as unknown as { folio?: unknown })?.folio ?? 'examen'),
      loteId: String((examen as unknown as { loteId?: unknown })?.loteId ?? ''),
      materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
      temas,
      plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? '')
    });

    // Best-effort: marca el momento de descarga (se actualiza aunque el PDF ya se haya descargado antes).
    // Si la actualizacion falla, no se bloquea la descarga.
    void ExamenGenerado.updateOne({ _id: examenId, docenteId }, { $set: { descargadoEn: new Date() } }).catch(() => {
      // no-op
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreDescarga}"`);
    res.send(buffer);
  } catch {
    throw new ErrorAplicacion('PDF_INVALIDO', 'No se pudo leer el PDF', 500);
  }
}

/**
 * Regenera el PDF asociado a un examen (y recalcula metadata de paginas / mapa OMR).
 *
 * Guardrails:
 * - Solo permite regenerar si el examen esta en estado `generado`.
 * - Si ya fue descargado, requiere `forzar=true` (para evitar regeneraciones accidentales).
 */
export async function regenerarPdfExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '').trim();
  const forzar = Boolean((req.body as { forzar?: unknown })?.forzar);

  const examen = await ExamenGenerado.findOne({ _id: examenId, docenteId }).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const estado = String((examen as unknown as { estado?: unknown })?.estado ?? '');
  if (estado && estado !== 'generado') {
    throw new ErrorAplicacion(
      'EXAMEN_NO_REGENERABLE',
      'No se puede regenerar un examen ya entregado o calificado',
      409
    );
  }

  const yaDescargado = Boolean((examen as unknown as { descargadoEn?: unknown })?.descargadoEn);
  if (yaDescargado && !forzar) {
    throw new ErrorAplicacion(
      'EXAMEN_REQUIERE_FORZAR',
      'Este examen ya fue descargado. Reintenta con forzar=true si deseas regenerarlo.',
      409
    );
  }

  const plantillaId = String((examen as unknown as { plantillaId?: unknown })?.plantillaId ?? '').trim();
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'No se encontro la plantilla para regenerar este examen', 404);
  }
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const folio = String((examen as unknown as { folio?: unknown })?.folio ?? '').trim().toUpperCase();
  if (!folio) {
    throw new ErrorAplicacion('EXAMEN_INVALIDO', 'El examen no tiene folio', 500);
  }

  const mapaVariante = (examen as unknown as { mapaVariante?: unknown })?.mapaVariante as
    | { ordenPreguntas?: unknown; ordenOpcionesPorPregunta?: unknown }
    | undefined;

  const preguntasIds = Array.isArray((examen as unknown as { preguntasIds?: unknown })?.preguntasIds)
    ? (((examen as unknown as { preguntasIds?: unknown })?.preguntasIds ?? []) as unknown[]).map((x) => String(x))
    : Array.isArray(mapaVariante?.ordenPreguntas)
      ? (mapaVariante?.ordenPreguntas as unknown[]).map((x) => String(x))
      : [];

  if (preguntasIds.length === 0) {
    throw new ErrorAplicacion('EXAMEN_SIN_PREGUNTAS', 'No se pudo determinar el set de preguntas del examen', 409);
  }

  const preguntasDb = (await BancoPregunta.find({ docenteId, _id: { $in: preguntasIds } }).lean()) as BancoPreguntaLean[];
  if (!Array.isArray(preguntasDb) || preguntasDb.length !== preguntasIds.length) {
    throw new ErrorAplicacion(
      'PREGUNTAS_NO_DISPONIBLES',
      `No se pudieron cargar todas las preguntas del examen (esperadas: ${preguntasIds.length}, encontradas: ${preguntasDb.length})`,
      409
    );
  }

  const porId = new Map<string, BancoPreguntaLean>();
  for (const p of preguntasDb) porId.set(String(p._id), p);

  const preguntasBase = preguntasIds.map((id) => {
    const pregunta = porId.get(String(id));
    if (!pregunta) {
      throw new ErrorAplicacion('PREGUNTA_FALTANTE', 'Pregunta faltante al regenerar', 409);
    }
    const version =
      pregunta.versiones.find((item) => item.numeroVersion === pregunta.versionActual) ?? pregunta.versiones[0];
    return {
      id: String(pregunta._id),
      enunciado: version.enunciado,
      imagenUrl: version.imagenUrl ?? undefined,
      opciones: version.opciones
    };
  });

  const [periodo, docenteDb] = await Promise.all([
    (examen as unknown as { periodoId?: unknown })?.periodoId
      ? Periodo.findById(String((examen as unknown as { periodoId?: unknown })?.periodoId ?? '')).lean()
      : Promise.resolve(null),
    Docente.findById(docenteId).lean()
  ]);

  const { pdfBytes, paginas, mapaOmr } = await generarPdfExamen({
    titulo: String(plantilla.titulo ?? ''),
    folio,
    preguntas: preguntasBase,
    // Reutiliza la variante para mantener el orden de preguntas/opciones.
    mapaVariante: (examen as unknown as { mapaVariante?: unknown })?.mapaVariante as never,
    tipoExamen: plantilla.tipo as 'parcial' | 'global',
    margenMm: (plantilla as unknown as { configuracionPdf?: { margenMm?: number } })?.configuracionPdf?.margenMm ?? 10,
    encabezado: {
      materia: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
      docente: String((docenteDb as unknown as { nombreCompleto?: unknown })?.nombreCompleto ?? '')
    }
  });

  const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] })?.temas)
    ? (((plantilla as unknown as { temas?: unknown[] })?.temas ?? []) as unknown[]).map((t) => String(t ?? '').trim()).filter(Boolean)
    : [];

  const nombreArchivo = construirNombrePdfExamen({
    folio,
    loteId: String((examen as unknown as { loteId?: unknown })?.loteId ?? ''),
    materiaNombre: String((periodo as unknown as { nombre?: unknown })?.nombre ?? ''),
    temas,
    plantillaTitulo: String((plantilla as unknown as { titulo?: unknown })?.titulo ?? '')
  });
  const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);

  await ExamenGenerado.updateOne(
    { _id: examenId, docenteId },
    {
      $set: {
        preguntasIds,
        paginas,
        mapaOmr,
        rutaPdf
      }
    }
  );

  const actualizado = await ExamenGenerado.findOne({ _id: examenId, docenteId }).lean();
  res.json({ examenGenerado: actualizado });
}

/**
 * Elimina un examen generado.
 *
 * Regla de negocio:
 * - Solo se permite eliminar si el examen esta en estado `generado` (no entregado/calificado).
 * - Si existen registros de entrega o calificacion asociados, se bloquea.
 *
 * Nota: el borrado del archivo PDF es best-effort.
 */
export async function eliminarExamenGenerado(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '').trim();

  const examen = await ExamenGenerado.findOne({ _id: examenId, docenteId }).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  const estado = String((examen as unknown as { estado?: unknown })?.estado ?? '');
  if (estado && estado !== 'generado') {
    throw new ErrorAplicacion('EXAMEN_NO_ELIMINABLE', 'No se puede eliminar un examen ya entregado o calificado', 409);
  }

  const [tieneEntrega, tieneCalificacion] = await Promise.all([
    Entrega.exists({ docenteId, examenGeneradoId: examenId }),
    Calificacion.exists({ docenteId, examenGeneradoId: examenId })
  ]);

  if (tieneEntrega) {
    throw new ErrorAplicacion('EXAMEN_CON_ENTREGA', 'No se puede eliminar: el examen ya fue vinculado/entregado', 409);
  }
  if (tieneCalificacion) {
    throw new ErrorAplicacion('EXAMEN_CON_CALIFICACION', 'No se puede eliminar: el examen ya tiene calificacion', 409);
  }

  const rutaPdf = String((examen as unknown as { rutaPdf?: unknown })?.rutaPdf ?? '').trim();

  await ExamenGenerado.deleteOne({ _id: examenId, docenteId });

  if (rutaPdf) {
    try {
      await fs.unlink(rutaPdf);
    } catch (error) {
      // Si el archivo no existe (o falla el borrado), no bloquea la operacion.
      void error;
    }
  }

  res.json({ ok: true });
}
