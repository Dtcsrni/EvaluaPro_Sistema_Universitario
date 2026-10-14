import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { calcularAcumuladoTareasPonderadoPorPuntos } from './calculoAcumuladoTareas.js';

const MAXIMO_CAPTURA_BYTES = 200_000;

export async function registrarEventoEntregaClassroom(params: {
  docenteId: string; periodoId: string; alumnoId: string; courseId: string; courseWorkId: string; submissionId: string;
  corte: number | null; puntosObtenidos: number | null; puntosPosibles: number | null; calificacionSobre10: number | null;
  estado: string; estadoClassroom: string | null; importacionId: string; capturadoPor: string; observadoEn: Date;
}) {
  const estadoHash = createHash('sha256').update(JSON.stringify({
    docenteId: params.docenteId, periodoId: params.periodoId, alumnoId: params.alumnoId, courseId: params.courseId,
    courseWorkId: params.courseWorkId, submissionId: params.submissionId, corte: params.corte,
    puntosObtenidos: params.puntosObtenidos, puntosPosibles: params.puntosPosibles,
    calificacionSobre10: params.calificacionSobre10, estado: params.estado, estadoClassroom: params.estadoClassroom
  })).digest('hex');
  await prisma.historialClassroomEntrega.upsert({
    where: { docenteId_estadoHash: { docenteId: params.docenteId, estadoHash } },
    create: { ...params, estadoHash },
    update: {}
  });
}

export async function listarHistorialEntregaClassroom(params: {
  docenteId: string; periodoId: string; alumnoId: string; courseId: string; courseWorkId: string; submissionId: string; cursor?: string; limite: number;
}) {
  const alumno = await prisma.alumno.findFirst({
    where: { id: params.alumnoId, periodoId: params.periodoId, periodo: { docenteId: params.docenteId } }, select: { id: true }
  });
  if (!alumno) return null;
  const where = {
    docenteId: params.docenteId, periodoId: params.periodoId, alumnoId: params.alumnoId,
    courseId: params.courseId, courseWorkId: params.courseWorkId, submissionId: params.submissionId
  };
  const filas = await prisma.historialClassroomEntrega.findMany({
    where,
    select: { id: true, corte: true, puntosObtenidos: true, puntosPosibles: true, calificacionSobre10: true, estado: true, estadoClassroom: true, importacionId: true, observadoEn: true, capturadoPor: true },
    orderBy: [{ observadoEn: 'desc' }, { id: 'desc' }], take: params.limite + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {})
  });
  const hayMas = filas.length > params.limite;
  return { eventos: filas.slice(0, params.limite), nextCursor: hayMas ? filas[params.limite - 1]?.id ?? null : null };
}

