/** Clasificación explicita de respuestas y de hojas OMR. */

export type EstadoRespuestaOmr =
  | 'respondida'
  | 'sin_marca'
  | 'ambigua'
  | 'doble_marca'
  | 'tachada';

export type ResumenRespuestasOmr = {
  totalReactivos: number;
  reactivosRespondidos: number;
  reactivosSinMarca: number;
  reactivosAmbiguos: number;
  reactivosInvalidos: number;
  examenVacio: boolean;
  examenVacioProbable: boolean;
  estadoExamen: 'vacio_confirmado' | 'vacio_probable' | 'con_respuestas' | 'requiere_revision';
};

type RespuestaClasificable = {
  opcion: string | null;
  flags: readonly string[];
  confianza?: number;
  estadoRespuesta?: EstadoRespuestaOmr;
};

export function clasificarEstadoRespuestaOmr(
  respuesta: RespuestaClasificable,
  opciones: { forzarRevision?: boolean } = {}
): EstadoRespuestaOmr {
  if (respuesta.flags.includes('tachada_detectada')) return 'tachada';
  if (respuesta.flags.includes('doble_marca')) return 'doble_marca';
  if (respuesta.opcion != null) return 'respondida';
  if (opciones.forzarRevision) return 'ambigua';
  if (
    respuesta.flags.includes('bajo_contraste') ||
    respuesta.flags.includes('fuera_roi') ||
    respuesta.flags.includes('parcial_detectada')
  ) {
    return 'ambigua';
  }
  return 'sin_marca';
}

export function resumirRespuestasOmr(
  respuestas: readonly RespuestaClasificable[],
  calidadPagina: number,
  geomQuality: number,
  opciones: { forzarRevision?: boolean } = {}
): ResumenRespuestasOmr {
  const estados = respuestas.map((respuesta) =>
    clasificarEstadoRespuestaOmr(respuesta, opciones)
  );
  const totalReactivos = estados.length;
  const reactivosRespondidos = estados.filter((estado) => estado === 'respondida').length;
  const reactivosSinMarca = estados.filter((estado) => estado === 'sin_marca').length;
  const reactivosAmbiguos = estados.filter((estado) => estado === 'ambigua').length;
  const reactivosInvalidos = estados.filter((estado) => estado === 'doble_marca' || estado === 'tachada').length;
  const calidadApta = Number.isFinite(calidadPagina) && calidadPagina >= 0.55;
  const geometriaApta = Number.isFinite(geomQuality) && geomQuality >= 0.65;
  const tieneRespuestaFuerte = respuestas.some((respuesta, indice) => {
    const estado = estados[indice];
    const tieneAdvertencia = respuesta.flags.some((flag) =>
      ['bajo_contraste', 'parcial_detectada', 'fuera_roi'].includes(flag)
    );
    return estado === 'respondida' && !tieneAdvertencia && Number(respuesta.confianza ?? 0) >= 0.72;
  });
  const examenVacio =
    totalReactivos > 0 &&
    reactivosRespondidos === 0 &&
    reactivosSinMarca === totalReactivos &&
    reactivosAmbiguos === 0 &&
    reactivosInvalidos === 0 &&
    calidadApta &&
    geometriaApta &&
    !opciones.forzarRevision;
  const predominanBlancosSinLetraEmitida =
    reactivosRespondidos === 0 &&
    reactivosSinMarca >= Math.ceil(totalReactivos * 0.25) &&
    reactivosInvalidos <= Math.max(1, Math.ceil(totalReactivos * 0.05)) &&
    calidadApta &&
    geometriaApta;
  const examenVacioProbable =
    !examenVacio &&
    totalReactivos > 0 &&
    !tieneRespuestaFuerte &&
    (predominanBlancosSinLetraEmitida || (
      reactivosRespondidos > 0 &&
      reactivosSinMarca >= Math.ceil(totalReactivos * 0.5) &&
      reactivosRespondidos <= Math.max(1, Math.ceil(totalReactivos * 0.1))
    )) &&
    reactivosRespondidos + reactivosSinMarca + reactivosAmbiguos + reactivosInvalidos === totalReactivos;

  return {
    totalReactivos,
    reactivosRespondidos,
    reactivosSinMarca,
    reactivosAmbiguos,
    reactivosInvalidos,
    examenVacio,
    examenVacioProbable,
    estadoExamen: examenVacio
      ? 'vacio_confirmado'
      : examenVacioProbable
        ? 'vacio_probable'
        : reactivosRespondidos > 0 && !tieneRespuestaFuerte
          ? 'requiere_revision'
        : reactivosRespondidos > 0
          ? 'con_respuestas'
          : 'requiere_revision'
  };
}
