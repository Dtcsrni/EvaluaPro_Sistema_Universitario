/**
 * Controlador de banco de preguntas.
 */
import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion.js';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { normalizarEnunciadoBanco } from './normalizarEnunciadoBanco.js';
import { sanitizarContenidoRico } from './sanitizarContenidoRico.js';
import { esquemaListarAuditoriaTemaBanco } from './validacionesBancoPreguntas.js';

function normalizarTema(valor: unknown): string | undefined {
  const texto = String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return texto ? texto : undefined;
}

function claveTema(valor: string): string {
  return String(valor).trim().toLowerCase();
}

type AccionTemaBanco = 'crear' | 'actualizar' | 'archivar';

function calcularHuellaTema(accion: AccionTemaBanco, recursoId: string | null, payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify({ accion, recursoId, payload })).digest('hex');
}

async function recuperarMutacionTema(
  tx: Prisma.TransactionClient,
  docenteId: string,
  clientRequestId: string,
  accion: AccionTemaBanco,
  requestHash: string
) {
  const evento = await tx.temaBancoAuditoria.findUnique({
    where: { docenteId_clientRequestId: { docenteId, clientRequestId } }
  });
  if (!evento) return null;
  if (evento.accion !== accion || evento.requestHash !== requestHash) {
    throw new ErrorAplicacion('TEMA_REQUEST_ID_REUTILIZADO', 'clientRequestId ya fue utilizado para otra mutación o payload.', 409);
  }
  return { tema: JSON.parse(evento.despues) as Record<string, unknown>, repetida: true };
}

async function registrarMutacionTema(
  tx: Prisma.TransactionClient,
  input: {
    docenteId: string;
    periodoId: string;
    temaId: string;
    accion: AccionTemaBanco;
    clientRequestId: string;
    requestHash: string;
    antes: unknown;
    despues: unknown;
  }
) {
  await tx.temaBancoAuditoria.create({
    data: {
      ...input,
      antes: input.antes === null ? null : JSON.stringify(input.antes),
      despues: JSON.stringify(input.despues)
    }
  });
}

