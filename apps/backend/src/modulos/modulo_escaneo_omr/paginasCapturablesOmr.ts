type PaginaMapaOmr = { numeroPagina: number; tipoPagina?: 'examen' | 'reverso-vacio' };

/**
 * Las capturas sueltas representan caras con respuestas; los PDF conservan
 * también sus reversos vacíos para respetar el índice físico del documento.
 */
export function resolverPaginaCapturableOmr(
  paginas: readonly PaginaMapaOmr[],
  indiceCaptura: number,
  sourceType: 'image_batch' | 'camera_capture' | 'pdf'
): PaginaMapaOmr | undefined {
  if (!Number.isInteger(indiceCaptura) || indiceCaptura < 1) return undefined;
  if (sourceType === 'image_batch' || sourceType === 'camera_capture') {
    return paginas.filter((pagina) => pagina.tipoPagina !== 'reverso-vacio')[indiceCaptura - 1];
  }
  return paginas.find((pagina) => pagina.numeroPagina === indiceCaptura);
}
