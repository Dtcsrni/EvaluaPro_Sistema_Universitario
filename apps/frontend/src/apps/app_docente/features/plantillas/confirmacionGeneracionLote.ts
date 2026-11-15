type OpcionesConfirmacionGeneracionLote = {
  variantPolicy: 'unique' | 'shared';
  lotePendiente: boolean;
  tipoExamen?: 'extraordinario';
  cantidadAlumnos: number;
  grupo?: string;
};

export function crearContenidoConfirmacionGeneracionLote({
  variantPolicy,
  lotePendiente,
  tipoExamen,
  cantidadAlumnos,
  grupo
}: OpcionesConfirmacionGeneracionLote) {
  const varianteComun = variantPolicy === 'shared';
  const esExtraordinario = tipoExamen === 'extraordinario';
  const title = varianteComun
    ? lotePendiente ? 'Confirmar reanudación con formulario compartido' : 'Confirmar formulario compartido para el grupo'
    : lotePendiente
      ? esExtraordinario ? 'Reanudar extraordinarios' : 'Reanudar paquete incompleto'
      : esExtraordinario ? 'Generar exámenes extraordinarios' : 'Generar paquete masivo';
  const message = varianteComun
    ? `Se generarán ${cantidadAlumnos} exámenes para el grupo ${grupo} con la misma variante, el mismo orden de preguntas y opciones, y la misma clave de respuestas.`
    : lotePendiente
      ? 'Se reanudará el mismo lote, conservando los exámenes ya generados y verificados.'
      : esExtraordinario
        ? `Se generarán exámenes extraordinarios únicamente para los ${cantidadAlumnos} alumnos seleccionados. Sus calificaciones quedarán separadas de parciales y globales.`
        : `Se generarán ${cantidadAlumnos} exámenes para el grupo ${grupo}.`;
  const confirmLabel = varianteComun
    ? lotePendiente ? 'Sí, reanudar formulario compartido' : 'Sí, generar formulario compartido'
    : lotePendiente
      ? 'Sí, reanudar lote'
      : esExtraordinario ? 'Sí, generar extraordinarios' : 'Sí, generar paquete';
  const details = varianteComun
    ? [
        'Advertencia: al compartir preguntas, opciones y clave, aumenta el riesgo de copiar respuestas entre alumnos.',
        'Cada examen conservará su QR firmado y folio propios. Continúa solo si esta distribución idéntica es intencional.'
      ]
    : ['Asegúrate de que plantilla, alumnos y banco estén listos antes de continuar.'];

  return { title, message, details, confirmLabel, tone: varianteComun ? 'warning' as const : 'default' as const };
}
