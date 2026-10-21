---
id: SPEC-123
titulo: Idempotencia de limpieza de bundles relacionados en Installer Hub
version: 1.0.0
fecha: 2026-10-21
autor: Ingeniería / Codex
modulo: installer_hub
estado: approved
---

## Contexto

El incidente de Windows 11 del 21-oct-2026 confirmó que Burn detectó y planificó dos veces la misma identidad PerUser del bundle anterior. La primera desinstalación quitó su EXE de Package Cache y la segunda falló con `0x80070003`. El MSI nuevo ya había terminado correctamente. El BA debe solicitar cada uninstall de identidad relacionada como máximo una vez y conservar payload/datos si la limpieza de un bundle realmente falla.

## Requisitos Funcionales

- **REQ-001:** Durante cada planificación, registrar la identidad de cada bundle relacionado. Ante callbacks duplicados de la misma identidad, conservar la primera solicitud y convertir una solicitud repetida `Absent` o `ForceAbsent` en `Present`.
- **REQ-002:** Registrar los eventos de detección y planificación para que el log permita asociar identidad, relación, alcance, versión y estado efectivo.
- **REQ-003:** Tolerar `0x80070003` únicamente cuando la misma identidad fue solicitada para uninstall y un callback previo confirmó éxito de uninstall dentro del mismo Apply. Los demás fallos de limpieza mantienen el resultado fallido.
- **REQ-004:** Si falla la limpieza relacionada después de aplicar el MSI, preservar payload y datos; no ejecutar el rollback de archivos que puede dejar el producto incompleto.
- **REQ-005:** La E2E Windows instala un fixture Burn PerUser de versión previa, confirma que la detección duplicada se reprodujo, verifica el estado repetido `Present`, la retirada del fixture y la instalación candidata; limpia el fixture incluso si el escenario falla.

## Criterios de Aceptación

- El contrato enfocado verifica las reglas de planificación, tolerancia acotada y preservación.
- La BA compila para `net8.0-windows`.
- La E2E Windows falla si no se reproduce la detección duplicada, si falta la evidencia `effectiveState=Present`, si queda registrado el fixture o si Burn vuelve a intentar iniciar la ruta eliminada.
- La E2E corre en el job Windows de Installer Hub y conserva su reporte habitual.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Plan duplicado conserva el primer uninstall y no repite `Absent` | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Implementado localmente |
| REQ-002 | Logs de detección y planificación permiten correlación | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Implementado localmente |
| REQ-003 | Solo se tolera el path error después del éxito previo de la misma identidad | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Implementado localmente |
| REQ-004 | Fallo de limpieza relacionada conserva payload/datos | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Implementado localmente |
| REQ-005 | Fixture de versión previa se verifica y retira en E2E Windows | `scripts/tests/installer-upgrade-e2e-contract.test.mjs`; `scripts/tests/installer-hub-e2e-docente.ps1`; `.github/workflows/ci-installer-windows.yml` | Validación runtime Windows pendiente |
