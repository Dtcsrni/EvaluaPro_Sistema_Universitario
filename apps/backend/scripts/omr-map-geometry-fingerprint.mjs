import { createHash } from 'node:crypto';

function puntoGeometrico(punto) {
  if (!punto) return null;
  return { x: punto.x ?? null, y: punto.y ?? null };
}

function geometriaFiduciales(fiduciales) {
  if (!fiduciales) return null;
  if ('top' in fiduciales || 'bottom' in fiduciales) {
    return {
      top: puntoGeometrico(fiduciales.top),
      bottom: puntoGeometrico(fiduciales.bottom)
    };
  }
  return {
    leftTop: puntoGeometrico(fiduciales.leftTop),
    leftBottom: puntoGeometrico(fiduciales.leftBottom),
    rightTop: puntoGeometrico(fiduciales.rightTop),
    rightBottom: puntoGeometrico(fiduciales.rightBottom),
    leftMid: puntoGeometrico(fiduciales.leftMid),
    rightMid: puntoGeometrico(fiduciales.rightMid)
  };
}

function proyectarGeometriaMapaOmr(mapaPagina) {
  return {
    numeroPagina: mapaPagina.numeroPagina ?? null,
    templateVersion: mapaPagina.templateVersion ?? null,
    qr: mapaPagina.qr
      ? {
          x: mapaPagina.qr.x,
          y: mapaPagina.qr.y,
          size: mapaPagina.qr.size,
          marginModules: mapaPagina.qr.marginModules ?? null,
          matrixModules: mapaPagina.qr.matrixModules ?? null,
          errorCorrectionLevel: mapaPagina.qr.errorCorrectionLevel ?? null
        }
      : null,
    markerSpec: mapaPagina.markerSpec
      ? {
          family: mapaPagina.markerSpec.family ?? null,
          sizeMm: mapaPagina.markerSpec.sizeMm ?? null,
          quietZoneMm: mapaPagina.markerSpec.quietZoneMm ?? null
        }
      : null,
    marcasPagina: mapaPagina.marcasPagina
      ? {
          tipo: mapaPagina.marcasPagina.tipo ?? null,
          size: mapaPagina.marcasPagina.size ?? null,
          quietZone: mapaPagina.marcasPagina.quietZone ?? null,
          orientacion: mapaPagina.marcasPagina.orientacion
            ? {
                esquina: mapaPagina.marcasPagina.orientacion.esquina,
                tipo: mapaPagina.marcasPagina.orientacion.tipo,
                radio: mapaPagina.marcasPagina.orientacion.radio
              }
            : null,
          tl: puntoGeometrico(mapaPagina.marcasPagina.tl),
          tr: puntoGeometrico(mapaPagina.marcasPagina.tr),
          bl: puntoGeometrico(mapaPagina.marcasPagina.bl),
          br: puntoGeometrico(mapaPagina.marcasPagina.br)
        }
      : null,
    blockSpec: mapaPagina.blockSpec
      ? {
          preguntasPorBloque: mapaPagina.blockSpec.preguntasPorBloque ?? null,
          opcionesPorPregunta: mapaPagina.blockSpec.opcionesPorPregunta ?? null,
          bubbleDiameterMm: mapaPagina.blockSpec.bubbleDiameterMm ?? null,
          bubblePitchYmm: mapaPagina.blockSpec.bubblePitchYmm ?? null,
          bubblePitchXmm: mapaPagina.blockSpec.bubblePitchXmm ?? null,
          orientation: mapaPagina.blockSpec.orientation ?? null
        }
      : null,
    engineHints: mapaPagina.engineHints
      ? {
          preferredEngine: mapaPagina.engineHints.preferredEngine ?? null,
          conservativeDecision: mapaPagina.engineHints.conservativeDecision ?? null,
          forceSimpleScale: mapaPagina.engineHints.forceSimpleScale ?? null,
          useMapCoordinatesStrict: mapaPagina.engineHints.useMapCoordinatesStrict ?? null,
          localSearchRadiusPx: mapaPagina.engineHints.localSearchRadiusPx ?? null
        }
      : null,
    perfilLayout: mapaPagina.perfilLayout
      ? {
          gridStepPt: mapaPagina.perfilLayout.gridStepPt ?? null,
          headerHeightFirst: mapaPagina.perfilLayout.headerHeightFirst ?? null,
          headerHeightOther: mapaPagina.perfilLayout.headerHeightOther ?? null,
          bottomSafePt: mapaPagina.perfilLayout.bottomSafePt ?? null
        }
      : null,
    preguntas: [...(mapaPagina.preguntas ?? [])]
      .sort((a, b) => Number(a.numeroPregunta) - Number(b.numeroPregunta))
      .map((pregunta) => ({
        numeroPregunta: pregunta.numeroPregunta,
        opciones: [...(pregunta.opciones ?? [])]
          .sort((a, b) => String(a.letra).localeCompare(String(b.letra)))
          .map((opcion) => ({ letra: opcion.letra, x: opcion.x, y: opcion.y })),
        cajaOmr: pregunta.cajaOmr
          ? {
              x: pregunta.cajaOmr.x,
              y: pregunta.cajaOmr.y,
              width: pregunta.cajaOmr.width,
              height: pregunta.cajaOmr.height
            }
          : null,
        perfilOmr: pregunta.perfilOmr
          ? {
              radio: pregunta.perfilOmr.radio ?? null,
              pasoY: pregunta.perfilOmr.pasoY ?? null,
              pasoX: pregunta.perfilOmr.pasoX ?? null,
              cajaAncho: pregunta.perfilOmr.cajaAncho ?? null
            }
          : null,
        fiduciales: geometriaFiduciales(pregunta.fiduciales)
      }))
  };
}

/** Huella estable de coordenadas OMR y QR; excluye folio, reactivos y payloads. */
export function crearHuellaGeometriaMapaOmr(mapaPagina) {
  const geometria = proyectarGeometriaMapaOmr(mapaPagina);
  return createHash('sha256').update(JSON.stringify(geometria)).digest('hex');
}
