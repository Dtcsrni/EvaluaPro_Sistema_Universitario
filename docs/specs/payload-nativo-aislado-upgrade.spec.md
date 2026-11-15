---
id: SPEC-INSTALL-PAYLOAD-UPGRADE
titulo: Aislamiento del payload nativo durante actualizaciones relacionadas
version: 1.0.0
fecha: 2026-11-15
autor: Codex
modulo: installer_hub_docente
estado: approved
---

## Contexto

En una actualización Burn instala el MSI nuevo y después retira bundles relacionados anteriores. Sus helpers de desinstalación pueden limpiar el directorio compartido `LocalAppData\EvaluaPro`, por lo que eliminan el ZIP que el helper de la versión nueva aún necesita extraer. La instalación queda incompleta aunque MSI y Burn reporten Apply exitoso.

## Requisitos Funcionales

- REQ-001: El MSI docente-local instala el archivo ZIP versionado fuera del directorio que se limpia al desinstalar una versión anterior.
- REQ-002: El helper post-install resuelve el ZIP desde `LocalAppData\EvaluaProInstaller\installer-hub\payloads` y conserva validaciones de existencia, tipo de archivo y extracción segura.
- REQ-003: La regresión E2E de bundles relacionados exige que el ZIP de la versión candidata y todos los archivos del payload instalado existan tras completar la actualización.
- REQ-004: Una desinstalación MSI retira el ZIP de su versión; no se amplía el borrado del helper al directorio de payloads.

## Criterios de Aceptación

- El contrato confirma que la tabla de archivos asigna el ZIP al directorio externo `PAYLOADFOLDER`.
- El contrato confirma que helper y MSI resuelven el mismo directorio de payloads.
- La E2E de upgrade relacionado verifica el ZIP exacto según `appVersion` y `hubVersion`, además de `EvaluaPro.exe`, manifest y runtime.
- Compilación WiX, contratos Installer Hub y E2E Windows pasan en CI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Directorio aislado coherente entre WiX y helper | `scripts/tests/installer-hub-contract.test.mjs` | Implementado; validar |
| REQ-003 | ZIP exacto y payload íntegro tras upgrade relacionado | `scripts/tests/installer-hub-e2e-docente.ps1` | Implementado; validar en Windows CI |
| REQ-004 | El ZIP queda bajo ownership de MSI y fuera del cleanup del helper | `scripts/tests/installer-hub-contract.test.mjs` | Implementado; validar |
