/**
 * papelera.controlador.test
 *
 * Responsabilidad: Verificar las reglas de acceso y restauracion de la papelera usando SQLite.
 */
import type { Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { prisma } from '../src/infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../src/compartido/errores/errorAplicacion';
import { listarPapelera, restaurarPapelera } from '../src/modulos/modulo_papelera/controladorPapelera';

const {
  mockObtenerDocenteId,
  mockConfiguracion
} = vi.hoisted(() => ({
  mockObtenerDocenteId: vi.fn(),
  mockConfiguracion: {
    entorno: 'development'
  }
}));

vi.mock('../src/configuracion', () => ({
  configuracion: mockConfiguracion
}));

vi.mock('../src/modulos/modulo_autenticacion/middlewareAutenticacion', () => ({
  obtenerDocenteId: mockObtenerDocenteId
}));

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('controladorPapelera (integracion)', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    mockConfiguracion.entorno = 'development';
    mockObtenerDocenteId.mockReturnValue('docente-1');
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('lista items por docente y aplica limite positivo solicitado', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-1',
        docenteId: 'docente-1',
        tipo: 'alumno',
        itemId: 'alumno-1',
        datosJson: JSON.stringify({ alumno: { id: 'alumno-1', nombre: 'Ana' } }),
        createdAt: new Date('2026-03-24T12:00:00.000Z')
      }
    });
    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-2',
        docenteId: 'docente-1',
        tipo: 'alumno',
        itemId: 'alumno-2',
        datosJson: JSON.stringify({ alumno: { id: 'alumno-2', nombre: 'Luis' } }),
        createdAt: new Date('2026-03-24T13:00:00.000Z')
      }
    });

    const res = crearRespuesta();
    await listarPapelera({ query: { limite: '1' } } as never, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.items).toHaveLength(1);
    expect(jsonCall.items[0].id).toBe('papelera-2');
  });

  it('rechaza listar/restaurar fuera de modo development', async () => {
    mockConfiguracion.entorno = 'production';

    await expect(listarPapelera({ query: {} } as never, crearRespuesta())).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'SOLO_DEV',
      estadoHttp: 403
    });

    await expect(
      restaurarPapelera({ params: { id: 'papelera-1' } } as never, crearRespuesta())
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'SOLO_DEV',
      estadoHttp: 403
    });
  });

  it('falla si el item no existe para el docente autenticado', async () => {
    await expect(
      restaurarPapelera({ params: { id: 'papelera-404' } } as never, crearRespuesta())
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PAPELERA_NO_ENCONTRADA',
      estadoHttp: 404
    });
  });

  it('restaura payload de plantilla y elimina el item de la papelera', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    await prisma.periodo.create({
      data: { id: 'periodo-1', docenteId: 'docente-1', nombre: 'P1', nombreNormalizado: 'p1', fechaInicio: new Date(), fechaFin: new Date(), grupos: '[]' }
    });

    await prisma.alumno.create({
      data: { id: 'alumno-1', periodoId: 'periodo-1', matricula: 'M1', nombreCompleto: 'Alumno 1', correo: 'a1@test.com' }
    });

    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-plantilla',
        docenteId: 'docente-1',
        tipo: 'plantilla',
        itemId: 'plantilla-1',
        datosJson: JSON.stringify({
          plantilla: { id: 'plantilla-1', docenteId: 'docente-1', tipo: 'parcial', titulo: 'Parcial 1', tituloNormalizado: 'parcial 1' },
          examenes: [{ id: 'examen-1', docenteId: 'docente-1', plantillaId: 'plantilla-1', folio: 'F-1' }],
          entregas: [{ id: 'entrega-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1' }],
          calificaciones: [{ id: 'calif-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', tipoExamen: 'parcial', totalReactivos: 10, aciertos: 9, fraccion: '{}', calificacionExamenTexto: '9', bonoTexto: '0', calificacionExamenFinalTexto: '9' }],
          banderas: [{ id: 'bandera-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', motivo: 'Copia' }]
        })
      }
    });

    const res = crearRespuesta();
    await restaurarPapelera({ params: { id: 'papelera-plantilla' } } as never, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const restoredPlantilla = await prisma.examenPlantilla.findUnique({ where: { id: 'plantilla-1' } });
    expect(restoredPlantilla).toBeDefined();
    expect(restoredPlantilla?.titulo).toBe('Parcial 1');

    const restoredExamen = await prisma.examenGenerado.findUnique({ where: { id: 'examen-1' } });
    expect(restoredExamen).toBeDefined();

    const deletedItem = await prisma.papeleraItem.findFirst({ where: { id: 'papelera-plantilla' } });
    expect(deletedItem).toBeNull();
  });

  it('restaura payload de alumno con sus relacionados', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    await prisma.periodo.create({
      data: { id: 'periodo-1', docenteId: 'docente-1', nombre: 'P1', nombreNormalizado: 'p1', fechaInicio: new Date(), fechaFin: new Date(), grupos: '[]' }
    });

    await prisma.examenPlantilla.create({
      data: { id: 'plantilla-1', docenteId: 'docente-1', tipo: 'parcial', titulo: 'Parcial 1', tituloNormalizado: 'parcial 1', bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}' }
    });

    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-alumno',
        docenteId: 'docente-1',
        tipo: 'alumno',
        itemId: 'alumno-1',
        datosJson: JSON.stringify({
          alumno: { id: 'alumno-1', periodoId: 'periodo-1', matricula: 'M1', nombreCompleto: 'Ana', correo: 'ana@test.com' },
          examenes: [{ id: 'examen-1', docenteId: 'docente-1', plantillaId: 'plantilla-1', alumnoId: 'alumno-1', folio: 'F-1' }],
          entregas: [{ id: 'entrega-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1' }],
          calificaciones: [{ id: 'calif-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', tipoExamen: 'parcial', totalReactivos: 10, aciertos: 9, fraccion: '{}', calificacionExamenTexto: '9', bonoTexto: '0', calificacionExamenFinalTexto: '9' }],
          banderas: [{ id: 'bandera-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', motivo: 'Copia' }]
        })
      }
    });

    const res = crearRespuesta();
    await restaurarPapelera({ params: { id: 'papelera-alumno' } } as never, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const restoredAlumno = await prisma.alumno.findUnique({ where: { id: 'alumno-1' } });
    expect(restoredAlumno).toBeDefined();
    expect(restoredAlumno?.nombreCompleto).toBe('Ana');

    const restoredExamen = await prisma.examenGenerado.findUnique({ where: { id: 'examen-1' } });
    expect(restoredExamen).toBeDefined();
  });

  it('restaura payload de periodo incluyendo entidades dependientes', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-periodo',
        docenteId: 'docente-1',
        tipo: 'periodo',
        itemId: 'periodo-1',
        datosJson: JSON.stringify({
          periodo: { id: 'periodo-1', docenteId: 'docente-1', nombre: '2026-A', nombreNormalizado: '2026-a', fechaInicio: new Date(), fechaFin: new Date(), grupos: '[]' },
          alumnos: [{ id: 'alumno-1', periodoId: 'periodo-1', matricula: 'M1', nombreCompleto: 'Ana', correo: 'ana@test.com' }],
          bancoPreguntas: [{ id: 'preg-1', docenteId: 'docente-1', periodoId: 'periodo-1', tema: 'Algebra', versionActual: 1 }],
          temas: [{ id: 'tema-1', docenteId: 'docente-1', periodoId: 'periodo-1', nombre: 'Algebra', clave: 'ALG' }],
          plantillas: [{ id: 'plantilla-1', docenteId: 'docente-1', periodoId: 'periodo-1', tipo: 'parcial', titulo: 'Parcial 1', tituloNormalizado: 'parcial 1', bookletConfig: '{}', omrConfig: '{}', configuracionPdf: '{}' }],
          examenes: [{ id: 'examen-1', docenteId: 'docente-1', periodoId: 'periodo-1', plantillaId: 'plantilla-1', alumnoId: 'alumno-1', folio: 'F-1' }],
          entregas: [{ id: 'entrega-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1' }],
          calificaciones: [{ id: 'calif-1', docenteId: 'docente-1', periodoId: 'periodo-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', tipoExamen: 'parcial', totalReactivos: 10, aciertos: 9, fraccion: '{}', calificacionExamenTexto: '9', bonoTexto: '0', calificacionExamenFinalTexto: '9' }],
          banderas: [{ id: 'bandera-1', docenteId: 'docente-1', examenGeneradoId: 'examen-1', alumnoId: 'alumno-1', motivo: 'Copia' }],
          codigosAcceso: [{ id: 'codigo-1', docenteId: 'docente-1', periodoId: 'periodo-1', codigo: 'ABC1234', expiraEn: new Date() }]
        })
      }
    });

    const res = crearRespuesta();
    await restaurarPapelera({ params: { id: 'papelera-periodo' } } as never, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const restoredPeriodo = await prisma.periodo.findUnique({ where: { id: 'periodo-1' } });
    expect(restoredPeriodo).toBeDefined();

    const restoredAlumno = await prisma.alumno.findUnique({ where: { id: 'alumno-1' } });
    expect(restoredAlumno).toBeDefined();

    const restoredPregunta = await prisma.bancoPregunta.findUnique({ where: { id: 'preg-1' } });
    expect(restoredPregunta).toBeDefined();
  });

  it('rechaza tipos de papelera no soportados', async () => {
    await prisma.docente.create({
      data: {
        id: 'docente-1',
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@evaluapro.local'
      }
    });

    await prisma.papeleraItem.create({
      data: {
        id: 'papelera-x',
        docenteId: 'docente-1',
        tipo: 'desconocido',
        itemId: 'algo-1',
        datosJson: '{}'
      }
    });

    await expect(
      restaurarPapelera({ params: { id: 'papelera-x' } } as never, crearRespuesta())
    ).rejects.toMatchObject<Partial<ErrorAplicacion>>({
      codigo: 'PAPELERA_TIPO',
      estadoHttp: 400
    });
  });
});
