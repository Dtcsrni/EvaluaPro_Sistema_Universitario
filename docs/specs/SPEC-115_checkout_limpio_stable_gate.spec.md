---
id: SPEC-115
titulo: Mantener limpio el checkout del Stable Gate tras pruebas visuales
version: 1.0.0
fecha: 2026-10-18
autor: Codex / Ingeniería
modulo: release_stable_gate
estado: draft
---

# SPEC-115: Mantener limpio el checkout del Stable Gate tras pruebas visuales

## Contexto

El Stable Gate #95, sobre el candidato `c436b2ea87871c4843e2ad90731e45628b73e869`, validó el SHA, descargó el instalador y pasó las pruebas visuales. Falló antes de QA completa porque `npm run gui:screen-matrix` actualizó dos archivos versionados y el flujo solo restaura el Markdown. El JSON `reports/qa/latest/gui-screen-matrix.json` permanece modificado y hace fallar `git status --porcelain`.

La matriz se genera como artefacto temporal durante el gate. Mantener el checkout del código candidato limpio evita que la evidencia de una ejecución quede mezclada con los archivos fuente o afecte la evaluación del SHA inmutable.

## Requisitos Funcionales

- **REQ-001:** Después de ejecutar `npm run gui:screen-matrix` dentro de `candidate`, el workflow debe restaurar todos los archivos versionados que ese comando modifica: `docs/release/manual/gui-screen-matrix.md` y `reports/qa/latest/gui-screen-matrix.json`.
- **REQ-002:** La verificación de limpieza debe permanecer bloqueante y mostrar los paths modificados si falla, para que el diagnóstico identifique el contenido residual sin debilitar la condición de checkout limpio.
- **REQ-003:** La preparación visual debe conservar el comportamiento de pruebas y evidencia: no usar reintentos, no aumentar timeouts ni omitir las pruebas responsive, de ciclo, visuales o PDF.

## Criterios de Aceptación

- **AC-001 (REQ-001):** El contrato del workflow comprueba que se restauren ambos archivos después de generar la matriz y antes de verificar el estado limpio.
- **AC-002 (REQ-002):** La verificación informa `git status --short` antes de terminar con código distinto de cero cuando el checkout candidato siga modificado.
- **AC-003 (REQ-003):** El contrato conserva los comandos actuales de matriz, pruebas visuales, responsive, ciclo y PDF, sin retries ni cambios de timeout.
- **AC-004 (REQ-001, REQ-002):** El Stable Gate completo pasa la preparación visual y la comprobación de limpieza sobre el SHA candidato, y continúa hasta generar la evidencia QA completa.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Verifica que ambos productos versionados de la matriz se restauren antes del guard de limpieza | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
| REQ-002 | Verifica que el guard de limpieza dé diagnóstico y siga siendo bloqueante | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
| REQ-003 | Verifica que se mantengan los E2E visuales y que no se añadan reintentos ni timeouts | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
| REQ-001, REQ-002 | Ejecuta el Stable Gate del SHA candidato y comprueba QA completa | `CI Installer Windows / Release Stable Gate` | Pendiente |
