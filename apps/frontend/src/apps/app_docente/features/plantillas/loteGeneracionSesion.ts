const CLAVE_LOTE_PENDIENTE = 'evaluapro.plantillas.lote-pendiente.v1';

function clavePorPlantilla(plantillaId: string) {
  return `${CLAVE_LOTE_PENDIENTE}:${String(plantillaId).trim()}`;
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
