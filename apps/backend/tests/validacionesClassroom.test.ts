/**
 * validacionesClassroom.test
 *
 * Responsabilidad: proteger el contrato de preview/ejecución de Classroom.
 */
import { describe, expect, it } from 'vitest';
import {
  esquemaEjecutarImportacionClassroom,
  esquemaPreviewImportacionClassroom
} from '../src/modulos/modulo_integraciones_classroom/validacionesClassroom.js';

const periodoId = '507f1f77bcf86cd799439922';

describe('validaciones de importación Classroom', () => {
  it.each([
    ['BI', 'course-bi', 'Practica Inteligencia de negocio aplicada a un Dataset'],
    ['DAW', 'course-daw', 'Practica de desarrollo web']
  ])('acepta payload completo de preview y ejecución para %s', (_curso, courseId, titulo) => {
    const payload = {
      periodoId,
      actividades: [{
        courseId,
        courseWorkId: 'cw-import',
        tituloEvidencia: titulo,
        ponderacion: 1,
        corte: 2,
        activo: true,
        incluirEnPromedio: true
      }]
    };

    expect(esquemaPreviewImportacionClassroom.safeParse(payload).success).toBe(true);
    expect(esquemaEjecutarImportacionClassroom.safeParse(payload).success).toBe(true);
  });

  it('rechaza una opción de promedio que no sea booleana y señala el campo exacto', () => {
    const resultado = esquemaPreviewImportacionClassroom.safeParse({
      periodoId,
      actividades: [{
        courseId: 'course-bi',
        courseWorkId: 'cw-import',
        tituloEvidencia: 'Actividad',
        incluirEnPromedio: 'si'
      }]
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.path).toEqual(['actividades', 0, 'incluirEnPromedio']);
    }
  });

  it('conserva el modo estricto y rechaza propiedades no reconocidas', () => {
    const resultado = esquemaPreviewImportacionClassroom.safeParse({
      periodoId,
      actividades: [{
        courseId: 'course-daw',
        courseWorkId: 'cw-import',
        tituloEvidencia: 'Actividad',
        atributoDesconocido: true
      }]
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.path).toEqual(['actividades', 0]);
      expect(resultado.error.issues[0]?.code).toBe('unrecognized_keys');
      if (resultado.error.issues[0]?.code === 'unrecognized_keys') {
        expect(resultado.error.issues[0]?.keys).toContain('atributoDesconocido');
      }
    }
  });
});
