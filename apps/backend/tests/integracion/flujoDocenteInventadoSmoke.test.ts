/**
 * flujoDocenteInventadoSmoke.test.ts
 *
 * Simulación de prueba de flujo docente integral completo con datos inventados:
 * 1. Registro y autenticación de Docente ("Dr. Roberto Gómez Cárdenas").
 * 2. Creación de Periodo/Materia ("Sistemas Distribuidos LISC 2026").
 * 3. Inscripción de 5 alumnos inventados.
 * 4. Configuración de Política de Calificación LISC.
 * 5. Registro de Evidencias continuas y Exámenes parciales/global.
 * 6. Simulación de Escaneo OMR y Cuarentena Protegida.
 * 7. Generación de Resumen de Calificaciones y Faltantes.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno';
import { evaluarAutoCalificableOmr } from '../../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('Flujo Docente Integral Completo (Materia y Alumnos Inventados)', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('ejecuta el ciclo de vida académico completo del docente', async () => {
    // 1. Registrar Docente
    const docente = await Docente.create({
      _id: '607f1f77bcf86cd799439500',
      nombreCompleto: 'Dr. Roberto Gómez Cárdenas',
      correo: 'roberto.gomez@universidad.edu.mx',
      roles: ['docente'],
      activo: true
    });
    expect(docente.nombreCompleto).toBe('Dr. Roberto Gómez Cárdenas');

    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    const auth = { Authorization: `Bearer ${token}` };

    // 2. Crear Periodo/Materia Inventada
    const periodo = await Periodo.create({
      _id: '607f1f77bcf86cd799439501',
      docenteId: docente._id,
      nombre: 'Sistemas Distribuidos LISC 2026',
      fechaInicio: new Date('2026-01-15T00:00:00.000Z'),
      fechaFin: new Date('2026-06-30T00:00:00.000Z')
    });
    expect(periodo.nombre).toBe('Sistemas Distribuidos LISC 2026');

    // 3. Inscribir 5 Alumnos Inventados
    const datosAlumnos = [
      { matricula: 'CUH512410101', nombreCompleto: 'Juan Carlos Pérez Mendoza' },
      { matricula: 'CUH512410102', nombreCompleto: 'María Fernanda Rodríguez Silva' },
      { matricula: 'CUH512410103', nombreCompleto: 'Carlos Eduardo López Hernán' },
      { matricula: 'CUH512410104', nombreCompleto: 'Ana Beatriz Martínez Castro' },
      { matricula: 'CUH512410105', nombreCompleto: 'Roberto Antonio Sánchez Ruiz' }
    ];

    const alumnosCreados = [];
    for (let i = 0; i < datosAlumnos.length; i++) {
      const alumno = await Alumno.create({
        _id: `607f1f77bcf86cd79943951${i}`,
        docenteId: docente._id,
        periodoId: periodo._id,
        matricula: datosAlumnos[i].matricula,
        nombreCompleto: datosAlumnos[i].nombreCompleto
      });
      alumnosCreados.push(alumno);
    }
    expect(alumnosCreados).toHaveLength(5);

    // 4. Configurar Política de Calificación LISC
    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        cortes: [
          { numero: 1, nombre: 'Corte 1 - Arquitectura Base', fechaCorte: '2026-02-28T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 2, nombre: 'Corte 2 - RPC y Sockets', fechaCorte: '2026-04-30T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 3, nombre: 'Corte 3 - Consenso y Tolerancia a Fallos', fechaCorte: '2026-06-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.6 }
        ],
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
        reglasCierre: { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: true, continuaMinima: 6 }
      })
      .expect(200);

    // 5. Registrar Evidencias y Componentes Teóricos/Prácticos
    for (const alumno of alumnosCreados) {
      for (const [corteNum, fecha] of [[1, '2026-02-10T00:00:00.000Z'], [2, '2026-04-10T00:00:00.000Z'], [3, '2026-06-05T00:00:00.000Z']]) {
        await request(app)
          .post('/api/evaluaciones/evidencias')
          .set(auth)
          .send({
            periodoId: String(periodo._id),
            alumnoId: String(alumno._id),
            titulo: `Práctica de laboratorio C${corteNum}`,
            calificacionDecimal: 8.5,
            ponderacion: 1,
            fechaEvidencia: fecha
          })
          .expect(201);
      }

      for (const corte of ['parcial1', 'parcial2', 'global']) {
        await request(app)
          .post('/api/evaluaciones/examenes/componentes')
          .set(auth)
          .send({
            periodoId: String(periodo._id),
            alumnoId: String(alumno._id),
            corte,
            teoricoDecimal: 9.0,
            practicas: [8.5]
          })
          .expect(201);
      }
    }

    // 6. Verificar OMR y Cuarentena Protegida
    const omrOk = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.92,
      ratioAmbiguas: 0.02,
      coberturaDeteccion: 0.98
    });
    expect(omrOk.autoCalificableOmr).toBe(true);

    const omrBajaConfianza = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.60,
      confianzaPromedioPagina: 0.25,
      ratioAmbiguas: 0.10,
      coberturaDeteccion: 0.85
    });
    expect(omrBajaConfianza.hardStop).toBe(true);
    expect(omrBajaConfianza.autoCalificableOmr).toBe(false);

    // 7. Resumen de Calificación Final del Primer Alumno
    const primerAlumno = alumnosCreados[0];
    const respuestaResumen = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(primerAlumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    expect(respuestaResumen.body?.resumen).toBeDefined();
    expect(respuestaResumen.body?.resumen?.notaFinal).toBeGreaterThan(0);
  });
});
