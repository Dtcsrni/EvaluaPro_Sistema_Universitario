---
id: SPEC-RELEASE-STABLE-INSTALLER-FIRMA
titulo: Gate estable exige instaladores firmados
version: 1.0.0
fecha: 2026-06-27
autor: Codex / Agente IA
modulo: release
estado: implemented
---

# SPEC-RELEASE-STABLE-INSTALLER-FIRMA: Gate estable exige instaladores firmados

## Contexto
Una promocion estable para usuarios finales de Windows no debe aprobarse si los artefactos del instalador se generaron sin firma de codigo. El manifest release ya registra `signed`; el gate estable debe tratar cualquier artefacto no firmado como No-Go para evitar publicar instaladores que Windows marque como no confiables.

## Requisitos Funcionales
- **REQ-001:** `release:validate:stable` debe validar que el manifest de instalador contenga los flavors requeridos `saas-completo` y `docente-local`.
- **REQ-002:** `release:validate:stable` debe fallar si cualquier artefacto del manifest tiene `signed` distinto de `true`.
- **REQ-003:** El detalle del check debe indicar que hay artefactos sin firma cuando aplique.
- **REQ-004:** El flujo `installer:sign` debe regenerar hashes y manifest despues de firmar, porque la firma cambia los binarios.
- **REQ-005:** `release:validate:stable` debe fallar si un artefacto del manifest no contiene `name`, `path` y `sha256`.
- **REQ-006:** Debe existir un smoke local reproducible para validar el gate de flujo docente mayo-junio sin sobrescribir la evidencia productiva `1.1.0` ni declararse como entorno productivo.
- **REQ-007:** `release:validate:stable` debe fallar si no existe evidencia externa real de Google Classroom validada por `release:check:classroom-e2e`.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Un manifest completo con flavors requeridos y artefactos firmados permite aprobar el check de instalador.
- **AC-002 (REQ-002):** Un manifest con `signed:false` en cualquier artefacto produce `No-Go`.
- **AC-003 (REQ-003):** El resultado del check `installer-multi-flavor` contiene un mensaje accionable sobre artefactos no firmados.
- **AC-004 (REQ-004):** `sign-installer-artifacts.ps1` invoca `generate-installer-hashes.ps1` despues de completar la firma.
- **AC-005 (REQ-005):** Un manifest con artefactos firmados pero sin `path` verificable produce `No-Go`.
- **AC-006 (REQ-006):** El smoke local escribe evidencia bajo una version separada `1.1.0-local.0`, registra `entorno=local-smoke` y conserva `1.1.0` como gate humano productivo independiente.
- **AC-007 (REQ-007):** Una promocion stable sin JSON Classroom real validable produce `No-Go` en el check `classroom-e2e-evidence`.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Manifest multi-flavor completo | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-002 | Rechazo de artefactos no firmados | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-003 | Mensaje de No-Go por firma faltante | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-004 | Hashes y manifest regenerados despues de firma | scripts/tests/installer-hub-contract.test.mjs | Completado |
| REQ-005 | Artefactos firmados requieren path y sha256 | scripts/tests/release-stable-promotion.test.mjs | Completado |
| REQ-006 | Smoke local separado para flujo docente mayo-junio | scripts/release/prod-flow-local-smoke.mjs | Completado |
| REQ-007 | Stable requiere evidencia Classroom real | scripts/tests/release-stable-promotion.test.mjs | Completado |
