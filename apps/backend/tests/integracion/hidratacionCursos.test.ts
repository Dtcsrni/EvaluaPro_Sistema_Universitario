/**
 * Pruebas de integración para hidratación de cursos iniciados.
 */
import request from 'supertest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { registrarDocente } from './_flujoDocenteHelper';

async function crearXlsxCalificaciones() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('LIBRO DE CALIFICACIONES');
  sheet.getCell('D1').value = 'Centro Universitario Hidalguense';
  sheet.getCell('C10').value = 'Nombre del alumno';
  sheet.getCell('D10').value = 'Id. del alumno';
  sheet.getCell('E10').value = 'Correo Alumno';
  sheet.getCell('F10').value = 'Primer Parcial';
  sheet.getCell('G10').value = 'Segundo Parcial';
  sheet.getCell('C11').value = 'ALUMNA UNO';
  sheet.getCell('D11').value = 'CUH001';
  sheet.getCell('E11').value = 'cuh001@cuh.mx';
  sheet.getCell('F11').value = 8.5;
  sheet.getCell('G11').value = 9;
  sheet.getCell('C12').value = 'ALUMNO DOS';
  sheet.getCell('D12').value = 'CUH002';
  sheet.getCell('E12').value = 'cuh002@cuh.mx';
  sheet.getCell('F12').value = 7;
  sheet.getCell('G12').value = 8;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function crearDocxParcial() {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Examen Primer Parcial Electrónica y Aplicaciones Digitales</w:t></w:r></w:p>
        <w:p><w:r><w:t>1. Un sistema digital representa información mediante niveles discretos.</w:t></w:r></w:p>
        <w:p><w:r><w:t>A) Continuo B) Discreto C) Analogico D) Ninguno</w:t></w:r></w:p>
      </w:body>
    </w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Integración: Hidratación de cursos iniciados', () => {
  const app = crearApp();
  let auth: { Authorization: string };
  let periodoId: string;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    const token = await registrarDocente(app, 'docente-hidratacion@prueba.test');
    auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Electrónica y Aplicaciones Digitales',
        fechaInicio: '2026-05-18',
        fechaFin: '2026-06-26',
        grupos: ['A']
      })
      .expect(201);
    periodoId = periodoResp.body.periodo._id;
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('previsualiza XLSX/DOCX e importa alumnos y evidencias de forma idempotente', async () => {
    const xlsx = await crearXlsxCalificaciones();
    const docx = await crearDocxParcial();

    const previewResp = await request(app)
      .post('/api/hidratacion-cursos/preview')
      .set(auth)
      .field('periodoId', periodoId)
      .attach('archivos', xlsx, 'electro_app_digital_mayo-junio.xlsx')
      .attach('archivos', docx, 'Examen_Primer_Parcial_Electronica.docx')
      .expect(200);

    expect(previewResp.body.planImportacion.alumnosDetectados).toBe(2);
    expect(previewResp.body.planImportacion.documentosDetectados).toBe(1);
    expect(previewResp.body.archivos[0].tipo).toBe('lista_calificaciones_xlsx');
    expect(previewResp.body.archivos[0].filaEncabezado).toBe(10);
    expect(previewResp.body.archivos[1].tipo).toBe('parcial_externo');
    expect(previewResp.body.archivos[1].reactivosDetectados).toBeGreaterThan(0);

    const importarResp = await request(app)
      .post('/api/hidratacion-cursos/importar')
      .set(auth)
      .field('periodoId', periodoId)
      .attach('archivos', xlsx, 'electro_app_digital_mayo-junio.xlsx')
      .attach('archivos', docx, 'Examen_Primer_Parcial_Electronica.docx')
      .expect(201);

    expect(importarResp.body.resumen.alumnosCreados).toBe(2);
    expect(importarResp.body.resumen.evidenciasHistoricasCreadas).toBe(4);
    expect(importarResp.body.resumen.evidenciasDocumentalesCreadas).toBe(1);

    await request(app)
      .post('/api/hidratacion-cursos/importar')
      .set(auth)
      .field('periodoId', periodoId)
      .attach('archivos', xlsx, 'electro_app_digital_mayo-junio.xlsx')
      .attach('archivos', docx, 'Examen_Primer_Parcial_Electronica.docx')
      .expect(201);

    const alumnos = await prisma.alumno.findMany({ where: { periodoId, matricula: { in: ['CUH001', 'CUH002'] } } });
    const evidenciasHistoricas = await prisma.evidenciaEvaluacion.findMany({
      where: { periodoId, fuente: 'importacion_xlsx' }
    });
    const evidenciasDocx = await prisma.evidenciaEvaluacion.findMany({
      where: { periodoId, fuente: 'importacion_docx' }
    });

    expect(alumnos).toHaveLength(2);
    expect(evidenciasHistoricas).toHaveLength(4);
    expect(evidenciasDocx).toHaveLength(1);
  });
});
