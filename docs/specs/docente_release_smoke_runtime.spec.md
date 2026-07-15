---
id: SPEC-DOCENTE-RELEASE-SMOKE
titulo: Release smoke del flavor docente nativo
version: 1.0.0
fecha: 2026-07-14
autor: Codex
modulo: installer_hub_docente
estado: approved
---

## Contexto

El flavor `docente-local` debe instalar un runtime nativo ligero y verificable. El smoke de release no puede exigir el runtime legado WSL2/Docker ni aceptar un manifest inconsistente con la política del flavor.

## Requisitos Funcionales

- REQ-001: El smoke debe verificar que `docente-local` declara `native-node-sqlite` como runtime objetivo.
- REQ-002: El smoke debe comprobar manifest, shortcuts y control plane sin depender de Docker/WSL2.
- REQ-003: El smoke debe conservar una expectativa explícita de estado operativo para detectar regresiones de bundle.
- REQ-004: La UX docente debe respetar el contrato visual de radios contenidos y matriz canónica de pantallas.

## Criterios de Aceptación

- El test `windows-release-smoke` pasa contra el bundle docente generado por `origin/main`.
- Ninguna aserción del smoke docente exige `wsl2-docker-minimal`.
- La validación mantiene cobertura de manifest, runtime embebido, shortcuts y `/api/status`.
- El contrato visual y la matriz de pantallas pasan sin radios oversized ni pantallas omitidas.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Runtime nativo docente | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-002 | Integridad del bundle y control plane | `scripts/tests/windows-release-smoke.test.mjs` | Completado |
| REQ-003 | Smoke activo y límite de footprint | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-004 | Contrato visual y matriz UX/UI | `scripts/tests/gui-design-contract.test.mjs` | Completado |
