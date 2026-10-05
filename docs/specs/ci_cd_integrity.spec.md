---
id: SPEC-CI-CD-INTEGRITY
titulo: Integridad y seguridad de ciclos CI/CD
version: 1.1.0
fecha: 2026-10-04
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
- **REQ-007:** `CI Checks` es propietario de las suites completas, coverage y diff coverage. Los workflows de módulo mantienen señales rápidas y específicas, no vuelven a ejecutar coverage; diff coverage evalúa código cambiado y solo puede excluir archivos concretos de deuda aprobada, nunca un directorio `src` completo.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Las pruebas de contrato enumeran workflows read-only y fallan si pierden `contents: read` o habilitan permisos de escritura.
- **AC-002 (REQ-002):** Las pruebas de contrato verifican que package, release-beta, stable-gate y tag guard no cancelan una publicación activa; el instalador cancela CI de ramas pero serializa tags.
- **AC-003 (REQ-003):** La prueba de contrato confirma la comparación tag/versión antes del primer `docker push`.
- **AC-004 (REQ-004):** La prueba de contrato comprueba que únicamente el job de publicación tiene `contents: write`, descarga el artefacto del job de build y depende de su éxito.
- **AC-005 (REQ-005):** La prueba de contrato ejecuta la expresión del guard contra versiones válidas y casos con ceros iniciales/sufijos no admitidos; confirma que cleanup rechaza una tag válida o repositorio inválido y permite limpiar tags de formato inválido.
- **AC-006 (REQ-006):** La prueba de contrato confirma el trigger `workflow_run` de `CI Checks` completado sobre `main` y la defensa adicional por conclusión exitosa y rama `main`.
- **AC-007 (REQ-007):** La prueba de contrato confirma que el workflow central conserva suites/coverage/diff coverage, los workflows de módulo no duplican coverage y no hay exclusiones de diff coverage para raíces `src`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Permisos mínimos de los workflows de validación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-002 | Publicaciones serializadas sin cancelación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-003 | Tag Docker alineada con versión declarada | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-004 | Separar build de instalador y publicación privilegiada | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-005 | Rechazar tags no canónicas de forma consistente | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-006 | Activar publicación beta automática después de CI verde en main | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-007 | Ejecutar coverage una sola vez y medir líneas reales del diff | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
