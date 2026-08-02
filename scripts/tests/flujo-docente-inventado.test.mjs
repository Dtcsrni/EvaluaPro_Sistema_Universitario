/**
 * flujo-docente-inventado.test.mjs
 *
 * Prueba de simulación del Flujo Docente Integral Completo con datos inventados:
 * 1. Alta de Docente ("Dr. Roberto Gómez Cárdenas") y Materia ("Sistemas Distribuidos LISC 2026").
 * 2. Inscripción de 5 Alumnos Inventados.
 * 3. Banco de Preguntas y plantilla de Examen de 10 reactivos.
 * 4. Calificación autoritativa de Examen Parcial y Global (fórmula exacta LISC).
 * 5. Clasificación OMR: Captura de alta confianza vs Cuarentena Protegida (REQ-001/REQ-002).
 * 6. Consolidación de Política de Encuadre LISC 2026 (Corte 1, 2, 3 y Nota Final).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// --- Reglas de Negocio Autoritativas del Sistema ---

/**
 * Regla REQ-001: Clasificación de imágenes OMR
 */
function evaluarAutoCalificableOmr(params) {
  const hardStop =
    params.estadoAnalisis !== 'ok' ||
    params.confianzaPromedioPagina <= 0.30 ||
    params.ratioAmbiguas >= 0.85 ||
    params.calidadPagina < 0.50;

  return {
    hardStop,
    autoCalificableOmr: !hardStop
  };
}

/**
 * Regla de Calificación Parcial y Global
 */
function calcularCalificacion(aciertos, totalReactivos, bonoSolicitado = 0, evaluacionContinua = 0, proyecto = 0, tipoExamen = 'parcial') {
  const base = Math.min(10, (aciertos / totalReactivos) * 10 + bonoSolicitado);
  const baseTexto = base.toFixed(1);

  if (tipoExamen === 'parcial') {
    const parcial = (base * 0.5) + (evaluacionContinua * 0.5);
    return {
      calificacionFinalTexto: baseTexto,
      calificacionParcialTexto: parcial.toFixed(1)
    };
  }

  const global = (base * 0.5) + (proyecto * 0.5);
  return {
    calificacionFinalTexto: baseTexto,
    calificacionGlobalTexto: global.toFixed(1)
  };
}

/**
 * Regla de Examen de Corte (60% teórico + 40% práctica)
 */
function calcularExamenCorte(teoricoDecimal, practicas) {
  const promedioPractica = practicas.reduce((a, b) => a + b, 0) / practicas.length;
  return Number(((teoricoDecimal * 0.6) + (promedioPractica * 0.4)).toFixed(2));
}

/**
 * Regla de Política LISC 2026 (50% continua acumulada + 50% exámenes parciales/global)
 */
function calcularPoliticaLisc(continuaPorCorte, examenesPorCorte) {
  const bloqueContinua = (continuaPorCorte.c1 * 0.2) + (continuaPorCorte.c2 * 0.2) + (continuaPorCorte.c3 * 0.6);
  const bloqueExamenes = (examenesPorCorte.parcial1 * 0.2) + (examenesPorCorte.parcial2 * 0.2) + (examenesPorCorte.global * 0.6);
  const finalDecimal = (bloqueContinua * 0.5) + (bloqueExamenes * 0.5);
  const finalRedondeada = finalDecimal < 6 ? Math.floor(finalDecimal) : Math.round(finalDecimal);

  return {
    bloqueContinuaDecimal: Number(bloqueContinua.toFixed(2)),
    bloqueExamenesDecimal: Number(bloqueExamenes.toFixed(2)),
    finalDecimal: Number(finalDecimal.toFixed(2)),
    finalRedondeada
  };
}

// --- Suite de Pruebas del Flujo Docente ---

