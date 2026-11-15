const CLAVE_LOTE_PENDIENTE = 'evaluapro.plantillas.lote-pendiente.v1';

export type ProgresoLoteGeneracion = {
  loteId: string;
  claveRecuperacion?: string;
  totalEsperado: number;
  generados: number;
  porcentaje: number;
  completado: boolean;
  estado: 'validando' | 'iniciando' | 'generando' | 'completado' | 'fallido' | 'archivado';
  loteRegistrado?: boolean;
  artefactoVerificado?: boolean;
  pdfSha256?: string;
  totalPaginas?: number;
};

export type LotePdfArchivadoResumen = {
  loteId: string;
  plantillaId: string;
  totalExamenes: number;
  totalPaginas: number;
  archivado: true;
  archivadoEn: string;
};

function clavePorPlantilla(plantillaId: string) {
  return `${CLAVE_LOTE_PENDIENTE}:${String(plantillaId).trim()}`;
}

export function crearClaveLoteGeneracion(
  plantillaId: string,
  tipoExamen?: 'extraordinario',
  alumnoIds: string[] = [],
  grupo?: string,
  varianteCompartida = false
) {
  if (tipoExamen !== 'extraordinario') {
    const clave = grupo ? `${plantillaId}:grupo:${encodeURIComponent(grupo.trim())}` : plantillaId;
    return varianteCompartida ? `${clave}:variant:shared` : clave;
  }
  return `${plantillaId}:extraordinario:${[...alumnoIds].sort().join(',')}`;
}

export function leerLotePendiente(plantillaId: string, almacenamiento?: Storage): string | null {
  try {
    return (almacenamiento ?? window.localStorage).getItem(clavePorPlantilla(plantillaId))?.trim() || null;
  } catch {
    return null;
  }
}

export function guardarLotePendiente(plantillaId: string, loteId: string | null, almacenamiento?: Storage) {
  try {
    const clave = clavePorPlantilla(plantillaId);
    const storage = almacenamiento ?? window.localStorage;
    if (loteId) storage.setItem(clave, loteId);
    else storage.removeItem(clave);
  } catch {
    // La generación aún puede reanudarse desde el estado de la vista actual.
  }
}

