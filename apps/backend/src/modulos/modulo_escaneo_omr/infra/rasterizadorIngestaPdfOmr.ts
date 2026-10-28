import { rasterizarPdfParaPreview, type OpcionesRasterizadoPdf, type PaginaPdfPreviewVisual } from '../../modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';

type RasterPdf = { paginas: PaginaPdfPreviewVisual[]; paginasTotales: number; paginasOmitidas: number };
type RasterizarPdf = (buffer: Buffer, opciones: OpcionesRasterizadoPdf) => Promise<RasterPdf>;

export async function rasterizarBloqueIngestaOmr(
  buffer: Buffer,
  desdePagina: number,
  cantidadPaginas: number,
  rasterizar: RasterizarPdf = rasterizarPdfParaPreview
) {
  if (!Number.isInteger(desdePagina) || desdePagina < 1 || !Number.isInteger(cantidadPaginas) || cantidadPaginas < 1) {
    throw new RangeError('El bloque OMR requiere página inicial y cantidad de páginas positivas.');
  }
  const paginas = new Map<number, PaginaPdfPreviewVisual>();
  const fallidas = new Set<number>();
  async function rasterizarConSubdivision(inicio: number, cantidad: number): Promise<void> {
    if (Array.from({ length: cantidad }, (_, index) => inicio + index).every((numero) => paginas.has(numero))) return;
    let numerosRecuperados: number[] = [];
    try {
      const bloque = await rasterizar(buffer, { dpi: 144, desdePagina: inicio, cantidadPaginas: cantidad });
      for (const pagina of bloque.paginas) paginas.set(pagina.numero, pagina);
      numerosRecuperados = Array.from({ length: cantidad }, (_, index) => inicio + index)
        .filter((numero) => !paginas.has(numero));
    } catch {
      numerosRecuperados = Array.from({ length: cantidad }, (_, index) => inicio + index);
    }

    if (numerosRecuperados.length === 0) return;
    if (cantidad === 1) {
      fallidas.add(inicio);
      return;
    }
    const mitad = Math.ceil(cantidad / 2);
    await rasterizarConSubdivision(inicio, mitad);
    await rasterizarConSubdivision(inicio + mitad, cantidad - mitad);
  }

  await rasterizarConSubdivision(desdePagina, cantidadPaginas);
  return { paginas, fallidas };
}
