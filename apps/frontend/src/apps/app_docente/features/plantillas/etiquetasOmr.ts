const ETIQUETAS_FLAG_OMR: Record<string, string> = {
  bajo_contraste: 'Bajo contraste',
  doble_marca: 'Varias marcas',
  low_confidence: 'Confianza baja'
};

const ETIQUETAS_ESTADO_PAGINA_OMR: Record<string, string> = {
  accepted: 'Aceptada',
  needs_review: 'Requiere revisión',
  rejected: 'Rechazada',
  ignored: 'Omitida'
};

export function etiquetaEstadoPaginaOmr(estado: string) {
  return ETIQUETAS_ESTADO_PAGINA_OMR[estado.trim().toLowerCase()] ?? estado;
}

export function etiquetaFlagOmr(flag: string) {
  const normalizado = flag.trim();
  return ETIQUETAS_FLAG_OMR[normalizado.toLowerCase()]
    ?? normalizado.replace(/[_-]+/g, ' ').replace(/^\w/, (letra) => letra.toUpperCase());
}
