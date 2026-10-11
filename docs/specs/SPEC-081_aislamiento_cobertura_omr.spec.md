---
id: SPEC-081
titulo: Aislamiento de cobertura para workflow OMR
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: ci
estado: approved
---

## Contexto

La cobertura backend por lotes incluye `tests/integracion/omrJobsWorkflow.test.ts` junto con otras suites de integración. El lote completo agotó dos veces el límite local ampliado de 20 minutos sin registrar fallos de aserción. La duración impide obtener un resultado reproducible de cobertura global y activa reintentos idénticos.

## Requisitos Funcionales

- REQ-001: El plan de cobertura debe ejecutar `omrJobsWorkflow.test.ts` en un lote propio, separado de las demás suites de integración.
- REQ-002: El aislamiento debe conservar todas las suites seleccionadas, evitar duplicados y mantener los umbrales de cobertura aplicados únicamente al merge global.
- REQ-003: El plan debe expresar el aislamiento mediante una prueba de regresión que falle si `omrJobsWorkflow.test.ts` vuelve a compartir lote.

## Criterios de Aceptación

- El plan completo contiene un lote que selecciona únicamente `tests/integracion/omrJobsWorkflow.test.ts`.
- Las otras suites de integración y todos los lotes de raíz continúan incluidos.
- La prueba del plan y el gate de cobertura global terminan correctamente; los umbrales se evalúan en el merge global.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | El workflow OMR ocupa un lote exclusivo | `scripts/tests/backend-coverage-batches.test.mjs` | Verificado localmente: el lote contiene solo `omrJobsWorkflow.test.ts` |
| REQ-002 | El plan conserva las suites seleccionadas y el merge con umbrales | `scripts/tests/backend-coverage-batches.test.mjs` | Verificado localmente: suites de integración sin duplicados y umbrales en merge global |
| REQ-003 | Regresión ante la reagrupación accidental del workflow | `scripts/tests/backend-coverage-batches.test.mjs` | Verificado localmente: 13/13 pruebas |

## Evidencia de validación

- Local: prueba del plan 13/13; `npm run sdd:audit` aprobado; `git diff --check` limpio.
- Cobertura backend: 58 blobs fusionados; umbrales globales aprobados con 75.08% statements, 64.14% branches, 80.07% functions y 77.69% líneas. `omrJobsWorkflow.test.ts` pasó 12/12 con cobertura v8 en 1163.75 s.
- Cobertura portal: 11 archivos y 32/32 pruebas; Statements 67.43%, Branches 56.37%, Functions 79.04%, Lines 69.98%.
- Cobertura frontend: terminó con éxito; resumen final por capturar en CI.
- Estado: validación local completa; pendiente CI del PR.
