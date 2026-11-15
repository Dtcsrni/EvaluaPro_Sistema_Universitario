---
id: SPEC-141
titulo: Revisión manual completa de respuestas OMR en EvaluaPro
version: 1.2.0
fecha: 2026-11-15
autor: Codex
modulo: modulo_escaneo_omr
estado: implemented
---

## Contexto

Una página OMR puede requerir revisión aunque el motor no haya detectado respuestas. La interfaz actual solo mostraba reactivos presentes en la detección, por lo que no permitía capturar respuestas de páginas con detección vacía. La revisión, asociación y corrección deben completarse en EvaluaPro, cotejando el escaneo con la página del examen generado y conservando la decisión humana y su motivo.

## Requisitos Funcionales

- REQ-001: El detalle de una ingesta entregará, para cada examen candidato, los números de reactivo por página obtenidos del mapa OMR persistido.
- REQ-002: La interfaz mostrará todos los reactivos de la página vinculada; si faltó detección OMR, ofrecerá captura manual por opción o sin marca. No permitirá guardar mientras haya reactivos sin confirmar o no exista un mapa verificable.
- REQ-003: Las respuestas con estado OMR `ambigua` o `doble_marca` quedarán como incorrectas (`opcion: null`) y no podrán sustituirse por una opción en la revisión manual.
- REQ-004: El backend verificará que la resolución manual incluya cada reactivo esperado una sola vez, con una opción permitida por la versión del examen o `null`; rechazará listas incompletas, duplicadas o incompatibles. La revisión seguirá en `needs_review`, sin escribir calificaciones.
- REQ-005: Una respuesta `sin_marca`, `ambigua`, `doble_marca` o `tachada` con `opcion: null` contará como incorrecta (cero aciertos) sin exigir revisión humana de esa respuesta cuando la página apruebe los controles globales de calidad, cobertura e identidad. Si el estado ambiguo incluye una opción, el sistema conservará el bloqueo.
- REQ-006: Una señal débil pero distinguible en una sola opción se tratará como respuesta cuando no exista una opción competidora claramente marcada. Una señal mínima sin evidencia suficiente no obtiene crédito. Dos opciones claramente marcadas se tratarán como ambigüedad y serán incorrectas; la decisión no dependerá del número del reactivo ni de la variante del examen.
- REQ-007: El corpus y las métricas sintéticas distinguirán respuestas débiles seleccionadas de manchas/ausencias no seleccionadas; una señal débil generada como respuesta no se etiquetará como inválida solo por su intensidad.

## Criterios de Aceptación

- AC-001: Una página de ingesta con `responses: []` y un mapa con reactivos 1–N presenta selectores accesibles para todos los reactivos y permite guardar solo después de confirmar cada respuesta.
- AC-002: La resolución enviada conserva todas las respuestas de la página, incluidos los blancos como `null`, y los identificadores de examen/página y motivo.
- AC-003: Las marcas múltiples o ambiguas se envían como `null`; la UI no permite elegir A–E y la API rechaza una opción no nula para ellas.
- AC-004: La API rechaza reactivos omitidos, duplicados, ajenos a la página o con opción ajena a la versión. No crea ni modifica calificaciones.
- AC-005: Con la página dentro de los umbrales globales, una respuesta ambigua o sin opción se guarda como `opcion: null`, no suma aciertos y la calificación queda en cero para ese reactivo; la misma respuesta con una opción seleccionada no se autocalifica.
- AC-006: Una marca débil única generada como respuesta se etiqueta con su opción y se acepta si el motor la detecta sin una competidora claramente marcada; dos marcas claras se rechazan como ambiguas y una señal por debajo del umbral de evidencia no obtiene crédito.
- AC-007: Las métricas contabilizan respuestas débiles esperadas como válidas y reservan la tasa de rechazo de inválidas para respuestas dobles/ambiguas, sin excepciones por identificador de captura o pregunta.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, AC-001 | Mapa de reactivos por página disponible para el editor | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado; prueba de integración aprobada |
| REQ-002, AC-001, AC-002 | Captura completa de reactivos no detectados en GUI y bloqueo hasta confirmar | `apps/frontend/tests/plantillasOmrWorkflow.test.tsx` | Implementado; 19 pruebas enfocadas aprobadas |
| REQ-003, AC-003 | Ambiguas/doble marca quedan incorrectas e inmutables en revisión manual | `apps/frontend/tests/plantillasOmrWorkflow.test.tsx`, `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado; pruebas enfocadas aprobadas |
| REQ-004, AC-004 | API exige conjunto exacto de reactivos y no escribe notas | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado; prueba de integración aprobada |
| REQ-005, AC-005 | Ambiguas y respuestas sin opción computan cero bajo controles globales | `apps/backend/tests/omr.politicaAutoCalificacion.test.ts`, `apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts` | Implementado; 9 pruebas aprobadas |
| REQ-006, AC-006 | Señal débil única válida, evidencia mínima sin crédito y marcas claras múltiples ambiguas | `apps/backend/tests/omr.tv4.synthetic.metrics.test.ts`, `apps/backend/tests/omr.politicaAutoCalificacion.test.ts` | Implementado; 11 regresiones OMR y 35 pruebas de política aprobadas |
| REQ-007, AC-007 | Etiquetado sintético y métricas coherentes con la intención de respuesta | `apps/backend/tests/omr.tv4.synthetic.metrics.test.ts` | Implementado; evaluación sintética completa aprobada |