function normalizarTextoComparable(valor: unknown): string {
  return sanitizarContenidoRico(String(valor ?? ''))
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function firmaOpciones(opciones: { texto: string }[]): string {
  const normalizadas = (Array.isArray(opciones) ? opciones : []).map((o) => normalizarTextoComparable(o.texto)).sort();
  return JSON.stringify(normalizadas);
}

type OpcionBanco = { texto: string; esCorrecta: boolean };
type VersionBanco = { numeroVersion: number; enunciado: string; imagenUrl?: string; opciones: OpcionBanco[] };
type BancoPreguntaDoc = { versiones?: VersionBanco[]; versionActual?: number; tema?: string; activo?: boolean };

function obtenerVersionActiva(pregunta: BancoPreguntaDoc): VersionBanco | undefined {
  const versiones = Array.isArray(pregunta?.versiones) ? pregunta.versiones : [];
  const actual = versiones.find((item) => item.numeroVersion === pregunta?.versionActual);
  return actual ?? versiones[0];
}

function formatearPreguntaPrisma(raw: any) {
  if (!raw) return null;
  return {
    _id: raw.id,
    id: raw.id,
    docenteId: raw.docenteId,
    periodoId: raw.periodoId,
    tema: raw.tema ?? undefined,
    activo: raw.activo,
    versionActual: raw.versionActual,
    recoverySource: raw.recoverySource ? JSON.parse(raw.recoverySource) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    versiones: (raw.versiones || []).map((v: any) => ({
      numeroVersion: v.numeroVersion,
      enunciado: normalizarEnunciadoBanco(v.enunciado),
      imagenUrl: v.imagenUrl ?? undefined,
      opciones: (v.opciones || []).map((o: any) => ({
        texto: o.texto,
        esCorrecta: o.esCorrecta
      }))
    }))
  };
}

/**
 * Lista preguntas del docente (opcionalmente por periodo).
 */
export async function listarBancoPreguntas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const queryActivo = String(req.query.activo ?? '').trim().toLowerCase();
  const activo = queryActivo === '' ? true : !(queryActivo === '0' || queryActivo === 'false');
  const periodoId = req.query.periodoId ? String(req.query.periodoId) : undefined;
  const limite = Number(req.query.limite ?? 0);

  const query: any = {
    where: {
      docenteId,
      activo,
      periodoId
    },
    include: {
      versiones: {
        include: {
          opciones: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  };
  if (limite > 0) {
    query.take = limite;
  }

  const rawPreguntas = await prisma.bancoPregunta.findMany(query);
  const reactivosCanonicos = rawPreguntas.length > 0
    ? await prisma.reactivo.findMany({
      where: { legacyPreguntaId: { in: rawPreguntas.map((pregunta) => pregunta.id) }, docenteId },
      select: { id: true, legacyPreguntaId: true, externalKey: true, versionActual: true, estado: true, asignaciones: { select: { temaId: true } } }
    })
    : [];
  const reactivoPorPregunta = new Map(reactivosCanonicos.map((reactivo) => [String(reactivo.legacyPreguntaId), reactivo]));
  const preguntas = rawPreguntas.map((pregunta) => {
    const reactivo = reactivoPorPregunta.get(pregunta.id);
    return {
      ...formatearPreguntaPrisma(pregunta),
      ...(reactivo ? {
        reactivoId: reactivo.id,
        reactivoExternalKey: reactivo.externalKey,
        reactivoVersionActual: reactivo.versionActual,
        reactivoEstado: reactivo.estado,
        temaIdsCanonicos: reactivo.asignaciones.map((asignacion) => asignacion.temaId)
      } : {})
    };
  });
  res.json({ preguntas });
}

/**
 * Crea una pregunta en el banco del docente.
 */
export async function crearPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, tema, enunciado, imagenUrl, opciones } = req.body;
  const enunciadoFinal = normalizarEnunciadoBanco(sanitizarContenidoRico(enunciado));
  const opcionesFinales = (opciones || []).map((opcion: OpcionBanco) => ({ ...opcion, texto: sanitizarContenidoRico(opcion.texto) }));

  const temaFinal = normalizarTema(tema);
  if (temaFinal) {
    const existeTema = await prisma.temaBanco.findFirst({
      where: { docenteId, periodoId: String(periodoId), clave: claveTema(temaFinal), activo: true }
    });
    if (!existeTema) {
      throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
    }

    const candidatos = await prisma.bancoPregunta.findMany({
      where: { docenteId, periodoId: String(periodoId), tema: temaFinal, activo: true },
      include: { versiones: { include: { opciones: true } } }
    });

    const enunciadoNuevo = normalizarTextoComparable(enunciadoFinal);
    const opcionesNuevaFirma = firmaOpciones(opcionesFinales);

    for (const cand of candidatos) {
      const formatted = formatearPreguntaPrisma(cand);
      const v = obtenerVersionActiva(formatted as any);
      if (!v) continue;
      if (normalizarTextoComparable(v.enunciado) === enunciadoNuevo) {
        throw new ErrorAplicacion('PREGUNTA_DUPLICADA', 'Ya existe una pregunta con ese enunciado en este tema', 409);
      }
      if (firmaOpciones(v.opciones) === opcionesNuevaFirma) {
        throw new ErrorAplicacion('RESPUESTAS_DUPLICADAS', 'Ya existe una pregunta con las mismas opciones en este tema', 409);
      }
    }
  }

  const rawPregunta = await prisma.bancoPregunta.create({
    data: {
      docenteId,
      periodoId,
      tema: temaFinal || null,
      versionActual: 1,
      activo: true
    }
  });

  const rawVersion = await prisma.versionPregunta.create({
    data: {
      preguntaId: rawPregunta.id,
      numeroVersion: 1,
      enunciado: enunciadoFinal,
      imagenUrl: imagenUrl || null
    }
  });

  await prisma.opcionPregunta.createMany({
    data: opcionesFinales.map((o: any) => ({
      versionPreguntaId: rawVersion.id,
      texto: o.texto,
      esCorrecta: o.esCorrecta
    }))
  });

  const complete = await prisma.bancoPregunta.findUnique({
    where: { id: rawPregunta.id },
    include: { versiones: { include: { opciones: true } } }
  });

  res.status(201).json({ pregunta: formatearPreguntaPrisma(complete) });
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

  const pregunta = await prisma.bancoPregunta.findFirst({
    where: { id: preguntaId, docenteId },
    include: { versiones: { include: { opciones: true } } }
  });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  const preguntaDoc = formatearPreguntaPrisma(pregunta) as any;
  const periodoActual = pregunta.periodoId;

  const versionActual = obtenerVersionActiva(preguntaDoc);
  if (!versionActual) {
    throw new ErrorAplicacion('PREGUNTA_INVALIDA', 'La pregunta no tiene versiones', 500);
  }

  const versiones = preguntaDoc.versiones || [];
  const maxNumero = versiones.reduce((max: number, v: any) => Math.max(max, Number(v?.numeroVersion ?? 0)), 0);
  const siguienteNumero = Math.max(maxNumero, Number(pregunta.versionActual ?? 0)) + 1;

  let temaFinal = pregunta.tema;
  if (tema !== undefined) {
    const normTema = normalizarTema(tema);
    if (normTema) {
      const existeTema = await prisma.temaBanco.findFirst({
        where: { docenteId, periodoId: periodoActual, clave: claveTema(normTema), activo: true }
      });
      if (!existeTema) {
        throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
      }
    }
    temaFinal = normTema || null;
  }

  const nueva = {
    numeroVersion: siguienteNumero,
    enunciado: enunciado === undefined
      ? normalizarEnunciadoBanco(versionActual.enunciado)
      : normalizarEnunciadoBanco(sanitizarContenidoRico(enunciado)),
    imagenUrl: imagenUrl === undefined ? versionActual.imagenUrl : imagenUrl ?? undefined,
    opciones: opciones === undefined
      ? versionActual.opciones
      : opciones.map((opcion) => ({ ...opcion, texto: sanitizarContenidoRico(opcion.texto) }))
  };

  if (temaFinal) {
    const candidatos = await prisma.bancoPregunta.findMany({
      where: {
        docenteId,
        periodoId: periodoActual,
        tema: temaFinal,
        activo: true,
        id: { not: preguntaId }
      },
      include: { versiones: { include: { opciones: true } } }
    });

    const enunciadoNuevo = normalizarTextoComparable(nueva.enunciado);
    const opcionesNuevaFirma = firmaOpciones(nueva.opciones);

    for (const cand of candidatos) {
      const formatted = formatearPreguntaPrisma(cand);
      const v = obtenerVersionActiva(formatted as any);
      if (!v) continue;
      if (normalizarTextoComparable(v.enunciado) === enunciadoNuevo) {
        throw new ErrorAplicacion('PREGUNTA_DUPLICADA', 'Ya existe una pregunta con ese enunciado en este tema', 409);
      }
      if (firmaOpciones(v.opciones) === opcionesNuevaFirma) {
        throw new ErrorAplicacion('RESPUESTAS_DUPLICADAS', 'Ya existe una pregunta con las mismas opciones en este tema', 409);
      }
    }
  }

  const rawVersion = await prisma.versionPregunta.create({
    data: {
      preguntaId,
      numeroVersion: siguienteNumero,
      enunciado: nueva.enunciado,
      imagenUrl: nueva.imagenUrl || null
    }
  });

  await prisma.opcionPregunta.createMany({
    data: nueva.opciones.map((o: any) => ({
      versionPreguntaId: rawVersion.id,
      texto: o.texto,
      esCorrecta: o.esCorrecta
    }))
  });

  const updatedPregunta = await prisma.bancoPregunta.update({
    where: { id: preguntaId },
    data: {
      versionActual: siguienteNumero,
      tema: temaFinal
    },
    include: { versiones: { include: { opciones: true } } }
  });

  res.json({ pregunta: formatearPreguntaPrisma(updatedPregunta) });
}

/**
 * Archiva (desactiva) una pregunta del banco.
 */
export async function archivarPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const preguntaId = String(req.params.preguntaId ?? '').trim();

  const pregunta = await prisma.bancoPregunta.findFirst({
    where: { id: preguntaId, docenteId }
  });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  const updated = await prisma.bancoPregunta.update({
    where: { id: preguntaId },
    data: {
      activo: false,
      archivadoEn: new Date()
    },
    include: {
      versiones: {
        include: {
          opciones: true
        }
      }
    }
  });

  res.json({ pregunta: formatearPreguntaPrisma(updated) });
}

