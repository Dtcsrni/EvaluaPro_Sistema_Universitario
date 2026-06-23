import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  generarPdfEncuadreBase,
  registrarFirmaPdf,
  calcularHashFirma
} from '../src/modulos/modulo_evaluaciones/servicioEncuadrePdf';

describe('servicioEncuadrePdf', () => {
  const mockParams = {
    asignatura: 'Diseño Digital',
    docenteNombre: 'Erick Renato Vega Ceron',
    carrera: 'Ingeniería en Sistemas Computacionales',
    cicloLectivo: 'Del 18 de mayo al 26 de junio de 2026',
    clave: 'ISCF213',
    area: 'Área de Ingeniería',
    horasDocente: 50,
    horasIndependientes: 100,
    horasTotales: 150,
    creditos: 6.25,
    objetivoGeneral: 'El alumno aplicará principios de análisis y diseño de circuitos electrónicos y digitales para interpretar circuitos integrados.',
    alumnos: [
      { id: 'al-1', nombreCompleto: 'Juan Perez Gomez', matricula: '2026001', correo: '2026001@cuh.mx' },
      { id: 'al-2', nombreCompleto: 'Maria Lopez Diaz', matricula: '2026002', correo: '2026002@cuh.mx' }
    ]
  };

  it('debe generar un PDF base de dos páginas con la información del encuadre', async () => {
    const pdfBuffer = await generarPdfEncuadreBase(mockParams);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it('debe calcular un hash de firma consistente', () => {
    const payload = {
      usuarioId: 'docente-1',
      correo: 'docente@cuh.mx',
      fecha: '2026-06-23T05:55:22.000Z',
      direccionIp: '192.168.1.5'
    };
    const hash1 = calcularHashFirma('my_secret_key', payload);
    const hash2 = calcularHashFirma('my_secret_key', payload);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it('debe estampar la firma del docente y del alumno en el PDF sin corromperlo', async () => {
    const pdfBuffer = await generarPdfEncuadreBase(mockParams);
    
    // Firmar docente
    const pdfConDocente = await registrarFirmaPdf(pdfBuffer, {
      rol: 'docente',
      usuarioId: 'docente-1',
      nombreFirmante: mockParams.docenteNombre,
      correo: 'docente@cuh.mx',
      ip: '192.168.1.10',
      hash: 'HASH1234567890AB',
      fecha: new Date()
    });
    
    expect(pdfConDocente).toBeInstanceOf(Buffer);
    expect(pdfConDocente.length).toBeGreaterThan(0);

    // Firmar alumno index 0
    const pdfConAlumno = await registrarFirmaPdf(pdfConDocente, {
      rol: 'alumno',
      usuarioId: 'al-1',
      nombreFirmante: 'Juan Perez Gomez',
      correo: '2026001@cuh.mx',
      ip: '192.168.1.11',
      hash: 'HASHAL1234567890',
      fecha: new Date(),
      alumnoIndex: 0
    });

    expect(pdfConAlumno).toBeInstanceOf(Buffer);
    const docFinal = await PDFDocument.load(pdfConAlumno);
    expect(docFinal.getPageCount()).toBe(2);
  });
});
