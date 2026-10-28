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
    ? lotePendiente ? 'Confirmar reanudación con variante común' : 'Confirmar variante común del lote'
    : lotePendiente
      ? esExtraordinario ? 'Reanudar extraordinarios' : 'Reanudar paquete incompleto'
      : esExtraordinario ? 'Generar exámenes extraordinarios' : 'Generar paquete masivo';
  const message = varianteComun
    ? `Se generarán ${cantidadAlumnos} exámenes para el grupo ${grupo} con el mismo orden de preguntas y opciones.`
    : lotePendiente
      ? 'Se reanudará el mismo lote, conservando los exámenes ya generados y verificados.'
      : esExtraordinario
        ? `Se generarán exámenes extraordinarios únicamente para los ${cantidadAlumnos} alumnos seleccionados. Sus calificaciones quedarán separadas de parciales y globales.`
        : `Se generarán ${cantidadAlumnos} exámenes para el grupo ${grupo}.`;
  const confirmLabel = varianteComun
    ? lotePendiente ? 'Sí, reanudar con variante común' : 'Sí, generar variante común'
    : lotePendiente
      ? 'Sí, reanudar lote'
      : esExtraordinario ? 'Sí, generar extraordinarios' : 'Sí, generar paquete';
  const details = varianteComun
    ? [
        'Advertencia: todos los alumnos podrán ver las mismas preguntas en el mismo orden y con las mismas opciones; esto facilita las copias del formulario y también compartir respuestas.',
        'Cada examen conservará su QR firmado y folio propios. Confirma que esta distribución es intencional.'
      ]
    : ['Asegúrate de que plantilla, alumnos y banco estén listos antes de continuar.'];

  return { title, message, details, confirmLabel, tone: 'default' as const };
}
