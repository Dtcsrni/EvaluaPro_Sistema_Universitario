/**
 * metrics
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
const inicioDelProceso = Date.now();

type ClaveSolicitud = `${string}|${string}|${number}`;
const solicitudesPorRuta = new Map<ClaveSolicitud, number>();
let totalErrores5xx = 0;

export function registrarRequestHttp(method: string, route: string, status: number) {
  const metodo = String(method || 'GET').toUpperCase();
  const ruta = String(route || '/');
  const estatus = Number.isFinite(status) ? status : 500;
  const clave = `${metodo}|${ruta}|${estatus}` as ClaveSolicitud;
  solicitudesPorRuta.set(clave, (solicitudesPorRuta.get(clave) ?? 0) + 1);
  if (estatus >= 500) totalErrores5xx += 1;
}

export function exportarMetricasPrometheus(): string {
  const lineas: string[] = [];
  lineas.push('# HELP evaluapro_portal_http_requests_total Total de requests HTTP del portal');
  lineas.push('# TYPE evaluapro_portal_http_requests_total counter');
  for (const [clave, valor] of solicitudesPorRuta.entries()) {
    const [metodo, ruta, estatus] = clave.split('|');
    lineas.push(
      `evaluapro_portal_http_requests_total{method="${metodo}",route="${ruta}",status="${estatus}"} ${valor}`
    );
  }
  lineas.push('');
  lineas.push('# HELP evaluapro_portal_http_errors_total Total de respuestas 5xx del portal');
  lineas.push('# TYPE evaluapro_portal_http_errors_total counter');
  lineas.push(`evaluapro_portal_http_errors_total ${totalErrores5xx}`);
  lineas.push('');
  lineas.push('# HELP evaluapro_portal_process_uptime_seconds Uptime del portal');
  lineas.push('# TYPE evaluapro_portal_process_uptime_seconds gauge');
  lineas.push(`evaluapro_portal_process_uptime_seconds ${Math.floor((Date.now() - inicioDelProceso) / 1000)}`);
  return lineas.join('\n');
}
