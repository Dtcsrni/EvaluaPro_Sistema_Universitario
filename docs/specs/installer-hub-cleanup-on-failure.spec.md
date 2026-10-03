---
id: SPEC-INSTALLER-ROLLBACK-CLEANUP
titulo: Limpieza y Rollback Automatico ante Fallos de Instalacion
version: 1.2.0
fecha: 2026-10-03
autor: Codex / Agente IA
modulo: modulo_installer_windows
estado: implemented
---

# SPEC-INSTALLER-ROLLBACK-CLEANUP: Limpieza y Rollback Automatico ante Fallos de Instalacion

## Contexto
Si el proceso de instalacion de EvaluaPro se interrumpe, cancela o falla en cualquiera de sus etapas, el sistema debe quedar limpio.

## Requisitos Funcionales
- REQ-001: En caso de error fatal se invoca Invoke-RollbackOnFailure.
- REQ-002: La creación o reconciliación de accesos directos es degradable; un fallo debe registrarse y permitir terminar si el payload, configuración operativa, runtime SQLite y manifiesto de actualización son válidos.
- REQ-003: Si el paso de accesos directos falla o no deja el manifiesto de instalación, el helper debe generarlo de forma independiente. Si tampoco puede generarlo, la instalación falla con diagnóstico y rollback seguro.

## Criterios de Aceptación
- Fallos en post-install no dejan archivos huerfanos.
- El fallo exclusivo de accesos directos no desinstala el MSI; la respuesta del helper conserva `ok=true`, `degraded=true` y un warning legible.
- La instalación continúa siendo bloqueante ante errores de payload, configuración operativa, SQLite, runtime requerido o manifiesto de actualización.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Rollback automático y limpieza ante fallos | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
| REQ-002 | Fallo de accesos directos degrada sin desinstalar el MSI | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
| REQ-003 | Manifiesto de instalación independiente para actualización | `scripts/tests/installer-hub-contract.test.mjs` | Completado |
