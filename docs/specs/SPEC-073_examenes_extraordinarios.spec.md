---
id: SPEC-073
titulo: Generación y calificación independiente de exámenes extraordinarios
version: 1.0.0
fecha: 2026-10-03
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

## Criterios de Aceptación

1. La interfaz ofrece `Extraordinario` como tipo seleccionable en la generación de exámenes.
2. La selección admite uno o varios alumnos válidos y la generación produce un examen vinculado por ID a cada alumno elegido.
3. El historial y el detalle distinguen los extraordinarios de parciales y globales.
4. Un resultado extraordinario se puede consultar y calificar por el flujo vigente, permanece separado y no cambia los campos ni agregados ordinarios del alumno.
5. Se rechazan selecciones vacías y alumnos ajenos al periodo/materia vinculados a la plantilla, sin persistir exámenes parciales.
6. Los registros históricos siguen mostrando el mismo tipo y resultado que antes del cambio.
7. La matriz de trazabilidad se actualiza con pruebas reales de UI, API, persistencia y exclusión de agregados.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Seleccionar tipo y alumnos; generar y mostrar exámenes extraordinarios | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/backend/tests/integracion/flujoExamen.test.ts` | Implementado; frontend 15/15 y backend 4/4 en foco |
| REQ-002, REQ-006 | Generación por lote con validación de pertenencia y cohorte estable | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts` | Implementado; backend 4/4 en foco |
| REQ-004, REQ-005 | Persistencia de la nota extraordinaria independiente de la calificación ordinaria y compatibilidad histórica | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts`; `scripts/tests/migrate-examen-tipo-examen-sqlite.test.mjs` | Implementado; backend 4/4 y migración 2/2 en foco |
