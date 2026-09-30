/**
 * Contrato de preview/ejecución Classroom.
 */
import { describe, expect, it } from 'vitest';
import {
  esquemaEjecutarImportacionClassroom,
  esquemaPreviewImportacionClassroom
} from '../src/modulos/modulo_integraciones_classroom/validacionesClassroom.js';

const periodoId = '507f1f77bcf86cd799439922';

describe('validaciones de importación Classroom', () => {
  it.each([
    ['BI', 'course-bi', 'Proyecto Final | Implementación de ERP open source'],
    ['DAW', 'course-daw', 'Proyecto FINAL | Aplicación Web FULLSTACK']
  ])('acepta payload de actividad para %s con inclusión explícita', (_curso, courseId, titulo) => {
    const payload = {
      periodoId,
      actividades: [{
        courseId,
        courseWorkId: 'cw-import',
        tituloEvidencia: titulo,
        ponderacion: 1,
        corte: 3,
        activo: true,
        incluirEnPromedio: true
      }]
    };

    expect(esquemaPreviewImportacionClassroom.safeParse(payload).success).toBe(true);
    expect(esquemaEjecutarImportacionClassroom.safeParse(payload).success).toBe(true);
  });

  it('rechaza valores no booleanos para incluirEnPromedio', () => {
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

  it('mantiene el esquema estricto ante campos desconocidos', () => {
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
      expect(resultado.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });
});