/**
 * Elimina de forma permanente una pregunta del banco.
 */
export async function eliminarPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const preguntaId = String(req.params.preguntaId ?? '').trim();

  const pregunta = await prisma.bancoPregunta.findFirst({
    where: { id: preguntaId, docenteId }
  });
  if (!pregunta) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Pregunta no encontrada', 404);
  }

  await prisma.bancoPregunta.delete({
    where: { id: preguntaId }
  });

  res.json({ ok: true, preguntaId });
}

/**
 * Mueve (reasigna) multiples preguntas a otro tema.
 */
export async function moverPreguntasTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, temaIdDestino, preguntasIds } = req.body as {
    periodoId?: string;
    temaIdDestino?: string;
    preguntasIds?: string[];
  };

  const periodoIdFinal = String(periodoId ?? '').trim();
  const temaIdDestinoFinal = String(temaIdDestino ?? '').trim();
  const ids = Array.isArray(preguntasIds) ? preguntasIds.map((id) => String(id).trim()).filter(Boolean) : [];

  if (!periodoIdFinal) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'Materia requerida', 400);
  }
  if (!temaIdDestinoFinal) {
    throw new ErrorAplicacion('TEMA_REQUERIDO', 'Tema destino requerido', 400);
  }
  if (ids.length === 0) {
    throw new ErrorAplicacion('PREGUNTAS_REQUERIDAS', 'Debes enviar al menos una pregunta', 400);
  }

  const materia = await prisma.periodo.findFirst({
    where: { id: periodoIdFinal, docenteId }
  });
  if (!materia) {
    throw new ErrorAplicacion('MATERIA_NO_ENCONTRADA', 'Materia no encontrada', 404);
  }

  const temaDestino = await prisma.temaBanco.findFirst({
    where: { id: temaIdDestinoFinal, docenteId, periodoId: periodoIdFinal, activo: true }
  });
  if (!temaDestino) {
    throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema destino no encontrado', 404);
  }
  const nombreDestino = normalizarTema(temaDestino.nombre)!;

  const preguntasMover = await prisma.bancoPregunta.findMany({
    where: { id: { in: ids }, docenteId, periodoId: periodoIdFinal, activo: true },
    include: { versiones: { include: { opciones: true } } }
  });

  if (preguntasMover.length !== ids.length) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Alguna pregunta no existe (o no pertenece a esta materia)', 404);
  }

  const existentesDestino = await prisma.bancoPregunta.findMany({
    where: {
      docenteId,
      periodoId: periodoIdFinal,
      tema: nombreDestino,
      activo: true,
      id: { notIn: ids }
    },
    include: { versiones: { include: { opciones: true } } }
  });

  const enunciadosDestino = new Set<string>();
  const opcionesDestino = new Set<string>();

  for (const cand of existentesDestino) {
    const formatted = formatearPreguntaPrisma(cand);
    const v = obtenerVersionActiva(formatted as any);
    if (!v) continue;
    enunciadosDestino.add(normalizarTextoComparable(v.enunciado));
    opcionesDestino.add(firmaOpciones(v.opciones));
  }

  const enunciadosLote = new Set<string>();
  const opcionesLote = new Set<string>();

  for (const cand of preguntasMover) {
    const formatted = formatearPreguntaPrisma(cand);
    const v = obtenerVersionActiva(formatted as any);
    if (!v) continue;

    const enunciadoN = normalizarTextoComparable(v.enunciado);
    const firma = firmaOpciones(v.opciones);

    if (enunciadosDestino.has(enunciadoN) || enunciadosLote.has(enunciadoN)) {
      throw new ErrorAplicacion('PREGUNTA_DUPLICADA', 'Ya existe una pregunta con ese enunciado en el tema destino', 409);
    }
    if (opcionesDestino.has(firma) || opcionesLote.has(firma)) {
      throw new ErrorAplicacion('RESPUESTAS_DUPLICADAS', 'Ya existe una pregunta con las mismas opciones en el tema destino', 409);
    }

    enunciadosLote.add(enunciadoN);
    opcionesLote.add(firma);
  }

  const resultado = await prisma.bancoPregunta.updateMany({
    where: { id: { in: ids }, docenteId, periodoId: periodoIdFinal, activo: true },
    data: { tema: nombreDestino }
  });

  res.json({ movidas: resultado.count });
}

