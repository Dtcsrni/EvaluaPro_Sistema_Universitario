/**
 * _flujoDocenteHelper
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import type { Express } from 'express';

export type EscenarioFlujoDocente = {
  token: string;
  auth: { Authorization: string };
  periodoId: string;
  alumnoId: string;
  examenId: string;
  folio: string;
  totalReactivosExamen: number;
};

export async function registrarDocente(app: Express, correo: string) {
  const respuesta = await request(app)
    .post('/api/autenticacion/registrar')
    .send({
      nombreCompleto: 'Docente Flujo',
      correo,
      contrasena: 'Secreto123!'
    })
    .expect(201);
  return respuesta.body.token as string;
}

export async function prepararEscenarioFlujo(
  app: Express,
  tipoExamen: 'parcial' | 'global',
  correoDocente: string
): Promise<EscenarioFlujoDocente> {
  const token = await registrarDocente(app, correoDocente);
  const auth = { Authorization: `Bearer ${token}` };

  const periodoResp = await request(app)
    .post('/api/periodos')
    .set(auth)
    .send({
      nombre: `Periodo ${tipoExamen.toUpperCase()} 2026`,
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-01',
      grupos: ['A']
    })
    .expect(201);
  const periodoId = periodoResp.body.periodo._id as string;

  const alumnoResp = await request(app)
    .post('/api/alumnos')
    .set(auth)
    .send({
      periodoId,
      matricula: tipoExamen === 'global' ? 'CUH512410169' : 'CUH512410168',
      nombreCompleto: `Alumno ${tipoExamen}`,
      correo: `alumno-${tipoExamen}@prueba.test`,
      grupo: 'A'
    })
    .expect(201);
  const alumnoId = alumnoResp.body.alumno._id as string;

  const preguntasIds: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const preguntaResp = await request(app)
      .post('/api/banco-preguntas')
      .set(auth)
      .send({
        periodoId,
        enunciado: `Pregunta ${tipoExamen} ${i + 1}`,
        opciones: [
          { texto: 'Opcion A', esCorrecta: true },
          { texto: 'Opcion B', esCorrecta: false },
          { texto: 'Opcion C', esCorrecta: false },
          { texto: 'Opcion D', esCorrecta: false },
          { texto: 'Opcion E', esCorrecta: false }
        ]
      })
      .expect(201);
    preguntasIds.push(preguntaResp.body.pregunta._id as string);
  }

  const plantillaResp = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: tipoExamen,
      titulo: `Examen ${tipoExamen}`,
      numeroPaginas: 1,
      preguntasIds
    })
    .expect(201);
  const plantillaId = plantillaResp.body.plantilla._id as string;

  const examenResp = await request(app)
    .post('/api/examenes/generados')
    .set(auth)
    .send({ plantillaId })
    .expect(201);
  const examenId = examenResp.body.examenGenerado._id as string;
  const folio = examenResp.body.examenGenerado.folio as string;
  const totalReactivosExamen = Array.isArray(examenResp.body.examenGenerado.preguntasIds)
    ? examenResp.body.examenGenerado.preguntasIds.length
    : 1;

  await request(app).post('/api/entregas/vincular-folio').set(auth).send({ folio, alumnoId }).expect(201);

  const payloadCalificacion =
    tipoExamen === 'global'
      ? {
          examenGeneradoId: examenId,
          alumnoId,
          aciertos: totalReactivosExamen,
          totalReactivos: totalReactivosExamen,
          bonoSolicitado: 0,
          evaluacionContinua: 5,
          proyecto: 5
        }
      : {
          examenGeneradoId: examenId,
          alumnoId,
          aciertos: totalReactivosExamen,
          totalReactivos: totalReactivosExamen,
          bonoSolicitado: 0.5,
          evaluacionContinua: 5
        };

  await request(app).post('/api/calificaciones/calificar').set(auth).send(payloadCalificacion).expect(201);

  return {
    token,
    auth,
    periodoId,
    alumnoId,
    examenId,
    folio,
    totalReactivosExamen
  };
}
