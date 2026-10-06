const CLAVE_FOTO_PERFIL = 'evaluapro:foto-perfil-docente:';
export const EVENTO_FOTO_PERFIL_DOCENTE = 'evaluapro:foto-perfil-docente-actualizada';
export const MAX_FOTO_PERFIL_BYTES = 1024 * 1024;

export function esFotoPerfilValida(valor: string): boolean {
  const coincidencia = String(valor || '').trim().match(/^data:image\/(?:png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i);
  return Boolean(coincidencia && coincidencia[1].length % 4 === 0);
}

function claveFoto(docenteId: string): string {
  return `${CLAVE_FOTO_PERFIL}${encodeURIComponent(String(docenteId || '').trim())}`;
}

export function obtenerFotoPerfilLocal(docenteId: string): string | null {
  if (!docenteId || typeof localStorage === 'undefined') return null;
  try {
    const valor = localStorage.getItem(claveFoto(docenteId));
    return valor && esFotoPerfilValida(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function guardarFotoPerfilLocal(docenteId: string, valor: string): void {
  if (!docenteId) throw new Error('No se puede asociar la imagen sin un ID de docente.');
  if (!esFotoPerfilValida(valor)) throw new Error('La imagen debe ser PNG, JPG o WebP.');
  const base64 = valor.slice(valor.indexOf(',') + 1).replace(/=+$/, '');
  const bytesEstimados = Math.floor(base64.length * 3 / 4);
  if (bytesEstimados > MAX_FOTO_PERFIL_BYTES) throw new Error('La imagen no puede superar 1 MB.');
  localStorage.setItem(claveFoto(docenteId), valor);
}

export function eliminarFotoPerfilLocal(docenteId: string): void {
  if (!docenteId || typeof localStorage === 'undefined') return;
  localStorage.removeItem(claveFoto(docenteId));
}
