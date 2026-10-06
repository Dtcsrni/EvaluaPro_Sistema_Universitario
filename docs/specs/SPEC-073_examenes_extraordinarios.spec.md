---
id: SPEC-073
titulo: Generación y calificación independiente de exámenes extraordinarios
version: 1.2.0
fecha: 2026-10-05
autor: Codex / EvaluaPro Team
modulo: modulo_generacion_pdf
estado: implemented
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
- **REQ-007 (Periodo concluido):** Se puede generar un extraordinario usando una plantilla y alumnos de la misma materia archivada. Esta vía solo lee los registros archivados necesarios, no reactiva ni modifica materia, alumnos, plantilla o reactivos. Una plantilla archivada no admite exámenes ordinarios y un alumno de otra materia se rechaza.
- **REQ-008 (Formato y cobertura):** El extraordinario de una plantilla global archivada se presenta en cuatro páginas (dos hojas impresas por ambos lados). Combina preguntas únicas del global y de los parciales archivados de la misma materia. La vista previa separa preguntas impresas, preguntas válidas que exceden la capacidad tipográfica y reactivos parciales inválidos para OMR; no reduce la tipografía por debajo del mínimo legible ni genera páginas adicionales.
- **REQ-009 (Título impreso):** La vista previa y el PDF de tipo extraordinario muestran exactamente `Examen Extraordinario`; el título de la plantilla y el de los exámenes ordinarios se conservan.
- **REQ-010 (Instrucciones neutrales):** El extraordinario usa instrucciones OMR que describen cómo responder sin llamarlo parcial o global. Los exámenes ordinarios conservan las instrucciones de su plantilla.
- **REQ-011 (Historial y retención de parciales):** Los parciales de periodos archivados y sus archivos se conservan por defecto en el historial. La docente puede configurar eliminación automática solo para archivos de exámenes parciales archivados después de 3, 6 o 12 meses; los registros y calificaciones se conservan.
- **REQ-012 (Validez OMR):** Globales y plantillas ordinarias siguen bloqueándose si un reactivo no cumple cinco opciones distintas y no vacías con una sola correcta. Un reactivo inválido añadido desde un parcial se omite sin inventar opciones ni clave; la vista previa informa su ID, enunciado y defectos, separados de las omisiones por capacidad.
- **REQ-013 (Inmutabilidad de fuentes):** La vista previa y generación extraordinarias no alteran materia, alumno, plantilla, preguntas ni sus marcas de archivo. La configuración y el conjunto validados viven en memoria por un máximo de 10 minutos; al vencer o reiniciar el proceso, se requiere otra vista previa.
- **REQ-014 (Tecnología retirada):** En toda nueva generación de Diseño y Desarrollo de Aplicaciones Web (parcial, global o extraordinario), se excluyen reactivos cuyo enunciado u opciones mencionen MongoDB o Mongoose. Los reactivos y archivos históricos permanecen intactos.
- **REQ-015 (Procedencia del banco):** Todo reactivo debe existir en el banco del docente y en el mismo periodo/materia de la plantilla. Las plantillas sin periodo, los IDs ausentes o no disponibles en ese banco y las versiones canónicas sin vínculo con ese periodo se rechazan; no se permite rellenar exámenes con preguntas genéricas o de otra materia.

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
10. El extraordinario de global archivado se previsualiza y genera en exactamente cuatro páginas, toma el máximo conjunto de preguntas únicas y válidas que quepa con tipografía legible, y muestra las omisiones por capacidad y por OMR por separado.
11. La vista previa y el PDF extraordinario muestran exactamente `Examen Extraordinario`; sus instrucciones describen el marcado OMR de forma neutral.
12. Las fuentes archivadas permanecen idénticas antes y después de previsualizar y generar; el lote requiere una validación vigente en el mismo proceso.
13. Los parciales archivados y sus archivos permanecen en historial por defecto. La retención solo expurga los PDFs que superan la configuración de 3, 6 o 12 meses.
14. Un reactivo parcial inválido se identifica por ID y defecto, se excluye del conjunto impreso y no se contabiliza como pregunta válida que excedió capacidad.
15. Un reactivo inválido del global o de una plantilla ordinaria sigue bloqueando el flujo hasta corregir la fuente.
16. Ningún parcial, global ni extraordinario nuevo de Diseño y Desarrollo de Aplicaciones Web incluye reactivos que mencionan MongoDB o Mongoose en enunciado u opciones; la exclusión se informa y no cambia las fuentes archivadas.
17. Ninguna generación acepta plantillas sin materia/periodo ni reactivos ausentes del banco correspondiente; un reactivo de otra materia falla antes de producir el examen.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Seleccionar tipo y alumnos; generar y mostrar exámenes extraordinarios | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/backend/tests/integracion/flujoExamen.test.ts` | Implementado; frontend 15/15 y backend 4/4 en foco |
| REQ-002, REQ-006 | Generación por lote con validación de pertenencia y cohorte estable | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts` | Implementado; backend 4/4 en foco |
| REQ-004, REQ-005 | Persistencia de la nota extraordinaria independiente de la calificación ordinaria y compatibilidad histórica | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts`; `scripts/tests/migrate-examen-tipo-examen-sqlite.test.mjs` | Implementado; backend 4/4 y migración 2/2 en foco |
| REQ-007, REQ-013 | Generar desde plantilla/alumnos/reactivos archivados sin reactivar ni modificar datos fuente; la UI limita esta selección a extraordinarios y la generación exige preview vigente | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/frontend/tests/plantillasExtraordinarioArchivado.test.tsx` | En validación focal |
| REQ-014 | Excluir referencias a MongoDB/Mongoose de toda nueva copia DDAW (parcial, global y extraordinario) y preservar las fuentes | `apps/backend/tests/integracion/flujoExamen.test.ts` | Parcial y extraordinario validados; global con flujo base validado |
| REQ-008, REQ-012 | Combinar y deduplicar preguntas del global y parciales de la misma materia; separar omisiones por OMR y por capacidad | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/pdf.extraordinario.dosHojas.test.ts` | En validación focal |
| REQ-009, REQ-010 | Título exacto e instrucciones neutrales en vista previa y PDF final | `apps/backend/tests/integracion/flujoExamen.test.ts` | Vista previa validada; texto extraído del PDF final pendiente |
| REQ-011 | Retención opt-in de archivos de parciales archivados sin borrar historial ni calificaciones | `apps/backend/tests/integracion/examenesRetention.test.ts` | Backend 3/3 y typecheck validados |
| REQ-015 | Exigir que todo reactivo provenga del banco del docente y periodo de la plantilla | `apps/backend/tests/integracion/flujoExamen.test.ts` | Backend 5/5 y typecheck validados |
