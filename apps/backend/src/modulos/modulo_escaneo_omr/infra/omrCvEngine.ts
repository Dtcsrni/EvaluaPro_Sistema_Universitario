/**
 * omrCvEngine
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import sharp from 'sharp';

/**
 * Error de contrato para reportar ausencia de backend CV obligatorio.
 * Se consume en smoke de arranque y en preproceso de la etapa de scoring.
 */
export class ErrorOmrCvNoDisponible extends Error {
  code = 'OMR_CV_NO_DISPONIBLE' as const;
}

type EstadoSmokeOmrCv = {
  enabled: boolean;
  backend: 'cv';
  cvDisponible: boolean;
  motivo?: string;
};

let cvBackendCheckForTests: (() => Promise<unknown>) | null = null;

/**
 * Acepta base64 puro o data-url y retorna solo el payload base64.
 */
function limpiarBase64(entrada: string) {
  return String(entrada ?? '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
}

/**
 * En runtime normal el motor CV es obligatorio y siempre se mantiene activo.
 * Solo en entorno de pruebas (`NODE_ENV=test`) se permite apagarlo por variable.
 */
function resolverCvHabilitado() {
  const esTest = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'test';
  if (!esTest) return true;
  const enabledRaw = String(process.env.OMR_CV_ENGINE_ENABLED ?? '1').trim().toLowerCase();
  const enabledSolicitado = !['0', 'false', 'off', 'no'].includes(enabledRaw);
  return enabledSolicitado;
}

/**
 * Hook de pruebas para simular disponibilidad/no disponibilidad de runtime CV.
 * No tiene efecto fuera de `NODE_ENV=test`.
 */
export function setCvBackendCheckForTests(loader?: (() => Promise<unknown>) | null) {
  if (process.env.NODE_ENV !== 'test') return;
  cvBackendCheckForTests = loader ?? null;
}

/**
 * Verifica que el backend de procesamiento nativo está funcional.
 * Se usa una operación mínima con sharp para validar carga de binarios/runtime.
 */
async function validarBackendCv() {
  try {
    if (cvBackendCheckForTests) {
      await cvBackendCheckForTests();
      return;
    }
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .png()
      .toBuffer();
  } catch {
    throw new ErrorOmrCvNoDisponible('Backend CV no disponible en runtime. Verifica dependencias nativas de imagen.');
  }
}

export function debeIntentarMotorCv(templateVersion?: number) {
  const enabled = resolverCvHabilitado();
  const version = Number(templateVersion ?? 1);
  return enabled && (version === 1 || version === 3 || version === 4);
}

/**
 * Normaliza errores técnicos para trazabilidad en motivos de revisión.
 */
export function describirErrorCv(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'fallo desconocido';
}

/**
 * Smoke test de contrato para arranque: confirma estado del motor CV.
 */
export async function ejecutarSmokeTestOmrCv(): Promise<EstadoSmokeOmrCv> {
  const enabled = resolverCvHabilitado();
  const backend = 'cv' as const;
  if (!enabled) {
    return {
      enabled,
      backend,
      cvDisponible: false,
      motivo: 'OMR_CV_ENGINE_ENABLED desactivado'
    };
  }
  try {
    await validarBackendCv();
    return {
      enabled,
      backend,
      cvDisponible: true
    };
  } catch (error) {
    return {
      enabled,
      backend,
      cvDisponible: false,
      motivo: describirErrorCv(error)
    };
  }
}

export async function preprocesarImagenOmrCv(imagenBase64: string) {
  await validarBackendCv();

  const limpio = limpiarBase64(imagenBase64);
  if (!limpio) throw new Error('Imagen base64 vacia');
  const input = Buffer.from(limpio, 'base64');
  if (!input.length) throw new Error('Imagen base64 invalida');

  // Preproceso conservador orientado a robustez de detección OMR en capturas reales.
  const output = await sharp(input)
    .rotate()
    .normalise()
    .linear(1.12, -8)
    .median(1)
    .sharpen({ sigma: 0.9, m1: 0.5, m2: 1.2 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return `data:image/png;base64,${output.toString('base64')}`;
}
