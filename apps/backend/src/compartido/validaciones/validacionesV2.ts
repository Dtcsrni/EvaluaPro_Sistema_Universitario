/**
 * Validaciones Zod mejoradas para endpoints v2 (OMR + PDF)
 * Ola 3 - Fase 2: Endpoints Robustos
 * Incluye validaciones de imagen, límites de recurso y business logic
 */

import { z } from 'zod';
import { configuracion } from '../../configuracion';

// ============= ESQUEMAS BASE REUTILIZABLES =============

export const esquemaBase64Imagen = z
  .string()
  .min(50, 'Imagen base64 muy pequeña')
  .max(configuracion.omrImagenBase64MaxChars, `Imagen excede ${configuracion.omrImagenBase64MaxChars} caracteres`)
  .regex(/^[A-Za-z0-9+/=]+$/, 'Base64 inválido')
  .refine((val) => {
    // Validación aproximada: base64 es al menos 33% más grande que datos reales
    const tamanioEstimadoBytes = Math.floor(val.length * 0.75);
    return tamanioEstimadoBytes > 1000; // Al menos 1KB
  }, 'Imagen muy pequeña (<1KB estimado)');

export const esquemaFolio = z
  .string()
  .trim()
  .min(1, 'Folio requerido')
  .max(50, 'Folio muy largo')
  .regex(/^[A-Z0-9-]+$/, 'Folio debe contener solo mayúsculas, números y guiones');

export const esquemaNumeroEntero = z
  .number()
  .int('Debe ser número entero')
  .nonnegative('Debe ser >= 0');

// ============= VALIDACIONES OMR V2 =============

/**
 * Validación mejorada para analizar una imagen OMR
 */
export const esquemaAnalizarOmrV2 = z.object({
  folio: esquemaFolio.optional(),
  numeroPagina: esquemaNumeroEntero.optional().default(0),
  imagenBase64: esquemaBase64Imagen,
  metadatos: z
    .object({
      resolucionDpi: z.number().min(50).max(600).optional(),
      rotacionGrados: z.number().min(0).max(360).optional(),
      filtroCalidad: z.enum(['estricto', 'normal', 'tolerante']).optional()
    })
    .optional()
});

/**
 * Validación para lote de análisis OMR
 */
export const esquemaAnalizarOmrLoteV2 = z.object({
  capturas: z
    .array(
      z.object({
        nombreArchivo: z.string().trim().min(1).max(200).optional(),
        folio: esquemaFolio.optional(),
        imagenBase64: esquemaBase64Imagen
      })
    )
    .min(1, 'Al menos una captura requerida')
    .max(200, 'Máximo 200 capturas por lote'),
  procesarEnParalelo: z.boolean().optional().default(false),
  timeoutMs: z.number().min(5000).max(600000).optional().default(300000)
});

/**
 * Validación para prevalidar capturas antes de análisis completo
 */
export const esquemaPrevalidarLoteOmrV2 = z.object({
  capturas: z
    .array(
      z.object({
        nombreArchivo: z.string().trim().min(1).max(200).optional(),
        imagenBase64: esquemaBase64Imagen,
        esOmr: z.boolean().optional()
      })
    )
    .min(1)
    .max(200),
  verificarQr: z.boolean().optional().default(true),
  verificarMarcas: z.boolean().optional().default(true)
});

// ============= VALIDACIONES PDF V2 =============

/**
 * Validación para crear plantilla PDF
 */
export const esquemaCrearPlantillaV2 = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Nombre requerido')
    .max(200, 'Nombre muy largo')
    .regex(/^[a-zA-Z0-9\s\-_áéíóúñÁÉÍÓÚÑ]+$/, 'Caracteres inválidos en nombre'),
  descripcion: z
    .string()
    .trim()
    .max(1000, 'Descripción muy larga')
    .optional(),
  tipoExamen: z.enum(['prueba', 'final', 'recuperatorio', 'otro']),
  preguntasIds: z
    .array(z.string().min(1))
    .min(1, 'Al menos una pregunta requerida')
    .max(200, 'Máximo 200 preguntas'),
  configuracion: z
    .object({
      mostrarRespuestas: z.boolean().optional(),
      mostrarPuntajes: z.boolean().optional(),
      usuarFiltroPagina: z.boolean().optional(),
      ordenAleatorio: z.boolean().optional(),
      tiempoSugeridoMin: z.number().min(1).max(600).optional()
    })
    .optional()
});

/**
 * Validación para generar examen individual
 */
export const esquemaGenerarExamenV2 = z.object({
  plantillaId: z.string().min(1, 'ID plantilla requerido'),
  alumnoId: z.string().min(1, 'ID alumno requerido'),
  alumnoNombre: z.string().trim().min(1).max(200),
  numeroMatricula: z.string().trim().min(1).max(50),
  formato: z.enum(['A4', 'Carta']).optional().default('A4'),
  generarQr: z.boolean().optional().default(true),
  completarOmr: z.boolean().optional().default(true)
});

/**
 * Validación para generar lote de exámenes
 */
export const esquemaGenerarExamenesLoteV2 = z.object({
  plantillaId: z.string().min(1),
  alumnos: z
    .array(
      z.object({
        alumnoId: z.string().min(1),
        nombre: z.string().trim().min(1).max(200),
        numeroMatricula: z.string().trim().min(1).max(50)
      })
    )
    .min(1, 'Al menos un alumno')
    .max(500, 'Máximo 500 alumnos por lote'),
  formato: z.enum(['A4', 'Carta']).optional().default('A4'),
  completarOmr: z.boolean().optional().default(true),
  procesarEnParalelo: z.boolean().optional().default(false)
});

/**
 * Validación para regenerar PDF
 */
export const esquemaRegenerarPdfV2 = z.object({
  formato: z.enum(['A4', 'Carta']).optional(),
  regenerarQr: z.boolean().optional(),
  completarOmr: z.boolean().optional()
});

// ============= VALIDACIONES COMUNES DE RESPUESTA =============

/**
 * Estructura de respuesta exitosa (genérica)
 */
export const esquemaRespuestaExitosa = z.object({
  exito: z.literal(true),
  datos: z.any(),
  duracionMs: z.number().optional(),
  traceId: z.string().optional()
});

/**
 * Estructura de respuesta de error (genérica)
 */
export const esquemaRespuestaError = z.object({
  exito: z.literal(false),
  error: z.object({
    categoria: z.string(),
    mensaje: z.string(),
    traceId: z.string().optional(),
    reintentable: z.boolean().optional()
  }),
  duracionMs: z.number().optional()
});

/**
 * Validador de paginación
 */
export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).optional().default(1),
  limite: z.coerce.number().int().min(1).max(100).optional().default(20)
});
