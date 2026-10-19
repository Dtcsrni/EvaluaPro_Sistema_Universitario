---
id: SPEC-122
titulo: Estabilización integrada de CI, QA y release 1.2.8
version: 1.0.0
fecha: 2026-10-18
autor: Codex / Ingeniería
modulo: release_stable_gate
estado: approved
---

## Contexto

La promoción estable de 1.2.8 reúne defectos encontrados en CI local/remoto, el Stable Gate y la validación del Installer Hub. Se consolidan aquí las decisiones aprobadas en SPEC-115 a SPEC-121 para que una sola unidad de trabajo describa los gates completos y su relación. Las fichas originales se conservan como detalle del incidente, aprobación y trazabilidad; este documento no reemplaza ni reduce sus criterios.

## Requisitos Funcionales

- **REQ-001 — Checkout candidato estricto (SPEC-115, SPEC-117):** Mantener bloqueantes los controles de limpieza iniciales, intermedios y finales. Se toleran exclusivamente diferencias CRLF/LF sin cambios semánticos en archivos rastreados y sin preparar; incluye manifests JSON históricos incompatibles con `.gitattributes`. Se rechazan modificaciones preparadas, archivos sin seguimiento, cambios de tipo/modo y cambios de contenido; reportar etapa y rutas.
- **REQ-002 — Aislamiento de E2E y evidencia (SPEC-116):** Ejecutar capturas, scratch y resultados fuera del checkout candidato; preservar evidencia útil como artefactos y señalar la primera etapa que altere fuentes. No restaurar fuentes ni ampliar retries/timeouts.
- **REQ-003 — QA local fail-closed (SPEC-118):** `qa:full` falla si un gate requerido tiene reporte ausente, inválido o `ok: false`; conserva diagnósticos y aplica la misma condición que la promoción estable.
- **REQ-004 — Arranque y render del Installer Hub (SPEC-119):** El E2E identifica la ventana y proceso del bundle probado, separa etapas de arranque/detección/captura, rechaza capturas blancas o estados UIA incorrectos y cierra únicamente el árbol que inició.
- **REQ-005 — Validación MSI no destructiva local (SPEC-120):** El build local extrae y comprueba el MSI sin registrar o retirar producto en el host. Las transacciones MSI se prueban en runner Windows efímero con limpieza verificada.
- **REQ-006 — Versión visible dinámica (SPEC-121):** El resumen y encabezado del Installer Hub muestran una misma versión proveniente del bundle actual; contratos y E2E detectan versiones literales obsoletas.
- **REQ-007 — Puerta de promoción:** Ejecutar todas las pruebas locales aplicables antes de enviar el SHA a CI/CD; después exigir los gates remotos completos, dos pasadas visuales consecutivas del mismo candidato y evidencia verificable antes de declarar estable o publicar.

## Criterios de Aceptación

- **CA-001:** El guard compartido admite cualquier normalización EOL que no cambie el contenido de archivos rastreados sin preparar y falla ante todo cambio material, staged, sin seguimiento o de tipo/modo.
- **CA-002:** Todas las salidas E2E del Stable Gate quedan fuera del checkout y siguen adjuntas al run para auditoría.
- **CA-003:** Una salida QA roja, inválida o ausente hace fallar `qa:full` local y la promoción estable.
- **CA-004:** Las pruebas locales del Hub producen capturas válidas y verifican proceso/estado/versión; no ejecutan transacciones MSI en el host local.
- **CA-005:** El candidato supera las suites locales relevantes antes de CI, los gates requeridos y dos ejecuciones visuales consecutivas sobre el mismo SHA; ningún `skipped` no planeado, retry oculto o evidencia vieja constituye éxito.
- **CA-006:** La spec pasa la auditoría SDD y sus fichas de origen mantienen trazabilidad a pruebas existentes.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Guard EOL estricto, JSON histórico de evidencia y contrato de checkpoints | `scripts/tests/candidate-clean-guard.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Aprobado; implementación en curso |
| REQ-002 | Contratos de rutas externas y checkpoints del Stable Gate | `scripts/tests/gui-visual-e2e-contract.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Aprobado; evidencia CI pendiente |
| REQ-003 | Reportes requeridos fallidos, ausentes o inválidos bloquean QA local | `scripts/tests/qa-full-runner.test.mjs`; `scripts/tests/release-stable-promotion.test.mjs` | Implementado localmente; CI pendiente |
| REQ-004 | Asociación de ventana/proceso, UIA, captura y cierre del Hub | `scripts/tests/installer-hub-lifecycle-contract.test.mjs`; `scripts/tests/installer-hub-ui-lifecycle.ps1` | Validado localmente; CI final pendiente |
| REQ-005 | Extracción local sin transacción MSI y lifecycle en runner desechable | `scripts/tests/installer-hub-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1` | Validación local parcial; CI MSI pendiente |
| REQ-006 | Contrato y visualización de versión actual del bundle | `scripts/tests/installer-hub-lifecycle-contract.test.mjs` | Implementado localmente; CI pendiente |
| REQ-007 | Aprobación estable basada en SHA y evidencia actual de gates completos | `scripts/tests/ci-workflow-contract.test.mjs`; `scripts/tests/release-stable-promotion.test.mjs` | Pendiente de gates del SHA final |

## Fichas consolidadas

- SPEC-115: limpieza de checkout tras matriz GUI.
- SPEC-116: aislamiento de salidas E2E.
- SPEC-117: normalización EOL del checkout candidato.
- SPEC-118: QA local falla ante reportes rojos.
- SPEC-119: inicio visible y diagnóstico local del Installer Hub.
- SPEC-120: aislamiento de validación MSI local.
- SPEC-121: versión dinámica del Installer Hub.
