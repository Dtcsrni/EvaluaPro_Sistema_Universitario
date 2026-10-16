---
id: SPEC-109
titulo: Aislamiento reproducible de regeneracion de examen bajo cobertura
version: 1.0.0
fecha: 2026-10-16
autor: Codex
modulo: backend_coverage_ci
estado: approved
---

## Contexto

En CI Checks #1443, SHA `35452d595d02f654183b80cc11478dc3bcfddaf6`, el lote `backend-integracion-n-z-09` falló durante la cobertura instrumentada. El caso `tests/integracion/regenerarExamenGenerado.test.ts > regenera PDF y recalcula paginas (requiere forzar si ya fue descargado)` agotó el límite de 60 s y consumió 60.691 s. El lote contenía además `rolesPermisos.test.ts`, `temario.pdf.test.ts` y `versionadoApiV2Contratos.test.ts`; el runner ejecutó cobertura con concurrencia de tres lotes. La ejecución normal del backend había pasado, por lo que la evidencia apunta a una degradación bajo cobertura/concurrencia, sin aislar todavía la causa.

SPEC-103 exige demostrar con mediciones si el aislamiento elimina el timeout y establece que, si no lo hace, se necesita una spec aprobada adicional antes de cambiar el test o la producción. Esta spec cubre la comparación controlada y, solo si la medición respalda el aislamiento, la separación exclusiva del caso. Conserva el test, sus aserciones, los umbrales de cobertura y el código de salida fallido ante una corrida inestable.

Como diagnóstico no concluyente, el mismo test se ejecutó aislado en Windows local con cobertura V8: pasó en 27.248 s y el proceso completo duró 60.50 s. La comparación A/B de CI Checks #1446, run `38934208588`, en Ubuntu y SHA `5459bcde69d1382e7dc88d972a0bed3e82c4b72a`, confirmó la contención: el lote compartido terminó fallido a los 100.014 s después del timeout del caso a 60 s; la ejecución aislada pasó en 48.716 s (caso: 42.554 s). No se usaron retries. Con esa evidencia, el plan aprobado se implementa como un lote exclusivo permanente con cobertura y `--maxWorkers=1`, después de que drenen los workers ordinarios. El diagnóstico comparativo no se repite cuando la suite ya es exclusiva, para evitar ejecutar dos veces el mismo test en cada CI. El gate conserva el fallo estricto, los umbrales y el timeout original.

## Requisitos Funcionales

- **REQ-001:** Registrar duración por intento del lote que incluye `regenerarExamenGenerado.test.ts`, y el resultado individual del caso que falló, para identificar la causa sin depender de una recuperación por retry.
- **REQ-002:** Comparar el lote bajo el scheduler/concurrencia vigente con una ejecución exclusiva de `regenerarExamenGenerado.test.ts`, manteniendo la misma instrumentación, dependencias, runner y configuración de prueba; publicar tiempos y resultado en los artefactos de CI.
- **REQ-003:** Si la comparación confirma que la contención causa el timeout y la ejecución exclusiva pasa dentro del límite configurado, ejecutar el archivo como lote exclusivo después de drenar los demás workers. La barrera de exclusividad debe ser comprobada por pruebas del scheduler.
- **REQ-004:** Si el caso falla o excede el límite también en aislamiento, no aumentar el timeout global ni introducir retries. Documentar la evidencia y solicitar una spec aprobada adicional para corregir el trabajo de la prueba o el comportamiento productivo que resulte responsable.
- **REQ-005:** Mantener todas las suites seleccionadas, el timeout global vigente, los umbrales de cobertura y el merge global. Un intento fallido seguido de uno exitoso mantiene fallida la validación integral.
- **REQ-006:** Después del cambio respaldado por mediciones, exigir dos corridas completas consecutivas de cobertura backend y dos CI completos consecutivos en el SHA candidato; ambos deben incluir todos los E2E funcionales y visuales requeridos.

## Criterios de Aceptación

- La comparación A/B de una corrida `force_full_ci=true` conserva el mismo SHA, runner, dependencias y perfil de cobertura, y publica duración, resultado, timeout y log del lote compartido y de la ejecución aislada.
- La causa se atribuye a contención solo si la ejecución exclusiva elimina el timeout de forma reproducible; si no, la spec no autoriza otra corrección.
- El scheduler no inicia el lote exclusivo mientras haya otro lote activo, y conserva la concurrencia ordinaria configurada.
- La suite y umbrales de cobertura permanecen completos; no se aceptan reintentos recuperados como corrida estable.
- Dos corridas completas consecutivas terminan en verde sobre el mismo SHA, incluyendo cobertura, E2E funcional y evidencia visual de UX/UI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Registro y comparación de ejecución compartida/exclusiva | `scripts/tests/backend-coverage-batches.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Comparación A/B confirmada en CI Checks #1446; nueva planificación exclusiva pendiente de CI |
| REQ-003, REQ-005 | Exclusividad del scheduler y preservación del plan completo | `scripts/tests/backend-coverage-batches.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Implementación local; validación completa pendiente |
| REQ-004 | El test de regeneración conserva resultado de timeout/fallo sin retries | `apps/backend/tests/integracion/regenerarExamenGenerado.test.ts` | Conservado; sin cambios al test |
| REQ-006 | Gate candidato completo y comportamiento de flakiness sin aceptación por retry | `scripts/tests/ci-workflow-contract.test.mjs` | CI completo pendiente |

