/**
 * controladorListadoGenerados.regenerar.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockObtenerDocenteId,
  mockExamenFindFirst,
  mockPlantillaFindUnique,
  mockBancoPreguntaFindMany,
  mockPeriodoFindUnique,
  mockDocenteFindUnique,
  mockGenerarPdfExamen,
  mockResolverNumeroPaginasPlantilla
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockExamenFindFirst: vi.fn(),
  mockPlantillaFindUnique: vi.fn(),
  mockBancoPreguntaFindMany: vi.fn(),
  mockPeriodoFindUnique: vi.fn(),
  mockDocenteFindUnique: vi.fn(),
  mockGenerarPdfExamen: vi.fn(),
  mockResolverNumeroPaginasPlantilla: vi.fn()
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

vi.mock('../src/infraestructura/baseDatos/sqlite', () => ({
  prisma: {
    examenGenerado: {
      findFirst: mockExamenFindFirst,
      update: vi.fn()
    },
    examenPlantilla: {
      findUnique: mockPlantillaFindUnique
    },
    bancoPregunta: {
      findMany: mockBancoPreguntaFindMany
    },
    periodo: {
      findUnique: mockPeriodoFindUnique
    },
    docente: {
      findUnique: mockDocenteFindUnique
    }
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
    mockExamenFindFirst.mockResolvedValue({
      id: 'examen-1',
      docenteId: 'docente-1',
      estado: 'generado',
      plantillaId: 'plantilla-1',
      folio: 'FOL-001',
      preguntasIds: ['507f1f77bcf86cd799439011'],
      periodoId: 'periodo-1',
      mapaVariante: JSON.stringify({ ordenPreguntas: ['507f1f77bcf86cd799439011'] }),
      paginas: '[]',
      studentPacketArtifacts: '[]',
      versionSet: '[]',
      sheetInstances: '[]'
    });
    mockPlantillaFindUnique.mockResolvedValue({
      id: 'plantilla-1',
      docenteId: 'docente-1',
      titulo: 'Parcial 1',
      tipo: 'parcial',
      numeroPaginas: 1,
      temas: '[]',
      bookletConfig: '{}',
      omrConfig: '{}',
      configuracionPdf: '{}'
    });
    mockBancoPreguntaFindMany.mockResolvedValue([
      {
        id: '507f1f77bcf86cd799439011',
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
    mockPeriodoFindUnique.mockResolvedValue({ id: 'periodo-1', nombre: 'Periodo 2025', grupos: '[]' });
    mockDocenteFindUnique.mockResolvedValue({ id: 'docente-1', nombreCompleto: 'Docente Prueba' });
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
