export function obtenerSessionId(clave: string) {
  const existente = sessionStorage.getItem(clave);
  if (existente) return existente;

  let nuevo = '';
  try {
    // Navegadores modernos.
    const cryptoGlobal = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoGlobal?.randomUUID) {
      nuevo = String(cryptoGlobal.randomUUID());
    }
  } catch {
    // Ignorar.
  }

  if (!nuevo) {
    nuevo = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  sessionStorage.setItem(clave, nuevo);
  return nuevo;
}
