---
id: SPEC-114
titulo: Diagnóstico y aislamiento reproducible de recovery bundle bajo cobertura
version: 0.1.0
fecha: 2026-10-17
autor: Codex
modulo: backend_coverage_ci
estado: approved
---

## Contexto

En CI Checks manual #1473, SHA `ee840dda4cd673c10e5123ba25e5ab4620dcddbc`, con `force_full_ci=true`, cobertura backend llegó al lote `backend-integracion-n-z-07` bajo concurrencia 3. La suite `tests/integracion/recoveryBundleGeneracion.test.ts` ejecutó cuatro casos: tres pasaron y `descarga lotes extraordinarios archivados con las páginas persistidas aunque cambie la preferencia` excedió el límite de Vitest de 60 s (60.214 s). El proceso reportó 1 suite fallida, 3 aprobadas y duración total de 107.73 s para ese lote.

Las pruebas normales de Backend/Portal, Classroom y los demás gates Core de la misma corrida terminaron en verde. La corrida #1473 terminó con fallo en cobertura backend: el caso excedió el límite de 60 s; los gates Core completados restantes pasaron y los gates extendidos se omitieron por el resumen fallido. Esta evidencia identifica un timeout real bajo instrumentación, pero no determina si se debe a contención con los otros lotes, costo propio del caso, persistencia SQLite u otra causa.

SPEC-103 cubre la estabilidad de cobertura bajo instrumentación y los lotes intensivos que ya se midieron; SPEC-109 cubre la suite `regenerarExamenGenerado.test.ts`. Esta spec aprobada añade un modo manual de diagnóstico para comparar el lote compartido con una ejecución exclusiva en el mismo SHA y runner. La planificación permanente solo cambiará si la comparación demuestra que el aislamiento resuelve el timeout. Mantiene el límite de 60 s del test, sin ampliar timeout global, omitir pruebas ni aceptar recuperación por retry como éxito estable.

## Requisitos Funcionales

- **REQ-001:** Registrar para `recoveryBundleGeneracion.test.ts` duración por caso, duración total, salida, fallos y motivo, comparando el plan actual bajo concurrencia con una ejecución exclusiva sobre el mismo SHA, dependencias, runner y configuración de cobertura.
- **REQ-002:** Si la comparación confirma contención y el caso pasa aislado dentro de 60 s, planificar la suite como lote exclusivo después de drenar workers activos. La exclusividad debe verificarse mediante pruebas del scheduler.
- **REQ-003:** Si el caso falla o excede 60 s de forma aislada, no aumentar límites ni introducir retries; documentar la evidencia y solicitar una spec específica para corregir el test o el comportamiento productivo responsable.
- **REQ-004:** Preservar los cuatro casos, sus aserciones, la selección completa de suites y umbrales de cobertura. Cualquier intento fallido conserva código de salida distinto de cero, aun si una ejecución diagnóstica posterior pasa.
- **REQ-005:** Probar el runner para que la nueva planificación no duplique suites, no reduzca cobertura y mantenga la concurrencia normal de otros lotes.
- **REQ-006:** Requerir dos corridas completas de cobertura backend y dos corridas completas de CI consecutivas, sin timeouts, recuperaciones, suites omitidas ni umbrales reducidos, todas sobre el mismo SHA candidato.

## Criterios de Aceptación

- La comparación diagnóstico conserva SHA, sistema operativo, dependencias, V8 y configuración de Vitest, y publica tiempos/resultados del lote compartido y exclusivo.
- El workflow `CI Checks` expone una entrada manual para solicitar la comparación; por defecto no duplica suites en las ejecuciones ordinarias.
- El aislamiento se atribuye como causa solo cuando el caso deja de exceder 60 s de forma reproducible al ejecutarse sin otros lotes activos.
- Si se agrega exclusividad, el scheduler prueba que no hay solapamiento, mantiene la concurrencia ordinaria y ejecuta cada prueba exactamente una vez en la corrida de aceptación.
- No se cambia el timeout del caso, no se agregan retries y el gate conserva estado fallido ante cualquier intento fallido.
- Las suites y los umbrales permanecen íntegros y dos corridas consecutivas completas pasan sobre el mismo SHA.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Comparar ejecución compartida/exclusiva y verificar barrera del scheduler | `scripts/tests/backend-coverage-batches.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |
| REQ-003, REQ-004 | Mantener falla estricta, selección completa y ausencia de retry/exclusiones | `scripts/tests/backend-coverage-batches.test.mjs`; `apps/backend/tests/integracion/recoveryBundleGeneracion.test.ts` | Sin cambios al caso; validación pendiente |
| REQ-005 | Plan sin duplicados y concurrencia ordinaria intacta | `scripts/tests/backend-coverage-batches.test.mjs` | En implementación |
| REQ-006 | Verificar el cierre de los gates en el mismo SHA | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
