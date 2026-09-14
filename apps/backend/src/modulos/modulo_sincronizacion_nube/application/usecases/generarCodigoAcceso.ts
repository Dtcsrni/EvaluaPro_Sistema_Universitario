/**
 * generarCodigoAcceso
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { configuracion } from '../../../../configuracion.js';
import { enviarCorreo } from '../../../../infraestructura/correo/servicioCorreo.js';
import { CodigoAcceso } from '../../modeloCodigoAcceso.js';
import { generarCodigoSimple } from '../../sincronizacionInterna.js';
import { syncClock } from '../../infra/repositoriosSync.js';

export async function generarCodigoAccesoUseCase(params: { docenteId: string; periodoId: string }) {
  const { docenteId, periodoId } = params;

  let codigo = generarCodigoSimple();
  let intentos = 0;
  while (intentos < 5) {
    const existe = await CodigoAcceso.findOne({ codigo }).lean();
    if (!existe) break;
    codigo = generarCodigoSimple();
    intentos += 1;
  }

  const expiraEn = new Date(syncClock.now().getTime() + configuracion.codigoAccesoHoras * 60 * 60 * 1000);
  const registro = await CodigoAcceso.create({
    docenteId,
    periodoId,
    codigo,
    expiraEn,
    usado: false
  });

  try {
    await enviarCorreo('destinatario@ejemplo.com', 'Codigo de acceso', `Tu codigo es ${codigo}`);
  } catch {
    // best-effort
  }

  return { codigo: registro.codigo, expiraEn: registro.expiraEn };
}
