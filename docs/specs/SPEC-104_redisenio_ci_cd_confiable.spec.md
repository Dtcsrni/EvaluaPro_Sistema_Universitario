---
id: SPEC-104
titulo: CI/CD confiable, determinista y sin gates omitidos
version: 1.0.0
fecha: 2026-10-14
autor: Codex
modulo: devops
estado: approved
---

## Contexto

La auditoría de `.github/workflows` encontró que el gate agregado de `CI Checks` acepta que todos los jobs Core queden `skipped` sin consultar el resultado del detector de cambios ni comprobar que los jobs omitidos no estaban en el plan. `CI Checks` y los workflows modulares también se activan para la misma PR o push, repiten preparación y validaciones afectadas, y hay pasos que vuelven a resolver `sharp` fuera del lockfile. En ciertos pasos, la suite completa se reintenta ante cualquier código distinto de cero. El runner de cobertura informa una recuperación como inestable y hace fallar la pasada, pero los wrappers de frontend/portal podían ocultar esa señal.

La finalidad es que una PR tenga una única decisión confiable y explicable, que los resultados sean reproducibles desde el lockfile, y que los fallos funcionales e intermitencias queden visibles sin perder diagnósticos. El alcance incluye CI, gates de PR y flujos de publicación/release existentes; no autoriza publicar una versión ni modificar datos operativos.

## Requisitos Funcionales

- **REQ-001 — Gate agregado consciente del plan:** El gate Core debe depender explícitamente del detector. Debe fallar si el detector no termina con éxito. Para cada job Core, `skipped` solo es válido cuando el plan de cambios concluyó correctamente y el output correspondiente indica que ese job no era requerido. En `schedule` y `workflow_dispatch` con `force_full_ci`, los jobs integrales requeridos deben concluir en `success`.
- **REQ-002 — Gate extendido trazable:** El agregado Extended debe validar el resultado del detector y distinguir `skipped` por alcance de cualquier job requerido que no haya corrido. El reporte del gate debe identificar el SHA, evento, escalación, grupos/jobs requeridos y resultados finales, sin incluir secretos ni contenido de datos personales.
- **REQ-003 — Un único dueño automático:** `CI Checks` será el único orquestador automático de las validaciones de PR, `main` y schedule. Los workflows Backend/Frontend/Portal/Docs quedan para diagnóstico manual (`workflow_dispatch`). Las pruebas especializadas que no estén cubiertas por el mapa affected se conservarán en el flujo central o se identificarán expresamente como manuales. El gate OMR canónico de datos reales tiene un solo dueño automático.
- **REQ-004 — Dependencias reproducibles:** La preparación del runtime debe derivarse de los manifests/lockfiles comprometidos. El workflow no debe resolver paquetes de runtime mediante instalaciones sin versión y ajenas al lockfile. Debe conservar smoke tests para validar dependencias nativas necesarias.
- **REQ-005 — Reintentos transparentes:** Un fallo de aserción no se debe convertir silenciosamente en éxito reintentando la suite completa. Los reintentos permitidos deben limitarse a fallos de infraestructura clasificados; toda recuperación debe dejar artefacto/estado visible y una señal de inestabilidad para el gate cuando afecte validación funcional.
- **REQ-006 — Concurrencia por tipo de ejecución:** Los pushes sucesivos de una misma PR pueden cancelar trabajo obsoleto. Los `schedule`, `workflow_dispatch` integral y ejecuciones ligadas a release deben tener grupos que no se cancelen entre sí ni por una actualización ordinaria de la rama. Las publicaciones ya conservan serialización y no se cancelan.
- **REQ-007 — Preparación y diagnósticos reutilizables:** Centralizar pasos comunes del CI cuando reduzca duplicación verificable, usando workflows reutilizables o acciones compuestas con permisos explícitos. Cada job permanece aislado y debe seguir ejecutando instalación reproducible, gates afectados y publicación de diagnósticos con retención definida.
- **REQ-008 — Migración gradual con evidencia:** El cambio debe preservar los grupos affected-only, escalaciones `full-core`/`full-extended`, cobertura integral bajo dispatch explícito, gates visuales y E2E de Installer Hub, permisos mínimos y serialización de releases. La adopción se valida en PR y con las corridas requeridas para la ruta integral antes de retirar controles anteriores.

## Criterios de Aceptación

- **AC-001:** Pruebas de contrato cubren detector `success/failure`, job requerido que `success/skipped/failure`, job no requerido omitido y dispatch/schedule integral; una salida incompleta o contradictoria falla el agregado.
- **AC-002:** Las pruebas confirman que cada resultado agregado conserva SHA, evento, plan affected y resultados, y que el artefacto no agrega secretos ni PII.
- **AC-003:** Pruebas de contratos confirman que `CI Checks` cubre PR/push/schedule y que los cuatro workflows modulares no tienen triggers automáticos. El gate OMR canónico solo se ejecuta automáticamente en `CI Checks` y puede ejecutarse manualmente en `CI Backend Module`.
- **AC-004:** Contratos verifican que instalaciones nativas usan la versión resuelta por lockfile y que el smoke test falla si falta el módulo/binario esperado.
- **AC-005:** Pruebas del retry runner comprueban que errores de aserción no se reintentan ni desaparecen como éxito, y que las fallas de infraestructura recuperadas quedan reportadas como inestables.
- **AC-006:** Contratos de concurrency verifican cancelación únicamente para actualizaciones obsoletas de PR y no cancelación cruzada entre cobertura integral, schedule, dispatch y release.
- **AC-007:** La preparación compartida no reduce aislamiento entre jobs; cada caller conserva `permissions` mínimos, checkout del SHA del evento y caché derivada de los lockfiles.
- **AC-008:** `npm run ci:policy:audit`, los contratos CI/CD y los workflows afectados pasan. Antes de cerrar, la cobertura integral completa termina dos veces consecutivas en el mismo SHA candidato sin suites omitidas, recuperación por retry ni cambios de umbral; se conserva evidencia de los runs.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Gate Core contra detector y plan affected | `scripts/tests/ci-gate-summary.test.mjs`; `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-002 | Gate Extended y resumen de plan/resultados | `scripts/tests/ci-gate-summary.test.mjs`; `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-003 | Orquestador único automático y módulos manuales | `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-004 | Runtime nativo fijado al lockfile | `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-005 | Suites de CI sin retries generales que oculten fallos | `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-006 | Concurrency separada para PR/full/release | `scripts/tests/ci-redesign-contract.test.mjs` | En implementación |
| REQ-007 | Contrato de preparación y permisos de jobs reutilizados | `scripts/tests/ci-redesign-contract.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |
| REQ-008 | Contratos de preservación de cobertura y gates existentes | `scripts/tests/backend-coverage-batches.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |
