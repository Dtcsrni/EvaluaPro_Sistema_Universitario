/**
 * sesion
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
export function obtenerSessionId(clave: string) {
  const existente = sessionStorage.getItem(clave);
  if (existente) return existente;

  let nuevo = '';
  try {
    const cryptoGlobal = (globalThis as unknown as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      };
    }).crypto;
    if (cryptoGlobal?.randomUUID) {
      nuevo = String(cryptoGlobal.randomUUID());
    } else if (cryptoGlobal?.getRandomValues) {
      const bytes = cryptoGlobal.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      nuevo = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Ignorar.
  }

  if (!nuevo) {
    nuevo = `${Date.now()}-${++secuenciaSesion}`;
  }

  sessionStorage.setItem(clave, nuevo);
  return nuevo;
}

let secuenciaSesion = 0;
