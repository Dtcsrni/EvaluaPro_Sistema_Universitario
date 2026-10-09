---
id: SPEC-078
titulo: Rehabilitar actualizaciones de Dependabot
version: 1.1.0
fecha: 2026-10-08
autor: Codex
modulo: devops
estado: approved
---

## Contexto

La configuración de Dependabot se concentra en `/`, donde el lock raíz coordina los manifests de los workspaces npm. El repositorio necesita mantener activas las actualizaciones de versión sin confundirlas con las actualizaciones de seguridad, que GitHub trata por separado.

El cambio se limita a `docente-local` y a los workspaces npm existentes. No añade dependencias ni altera versiones instaladas.

## Requisitos Funcionales

- REQ-001: mantener una sola entrada de Dependabot npm en `/`; el monorepo declara backend, frontend y portal como workspaces del lock raíz.
- REQ-002: permitir actualizaciones de versión con un máximo de cinco PR abiertos para la entrada npm de la raíz.
- REQ-003: conservar el calendario semanal, las etiquetas de mantenimiento y no fijar `target-branch`.
- REQ-004: mantener la política de actualizaciones de seguridad separada del límite de actualizaciones de versión.
- REQ-005: actualizar la prueba de contrato para rechazar la reintroducción del valor cero o una ruta ausente.
- REQ-006: el empaquetado docente instala el workspace backend usando el lock raíz y no depende de un lock hijo que la actualización de raíz no sincroniza.

## Criterios de Aceptación

- La configuración tiene una entrada npm en `/` con `open-pull-requests-limit: 5`.
- La prueba automatizada compara la ruta, el límite, el calendario y la ausencia de `target-branch`.
- El contrato del instalador verifica que `npm ci` selecciona `apps/backend` desde el lock raíz y que el `npm prune` posterior no exige lockfile.
- La documentación DevOps distingue explícitamente version updates de security updates y explica el límite.
- El diff no cambia archivos de lock ni añade dependencias de producción.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Mantener la entrada de Dependabot en la raíz del workspace npm | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente de CI |
| REQ-002 | Exigir límite de cinco PR y bloquear cero | `scripts/tests/dependabot-security-policy.test.mjs` | Aprobado en CI |
| REQ-003 | Conservar calendario y no dirigir a otra rama | `scripts/tests/dependabot-security-policy.test.mjs` | Aprobado en CI |
| REQ-004 | No deshabilitar por archivo las actualizaciones de seguridad | Inspección de `.github/dependabot.yml`; ajustes de seguridad se gestionan aparte en GitHub | Inspeccionado |
| REQ-005 | Bloquear límite cero o ruta ausente | `scripts/tests/dependabot-security-policy.test.mjs` | Pendiente de CI |
| REQ-006 | Instalar backend MSI desde el lock raíz | `scripts/tests/dependabot-security-policy.test.mjs` y `CI Installer Windows` | Pendiente de CI |