/**
 * Quita el tema de multiples preguntas (quedan sin tema).
 */
export async function quitarTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, preguntasIds } = req.body as {
    periodoId?: string;
    preguntasIds?: string[];
  };

  const periodoIdFinal = String(periodoId ?? '').trim();
  const ids = Array.isArray(preguntasIds) ? preguntasIds.map((id) => String(id).trim()).filter(Boolean) : [];

  if (!periodoIdFinal) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'Materia requerida', 400);
  }
  if (ids.length === 0) {
    throw new ErrorAplicacion('PREGUNTAS_REQUERIDAS', 'Debes enviar al menos una pregunta', 400);
  }

  const materia = await prisma.periodo.findFirst({
    where: { id: periodoIdFinal, docenteId }
  });
  if (!materia) {
    throw new ErrorAplicacion('MATERIA_NO_ENCONTRADA', 'Materia no encontrada', 404);
  }

  const existentes = await prisma.bancoPregunta.findMany({
    where: { id: { in: ids }, docenteId, periodoId: periodoIdFinal, activo: true }
  });
  if (existentes.length !== ids.length) {
    throw new ErrorAplicacion('PREGUNTA_NO_ENCONTRADA', 'Alguna pregunta no existe (o no pertenece a esta materia)', 404);
  }

  const resultado = await prisma.bancoPregunta.updateMany({
    where: { id: { in: ids }, docenteId, periodoId: periodoIdFinal, activo: true },
    data: { tema: null }
  });

  res.json({ actualizadas: resultado.count });
}

