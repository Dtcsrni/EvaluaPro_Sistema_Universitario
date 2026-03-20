import { configuracion } from '../../configuracion';
import { log, logError } from '../../infraestructura/logging/logger';
import { ejecutarPurgeExamenesGenerados } from './servicioRetencionExamenes';

let timer: NodeJS.Timeout | null = null;
let enEjecucion = false;

function parseCronWindow(cronExpr: string) {
  const match = /^\s*(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*\s*$/.exec(cronExpr);
  if (!match) return null;
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return null;
  }
  return { minute, hour };
}

function shouldRunNow(now: Date, config: { minute: number; hour: number }) {
  return now.getHours() === config.hour && now.getMinutes() === config.minute;
}

export function iniciarSchedulerRetencionExamenes() {
  if (timer) return;
  const cronConfig = parseCronWindow(configuracion.dataPurgeCron);
  if (!cronConfig) {
    log('warn', 'Scheduler de retención de exámenes no iniciado: cron no soportado', {
      cron: configuracion.dataPurgeCron
    });
    return;
  }

  let ultimoSlotEjecutado = '';
  const ejecutar = async () => {
    const ahora = new Date();
    const slot = `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}-${ahora.getHours()}-${ahora.getMinutes()}`;
    if (!shouldRunNow(ahora, cronConfig) || slot === ultimoSlotEjecutado || enEjecucion) return;
    enEjecucion = true;
    ultimoSlotEjecutado = slot;
    try {
      const resumen = await ejecutarPurgeExamenesGenerados({
        olderThanDays: configuracion.dataRetentionDefaultDays,
        scope: 'ttl',
        reason: 'ttl'
      });
      log('info', 'Scheduler de retención de exámenes ejecutado', resumen);
    } catch (error) {
      logError('Error en scheduler de retención de exámenes', error);
    } finally {
      enEjecucion = false;
    }
  };

  timer = setInterval(() => {
    void ejecutar();
  }, 60 * 1000);
  timer.unref?.();

  log('ok', 'Scheduler de retención de exámenes iniciado', {
    cron: configuracion.dataPurgeCron,
    retentionDays: configuracion.dataRetentionDefaultDays
  });
}
