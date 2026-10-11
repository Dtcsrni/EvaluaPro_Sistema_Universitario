---
id: SPEC-073
titulo: Generación y calificación independiente de exámenes extraordinarios
version: 1.2.3
fecha: 2026-10-05
autor: Codex / EvaluaPro Team
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

El flujo docente de generación de exámenes permite producir evaluaciones individuales y por lote. Se requiere una modalidad especial para extraordinarios que permita elegir alumnos concretos, generarles un examen identificable y conservar su resultado por separado de los parciales y globales. El extraordinario no debe reemplazar ni modificar calificaciones ordinarias.

Personas beneficiadas: docentes que programan oportunidades extraordinarias y alumnos seleccionados para presentarlas.

## Requisitos Funcionales

- **REQ-001 (Tipo extraordinario):** Durante la generación, el docente puede elegir el tipo fijo `Extraordinario`, además de las modalidades ordinarias existentes. En esta entrega no se habilitan tipos libres ni una lista configurable.
- **REQ-002 (Selección de alumnos):** El docente puede seleccionar uno o varios alumnos del periodo/materia asociados a la plantilla. La generación individual o por lote conserva el vínculo canónico con cada alumno seleccionado; no se generan copias para alumnos no seleccionados.
- **REQ-003 (Trazabilidad):** El tipo `Extraordinario` queda asociado al examen generado y es visible en el historial y en la consulta del resultado, sin depender únicamente del título de plantilla.
- **REQ-004 (Calificación aparte):** El flujo OMR/calificación existente puede registrar el resultado del extraordinario asociado al alumno y examen correspondientes. Dicho resultado se conserva como evaluación extraordinaria independiente y no sustituye ni modifica calificaciones de parcial/global ni sus agregados.
- **REQ-005 (Compatibilidad histórica):** Los exámenes y calificaciones preexistentes conservan su interpretación y comportamiento; no se reclasifican retrospectivamente como extraordinarios.
- **REQ-006 (Validaciones):** Se rechaza la generación extraordinaria si falta la plantilla, el tipo no es admitido, no hay alumnos seleccionados o algún alumno no pertenece al periodo/materia de la plantilla. Se conserva el flujo de generación idempotente y las confirmaciones existentes.
- **REQ-007 (Periodo concluido):** Se puede generar un extraordinario usando una plantilla y alumnos de la misma materia archivada. Esta vía solo lee los registros archivados necesarios, no reactiva ni modifica materia, alumnos, plantilla o reactivos. Una plantilla archivada no admite exámenes ordinarios y un alumno de otra materia se rechaza. La validación de vista previa se conserva fuera de los registros fuente archivados.
- **REQ-008 (Formato y cobertura):** El extraordinario de una plantilla global archivada se presenta en cuatro páginas (dos hojas impresas por ambos lados). El conjunto incluye las preguntas únicas del global y de los parciales archivados del mismo periodo/materia. La vista previa separa preguntas que caben, preguntas omitidas por capacidad tipográfica y reactivos parciales inválidos para OMR; la generación solo procede con una vista previa válida y revisión explícita.
- **REQ-009 (Título impreso):** La vista previa y el PDF generado de tipo extraordinario muestran exactamente `Examen Extraordinario` como título, sin cambiar el título de la plantilla archivada ni el título de los exámenes ordinarios.
- **REQ-010 (Instrucciones del extraordinario):** El PDF extraordinario usa indicaciones de respuesta OMR neutrales al examen fuente. No debe conservar instrucciones que lo describan como parcial o global.
- **REQ-011 (Historial y retención de parciales):** Los parciales de periodos archivados permanecen en el historial de la materia con sus registros y archivos descargables por defecto. La eliminación automática de sus archivos PDF está desactivada por defecto; el docente puede configurarla a 3, 6 o 12 meses. La retención solo elimina artefactos PDF de exámenes `parcial` cuyo periodo esté archivado; conserva el examen, el historial y las calificaciones.
- **REQ-012 (Integridad OMR de fuentes):** La generación ordinaria y el conjunto del global conservan la validación estricta: cada reactivo debe tener cinco opciones distintas y no vacías, con exactamente una correcta. Si un reactivo añadido desde un parcial no cumple el contrato, se excluye del PDF y la vista previa informa su ID y cada defecto por separado; no se inventan opciones ni claves. Las omisiones por OMR no se cuentan como omisiones por capacidad de página.

## Criterios de Aceptación

