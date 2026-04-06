import { log, logError } from '../../infraestructura/logging/logger';
import { configuracion } from '../../configuracion';
import { ejecutarCicloCobranzaAutomatica } from './servicioComercialCore';

let timer: NodeJS.Timeout | null = null;
let enEjecucion = false;

export function iniciarSchedulerCobranzaAutomatica() {
  if (timer) return;
  const intervaloMs = configuracion.cobranzaAutomaticaIntervalMin * 60 * 1000;

  const ejecutar = async () => {
    if (enEjecucion) return;
    enEjecucion = true;
    try {
      const resultado = await ejecutarCicloCobranzaAutomatica({ origen: 'scheduler' });
      log('info', 'Ciclo de cobranza automatica ejecutado', {
        revisadas: resultado.revisadas,
        recordatorios: resultado.recordatorios,
        suspensionesParciales: resultado.suspensionesParciales,
        suspensionesTotales: resultado.suspensionesTotales
      });
    } catch (error) {
      logError('Error en ciclo de cobranza automatica', error);
    } finally {
      enEjecucion = false;
    }
  };

  timer = setInterval(() => {
    void ejecutar();
  }, intervaloMs);
  timer.unref?.();

  log('ok', 'Scheduler de cobranza automatica iniciado', {
    intervaloMin: configuracion.cobranzaAutomaticaIntervalMin
  });
}
