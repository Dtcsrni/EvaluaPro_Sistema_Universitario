import type { ContextoCalificacionManual, RevisionExamenOmr } from './tipos';

export type CapturaRevisionManual = { numeroPagina: number; imagenBase64: string; preguntas: number[] };

export type PaginaIngestaParaCalificacionManual = {
  pageIndex: number;
  scanStatus: string;
  examId?: string;
  folio?: string;
  examPage?: number;
  identitySource?: string;
  identityResult?: { studentId?: unknown } | null;
  sourceFileName?: string;
};

export type PaginaCapturaManualIngesta = {
  pageIndex: number;
  numeroPagina: number;
  nombreArchivo?: string;
};

export type CalificacionManualDesdeIngesta = {
  examenId: string;
  folio: string;
  alumnoId: string;
  paginas: Array<{ numeroPagina: number; imagenBase64: string; nombreArchivo?: string }>;
};

export type AsociacionManualIngesta =
  | { ok: true; examenId: string; folio: string; alumnoId: string; paginas: PaginaCapturaManualIngesta[] }
  | { ok: false; motivo: string };

function validarExamenParaAsociacion(examen: { id: unknown; folio: unknown; pages: unknown }) {
  const examenId = String(examen.id ?? '').trim();
  const folio = String(examen.folio ?? '').trim().toUpperCase();
  const paginas = Array.isArray(examen.pages) ? examen.pages.map(Number) : [];
  if (!examenId || !folio || !paginas.length || paginas.some((numero) => !Number.isSafeInteger(numero) || numero < 1)) {
    return { ok: false as const, motivo: 'El examen no tiene identidad o páginas esperadas válidas.' };
  }
  if (new Set(paginas).size !== paginas.length) {
    return { ok: false as const, motivo: 'La lista de páginas esperadas contiene duplicados.' };
  }
  return { ok: true as const, examenId, folio, paginas };
}

function validarPaginaIngesta({
  pagina,
  examenId,
  folio,
  paginasEsperadas,
  numerosVistos,
  indicesOrigenVistos,
  alumnoId
}: {
  pagina: PaginaIngestaParaCalificacionManual;
  examenId: string;
  folio: string;
  paginasEsperadas: number[];
  numerosVistos: Set<number>;
  indicesOrigenVistos: Set<number>;
  alumnoId: string;
}) {
  const numeroPagina = Number(pagina.examPage);
  const identidadAlumno = String(pagina.identityResult?.studentId ?? '').trim();
  if (String(pagina.examId ?? '').trim() !== examenId || String(pagina.folio ?? '').trim().toUpperCase() !== folio) {
    return { ok: false as const, motivo: 'Hay una página con folio o examen distinto.' };
  }
  if (pagina.scanStatus !== 'accepted' || pagina.identitySource !== 'qr') {
    return { ok: false as const, motivo: 'Todas las páginas deben tener QR firmado aceptado por el servidor.' };
  }
  if (!Number.isSafeInteger(pagina.pageIndex) || pagina.pageIndex < 1 || !paginasEsperadas.includes(numeroPagina)) {
    return { ok: false as const, motivo: 'Una página no coincide con el índice de origen o la paginación del examen.' };
  }
  if (numerosVistos.has(numeroPagina)) {
    return { ok: false as const, motivo: `La página ${numeroPagina} aparece más de una vez.` };
  }
  if (indicesOrigenVistos.has(pagina.pageIndex)) {
    return { ok: false as const, motivo: `La página de origen ${pagina.pageIndex} aparece más de una vez.` };
  }
  if (!identidadAlumno || (alumnoId && alumnoId !== identidadAlumno)) {
    return { ok: false as const, motivo: 'Las páginas no comparten una identidad de alumno verificable.' };
  }
  return { ok: true as const, numeroPagina, identidadAlumno };
}