/**
 * Lista temas del banco para una materia.
 */
export async function listarTemasBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'Materia requerida', 400);
  }

  const materia = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!materia) {
    throw new ErrorAplicacion('MATERIA_NO_ENCONTRADA', 'Materia no encontrada', 404);
  }

  const temas = await prisma.temaBanco.findMany({
    where: { docenteId, periodoId, activo: true },
    orderBy: { nombre: 'asc' }
  });
  res.json({ temas });
}

export async function obtenerTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temaId = String(req.params.temaId ?? '').trim();
  const tema = await prisma.temaBanco.findFirst({ where: { id: temaId, docenteId } });
  if (!tema) throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
  res.json({ tema });
}

/**
 * Crea un tema para una materia.
 */
export async function crearTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, nombre, clientRequestId: requestId } = req.body as { periodoId?: string; nombre?: string; clientRequestId?: string };
  const nombreFinal = normalizarTema(nombre);
  if (!periodoId) {
    throw new ErrorAplicacion('PERIODO_REQUERIDO', 'Materia requerida', 400);
  }
  if (!nombreFinal) {
    throw new ErrorAplicacion('TEMA_INVALIDO', 'Tema invalido', 400);
  }

  const clave = claveTema(nombreFinal);
  const clientRequestId = requestId ?? randomUUID();
  const requestHash = calcularHuellaTema('crear', null, { periodoId, nombre: nombreFinal, clave });
  const resultado = await prisma.$transaction(async (tx) => {
    const repeticion = await recuperarMutacionTema(tx, docenteId, clientRequestId, 'crear', requestHash);
    if (repeticion) return repeticion;
    const materia = await tx.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
    if (!materia) throw new ErrorAplicacion('MATERIA_NO_ENCONTRADA', 'Materia no encontrada', 404);
    const existente = await tx.temaBanco.findFirst({ where: { docenteId, periodoId, clave } });
    let tema;
    if (existente) {
      if (existente.activo !== false) throw new ErrorAplicacion('TEMA_DUPLICADO', 'Ya existe un tema con ese nombre', 409);
      tema = await tx.temaBanco.update({ where: { id: existente.id }, data: { activo: true, archivadoEn: null, nombre: nombreFinal, clave } });
    } else {
      tema = await tx.temaBanco.create({ data: { docenteId, periodoId, nombre: nombreFinal, clave, activo: true } });
    }
    await registrarMutacionTema(tx, {
      docenteId, periodoId, temaId: tema.id, accion: 'crear', clientRequestId, requestHash,
      antes: existente ?? null, despues: tema
    });
    return { tema, repetida: false };
  });
  res.status(201).json({ ...resultado, clientRequestId });
}

