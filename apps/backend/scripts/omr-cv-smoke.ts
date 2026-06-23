/**
 * omr-cv-smoke
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describirErrorCv, ejecutarSmokeTestOmrCv } from '../src/modulos/modulo_escaneo_omr/infra/omrCvEngine';

async function main() {
  const smoke = await ejecutarSmokeTestOmrCv();
  process.stdout.write(`${JSON.stringify(smoke)}\n`);
  if (!smoke.cvDisponible) {
    throw new Error(smoke.motivo ?? 'OMR CV no disponible');
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      motivo: describirErrorCv(error)
    })}\n`
  );
  process.exit(1);
});
