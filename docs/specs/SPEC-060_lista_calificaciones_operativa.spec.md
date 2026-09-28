---
id: SPEC-060-LISTA-CALIFICACIONES-OPERATIVA
titulo: Lista de calificaciones operativa
version: 1.3.0
fecha: 2026-09-28
autor: Codex / Agente IA
modulo: modulo_analiticas_modulo_calificacion
estado: approved
---

# SPEC-060: Lista de calificaciones operativa

## Contexto

Permitir que el docente consulte por materia la lista completa de alumnos, distinga
Parcial 1, Parcial 2, Global y Final, abra la revisión del alumno y modifique una
calificación existente sin crear duplicados. Las exportaciones deben conservar la
plantilla institucional de captura física; la hoja de cálculo de referencia del
usuario es un formato de entrada/validación, no una instrucción normativa adicional.

La fuente de verdad para los encabezados físicos es el libro compartido por el
docente. “Tareas y Ejercicios 2do Parcial” refleja el promedio acumulado de las
actividades seleccionadas de Classroom; “Practica 2do Parcial” es captura manual;
“Evaluación Continua 2do Parcial” sigue la fórmula de la plantilla.

## Requisitos Funcionales

- REQ-001: La lista académica debe exponer una consulta autenticada por `periodoId`.
- REQ-002: La agregación debe conservar los tres cortes y ser determinista cuando
  existan varias calificaciones del mismo alumno.
- REQ-003: Recalificar el mismo examen debe actualizar la calificación vigente y no
  crear otra fila.
- REQ-004: La pantalla docente debe permitir buscar, filtrar, ordenar y seleccionar
  un alumno para abrir revisión manual.
- REQ-005: CSV y XLSX deben consumir la misma agregación que la consulta y distinguir
  Parcial 1 de Parcial 2 usando el título de la plantilla cuando sea necesario.
- REQ-006: La interfaz debe conservar etiquetas accesibles, estados de carga/error/
  vacío/éxito y comportamiento responsive.
- REQ-007: Para la columna “Tareas y Ejercicios 2do Parcial”, considerar únicamente
  actividades vinculadas explícitamente al segundo parcial, activas e incluidas en
  la selección docente, con nota publicada en Classroom. Por defecto se incluyen
  todas las actividades activas mapeadas a ese parcial; el docente puede excluir
  cualquiera y seleccionar una o varias. Calcular `10 × suma(puntos obtenidos) /
  suma(puntos posibles)`; los
  puntos posibles deben ser positivos. Una nota publicada de cero cuenta como cero.
  Notas provisionales, entregas no calificadas y actividades sin mapeo se excluyen;
  una falta cuenta cero solo si Classroom publicó cero o si el docente la marca
  explícitamente como faltante en EvaluaPro después de vencer la actividad. Nunca
  se inferirá una falta únicamente por ausencia de calificación.
- REQ-008: La escala “Tareas y Ejercicios 2do Parcial” es 0–10. La columna
  “Evaluación Continua 2do Parcial” conserva escala 0–5 y se calcula como
  `(0.60 × Tareas y Ejercicios 2do Parcial + 0.40 × Practica 2do Parcial) / 2`;
  práctica no capturada mantiene el resultado incompleto, no se sustituye por cero.
- REQ-009: El resultado automático de Classroom y la calificación manual del
  examen impreso/OMR deben mostrarse como datos distintos; la sincronización no
  debe sobrescribir una calificación manual.
- REQ-010: La preferencia de inclusión de cada actividad en “Tareas y Ejercicios
  2do Parcial” se guarda por docente y materia, separada de su sincronización
  activa; cambiarla no modifica calificaciones ni elimina evidencias.
- REQ-011: El docente puede marcar por alumno y actividad vencida una entrega como
  faltante; solo esa confirmación explícita agrega cero puntos obtenidos y los
  puntos máximos al denominador de “Tareas y Ejercicios 2do Parcial”.
- REQ-012: La lista física conserva exactamente los encabezados, orden, duplicados,
  fórmulas y escalas de la plantilla original compartida. El promedio acumulado
  ponderado por puntos de las actividades elegidas en Classroom alimenta
  “Tareas y Ejercicios 2do Parcial”; “Practica 2do Parcial” sigue siendo captura
  manual; “Evaluación Continua 2do Parcial” mantiene la fórmula de la plantilla,
  y “Exámen 2do Parcial” y “Calificación Segundo Parcial” conservan sus columnas
  y fórmula original.
- REQ-013: Por defecto, todas las actividades mapeadas, activas y elegibles del
  segundo parcial se incluyen en el promedio acumulado de Classroom. En
  “Classroom”, el docente puede elegir una o varias actividades para incluir;
  cero selecciones dejan “Tareas y Ejercicios 2do Parcial” en blanco, no en cero.
  La selección se persiste por docente y materia, sin modificar calificaciones ni evidencias.