test('Flujo Docente Integral Completo (Materia y Alumnos Inventados)', async (t) => {

  await t.test('Paso 1: Configuración del Docente y Materia Inventada', () => {
    const docente = {
      id: 'doc-101',
      nombreCompleto: 'Dr. Roberto Gómez Cárdenas',
      correo: 'roberto.gomez@universidad.edu.mx'
    };
    const periodo = {
      id: 'per-2026-1',
      nombre: 'Sistemas Distribuidos LISC 2026',
      codigo: 'SD-LISC-2026',
      fechaInicio: '2026-01-15',
      fechaFin: '2026-06-30'
    };

    assert.equal(docente.nombreCompleto, 'Dr. Roberto Gómez Cárdenas');
    assert.equal(periodo.nombre, 'Sistemas Distribuidos LISC 2026');
  });

  await t.test('Paso 2: Registro e Inscripción de 5 Alumnos Inventados', () => {
    const alumnos = [
      { id: 'alu-01', matricula: 'CUH512410101', nombre: 'Juan Carlos Pérez Mendoza' },
      { id: 'alu-02', matricula: 'CUH512410102', nombre: 'María Fernanda Rodríguez Silva' },
      { id: 'alu-03', matricula: 'CUH512410103', nombre: 'Carlos Eduardo López Hernán' },
      { id: 'alu-04', matricula: 'CUH512410104', nombre: 'Ana Beatriz Martínez Castro' },
      { id: 'alu-05', matricula: 'CUH512410105', nombre: 'Roberto Antonio Sánchez Ruiz' }
    ];

    assert.equal(alumnos.length, 5);
    assert.equal(alumnos[0].matricula, 'CUH512410101');
    assert.equal(alumnos[4].nombre, 'Roberto Antonio Sánchez Ruiz');
  });

  await t.test('Paso 3: Creación de Banco de Preguntas y Examen Teórico (10 Reactivos)', () => {
    const reactivos = Array.from({ length: 10 }, (_, i) => ({
      id: `reactivo-${i + 1}`,
      enunciado: `¿Pregunta sobre Sistemas Distribuidos #${i + 1}?`,
      opcionCorrecta: 'A'
    }));

    assert.equal(reactivos.length, 10);
    assert.equal(reactivos[0].opcionCorrecta, 'A');
  });

  await t.test('Paso 4: Procesamiento OMR: Alta Confianza vs Cuarentena Protegida (SPEC-OMR-CUARENTENA-RETENCION)', () => {
    // Alumno 1: Hoja OMR nítida -> Autocalificable
    const omrNormal = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.92,
      ratioAmbiguas: 0.02
    });
    assert.equal(omrNormal.hardStop, false);
    assert.equal(omrNormal.autoCalificableOmr, true);

    // Alumno 2: Hoja OMR defectuosa / borrosa -> Cuarentena Protegida (REQ-001)
    const omrCuarentena = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.60,
      confianzaPromedioPagina: 0.25, // <= 0.30 -> Cuarentena
      ratioAmbiguas: 0.10
    });
    assert.equal(omrCuarentena.hardStop, true);
    assert.equal(omrCuarentena.autoCalificableOmr, false);
  });

  await t.test('Paso 5: Calificación Autoritativa de Exámenes y Componentes', () => {
    // Alumno 1: 9 aciertos de 10 en Parcial 1 con continua de 8.5
    const parcial1 = calcularCalificacion(9, 10, 0, 8.5, 0, 'parcial');
    assert.equal(parcial1.calificacionFinalTexto, '9.0');
    assert.equal(parcial1.calificacionParcialTexto, '8.8');

    // Alumno 1: 10 aciertos de 10 en Examen Global con proyecto de 9.0
    const global = calcularCalificacion(10, 10, 0, 0, 9.0, 'global');
    assert.equal(global.calificacionFinalTexto, '10.0');
    assert.equal(global.calificacionGlobalTexto, '9.5');
  });

  await t.test('Paso 6: Cálculo de Examen de Corte y Nota Final con Política LISC 2026', () => {
    // Examen C1 (60% teórico 9.0 + 40% práctica 8.5)
    const examenC1 = calcularExamenCorte(9.0, [8.5]);
    assert.equal(examenC1, 8.8);

    // Evaluación global del curso LISC 2026 para Juan Carlos Pérez Mendoza
    const resultadoFinal = calcularPoliticaLisc(
      { c1: 8.5, c2: 8.0, c3: 9.0 },       // Continua por corte (20%, 20%, 60%)
      { parcial1: 8.8, parcial2: 8.0, global: 9.5 } // Exámenes por corte (20%, 20%, 60%)
    );

    assert.equal(resultadoLiscValido(resultadoFinal), true);
    assert.equal(resultadoFinal.finalRedondeada, 9); // Calificación final 8.9 -> 9 Aprobado
  });
});

function resultadoLiscValido(resultado) {
  return typeof resultado.finalDecimal === 'number' && resultado.finalDecimal >= 0 && resultado.finalDecimal <= 10;
}
