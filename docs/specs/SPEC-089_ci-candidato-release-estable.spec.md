---
id: SPEC-089
titulo: CI del candidato para promoción estable
version: 1.0.0
fecha: 2026-10-12
autor: Codex
modulo: release
estado: implemented
---

## Contexto

El gate estable exige diez ejecuciones verdes consecutivas de CI. Ese conteo histórico no prueba que el código que se va a publicar haya pasado sus propios controles y retrasa una promoción aunque el candidato exacto esté validado. La promoción debe decidirse con evidencia trazable al SHA inmutable del candidato.

## Requisitos Funcionales

- **REQ-001:** El gate estable no debe exigir una cantidad fija de ejecuciones históricas consecutivas.
- **REQ-002:** El gate debe exigir una ejecución completada y exitosa de `CI Checks` para el SHA completo del candidato en la rama `main`.
- **REQ-003:** El artefacto Installer Windows usado para promoción debe provenir de una ejecución completada y exitosa de `CI Installer Windows` para el mismo SHA candidato en `main`.
- **REQ-004:** La decisión estable debe registrar el SHA y el identificador de ejecución de CI del candidato; debe rechazar ejecuciones de otro SHA, rama, workflow, estado o conclusión.
- **REQ-005:** El contrato de evidencia y el generador no deben requerir `ciConsecutivoVerde`; la evidencia histórica existente se conserva como registro histórico, sin participar en la decisión actual.
- **REQ-006:** La QA automatizada, la evidencia versionada, el manifiesto firmado del instalador y la preparación de rollback continúan como gates independientes.

## Criterios de Aceptación

- **AC-001 (REQ-001):** Una sola ejecución verde del SHA candidato satisface el control CI sin consultar una racha anterior.
- **AC-002 (REQ-002, REQ-003):** El gate acepta ejecuciones exitosas coincidentes en SHA y rama y rechaza SHA o rama distintos, ejecución pendiente, fallo, workflow no esperado o ausencia de ejecución.
- **AC-003 (REQ-004):** `decision.json` identifica el SHA, workflow, run ID y conclusión usados para el control CI.
- **AC-004 (REQ-005):** La validación de evidencia acepta manifiestos nuevos sin `ciConsecutivoVerde` y mantiene la lectura de evidencias históricas.
- **AC-005 (REQ-006):** Un CI candidato verde no omite ni reemplaza los controles de QA, evidencia, instalador o rollback.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Selección y validación de la ejecución del SHA candidato | `scripts/tests/release-ci-candidate.test.mjs` | Implementado |
| REQ-004, REQ-006 | Decisión estable conserva CI del candidato y gates independientes | `scripts/tests/release-stable-promotion.test.mjs` | Implementado |
| REQ-005 | Compatibilidad del manifiesto sin contador de racha | `scripts/tests/release-evidence-contract.test.mjs` | Implementado |
| REQ-001, REQ-002, REQ-003 | El workflow consulta CI Checks y valida Installer Windows del mismo candidato | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
