---
id: SPEC-CI-CD-INTEGRITY
titulo: Integridad y seguridad de ciclos CI/CD
version: 1.2.3
fecha: 2026-10-08
autor: Codex / Agente IA
modulo: devops
estado: approved
---

# Integridad y seguridad de ciclos CI/CD

## Contexto
Los workflows de CI/CD deben limitar el token a la función del job y evitar que una nueva ejecución interrumpa publicaciones con efectos externos. El empaquetado de imágenes debe impedir que una tag de release publique una versión distinta a la declarada por el código.

## Requisitos Funcionales
- **REQ-001:** Los workflows de validación sin mutaciones remotas declaran explícitamente `permissions: contents: read`.
- **REQ-002:** Los workflows que publican artefactos o promueven releases no cancelan una publicación en curso por una ejecución concurrente del mismo grupo.
- **REQ-003:** El workflow de imágenes falla antes de publicar cuando la versión de una tag `v*` no coincide con `package.json`.
- **REQ-004:** El build de instalador, que ejecuta código de la PR, solo recibe permisos de lectura; la publicación de release se ejecuta en un job separado con permiso de escritura y depende del éxito del build/E2E.
- **REQ-005:** El guard de tags acepta únicamente SemVer canónico sin ceros iniciales para versión ni identificador numérico de alpha/beta/rc; su limpieza protege tags válidas y solo elimina una tag inválida cuando el nombre de repositorio también es válido.
- **REQ-006:** El workflow beta automático se dispara cuando termina `CI Checks` para `main`, pero solo evalúa/publica cuando ese workflow concluyó exitosamente y el SHA corresponde a `main`.
- **REQ-007:** `CI Checks` selecciona en PR únicamente pruebas relacionadas con archivos fuente o pruebas modificados en cada módulo mediante el grafo de dependencias de Vitest; si solo cambian dependencias/configuración o no puede resolverse la base Git, ejecuta la suite completa del módulo. La cobertura instrumentada completa se ejecuta solo mediante dispatch completo explícito, no duplica en PR ni en las corridas nocturnas las pruebas de comportamiento ya ejecutadas.
- **REQ-008:** Una release estable del instalador solo permanece pública si una E2E completa descarga el EXE por su URL pública canónica, verifica tamaño y SHA-256 contra el digest de la API de GitHub y el sidecar, y ejecuta install/repair/upgrade/dashboard/uninstall sobre un runner Windows aislado. Si esa E2E falla, el workflow vuelve el release a borrador.
- **REQ-009:** El Dockerfile del backend copia `apps/backend/prisma.config.mjs` dentro de la etapa `builder` antes de ejecutar `npm --workspace apps/backend run build`, que invoca `prisma generate --config prisma.config.mjs`.
- **REQ-010:** La cobertura porcentual de diff se informa solo como diagnóstico salvo que una invocación declare explícitamente un umbral; ningún umbral global arbitrario bloquea PR. Las suites completas permanecen en schedule/dispatch completo; los reportes integrales de cobertura quedan solo en dispatch completo explícito.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Las pruebas de contrato enumeran workflows read-only y fallan si pierden `contents: read` o habilitan permisos de escritura.
- **AC-002 (REQ-002):** Las pruebas de contrato verifican que package, release-beta, stable-gate y tag guard no cancelan una publicación activa; el instalador cancela CI de ramas pero serializa tags.
- **AC-003 (REQ-003):** La prueba de contrato confirma la comparación tag/versión antes del primer `docker push`.
- **AC-004 (REQ-004):** La prueba de contrato comprueba que únicamente el job de publicación tiene `contents: write`, descarga el artefacto del job de build y depende de su éxito.
- **AC-005 (REQ-005):** La prueba de contrato ejecuta la expresión del guard contra versiones válidas y casos con ceros iniciales/sufijos no admitidos; confirma que cleanup rechaza una tag válida o repositorio inválido y permite limpiar tags de formato inválido.
- **AC-006 (REQ-006):** La prueba de contrato confirma el trigger `workflow_run` de `CI Checks` completado sobre `main` y la defensa adicional por conclusión exitosa y rama `main`.
- **AC-007 (REQ-007):** Las pruebas confirman que cada runner usa Vitest `--changed` ante cambios de fuente/prueba de su módulo, conserva fallback a suite completa si no hay diff modular comprobable, y limita cobertura instrumentada completa a dispatch completo explícito.
- **AC-008 (REQ-008):** La prueba de contrato confirma que el job E2E depende del job que publica el release, usa `browser_download_url`/la URL canónica pública, valida hashes, descarga el baseline v1.2.3, ejecuta el runner E2E completo y vuelve a borrador el release ante fallo.
- **AC-009 (REQ-009):** La prueba de contrato falla si el Dockerfile backend omite la copia del archivo de configuración Prisma o si esa copia aparece después del build.
- **AC-010 (REQ-010):** Los contratos comprueban que la cobertura del diff corre sin umbral por defecto y que el workflow de PR no define un gate porcentual; los umbrales solo se aplican cuando se pasan explícitamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Permisos mínimos de los workflows de validación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-002 | Publicaciones serializadas sin cancelación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-003 | Tag Docker alineada con versión declarada | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-004 | Separar build de instalador y publicación privilegiada | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-005 | Rechazar tags no canónicas de forma consistente | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-006 | Activar publicación beta automática después de CI verde en main | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-007 | Ejecutar pruebas afectadas por módulo y dejar cobertura global para corridas completas | `scripts/tests/ci-workflow-contract.test.mjs`; `scripts/tests/backend-test-batches.test.mjs` | Implementado |
| REQ-008 | E2E completa del EXE descargado del release público y rollback si falla | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-009 | Copiar configuración Prisma antes del build Docker backend | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-010 | Cobertura diagnóstica sin umbral universal; umbral únicamente explícito | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