/** Solo habilita calificación manual cuando QR, folio, alumno y cobertura de páginas coinciden. */
export function asociarPaginasIngestaParaManual(
  examen: { id: unknown; folio: unknown; pages: unknown },
  paginasJob: PaginaIngestaParaCalificacionManual[]
): AsociacionManualIngesta {
  const esperado = validarExamenParaAsociacion(examen);
  if (!esperado.ok) return esperado;
  const { examenId, folio, paginas: paginasEsperadas } = esperado;

  const paginasRelacionadas = paginasJob.filter((pagina) =>
    String(pagina.examId ?? '').trim() === examenId || String(pagina.folio ?? '').trim().toUpperCase() === folio
  );
  if (paginasRelacionadas.length !== paginasEsperadas.length) {
    return { ok: false, motivo: 'La cantidad de páginas asociadas no coincide con el examen generado.' };
  }

  const numerosVistos = new Set<number>();
  const indicesOrigenVistos = new Set<number>();
  let alumnoId = '';
  const paginas = [] as PaginaCapturaManualIngesta[];
  for (const pagina of paginasRelacionadas) {
    const validacion = validarPaginaIngesta({ pagina, examenId, folio, paginasEsperadas, numerosVistos, indicesOrigenVistos, alumnoId });
    if (!validacion.ok) return validacion;
    alumnoId = validacion.identidadAlumno;
    numerosVistos.add(validacion.numeroPagina);
    indicesOrigenVistos.add(pagina.pageIndex);
    paginas.push({
      pageIndex: pagina.pageIndex,
      numeroPagina: validacion.numeroPagina,
      ...(pagina.sourceFileName ? { nombreArchivo: pagina.sourceFileName } : {})
    });
  }
  if (paginasEsperadas.some((numero) => !numerosVistos.has(numero))) {
    return { ok: false, motivo: 'Falta al menos una página esperada del examen.' };
  }
  return {
    ok: true,
    examenId,
    folio,
    alumnoId,
    paginas: paginas.sort((a, b) => a.numeroPagina - b.numeroPagina)
  };
}

export function identidadExamenManual(
  examen: { _id?: unknown; folio?: unknown; alumnoId?: unknown },
  seleccionado: { _id: string; folio: string; alumnoId?: string | null },
  alumnoManualId: string
) {
  return {
    examenId: String(examen._id ?? seleccionado._id).trim(),
    folio: String(examen.folio ?? seleccionado.folio).trim().toUpperCase(),
    alumnoId: String(examen.alumnoId ?? seleccionado.alumnoId ?? alumnoManualId).trim()
  };
}

export function paginasExamenManual(examen: unknown) {
  const paginas = (examen as { paginas?: unknown } | null)?.paginas;
  if (!Array.isArray(paginas)) return [];
  return paginas
    .map((pagina) => ({
      numeroPagina: Number((pagina as { numero?: unknown })?.numero),
      preguntasDel: Number((pagina as { preguntasDel?: unknown })?.preguntasDel),
      preguntasAl: Number((pagina as { preguntasAl?: unknown })?.preguntasAl)
    }))
    .filter((pagina) => Number.isInteger(pagina.numeroPagina) && pagina.numeroPagina > 0);
}

