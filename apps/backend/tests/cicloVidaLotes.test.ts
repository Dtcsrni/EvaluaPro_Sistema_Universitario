import { describe, expect, it } from 'vitest';
import { evaluarElegibilidadArchivoLote } from '../src/modulos/modulo_generacion_pdf/application/usecases/cicloVidaLotes.js';

describe('elegibilidad para archivar lotes de exámenes', () => {
  const ahora = new Date('2026-11-06T18:00:00.000Z');

  it('permite archivar al terminar la materia aunque queden exámenes pendientes', () => {
    expect(evaluarElegibilidadArchivoLote({
      ahora,
      materiaActiva: true,
      fechaFinMateria: new Date('2026-11-05T00:00:00.000Z'),
      examenes: [{ id: 'e1', estado: 'generado', alumnoId: 'a1' }],
      calificaciones: [],
      totalExamenes: 1
    })).toEqual({ permitido: true, motivo: 'materia_terminada' });
  });

  it('permite archivar antes del fin cuando todos los exámenes tienen calificación verificada', () => {
    expect(evaluarElegibilidadArchivoLote({
      ahora,
      materiaActiva: true,
      fechaFinMateria: new Date('2026-12-01T00:00:00.000Z'),
      examenes: [
        { id: 'e1', estado: 'calificado', alumnoId: 'a1' },
        { id: 'e2', estado: 'calificado', alumnoId: 'a2' }
      ],
      calificaciones: [
        { examenGeneradoId: 'e1', alumnoId: 'a1' },
        { examenGeneradoId: 'e2', alumnoId: 'a2' }
      ],
      totalExamenes: 2
    })).toEqual({ permitido: true, motivo: 'calificaciones_verificadas' });
  });

  it('mantiene activo el lote si falta una calificación, estado final o identidad coincidente', () => {
    const base = {
      ahora,
      materiaActiva: true,
      fechaFinMateria: new Date('2026-12-01T00:00:00.000Z'),
      totalExamenes: 2,
      calificaciones: [{ examenGeneradoId: 'e1', alumnoId: 'a1' }]
    };
    expect(evaluarElegibilidadArchivoLote({
      ...base,
      examenes: [
        { id: 'e1', estado: 'calificado', alumnoId: 'a1' },
        { id: 'e2', estado: 'generado', alumnoId: 'a2' }
      ]
    })).toMatchObject({ permitido: false });
    expect(evaluarElegibilidadArchivoLote({
      ...base,
      examenes: [
        { id: 'e1', estado: 'calificado', alumnoId: 'a1' },
        { id: 'e2', estado: 'calificado', alumnoId: 'a2' }
      ]
    })).toMatchObject({ permitido: false });
    expect(evaluarElegibilidadArchivoLote({
      ...base,
      examenes: [
        { id: 'e1', estado: 'calificado', alumnoId: 'a1' },
        { id: 'e2', estado: 'calificado', alumnoId: 'a2' }
      ],
      calificaciones: [
        { examenGeneradoId: 'e1', alumnoId: 'a1' },
        { examenGeneradoId: 'e2', alumnoId: 'a1' }
      ]
    })).toMatchObject({ permitido: false });
  });

  it('permite archivar el lote cuando el periodo ya fue cerrado', () => {
    expect(evaluarElegibilidadArchivoLote({
      ahora,
      materiaActiva: false,
      fechaFinMateria: new Date('2026-12-01T00:00:00.000Z'),
      examenes: [{ id: 'e1', estado: 'generado', alumnoId: 'a1' }],
      calificaciones: [],
      totalExamenes: 2
    })).toEqual({ permitido: true, motivo: 'materia_terminada' });
  });
});
