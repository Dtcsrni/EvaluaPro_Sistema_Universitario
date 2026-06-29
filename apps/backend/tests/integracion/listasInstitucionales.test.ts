/**
 * Pruebas de integracion para listas institucionales por plantilla.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { registrarDocente } from './_flujoDocenteHelper';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (options: { data: Buffer }) => { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> };
};

async function extraerTextoPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

function parsearBinario(res: NodeJS.ReadableStream & { setEncoding: (encoding: string) => void }, cb: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

function rutaClase(...partes: string[]) {
  return path.join('C:', 'Users', 'evega', 'OneDrive', 'Clases CUH', ...partes);
}

describe('Integracion: listas institucionales por plantilla', () => {
  const app = crearApp();
  let auth: { Authorization: string };
  let periodoId: string;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    const token = await registrarDocente(app, 'docente-listas-institucionales@prueba.test');
    auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Electronica y Aplicaciones Digitales',
        fechaInicio: '2026-05-18',
        fechaFin: '2026-06-26',
        grupos: ['23']
      })
      .expect(201);
    periodoId = periodoResp.body.periodo._id;
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('hidrata XLSX reales mayo-junio con alumnos y calificaciones AL:BA', async () => {
    const electronica = rutaClase('Electronica y Aplicaciones Digitales', 'electro_app_digital_mayo-junio.xlsx');
    const calidad = rutaClase('Administracion de la Calidad', 'admin_calidad_mayo_junio.xlsx');
    expect(fs.existsSync(electronica)).toBe(true);
    expect(fs.existsSync(calidad)).toBe(true);

    const previewElectronica = await request(app)
      .post('/api/hidratacion-cursos/preview')
      .set(auth)
      .field('periodoId', periodoId)
      .attach('archivos', electronica)
      .expect(200);
    expect(previewElectronica.body.planImportacion.alumnosDetectados).toBe(9);
    expect(previewElectronica.body.planImportacion.evidenciasHistoricasDetectadas).toBeGreaterThanOrEqual(90);

    const importarElectronica = await request(app)
      .post('/api/hidratacion-cursos/importar')
      .set(auth)
      .field('periodoId', periodoId)
      .attach('archivos', electronica)
      .expect(201);
    expect(importarElectronica.body.resumen.alumnosCreados).toBe(9);
    expect(importarElectronica.body.resumen.evidenciasHistoricasCreadas).toBeGreaterThanOrEqual(90);

    const evidenciasElectronica = await prisma.evidenciaEvaluacion.findMany({
      where: { periodoId, fuente: 'importacion_xlsx' }
    });
    expect(evidenciasElectronica.some((ev) => ev.titulo.includes('Calificación Final'))).toBe(true);
    expect(evidenciasElectronica.some((ev) => ev.titulo.includes('Primer Parcial'))).toBe(true);

    const periodoCalidad = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Administracion de la Calidad',
        fechaInicio: '2026-05-18',
        fechaFin: '2026-06-26',
        grupos: ['E512604A']
      })
      .expect(201);

    const previewCalidad = await request(app)
      .post('/api/hidratacion-cursos/preview')
      .set(auth)
      .field('periodoId', periodoCalidad.body.periodo._id)
      .attach('archivos', calidad)
      .expect(200);
    expect(previewCalidad.body.planImportacion.alumnosDetectados).toBe(1);
    expect(previewCalidad.body.planImportacion.evidenciasHistoricasDetectadas).toBeGreaterThanOrEqual(14);
  });

  it('lista plantillas y genera CUH en XLSX y PDF', async () => {
    await prisma.alumno.createMany({
      data: [
        {
          periodoId,
          matricula: 'CUH512410115',
          nombreCompleto: 'CAZARES LEDESMA DIEGO',
          correo: 'CUH512410115@CUH.MX',
          grupo: '23',
          activo: true
        },
        {
          periodoId,
          matricula: 'CUH51239870',
          nombreCompleto: 'CRUZ JUAREZ LUIS ALBERTO',
          correo: 'CUH51239870@CUH.MX',
          grupo: '23',
          activo: true
        }
      ]
    });

    const plantillas = await request(app).get('/api/listas-institucionales/plantillas').set(auth).expect(200);
    expect(plantillas.body.plantillas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'asistencia_cuh_control',
          institucion: 'Centro Universitario Hidalguense A.C.',
          formatos: expect.arrayContaining(['xlsx', 'pdf'])
        })
      ])
    );

    const xlsxResp = await request(app)
      .get(`/api/listas-institucionales/generar?periodoId=${periodoId}&templateId=asistencia_cuh_control&formato=xlsx`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(xlsxResp.headers['content-type']).toContain('spreadsheetml.sheet');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxResp.body);
    const ws = wb.getWorksheet('CONTROL DE ASISTENCIAS');
    expect(ws).toBeTruthy();
    expect(ws!.pageSetup.orientation).toBe('landscape');
    expect(ws!.getCell('A1').value).toBe('Centro Universitario Hidalguense A.C.');
    expect(ws!.getCell('A2').value).toBe('CONTROL DE ASISTENCIAS');
    expect(ws!.getCell('B6').value).toContain('CAZARES LEDESMA DIEGO');
    expect(ws!.getCell('B7').value).toContain('CUH512410115');
    expect(ws!.getCell('T4').value).toBe('FECHAS');
    expect(ws!.getCell('AL4').value).toBe('FECHAS');
    expect(ws!.getCell('A22').value).toContain('La presente lista es definitiva');
    expect(ws!.getCell('A30').value).toContain('NOMBRE Y FIRMA DEL CATEDRATICO');

    const pdfResp = await request(app)
      .get(`/api/listas-institucionales/generar?periodoId=${periodoId}&templateId=asistencia_cuh_control&formato=pdf`)
      .set(auth)
      .buffer(true)
      .parse(parsearBinario)
      .expect(200);
    expect(pdfResp.headers['content-type']).toContain('application/pdf');
    expect(pdfResp.body.byteLength).toBeGreaterThan(1000);
    const textoPdf = await extraerTextoPdf(pdfResp.body);
    expect(textoPdf).toContain('Centro Universitario Hidalguense A.C.');
    expect(textoPdf).toContain('CONTROL DE ASISTENCIAS');
  });
});