/**
 * Renombra un tema y actualiza referencias en preguntas/plantillas.
 */
export async function actualizarTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temaId = String(req.params.temaId ?? '').trim();
  const { nombre, clientRequestId: requestId } = req.body as { nombre?: string; clientRequestId?: string };
  const nombreFinal = normalizarTema(nombre);
  if (!nombreFinal) {
    throw new ErrorAplicacion('TEMA_INVALIDO', 'Tema invalido', 400);
  }

  const clientRequestId = requestId ?? randomUUID();
  const requestHash = calcularHuellaTema('actualizar', temaId, { nombre: nombreFinal });
  const resultado = await prisma.$transaction(async (tx) => {
    const repeticion = await recuperarMutacionTema(tx, docenteId, clientRequestId, 'actualizar', requestHash);
    if (repeticion) return repeticion;
    const tema = await tx.temaBanco.findFirst({ where: { id: temaId, docenteId } });
    if (!tema) throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
    const periodoId = tema.periodoId;
    const nombreAnterior = tema.nombre;
    const claveNueva = claveTema(nombreFinal);
    const duplicado = await tx.temaBanco.findFirst({ where: { docenteId, periodoId, clave: claveNueva, id: { not: temaId } } });
    if (duplicado) throw new ErrorAplicacion('TEMA_DUPLICADO', 'Ya existe un tema con ese nombre', 409);
    const actualizado = await tx.temaBanco.update({ where: { id: temaId }, data: { nombre: nombreFinal, clave: claveNueva, activo: true, archivadoEn: null } });
    if (nombreAnterior !== nombreFinal) {
      await tx.bancoPregunta.updateMany({ where: { docenteId, periodoId, tema: nombreAnterior }, data: { tema: nombreFinal } });
      const plantillas = await tx.examenPlantilla.findMany({ where: { docenteId, periodoId }, select: { id: true, temas: true } });
      for (const plantilla of plantillas) {
        const temasList = JSON.parse(plantilla.temas || '[]');
        if (temasList.includes(nombreAnterior)) {
          const nuevoTemas = temasList.map((temaPlantilla: string) => temaPlantilla === nombreAnterior ? nombreFinal : temaPlantilla);
          await tx.examenPlantilla.update({ where: { id: plantilla.id }, data: { temas: JSON.stringify(nuevoTemas) } });
        }
      }
    }
    await registrarMutacionTema(tx, {
      docenteId, periodoId, temaId, accion: 'actualizar', clientRequestId, requestHash,
      antes: tema, despues: actualizado
    });
    return { tema: actualizado, repetida: false };
  });
  res.json({ ...resultado, clientRequestId });
}

