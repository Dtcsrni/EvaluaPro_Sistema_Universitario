---
id: SPEC-044
titulo: Motor de Calificación OMR, Revisión Visual de Burbujas y Actas
version: 1.1.0
fecha: 2026-09-09
autor: Antigravity / EvaluaPro Team
modulo: modulo_calificaciones
estado: implemented
---

## Contexto
Procesamiento óptico de marcas (OMR) mediante visión computacional, detección automática de respuestas marcadas, corrección visual interactiva de marcas dudosas y emisión de actas oficiales de notas.

## Requisitos Funcionales
- **REQ-001 (Análisis Óptico)**: Procesamiento de imágenes escaneadas/fotografiadas de hojas OMR.
- **REQ-002 (Revisión Visual)**: Interfaz con mapa de burbujas para verificar marcas dudosas.
- **REQ-003 (Actas de Calificaciones)**: Consolidación de notas parciales y finales.
- **REQ-004 (Contrato web OMR)**: La UI docente debe operar sobre rutas reales y autenticadas del backend para cargar un examen generado, crear un job de captura, resolver hojas y finalizar el job, sin rutas huérfanas.
- **REQ-005 (Persistencia de job)**: Cada job OMR debe conservar docente, examen, estado, progreso, páginas procesadas y resoluciones manuales; nunca debe mezclar datos de otro docente.
- **REQ-006 (PDF e imagen)**: El workflow debe aceptar imágenes y PDF; el PDF debe rasterizarse por página antes del análisis OMR y los errores de una captura deben quedar visibles sin ocultar el resultado de las demás.

## Criterios de Aceptación
1. El motor OMR procesa hojas de examen escaneadas extrayendo marcas con niveles de confianza calibrados.
2. La interfaz de revisión visual resalta marcas dudosas y permite corrección manual ágil con atajos de teclado.
3. El sistema consolida calificaciones parciales y finales emitiendo el acta respectiva.
4. Los tests de flujo OMR y módulos de calificación se ejecutan en verde.
5. La generación de un examen permite cargar su detalle desde `/api/examenes/generados/:id` y el panel OMR completa el ciclo `/api/omr/jobs` → resolución opcional → finalización.
6. Un job OMR de otro docente no puede consultarse, modificarse ni finalizarse.
7. Las capturas PDF e imagen producen páginas procesadas o errores explícitos y trazables.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Análisis y normalización OMR | `apps/frontend/tests/omrWorkflowState.hooks.test.tsx` | Completado |
| REQ-002 | Interfaz interactiva de calificación OMR | `apps/frontend/tests/seccionCalificar.test.tsx` | Completado |
| REQ-003 | Prioridad y resolución OMR en backend | `apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts` | Completado |
| REQ-004 | Contrato web de detalle y job OMR | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
| REQ-005 | Persistencia, aislamiento y finalización de jobs | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
| REQ-006 | Capturas imagen/PDF y errores visibles | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Completado |
