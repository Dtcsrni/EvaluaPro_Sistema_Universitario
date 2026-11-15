type RespuestaOmrPuntuable = {
  opcion: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  estadoRespuesta?: string;
  flags?: readonly string[];
};

const ESTADOS_INCORRECTOS_OMR = new Set(['sin_marca', 'ambigua', 'doble_marca', 'tachada']);
const FLAGS_INVALIDANTES_OMR = new Set(['doble_marca', 'tachada_detectada']);

/** Una lectura sin opción inequívoca siempre aporta cero aciertos. */
export function obtenerOpcionPuntuableOmr(respuesta: RespuestaOmrPuntuable) {
  if (
    respuesta.opcion == null ||
    ESTADOS_INCORRECTOS_OMR.has(String(respuesta.estadoRespuesta ?? '')) ||
    respuesta.flags?.some((flag) => FLAGS_INVALIDANTES_OMR.has(flag))
  ) return null;
  return respuesta.opcion;
}

/** Solo falta revisión cuando no existe el reactivo o queda una candidata no resuelta. */
export function omrRequiereResolucionManual(respuesta?: RespuestaOmrPuntuable) {
  if (!respuesta) return true;
  if (obtenerOpcionPuntuableOmr(respuesta) === null) return false;
  const marcasSinResolver = respuesta.flags?.filter((flag) =>
    !(respuesta.estadoRespuesta === 'respondida' && flag === 'parcial_detectada')
  );
  return (respuesta.estadoRespuesta !== undefined && respuesta.estadoRespuesta !== 'respondida') ||
    Boolean(marcasSinResolver?.length);
}
