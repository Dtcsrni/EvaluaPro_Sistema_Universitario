---
id: SPEC-INSTALLER-ROLLBACK-CLEANUP
titulo: Limpieza y Rollback Automatico ante Fallos de Instalacion
version: 1.1.0
fecha: 2026-08-18
autor: Codex / Agente IA
modulo: modulo_installer_windows
estado: implemented
---

# SPEC-INSTALLER-ROLLBACK-CLEANUP: Limpieza y Rollback Automatico ante Fallos de Instalacion

## Contexto
Si el proceso de instalacion de EvaluaPro se interrumpe, cancela o falla en cualquiera de sus etapas, el sistema debe quedar limpio.

## Requisitos Funcionales
- REQ-001: En caso de error fatal se invoca Invoke-RollbackOnFailure.

## Criterios de Aceptación
- Fallos en post-install no dejan archivos huerfanos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Rollback automático y limpieza ante fallos | `scripts/tests/installer-hub-contract.test.mjs` | Implementado |
