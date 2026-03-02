import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export type ImagenPreguntaResuelta = {
  dataUrl?: string;
  widthPx?: number;
  heightPx?: number;
  mime?: string;
  status: 'ok' | 'fallback' | 'error' | 'none';
};

function esDataUrl(valor: string): boolean {
  return /^data:image\//i.test(valor);
}

function mimeDesdeDataUrl(valor: string): string | undefined {
  const match = /^data:(image\/[^;]+);base64,/i.exec(valor);
  return match?.[1]?.toLowerCase();
}

async function bufferDesdeFuente(imagenUrl: string): Promise<{ buffer: Buffer; mime?: string }> {
  if (esDataUrl(imagenUrl)) {
    const mime = mimeDesdeDataUrl(imagenUrl);
    const data = imagenUrl.replace(/^data:image\/[^;]+;base64,/i, '');
    return { buffer: Buffer.from(data, 'base64'), mime };
  }

  if (/^https?:\/\//i.test(imagenUrl)) {
    const res = await fetch(imagenUrl);
    if (!res.ok) throw new Error(`No se pudo descargar imagen remota: ${res.status}`);
    const arr = await res.arrayBuffer();
    return { buffer: Buffer.from(arr), mime: res.headers.get('content-type') ?? undefined };
  }

  const abs = path.isAbsolute(imagenUrl)
    ? imagenUrl
    : path.resolve(process.cwd(), imagenUrl);
  const buffer = await fs.readFile(abs);
  return { buffer };
}

export async function resolverImagenPregunta(
  imagenUrl?: string,
  options?: { preserveTransparency?: boolean }
): Promise<ImagenPreguntaResuelta> {
  if (!imagenUrl?.trim()) return { status: 'none' };

  try {
    const { buffer, mime } = await bufferDesdeFuente(imagenUrl.trim());
    const preserveTransparency = options?.preserveTransparency === true;
    const normalizada = preserveTransparency
      ? sharp(buffer, { animated: false }).rotate()
      : sharp(buffer, { animated: false }).rotate().flatten({ background: '#ffffff' });
    const metadata = await normalizada.metadata();
    const pngBuffer = await normalizada.png({ compressionLevel: 9 }).toBuffer();

    return {
      dataUrl: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      widthPx: metadata.width ?? undefined,
      heightPx: metadata.height ?? undefined,
      mime: mime ?? 'image/png',
      status: 'ok'
    };
  } catch {
    return { status: 'error' };
  }
}
