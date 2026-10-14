---
id: SPEC-101
titulo: Aislamiento ACL de reportes E2E Installer Hub
version: 1.1.0
fecha: 2026-10-14
autor: Codex
modulo: installer_hub_ci
estado: approved
---

## Contexto

La E2E de upgrade de Installer Hub falló antes de instalar el baseline porque el directorio de handoff heredó permisos de escritura para `BUILTIN\Users`. El validador de seguridad rechazó correctamente ese ACL. Los reportes contienen solicitudes y respuestas operativas del instalador; deben generarse en un directorio aislado con permisos explícitos y conservarse como artefactos de CI.

Al repetir el E2E se detectó que el runner intentaba importar el módulo con `Import-Module -LiteralPath`, parámetro que no existe en Windows PowerShell 5.1. La importación debe usar `-Name` con la ruta como valor; el contrato debe probar tanto la invocación del runner como el binding real del módulo en Windows.

## Requisitos Funcionales

- **REQ-001:** El runner E2E creará el directorio de reporte como hijo directo de un padre existente cuyo ACL no permita escritura a grupos amplios; la carpeta nueva no heredará ACL y concederá acceso completo solo a la identidad actual y `SYSTEM`.
- **REQ-002:** El runner rechazará padres reparse point, ACL inseguros y rutas de reporte preexistentes sin modificarlas; fallará cerrado si no puede establecer o verificar el ACL y conservará sin cambios el guard de `Test-InstallerHubPrivateAcl`.
- **REQ-003:** Los flujos E2E de CI (workflow dispatch, release draft y release público) ubicarán sus reportes en una ruta única de `RUNNER_TEMP`, fuera del checkout, y subirán el mismo directorio como artefacto incluso tras fallos.
- **REQ-004:** Pruebas de contrato impedirán regresar a rutas de reporte heredables y comprobarán en Windows que el inicializador produce ACL privado.
- **REQ-005:** El runner importará el módulo ACL mediante un parámetro admitido por Windows PowerShell 5.1; el contrato comprobará la línea del runner y ejecutará una prueba de importación del módulo en Windows.

## Criterios de Aceptación

- Un directorio nuevo pasa el guard de ACL; los ACE heredados quedan deshabilitados y los reportes siguen accesibles para el runner y el proceso de carga de artefactos.
- Un ACL amplio preexistente no se sanea silenciosamente: la inicialización lo rechaza para evitar modificar datos ajenos.
- Los tres flujos CI usan `RUNNER_TEMP`; el upload de artefactos apunta a la ruta exacta preparada por cada flujo.
- Las pruebas focalizadas cubren contrato CI y ACL real en Windows. El E2E de upgrade v1.2.3 → v1.2.8 debe terminar antes de considerar exitoso el cambio; no se crea tag ni release como parte de esta spec.
- La prueba de importación no depende de PowerShell 7 ni de parámetros inexistentes en Windows PowerShell 5.1.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Crea directorio privado y rechaza rutas existentes inseguras | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente |
| REQ-003, REQ-004 | Contrato de rutas/artefactos y seguridad del reporte en todos los flujos CI | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente |
| REQ-005 | Invocación compatible del módulo y prueba real de importación en Windows PowerShell | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente |
