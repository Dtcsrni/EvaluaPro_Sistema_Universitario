/**
 * Validaciones de autenticacion.
 */
import { z } from 'zod';

function partirNombreCompleto(nombreCompleto: string): { nombres: string; apellidos: string } {
  const limpio = String(nombreCompleto || '')
    .trim()
    .replace(/\s+/g, ' ');
  const partes = limpio.split(' ').filter(Boolean);
  if (partes.length <= 1) return { nombres: limpio, apellidos: '' };
  return { nombres: partes.slice(0, -1).join(' '), apellidos: partes.slice(-1).join(' ') };
}

export const esquemaRegistrarDocente = z
  .object({
    nombres: z.string().min(1).optional(),
    apellidos: z.string().min(1).optional(),
    nombreCompleto: z.string().min(1).optional(),
    correo: z.string().email(),
    contrasena: z.string().min(8)
  })
  .strict()
  .superRefine((data, ctx) => {
    const nombres = typeof data.nombres === 'string' ? data.nombres.trim() : '';
    const apellidos = typeof data.apellidos === 'string' ? data.apellidos.trim() : '';
    const nombreCompleto = typeof data.nombreCompleto === 'string' ? data.nombreCompleto.trim() : '';

    const tieneNombresApellidos = Boolean(nombres && apellidos);
    const tieneNombreCompleto = Boolean(nombreCompleto);

    if (!tieneNombresApellidos && !tieneNombreCompleto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nombres'],
        message: 'Faltan datos: proporciona nombres y apellidos, o nombreCompleto.'
      });
      return;
    }

    if (tieneNombreCompleto && !tieneNombresApellidos) {
      const { nombres: derivadosNombres } = partirNombreCompleto(nombreCompleto);
      if (!derivadosNombres.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombreCompleto'],
          message: 'Nombre inválido.'
        });
      }
    }
  })
  .transform((data) => {
    const nombres = typeof data.nombres === 'string' ? data.nombres.trim().replace(/\s+/g, ' ') : '';
    const apellidos = typeof data.apellidos === 'string' ? data.apellidos.trim().replace(/\s+/g, ' ') : '';
    const nombreCompleto = typeof data.nombreCompleto === 'string' ? data.nombreCompleto.trim().replace(/\s+/g, ' ') : '';

    if (nombres && apellidos) {
      return {
        ...data,
        nombres,
        apellidos,
        nombreCompleto: nombreCompleto || `${nombres} ${apellidos}`.trim()
      };
    }

    const derivados = partirNombreCompleto(nombreCompleto);
    return {
      ...data,
      nombres: derivados.nombres,
      apellidos: derivados.apellidos,
      nombreCompleto: nombreCompleto || `${derivados.nombres} ${derivados.apellidos}`.trim()
    };
  });

export const esquemaIngresarDocente = z.object({
  correo: z.string().email(),
  contrasena: z.string().min(1)
});

export const esquemaIngresarDocenteGoogle = z.object({
  // ID token (credential) emitido por Google Identity Services.
  credential: z.string().min(10)
});

export const esquemaRegistrarDocenteGoogle = z
  .object({
    // ID token (credential) emitido por Google Identity Services.
    credential: z.string().min(10),
    nombres: z.string().min(1).optional(),
    apellidos: z.string().min(1).optional(),
    nombreCompleto: z.string().min(1).optional(),
    // Opcional: permite crear password para ingresar sin Google.
    contrasena: z.string().min(8).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const nombres = typeof data.nombres === 'string' ? data.nombres.trim() : '';
    const apellidos = typeof data.apellidos === 'string' ? data.apellidos.trim() : '';
    const nombreCompleto = typeof data.nombreCompleto === 'string' ? data.nombreCompleto.trim() : '';

    const seEnvioAlgoDeNombre = Boolean(nombres || apellidos || nombreCompleto);
    if (!seEnvioAlgoDeNombre) return;

    const tieneNombresApellidos = Boolean(nombres && apellidos);
    if (tieneNombresApellidos) return;

    if (nombreCompleto) {
      const { nombres: derivadosNombres } = partirNombreCompleto(nombreCompleto);
      if (!derivadosNombres.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombreCompleto'],
          message: 'Nombre inválido.'
        });
      }
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nombres'],
      message: 'Completa nombres y apellidos (o envía nombreCompleto).'
    });
  })
  .transform((data) => {
    const nombres = typeof data.nombres === 'string' ? data.nombres.trim().replace(/\s+/g, ' ') : '';
    const apellidos = typeof data.apellidos === 'string' ? data.apellidos.trim().replace(/\s+/g, ' ') : '';
    const nombreCompleto = typeof data.nombreCompleto === 'string' ? data.nombreCompleto.trim().replace(/\s+/g, ' ') : '';

    if (nombres && apellidos) {
      return {
        ...data,
        nombres,
        apellidos,
        nombreCompleto: nombreCompleto || `${nombres} ${apellidos}`.trim()
      };
    }

    if (nombreCompleto) {
      const derivados = partirNombreCompleto(nombreCompleto);
      return {
        ...data,
        nombres: derivados.nombres,
        apellidos: derivados.apellidos,
        nombreCompleto
      };
    }

    return data;
  });

export const esquemaDefinirContrasenaDocente = z.object({
  contrasenaNueva: z.string().min(8),
  // Reautenticacion: via password actual o via Google.
  contrasenaActual: z.string().min(1).optional(),
  credential: z.string().min(10).optional()
}).refine((data) => Boolean(data.contrasenaActual || data.credential), {
  message: 'Reautenticacion requerida'
});

export const esquemaBodyVacioOpcional = z.object({}).strict().optional();

export const esquemaRecuperarContrasenaGoogle = z.object({
  credential: z.string().min(10),
  contrasenaNueva: z.string().min(8)
});

export const esquemaActualizarPreferenciasPdf = z
  .object({
    institucion: z.string().min(1).max(120).optional(),
    lema: z.string().min(1).max(160).optional(),
    logos: z
      .object({
        izquierdaPath: z.string().min(1).max(500).optional(),
        derechaPath: z.string().min(1).max(500).optional()
      })
      .optional()
  })
  .strict()
  .refine((data) => Boolean(data.institucion || data.lema || data.logos), {
    message: 'Nada para actualizar'
  });