1. La interfaz ofrece `Extraordinario` como tipo seleccionable en la generación de exámenes.
2. La selección admite uno o varios alumnos válidos y la generación produce un examen vinculado por ID a cada alumno elegido.
3. El historial y el detalle distinguen los extraordinarios de parciales y globales.
4. Un resultado extraordinario se puede consultar y calificar por el flujo vigente, permanece separado y no cambia los campos ni agregados ordinarios del alumno.
5. Se rechazan selecciones vacías y alumnos ajenos al periodo/materia vinculados a la plantilla, sin persistir exámenes parciales.
6. Los registros históricos siguen mostrando el mismo tipo y resultado que antes del cambio.
7. La matriz de trazabilidad se actualiza con pruebas reales de UI, API, persistencia y exclusión de agregados.
8. En una materia archivada, Diseño de Exámenes ofrece la plantilla de archivo únicamente para extraordinario, permite elegir sus alumnos conservados y muestra el lote en historial; el examen queda vinculado a los IDs canónicos originales.
9. La generación ordinaria sigue bloqueada para materias/plantillas archivadas; crear el extraordinario no reactiva registros fuente ni modifica sus banderas de archivo.
10. El extraordinario de global archivado se previsualiza y genera en exactamente cuatro páginas, combina preguntas únicas del global y parciales del mismo periodo/materia, conserva todas las preguntas válidas que el motor pueda maquetar dentro del límite tipográfico legible y no cambia los registros fuente.
11. La vista previa y el PDF final del extraordinario muestran `Examen Extraordinario`; la plantilla fuente y los PDFs de exámenes ordinarios conservan sus títulos.
12. La vista previa y el PDF extraordinario muestran las mismas indicaciones OMR neutrales aunque la plantilla archivada original tenga instrucciones de parcial/global; los exámenes ordinarios conservan las instrucciones fuente.
13. Los parciales de materias archivadas siguen disponibles en el historial y sus archivos se conservan por defecto. Al elegir 3, 6 o 12 meses, solo se expurgan los PDFs de parciales archivados que superen ese plazo; los registros y las calificaciones siguen disponibles.
14. Un reactivo parcial que incumple el contrato OMR se identifica por ID y por defectos; se distingue de las preguntas válidas descartadas solo por límite de página. Los reactivos inválidos del global o de una plantilla ordinaria siguen bloqueando el flujo hasta corregir la fuente.
15. La vista previa y la generación extraordinaria no cambian `updatedAt`, `bookletConfig`, preguntas, alumnos ni estado de archivo de los registros fuente; el lote requiere una validación de vista previa vigente en el proceso que lo genera.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Seleccionar tipo y alumnos; generar y mostrar exámenes extraordinarios | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/backend/tests/integracion/flujoExamen.test.ts` | Implementado; frontend 15/15 y backend 4/4 en foco |
| REQ-002, REQ-006 | Generación por lote con validación de pertenencia y cohorte estable | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts` | Implementado; backend 4/4 en foco |
| REQ-009 | El PDF extraordinario muestra el título fijo, preservando títulos de plantilla en otros tipos | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts` | Implementado |
| REQ-004, REQ-005 | Persistencia de la nota extraordinaria independiente de la calificación ordinaria y compatibilidad histórica | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts`; `scripts/tests/migrate-examen-tipo-examen-sqlite.test.mjs` | Implementado; backend 4/4 y migración 2/2 en foco |
| REQ-007, REQ-015 | Generar desde plantilla/alumnos/reactivos archivados sin reactivar ni modificar fuentes; UI limita esta selección a extraordinarios | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/frontend/tests/plantillasExtraordinarioArchivado.test.tsx` | En implementación |
| REQ-008, REQ-012 | Combinar global y parciales de la misma materia, deduplicar y separar omisiones de capacidad/OMR | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`; `apps/frontend/tests/plantillasExtraordinarioArchivado.test.tsx` | Pendiente de validación |
| REQ-010 | Instrucciones OMR neutrales en extraordinarios y preservación de indicaciones ordinarias | `apps/backend/tests/examenExtraordinario.rules.test.ts`; `apps/backend/tests/integracion/flujoExamen.test.ts` | Pendiente de validación focal |
| REQ-011 | Retención opt-in de PDFs de parciales archivados y preservación del historial | `apps/backend/tests/integracion/examenesRetention.test.ts`; `apps/frontend/tests/seccionCuenta.test.tsx`; `apps/frontend/tests/plantillasArchivoOmr.test.ts` | Validado en pruebas focales |
