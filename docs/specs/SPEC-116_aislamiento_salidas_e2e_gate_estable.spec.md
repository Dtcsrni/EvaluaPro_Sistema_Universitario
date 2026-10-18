---
id: SPEC-116
titulo: Aislamiento de salidas E2E en Stable Gate
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: release_stable_gate
estado: approved
---

# SPEC-116 — Aislamiento de salidas E2E en Stable Gate

## Contexto

El Stable Gate #96 ejecutó las validaciones visuales en el SHA candidato `94bc5c881ea1bb8739911814dc7f05e52def94d6`, pero falló en el guard de checkout limpio. Los logs muestran 30 capturas en `reports/qa/latest/` y el directorio temporal `evaluapro-e2e-cycle/`. La configuración del flujo responsivo deja `E2E_SCREENSHOT_DIR` sin definir; la configuración del ciclo deriva su `scratchRoot` de `process.cwd()` cuando `E2E_SCRATCH_ROOT` está ausente. También aparecieron tres archivos versionados modificados: la spec de SPEC-109 y dos archivos del runner/prueba de cobertura. El log disponible no atribuye esas tres escrituras a una etapa.

## Objetivo

Ejecutar E2E visuales del Stable Gate sin escribir salidas generadas dentro del checkout candidato, preservar las evidencias como artefactos y localizar cualquier modificación inesperada antes de continuar el gate.

## Requisitos Funcionales

- REQ-001: Asignar `E2E_SCREENSHOT_DIR` a un directorio bajo `${RUNNER_TEMP}` para todos los recorridos visuales que generan capturas.
- REQ-002: Asignar `E2E_SCRATCH_ROOT` bajo `${RUNNER_TEMP}` al E2E del ciclo; conservar los resultados Playwright y las capturas necesarias para auditoría.
- REQ-003: Actualizar el manifiesto/contrato de E2E visual para exigir ambas variables de aislamiento y verificar que sus rutas estén fuera del checkout candidato.
- REQ-004: Comprobar que el checkout candidato está limpio inmediatamente después de clonarlo y después de cada paso de preparación y ejecución visual. Si aparecen cambios inesperados, fallar en el primer paso que los produzca e informar su nombre y rutas.
- REQ-005: No restaurar ni descartar modificaciones a archivos fuente, specs o pruebas. Solo los dos archivos generados por `gui:screen-matrix` cubiertos por SPEC-115 pueden restaurarse explícitamente.
- REQ-006: Mantener los E2E completos, sin retries nuevos ni aumentos de timeout.

## Criterios de Aceptación

- CA-001: Las capturas responsivas y el scratch del ciclo se escriben fuera del checkout candidato.
- CA-002: Las evidencias visuales siguen disponibles en el artefacto del Stable Gate.
- CA-003: Las pruebas de contrato fallan si el workflow omite cualquiera de las rutas temporales.
- CA-004: Si una etapa modifica cualquier archivo versionado fuera de los dos outputs explícitos de `gui:screen-matrix`, el gate falla y reporta la primera etapa y las rutas; no elimina el cambio.
- CA-005: El árbol queda limpio antes de `qa:full`; se ejecuta el manifiesto QA completo y el gate estable conserva sus demás validaciones y umbrales.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | El contrato visual exige rutas temporales externas al checkout y conserva evidencia | `scripts/tests/gui-visual-e2e-contract.test.mjs` | Validado localmente; CI pendiente |
| REQ-004, REQ-005 | El contrato del workflow exige checkpoints bloqueantes con etapa y paths, y permite restaurar solo los outputs de SPEC-115 | `scripts/tests/ci-workflow-contract.test.mjs` | Validado localmente; CI pendiente |
| REQ-006 | Los comandos E2E actuales mantienen selección, retries y timeouts aprobados | `scripts/tests/ci-workflow-contract.test.mjs` | Validado localmente; CI pendiente |

## Fuera de alcance

- Cambiar criterios del gate, condiciones de promoción o publicación.
- Ocultar o auto-restaurar modificaciones a fuentes, specs o pruebas.
- Reintentar pruebas fallidas o reducir su cobertura.
