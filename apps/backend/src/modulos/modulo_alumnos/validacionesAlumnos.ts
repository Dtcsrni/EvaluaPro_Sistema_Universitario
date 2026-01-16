/**
 * Validaciones de alumnos.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';
import { esCorreoDeDominioPermitido } from '../../compartido/utilidades/correo';
import { esMatriculaValida, normalizarEspacios, normalizarMatricula } from '../../compartido/utilidades/texto';
import { configuracion } from '../../configuracion';

function partirNombreCompleto(nombreCompleto: string): { nombres: string; apellidos: string } {
  const limpio = String(nombreCompleto || '')
    .trim()
    .replace(/\s+/g, ' ');
  const partes = limpio.split(' ').filter(Boolean);
  if (partes.length <= 1) return { nombres: limpio, apellidos: '' };
  return { nombres: partes.slice(0, -1).join(' '), apellidos: partes.slice(-1).join(' ') };
}

export const esquemaCrearAlumno = z
  .object({
    periodoId: esquemaObjectId,
    matricula: z.string().min(1),
    nombres: z.string().min(1).optional(),
    apellidos: z.string().min(1).optional(),
    nombreCompleto: z.string().min(1).optional(),
    correo: z.string().email().optional(),
    grupo: z.string().optional(),
    activo: z.boolean().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    const matriculaNormalizada = normalizarMatricula(String(data.matricula || ''));
    if (!esMatriculaValida(matriculaNormalizada)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matricula'],
        message: 'Matricula invalida. Formato esperado: CUH######### (ej. CUH512410168).'
      });
      return;
    }

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
      const { nombres: derivadosNombres, apellidos: derivadosApellidos } = partirNombreCompleto(nombreCompleto);
      if (!derivadosNombres.trim() || !derivadosApellidos.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nombreCompleto'],
          message: 'Nombre completo inválido: incluye al menos nombres y apellidos.'
        });
      }
    }

    const correo = typeof data.correo === 'string' ? data.correo : '';
    const correoEfectivo = correo.trim() ? correo.trim() : `${matriculaNormalizada}@cuh.mx`;

    if (
      Array.isArray(configuracion.dominiosCorreoPermitidos) &&
      configuracion.dominiosCorreoPermitidos.length > 0 &&
      !esCorreoDeDominioPermitido(correoEfectivo, configuracion.dominiosCorreoPermitidos)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['correo'],
        message: 'Correo no permitido por politicas. Usa un correo institucional.'
      });
    }
  })
  .transform((data) => {
    const matricula = normalizarMatricula(String(data.matricula || ''));

    const nombres = typeof data.nombres === 'string' ? normalizarEspacios(data.nombres) : '';
    const apellidos = typeof data.apellidos === 'string' ? normalizarEspacios(data.apellidos) : '';
    const nombreCompleto = typeof data.nombreCompleto === 'string' ? normalizarEspacios(data.nombreCompleto) : '';

    const correo = typeof data.correo === 'string' ? data.correo.trim() : '';
    const correoFinal = correo ? correo : `${matricula}@cuh.mx`;

    if (nombres && apellidos) {
      return {
        ...data,
        matricula,
        nombres,
        apellidos,
        nombreCompleto: nombreCompleto || `${nombres} ${apellidos}`.trim(),
        correo: correoFinal
      };
    }

    const derivados = partirNombreCompleto(nombreCompleto);
    return {
      ...data,
      matricula,
      nombres: derivados.nombres,
      apellidos: derivados.apellidos,
      nombreCompleto: nombreCompleto || `${derivados.nombres} ${derivados.apellidos}`.trim(),
      correo: correoFinal
    };
  });
