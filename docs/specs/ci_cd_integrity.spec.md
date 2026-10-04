---
id: SPEC-CI-CD-INTEGRITY
titulo: Integridad y seguridad de ciclos CI/CD
version: 1.0.0
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

## Criterios de Aceptación
- **AC-001 (REQ-001):** Las pruebas de contrato enumeran workflows read-only y fallan si pierden `contents: read` o habilitan permisos de escritura.
- **AC-002 (REQ-002):** Las pruebas de contrato verifican que package, release-beta, stable-gate y tag guard no cancelan una publicación activa; el instalador cancela CI de ramas pero serializa tags.
- **AC-003 (REQ-003):** La prueba de contrato confirma la comparación tag/versión antes del primer `docker push`.
- **AC-004 (REQ-004):** La prueba de contrato comprueba que únicamente el job de publicación tiene `contents: write`, descarga el artefacto del job de build y depende de su éxito.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Permisos mínimos de los workflows de validación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-002 | Publicaciones serializadas sin cancelación | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-003 | Tag Docker alineada con versión declarada | `scripts/tests/ci-workflow-contract.test.mjs` | Implementado |
| REQ-004 | Separar build de instalador y publicación privilegiada | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
