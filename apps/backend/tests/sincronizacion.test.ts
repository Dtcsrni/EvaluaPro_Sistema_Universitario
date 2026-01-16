// Pruebas del modulo de sincronizacion a nube.
import type { Response } from 'express';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { CodigoAcceso } from '../src/modulos/modulo_sincronizacion_nube/modeloCodigoAcceso';
import { Periodo } from '../src/modulos/modulo_alumnos/modeloPeriodo';
import { Alumno } from '../src/modulos/modulo_alumnos/modeloAlumno';
import { BancoPregunta } from '../src/modulos/modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenPlantilla } from '../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla';

vi.mock('../src/configuracion', () => ({
  configuracion: {
    codigoAccesoHoras: 12,
    portalAlumnoUrl: '',
    portalApiKey: ''
  }
}));

let generarCodigoAcceso: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').generarCodigoAcceso;
let publicarResultados: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').publicarResultados;
let exportarPaquete: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').exportarPaquete;
let importarPaquete: typeof import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion').importarPaquete;

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('sincronizacion nube', () => {
  beforeAll(async () => {
    const controlador = await import('../src/modulos/modulo_sincronizacion_nube/controladorSincronizacion');
    generarCodigoAcceso = controlador.generarCodigoAcceso;
    publicarResultados = controlador.publicarResultados;
    exportarPaquete = controlador.exportarPaquete;
    importarPaquete = controlador.importarPaquete;
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('genera codigo de acceso y lo persiste', async () => {
    const req = {
      body: { periodoId: '507f1f77bcf86cd799439011' },
      docenteId: '507f1f77bcf86cd799439012'
    } as SolicitudDocente;
    const res = crearRespuesta();

    await generarCodigoAcceso(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { codigo: string };
    expect(payload.codigo).toHaveLength(8);

    const registro = await CodigoAcceso.findOne({ codigo: payload.codigo }).lean();
    expect(registro).toBeTruthy();
    expect(String(registro?.docenteId)).toBe(req.docenteId);
  });

  it('falla si el portal alumno no esta configurado', async () => {
    const req = {
      body: { periodoId: '507f1f77bcf86cd799439011' },
      docenteId: '507f1f77bcf86cd799439012'
    } as SolicitudDocente;

    await expect(publicarResultados(req, crearRespuesta())).rejects.toMatchObject({
      codigo: 'PORTAL_NO_CONFIG'
    });
  });

  it('exporta e importa un paquete (idempotente)', async () => {
    const docenteId = '507f1f77bcf86cd799439012';
    const periodoId = '507f1f77bcf86cd799439011';

    await Periodo.create({
      _id: periodoId,
      docenteId,
      nombre: 'Matematicas I',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-06-30T00:00:00.000Z'),
      grupos: ['A']
    });

    const alumno = await Alumno.create({
      docenteId,
      periodoId,
      matricula: '2024-001',
      nombres: 'Ana',
      apellidos: 'Lopez',
      nombreCompleto: 'Ana Lopez',
      grupo: 'A'
    });

    const pregunta = await BancoPregunta.create({
      docenteId,
      periodoId,
      tema: 'Algebra',
      versiones: [
        {
          numeroVersion: 1,
          enunciado: '2+2=?',
          opciones: [
            { texto: '4', esCorrecta: true },
            { texto: '3', esCorrecta: false },
            { texto: '5', esCorrecta: false },
            { texto: '1', esCorrecta: false },
            { texto: '0', esCorrecta: false }
          ]
        }
      ]
    });

    await ExamenPlantilla.create({
      docenteId,
      periodoId,
      tipo: 'parcial',
      titulo: 'Parcial 1',
      numeroPaginas: 1,
      preguntasIds: [pregunta._id]
    });

    const reqExport = {
      body: { periodoId, incluirPdfs: false },
      docenteId
    } as SolicitudDocente;
    const resExport = crearRespuesta();

    await exportarPaquete(reqExport, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      paqueteBase64: string;
      conteos: Record<string, number>;
    };

    expect(payload.paqueteBase64).toBeTruthy();
    expect(payload.conteos.periodos).toBe(1);
    expect(payload.conteos.alumnos).toBe(1);
    expect(payload.conteos.bancoPreguntas).toBe(1);
    expect(payload.conteos.plantillas).toBe(1);

    await Promise.all([
      Alumno.deleteMany({ docenteId }),
      BancoPregunta.deleteMany({ docenteId }),
      ExamenPlantilla.deleteMany({ docenteId }),
      Periodo.deleteMany({ docenteId })
    ]);

    const reqImport = {
      body: { paqueteBase64: payload.paqueteBase64 },
      docenteId
    } as SolicitudDocente;
    const resImport = crearRespuesta();

    await importarPaquete(reqImport, resImport);

    expect(await Periodo.countDocuments({ docenteId })).toBe(1);
    expect(await Alumno.countDocuments({ docenteId })).toBe(1);
    expect(await BancoPregunta.countDocuments({ docenteId })).toBe(1);
    expect(await ExamenPlantilla.countDocuments({ docenteId })).toBe(1);

    // Idempotencia: reimportar no duplica ni rompe.
    await importarPaquete(reqImport, crearRespuesta());
    expect(await Alumno.countDocuments({ docenteId })).toBe(1);

    const alumnoImportado = await Alumno.findById(alumno._id).lean();
    expect(alumnoImportado?.nombreCompleto).toBe('Ana Lopez');
  });

  it('no sobreescribe registros mas nuevos (LWW por updatedAt)', async () => {
    const docenteId = '507f1f77bcf86cd799439022';
    const periodoId = '507f1f77bcf86cd799439021';

    await Periodo.create({
      _id: periodoId,
      docenteId,
      nombre: 'Fisica',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-06-30T00:00:00.000Z')
    });

    const alumno = await Alumno.create({
      docenteId,
      periodoId,
      matricula: '2024-002',
      nombres: 'Luis',
      apellidos: 'Perez',
      nombreCompleto: 'Luis Perez',
      grupo: 'B'
    });

    const reqExport = {
      body: { periodoId, incluirPdfs: false },
      docenteId
    } as SolicitudDocente;
    const resExport = crearRespuesta();
    await exportarPaquete(reqExport, resExport);
    const payload = (resExport.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { paqueteBase64: string };

    // Hacemos el registro local mas nuevo que el del paquete.
    await Alumno.updateOne({ _id: alumno._id }, { $set: { nombreCompleto: 'Luis Perez (editado)' } });
    const alumnoAntes = await Alumno.findById(alumno._id).lean();
    expect(alumnoAntes?.nombreCompleto).toBe('Luis Perez (editado)');

    const reqImport = {
      body: { paqueteBase64: payload.paqueteBase64 },
      docenteId
    } as SolicitudDocente;

    await importarPaquete(reqImport, crearRespuesta());
    const alumnoDespues = await Alumno.findById(alumno._id).lean();
    expect(alumnoDespues?.nombreCompleto).toBe('Luis Perez (editado)');
  });
});