export function validarResumenLoteGenerado(
  resumen: { totalPaginas?: unknown; paginasPorExamen?: unknown; pdfSha256?: unknown; lotePdfUrl?: unknown; examenesGenerados?: unknown[] },
  totalAlumnos: number,
  paginasMaximasPorExamen: number
) {
  const paginasPorExamen = Number(resumen.paginasPorExamen);
  const paginasEsperadas = totalAlumnos * paginasPorExamen;
  if (!Number.isInteger(totalAlumnos) || totalAlumnos < 1 || !Number.isInteger(paginasMaximasPorExamen) || paginasMaximasPorExamen < 1) {
    throw new Error('No se pudo verificar el tamaño esperado del paquete. Revisa grupo y plantilla antes de reintentar.');
  }
  if (!Number.isInteger(paginasPorExamen) || paginasPorExamen < 1 || paginasPorExamen > paginasMaximasPorExamen) {
    throw new Error(`El lote reportó ${String(resumen.paginasPorExamen ?? 'sin dato')} páginas por examen; el máximo es ${paginasMaximasPorExamen}.`);
  }
  if (Number(resumen.totalPaginas) !== paginasEsperadas) {
    throw new Error(`El lote reportó ${String(resumen.totalPaginas ?? 'sin dato')} páginas; se esperaban ${paginasEsperadas}. No se marcará como listo.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(String(resumen.pdfSha256 ?? ''))) {
    throw new Error('El servidor no devolvió una huella SHA-256 válida del PDF consolidado. El lote no se marcará como listo.');
  }
  if (resumen.examenesGenerados?.length !== totalAlumnos) {
    throw new Error('El número de exámenes del paquete no coincide con el grupo. No se marcará como listo.');
  }
  if (!/^\/examenes\/generados\/lote\/[^/]+\/pdf$/.test(String(resumen.lotePdfUrl ?? ''))) {
    throw new Error('El servidor no devolvió una ruta válida para descargar el paquete. No se marcará como listo.');
  }
}

export function validarLoteListoParaDescarga(
  respuesta: {
    loteId?: unknown;
    totalAlumnos?: unknown;
    totalPaginas?: unknown;
    paginasPorExamen?: unknown;
    pdfSha256?: unknown;
    lotePdfUrl?: unknown;
    variantPolicy?: unknown;
    examenesGenerados?: unknown[];
  },
  progreso: {
    loteId?: unknown;
    estado?: unknown;
    completado?: unknown;
    loteRegistrado?: unknown;
    artefactoVerificado?: unknown;
    totalEsperado?: unknown;
    generados?: unknown;
    totalPaginas?: unknown;
    pdfSha256?: unknown;
  },
  esperado: { loteId: string; totalAlumnos: number; paginasMaximasPorExamen: number; variantPolicy?: 'unique' | 'shared' }
) {
  const loteRespuesta = String(respuesta.loteId ?? '').trim();
  if (loteRespuesta.toUpperCase() !== esperado.loteId.toUpperCase()) {
    throw new Error('El servidor respondió con otro identificador de lote. No se marcará como listo.');
  }
  if (Number(respuesta.totalAlumnos) !== esperado.totalAlumnos) {
    throw new Error(`El servidor reportó ${String(respuesta.totalAlumnos ?? 'sin dato')} exámenes para un grupo de ${esperado.totalAlumnos} alumnos. No se marcará como listo.`);
  }
  if (esperado.variantPolicy && respuesta.variantPolicy !== esperado.variantPolicy) {
    throw new Error('El servidor no confirmó la política de variantes seleccionada para este lote.');
  }
  validarResumenLoteGenerado(respuesta, esperado.totalAlumnos, esperado.paginasMaximasPorExamen);
  if (!progresoConfirmaArtefactoCompleto(progreso, respuesta, esperado)) {
    throw new Error('La API no confirmó el estado completo, el artefacto íntegro y la huella del mismo lote. Se conserva el ID para recuperar; no se ofrecerá la descarga.');
  }
}

function progresoConfirmaArtefactoCompleto(
  progreso: { loteId?: unknown; estado?: unknown; completado?: unknown; loteRegistrado?: unknown; artefactoVerificado?: unknown; totalEsperado?: unknown; generados?: unknown; totalPaginas?: unknown; pdfSha256?: unknown },
  respuesta: { totalPaginas?: unknown; pdfSha256?: unknown },
  esperado: { loteId: string; totalAlumnos: number }
) {
  return [
    String(progreso.loteId ?? '').toUpperCase() === esperado.loteId.toUpperCase(),
    progreso.estado === 'completado',
    progreso.completado === true,
    progreso.loteRegistrado === true,
    progreso.artefactoVerificado === true,
    Number(progreso.totalEsperado) === esperado.totalAlumnos,
    Number(progreso.generados) === esperado.totalAlumnos,
    Number(progreso.totalPaginas) === Number(respuesta.totalPaginas),
    String(progreso.pdfSha256 ?? '').toLowerCase() === String(respuesta.pdfSha256 ?? '').toLowerCase()
  ].every(Boolean);
}

export function validarRegistroLoteEnHistorial(
  lote: {
    loteId?: unknown;
    plantillaId?: unknown;
    sha256?: unknown;
    totalPaginas?: unknown;
    totalExamenes?: unknown;
    archivado?: unknown;
  } | null | undefined,
  esperado: {
    loteId: string;
    plantillaId: string;
    totalExamenes: number;
    totalPaginas: number;
    sha256: string;
  }
) {
  if (!lote) {
    throw new Error('La API no confirmó el lote en el historial. Se conserva el mismo identificador para recuperar o reintentar; no se ofrecerá el PDF como generado.');
  }
  if (String(lote.loteId ?? '').trim().toUpperCase() !== esperado.loteId.trim().toUpperCase()) {
    throw new Error('El historial devolvió otro identificador de lote. No se marcará como listo.');
  }
  if (String(lote.plantillaId ?? '') !== esperado.plantillaId) {
    throw new Error('El lote del historial no corresponde a la plantilla seleccionada. No se marcará como listo.');
  }
  if (lote.archivado) {
    throw new Error('El lote aparece archivado en el historial. Restáuralo antes de descargarlo.');
  }
  if (Number(lote.totalExamenes) !== esperado.totalExamenes) {
    throw new Error(`El historial registra ${String(lote.totalExamenes ?? 'sin dato')} exámenes; se esperaban ${esperado.totalExamenes}. No se marcará como listo.`);
  }
  if (Number(lote.totalPaginas) !== esperado.totalPaginas) {
    throw new Error(`El historial registra ${String(lote.totalPaginas ?? 'sin dato')} páginas; se esperaban ${esperado.totalPaginas}. No se marcará como listo.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(String(lote.sha256 ?? '')) || String(lote.sha256).toLowerCase() !== esperado.sha256.toLowerCase()) {
    throw new Error('La huella del lote en el historial no coincide con la respuesta de generación. No se marcará como listo.');
  }
}

type PaginaHistorialLotes = {
  lotes?: Array<{
    loteId?: unknown;
    plantillaId?: unknown;
    sha256?: unknown;
    totalPaginas?: unknown;
    totalExamenes?: unknown;
    archivado?: unknown;
  }>;
  nextCursor?: string | null;
};

export async function confirmarLoteEnHistorial(
  esperado: {
    loteId: string;
    plantillaId: string;
    totalExamenes: number;
    totalPaginas: number;
    sha256: string;
  },
  consultarPagina: (ruta: string) => Promise<PaginaHistorialLotes>
) {
  let cursor: string | undefined;
  const cursoresVistos = new Set<string>();
  do {
    const query = new URLSearchParams({
      plantillaId: esperado.plantillaId,
      archivado: 'false',
      limite: '100'
    });
    if (cursor) query.set('cursor', cursor);
    const pagina = await consultarPagina(`/examenes/generados/lotes?${query.toString()}`);
    const registro = (Array.isArray(pagina?.lotes) ? pagina.lotes : []).find(
      (lote) => String(lote.loteId ?? '').trim().toUpperCase() === esperado.loteId.trim().toUpperCase()
    );
    if (registro) {
      validarRegistroLoteEnHistorial(registro, esperado);
      return registro;
    }
    cursor = String(pagina?.nextCursor ?? '').trim() || undefined;
    if (cursor && cursoresVistos.has(cursor)) {
      throw new Error('La paginación del historial repitió un cursor. No se marcará el lote como listo.');
    }
    if (cursor) cursoresVistos.add(cursor);
  } while (cursor);

  validarRegistroLoteEnHistorial(null, esperado);
}
