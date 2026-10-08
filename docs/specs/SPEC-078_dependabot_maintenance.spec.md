---
id: SPEC-078
titulo: Rehabilitar actualizaciones de Dependabot
version: 1.0.0
fecha: 2026-10-08
autor: Codex
modulo: devops
estado: approved
---

## Contexto

La configuración actual mantiene `open-pull-requests-limit: 0` en los cuatro workspaces npm. GitHub interpreta ese valor como desactivación de las actualizaciones de versión de Dependabot, lo que deja el mantenimiento rutinario sin una señal automática. El repositorio necesita reactivar las propuestas sin confundirlas con las actualizaciones de seguridad, que GitHub trata por separado.

El cambio se limita a `docente-local` y a los workspaces npm existentes. No añade dependencias ni altera versiones instaladas.

## Requisitos Funcionales

- REQ-001: conservar los cuatro directorios npm declarados: raíz, backend, frontend y portal.
- REQ-002: permitir actualizaciones de versión con un máximo de cinco PR abiertos por workspace.
- REQ-003: conservar el calendario semanal, las etiquetas de mantenimiento y no fijar `target-branch`.
- REQ-004: mantener la política de actualizaciones de seguridad separada del límite de actualizaciones de versión.
- REQ-005: actualizar la prueba de contrato para rechazar la reintroducción del valor cero o una ruta ausente.

## Criterios de Aceptación

- La configuración tiene cuatro entradas npm con `open-pull-requests-limit: 5`.
- La prueba automatizada compara los cuatro directorios, el límite, el calendario y la ausencia de `target-branch`.
- La documentación DevOps distingue explícitamente version updates de security updates y explica el límite.
- El diff no cambia archivos de lock ni añade dependencias de producción.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Mantener los cuatro workspaces npm | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente |
| REQ-002 | Exigir límite de cinco PR y bloquear cero | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente |
| REQ-003 | Conservar calendario y no dirigir a otra rama | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente |
| REQ-004 | Mantener la configuración de seguridad sin deshabilitarla | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente |
