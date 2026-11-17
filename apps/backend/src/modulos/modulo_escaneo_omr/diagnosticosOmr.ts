export const MENSAJE_PLANTILLA_OMR_NO_COMPATIBLE =
  'El lote contiene una plantilla que no es compatible con el layout OMR activo.';

export function diagnosticoGatePilotoRealOmr(disponible: boolean): string | null {
  return disponible
    ? null
    : 'La autocalificación requiere la validación independiente del piloto real del motor OMR.';
}