/**
 * Archiva (desactiva) un tema y remueve referencias en preguntas/plantillas.
 */
export async function archivarTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temaId = String(req.params.temaId ?? '').trim();
  const requestId = (req.body as { clientRequestId?: string } | undefined)?.clientRequestId;
  const clientRequestId = requestId ?? randomUUID();
  const requestHash = calcularHuellaTema('archivar', temaId, {});
  const resultado = await prisma.$transaction(async (tx) => {
    const repeticion = await recuperarMutacionTema(tx, docenteId, clientRequestId, 'archivar', requestHash);
    if (repeticion) return repeticion;
    const tema = await tx.temaBanco.findFirst({ where: { id: temaId, docenteId } });
    if (!tema) throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
    const periodoId = tema.periodoId;
    const nombreTema = tema.nombre;
    const actualizado = tema.activo === false
      ? tema
      : await tx.temaBanco.update({ where: { id: temaId }, data: { activo: false, archivadoEn: new Date() } });
    if (tema.activo !== false) {
      await tx.bancoPregunta.updateMany({ where: { docenteId, periodoId, tema: nombreTema }, data: { tema: null } });
      const plantillas = await tx.examenPlantilla.findMany({ where: { docenteId, periodoId }, select: { id: true, temas: true } });
      for (const plantilla of plantillas) {
        const temasList = JSON.parse(plantilla.temas || '[]');
        if (temasList.includes(nombreTema)) {
          await tx.examenPlantilla.update({
            where: { id: plantilla.id },
            data: { temas: JSON.stringify(temasList.filter((temaPlantilla: string) => temaPlantilla !== nombreTema)) }
          });
        }
      }
    }
    await registrarMutacionTema(tx, {
      docenteId, periodoId, temaId, accion: 'archivar', clientRequestId, requestHash,
      antes: tema, despues: actualizado
    });
    return { tema: actualizado, repetida: false };
  });
  res.json({ ...resultado, clientRequestId });
}

export async function listarAuditoriaTemaBanco(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const temaId = String(req.params.temaId ?? '').trim();
  const query = esquemaListarAuditoriaTemaBanco.parse(res.locals.validatedQuery ?? req.query);
  const limite = query.limite;
  const valorCursor = query.cursor;
  let cursor: { id: string; createdAt: Date } | undefined;
  if (valorCursor) {
    try {
      const decoded = JSON.parse(Buffer.from(valorCursor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(decoded.id) || !Number.isFinite(createdAt.getTime())) {
        throw new Error('invalid cursor');
      }
      cursor = { id: decoded.id, createdAt };
    } catch {
      throw new ErrorAplicacion('TEMA_AUDITORIA_CURSOR_INVALIDO', 'El cursor de auditoría del tema no es válido.', 400);
    }
  }
  const tema = await prisma.temaBanco.findFirst({ where: { id: temaId, docenteId }, select: { id: true } });
  if (!tema) throw new ErrorAplicacion('TEMA_NO_ENCONTRADO', 'Tema no encontrado', 404);
  const eventos = await prisma.temaBancoAuditoria.findMany({
    where: {
      docenteId,
      temaId,
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
    },
    take: limite + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });
  const hayMas = eventos.length > limite;
  const pagina = eventos.slice(0, limite);
  const ultimo = hayMas ? pagina[pagina.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, createdAt: ultimo.createdAt.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({
    temaId,
    eventos: pagina.map((evento) => ({
      id: evento.id,
      accion: evento.accion,
      clientRequestId: evento.clientRequestId,
      actorDocenteId: docenteId,
      antes: evento.antes ? JSON.parse(evento.antes) : null,
      despues: JSON.parse(evento.despues),
      createdAt: evento.createdAt.toISOString()
    })),
    nextCursor
  });
}