function json(valor: unknown): Record<string, unknown> {
  if (typeof valor !== 'string') return valor && typeof valor === 'object' ? valor as Record<string, unknown> : {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function escapeSvg(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[caracter] ?? caracter);
}

function crearFichaSvg(params: { alumno: string; materia: string; corte: number; promedio: number | null; estado: string; puntos: number; posibles: number; fecha: string; actividades: Array<{ titulo: string; estado: string; puntos: number | null; posibles: number | null }> }): Buffer {
  const filas = params.actividades.slice(0, 5).map((actividad, indice) => `
    <text x="54" y="${406 + indice * 20}" class="fila">${escapeSvg(actividad.titulo).slice(0, 64)} · ${escapeSvg(actividad.estado)} · ${actividad.puntos === null ? '—' : `${actividad.puntos}/${actividad.posibles}`}</text>`).join('');
  const promedio = params.promedio === null ? 'Pendiente de datos' : `${params.promedio.toFixed(2)} / 10`;
  const svg = `<svg width="960" height="540" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">
    <rect width="960" height="540" rx="28" fill="#0c1b2a"/><rect x="28" y="28" width="904" height="484" rx="22" fill="#12283d" stroke="#4ebbd2" stroke-width="2"/>
    <text x="54" y="82" class="eyebrow">EVALUAPRO · HISTORIAL CLASSROOM</text>
    <text x="54" y="132" class="title">Promedio del ${params.corte}° parcial</text>
    <text x="54" y="174" class="meta">${escapeSvg(params.alumno).slice(0, 90)}</text><text x="54" y="204" class="meta">${escapeSvg(params.materia).slice(0, 90)}</text>
    <text x="54" y="234" class="meta">Capturado: ${escapeSvg(params.fecha)}</text>
    <text x="54" y="285" class="score">${escapeSvg(promedio)}</text>
    <text x="54" y="309" class="meta">${escapeSvg(params.estado)} · ${params.puntos.toFixed(2)} / ${params.posibles.toFixed(2)} puntos</text>
    <text x="54" y="335" class="meta">Promedio = puntos obtenidos ÷ puntos posibles × 10</text>
    <text x="54" y="370" class="section">ACTIVIDADES · PRIMERAS 5</text>${filas || '<text x="54" y="406" class="fila">Sin actividades calificadas en este corte</text>'}
    <style>.eyebrow{font:700 18px sans-serif;letter-spacing:2px;fill:#77d9e5}.title{font:700 36px sans-serif;fill:#f4f8fc}.meta{font:500 19px sans-serif;fill:#c2d3e3}.score{font:700 46px sans-serif;fill:#83e4c0}.section{font:700 15px sans-serif;letter-spacing:1.4px;fill:#9cb5cb}.fila{font:500 16px sans-serif;fill:#d9e7f3}</style>
  </svg>`;
  return Buffer.from(svg);
}

export async function registrarSnapshotsClassroomCortes(params: { docenteId: string; periodoId: string; importacionId: string }) {
  const [periodo, alumnos, mapeos, evidencias] = await Promise.all([
    prisma.periodo.findFirst({ where: { id: params.periodoId, docenteId: params.docenteId }, select: { nombre: true } }),
    prisma.alumno.findMany({ where: { periodoId: params.periodoId }, select: { id: true, nombreCompleto: true } }),
    prisma.mapeoClassroomEvidencia.findMany({ where: { docenteId: params.docenteId, periodoId: params.periodoId } }),
    prisma.evidenciaEvaluacion.findMany({ where: { docenteId: params.docenteId, periodoId: params.periodoId, fuente: 'classroom', archivadaEn: null } })
  ]);
  if (!periodo) return 0;
  const alumnosPorId = new Map(alumnos.map((alumno) => [alumno.id, alumno]));
  const mapeosActivos = mapeos.map((mapeo) => ({
    courseId: mapeo.courseId,
    courseWorkId: mapeo.courseWorkId,
    corte: Number(json(mapeo.metadata).corte),
    titulo: String(json(mapeo.metadata).tituloEvidencia ?? mapeo.courseWorkId),
    activo: json(mapeo.metadata).activo !== false && json(mapeo.metadata).destinoColumna !== 'Excluir'
  })).filter((mapeo) => mapeo.activo && [1, 2, 3].includes(mapeo.corte));
  const mapeosPorActividad = new Map(mapeosActivos.map((mapeo) => [`${mapeo.courseId}:${mapeo.courseWorkId}`, mapeo]));
  const porAlumnoCorte = new Map<string, { alumnoId: string; corte: number; actividades: Array<{ courseId: string; courseWorkId: string; titulo: string; estado: string; puntos: number | null; posibles: number | null; calificable: boolean }> }>();

  for (const evidencia of evidencias) {
    const aula = json(evidencia.classroomData);
    const clave = `${String(aula.courseId ?? '')}:${String(aula.courseWorkId ?? '')}`;
    const mapeo = mapeosPorActividad.get(clave);
    if (!mapeo) continue;
    const grupoKey = `${evidencia.alumnoId}:${mapeo.corte}`;
    const grupo = porAlumnoCorte.get(grupoKey) ?? { alumnoId: evidencia.alumnoId, corte: mapeo.corte, actividades: [] };
    const metadata = json(evidencia.metadata);
    const posibles = Number(aula.maxPoints);
    const calificacion = typeof evidencia.calificacionDecimal === 'number' ? evidencia.calificacionDecimal : null;
    const faltaConfirmada = Boolean(metadata.faltanteClassroomConfirmado);
    const calificada = evidencia.estadoCaptura === 'calificada' && calificacion !== null && Number.isFinite(posibles) && posibles > 0;
    grupo.actividades.push({
      courseId: mapeo.courseId, courseWorkId: mapeo.courseWorkId, titulo: String(aula.courseWorkTitle ?? mapeo.titulo),
      estado: faltaConfirmada ? 'faltante confirmado' : calificada ? 'calificada' : String(aula.submissionState ?? 'pendiente'),
      puntos: faltaConfirmada ? 0 : calificada ? Math.max(0, Math.min(posibles, calificacion! * posibles / 10)) : null,
      posibles: Number.isFinite(posibles) && posibles > 0 ? posibles : null,
      calificable: faltaConfirmada || calificada
    });
    porAlumnoCorte.set(grupoKey, grupo);
  }

  let guardados = 0;
  for (const grupo of porAlumnoCorte.values()) {
    const actividades = grupo.actividades.sort((a, b) => a.courseWorkId.localeCompare(b.courseWorkId));
    const elegibles = actividades.filter((actividad) => actividad.calificable && actividad.posibles !== null);
    const promedio = elegibles.length ? calcularAcumuladoTareasPonderadoPorPuntos(elegibles.map((actividad) => ({
      puntosObtenidos: actividad.puntos ?? 0, puntosPosibles: actividad.posibles!, calificada: true,
      faltanteExplicito: actividad.estado === 'faltante confirmado', vencida: actividad.estado === 'faltante confirmado'
    }))) : null;
    const puntos = Number(elegibles.reduce((suma, actividad) => suma + (actividad.puntos ?? 0), 0).toFixed(4));
    const posibles = Number(elegibles.reduce((suma, actividad) => suma + (actividad.posibles ?? 0), 0).toFixed(4));
    const estado = promedio === null ? 'pendiente' : 'calculado';
    const actividadesCompactas = actividades.map(({ courseId, courseWorkId, titulo, estado: estadoActividad, puntos: puntosActividad, posibles: posiblesActividad }) => ({
      courseId, courseWorkId, titulo, estado: estadoActividad, puntos: puntosActividad, posibles: posiblesActividad
    }));
    const snapshotHash = createHash('sha256').update(JSON.stringify({ periodoId: params.periodoId, alumnoId: grupo.alumnoId, corte: grupo.corte, estado, promedio, actividades: actividadesCompactas })).digest('hex');
    const existente = await prisma.historialClassroomCorte.findUnique({ where: { docenteId_snapshotHash: { docenteId: params.docenteId, snapshotHash } }, select: { id: true } });
    if (existente) continue;
    const alumno = alumnosPorId.get(grupo.alumnoId);
    const generadoEn = new Date();
    const imagenSvg = crearFichaSvg({ alumno: alumno?.nombreCompleto ?? 'Alumno', materia: periodo.nombre, corte: grupo.corte, promedio, estado, puntos, posibles, fecha: generadoEn.toISOString(), actividades: actividadesCompactas.map((actividad) => ({ titulo: actividad.titulo, estado: actividad.estado, puntos: actividad.puntos, posibles: actividad.posibles })) });
    let webp = await sharp(imagenSvg).webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (webp.data.byteLength > MAXIMO_CAPTURA_BYTES) webp = await sharp(imagenSvg).webp({ quality: 68, effort: 6 }).toBuffer({ resolveWithObject: true });
    if (webp.data.byteLength > MAXIMO_CAPTURA_BYTES) throw new Error('La ficha de promedio excede el límite de almacenamiento permitido.');
    const capturaHash = createHash('sha256').update(webp.data).digest('hex');
    try {
      await prisma.historialClassroomCorte.create({ data: {
      docenteId: params.docenteId, periodoId: params.periodoId, alumnoId: grupo.alumnoId, corte: grupo.corte,
      snapshotHash, promedioSobre10: promedio, estado, puntosObtenidos: puntos, puntosPosibles: posibles,
      actividades: JSON.stringify(actividadesCompactas), capturaWebp: webp.data, capturaHash,
      capturaBytes: webp.data.byteLength, capturaWidth: webp.info.width, capturaHeight: webp.info.height,
        importacionId: params.importacionId, capturadoPor: params.docenteId, createdAt: generadoEn
      } });
      guardados += 1;
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
  }
  return guardados;
}

export async function listarSnapshotsClassroomCorte(params: { docenteId: string; periodoId: string; alumnoId: string; corte: number; cursor?: string; limite: number }) {
  const alumno = await prisma.alumno.findFirst({ where: { id: params.alumnoId, periodoId: params.periodoId, periodo: { docenteId: params.docenteId } }, select: { id: true } });
  if (!alumno) return null;
  const filas = await prisma.historialClassroomCorte.findMany({
    where: { docenteId: params.docenteId, periodoId: params.periodoId, alumnoId: params.alumnoId, corte: params.corte },
    select: { id: true, corte: true, promedioSobre10: true, estado: true, puntosObtenidos: true, puntosPosibles: true, actividades: true, capturaHash: true, capturaBytes: true, capturaWidth: true, capturaHeight: true, importacionId: true, capturadoPor: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: params.limite + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {})
  });
  const hayMas = filas.length > params.limite;
  return { eventos: filas.slice(0, params.limite), nextCursor: hayMas ? filas[params.limite - 1]?.id ?? null : null };
}

export async function obtenerCapturaHistorialClassroom(params: { docenteId: string; snapshotId: string }) {
  return prisma.historialClassroomCorte.findFirst({
    where: { id: params.snapshotId, docenteId: params.docenteId },
    select: { id: true, capturaWebp: true, capturaHash: true, capturaBytes: true, capturaWidth: true, capturaHeight: true }
  });
}