- REQ-014: En el detalle del alumno, el docente puede confirmar o retirar una
  falta de una actividad seleccionada vencida y sin calificación publicada. La
  confirmación agrega cero puntos obtenidos y sus puntos máximos al denominador
  de “Tareas y Ejercicios 2do Parcial”; no crea ni modifica una nota en Classroom.

## Criterios de Aceptación

- AC-001: `GET /api/analiticas/lista-academica?periodoId=...` responde `filas` y
  exige permiso `analiticas:leer`.
- AC-002: Un conjunto con Parcial 1, Parcial 2 y Global produce tres columnas
  correctas y el Final prioriza Global, después Parcial 2 y después Parcial 1.
- AC-003: Dos guardados del mismo `examenGeneradoId` dejan una sola calificación
  persistida y la segunda respuesta es la vigente.
- AC-004: La UI muestra contadores, filtros, búsqueda, orden y acción de revisión;
  los estados no exitosos son visibles y accionables.
- AC-005: Las exportaciones de calificaciones consumen la misma clasificación de
  cortes y mantienen la plantilla productiva.
- AC-006: Las actividades de Classroom sin mapeo, sin nota publicada, con puntos
  máximos nulos/cero o solo con nota provisional no alteran la columna de tareas;
  las notas publicadas de cero sí entran en el promedio ponderado por puntos.
- AC-007: La lista y el XLSX exponen el promedio de tareas con nombre de columna y
  escala correcta, sin presentar una práctica o nota de examen ausente como cero.
- AC-008: El puntaje automático del examen permanece identificable como tal y no
  reemplaza el valor manual de “Exámen 2do Parcial”.
- AC-009: Si no hay exclusiones explícitas, se promedian todas las actividades
  activas mapeadas al segundo parcial. Excluir una actividad modifica el promedio
  de “Tareas y Ejercicios 2do Parcial”, conservando las demás y su ponderación por
  puntos; el cambio persiste al recargar la vista y no altera las columnas
  “Practica 2do Parcial”, “Evaluación Continua 2do Parcial” ni “Exámen 2do Parcial”.
- AC-010: La exportación conserva los nombres, posiciones, duplicados y fórmulas
  de la plantilla compartida: “Evaluación Continua 2do Parcial” es
  `(0.60 × Tareas y Ejercicios 2do Parcial + 0.40 × Practica 2do Parcial) / 2`,
  y “Calificación Segundo Parcial” es la suma de la evaluación continua y
  “Exámen 2do Parcial”.
- AC-011: Marcar una entrega no vencida, con calificación publicada, ajena al
  segundo parcial o no mapeada debe rechazarse. Marcar una entrega elegible como
  faltante debe persistir por alumno/actividad, reflejar cero solo en el promedio
  de tareas y conservar práctica, evaluación continua y examen en sus columnas.
- AC-012: La exportación usa la plantilla original sin renombrar ni reordenar
  encabezados; conserva el promedio acumulado de las actividades seleccionadas,
  la captura manual y las fórmulas originales de las columnas implicadas.
- AC-013: Al iniciar sin exclusiones, todas las actividades elegibles aparecen
  seleccionadas; excluir/incluir una actividad persiste tras recargar. Con una o
  varias selecciones se recalcula “Tareas y Ejercicios 2do Parcial” ponderado por
  puntos; con ninguna, queda vacío. Las notas y evidencias de Classroom permanecen
  sin cambios.
- AC-014: El detalle muestra actividad, fecha límite, puntos y estado. Solo ofrece
  marcar faltante a una actividad elegible, vencida y sin nota publicada; quitar
  la marca recalcula la proyección. La operación no escribe en Classroom.

## Matriz de Trazabilidad

| ID Requisito | Descripción del caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001/002/005 | Lista académica, orden determinista y cortes | `apps/backend/tests/listaAcademicaResumen.test.ts` | Implementado |
| REQ-003 | Recalificar sin duplicar | `apps/backend/tests/calificacion.persistencia.test.ts` | Existente |
| REQ-004/006 | Consulta por alumno y accesibilidad | `apps/frontend/tests/consultaCalificaciones.test.tsx` | Implementado |
| REQ-007/008 | Promedios, pesos, escala y blancos | `apps/backend/tests/listaAcademicaResumen.test.ts` | Implementado |
| REQ-009 | Mantener OMR separado de la nota manual | `apps/backend/tests/calificacion.persistencia.test.ts` | Existente |
| REQ-010/013 | Selección de actividades de Classroom | `apps/frontend/tests/seccionClassroom.test.tsx` | Implementado |
| REQ-011/014 | Confirmar faltante vencido | `apps/frontend/tests/consultaCalificaciones.test.tsx` | Implementado |
| REQ-012 | Formato, encabezados y fórmulas de las columnas físicas | `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts` | Implementado |
