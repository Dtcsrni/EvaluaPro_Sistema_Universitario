---
id: SPEC-107
titulo: Promoción temporal de beta a release estable sin duplicados
version: 1.0.0
fecha: 2026-10-16
autor: Codex
modulo: devops_release
estado: approved
---

## Contexto

El usuario establece que beta es un estado temporal mientras se ejecutan los gates y E2E, incluido UX/UI; al completar todas las validaciones, la publicación debe ser estable. El workflow `release-beta.yml` se activa cuando `CI Checks` termina exitosamente en `main`, por lo que puede publicar una beta después de que los gates integrales ya pasaron. El flujo estable se ejecuta aparte y no retira esa beta del mismo candidato, lo que puede dejar dos publicaciones de la misma promoción.

La política debe evitar releases beta automáticos después de una validación integral exitosa, permitir beta solo durante validaciones pendientes cuando se solicite, y terminar con una única publicación estable verificable para el SHA y versión aprobados. Las betas históricas de otros SHA/versiones no se alteran.

## Requisitos Funcionales

- REQ-001: El workflow beta no publica automáticamente como respuesta a un `CI Checks` exitoso en `main`.
- REQ-002: La publicación beta manual solo procede para un SHA con gates requeridos aún pendientes; si CI integral de ese SHA ya pasó, el gate beta rechaza la publicación y explica que corresponde continuar por la promoción estable.
- REQ-003: La promoción estable requiere los gates integrales y E2E vigentes, incluido UX/UI e Installer Hub, y publica el tag estable `vX.Y.Z` para el SHA candidato validado.
- REQ-004: Si existió una beta del mismo SHA candidato, después de confirmar el release estable y su asset/E2E, el flujo retira únicamente esa prerelease temporal y su tag; conserva betas históricas de otros SHA y no afecta otros releases.
- REQ-005: La promoción estable es idempotente: un reintento no crea una segunda publicación ni elimina releases ajenos al SHA/version exactos; los conflictos de tag o SHA fallan sin modificar releases.
- REQ-006: Los reportes registran SHA, versión, release estable final, y cualquier beta temporal retirada, sin secretos.

## Criterios de Aceptación

- Un evento exitoso `workflow_run` de `CI Checks` no inicia una publicación beta.
- Las pruebas de contrato verifican que una beta manual se rechaza cuando todos los gates del SHA están verdes y se acepta solo mientras algún gate requerido siga pendiente.
- El flujo estable conserva los gates de release existentes y solo retira una beta si tag, versión y SHA corresponden exactamente al candidato publicado.
- Pruebas negativas demuestran que una beta de otro SHA, una release estable existente conflictiva o un tag ajeno se conservan sin cambios.
- `npm run ci:policy:audit`, los contratos beta/estable y los gates integrales pasan.
- En la verificación final, para el SHA/version de esta promoción hay una sola release publicada y es estable; no se crean tags beta después de completar los gates.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Bloquear beta automática luego de CI integral verde | `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |
| REQ-002 | Permitir solo beta manual durante gates pendientes | `scripts/tests/release-beta-promotion.test.mjs` | En implementación |
| REQ-003 | Mantener requisitos de la promoción estable | `scripts/tests/release-stable-promotion.test.mjs` | En implementación |
| REQ-004 | Retirar solo la beta temporal del mismo SHA tras publicación estable | `scripts/tests/plan-beta-cleanup.test.mjs` | En implementación |
| REQ-005 | Idempotencia y preservación ante conflictos | `scripts/tests/plan-beta-cleanup.test.mjs` | En implementación |
| REQ-006 | Evidencia auditable de la transición beta-estable | `scripts/tests/release-evidence-contract.test.mjs` | En implementación |
