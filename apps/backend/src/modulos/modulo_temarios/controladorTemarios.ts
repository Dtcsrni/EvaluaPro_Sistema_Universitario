/**
 * Controlador del módulo de temarios.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { parsearTextoTemario, extraerTextoPdf } from './servicioParserTemario';

// ─── Temarios ─────────────────────────────────────────────────────────────────

export async function listarTemarios(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  
  const temarios = await prisma.temario.findMany({
    where: {
      periodoId: req.query['periodoId'] ? String(req.query['periodoId']) : undefined,
      periodo: {
        docenteId
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({ temarios });
}

export async function crearTemarioManual(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, nombre, texto } = req.body as {
    periodoId: string;
    nombre: string;
    texto: string;
  };

  // Verify period ownership
  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  const nodos = parsearTextoTemario(texto);
  if (nodos.length === 0) {
    throw new ErrorAplicacion(
      'TEMARIO_VACIO',
      'No se detectaron temas con formato numérico (ej: 1 Introducción, 1.1 Sub-tema)',
      400
    );
  }

  // Borrar temario anterior si existe en el periodo (uniqueness)
  const anterior = await prisma.temario.findUnique({
    where: { periodoId }
  });
  if (anterior) {
    await prisma.$transaction([
      prisma.temarioNodo.deleteMany({ where: { temarioId: anterior.id } }),
      prisma.temario.delete({ where: { id: anterior.id } })
    ]);
  }

  const temario = await prisma.temario.create({
    data: {
      periodoId,
      nombre: nombre.trim(),
      textoOriginal: texto,
      totalNodos: nodos.length,
      porcentajeAvance: 0
    }
  });

  await prisma.temarioNodo.createMany({
    data: nodos.map((n) => ({
      temarioId: temario.id,
      numero: n.numero,
      nivel: n.nivel,
      titulo: n.titulo,
      estado: 'pendiente'
    }))
  });

  res.status(201).json({ temario, totalNodos: nodos.length });
}

export async function crearTemarioDesdePdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, nombre } = req.body as { periodoId: string; nombre?: string };

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  if (!req.file) {
    throw new ErrorAplicacion('ARCHIVO_REQUERIDO', 'Se requiere un archivo PDF', 400);
  }

  let texto: string;
  try {
    texto = await extraerTextoPdf(req.file.buffer);
  } catch {
    throw new ErrorAplicacion(
      'FORMATO_INVALIDO',
      'No se pudo extraer texto del PDF. Asegúrese de que no esté dañado.',
      400
    );
  }
  const nodos = parsearTextoTemario(texto);

  if (nodos.length === 0) {
    throw new ErrorAplicacion(
      'TEMARIO_VACIO',
      'No se detectaron temas numerados en el PDF. Asegúrese de que el documento tiene formato: "1 Tema", "1.1 Subtema".',
      400
    );
  }

  // Borrar temario anterior si existe en el periodo
  const anterior = await prisma.temario.findUnique({
    where: { periodoId }
  });
  if (anterior) {
    await prisma.$transaction([
      prisma.temarioNodo.deleteMany({ where: { temarioId: anterior.id } }),
      prisma.temario.delete({ where: { id: anterior.id } })
    ]);
  }

  const temario = await prisma.temario.create({
    data: {
      periodoId,
      nombre: (nombre ?? req.file.originalname).trim(),
      textoOriginal: texto,
      totalNodos: nodos.length,
      porcentajeAvance: 0
    }
  });

  await prisma.temarioNodo.createMany({
    data: nodos.map((n) => ({
      temarioId: temario.id,
      numero: n.numero,
      nivel: n.nivel,
      titulo: n.titulo,
      estado: 'pendiente'
    }))
  });

  res.status(201).json({ temario, totalNodos: nodos.length, textoExtraido: texto.slice(0, 500) });
}

export async function obtenerNodosTemario(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temarioId = String(req.params['temarioId'] ?? '');

  const temario = await prisma.temario.findFirst({
    where: {
      id: temarioId,
      periodo: {
        docenteId
      }
    }
  });
  if (!temario) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);

  const nodos = await prisma.temarioNodo.findMany({
    where: { temarioId },
    orderBy: { numero: 'asc' }
  });
  res.json({ temario, nodos });
}

export async function actualizarEstadoNodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const nodoId = String(req.params['nodoId'] ?? '');
  const { estado, sesionAsistenciaId, notas } = req.body as {
    estado: 'pendiente' | 'en_progreso' | 'cubierto';
    sesionAsistenciaId?: string;
    notes?: string; // note: notas or notes? Mongoose has: notas. We support both.
    notas?: string;
  };

  const notasFinal = notas || (req.body as Record<string, unknown>).notes;

  const nodo = await prisma.temarioNodo.findFirst({
    where: {
      id: nodoId,
      temario: {
        periodo: {
          docenteId
        }
      }
    }
  });
  if (!nodo) throw new ErrorAplicacion('NO_ENCONTRADO', 'Nodo no encontrado', 404);

  const updatedNodo = await prisma.temarioNodo.update({
    where: { id: nodoId },
    data: {
      estado,
      sesionAsistenciaId: sesionAsistenciaId || null,
      notas: notasFinal !== undefined ? String(notasFinal).trim() : undefined,
      cubiertaEn: estado === 'cubierto' ? new Date() : null
    }
  });

  const [total, cubiertos] = await Promise.all([
    prisma.temarioNodo.count({ where: { temarioId: nodo.temarioId } }),
    prisma.temarioNodo.count({ where: { temarioId: nodo.temarioId, estado: 'cubierto' } })
  ]);
  const porcentajeAvance = total > 0 ? Math.round((cubiertos / total) * 100) : 0;
  await prisma.temario.update({
    where: { id: nodo.temarioId },
    data: { porcentajeAvance }
  });

  res.json({ nodo: updatedNodo, porcentajeAvance });
}

export async function eliminarTemario(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temarioId = String(req.params['temarioId'] ?? '');

  const temario = await prisma.temario.findFirst({
    where: {
      id: temarioId,
      periodo: {
        docenteId
      }
    }
  });
  if (!temario) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);

  await prisma.$transaction([
    prisma.temarioNodo.deleteMany({ where: { temarioId } }),
    prisma.temario.delete({ where: { id: temarioId } })
  ]);
  res.json({ ok: true });
}