export function etiquetarTipoExamenManual(tipo?: string | null, titulo?: string | null) {
  const valor = String(tipo ?? '').trim().toLowerCase();
  if (valor === 'extraordinario') return 'Extraordinario';
  const etiqueta = String(titulo ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const texto = `${etiqueta} ${valor}`.trim();
  if (texto.includes('global') || texto.includes('final') || valor === 'global') return 'Global final';
  if (/(?:parcial|p)\s*(?:2|ii)\b/.test(texto) || /\b(?:segundo|segunda|dos)\s+parcial\b/.test(texto) || /\b2(?:do|da|ndo|nda)\s+parcial\b/.test(texto)) return 'Parcial 2';
  if (/(?:parcial|p)\s*(?:1|i)\b/.test(texto) || /\b(?:primer|primero|primera|uno)\s+parcial\b/.test(texto) || /\b1(?:er|ro|ra)\s+parcial\b/.test(texto)) return 'Parcial 1';
  if (valor === 'parcial') return 'Parcial';
  return '';
}

export function etiquetaExamenParaSelectorManual(
  examen: { folio?: string | null; tipoExamen?: string | null; plantillaTitulo?: string | null },
  tipoPlantilla?: string | null,
  tituloPlantilla?: string | null
) {
  const titulo = String(examen.plantillaTitulo ?? '').trim() || String(tituloPlantilla ?? '').trim();
  const tipoExamen = String(examen.tipoExamen ?? '').trim() || String(tipoPlantilla ?? '').trim();
  const tipo = etiquetarTipoExamenManual(tipoExamen, titulo)
    || etiquetarTipoExamenManual(tipoPlantilla, tituloPlantilla);
  return [examen.folio, tipo, titulo, 'captura vinculada']
    .map((valor) => String(valor ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

function coincideIdentidadExamenManual(
  item: RevisionExamenOmr,
  identidad: { examenId: string; folio: string; alumnoId: string }
) {
  return String(item.examenId ?? '').trim() === String(identidad.examenId ?? '').trim() &&
    String(item.folio ?? '').trim().toUpperCase() === String(identidad.folio ?? '').trim().toUpperCase() &&
    String(item.alumnoId ?? '').trim() === String(identidad.alumnoId ?? '').trim();
}

export function tieneCapturaManualVinculada(
  revisiones: RevisionExamenOmr[],
  identidad: { examenId: string; folio: string; alumnoId: string }
) {
  return revisiones.some((item) => coincideIdentidadExamenManual(item, identidad) &&
    Array.isArray(item.paginas) && item.paginas.some((pagina) => String(pagina.imagenBase64 ?? '').trim().length > 0));
}

export function filtrarExamenesConCapturaManual<T extends { _id?: unknown; folio?: unknown; alumnoId?: unknown; estado?: unknown }>(
  examenes: T[],
  revisiones: RevisionExamenOmr[],
  alumnoManualId: string
) {
  return examenes.filter((item) => {
    const examenId = String(item._id ?? '').trim();
    const folio = String(item.folio ?? '').trim();
    const alumnoId = String(item.alumnoId ?? '').trim();
    return Boolean(examenId && folio && alumnoId && alumnoId === String(alumnoManualId ?? '').trim()) &&
      String(item.estado ?? '').trim().toLowerCase() !== 'calificado' &&
      tieneCapturaManualVinculada(revisiones, { examenId, folio, alumnoId });
  });
}

export function asociarCapturasRevisionManual(
  revisiones: RevisionExamenOmr[],
  identidad: { examenId: string; folio: string; alumnoId: string },
  paginasEsperadas: Array<{ numeroPagina: number; preguntasDel?: number; preguntasAl?: number }>
): { paginas: CapturaRevisionManual[]; faltantes: number[]; identidadEncontrada: boolean; revision: RevisionExamenOmr | null } {
  const examenId = String(identidad.examenId ?? '').trim();
  const folio = String(identidad.folio ?? '').trim().toUpperCase();
  const alumnoId = String(identidad.alumnoId ?? '').trim();
  const revision = revisiones.find((item) => coincideIdentidadExamenManual(item, { examenId, folio, alumnoId }));
  const metadataPorPagina = new Map(paginasEsperadas.map((pagina) => [pagina.numeroPagina, pagina]));
  const paginas = (revision?.paginas ?? [])
    .map((pagina) => ({
      numeroPagina: Number(pagina.numeroPagina),
      imagenBase64: String(pagina.imagenBase64 ?? '').trim(),
      preguntas: (() => {
        const metadata = metadataPorPagina.get(Number(pagina.numeroPagina));
        if (!metadata || !Number.isInteger(metadata.preguntasDel) || !Number.isInteger(metadata.preguntasAl) || Number(metadata.preguntasAl) < Number(metadata.preguntasDel)) return [];
        return Array.from({ length: Number(metadata.preguntasAl) - Number(metadata.preguntasDel) + 1 }, (_item, index) => Number(metadata.preguntasDel) + index);
      })()
    }))
    .filter((pagina) => Number.isInteger(pagina.numeroPagina) && pagina.numeroPagina > 0 && pagina.imagenBase64)
    .sort((a, b) => a.numeroPagina - b.numeroPagina);
  const numerosConCaptura = new Set(paginas.map((pagina) => pagina.numeroPagina));
  return {
    paginas,
    faltantes: paginasEsperadas.map((pagina) => pagina.numeroPagina).filter((numero) => !numerosConCaptura.has(numero)),
    identidadEncontrada: Boolean(revision),
    revision: revision ?? null
  };
}

export function actualizarRespuestaManual(
  contexto: ContextoCalificacionManual | null,
  numeroPregunta: number,
  opcion: string | null | undefined
): ContextoCalificacionManual | null {
  if (!contexto || contexto.soloLectura) return contexto;
  return {
    ...contexto,
    respuestasDetectadas: contexto.respuestasDetectadas.map((respuesta) =>
      respuesta.numeroPregunta === numeroPregunta
        ? {
            ...respuesta,
            opcion: opcion ?? null,
            estadoRespuesta: opcion === undefined ? 'manual_review' : opcion === null ? 'sin_marca' : 'respondida'
          }
        : respuesta
    )
  };
}
