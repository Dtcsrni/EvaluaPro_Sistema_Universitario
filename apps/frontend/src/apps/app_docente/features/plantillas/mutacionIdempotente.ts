const PREFIJO = 'evaluapro.plantillas.mutacion.v1';

function serializarCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.entries(valor as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, contenido]) => `${JSON.stringify(clave)}:${serializarCanonico(contenido)}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

function almacenamientoPredeterminado(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function obtenerClientRequestIdPlantilla(
  accion: 'crear' | 'actualizar' | 'archivar' | 'eliminar',
  plantillaId: string | null,
  payload: unknown,
  almacenamiento = almacenamientoPredeterminado()
): string {
  const clave = `${PREFIJO}:${accion}:${plantillaId || 'nueva'}`;
  const huellaPayload = serializarCanonico(payload);
  if (almacenamiento) {
    try {
      const previo = JSON.parse(almacenamiento.getItem(clave) || 'null') as { clientRequestId?: unknown; huellaPayload?: unknown } | null;
      if (previo?.huellaPayload === huellaPayload && typeof previo.clientRequestId === 'string') {
        return previo.clientRequestId;
      }
    } catch {
      // Una entrada corrupta se reemplaza con una clave nueva.
    }
  }

  const clientRequestId = globalThis.crypto?.randomUUID?.();
  if (!clientRequestId) throw new Error('Este navegador no puede generar un UUID para guardar la plantilla de forma recuperable.');
  try {
    almacenamiento?.setItem(clave, JSON.stringify({ clientRequestId, huellaPayload }));
  } catch {
    throw new Error('No se pudo guardar el ID de reintento de la plantilla. Libera espacio de almacenamiento y vuelve a intentar.');
  }
  return clientRequestId;
}

export function confirmarClientRequestIdPlantilla(
  accion: 'crear' | 'actualizar' | 'archivar' | 'eliminar',
  plantillaId: string | null,
  clientRequestId: string,
  almacenamiento = almacenamientoPredeterminado()
) {
  const clave = `${PREFIJO}:${accion}:${plantillaId || 'nueva'}`;
  try {
    const actual = JSON.parse(almacenamiento?.getItem(clave) || 'null') as { clientRequestId?: unknown } | null;
    if (actual?.clientRequestId === clientRequestId) almacenamiento?.removeItem(clave);
  } catch {
    // El historial del servidor permanece disponible para reconciliar el resultado.
  }
}
