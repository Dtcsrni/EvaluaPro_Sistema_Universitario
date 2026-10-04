/**
 * Controlador del módulo de temarios.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { parsearTextoTemario, extraerTextoPdf } from './servicioParserTemario.js';
import { esquemaListarAuditoriaTemario } from './validacionesTemarios.js';

function errorTemarioExistente(periodoId: string) {
  return new ErrorAplicacion(
    'TEMARIO_EXISTENTE',
    'El periodo ya tiene un temario. Consulta su ID y usa la operación de actualización para conservar su avance.',
    409,
    { periodoId }
  );
}

async function crearTemarioConNodos(params: {
  periodoId: string;
  nombre: string;
  texto: string;
  nodos: ReturnType<typeof parsearTextoTemario>;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.temario.findUnique({ where: { periodoId: params.periodoId }, select: { id: true } });
      if (existente) throw errorTemarioExistente(params.periodoId);
      const temario = await tx.temario.create({
        data: {
          periodoId: params.periodoId,
          nombre: params.nombre.trim(),
          textoOriginal: params.texto,
          totalNodos: params.nodos.length,
          porcentajeAvance: 0
        }
      });
      await tx.temarioNodo.createMany({
        data: params.nodos.map((nodo) => ({
          temarioId: temario.id,
          numero: nodo.numero,
          nivel: nodo.nivel,
          titulo: nodo.titulo,
          estado: 'pendiente'
        }))
      });
      return { temario, totalNodos: params.nodos.length };
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw errorTemarioExistente(params.periodoId);
    }
    throw error;
  }
}

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

  const resultado = await crearTemarioConNodos({ periodoId, nombre, texto, nodos });
  res.status(201).json(resultado);
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

  const resultado = await crearTemarioConNodos({
    periodoId,
    nombre: nombre ?? req.file.originalname,
    texto,
    nodos
  });
  res.status(201).json({ ...resultado, textoExtraido: texto.slice(0, 500) });
}

export async function obtenerTemario(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temarioId = String(req.params['temarioId'] ?? '');
  const temario = await prisma.temario.findFirst({
    where: { id: temarioId, periodo: { docenteId } },
    include: { nodos: { orderBy: { numero: 'asc' } } }
  });
  if (!temario) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);
  res.json({ temario, nodos: temario.nodos });
}

export async function actualizarTemario(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temarioId = String(req.params['temarioId'] ?? '');
  const { nombre, texto, expectedUpdatedAt, motivoCambio } = req.body as {
    nombre: string;
    texto: string;
    expectedUpdatedAt: string;
    motivoCambio: string;
  };
  const nuevosNodos = parsearTextoTemario(texto);
  if (nuevosNodos.length === 0) {
    throw new ErrorAplicacion('TEMARIO_VACIO', 'No se detectaron temas con formato numérico.', 400);
  }
  const numerosNuevos = nuevosNodos.map((nodo) => nodo.numero);
  if (new Set(numerosNuevos).size !== numerosNuevos.length) {
    throw new ErrorAplicacion('TEMARIO_NODO_DUPLICADO', 'El texto contiene números de tema duplicados.', 400);
  }
  const expectedDate = new Date(expectedUpdatedAt);
  if (!Number.isFinite(expectedDate.getTime())) {
    throw new ErrorAplicacion('TEMARIO_VERSION_INVALIDA', 'expectedUpdatedAt debe ser una fecha ISO válida.', 400);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const actual = await tx.temario.findFirst({
      where: { id: temarioId, periodo: { docenteId } },
      include: { nodos: true }
    });
    if (!actual) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);
    if (actual.updatedAt.getTime() !== expectedDate.getTime()) {
      throw new ErrorAplicacion('TEMARIO_CONFLICTO_CONCURRENCIA', 'El temario cambió desde la última lectura. Vuelve a cargarlo antes de editar.', 409, { updatedAt: actual.updatedAt.toISOString() });
    }

    const numerosSet = new Set(numerosNuevos);
    const nodosEliminados = actual.nodos.filter((nodo) => !numerosSet.has(nodo.numero));
    const nodoConAvanceEliminado = nodosEliminados.find((nodo) =>
      nodo.estado !== 'pendiente' || nodo.sesionAsistenciaId || nodo.notas?.trim() || nodo.cubiertaEn
    );
    if (nodoConAvanceEliminado) {
      throw new ErrorAplicacion(
        'TEMARIO_NODO_CON_HISTORIAL',
        'No se puede quitar un nodo que ya tiene avance, notas o vínculo de asistencia.',
        409,
        { numero: nodoConAvanceEliminado.numero }
      );
    }

    const nodosPrevios = new Map(actual.nodos.map((nodo) => [nodo.numero, nodo]));
    const cubiertosDespues = nuevosNodos.filter((nodo) => nodosPrevios.get(nodo.numero)?.estado === 'cubierto').length;
    const porcentajeAvance = Math.round((cubiertosDespues / nuevosNodos.length) * 100);
    const antes = { nombre: actual.nombre, textoOriginal: actual.textoOriginal, totalNodos: actual.totalNodos, porcentajeAvance: actual.porcentajeAvance };
    const despues = { nombre: nombre.trim(), textoOriginal: texto, totalNodos: nuevosNodos.length, porcentajeAvance };
    const auditoria = (() => {
      try {
        const existente = actual.auditoriaCambios ? JSON.parse(actual.auditoriaCambios) : [];
        return Array.isArray(existente) ? existente : [];
      } catch {
        return [];
      }
    })();
    auditoria.push({ actorDocenteId: docenteId, ocurridoEn: new Date().toISOString(), motivo: motivoCambio.trim(), antes, despues });

    const actualizacion = await tx.temario.updateMany({
      where: { id: temarioId, updatedAt: expectedDate },
      data: { nombre: despues.nombre, textoOriginal: texto, totalNodos: nuevosNodos.length, porcentajeAvance, auditoriaCambios: JSON.stringify(auditoria) }
    });
    if (actualizacion.count !== 1) {
      throw new ErrorAplicacion('TEMARIO_CONFLICTO_CONCURRENCIA', 'El temario cambió durante la actualización.', 409);
    }

    if (nodosEliminados.length) await tx.temarioNodo.deleteMany({ where: { id: { in: nodosEliminados.map((nodo) => nodo.id) } } });
    for (const nodo of nuevosNodos) {
      const previo = nodosPrevios.get(nodo.numero);
      if (previo) {
        await tx.temarioNodo.update({ where: { id: previo.id }, data: { nivel: nodo.nivel, titulo: nodo.titulo } });
      } else {
        await tx.temarioNodo.create({ data: { temarioId, numero: nodo.numero, nivel: nodo.nivel, titulo: nodo.titulo, estado: 'pendiente' } });
      }
    }
    await tx.auditoriaTemario.create({
      data: {
        temarioId,
        docenteId,
        periodoId: actual.periodoId,
        accion: 'actualizado',
        motivo: motivoCambio.trim(),
        antes: JSON.stringify({ ...antes, nodos: actual.nodos }),
        despues: JSON.stringify({ ...despues, nodos: nuevosNodos })
      }
    });
    return tx.temario.findUnique({ where: { id: temarioId }, include: { nodos: { orderBy: { numero: 'asc' } } } });
  });
  res.json({ temario: resultado, nodos: resultado?.nodos ?? [] });
}

export async function listarAuditoriaTemario(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temarioId = String(req.params['temarioId'] ?? '');
  const filtros = esquemaListarAuditoriaTemario.parse(res.locals.validatedQuery ?? req.query);
  let cursor: { id: string; createdAt: Date } | undefined;
  if (filtros.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.cursor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(decoded.id) || !Number.isFinite(createdAt.getTime())) throw new Error('invalid cursor');
      cursor = { id: decoded.id, createdAt };
    } catch {
      throw new ErrorAplicacion('TEMARIO_AUDITORIA_CURSOR_INVALIDO', 'El cursor de auditoría del temario no es válido.', 400);
    }
  }
  const eventos = await prisma.auditoriaTemario.findMany({
    where: {
      temarioId,
      docenteId,
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filtros.limite + 1
  });
  const hayMas = eventos.length > filtros.limite;
  const pagina = eventos.slice(0, filtros.limite);
  if (pagina.length === 0) {
    const tieneAuditoria = await prisma.auditoriaTemario.findFirst({ where: { temarioId, docenteId }, select: { id: true } });
    const temario = await prisma.temario.findFirst({
      where: { id: temarioId, periodo: { docenteId } },
      select: { id: true }
    });
    if (!tieneAuditoria && !temario) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);
  }
  const ultimo = hayMas ? pagina[pagina.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, createdAt: ultimo.createdAt.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({ eventos: pagina, limite: filtros.limite, nextCursor });
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
  const { expectedUpdatedAt, motivoCambio } = req.body as { expectedUpdatedAt: string; motivoCambio: string };
  const expectedDate = new Date(expectedUpdatedAt);
  if (!Number.isFinite(expectedDate.getTime())) {
    throw new ErrorAplicacion('TEMARIO_VERSION_INVALIDA', 'expectedUpdatedAt debe ser una fecha ISO válida.', 400);
  }

  await prisma.$transaction(async (tx) => {
    const temario = await tx.temario.findFirst({
      where: { id: temarioId, periodo: { docenteId } },
      include: { nodos: true }
    });
    if (!temario) throw new ErrorAplicacion('NO_ENCONTRADO', 'Temario no encontrado', 404);
    if (temario.updatedAt.getTime() !== expectedDate.getTime()) {
      throw new ErrorAplicacion('TEMARIO_CONFLICTO_CONCURRENCIA', 'El temario cambió desde la última lectura. Vuelve a cargarlo antes de eliminarlo.', 409);
    }
    const nodoConHistorial = temario.nodos.find((nodo) =>
      nodo.estado !== 'pendiente' || nodo.sesionAsistenciaId || nodo.notas?.trim() || nodo.cubiertaEn
    );
    if (nodoConHistorial) {
      throw new ErrorAplicacion(
        'TEMARIO_CON_HISTORIAL',
        'No se puede eliminar un temario con avance, notas o sesiones vinculadas.',
        409,
        { numero: nodoConHistorial.numero }
      );
    }
    await tx.auditoriaTemario.create({
      data: {
        temarioId,
        docenteId,
        periodoId: temario.periodoId,
        accion: 'eliminado',
        motivo: motivoCambio.trim(),
        antes: JSON.stringify({ ...temario, nodos: temario.nodos }),
        despues: null
      }
    });
    await tx.temarioNodo.deleteMany({ where: { temarioId } });
    await tx.temario.delete({ where: { id: temarioId } });
  });
  res.json({ ok: true });
}
