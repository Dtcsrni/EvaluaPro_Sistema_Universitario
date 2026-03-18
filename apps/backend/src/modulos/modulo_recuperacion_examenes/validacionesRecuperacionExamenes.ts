import { z } from 'zod';

const textoOpcional = z
  .string()
  .trim()
  .min(1)
  .optional();

export const esquemaVerificarRecuperacion = z
  .object({
    bundleHash: textoOpcional,
    loteId: textoOpcional,
    manifestHash: textoOpcional,
    examId: textoOpcional,
    folio: textoOpcional
  })
  .refine(
    (payload) =>
      Boolean(payload.bundleHash || payload.loteId || payload.manifestHash || payload.examId || payload.folio),
    'Se requiere al menos un criterio de busqueda'
  );

export const esquemaReconstruirManifest = z
  .object({
    manifestHash: textoOpcional,
    examId: textoOpcional,
    folio: textoOpcional
  })
  .refine((payload) => Boolean(payload.manifestHash || payload.examId || payload.folio), 'Se requiere un manifest');

export const esquemaReconstruirBundle = z
  .object({
    bundleHash: textoOpcional,
    loteId: textoOpcional
  })
  .refine((payload) => Boolean(payload.bundleHash || payload.loteId), 'Se requiere un bundle');

export const esquemaBodyVacioOpcional = z.object({}).passthrough();
