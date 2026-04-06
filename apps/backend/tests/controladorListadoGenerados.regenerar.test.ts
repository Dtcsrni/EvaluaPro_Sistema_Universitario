import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockExamenFindOneLean,
  mockPlantillaFindByIdLean,
  mockBancoPreguntaFindLean,
  mockPeriodoFindByIdLean,
  mockDocenteFindByIdLean,
  mockGenerarPdfExamen,
  mockResolverNumeroPaginasPlantilla
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockExamenFindOneLean: vi.fn(),
  mockPlantillaFindByIdLean: vi.fn(),
  mockBancoPreguntaFindLean: vi.fn(),
  mockPeriodoFindByIdLean: vi.fn(),
  mockDocenteFindByIdLean: vi.fn(),
  mockGenerarPdfExamen: vi.fn(),
  mockResolverNumeroPaginasPlantilla: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenGenerado', () => ({
  ExamenGenerado: {
    findOne: vi.fn(() => ({
      lean: mockExamenFindOneLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla', () => ({
  ExamenPlantilla: {
    findById: vi.fn(() => ({
      lean: mockPlantillaFindByIdLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_banco_preguntas/modeloBancoPregunta', () => ({
  BancoPregunta: {
    find: vi.fn(() => ({
      lean: mockBancoPreguntaFindLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_alumnos/modeloPeriodo', () => ({
  Periodo: {
    findById: vi.fn(() => ({
      lean: mockPeriodoFindByIdLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_autenticacion/modeloDocente', () => ({
  Docente: {
    findById: vi.fn(() => ({
      lean: mockDocenteFindByIdLean
    }))
  }
}));

vi.mock('../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf', () => ({
  generarPdfExamen: mockGenerarPdfExamen
}));

vi.mock('../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla', () => ({
  resolverNumeroPaginasPlantilla: mockResolverNumeroPaginasPlantilla
}));

import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { regenerarPdfExamen } from '../src/modulos/modulo_generacion_pdf/controladorListadoGenerados';

describe('controladorListadoGenerados.regenerarPdfExamen', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockObtenerDocenteId.mockReturnValue('docente-1');
    mockExamenFindOneLean.mockResolvedValue({
      _id: 'examen-1',
      docenteId: 'docente-1',
      estado: 'generado',
      plantillaId: 'plantilla-1',
      folio: 'FOL-001',
      preguntasIds: ['507f1f77bcf86cd799439011'],
      periodoId: 'periodo-1',
      mapaVariante: { ordenPreguntas: ['507f1f77bcf86cd799439011'] }
    });
    mockPlantillaFindByIdLean.mockResolvedValue({
      _id: 'plantilla-1',
      docenteId: 'docente-1',
      titulo: 'Parcial 1',
      tipo: 'parcial',
      numeroPaginas: 1
    });
    mockBancoPreguntaFindLean.mockResolvedValue([
      {
        _id: '507f1f77bcf86cd799439011',
        versionActual: 1,
        versiones: [
          {
            numeroVersion: 1,
            enunciado: 'Pregunta de prueba',
            opciones: [
              { texto: 'A', esCorrecta: true },
              { texto: 'B', esCorrecta: false }
            ]
          }
        ]
      }
    ]);
    mockPeriodoFindByIdLean.mockResolvedValue({ _id: 'periodo-1', nombre: 'Periodo 2025' });
    mockDocenteFindByIdLean.mockResolvedValue({ _id: 'docente-1', nombreCompleto: 'Docente Prueba' });
    mockResolverNumeroPaginasPlantilla.mockReturnValue(1);
    mockGenerarPdfExamen.mockRejectedValue(new Error('Layout invalido: densidad insuficiente en pagina 1'));
  });

  it('traduce error de densidad insuficiente a ErrorAplicacion 409', async () => {
    const req = {
      docenteId: 'docente-1',
      params: { id: 'examen-1' },
      body: { forzar: true }
    } as never;

    const res = {} as Response;

    await expect(regenerarPdfExamen(req, res)).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'LAYOUT_DENSIDAD_INSUFICIENTE',
      estadoHttp: 409,
      message: 'Layout invalido: densidad insuficiente en pagina 1'
    });
  });
});
