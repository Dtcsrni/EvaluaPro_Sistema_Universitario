/**
 * Extraccion de capturas OMR para publicacion en portal.
 */
import path from 'node:path';
import { promises as fs } from 'fs';
import sharp from 'sharp';

export async function leerCapturasOmrParaPortal(folio: string): Promise<Array<{
  numeroPagina: number;
  formato: 'webp';
  imagenBase64: string;
  calidad?: number;
  sugerencias?: string[];
}>> {
  const folioSeguro = String(folio || '').trim().toUpperCase();
  if (!folioSeguro) return [];
  const dir = path.resolve(process.cwd(), 'storage', 'omr_scans', folioSeguro);
  let archivos: string[] = [];
  try {
    archivos = await fs.readdir(dir);
  } catch {
    return [];
  }

  const paginas = archivos
    .map((nombre) => ({ nombre, match: /^P(\d+)\.(jpg|jpeg|png|webp)$/i.exec(nombre) }))
    .filter((item) => item.match)
    .map((item) => ({ nombre: item.nombre, numeroPagina: Number(item.match?.[1] ?? 0) }))
    .filter((item) => Number.isInteger(item.numeroPagina) && item.numeroPagina > 0)
    .sort((a, b) => a.numeroPagina - b.numeroPagina)
    .slice(0, 12);

  const resultado: Array<{
    numeroPagina: number;
    formato: 'webp';
    imagenBase64: string;
    calidad?: number;
    sugerencias?: string[];
  }> = [];

  for (const pagina of paginas) {
    try {
      const abs = path.join(dir, pagina.nombre);
      const input = await fs.readFile(abs);
      const meta = await sharp(input).metadata();
      const stats = await sharp(input).stats();
      const contraste = Number(stats.channels?.[0]?.stdev ?? 0);
      const dimensionMenor = Math.min(Number(meta.width ?? 0), Number(meta.height ?? 0));
      const calidad = Math.max(0, Math.min(1, contraste / 48));
      const sugerencias: string[] = [];
      if (dimensionMenor < 900) sugerencias.push('Captura con baja resolucion: acerca la camara y mejora el enfoque.');
      if (contraste < 16) sugerencias.push('Contraste bajo: mejora iluminacion sin reflejos.');
      const webp = await sharp(input)
        .rotate()
        .resize({ width: 1100, withoutEnlargement: true })
        .webp({ quality: 62 })
        .toBuffer();
      resultado.push({
        numeroPagina: pagina.numeroPagina,
        formato: 'webp',
        imagenBase64: webp.toString('base64'),
        calidad,
        sugerencias
      });
    } catch {
      // best-effort
    }
  }

  return resultado;
}
